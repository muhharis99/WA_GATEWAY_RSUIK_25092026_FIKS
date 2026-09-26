<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/Support/functions.php';

function reportIjinDate(string $value, string $fallback): string
{
    foreach (['d-m-Y', 'Y-m-d'] as $format) {
        $date = DateTime::createFromFormat($format, $value);

        if ($date && $date->format($format) === $value) {
            return $date->format('Y-m-d');
        }
    }

    return $fallback;
}

$rawStart = trim((string) ($_GET['start_date'] ?? date('d-m-Y', strtotime('first day of this month'))));
$rawEnd = trim((string) ($_GET['end_date'] ?? date('d-m-Y')));
$status = trim((string) ($_GET['status'] ?? ''));
$noReg = trim((string) ($_GET['no_reg'] ?? ''));
$noTelp = trim((string) ($_GET['no_telp'] ?? ''));
$poli = trim((string) ($_GET['poli'] ?? ''));
$namaDokter = trim((string) ($_GET['nama_dokter'] ?? ''));

$startDate = reportIjinDate($rawStart, date('Y-m-01'));
$endDate = reportIjinDate($rawEnd, date('Y-m-d'));

if ($startDate > $endDate) {
    [$startDate, $endDate] = [$endDate, $startDate];
}

if (!in_array($status, ['', '1', '2'], true)) {
    $status = '';
}

$rows = [];
$error = '';

try {
    $pdo = get_db('ijin');

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

    $where = implode(' AND ', $conditions);

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
        WHERE {$where}
        ORDER BY b.tgl_kirim_pesan DESC, b.id DESC
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    $error = $e->getMessage();
}

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

$pdfQuery = http_build_query([
    'start_date' => $startDate,
    'end_date' => $endDate,
    'status' => $status,
    'no_reg' => $noReg,
    'no_telp' => $noTelp,
    'poli' => $poli,
    'nama_dokter' => $namaDokter
]);
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laporan Ijin Dokter · <?= e(APP_NAME) ?></title>
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
<a class="nav-link" href="../lab/index.php">LAB</a>
                    <a class="nav-link" href="../ijin/index.php">Ijin WA</a>
                </div>
            </div>
        </div>
    </nav>

<main class="container py-4">
<div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
<div>
<span class="badge text-bg-warning-subtle text-warning-emphasis mb-2">LAPORAN IJIN DOKTER</span>
<h1 class="h3 mb-1">Riwayat Pengiriman Notifikasi Ijin Dokter</h1>
<p class="text-secondary mb-0">
Mengikuti data riwayat asli <code>batal_praktek_detil_wa</code>.
</p>
</div>
<a class="btn btn-success" target="_blank" href="report_pdf.php?<?= e($pdfQuery) ?>">Cetak PDF</a>
</div>

<div class="card shadow-sm border-0 mb-3">
<div class="card-body">
<form method="get" class="row g-3 align-items-end">
<div class="col-md-3">
<label class="form-label">Tanggal Awal</label>
<input type="text" id="startDate" name="start_date" class="form-control" value="<?= e(date('d-m-Y', strtotime($startDate))) ?>" autocomplete="off">
</div>
<div class="col-md-3">
<label class="form-label">Tanggal Akhir</label>
<input type="text" id="endDate" name="end_date" class="form-control" value="<?= e(date('d-m-Y', strtotime($endDate))) ?>" autocomplete="off">
</div>
<div class="col-md-2">
<label class="form-label">Status</label>
<select name="status" class="form-select">
<option value="">Semua Status</option>
<option value="1" <?= $status === '1' ? 'selected' : '' ?>>Terkirim</option>
<option value="2" <?= $status === '2' ? 'selected' : '' ?>>Gagal Kirim</option>
</select>
</div>
<div class="col-md-2">
<label class="form-label">No. RM</label>
<input type="text" name="no_reg" class="form-control" value="<?= e($noReg) ?>">
</div>
<div class="col-md-2">
<label class="form-label">No. HP</label>
<input type="text" name="no_telp" class="form-control" value="<?= e($noTelp) ?>">
</div>
<div class="col-md-3">
<label class="form-label">Poli</label>
<input type="text" name="poli" class="form-control" value="<?= e($poli) ?>">
</div>
<div class="col-md-3">
<label class="form-label">Dokter</label>
<input type="text" name="nama_dokter" class="form-control" value="<?= e($namaDokter) ?>">
</div>
<div class="col-md-2 d-grid">
<button class="btn btn-success" type="submit">Tampilkan</button>
</div>
</form>
</div>
</div>

<?php if ($error !== ''): ?>
<div class="alert alert-danger"><?= e($error) ?></div>
<?php endif; ?>

<div class="row g-3 mb-3">
<div class="col-md-4">
<div class="card shadow-sm border-0 h-100"><div class="card-body">
<div class="text-secondary small">TOTAL</div>
<div class="h3 fw-bold mb-0"><?= $total ?></div>
</div></div>
</div>
<div class="col-md-4">
<div class="card shadow-sm border-0 h-100"><div class="card-body">
<div class="text-secondary small">TERKIRIM</div>
<div class="h3 fw-bold mb-0"><?= $sent ?></div>
</div></div>
</div>
<div class="col-md-4">
<div class="card shadow-sm border-0 h-100"><div class="card-body">
<div class="text-secondary small">GAGAL</div>
<div class="h3 fw-bold mb-0"><?= $failed ?></div>
</div></div>
</div>
</div>

<div class="card shadow-sm border-0">
<div class="card-body">
<div class="table-responsive">
<table id="reportTable" class="table table-striped table-hover align-middle w-100">
<thead>
<tr>
<th>No. RM</th>
<th>No. HP</th>
<th>Nama Pasien</th>
<th>Pesan</th>
<th>Poli</th>
<th>Dokter</th>
<th>Tgl Kirim</th>
<th>Status</th>
</tr>
</thead>
<tbody>
<?php foreach ($rows as $row): ?>
<tr>
<td><?= e((string) $row['no_reg']) ?></td>
<td><?= e((string) $row['no_hp']) ?></td>
<td><?= e((string) $row['nama_pasien']) ?></td>
<td><?= nl2br(e((string) $row['pesan'])) ?></td>
<td><?= e((string) $row['nama_poli']) ?></td>
<td><?= e((string) $row['nama_dokter']) ?></td>
<td data-order="<?= e((string) $row['tgl_kirim_pesan']) ?>">
<?= e((string) $row['tgl_kirim_pesan']) ?>
</td>
<td>
<?php if ((string) $row['status'] === '1'): ?>
<span class="badge text-bg-success">Terkirim</span>
<?php elseif ((string) $row['status'] === '2'): ?>
<span class="badge text-bg-danger">Gagal Kirim</span>
<?php else: ?>
<span class="badge text-bg-secondary">N/A</span>
<?php endif; ?>
</td>
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
        order:[[6,'desc']],
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
