-- Untuk database yang sudah dibuat dengan versi lama.
-- Jalankan sekali di Supabase: SQL Editor > New query > paste > Run.
-- (Jalankan juga upgrade-client-email.sql lebih dulu jika belum pernah.)

alter table booking_private add column if not exists drive_folder_id text not null default '';
alter table booking_private add column if not exists edited_folder_id text not null default '';
alter table booking_private add column if not exists max_select int not null default 20;
alter table booking_private add column if not exists stage text not null default '' check (stage in ('', 'proses', 'selesai'));
alter table booking_private add column if not exists selection jsonb not null default '[]'::jsonb;
alter table booking_private add column if not exists selection_saved_at timestamptz;
