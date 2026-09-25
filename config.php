<?php

declare(strict_types=1);

/**
 * Load .env from the project directory.
 *
 * PHP-FPM/Apache does not automatically read a .env file, so values that
 * exist only in .env must be loaded into the process before getenv() is used.
 * Existing real environment variables always take precedence.
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
            $value = preg_replace('/\s+#.*$/', '', $value);
            $value = trim((string) $value);
        }

        // Do not overwrite a value that was already supplied by the web
        // server / PHP-FPM / process environment.
        if (getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }
}

loadProjectEnv(__DIR__ . '/.env');

$env = static function (string $key, string $fallback = ''): string {
    $value = getenv($key);

    return ($value === false || $value === '')
        ? $fallback
        : $value;
};

$defaultUser = $env('DB_USER', '');
$defaultPass = $env('DB_PASS', '');
$defaultHost = $env('DB_HOST', '127.0.0.1');
$defaultPort = (int) $env('DB_PORT', '3306');

$databases = [
    'local' => [
        'host' => $env('DB_LOCAL_HOST', $defaultHost),
        'port' => (int) $env('DB_LOCAL_PORT', (string) $defaultPort),
        'user' => $env('DB_LOCAL_USER', $defaultUser),
        'pass' => $env('DB_LOCAL_PASS', $defaultPass),
        'name' => $env('DB_LOCAL_NAME', 'dokter_reminder')
    ],

    'rsiklaten' => [
        'host' => $env('DB_RSIKLATEN_HOST', $defaultHost),
        'port' => (int) $env('DB_RSIKLATEN_PORT', (string) $defaultPort),
        'user' => $env('DB_RSIKLATEN_USER', $defaultUser),
        'pass' => $env('DB_RSIKLATEN_PASS', $defaultPass),
        'name' => $env('DB_RSIKLATEN_NAME', 'db_67')
    ],

    'rsi_byl' => [
        'host' => $env('DB_RSI_BYL_HOST', $defaultHost),
        'port' => (int) $env('DB_RSI_BYL_PORT', (string) $defaultPort),
        'user' => $env('DB_RSI_BYL_USER', $defaultUser),
        'pass' => $env('DB_RSI_BYL_PASS', $defaultPass),
        'name' => $env('DB_RSI_BYL_NAME', 'rsi_byl')
    ],

    'rme' => [
        'host' => $env('DB_RME_HOST', $defaultHost),
        'port' => (int) $env('DB_RME_PORT', (string) $defaultPort),
        'user' => $env('DB_RME_USER', $defaultUser),
        'pass' => $env('DB_RME_PASS', $defaultPass),
        'name' => $env('DB_RME_NAME', 'rme')
    ]
];

const APP_NAME = 'WA Gateway RSUIK';

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

/**
 * Fail early with a clear message instead of PDO trying to authenticate
 * with an empty username such as ''@localhost.
 */
foreach ($databases as $name => $database) {
    if (trim((string) $database['user']) === '') {
        throw new RuntimeException(
            "Konfigurasi database '$name' belum memiliki username. " .
            "Buat file .env di folder project atau set DB_USER/DB_{$name}_USER sesuai kebutuhan."
        );
    }
}
