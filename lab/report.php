<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/report_functions.php';

[$startDate, $endDate] = reportDateRange();
$status = trim((string) ($_GET['status'] ?? ''));
$noReg = trim((string) ($_GET['no_reg'] ?? ''));

if (!in_array($status, ['', '1', '2'], true)) {
    $status = '';
}

$pdo = get_db('lab');
$error = '';
$rows = [];

try {
    ensureGatewayReportTables($pdo);

    $sql = "
        SELECT id, no_reg, phone, caption, status, status_message, sent_at
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
    if ((int) $row['status'] === 1) {
        $success++;
    } else {
        $failed++;
    }
}

$pdfQuery = http_build_query([
    'start_date' => $startDate,
    'end_date' => $endDate,
    'status' => $status,
    'no_reg' => $noReg
]);
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report LAB · <?= e(APP_NAME) ?></title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.datatables.net/v/bs5/dt-3.0.2/r-4.0.2/datatables.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" rel="stylesheet">
<link rel="stylesheet" href="../assets/style.css">
</head>
<body class="bg-body-tertiary">
<nav class="navbar navbar-expand-lg bg-white border-bottom sticky-top">
        <div class="container py-2">
            <a class="navbar-brand fw-bold text-success" href="../index.php">Dokter Reminder RSU Islam Klaten</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="mainNavbar">
                <div class="navbar-nav ms-auto">
                    <a class="nav-link" href="../index.php">Dashboard</a>
                    <a class="nav-link" href="../master.php">Master Data</a>
                    <a class="nav-link" href="../settings.php">Template</a>
                    <a class="nav-link active fw-semibold" href="../report.php">Report</a>
                    <a class="nav-link" href="../dokter_ijin.php">Dokter Ijin</a>
                    <a class="nav-link" href="../pindah_jam_praktek.php">Pindah Jam Praktek</a>
                    <a class="nav-link" href="../chat_dokter.php">Chat Dokter</a>
                    <a class="nav-link" href="../lab/index.php">LAB</a>
                    <a class="nav-link" href="../ijin/index.php">Ijin WA</a>
                </div>
            </div>
        </div>
    </nav>

<main class="container py-4">
<div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
<div>
<span class="badge text-bg-success-subtle text-success mb-2">LAPORAN LAB</span>
<h1 class="h3 mb-1">Laporan Pengiriman Hasil Laboratorium</h1>
<p class="text-secondary mb-0">Riwayat pengiriman PDF hasil laboratorium berdasarkan periode.</p>
</div>
<a class="btn btn-success" target="_blank" href="report_pdf.php?<?= e($pdfQuery) ?>">Cetak PDF</a>
</div>

<div class="card shadow-sm border-0 mb-3">
<div class="card-body">
<form method="get" class="row g-3 align-items-end">
<div class="col-md-3">
<label class="form-label" for="startDate">Tanggal Awal</label>
<input type="text" class="form-control" id="startDate" name="start_date" value="<?= e(date('d-m-Y', strtotime($startDate))) ?>" placeholder="DD-MM-YYYY" autocomplete="off">
</div>
<div class="col-md-3">
<label class="form-label" for="endDate">Tanggal Akhir</label>
<input type="text" class="form-control" id="endDate" name="end_date" value="<?= e(date('d-m-Y', strtotime($endDate))) ?>" placeholder="DD-MM-YYYY" autocomplete="off">
</div>
<div class="col-md-2">
<label class="form-label">No. Registrasi</label>
<input type="text" class="form-control" name="no_reg" value="<?= e($noReg) ?>" maxlength="50">
</div>
<div class="col-md-2">
<label class="form-label">Status</label>
<select class="form-select" name="status">
<option value="">Semua Status</option>
<option value="1" <?= $status === '1' ? 'selected' : '' ?>>Terkirim</option>
<option value="2" <?= $status === '2' ? 'selected' : '' ?>>Gagal</option>
</select>
</div>
<div class="col-md-2 d-grid">
<button class="btn btn-success" type="submit">Tampilkan</button>
</div>
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
<thead><tr><th>No</th><th>Tanggal</th><th>No. Reg</th><th>No. WhatsApp</th><th>Caption</th><th>Status</th><th>Keterangan</th></tr></thead>
<tbody>
<?php foreach ($rows as $i => $row): ?>
<tr>
<td><?= $i + 1 ?></td>
<td data-order="<?= e($row['sent_at']) ?>"><?= e(date('d-m-Y H:i:s', strtotime($row['sent_at']))) ?></td>
<td><?= e($row['no_reg']) ?></td>
<td><?= e($row['phone']) ?></td>
<td><?= nl2br(e($row['caption'])) ?></td>
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
