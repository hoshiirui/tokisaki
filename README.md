# Kalender Sesi Foto

Website kalender booking untuk fotografer, dibuat dengan Next.js (App Router). Client melihat tanggal yang tersedia. Pemilik masuk dengan Google untuk mengatur booking, menyimpan detail privat, dan menautkan planning di Google Docs.

## Cara kerja

- **Client**: kalender dengan status Tersedia, Terbooking, dan Tidak tersedia. Klik tanggal terbooking hanya menampilkan info singkat yang kamu tulis.
- **Pemilik**: klik tanggal untuk mengubah status, menulis info untuk client, mengisi detail sesi (nama client, kontak, jam, lokasi, catatan), dan menempel tautan Google Docs untuk planning.
- Info singkat yang kamu sembunyikan dari client dikosongkan di server, jadi tidak ikut terkirim ke browser client.
- Satu tanggal bisa punya beberapa sesi (misalnya tiga client wisuda di hari yang sama), dan satu sesi bisa dimiliki beberapa orang.
- Detail sesi dan tautan planning hanya dibaca server jika sesi login cocok dengan `OWNER_EMAIL`.
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

## Sesi, kode klaim, dan login client

- Semua akun Google dengan email terverifikasi bisa masuk lewat menu **Login**. Hak pemilik tetap hanya untuk akun yang cocok dengan `OWNER_EMAIL`.
- **Beberapa sesi per tanggal:** klik tanggal di kalender, atur status tanggal, lalu klik **Tambah sesi** sebanyak yang kamu perlukan. Tiap sesi punya judul, client, kontak, jam, lokasi, catatan, planning Google Docs, kode klaim, dan galerinya sendiri.
- **Kode klaim:** tiap sesi otomatis punya kode (misalnya `K7M2-QX9P`). Bagikan ke client. Client membuka **Client Portal**, memasukkan kode di kotak **Punya kode sesi?**, dan sesi langsung masuk ke akunnya. Client tidak perlu memberi email.
- **Satu sesi untuk beberapa orang:** semua orang yang memasukkan kode yang sama menjadi anggota sesi itu dan melihat sesi serta galeri yang sama. Pilihan foto berlaku bersama.
- **Email (opsional):** di form sesi kamu boleh mengisi email Google client. Email itu langsung menjadi anggota tanpa perlu kode.
- **Kelola akses:** di halaman detail sesi (Client Portal sisi pemilik) ada kode, daftar anggota, tombol **Hapus akses**, **Buat kode baru** (kode lama mati, anggota yang sudah klaim tetap punya akses), dan **Tambah** anggota lewat email.
- **Keamanan kode:** kode 8 karakter acak. Percobaan salah dibatasi 8 kali per akun dalam 15 menit.
- Menghapus sesi dari kalender juga menghapus pilihan dan daftar anggotanya. Foto di Google Drive tidak ikut terhapus.

**Database baru:** cukup jalankan `supabase/schema.sql`.

**Database lama (satu sesi per tanggal):** jalankan `supabase/upgrade-multi-session.sql` sekali di SQL Editor Supabase. Skrip ini memindahkan tiap baris `booking_private` menjadi satu sesi, memakai info tanggal sebagai judul sesi, menjadikan email client lama sebagai anggota, dan membuat kode klaim untuk semuanya. Tabel `booking_private` tidak dihapus sebagai cadangan. Jika database-mu lebih tua dari fitur Client Portal, jalankan dulu `upgrade-client-email.sql` dan `upgrade-client-portal.sql`. Jalankan skrip migrasi sekali saja, karena menjalankannya ulang akan menambahkan kembali email lama yang sudah kamu hapus dari anggota. Alamat halaman sesi berubah dari `/client-portal/TANGGAL` menjadi `/client-portal/ID`, jadi tautan lama tidak berlaku.

