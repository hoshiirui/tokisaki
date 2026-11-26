-- Untuk database yang sudah dibuat dengan schema.sql versi lama.
-- Jalankan sekali di Supabase: SQL Editor > New query > paste > Run.

alter table booking_private add column if not exists client_email text not null default '';
create index if not exists booking_private_client_email_idx on booking_private (client_email);
