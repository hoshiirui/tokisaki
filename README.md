# Kalender Sesi Foto

Website kalender booking untuk fotografer, dibuat dengan Next.js (App Router). Client melihat tanggal yang tersedia. Pemilik masuk dengan Google untuk mengatur booking, menyimpan detail privat, dan menautkan planning di Google Docs.

## Cara kerja

- **Client**: kalender dengan status Tersedia, Terbooking, dan Tidak tersedia. Klik tanggal terbooking hanya menampilkan info singkat yang kamu tulis.
- **Pemilik**: klik tanggal untuk mengubah status, menulis info untuk client, mengisi detail sesi (nama client, kontak, jam, lokasi, catatan), dan menempel tautan Google Docs untuk planning.
- Info singkat yang kamu sembunyikan dari client dikosongkan di server, jadi tidak ikut terkirim ke browser client.
- Detail privat dan tautan planning hanya dibaca server jika sesi login cocok dengan `OWNER_EMAIL`.
- Semua tabel dikunci dengan Row Level Security. Browser tidak punya akses langsung ke database; semua lewat server Next.js.

## Pengaturan awal

### 1. Database (Supabase)

1. Buat project di https://supabase.com.
2. Buka **SQL Editor**, paste isi `supabase/schema.sql`, lalu **Run**.
3. Buka **Project Settings > API**. Salin **Project URL** dan kunci **service_role**.

Kunci `service_role` bersifat rahasia. Jangan memberinya awalan `NEXT_PUBLIC_` dan jangan di-commit.

### 2. Login Google

1. Buka https://console.cloud.google.com, buat project, lalu **APIs & Services > OAuth consent screen** dan isi data dasar.
2. Buka **Credentials > Create credentials > OAuth client ID**, pilih **Web application**.
3. Tambahkan **Authorized redirect URI**:
   - `http://localhost:3000/api/auth/callback/google` (untuk percobaan lokal)
   - `https://DOMAIN-KAMU/api/auth/callback/google` (setelah deploy)
4. Salin **Client ID** dan **Client secret**.

### 3. Environment variable

Salin `.env.example` menjadi `.env.local`, lalu isi:

| Variabel | Isi |
| --- | --- |
| `SUPABASE_URL` | Project URL dari Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Kunci service_role |
| `AUTH_GOOGLE_ID` | Client ID Google |
| `AUTH_GOOGLE_SECRET` | Client secret Google |
| `AUTH_SECRET` | Hasil `npx auth secret` atau `openssl rand -base64 32` |
| `OWNER_EMAIL` | Email Google kamu. Hanya akun ini yang bisa masuk sebagai pemilik |

### 4. Jalankan

```bash
npm install
npm run dev
```

Buka http://localhost:3000. Klik **Masuk pemilik** di bagian bawah halaman, masuk dengan akun Google yang sama dengan `OWNER_EMAIL`, lalu buka **Pengaturan** untuk mengisi nama studio dan nomor WhatsApp.

## Login client

- Semua akun Google dengan email terverifikasi bisa masuk lewat menu **Login**. Hak pemilik tetap hanya untuk akun yang cocok dengan `OWNER_EMAIL`.
- Di form tanggal (sisi pemilik), isi **Email Google client**. Saat client login dengan email itu, halaman Login menampilkan sesinya: tanggal, info sesi, jam, dan lokasi. Catatan, kontak, dan tautan planning tidak pernah ditampilkan ke client.
- Hanya tanggal yang statusnya masih Terbooking yang muncul di akun client.

**Database yang sudah ada:** jalankan `supabase/upgrade-client-email.sql` sekali di SQL Editor Supabase untuk menambah kolom `client_email`. Database baru cukup memakai `schema.sql`.

**Google Cloud:** selama status aplikasi masih **Testing**, hanya test user yang bisa login. Agar client umum bisa masuk, buka **Google Auth Platform > Audience** lalu klik **Publish app**. Google bisa meminta kamu melengkapi halaman **Branding** (nama aplikasi, email kontak) lebih dulu. Karena aplikasi hanya meminta email dan profil dasar, biasanya tidak perlu verifikasi tambahan.

## Client Portal (galeri foto di Google Drive)

Foto disimpan di Google Drive kamu sendiri. Website membaca folder lewat Google Drive API dan menyajikan foto melalui server. Foto tidak pernah dibuat publik di Drive.

**Alur**
1. Setelah sesi, buat folder untuk sesi itu di Drive dan unggah JPG ke sana lewat aplikasi Drive seperti biasa.
2. Di form tanggal (sisi pemilik), bagian **Galeri client (Google Drive)**: tempel tautan folder foto, isi **Email Google client** (di bagian Detail sesi), dan atur **Maks. foto dipilih** (bawaan 20).
3. Client login, membuka **Client Portal**, memilih foto, lalu menekan **Kirim pilihan**. Pilihan dikunci dan status menjadi **Diproses**.
4. Di form tanggal, kamu melihat daftar nama file pilihan client dan tombol **Salin nama file**.
5. Setelah selesai mengedit, unggah hasilnya ke folder hasil edit di Drive, tempel tautannya di **Folder foto hasil edit**, lalu ubah **Tahap** menjadi **Selesai**. Client melihat bagian Foto hasil edit dan bisa mengunduhnya satu per satu.

Status di kartu sesi: **Akan datang**, **Foto disiapkan** (sesi sudah lewat, folder belum ditautkan), **Pilih foto**, **Diproses**, **Selesai**.