**Google Cloud:** selama status aplikasi masih **Testing**, hanya test user yang bisa login. Agar client umum bisa masuk, buka **Google Auth Platform > Audience** lalu klik **Publish app**. Google bisa meminta kamu melengkapi halaman **Branding** (nama aplikasi, email kontak) lebih dulu. Karena aplikasi hanya meminta email dan profil dasar, biasanya tidak perlu verifikasi tambahan.

## Client Portal (galeri foto di Google Drive)

Foto disimpan di Google Drive kamu sendiri. Website membaca folder lewat Google Drive API dan menyajikan foto melalui server. Foto tidak pernah dibuat publik di Drive.

**Alur**
1. Setelah sesi, buat folder untuk sesi itu di Drive dan unggah JPG ke sana lewat aplikasi Drive seperti biasa.
2. Buka **Client Portal**, klik sesinya, lalu di **Atur sesi** tempel tautan folder foto dan atur **Maks. foto dipilih** (bawaan 20). Bagikan kode klaim sesi ke client.
3. Client login, membuka **Client Portal**, memilih foto, lalu menekan **Kirim pilihan**. Pilihan dikunci dan status menjadi **Diproses**.
4. Di halaman detail sesi, tab **Pilihan client** menampilkan foto pilihan dan tombol **Salin nama file**.
5. Setelah selesai mengedit, unggah hasilnya ke folder hasil edit di Drive, tempel tautannya di **Folder foto hasil edit**, lalu ubah **Tahap** menjadi **Selesai**. Client melihat bagian Foto hasil edit dan bisa mengunduhnya satu per satu.

Status di kartu sesi: **Akan datang**, **Foto disiapkan** (sesi sudah lewat, folder belum ditautkan), **Pilih foto**, **Diproses**, **Selesai**.

**Setup Google Drive (sekali)**
1. Di Google Cloud project yang sama, buka **APIs & Services > Library**, cari **Google Drive API**, klik **Enable**.
2. Buka **IAM & Admin > Service Accounts > Create service account**. Beri nama bebas, tanpa peran tambahan.
3. Buka service account itu, tab **Keys > Add key > Create new key > JSON**. File JSON terunduh.
4. Dari file JSON, salin `client_email` ke `GOOGLE_SERVICE_ACCOUNT_EMAIL` dan `private_key` ke `GOOGLE_PRIVATE_KEY` (satu baris, `\n` dibiarkan apa adanya, diapit tanda kutip ganda). Simpan file JSON-nya baik-baik dan jangan di-commit.
5. Di Google Drive, buat satu folder induk (misalnya "Galeri Client"), klik **Share**, tambahkan email service account sebagai **Viewer**. Semua subfolder di dalamnya otomatis ikut terbagi.
6. Isi `STUDIO_TIMEZONE` (misalnya `Asia/Makassar`) agar "hari ini" di portal sesuai zona waktumu.

**Keamanan:** setiap foto diperiksa di server. Pengunjung harus login, dan harus pemilik atau anggota sesi itu, dan file harus berada di folder sesi tersebut. Foto hasil edit baru terbuka untuk client setelah tahap Selesai. Foto JPG asli tetap bisa dilihat dan diunduh client di semua tahap setelah sesi, termasuk setelah memilih dan setelah hasil edit dikirim.

**Catatan:** thumbnail dimuat bertahap saat di-scroll. Satu sesi dengan ratusan foto bisa terasa lebih lambat daripada layanan galeri khusus, dan foto asli dikirim lewat server sehingga ikut dibatasi batas ukuran respons dan transfer data hosting kamu.

## Client Portal untuk pemilik

Saat kamu (akun `OWNER_EMAIL`) membuka menu **Client Portal**, yang tampil adalah semua sesi client, bukan sesi milikmu sendiri.

