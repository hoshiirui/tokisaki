-- Menambah tabel profil pengguna dan notifikasi.
-- Jalankan sekali di Supabase: SQL Editor > New query > paste > Run. Aman dijalankan ulang.

-- Profil pengguna: nama tampilan dan kontak (opsional), diisi saat pertama kali login.
create table if not exists profiles (
  email text primary key,
  display_name text not null,
  contact text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- Notifikasi untuk pengguna: sesi baru, perubahan status, dan seterusnya.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  kind text not null default 'info',
  title text not null,
  body text not null default '',
  link text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_email_idx on notifications (email, created_at desc);
alter table notifications enable row level security;
