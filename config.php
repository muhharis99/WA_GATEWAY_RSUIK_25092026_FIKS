<?php
declare(strict_types=1);
$env=static function(string $k,string $fallback=''):string{$v=getenv($k);return($v===false||$v==='')?$fallback:$v;};
$databases=[
'local'=>['host'=>$env('DB_LOCAL_HOST',$env('DB_HOST','127.0.0.1')),'port'=>(int)$env('DB_LOCAL_PORT','3306'),'user'=>$env('DB_LOCAL_USER',$env('DB_USER','')),'pass'=>$env('DB_LOCAL_PASS',$env('DB_PASS','')),'name'=>$env('DB_LOCAL_NAME','dokter_reminder')],
'rsiklaten'=>['host'=>$env('DB_RSIKLATEN_HOST',$env('DB_HOST','127.0.0.1')),'port'=>(int)$env('DB_RSIKLATEN_PORT','3306'),'user'=>$env('DB_RSIKLATEN_USER',$env('DB_USER','')),'pass'=>$env('DB_RSIKLATEN_PASS',$env('DB_PASS','')),'name'=>$env('DB_RSIKLATEN_NAME','db_67')],
'rsi_byl'=>['host'=>$env('DB_RSI_BYL_HOST',$env('DB_HOST','127.0.0.1')),'port'=>(int)$env('DB_RSI_BYL_PORT','3306'),'user'=>$env('DB_RSI_BYL_USER',$env('DB_USER','')),'pass'=>$env('DB_RSI_BYL_PASS',$env('DB_PASS','')),'name'=>$env('DB_RSI_BYL_NAME','rsi_byl')],
'rme'=>['host'=>$env('DB_RME_HOST',$env('DB_HOST','127.0.0.1')),'port'=>(int)$env('DB_RME_PORT','3306'),'user'=>$env('DB_RME_USER',$env('DB_USER','')),'pass'=>$env('DB_RME_PASS',$env('DB_PASS','')),'name'=>$env('DB_RME_NAME','rme')]];
const APP_NAME='WA Gateway RSUIK';
const DEFAULT_TEMPLATE="Assalamualaikum, {{nama_dokter}}.\n\nMengingatkan bahwa Anda memiliki jadwal praktik:\n\n📅 {{tanggal}}\n🏥 {{nama_rs}}\n🩺 Poli: {{nama_poli}}\n🕐 Jam: {{jam_mulai}} - {{jam_selesai}}\n📍 Lokasi: {{lokasi}}\n\nJumlah Inden Pasien : {{inden}}\n\nApakah ada perubahan Jadwal atau Pembatasan Kuota dokter?\n\nTerima kasih.\nWassalamualaikum, Wr.Wb";
date_default_timezone_set('Asia/Jakarta');