<?php

declare(strict_types=1);

ini_set('memory_limit', '256M');

require_once dirname(__DIR__) . '/app/Support/functions.php';

$autoload = dirname(__DIR__) . '/vendor/autoload.php';

if (!is_file($autoload)) {
    http_response_code(500);
    exit('Dependensi PHP belum terpasang. Jalankan `composer install` dari root project terlebih dahulu.');
}

require_once $autoload;

function pdfDate(string $value, string $fallback): string
{
    foreach (['Y-m-d', 'd-m-Y'] as $format) {
        $date = DateTime::createFromFormat($format, $value);
        if ($date && $date->format($format) === $value) {
            return $date->format('Y-m-d');
        }
    }

    return $fallback;
}

try {
    $startDate = pdfDate(trim((string) ($_GET['start_date'] ?? '')), date('Y-m-01'));
    $endDate = pdfDate(trim((string) ($_GET['end_date'] ?? '')), date('Y-m-d'));

    if ($startDate > $endDate) {
        [$startDate, $endDate] = [$endDate, $startDate];
    }

    $status = trim((string) ($_GET['status'] ?? ''));
    $noReg = trim((string) ($_GET['no_reg'] ?? ''));
    $noTelp = trim((string) ($_GET['no_telp'] ?? ''));
    $poli = trim((string) ($_GET['poli'] ?? ''));
    $namaDokter = trim((string) ($_GET['nama_dokter'] ?? ''));

    if (!in_array($status, ['', '1', '2'], true)) {
        $status = '';
    }

    $conditions = [
        'b.tgl_kirim_pesan >= ?',
        'b.tgl_kirim_pesan < DATE_ADD(?, INTERVAL 1 DAY)'
    ];
    $params = [
        $startDate . ' 00:00:00',
        $endDate . ' 00:00:00'
    ];

    if ($status !== '') {
        $conditions[] = 'b.status = ?';
        $params[] = $status;
    }

    foreach ([
        ['b.no_reg', $noReg],
        ['b.no_hp', $noTelp],
        ['b.nama_poli', $poli],
        ['b.nama_dokter', $namaDokter]
    ] as [$column, $value]) {
        if ($value !== '') {
            $conditions[] = "{$column} LIKE ?";
            $params[] = '%' . $value . '%';
        }
    }

    $pdo = get_db('ijin');

    $stmt = $pdo->prepare("
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
        WHERE " . implode(' AND ', $conditions) . "
        ORDER BY b.tgl_kirim_pesan ASC, b.id ASC
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $total = count($rows);
    $sent = 0;
    $failed = 0;

    foreach ($rows as $row) {
        if ((string) $row['status'] === '1') {
            $sent++;
        } elseif ((string) $row['status'] === '2') {
            $failed++;
        }
    }

    $hospitalName = 'RSU ISLAM KLATEN';
    $tempDir = sys_get_temp_dir() . '/dokter-reminder-mpdf';

    if (!is_dir($tempDir)) {
        mkdir($tempDir, 0777, true);
    }

    $mpdf = new \Mpdf\Mpdf([
        'format' => 'A4-L',
        'margin_left' => 8,
        'margin_right' => 8,
        'margin_top' => 12,
        'margin_bottom' => 12,
        'tempDir' => $tempDir,
        'simpleTables' => true,
        'packTableData' => true
    ]);

    $mpdf->SetTitle('Laporan Ijin Dokter RSU Islam Klaten');
    $mpdf->SetAuthor($hospitalName);
    $mpdf->SetFooter('{PAGENO} / {nbpg}');

    $html = '<style>
        body{font-family:sans-serif;font-size:9pt;color:#1f2937}
        .header{text-align:center;margin-bottom:10px}
        .header h1{margin:0 0 3px;font-size:15pt}
        .header p{margin:2px 0;color:#4b5563}
        table{width:100%;border-collapse:collapse}
        .summary{margin:8px 0 12px}
        .summary td{width:33.33%;border:1px solid #d1d5db;padding:6px;text-align:center}
        .summary .label{font-size:7.5pt;color:#6b7280}
        .summary .value{font-size:14pt;font-weight:bold}
        .data th{background:#0d6e4f;color:#fff;border:1px solid #0d6e4f;padding:5px;font-size:7.5pt}
        .data td{border:1px solid #d1d5db;padding:4px 5px;font-size:7.5pt;vertical-align:top}
        .center{text-align:center}
    </style>
    <div class="header">
      <h1>LAPORAN PENGIRIMAN IJIN DOKTER / PERUBAHAN PRAKTIK</h1>
      <p>' . e($hospitalName) . '</p>
      <p>Periode ' . e(date('d-m-Y', strtotime($startDate))) . ' s/d ' . e(date('d-m-Y', strtotime($endDate))) . '</p>
    </div>
    <table class="summary"><tr>
      <td><div class="label">TOTAL</div><div class="value">' . $total . '</div></td>
      <td><div class="label">TERKIRIM</div><div class="value">' . $sent . '</div></td>
      <td><div class="label">GAGAL</div><div class="value">' . $failed . '</div></td>
    </tr></table>
    <table class="data">
      <thead><tr>
        <th width="8%">No. RM</th>
        <th width="10%">No. HP</th>
        <th width="15%">Nama Pasien</th>
        <th width="28%">Pesan</th>
        <th width="11%">Poli</th>
        <th width="14%">Dokter</th>
        <th width="9%">Tgl Kirim</th>
        <th width="5%">Status</th>
      </tr></thead>
      <tbody>';

    if (!$rows) {
        $html .= '<tr><td colspan="8" class="center">Tidak ada data.</td></tr>';
    } else {
        foreach ($rows as $row) {
            $statusLabel = (string) $row['status'] === '1'
                ? 'Terkirim'
                : ((string) $row['status'] === '2' ? 'Gagal' : 'N/A');

            $html .= '<tr>
                <td>' . e((string) $row['no_reg']) . '</td>
                <td>' . e((string) $row['no_hp']) . '</td>
                <td>' . e((string) $row['nama_pasien']) . '</td>
                <td>' . nl2br(e((string) $row['pesan'])) . '</td>
                <td>' . e((string) $row['nama_poli']) . '</td>
                <td>' . e((string) $row['nama_dokter']) . '</td>
                <td>' . e((string) $row['tgl_kirim_pesan']) . '</td>
                <td class="center">' . e($statusLabel) . '</td>
            </tr>';
        }
    }

    $html .= '</tbody></table>';

    $mpdf->WriteHTML($html);
    $mpdf->Output(
        'laporan-ijin-' . $startDate . '-sampai-' . $endDate . '.pdf',
        'I'
    );
    exit;
} catch (Throwable $e) {
    http_response_code(500);

    echo '<div style="font-family:Arial;padding:30px">';
    echo '<h2 style="color:#b91c1c">Laporan Ijin gagal dibuat</h2>';
    echo '<pre>' . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') . '</pre>';
    echo '</div>';
}
