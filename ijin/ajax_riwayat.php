<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require_once dirname(__DIR__) . '/app/Config/config.php';

$draw = isset($_POST['draw']) ? (int) $_POST['draw'] : 1;
$start = max(0, isset($_POST['start']) ? (int) $_POST['start'] : 0);
$length = isset($_POST['length']) ? (int) $_POST['length'] : 25;

if ($length > 100) {
    $length = 100;
}

$db = $GLOBALS['databases']['ijin'] ?? null;

if (!is_array($db)) {
    http_response_code(500);
    echo json_encode([
        'draw' => $draw,
        'recordsTotal' => 0,
        'recordsFiltered' => 0,
        'data' => [],
        'error' => 'Konfigurasi database IJIN tidak tersedia.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$hostname = (string) ($db['host'] ?? '192.168.0.33');
$username = (string) ($db['user'] ?? '');
$password = (string) ($db['pass'] ?? '');
$database = (string) ($db['name'] ?? 'rsiklaten');
$port = (int) ($db['port'] ?? 3306);

$koneksi = mysqli_init();
mysqli_options($koneksi, MYSQLI_OPT_CONNECT_TIMEOUT, 5);

if (!@mysqli_real_connect($koneksi, $hostname, $username, $password, $database, $port)) {
    http_response_code(500);
    echo json_encode([
        'draw' => $draw,
        'recordsTotal' => 0,
        'recordsFiltered' => 0,
        'data' => [],
        'error' => 'Koneksi database IJIN gagal.',
        'detail' => mysqli_connect_error()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

mysqli_set_charset($koneksi, 'utf8mb4');

$noReg      = trim((string) ($_POST['no_reg'] ?? ''));
$noTelp     = trim((string) ($_POST['no_telp'] ?? ''));
$poli       = trim((string) ($_POST['poli'] ?? ''));
$namaDokter = trim((string) ($_POST['nama_dokter'] ?? ''));
$tglKirim   = trim((string) ($_POST['tgl_kirim'] ?? ''));
$status     = trim((string) ($_POST['status'] ?? ''));

$conditions = [];
$bindTypes = '';
$bindValues = [];

if ($noReg !== '') {
    $conditions[] = 'b.no_reg LIKE ?';
    $bindTypes .= 's';
    $bindValues[] = '%' . $noReg . '%';
}

if ($noTelp !== '') {
    $conditions[] = 'b.no_hp LIKE ?';
    $bindTypes .= 's';
    $bindValues[] = '%' . $noTelp . '%';
}

if ($poli !== '') {
    $conditions[] = 'b.nama_poli LIKE ?';
    $bindTypes .= 's';
    $bindValues[] = '%' . $poli . '%';
}

if ($namaDokter !== '') {
    $conditions[] = 'b.nama_dokter LIKE ?';
    $bindTypes .= 's';
    $bindValues[] = '%' . $namaDokter . '%';
}

if ($tglKirim !== '') {
    $date = DateTime::createFromFormat('Y-m-d', $tglKirim);

    if (!$date || $date->format('Y-m-d') !== $tglKirim) {
        $date = DateTime::createFromFormat('d-m-Y', $tglKirim);
    }

    if ($date) {
        $normalized = $date->format('Y-m-d');
        $conditions[] = 'b.tgl_kirim_pesan >= ? AND b.tgl_kirim_pesan < DATE_ADD(?, INTERVAL 1 DAY)';
        $bindTypes .= 'ss';
        $bindValues[] = $normalized . ' 00:00:00';
        $bindValues[] = $normalized . ' 00:00:00';
    }
}

if ($status !== '') {
    $conditions[] = 'b.status = ?';
    $bindTypes .= 's';
    $bindValues[] = $status;
}

$whereSQL = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

try {
    // Mengikuti strategi source IJIN agar tetap ringan untuk tabel besar.
    $cacheKey = 'total_batal_wa_' . $database;
    $totalAll = 0;

    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $cacheTTL = 300;

    if (
        !isset($_SESSION[$cacheKey]) ||
        (time() - (int) ($_SESSION[$cacheKey . '_ts'] ?? 0)) > $cacheTTL
    ) {
        $metaSql = "
            SELECT TABLE_ROWS
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = 'batal_praktek_detil_wa'
            LIMIT 1
        ";

        $metaStmt = mysqli_prepare($koneksi, $metaSql);

        if ($metaStmt) {
            mysqli_stmt_bind_param($metaStmt, 's', $database);
            mysqli_stmt_execute($metaStmt);
            $metaResult = mysqli_stmt_get_result($metaStmt);
            $approx = (int) (mysqli_fetch_row($metaResult)[0] ?? 0);
            mysqli_stmt_close($metaStmt);
        } else {
            $approx = 0;
        }

        if ($approx === 0) {
            $totalResult = mysqli_query($koneksi, 'SELECT COUNT(*) FROM batal_praktek_detil_wa');
            $approx = (int) (mysqli_fetch_row($totalResult)[0] ?? 0);
        }

        $_SESSION[$cacheKey] = $approx;
        $_SESSION[$cacheKey . '_ts'] = time();
    }

    $totalAll = (int) $_SESSION[$cacheKey];

    $sql = "
        SELECT
            b.no_reg,
            b.no_hp,
            b.nama_pasien,
            b.pesan,
            b.nama_poli,
            b.nama_dokter,
            b.tgl_kirim_pesan,
            b.status
        FROM batal_praktek_detil_wa b
        {$whereSQL}
        ORDER BY b.id DESC
        LIMIT ?, ?
    ";

    $stmt = mysqli_prepare($koneksi, $sql);

    if (!$stmt) {
        throw new RuntimeException(mysqli_error($koneksi));
    }

    $bindTypes .= 'ii';
    $bindValues[] = $start;
    $bindValues[] = $length;

    mysqli_stmt_bind_param($stmt, $bindTypes, ...$bindValues);

    if (!mysqli_stmt_execute($stmt)) {
        throw new RuntimeException(mysqli_stmt_error($stmt));
    }

    $dataResult = mysqli_stmt_get_result($stmt);

    $countResult = null;

    if ($whereSQL === '') {
        $totalFilter = $totalAll;
    } else {
        $countSql = "
            SELECT COUNT(*)
            FROM batal_praktek_detil_wa b
            {$whereSQL}
        ";

        $countStmt = mysqli_prepare($koneksi, $countSql);

        if (!$countStmt) {
            throw new RuntimeException(mysqli_error($koneksi));
        }

        if ($bindTypes !== 'ii') {
            $countTypes = substr($bindTypes, 0, -2);
            $countValues = array_slice($bindValues, 0, -2);

            if ($countTypes !== '') {
                mysqli_stmt_bind_param($countStmt, $countTypes, ...$countValues);
            }
        }

        if (!mysqli_stmt_execute($countStmt)) {
            throw new RuntimeException(mysqli_stmt_error($countStmt));
        }

        $countResult = mysqli_stmt_get_result($countStmt);
        $totalFilter = (int) (mysqli_fetch_row($countResult)[0] ?? 0);
        mysqli_stmt_close($countStmt);
    }

    $rows = [];

    while ($row = mysqli_fetch_assoc($dataResult)) {
        $statusValue = (string) ($row['status'] ?? '');

        if ($statusValue === '1') {
            $badge = "<span class='badge-status sent'><i class='bi bi-check-circle-fill'></i> Terkirim</span>";
        } elseif ($statusValue === '2') {
            $badge = "<span class='badge-status failed'><i class='bi bi-x-circle-fill'></i> Gagal</span>";
        } else {
            $badge = "<span class='badge-status unknown'><i class='bi bi-dash-circle'></i> N/A</span>";
        }

        $rows[] = [
            "<span style='font-size:.8rem;font-weight:600;'>" . htmlspecialchars((string) $row['no_reg'], ENT_QUOTES, 'UTF-8') . "</span>",
            htmlspecialchars((string) $row['no_hp'], ENT_QUOTES, 'UTF-8'),
            "<span style='font-weight:500;'>" . htmlspecialchars((string) $row['nama_pasien'], ENT_QUOTES, 'UTF-8') . "</span>",
            "<span style='font-size:.8rem;color:#555;'>" . nl2br(htmlspecialchars((string) $row['pesan'], ENT_QUOTES, 'UTF-8')) . "</span>",
            "<span style='background:#e8f5f0;color:#0d6e4f;padding:.2rem .6rem;border-radius:20px;font-size:.75rem;font-weight:600;white-space:nowrap;'>" . htmlspecialchars((string) $row['nama_poli'], ENT_QUOTES, 'UTF-8') . "</span>",
            "<span style='font-size:.85rem;'>" . htmlspecialchars((string) $row['nama_dokter'], ENT_QUOTES, 'UTF-8') . "</span>",
            "<span style='font-size:.82rem;white-space:nowrap;'>" . htmlspecialchars((string) $row['tgl_kirim_pesan'], ENT_QUOTES, 'UTF-8') . "</span>",
            $badge
        ];
    }

    mysqli_stmt_close($stmt);
    mysqli_close($koneksi);

    echo json_encode([
        'draw' => $draw,
        'recordsTotal' => $totalAll,
        'recordsFiltered' => $totalFilter,
        'data' => $rows
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    if ($koneksi instanceof mysqli) {
        @mysqli_close($koneksi);
    }

    http_response_code(500);

    echo json_encode([
        'draw' => $draw,
        'recordsTotal' => 0,
        'recordsFiltered' => 0,
        'data' => [],
        'error' => get_class($e),
        'detail' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