- **Daftar sesi:** tanggal, judul, nama dan email client, lokasi, jumlah foto yang dipilih, dan status.
- **Cari dan filter:** kolom cari (nama, email, judul, lokasi, tanggal), filter status dengan jumlah per status, rentang tanggal, dan pintasan Bulan ini, 30 hari terakhir, Tahun ini.
- **Urutkan:** tanggal terbaru, tanggal terlama, nama client A–Z, atau status (Diproses di atas, karena itu yang menunggu diedit).
- **Detail sesi:** klik satu baris. Di sana kamu bisa mengubah **Tahap**, menautkan **folder foto asli** dan **folder hasil edit**, mengatur batas foto, lalu Simpan. Menyimpan dari sini hanya mengubah kolom-kolom itu, jadi catatan, kontak, planning, dan pilihan client tidak tertimpa.
- **Galeri:** tab Pilihan client (dengan tombol Salin nama file), Hasil edit, dan Foto asli. Foto di tab Hasil edit dan Foto asli baru diminta ke Drive saat tab dibuka. Semua bisa diperbesar dan diunduh.
- Tahap Selesai hanya bisa disimpan jika folder hasil edit sudah ditautkan.

## Portfolio

Halaman **Portfolio** berisi kumpulan album (satu album per acara atau sesi). Fotonya diambil dari Google Drive, dan pengunjung hanya bisa melihatnya.

**Untuk pemilik** (saat login dengan akun `OWNER_EMAIL`):
- Klik **Tambah album**, isi judul, tanggal acara (opsional), deskripsi (opsional), dan tempel tautan folder Drive berisi foto. Centang **Tampilkan album ini di halaman Portfolio** agar tampil ke pengunjung. Tanpa centang, album menjadi draf yang hanya terlihat olehmu.
- **Thumbnail:** buka album, klik satu foto, lalu **Jadikan thumbnail**. Tanpa pilihan, thumbnail memakai foto pertama di folder. Mengganti folder mereset thumbnail.
- **Urutan:** tombol panah di pojok kanan atas kartu album menggeser album ke depan atau ke belakang. Album baru muncul paling depan.
- **Atur album** di halaman album: ubah judul, folder, tampil atau draf, atau hapus album. Menghapus album tidak menghapus foto di Drive.
- Folder harus berada di dalam folder Drive yang sudah dibagikan ke service account (sama seperti galeri client).

**Database:** database baru cukup memakai `supabase/schema.sql`. Database lama jalankan `supabase/upgrade-portfolio.sql` sekali.

**Soal "tidak bisa diunduh":** website tidak menyediakan tombol unduh, tidak menyajikan file asli (hanya gambar ukuran tampilan, maksimal 1600 px), serta mematikan klik kanan dan seret gambar. Namun siapa pun yang bisa melihat sebuah gambar di layar tetap bisa mengambil tangkapan layar atau mengambil gambar ukuran tampilan lewat alat pengembang browser. Tidak ada cara teknis yang sepenuhnya mencegah itu. Karena yang tersedia hanya ukuran tampilan, hasilnya tidak sebaik file asli. Jika perlu perlindungan lebih, tambahkan watermark pada foto yang kamu taruh di folder portfolio.

## Akun pengguna, tema, dan notifikasi

**Login dan profil.** Tombol Login membuka halaman masuk dengan Google. Pengguna yang baru pertama kali masuk diarahkan ke `/selamat-datang` untuk mengisi nama tampilan (wajib, 2 sampai 40 karakter) dan kontak (opsional). Setelah itu tombol Login di navbar berganti menjadi nama tampilan dengan panah dropdown. Profil bisa diubah kapan saja di `/profil`. Pengguna lama yang belum punya profil tetap memakai nama Google mereka, dan di menu muncul tanda **Lengkapi**.

**Menu pengguna.** Berisi Profil saya, pilihan tampilan **Terang** atau **Gelap**, dan Keluar. Pilihan tema disimpan di browser (localStorage), jadi berlaku per browser dan tidak ikut pindah ke perangkat lain.

