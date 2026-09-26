<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$ajaxCompleted = false;

register_shutdown_function(static function () use (&$ajaxCompleted): void {
    if ($ajaxCompleted) {
        return;
    }

    $error = error_get_last();

    if (!$error) {
        return;
    }

    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];

    if (!in_array((int) $error['type'], $fatalTypes, true)) {
        return;
    }

    http_response_code(500);
    echo json_encode([
        'draw' => isset($_POST['draw']) ? (int) $_POST['draw'] : 1,
        'recordsTotal' => 0,
        'recordsFiltered' => 0,
        'data' => [],
        'error' => 'PHP Fatal Error',
        'detail' => (string) ($error['message'] ?? 'Unknown fatal error'),
        'file' => (string) ($error['file'] ?? ''),
        'line' => (int) ($error['line'] ?? 0)
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
});

require_once dirname(__DIR__) . '/functions.php';

$draw = isset($_POST['draw']) ? (int) $_POST['draw'] : 1;
$start = max(0, isset($_POST['start']) ? (int) $_POST['start'] : 0);
$length = isset($_POST['length']) ? (int) $_POST['length'] : 25;

if ($length < 1) {
    $length = 25;
}

if ($length > 100) {
    $length = 100;
}

try {
    // Sama dengan source IJIN: database rsiklaten dan tabel batal_praktek_detil_wa.
    $pdo = get_db('ijin');

    $noReg = trim((string) ($_POST['no_reg'] ?? ''));
    $noTelp = trim((string) ($_POST['no_telp'] ?? ''));
    $poli = trim((string) ($_POST['poli'] ?? ''));
    $namaDokter = trim((string) ($_POST['nama_dokter'] ?? ''));
    $tglKirim = trim((string) ($_POST['tgl_kirim'] ?? ''));
    $status = trim((string) ($_POST['status'] ?? ''));

    $conditions = [];
    $params = [];

    if ($noReg !== '') {
        $conditions[] = 'b.no_reg LIKE ?';
        $params[] = '%' . $noReg . '%';
    }

    if ($noTelp !== '') {
        $conditions[] = 'b.no_hp LIKE ?';
        $params[] = '%' . $noTelp . '%';
    }

    if ($poli !== '') {
        $conditions[] = 'b.nama_poli LIKE ?';
        $params[] = '%' . $poli . '%';
    }

    if ($namaDokter !== '') {
        $conditions[] = 'b.nama_dokter LIKE ?';
        $params[] = '%' . $namaDokter . '%';
    }

    if ($tglKirim !== '') {
        $date = DateTime::createFromFormat('Y-m-d', $tglKirim);

        if (!$date || $date->format('Y-m-d') !== $tglKirim) {
            $date = DateTime::createFromFormat('d-m-Y', $tglKirim);
        }

        if ($date) {
            $normalizedDate = $date->format('Y-m-d');
            $conditions[] = 'b.tgl_kirim_pesan >= ? AND b.tgl_kirim_pesan < DATE_ADD(?, INTERVAL 1 DAY)';
            $params[] = $normalizedDate . ' 00:00:00';
            $params[] = $normalizedDate . ' 00:00:00';
        }
    }

    if ($status !== '') {
        $conditions[] = 'b.status = ?';
        $params[] = $status;
    }

    $where = $conditions ? ' WHERE ' . implode(' AND ', $conditions) : '';

    // Pola source IJIN: total + filtered + paginated rows.
    $recordsTotal = (int) $pdo
        ->query('SELECT COUNT(*) FROM batal_praktek_detil_wa')
        ->fetchColumn();

    if ($where === '') {
        $recordsFiltered = $recordsTotal;
    } else {
        $filterStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM batal_praktek_detil_wa b{$where}"
        );
        $filterStmt->execute($params);
        $recordsFiltered = (int) $filterStmt->fetchColumn();
    }

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
        {$where}
        ORDER BY b.id DESC
        LIMIT {$start}, {$length}
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $rows = [];

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $statusValue = (string) ($row['status'] ?? '');

        if ($statusValue === '1') {
            $badge = "<span class='badge-status sent'><i class='bi bi-check-circle-fill'></i> Terkirim</span>";
        } elseif ($statusValue === '2') {
            $badge = "<span class='badge-status failed'><i class='bi bi-x-circle-fill'></i> Gagal</span>";
        } else {
            $badge = "<span class='badge-status unknown'><i class='bi bi-dash-circle'></i> N/A</span>";
        }

        $rows[] = [
            "<span style='font-size:.8rem;font-weight:600;'>" . htmlspecialchars((string) ($row['no_reg'] ?? ''), ENT_QUOTES, 'UTF-8') . "</span>",
            htmlspecialchars((string) ($row['no_hp'] ?? ''), ENT_QUOTES, 'UTF-8'),
            "<span style='font-weight:500;'>" . htmlspecialchars((string) ($row['nama_pasien'] ?? ''), ENT_QUOTES, 'UTF-8') . "</span>",
            "<span style='font-size:.8rem;color:#555;'>" . nl2br(htmlspecialchars((string) ($row['pesan'] ?? ''), ENT_QUOTES, 'UTF-8')) . "</span>",
            "<span style='background:#e8f5f0;color:#0d6e4f;padding:.2rem .6rem;border-radius:20px;font-size:.75rem;font-weight:600;white-space:nowrap;'>" . htmlspecialchars((string) ($row['nama_poli'] ?? ''), ENT_QUOTES, 'UTF-8') . "</span>",
            "<span style='font-size:.85rem;'>" . htmlspecialchars((string) ($row['nama_dokter'] ?? ''), ENT_QUOTES, 'UTF-8') . "</span>",
            "<span style='font-size:.82rem;white-space:nowrap;'>" . htmlspecialchars((string) ($row['tgl_kirim_pesan'] ?? ''), ENT_QUOTES, 'UTF-8') . "</span>",
            $badge
        ];
    }

    $ajaxCompleted = true;

    echo json_encode([
        'draw' => $draw,
        'recordsTotal' => $recordsTotal,
        'recordsFiltered' => $recordsFiltered,
        'data' => $rows
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    error_log('IJIN ajax_riwayat error: ' . $e->getMessage());

    http_response_code(500);

    $ajaxCompleted = true;

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
