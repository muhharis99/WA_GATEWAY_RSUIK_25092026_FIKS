<?php

declare(strict_types=1);

ini_set('memory_limit', '256M');
require_once dirname(__DIR__) . '/report_functions.php';

$autoload = dirname(__DIR__) . '/vendor/autoload.php';
if (!is_file($autoload)) {
    http_response_code(500);
    exit('mPDF belum terpasang. Jalankan: composer install');
}
require_once $autoload;

try {
    [$startDate, $endDate] = reportDateRange();
    $status = trim((string) ($_GET['status'] ?? ''));
    $noReg = trim((string) ($_GET['no_reg'] ?? ''));

    if (!in_array($status, ['', '1', '2'], true)) {
        $status = '';
    }

    $pdo = get_db('lab');
    ensureGatewayReportTables($pdo);

    $sql = "
        SELECT no_reg, phone, caption, status, status_message, sent_at
        FROM wa_gateway_lab_logs
        WHERE sent_at >= ?
          AND sent_at < DATE_ADD(?, INTERVAL 1 DAY)
    ";
    $params = [$startDate . ' 00:00:00', $endDate . ' 00:00:00'];

    if ($status !== '') {
        $sql .= " AND status = ?";
        $params[] = (int) $status;
    }
    if ($noReg !== '') {
        $sql .= " AND no_reg LIKE ?";
        $params[] = '%' . $noReg . '%';
    }

    $sql .= " ORDER BY sent_at ASC, id ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $total = count($rows);
    $success = 0;
    $failed = 0;
    foreach ($rows as $row) {
        if ((int) $row['status'] === 1) $success++;
        else $failed++;
    }

    $hospitalName = setting('nama_rs', 'RSU ISLAM KLATEN');
    $tempDir = sys_get_temp_dir() . '/dokter-reminder-mpdf';
    if (!is_dir($tempDir)) {
        mkdir($tempDir, 0777, true);
    }

    $mpdf = new \Mpdf\Mpdf([
        'format' => 'A4-L',
        'margin_left' => 10,
        'margin_right' => 10,
        'margin_top' => 14,
        'margin_bottom' => 14,
        'tempDir' => $tempDir,
        'simpleTables' => true,
        'packTableData' => true
    ]);

    $mpdf->SetTitle('Laporan Pengiriman LAB');
    $mpdf->SetAuthor($hospitalName);
    $mpdf->SetFooter('{PAGENO} / {nbpg}');

    $statusLabel = $status === '' ? 'Semua Status' : ($status === '1' ? 'Terkirim' : 'Gagal');

    $html = '<style>
        body{font-family:sans-serif;font-size:10pt;color:#1f2937}
        .header{text-align:center;margin-bottom:14px}
        .header h1{margin:0 0 4px;font-size:16pt}
        .header p{margin:2px 0;color:#4b5563}
        table{width:100%;border-collapse:collapse}
        .summary{margin:10px 0 14px}
        .summary td{width:33.33%;border:1px solid #d1d5db;padding:7px 9px;text-align:center}
        .summary .label{font-size:8pt;color:#6b7280}
        .summary .value{margin-top:3px;font-size:15pt;font-weight:bold}
        .data th{background:#0d6e4f;color:#fff;border:1px solid #0d6e4f;padding:6px;font-size:8.5pt}
        .data td{border:1px solid #d1d5db;padding:5px 6px;font-size:8pt;vertical-align:top}
        .center{text-align:center}
    </style>
    <div class="header">
      <h1>LAPORAN PENGIRIMAN HASIL LABORATORIUM</h1>
      <p>' . e($hospitalName) . '</p>
      <p>Periode ' . e(date('d-m-Y', strtotime($startDate))) . ' s/d ' . e(date('d-m-Y', strtotime($endDate))) . ' | Status: ' . e($statusLabel) . '</p>
      <p>No. Reg: ' . e($noReg === '' ? 'Semua' : $noReg) . '</p>
    </div>
    <table class="summary"><tr>
      <td><div class="label">TOTAL</div><div class="value">' . $total . '</div></td>
      <td><div class="label">TERKIRIM</div><div class="value">' . $success . '</div></td>
      <td><div class="label">GAGAL</div><div class="value">' . $failed . '</div></td>
    </tr></table>
    <table class="data"><thead><tr>
      <th width="4%">No</th><th width="16%">Tanggal</th><th width="10%">No. Reg</th><th width="12%">No. WhatsApp</th><th width="32%">Caption</th><th width="10%">Status</th><th width="16%">Keterangan</th>
    </tr></thead><tbody>';

    if (!$rows) {
        $html .= '<tr><td colspan="7" class="center">Tidak ada data.</td></tr>';
    } else {
        foreach ($rows as $i => $row) {
            $html .= '<tr>
                <td class="center">' . ($i + 1) . '</td>
                <td>' . e(date('d-m-Y H:i:s', strtotime($row['sent_at']))) . '</td>
                <td>' . e($row['no_reg']) . '</td>
                <td>' . e($row['phone']) . '</td>
                <td>' . nl2br(e($row['caption'])) . '</td>
                <td class="center">' . ((int) $row['status'] === 1 ? 'TERKIRIM' : 'GAGAL') . '</td>
                <td>' . e($row['status_message']) . '</td>
            </tr>';
        }
    }

    $html .= '</tbody></table>';
    $mpdf->WriteHTML($html);
    $mpdf->Output('laporan-lab-' . $startDate . '-sampai-' . $endDate . '.pdf', 'I');
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo '<div style="font-family:Arial;padding:30px"><h2 style="color:#b91c1c">Laporan LAB gagal dibuat</h2><pre>' .
        htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') . '</pre></div>';
}
