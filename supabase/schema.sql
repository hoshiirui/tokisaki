-- Jalankan sekali di Supabase: SQL Editor > New query > paste > Run.
-- Untuk database lama (versi satu sesi per tanggal), jalankan supabase/upgrade-multi-session.sql sebagai gantinya.

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  studio text not null default 'Studio Foto',
  tagline text not null default 'Lihat tanggal yang masih tersedia, lalu hubungi kami untuk booking sesi foto.',
  whatsapp text not null default '',
  show_info_default boolean not null default true
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- Status per tanggal, yang boleh dilihat client (tanggal tanpa baris = tersedia)
create table if not exists bookings (
  date date primary key,
  status text not null check (status in ('booked', 'blocked')),
  public_info text not null default '',
  show_info boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Sesi foto. Satu tanggal bisa punya beberapa sesi. Hanya dibaca server.
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null default '',
  client text not null default '',
  contact text not null default '',
  session_time text not null default '',
  location text not null default '',
  notes text not null default '',
  doc_url text not null default '',
  -- Kode untuk client mengklaim sesi ini di Client Portal
  claim_code text not null unique,
  -- Galeri client (Google Drive)
  drive_folder_id text not null default '',
  edited_folder_id text not null default '',
  max_select int not null default 20,
  stage text not null default '' check (stage in ('', 'proses', 'selesai')),
  selection jsonb not null default '[]'::jsonb,
  selection_saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sessions_date_idx on sessions (date);

-- Siapa saja yang boleh melihat sebuah sesi. Satu sesi bisa dimiliki beberapa orang.
create table if not exists session_members (
  session_id uuid not null references sessions (id) on delete cascade,
  email text not null,
  source text not null default 'kode' check (source in ('kode', 'email', 'pemilik')),
  created_at timestamptz not null default now(),
  primary key (session_id, email)
);
create index if not exists session_members_email_idx on session_members (email);

-- Catatan percobaan memasukkan kode, untuk membatasi tebak-tebakan.
create table if not exists claim_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ok boolean not null,
  at timestamptz not null default now()
);
create index if not exists claim_attempts_email_idx on claim_attempts (email, at);

-- Kunci semua tabel dari akses langsung lewat API publik Supabase.
-- Aplikasi membaca dan menulis hanya dari server Next.js dengan kunci service_role,
-- yang tidak terkena aturan ini.
alter table settings enable row level security;
alter table bookings enable row level security;
alter table sessions enable row level security;
alter table session_members enable row level security;
alter table claim_attempts enable row level security;