**Notifikasi.** Ikon lonceng di sebelah menu pengguna menampilkan jumlah yang belum dibaca dan daftar 30 terbaru. Jumlahnya diperbarui tiap menit selama tab terbuka. Notifikasi dibuat hanya untuk kejadian berikut:

- Fotografer menambahkan akunmu ke sebuah sesi (lewat email atau kode).
- Fotografer mengubah status sesi (Diproses, Selesai, atau dibuka kembali).
- Folder foto asli pertama kali ditautkan ke sesimu.
- Anggota lain dalam sesi yang sama mengirim pilihan foto.
- Untuk pemilik: client mengirim pilihan foto atau mengklaim sesi dengan kode.

Notifikasi yang sudah dibaca dan lebih tua dari 30 hari dibersihkan otomatis.

**Database.** Fitur ini butuh tabel `profiles` dan `notifications`. Instalasi baru sudah termasuk di `supabase/schema.sql`. Untuk database yang sudah berjalan, jalankan `supabase/upgrade-profiles-notifications.sql` di SQL Editor sebelum deploy.

## Deploy ke Vercel

1. Push proyek ini ke GitHub, lalu import di https://vercel.com/new.
2. Isi semua environment variable di atas pada **Settings > Environment Variables**.
3. Setelah deploy, tambahkan `https://DOMAIN-KAMU/api/auth/callback/google` ke Authorized redirect URI di Google Cloud.

Di luar Vercel (misalnya VPS), tambahkan juga `AUTH_TRUST_HOST=true`.

## Struktur

```
app/page.tsx            Home (landing page)
app/kalender/page.tsx   kalender (server): memuat data sesuai peran
app/client-portal       daftar sesi client; /client-portal/[id] untuk pilih foto dan hasil edit; klaim kode di halaman daftar
app/api/drive/[fileId]  menyajikan foto dari Drive setelah cek akses
app/portal-actions.ts   klaim kode, pilihan foto, kelola anggota dan kode (pemilik)
lib/drive.ts            klien Google Drive (service account)
lib/portal.ts           data sesi dan status
app/portfolio          daftar album, /portfolio/[id] galeri album, /portfolio/new (pemilik)
app/api/portfolio       foto portfolio khusus dilihat (tanpa file asli)
app/pricelist           kerangka halaman, isi menyusul
app/login/page.tsx      form login Google
app/selamat-datang      isi nama tampilan dan kontak setelah login pertama
app/profil              ubah profil
app/user-actions.ts     profil dan notifikasi (server actions)
lib/notify.ts           pembuat notifikasi
components/UserMenu.tsx, NotificationBell.tsx   menu pengguna dan lonceng
components/SiteNav.tsx  navbar: Home, Kalender, Pricelist, Portfolio, Client Portal, Login
app/actions.ts          simpan tanggal dan pengaturan (server actions, dicek ke pemilik)
auth.ts                 login Google, dibatasi ke OWNER_EMAIL
lib/data.ts             query Supabase
components/             kalender, form pemilik, form pengaturan
supabase/schema.sql     tabel dan RLS
supabase/upgrade-*.sql  migrasi untuk database yang sudah berjalan
```

## Catatan

- Setelah tautan planning disimpan, tombol **Tampilkan pratinjau** membuka modal di tengah layar berisi dokumen (mode baca). Modal ditutup dengan tombol Tutup, tombol Esc, atau klik di area gelap. Pratinjau hanya tampil jika browser sedang login ke akun Google yang punya akses ke dokumen. Mengedit lewat tombol **Buka di Google Docs** di dalam modal.
- Pratinjau dan tautan planning tidak pernah dikirim ke sisi client. Jangan pakai "Publish to web" di Google Docs, karena itu membuat planning bisa dibaca siapa saja yang punya tautannya.
- Kalender menampilkan 2 bulan ke belakang sampai sekitar 2 tahun ke depan.