**Setup Google Drive (sekali)**
1. Di Google Cloud project yang sama, buka **APIs & Services > Library**, cari **Google Drive API**, klik **Enable**.
2. Buka **IAM & Admin > Service Accounts > Create service account**. Beri nama bebas, tanpa peran tambahan.
3. Buka service account itu, tab **Keys > Add key > Create new key > JSON**. File JSON terunduh.
4. Dari file JSON, salin `client_email` ke `GOOGLE_SERVICE_ACCOUNT_EMAIL` dan `private_key` ke `GOOGLE_PRIVATE_KEY` (satu baris, `\n` dibiarkan apa adanya, diapit tanda kutip ganda). Simpan file JSON-nya baik-baik dan jangan di-commit.
5. Di Google Drive, buat satu folder induk (misalnya "Galeri Client"), klik **Share**, tambahkan email service account sebagai **Viewer**. Semua subfolder di dalamnya otomatis ikut terbagi.
6. Isi `STUDIO_TIMEZONE` (misalnya `Asia/Makassar`) agar "hari ini" di portal sesuai zona waktumu.

**Database yang sudah ada:** jalankan `supabase/upgrade-client-portal.sql` di SQL Editor Supabase (setelah `upgrade-client-email.sql` jika belum pernah).

**Keamanan:** setiap foto diperiksa di server. Pengunjung harus login, email-nya harus sama dengan email client yang tercatat di sesi itu (atau pemilik), dan file harus berada di folder sesi tersebut. Foto hasil edit baru terbuka untuk client setelah tahap Selesai. Foto JPG asli tetap bisa dilihat dan diunduh client di semua tahap setelah sesi, termasuk setelah memilih dan setelah hasil edit dikirim.

**Catatan:** thumbnail dimuat bertahap saat di-scroll. Satu sesi dengan ratusan foto bisa terasa lebih lambat daripada layanan galeri khusus, dan foto asli dikirim lewat server sehingga ikut dibatasi batas ukuran respons dan transfer data hosting kamu.

## Client Portal untuk pemilik

Saat kamu (akun `OWNER_EMAIL`) membuka menu **Client Portal**, yang tampil adalah semua sesi client, bukan sesi milikmu sendiri.

- **Daftar sesi:** tanggal, judul, nama dan email client, lokasi, jumlah foto yang dipilih, dan status.
- **Cari dan filter:** kolom cari (nama, email, judul, lokasi, tanggal), filter status dengan jumlah per status, rentang tanggal, dan pintasan Bulan ini, 30 hari terakhir, Tahun ini.
- **Urutkan:** tanggal terbaru, tanggal terlama, nama client A–Z, atau status (Diproses di atas, karena itu yang menunggu diedit).
- **Detail sesi:** klik satu baris. Di sana kamu bisa mengubah **Tahap**, menautkan **folder foto asli** dan **folder hasil edit**, mengatur batas foto, lalu Simpan. Menyimpan dari sini hanya mengubah kolom-kolom itu, jadi catatan, kontak, planning, dan pilihan client tidak tertimpa.
- **Galeri:** tab Pilihan client (dengan tombol Salin nama file), Hasil edit, dan Foto asli. Foto di tab Hasil edit dan Foto asli baru diminta ke Drive saat tab dibuka. Semua bisa diperbesar dan diunduh.
- Tahap Selesai hanya bisa disimpan jika folder hasil edit sudah ditautkan.

## Deploy ke Vercel

1. Push proyek ini ke GitHub, lalu import di https://vercel.com/new.
2. Isi semua environment variable di atas pada **Settings > Environment Variables**.
3. Setelah deploy, tambahkan `https://DOMAIN-KAMU/api/auth/callback/google` ke Authorized redirect URI di Google Cloud.

Di luar Vercel (misalnya VPS), tambahkan juga `AUTH_TRUST_HOST=true`.

## Struktur

```
app/page.tsx            Home (landing page)
app/kalender/page.tsx   kalender (server): memuat data sesuai peran
app/client-portal       daftar sesi client; /client-portal/[date] untuk pilih foto dan hasil edit
app/api/drive/[fileId]  menyajikan foto dari Drive setelah cek akses
app/portal-actions.ts   client mengirim pilihan foto
lib/drive.ts            klien Google Drive (service account)
lib/portal.ts           data sesi dan status
app/pricelist, app/portfolio   kerangka halaman, isi menyusul
app/login/page.tsx      login Google; client melihat sesinya, pemilik ke kalender
components/SiteNav.tsx  navbar: Home, Kalender, Pricelist, Portfolio, Client Portal, Login
app/actions.ts          simpan tanggal dan pengaturan (server actions, dicek ke pemilik)
auth.ts                 login Google, dibatasi ke OWNER_EMAIL
lib/data.ts             query Supabase
components/             kalender, form pemilik, form pengaturan
supabase/schema.sql     tabel dan RLS
```

## Catatan

- Setelah tautan planning disimpan, tombol **Tampilkan pratinjau** membuka modal di tengah layar berisi dokumen (mode baca). Modal ditutup dengan tombol Tutup, tombol Esc, atau klik di area gelap. Pratinjau hanya tampil jika browser sedang login ke akun Google yang punya akses ke dokumen. Mengedit lewat tombol **Buka di Google Docs** di dalam modal.
- Pratinjau dan tautan planning tidak pernah dikirim ke sisi client. Jangan pakai "Publish to web" di Google Docs, karena itu membuat planning bisa dibaca siapa saja yang punya tautannya.
- Kalender menampilkan 2 bulan ke belakang sampai sekitar 2 tahun ke depan.
