# WA_GATEWAY_RSUIK_25092026_FIKS

Satu repository untuk tiga sistem RSUIK:
1. Reminder Dokter
2. Laboratorium
3. Ijin Dokter

Tampilan web mengikuti basis Reminder Dokter.

## Struktur
- /index.php — Reminder Dokter
- /lab/index.php — menu Laboratorium
- /lab/report.php — laporan LAB + filter tanggal + PDF
- /ijin/index.php — menu Ijin WA
- /ijin/report.php — laporan Ijin + filter tanggal + PDF
- /chat_dokter.php — Chat Dokter
- /master.php — Master Data
- /settings.php — Template
- /report.php — laporan Reminder + filter tanggal + PDF
- /report_functions.php — helper filter tanggal dan log laporan gateway

## Laporan
Laporan memakai pola yang sama dengan Report Reminder yang sudah ada:
- filter Tanggal Awal dan Tanggal Akhir
- filter status
- tabel DataTables
- tombol Cetak PDF menggunakan mPDF
- format PDF A4 Landscape
- rekap Total / Terkirim / Gagal

Untuk LAB tersedia filter No. Registrasi. Riwayat pengiriman LAB dan Ijin dicatat di database RSUI Klaten melalui tabel:
- wa_gateway_lab_logs
- wa_gateway_ijin_logs

Tabel laporan dibuat otomatis dengan CREATE TABLE IF NOT EXISTS saat modul laporan/pengiriman dipakai. Jika akun database tidak memiliki hak CREATE TABLE, buat tabel tersebut secara manual dari skema pada `report_functions.php`.

## Gateway
Port lama tetap dipertahankan:
- 3210 Reminder + Chat
- 9000 LAB
- 3000 IJIN

Ketiganya berada dalam satu repository; masing-masing service memakai source gateway yang sudah terbukti di project asal.

## Install

### PHP / Apache / Nginx
Salin `.env.example` menjadi `.env` di folder yang sama dengan `config.php`:

```bash
cp .env.example .env
nano .env
```

Minimal isi:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=USERNAME_DATABASE_ANDA
DB_PASS=PASSWORD_DATABASE_ANDA
```

PHP sekarang membaca file `.env` secara langsung dari folder project, karena PHP-FPM/Apache biasanya tidak mewariskan variabel environment dari shell.

Pastikan file `.env` bisa dibaca oleh user PHP-FPM/Apache, tetapi jangan dibuat world-readable pada server produksi.

### Dependency
composer install
npm install

Isi environment database dan jalankan service sesuai kebutuhan:
npm run start:reminder
npm run start:lab
npm run start:ijin

Password database dan session WhatsApp sengaja tidak disimpan di repository.


## Troubleshooting koneksi database

Jika muncul error seperti `Access denied for user ''@'localhost'`, berarti username database belum terbaca. Periksa file `.env`, terutama `DB_USER` dan `DB_PASS`. Jangan mengisi username database dengan string kosong. Jika database memakai akun berbeda, gunakan `DB_RSIKLATEN_USER`, `DB_RSI_BYL_USER`, atau `DB_RME_USER` sesuai koneksi yang diperlukan.
