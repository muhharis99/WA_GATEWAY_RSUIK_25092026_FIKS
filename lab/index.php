<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/app/Support/functions.php';
function h($v):string{return htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');}
?><!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Laboratorium · <?=h(APP_NAME)?></title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet"><link rel="stylesheet" href="../assets/style.css"></head><body class="bg-body-tertiary"><nav class="navbar navbar-expand-lg bg-white border-bottom sticky-top">
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
<a class="nav-link active fw-semibold" href="../lab/index.php">LAB</a>
                    <a class="nav-link" href="../ijin/index.php">Ijin WA</a>
                </div>
            </div>
        </div>
    </nav><main class="container py-4 py-lg-5"><div class="mb-4"><span class="badge text-bg-success-subtle text-success mb-2">LABORATORIUM</span><h1 class="h3 mb-1">Kirim Hasil Pemeriksaan Laboratorium</h1><p class="text-secondary">Pengiriman tetap memakai PDF hasil pemeriksaan dan caption.</p></div><div class="card shadow-sm border-0 mb-4"><div class="card-body d-flex align-items-center gap-3"><span class="gateway-dot"></span><div class="flex-grow-1"><div class="fw-semibold">Gateway LAB</div><div class="text-secondary small">Service WhatsApp berjalan pada port 9000.</div></div><a class="btn btn-outline-success btn-sm" href="http://<?= h($_SERVER['HTTP_HOST'] ?? 'localhost') ?>:9000/" target="_blank" rel="noopener">Buka QR Gateway</a></div></div><div class="card shadow-sm border-0"><div class="card-body"><form id="f"><div class="row g-3"><div class="col-md-6"><label class="form-label">Nomor WhatsApp</label><input id="n" class="form-control" placeholder="0812..., pisahkan koma" required></div><div class="col-md-6"><label class="form-label">No. Registrasi</label><input id="r" maxlength="7" class="form-control" inputmode="numeric" required></div><div class="col-12"><label class="form-label">Caption</label><textarea id="m" class="form-control" rows="7" required></textarea></div></div><button class="btn btn-success mt-3" id="b">Kirim PDF WhatsApp</button></form><div id="o" class="mt-3"></div></div></div></main><script>document.getElementById('f').addEventListener('submit',async e=>{e.preventDefault();const b=document.getElementById('b'),o=document.getElementById('o');b.disabled=true;b.textContent='Mengirim...';try{const r=await fetch('../api/lab-send.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({numbers:document.getElementById('n').value,message:document.getElementById('r').value+document.getElementById('m').value})});const j=await r.json();o.innerHTML='<div class="alert '+(j.success?'alert-success':'alert-danger')+'">'+(j.message||JSON.stringify(j))+'</div>'}catch(x){o.innerHTML='<div class="alert alert-danger">'+x.message+'</div>'}finally{b.disabled=false;b.textContent='Kirim PDF WhatsApp'}});</script><script>
$(function () {
    $('#f').on('submit', function (event) {
        event.preventDefault();

        var $button = $('#b');
        var $output = $('#o');

        $button.prop('disabled', true).text('Mengirim...');

        $.ajax({
            url: '../api/lab-send.php',
            type: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            timeout: 600000,
            data: JSON.stringify({
                numbers: $.trim($('#n').val()),
                message: $.trim($('#r').val()) + $.trim($('#m').val())
            })
        }).done(function (result) {
            var message = $('<div>').text(result.message || JSON.stringify(result)).html();

            $output.html(
                '<div class="alert ' +
                (result.success ? 'alert-success' : 'alert-danger') +
                '">' + message + '</div>'
            );
        }).fail(function (xhr, status) {
            var message = 'Terjadi kesalahan saat mengirim data.';

            if (xhr.responseJSON && xhr.responseJSON.message) {
                message = xhr.responseJSON.message;
            } else if (status === 'timeout') {
                message = 'Request timeout. Server mungkin masih memproses.';
            }

            $output.html(
                '<div class="alert alert-danger">' +
                $('<div>').text(message).html() +
                '</div>'
            );
        }).always(function () {
            $button.prop('disabled', false).text('Kirim PDF WhatsApp');
        });
    });

    var $dot = $('.gateway-dot').first();

    if (!$dot.length) {
        return;
    }

    var baseUrl = 'http://' + location.hostname + ':9000';

    function refreshLabGatewayDot() {
        $.ajax({
            url: baseUrl + '/health',
            type: 'GET',
            dataType: 'json',
            cache: false
        }).done(function (data) {
            $dot.removeClass('ready error');

            if (data.ready || data.state === 'READY') {
                $dot.addClass('ready');
            } else if (data.state === 'ERROR' || data.state === 'AUTH_FAILURE') {
                $dot.addClass('error');
            }
        }).fail(function () {
            $dot.removeClass('ready').addClass('error');
        });
    }

    refreshLabGatewayDot();
    setInterval(refreshLabGatewayDot, 5000);
});
</script></body></html>