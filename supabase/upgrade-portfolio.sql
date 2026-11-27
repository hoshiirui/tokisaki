-- Menambah tabel album Portfolio. Jalankan sekali di Supabase: SQL Editor > New query > paste > Run.
-- Aman dijalankan ulang.

-- Album portfolio. Foto diambil dari folder Google Drive. Hanya dibaca server.
create table if not exists portfolio_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  event_date date,
  drive_folder_id text not null default '',
  cover_file_id text not null default '',
  position int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portfolio_albums_position_idx on portfolio_albums (position);
alter table portfolio_albums enable row level security;
