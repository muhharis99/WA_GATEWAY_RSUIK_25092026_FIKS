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

## Database

Koneksi database dipisahkan sesuai tiga project sumber:
- Reminder `local`: konfigurasi `dokter_reminder`
- Reminder `rsiklaten`: konfigurasi `db_67`
- Reminder `rsi_byl`: konfigurasi `rsi_byl`
- Reminder `rme`: konfigurasi `rme`
- DB LAB: `192.168.0.33 / rsiklaten`
- DB Ijin: `192.168.0.33 / rsiklaten`

## Gateway
Port lama tetap dipertahankan:
- 3210 Reminder + Chat
- 9000 LAB
- 3000 IJIN

Ketiganya berada dalam satu repository; masing-masing service memakai source gateway yang sudah terbukti di project asal.

## Install

### PHP / Apache / Nginx
Konfigurasi database sudah disamakan dengan tiga repo sumber. `config.php` memiliki fallback konfigurasi Reminder asli, sedangkan service LAB dan Ijin memiliki fallback konfigurasi masing-masing seperti repo asal. File `.env` tetap tersedia bila Anda ingin override nilai tersebut.

Bila memakai `.env`, salin contoh:

```bash
cp .env.example .env
nano .env
```

PHP membaca `.env` langsung dari folder project sehingga tidak bergantung pada environment shell PHP-FPM/Apache.

Pastikan file `.env` tidak dapat diakses publik oleh web server.

### Dependency
composer install
npm install

Isi environment database dan jalankan service sesuai kebutuhan:
npm run start:reminder
npm run start:lab
npm run start:ijin

Konfigurasi fallback saat ini mengikuti repo sumber yang diminta. Untuk deployment publik, gunakan `.env` dan pertimbangkan memindahkan kredensial dari source code lalu mengganti password database bila repository dapat diakses pihak lain.


## Troubleshooting koneksi database

Jika muncul error seperti `Access denied for user ''@'localhost'`, berarti username database belum terbaca. Periksa file `.env`, terutama `DB_USER` dan `DB_PASS`. Jangan mengisi username database dengan string kosong. Jika database memakai akun berbeda, gunakan `DB_RSIKLATEN_USER`, `DB_RSI_BYL_USER`, atau `DB_RME_USER` sesuai koneksi yang diperlukan.
