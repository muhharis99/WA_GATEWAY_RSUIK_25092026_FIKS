<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/report_functions.php';

[$startDate, $endDate] = reportDateRange();
$status = trim((string) ($_GET['status'] ?? ''));

if (!in_array($status, ['', '1', '2'], true)) {
    $status = '';
}

$pdo = get_db('rsiklaten');
$error = '';
$rows = [];

try {
    ensureGatewayReportTables($pdo);

    $sql = "
        SELECT id, phone, message, status, status_message, sent_at
        FROM wa_gateway_ijin_logs
        WHERE sent_at >= ?
          AND sent_at < DATE_ADD(?, INTERVAL 1 DAY)
    ";
    $params = [$startDate . ' 00:00:00', $endDate . ' 00:00:00'];

    if ($status !== '') {
        $sql .= " AND status = ?";
        $params[] = (int) $status;
    }

    $sql .= " ORDER BY sent_at DESC, id DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
} catch (Throwable $e) {
    $error = $e->getMessage();
}

$total = count($rows);
$success = 0;
$failed = 0;
foreach ($rows as $row) {
    if ((int) $row['status'] === 1) $success++;
    else $failed++;
}

$pdfQuery = http_build_query([
    'start_date' => $startDate,
    'end_date' => $endDate,
    'status' => $status
]);
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report Ijin · <?= e(APP_NAME) ?></title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.datatables.net/v/bs5/dt-3.0.2/r-4.0.2/datatables.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" rel="stylesheet">
<link rel="stylesheet" href="../assets/style.css">
</head>
<body class="bg-body-tertiary">
<nav class="navbar navbar-expand-lg bg-white border-bottom sticky-top">
<div class="container py-2">
<a class="navbar-brand fw-bold text-success" href="../index.php"><?= e(APP_NAME) ?></a>
<div class="navbar-nav ms-auto">
<a class="nav-link" href="../index.php">Dashboard</a>
<a class="nav-link" href="../lab/index.php">LAB</a>
<a class="nav-link" href="index.php">Ijin WA</a>
<a class="nav-link" href="../chat_dokter.php">Chat Dokter</a>
<a class="nav-link" href="../master.php">Master Data</a>
<a class="nav-link" href="../settings.php">Template</a>
<a class="nav-link active fw-semibold" href="report.php">Laporan Ijin</a>
<a class="nav-link" href="../report.php">Laporan Reminder</a>
</div>
</div>
</nav>

<main class="container py-4">
<div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
<div>
<span class="badge text-bg-warning-subtle text-warning-emphasis mb-2">LAPORAN IJIN</span>
<h1 class="h3 mb-1">Laporan Pengiriman Ijin / Perubahan Praktik</h1>
<p class="text-secondary mb-0">Riwayat notifikasi dokter yang dikirim melalui gateway Ijin.</p>
</div>
<a class="btn btn-success" target="_blank" href="report_pdf.php?<?= e($pdfQuery) ?>">Cetak PDF</a>
</div>

<div class="card shadow-sm border-0 mb-3">
<div class="card-body">
<form method="get" class="row g-3 align-items-end">
<div class="col-md-4">
<label class="form-label" for="startDate">Tanggal Awal</label>
<input type="text" class="form-control" id="startDate" name="start_date" value="<?= e(date('d-m-Y', strtotime($startDate))) ?>" placeholder="DD-MM-YYYY" autocomplete="off">
</div>
<div class="col-md-4">
<label class="form-label" for="endDate">Tanggal Akhir</label>
<input type="text" class="form-control" id="endDate" name="end_date" value="<?= e(date('d-m-Y', strtotime($endDate))) ?>" placeholder="DD-MM-YYYY" autocomplete="off">
</div>
<div class="col-md-2">
<label class="form-label">Status</label>
<select class="form-select" name="status">
<option value="">Semua Status</option>
<option value="1" <?= $status === '1' ? 'selected' : '' ?>>Terkirim</option>
<option value="2" <?= $status === '2' ? 'selected' : '' ?>>Gagal</option>
</select>
</div>
<div class="col-md-2 d-grid"><button class="btn btn-success" type="submit">Tampilkan</button></div>
</form>
</div>
</div>

<?php if ($error): ?><div class="alert alert-danger"><?= e($error) ?></div><?php endif; ?>

<div class="row g-3 mb-3">
<div class="col-md-4"><div class="card shadow-sm border-0"><div class="card-body"><div class="text-secondary small">TOTAL</div><div class="h3 fw-bold mb-0"><?= $total ?></div></div></div></div>
<div class="col-md-4"><div class="card shadow-sm border-0"><div class="card-body"><div class="text-secondary small">TERKIRIM</div><div class="h3 fw-bold mb-0"><?= $success ?></div></div></div></div>
<div class="col-md-4"><div class="card shadow-sm border-0"><div class="card-body"><div class="text-secondary small">GAGAL</div><div class="h3 fw-bold mb-0"><?= $failed ?></div></div></div></div>
</div>

<div class="card shadow-sm border-0">
<div class="card-body">
<div class="table-responsive">
<table id="reportTable" class="table table-striped table-hover align-middle w-100">
<thead><tr><th>No</th><th>Tanggal</th><th>No. WhatsApp</th><th>Pesan</th><th>Status</th><th>Keterangan</th></tr></thead>
<tbody>
<?php foreach ($rows as $i => $row): ?>
<tr>
<td><?= $i + 1 ?></td>
<td data-order="<?= e($row['sent_at']) ?>"><?= e(date('d-m-Y H:i:s', strtotime($row['sent_at']))) ?></td>
<td><?= e($row['phone']) ?></td>
<td><?= nl2br(e($row['message'])) ?></td>
<td><span class="badge <?= (int) $row['status'] === 1 ? 'text-bg-success' : 'text-bg-danger' ?>"><?= (int) $row['status'] === 1 ? 'TERKIRIM' : 'GAGAL' ?></span></td>
<td><?= e($row['status_message']) ?></td>
</tr>
<?php endforeach; ?>
</tbody>
</table>
</div>
</div>
</div>
</main>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.datatables.net/v/bs5/dt-3.0.2/r-4.0.2/datatables.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/id.js"></script>
<script src="../assets/back-to-top.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function () {
    flatpickr('#startDate', {dateFormat:'d-m-Y',locale:'id',disableMobile:true});
    flatpickr('#endDate', {dateFormat:'d-m-Y',locale:'id',disableMobile:true});
    new DataTable('#reportTable', {
        responsive:true,
        pageLength:25,
        order:[[1,'desc']],
        language:{
            search:'Cari:',
            lengthMenu:'Tampilkan _MENU_ data',
            info:'Menampilkan _START_ sampai _END_ dari _TOTAL_ data',
            infoEmpty:'Tidak ada data',
            zeroRecords:'Data tidak ditemukan',
            emptyTable:'Belum ada data',
            paginate:{first:'Awal',last:'Akhir',next:'Berikutnya',previous:'Sebelumnya'}
        }
    });
});
</script>
</body>
</html>
