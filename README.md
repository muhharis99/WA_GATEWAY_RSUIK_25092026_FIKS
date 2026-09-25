# WA_GATEWAY_RSUIK_25092026_FIKS

Satu repository untuk tiga sistem RSUIK:
1. Reminder Dokter
2. Laboratorium
3. Ijin Dokter

Tampilan web mengikuti basis Reminder Dokter.

## Struktur
- /index.php — Reminder Dokter
- /lab/index.php — menu Laboratorium
- /ijin/index.php — menu Ijin WA
- /chat_dokter.php — Chat Dokter
- /master.php — Master Data
- /settings.php — Template
- /report.php — Report

## Gateway
Port lama tetap dipertahankan:
- 3210 Reminder + Chat
- 9000 LAB
- 3000 IJIN

Ketiganya berada dalam satu repository; masing-masing service memakai source gateway yang sudah terbukti di project asal.

## Install
composer install
npm install

Isi environment database dan jalankan service sesuai kebutuhan:
npm run start:reminder
npm run start:lab
npm run start:ijin

Password database dan session WhatsApp sengaja tidak disimpan di repository.
