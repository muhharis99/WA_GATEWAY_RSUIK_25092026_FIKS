<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/functions.php';

$dbError = '';
$data = [];
$allNumbers = [];

try {
    $pdo = get_db('ijin');

    $statement = $pdo->query("
        SELECT no_hp, pesan
        FROM batal_praktek_detil_wa
        WHERE (status IS NULL OR status = '')
          AND no_hp IS NOT NULL
          AND no_hp != ''
        ORDER BY id ASC
        LIMIT 5000
    ");

    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $hp = trim((string) ($row['no_hp'] ?? ''));

        if ($hp === '') {
            continue;
        }

        $data[(string) ($row['pesan'] ?? '')][] = $hp;
        $allNumbers[$hp] = true;
    }
} catch (Throwable $e) {
    $dbError = $e->getMessage();
}

$allNumbers = array_keys($allNumbers);
$totalPenerima = count($allNumbers);

$pesanLines = '';
$indexPesan = 1;

foreach ($data as $pesan => $nums) {
    $p = $pesan;
    $p = str_replace("Assalamu'alaikum. ", '', $p);
    $p = str_replace("Mohon ma'af atas ketidaknyamanannya. Mks (RSI KLATEN)", '', $p);
    $p = str_replace("Mohon maaf atas ketidaknyamanannya. Mks (RSI KLATEN)", '', $p);
    $p = str_replace("Kami beritahukan bahwa praktek ", '', $p);
    $p = str_replace("Kami beritahukan bahwa ", '', $p);
    $pesanLines .= $indexPesan . ". " . trim($p) . "\n\n";
    $indexPesan++;
}

$pesanFull =
    "📢 *Pengumuman RSU Islam Klaten*\n\n" .
    "Assalâmu'alaikum wr wb\n\n" .
    "#SahabatSehatRSIKlaten Kami beritahukan perubahan jam praktik sebagai berikut :\n\n" .
    $pesanLines .
    "Mohon ma'af atas ketidaknyamanannya. Terimakasih 😊🙏🏻\n\n" .
    "Wassalamu'alaikum wr wb\n\n" .
    "*RSU Islam Klaten*\n" .
    "_Ramah, Amanah, Profesional, Islami_ (RAPI)";

