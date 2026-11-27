-- Untuk database lama (satu sesi per tanggal di tabel booking_private).
-- Jalankan sekali di Supabase: SQL Editor > New query > paste > Run.
-- Aman dijalankan ulang. Tabel booking_private tidak dihapus, sebagai cadangan.
-- Setelah semuanya berjalan baik, tabel itu boleh dihapus manual: drop table booking_private;

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
  claim_code text not null unique,
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

create table if not exists session_members (
  session_id uuid not null references sessions (id) on delete cascade,
  email text not null,
  source text not null default 'kode' check (source in ('kode', 'email', 'pemilik')),
  created_at timestamptz not null default now(),
  primary key (session_id, email)
);
create index if not exists session_members_email_idx on session_members (email);

create table if not exists claim_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ok boolean not null,
  at timestamptz not null default now()
);
create index if not exists claim_attempts_email_idx on claim_attempts (email, at);

alter table sessions enable row level security;
alter table session_members enable row level security;
alter table claim_attempts enable row level security;

-- Pindahkan data lama: tiap baris booking_private menjadi satu sesi.
-- Judul sesi diambil dari info tanggal, dan email client lama menjadi anggota sesi.
do $$
begin
  if to_regclass('public.booking_private') is not null then
    insert into sessions (
      date, title, client, contact, session_time, location, notes, doc_url, claim_code,
      drive_folder_id, edited_folder_id, max_select, stage, selection, selection_saved_at, updated_at
    )
    select
      p.date, coalesce(b.public_info, ''), p.client, p.contact, p.session_time, p.location, p.notes, p.doc_url,
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
      p.drive_folder_id, p.edited_folder_id, p.max_select, p.stage, p.selection, p.selection_saved_at, p.updated_at
    from booking_private p
    left join bookings b on b.date = p.date
    where not exists (select 1 from sessions s where s.date = p.date);

    insert into session_members (session_id, email, source)
    select s.id, lower(p.client_email), 'email'
    from booking_private p
    join sessions s on s.date = p.date
    where p.client_email <> ''
    on conflict do nothing;
  end if;
end $$;
