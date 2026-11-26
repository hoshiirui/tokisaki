-- Jalankan sekali di Supabase: SQL Editor > New query > paste > Run.

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  studio text not null default 'Studio Foto',
  tagline text not null default 'Lihat tanggal yang masih tersedia, lalu hubungi kami untuk booking sesi foto.',
  whatsapp text not null default '',
  show_info_default boolean not null default true
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- Data yang boleh dilihat client (tanggal tanpa baris = tersedia)
create table if not exists bookings (
  date date primary key,
  status text not null check (status in ('booked', 'blocked')),
  public_info text not null default '',
  show_info boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Data yang hanya boleh dilihat pemilik
create table if not exists booking_private (
  date date primary key,
  client text not null default '',
  client_email text not null default '',
  contact text not null default '',
  session_time text not null default '',
  location text not null default '',
  notes text not null default '',
  doc_url text not null default '',
  -- Galeri client (Google Drive)
  drive_folder_id text not null default '',
  edited_folder_id text not null default '',
  max_select int not null default 20,
  stage text not null default '' check (stage in ('', 'proses', 'selesai')),
  selection jsonb not null default '[]'::jsonb,
  selection_saved_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists booking_private_client_email_idx on booking_private (client_email);

-- Kunci semua tabel dari akses langsung lewat API publik Supabase.
-- Aplikasi membaca dan menulis hanya dari server Next.js dengan kunci service_role,
-- yang tidak terkena aturan ini.
alter table settings enable row level security;
alter table bookings enable row level security;
alter table booking_private enable row level security;