function h2($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Ijin Dokter · <?= h2(APP_NAME) ?></title>

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
                    <a class="nav-link" href="../report.php">Report</a>
                    <a class="nav-link" href="../dokter_ijin.php">Dokter Ijin</a>
                    <a class="nav-link" href="../pindah_jam_praktek.php">Pindah Jam Praktek</a>
                    <a class="nav-link" href="../chat_dokter.php">Chat Dokter</a>
                    <a class="nav-link" href="../lab/index.php">LAB</a>
                    <a class="nav-link active fw-semibold" href="../ijin/index.php">Ijin WA</a>
                </div>
            </div>
        </div>
    </nav>

<main class="container py-4 py-lg-5">

    <div class="row g-3 align-items-end mb-4">
        <div class="col-12 col-xl-7">
            <span class="badge text-bg-success-subtle text-success mb-2">IJIN DOKTER</span>
            <h1 class="h3 mb-1">Notifikasi Ijin / Perubahan Praktik</h1>
            <p class="text-secondary mb-0">
                <?= $totalPenerima ?> nomor menunggu pengiriman.
                Riwayat pengiriman menggunakan data <code>batal_praktek_detil_wa</code>.
            </p>
        </div>
        <div class="col-12 col-xl-5">
            <div class="card shadow-sm border-0">
                <div class="card-body py-3 d-flex align-items-center gap-3">
                    <span id="gatewayDot" class="gateway-dot"></span>
                    <div class="flex-grow-1">
                        <div class="fw-semibold">Gateway Ijin Dokter</div>
                        <div class="text-secondary small">Service WhatsApp berjalan pada port 3000.</div>
                    </div>
                    <div class="d-flex gap-2">
                        <a class="btn btn-outline-success btn-sm" href="http://<?= h2($_SERVER['HTTP_HOST'] ?? 'localhost') ?>:3000/" target="_blank" rel="noopener">Buka QR Gateway</a>
                        <a class="btn btn-outline-success btn-sm" href="report.php">Laporan</a>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <?php if ($dbError !== ''): ?>
        <div class="alert alert-danger mb-4">
            <strong>Koneksi database Ijin gagal.</strong><br>
            <?= h2($dbError) ?>
        </div>
    <?php endif; ?>

    <div class="row g-3 mb-4">
        <div class="col-6 col-lg-4">
            <div class="card shadow-sm border-0 h-100">
                <div class="card-body">
                    <div class="text-secondary small">MENUNGGU KIRIM</div>
                    <div class="display-6 fw-bold text-warning"><?= $totalPenerima ?></div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-4">
            <div class="card shadow-sm border-0 h-100">
                <div class="card-body">
                    <div class="text-secondary small">KELOMPOK PESAN</div>
                    <div class="display-6 fw-bold"><?= count($data) ?></div>
                </div>
            </div>
        </div>
        <div class="col-12 col-lg-4">
            <div class="card shadow-sm border-0 h-100">
                <div class="card-body">
                    <div class="text-secondary small">STATUS</div>
                    <div class="fw-semibold text-success mt-2">Siap diproses</div>
                </div>
            </div>
        </div>
    </div>

    <div class="card shadow-sm border-0 mb-4">
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
                <div>
                    <h2 class="h5 mb-1">Kirim Notifikasi</h2>
                    <p class="text-secondary small mb-0">Daftar nomor diambil langsung dari data Ijin yang belum terkirim.</p>
                </div>
            </div>

            <form id="whatsappForm">
                <div class="row g-3">
                    <div class="col-12">
                        <label class="form-label" for="numbers">Nomor Penerima</label>
                        <input
                            type="text"
                            id="numbers"
                            name="numbers"
                            class="form-control"
                            value="<?= h2(implode(',', $allNumbers)) ?>"
                            readonly
                        >
                    </div>

                    <div class="col-12">
                        <label class="form-label" for="message">Isi Pesan</label>
                        <textarea id="message" name="message" class="form-control" rows="10" readonly><?= h2($pesanFull) ?></textarea>
                    </div>

                    <div class="col-12 d-flex flex-wrap gap-2">
                        <button type="button" id="editMessage" class="btn btn-outline-secondary">
                            Edit Pesan
                        </button>

                        <button type="button" id="cancelEdit" class="btn btn-outline-secondary d-none">
                            Batalkan Edit
                        </button>

                        <button type="submit" class="btn btn-success" <?= $totalPenerima === 0 ? 'disabled' : '' ?>>
                            Kirim Sekarang
                        </button>
                    </div>
                </div>
            </form>

            <div id="sendResult" class="mt-3"></div>

            <?php if ($totalPenerima === 0 && $dbError === ''): ?>
                <div class="alert alert-light border text-center mt-3 mb-0">
                    Tidak ada notifikasi yang perlu dikirim.
                </div>
            <?php endif; ?>
        </div>
    </div>

    <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
            <h2 class="h5 mb-1">Riwayat Pengiriman</h2>
            <p class="text-secondary small mb-0">
                Data ditampilkan server-side agar tetap ringan untuk jumlah data besar.
            </p>
        </div>
    </div>

    <div class="card shadow-sm border-0 mb-4">
        <div class="card-body">
            <form id="historyFilterForm" class="row g-2 align-items-end">
                <div class="col-12 col-md-3 col-xl-2">
                    <label class="form-label" for="noReg">No. RM</label>
                    <input type="text" id="noReg" class="form-control" placeholder="No. RM">
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                    <label class="form-label" for="noTelp">No. HP</label>
                    <input type="text" id="noTelp" class="form-control" placeholder="No. HP">
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                    <label class="form-label" for="poli">Poli</label>
                    <input type="text" id="poli" class="form-control" placeholder="Nama Poli">
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                    <label class="form-label" for="namaDokter">Dokter</label>
                    <input type="text" id="namaDokter" class="form-control" placeholder="Nama Dokter">
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                    <label class="form-label" for="tglKirim">Tanggal Kirim</label>
                    <input type="text" id="tglKirim" class="form-control" placeholder="DD-MM-YYYY" autocomplete="off">
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                    <label class="form-label" for="statusKirim">Status</label>
                    <select id="statusKirim" class="form-select">
                        <option value="">Semua Status</option>
                        <option value="1">Terkirim</option>
                        <option value="2">Gagal Kirim</option>
                        
                    </select>
                </div>
                <div class="col-12 d-flex gap-2 pt-1">
                    <button type="button" class="btn btn-success" id="btnCari">Cari</button>
                    <button type="button" class="btn btn-outline-secondary" id="btnReset">Reset</button>
                </div>
            </form>
        </div>
    </div>

    <div class="card shadow-sm border-0">
        <div class="card-body">
            <div class="table-responsive border-0">
                <table id="TblBtlKirim" class="table table-striped table-hover align-middle w-100">
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
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </div>

</main>

<footer class="border-top bg-white py-4 text-center text-secondary small">
    <?= h2(APP_NAME) ?> · PHP Native + MySQL + whatsapp-web.js
</footer>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.datatables.net/v/bs5/dt-3.0.2/r-4.0.2/datatables.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/id.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<script src="../assets/back-to-top.js"></script>
<script>
/*
 * IJIN DataTables compatibility:
 * beberapa instalasi PHP/Laragon dapat mengirim warning sebelum JSON.
 * Converter ini membersihkan prefix non-JSON tanpa mengubah query backend.
 */
(function ($) {
    if (!$ || !$.ajaxSetup) return;

    $.ajaxSetup({
        converters: {
            'text json': function (text) {
                try {
                    return JSON.parse(text);
                } catch (error) {
                    var first = text.indexOf('{');
                    var last = text.lastIndexOf('}');

                    if (first >= 0 && last > first) {
                        return JSON.parse(text.slice(first, last + 1));
                    }

                    throw error;
                }
            }
        }
    });
})(window.jQuery);
</script>
<script src="assets/js/master.js?v=20260926-03"></script>
<script>
(function () {
    const dot = document.getElementById('gatewayDot');
    if (!dot) return;

    const baseUrl = 'http://' + window.location.hostname + ':3000';

    async function refreshIjinGatewayDot() {
        try {
            const response = await fetch(baseUrl + '/health', {
                cache: 'no-store'
            });

            const data = await response.json();
            dot.className = 'gateway-dot';

            if (data.ready || data.state === 'READY') {
                dot.classList.add('ready');
            } else if (
                data.state === 'ERROR' ||
                data.state === 'AUTH_FAILURE'
            ) {
                dot.classList.add('error');
            }
        } catch (error) {
            dot.className = 'gateway-dot error';
        }
    }

    async function refreshIjinGatewayDot() {
        try {
            const response = await fetch(baseUrl + '/health', {
                cache: 'no-store'
            });

            const data = await response.json();
            dot.className = 'gateway-dot';

            if (data.ready || data.state === 'READY') {
                dot.classList.add('ready');
            } else if (
                data.state === 'ERROR' ||
                data.state === 'AUTH_FAILURE'
            ) {
                dot.classList.add('error');
            }
        } catch (error) {
            dot.className = 'gateway-dot error';
        }
    }

    refreshIjinGatewayDot();
    setInterval(refreshIjinGatewayDot, 5000);
})();
</script>
</body>
</html>
