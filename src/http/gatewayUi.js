'use strict';

function renderGatewayPage(title, status) {
  const ready = status.ready;
  const qr = status.qrDataUrl;
  const heading = ready ? 'WhatsApp Terhubung' : (qr ? 'Scan QR WhatsApp' : 'Menyiapkan WhatsApp...');
  const description = ready
    ? 'WhatsApp sudah terhubung dan siap digunakan.'
    : (qr
      ? 'Buka WhatsApp di HP, pilih Perangkat tertaut, lalu scan QR ini.'
      : 'Mohon tunggu, service WhatsApp sedang menyiapkan koneksi.');

  const content = ready
    ? '<div class="ready-icon">✓</div>'
    : qr
      ? '<div class="qr-wrap"><img class="qr" src="' + qr + '" alt="QR WhatsApp"></div>'
      : '<div class="waiting"><div class="spinner"></div></div>';

  return '<!doctype html><html lang="id"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title>' +
    '<style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif}' +
    'body{background:#f8f9fa;color:#495057}.page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}' +
    '.card{width:min(640px,100%);min-height:475px;background:#fff;border:1px solid #ececec;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;text-align:center;padding:42px}' +
    '.content{width:100%}.title{font-size:14px;font-weight:700;color:#198754;margin-bottom:24px}.qr-wrap{display:flex;justify-content:center;margin-bottom:28px}' +
    '.qr{width:230px;height:230px;display:block;border:1px solid #dee2e6;border-radius:7px;padding:8px;background:#fff}.waiting{width:230px;height:230px;margin:0 auto 28px;border:1px solid #dee2e6;border-radius:7px;display:flex;align-items:center;justify-content:center;background:#fff}' +
    '.spinner{width:42px;height:42px;border:4px solid #e9ecef;border-top-color:#198754;border-radius:50%;animation:spin 1s linear infinite}.ready-icon{width:92px;height:92px;margin:0 auto 28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#198754;color:#fff;font-size:58px;font-weight:700}' +
    '.desc{font-size:16px;line-height:1.6;color:#6c757d;margin-bottom:20px}.status{font-size:13px;color:#6c757d;margin-bottom:18px}.refresh{border:1px solid #adb5bd;background:#fff;color:#6c757d;border-radius:4px;padding:7px 12px;font-size:14px;cursor:pointer}' +
    '@keyframes spin{to{transform:rotate(360deg)}}}</style></head><body><main class="page"><section class="card"><div class="content">' +
    '<div class="title">' + heading + '</div>' + content +
    '<div class="desc">' + description + '</div><div class="status">Status: ' + String(status.state) + '</div>' +
    '<button class="refresh" type="button" onclick="location.reload()">Refresh</button></div></section></main>' +
    (ready ? '' : '<script>setTimeout(function(){location.reload()},3000)</script>') +
    '</body></html>';
}

module.exports = { renderGatewayPage };
