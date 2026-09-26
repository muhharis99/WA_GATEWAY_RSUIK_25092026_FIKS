<?php

declare(strict_types=1);

/**
 * Database configuration for the RSUIK gateway.
 *
 * Priority:
 * 1. Existing process environment variables
 * 2. Project .env file
 * 3. Safe compatibility defaults for non-secret connection settings
 *
 * Database credentials are intentionally not stored in source code.
 * The original projects use:
 * - local      -> 192.168.0.14 / dokter_reminder
 * - rsi_byl    -> 192.168.0.14 / rsi_byl
 * - rsiklaten  -> 192.168.0.67 / db_67
 * - rme        -> 192.168.0.33 / rme
 * - LAB / IJIN -> 192.168.0.33 / rsiklaten
 */

function loadProjectEnv(string $file): void
{
    if (!is_file($file) || !is_readable($file)) {
        return;
    }

    $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || $line[0] === '#') {
            continue;
        }

        if (stripos($line, 'export ') === 0) {
            $line = trim(substr($line, 7));
        }

        $pos = strpos($line, '=');

        if ($pos === false) {
            continue;
        }

        $key = trim(substr($line, 0, $pos));
        $value = trim(substr($line, $pos + 1));

        if ($key === '' || !preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $key)) {
            continue;
        }

        if (
            strlen($value) >= 2 &&
            (
                ($value[0] === '"' && $value[strlen($value) - 1] === '"') ||
                ($value[0] === "'" && $value[strlen($value) - 1] === "'")
            )
        ) {
            $value = substr($value, 1, -1);
        } else {
            $value = trim((string) preg_replace('/\s+#.*$/', '', $value));
        }

        if (getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }
}

loadProjectEnv(__DIR__ . '/.env');

$env = static function (string $key, ?string $fallback = null): string {
    $value = getenv($key);

    if ($value !== false && $value !== '') {
        return $value;
    }

    if ($fallback !== null) {
        return $fallback;
    }

    return '';
};

$databases = [
    'local' => [
        'host' => $env('DB_LOCAL_HOST', '192.168.0.14'),
        'port' => (int) $env('DB_LOCAL_PORT', '3306'),
        'user' => $env('DB_LOCAL_USER'),
        'pass' => $env('DB_LOCAL_PASS'),
        'name' => $env('DB_LOCAL_NAME', 'dokter_reminder')
    ],

    'rsiklaten' => [
        'host' => $env('DB_RSIKLATEN_HOST', '192.168.0.67'),
        'port' => (int) $env('DB_RSIKLATEN_PORT', '3306'),
        'user' => $env('DB_RSIKLATEN_USER', 'admin'),
        'pass' => $env('DB_RSIKLATEN_PASS', ''),
        'name' => $env('DB_RSIKLATEN_NAME', 'db_67')
    ],

    'rsi_byl' => [
        'host' => $env('DB_RSI_BYL_HOST', '192.168.0.14'),
        'port' => (int) $env('DB_RSI_BYL_PORT', '3306'),
        'user' => $env('DB_RSI_BYL_USER'),
        'pass' => $env('DB_RSI_BYL_PASS'),
        'name' => $env('DB_RSI_BYL_NAME', 'rsi_byl')
    ],

    'rme' => [
        'host' => $env('DB_RME_HOST', '192.168.0.33'),
        'port' => (int) $env('DB_RME_PORT', '3306'),
        'user' => $env('DB_RME_USER', 'admin'),
        'pass' => $env('DB_RME_PASS', ''),
        'name' => $env('DB_RME_NAME', 'rme')
    ],

    'lab' => [
        'host' => $env('LAB_DB_HOST', '192.168.0.33'),
        'port' => (int) $env('LAB_DB_PORT', '3306'),
        'user' => $env('LAB_DB_USER', 'admin'),
        'pass' => $env('LAB_DB_PASS', ''),
        'name' => $env('LAB_DB_NAME', 'rsiklaten')
    ],

    'ijin' => [
        'host' => $env('IJIN_DB_HOST', '192.168.0.33'),
        'port' => (int) $env('IJIN_DB_PORT', '3306'),
        'user' => $env('IJIN_DB_USER', 'admin'),
        'pass' => $env('IJIN_DB_PASS', ''),
        'name' => $env('IJIN_DB_NAME', 'rsiklaten')
    ]
];

const APP_NAME = 'DokterReminder';

const DEFAULT_TEMPLATE = "Assalamualaikum, {{nama_dokter}}.

Mengingatkan bahwa Anda memiliki jadwal praktik:

📅 {{tanggal}}
🏥 {{nama_rs}}
🩺 Poli: {{nama_poli}}
🕐 Jam: {{jam_mulai}} - {{jam_selesai}}
📍 Lokasi: {{lokasi}}

Jumlah Inden Pasien : {{inden}}

Apakah ada perubahan Jadwal atau Pembatasan Kuota dokter?

Terima kasih.
Wassalamualaikum, Wr.Wb";

date_default_timezone_set('Asia/Jakarta');

$protocol = isset($_SERVER['HTTPS']) ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$base_url = $protocol . '://' . $host . dirname($_SERVER['PHP_SELF']);
