const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const PORT = Number(process.env.WA_PORT || 3210);
const HOST = process.env.WA_HOST || '0.0.0.0';
const PROJECT_ROOT = path.resolve(__dirname, '../..');
if (typeof process.loadEnvFile === 'function') {
    try {
        process.loadEnvFile(path.join(PROJECT_ROOT, '.env'));
    } catch (error) {
        console.warn('⚠️ .env Reminder tidak dapat dimuat:', error.message || error);
    }
}
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '128kb' }));

let waState = 'STARTING';
let qrDataUrl = null;
let lastError = null;
let reminderRecoveryScheduled = false;

let client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'dokter-reminder',
        dataPath: path.join(PROJECT_ROOT, '.wwebjs_auth')
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-first-run',
            '--no-default-browser-check'
        ]
    }
});

client.on('qr', async (qr) => {
    try {
        qrDataUrl = await QRCode.toDataURL(qr, {
            width: 240,
            margin: 1
        });

        waState = 'QR_READY';
        lastError = null;

        console.log(
            'QR WhatsApp siap. Buka browser ke http://localhost:' +
            PORT
        );
    } catch (error) {
        lastError = error.message;
        waState = 'ERROR';
        console.error('Gagal membuat QR:', error);
    }
});

client.on('authenticated', () => {
    waState = 'AUTHENTICATED';
    qrDataUrl = null;
    lastError = null;
    console.log('WhatsApp berhasil diautentikasi.');
});

client.on('ready', () => {
    waState = 'READY';
    qrDataUrl = null;
    lastError = null;
    console.log('WhatsApp gateway READY.');
});

client.on('auth_failure', (message) => {
    waState = 'AUTH_FAILURE';
    lastError = String(message || 'Authentication failure');
    console.error('WhatsApp auth failure:', message);
});

function isRecoverableBrowserError(error) {
    const message = String(error?.message || error || '');

    return (
        message.includes('Execution context was destroyed') ||
        message.includes('Navigating frame was detached') ||
        message.includes('Session closed') ||
        message.includes('Target closed') ||
        message.includes('Protocol error')
    );
}

function scheduleReminderRecovery(reason = '') {
    if (reminderRecoveryScheduled) {
        return;
    }

    reminderRecoveryScheduled = true;

    console.warn(
        '[REMINDER] Recovery WhatsApp dijadwalkan:',
        reason || 'disconnect'
    );

    setTimeout(async () => {
        try {
            waState = 'STARTING';
            qrDataUrl = null;
            lastError = null;

            try {
                await client.destroy();
            } catch (destroyError) {
                console.warn(
                    '[REMINDER] destroy saat recovery:',
                    destroyError.message || destroyError
                );
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));
            await initializeReminderWithRetry();
        } catch (error) {
            waState = 'ERROR';
            lastError = error.message || String(error);

            console.error(
                '[REMINDER] Recovery WhatsApp gagal:',
                lastError
            );
        } finally {
            reminderRecoveryScheduled = false;
        }
    }, 3000).unref();
}

client.on('disconnected', (reason) => {
    waState = 'DISCONNECTED';
    qrDataUrl = null;
    lastError = String(reason || 'Disconnected');

    console.warn(
        'WhatsApp disconnected. Service tetap berjalan dan recovery akan dicoba:',
        reason
    );

    scheduleReminderRecovery(String(reason || 'Disconnected'));
});

function renderGatewayPage() {
    const qrAvailable = waState;
    const ready = waState === 'READY';
    const qrMarkup = qrAvailable
        ? '<div class="qr-wrap"><img class="qr" src="qrDataUrl" alt="QR WhatsApp"></div>'
        : '<div class="waiting"><div class="spinner"></div></div>';

    const heading = ready ? 'WhatsApp Terhubung' : 'Scan QR WhatsApp';
    const description = ready
        ? 'WhatsApp sudah terhubung dan siap digunakan.'
        : 'Buka WhatsApp di HP, pilih Perangkat tertaut, lalu scan QR ini.';

    return `<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>WhatsApp Gateway · Reminder</title>
    <style>
        *{box-sizing:border-box}
        html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif}
        body{background:#f8f9fa;color:#495057}
        .page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
        .card{width:min(640px,100%);min-height:475px;background:#fff;border:1px solid #ececec;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;text-align:center;padding:42px}
        .content{width:100%}
        .title{font-size:14px;font-weight:700;color:#198754;margin-bottom:24px}
        .qr-wrap{display:flex;justify-content:center;margin-bottom:28px}
        .qr{width:230px;height:230px;display:block;border:1px solid #dee2e6;border-radius:7px;padding:8px;background:#fff}
        .waiting{width:230px;height:230px;margin:0 auto 28px;border:1px solid #dee2e6;border-radius:7px;display:flex;align-items:center;justify-content:center;background:#fff}
        .spinner{width:42px;height:42px;border:4px solid #e9ecef;border-top-color:#198754;border-radius:50%;animation:spin 1s linear infinite}
        .desc{font-size:16px;line-height:1.6;color:#6c757d;margin-bottom:28px}
        .status{font-size:13px;color:#6c757d;margin-bottom:18px}
        .refresh{border:1px solid #adb5bd;background:#fff;color:#6c757d;border-radius:4px;padding:7px 12px;font-size:14px;cursor:pointer}
        .refresh:hover{background:#f1f3f5}
        @keyframes spin{to{transform:rotate(360deg)}}
    </style>
</head>
<body>
    <main class="page">
        <section class="card">
            <div class="content">
                <div class="title">${heading}</div>
                ${qrMarkup}
                <div class="desc">${description}</div>
                <div class="status">Status: ${waState}</div>
                <button class="refresh" type="button" onclick="location.reload()">Refresh</button>
            </div>
        </section>
    </main>
    ${ready ? '' : '<script>setTimeout(function(){location.reload()},5000)</script>'}
</body>
</html>`;
}


app.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    const ready = waState === 'READY';
    const qrAvailable = Boolean(qrDataUrl);
    const state = waState;
    const qrSource = qrDataUrl;

    let content = '';
    let heading = 'Menyiapkan WhatsApp...';
    let description = 'Mohon tunggu, service WhatsApp sedang menyiapkan koneksi.';

    if (ready) {
        heading = 'WhatsApp Terhubung';
        description = 'WhatsApp sudah terhubung dan siap digunakan.';
        content = '<div class="ready-icon">✓</div>';
    } else if (qrAvailable) {
        heading = 'Scan QR WhatsApp';
        description = 'Buka WhatsApp di HP, pilih Perangkat tertaut, lalu scan QR ini.';
        content = '<div class="qr-wrap"><img class="qr" src="' + qrSource + '" alt="QR WhatsApp"></div>';
    } else {
        content = '<div class="waiting"><div class="spinner"></div></div>';
    }

    let html = [
        '<!doctype html>',
        '<html lang="id">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>WhatsApp Gateway · Reminder</title>',
        '<style>',
        '*{box-sizing:border-box}',
        'html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif}',
        'body{background:#f8f9fa;color:#495057}',
        '.page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}',
        '.card{width:min(640px,100%);min-height:475px;background:#fff;border:1px solid #ececec;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;text-align:center;padding:42px}',
        '.content{width:100%}',
        '.title{font-size:14px;font-weight:700;color:#198754;margin-bottom:24px}',
        '.qr-wrap{display:flex;justify-content:center;margin-bottom:28px}',
        '.qr{width:230px;height:230px;display:block;border:1px solid #dee2e6;border-radius:7px;padding:8px;background:#fff}',
        '.waiting{width:230px;height:230px;margin:0 auto 28px;border:1px solid #dee2e6;border-radius:7px;display:flex;align-items:center;justify-content:center;background:#fff}',
        '.spinner{width:42px;height:42px;border:4px solid #e9ecef;border-top-color:#198754;border-radius:50%;animation:spin 1s linear infinite}',
        '.ready-icon{width:92px;height:92px;margin:0 auto 28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#198754;color:#fff;font-size:58px;font-weight:700}',
        '.desc{font-size:16px;line-height:1.6;color:#6c757d;margin-bottom:20px}',
        '.status{font-size:13px;color:#6c757d;margin-bottom:18px}',
        '.refresh{border:1px solid #adb5bd;background:#fff;color:#6c757d;border-radius:4px;padding:7px 12px;font-size:14px;cursor:pointer}',
        '.refresh:hover{background:#f1f3f5}',
        '@keyframes spin{to{transform:rotate(360deg)}}',
        '</style>',
        '</head>',
        '<body>',
        '<main class="page">',
        '<section class="card">',
        '<div class="content">',
        '<div class="title">', heading, '</div>',
        content,
        '<div class="desc">', description, '</div>',
        '<div class="status">Status: ', state, '</div>',
        '<button class="refresh" type="button" onclick="location.reload()">Refresh</button>',
        '</div>',
        '</section>',
        '</main>',
        '</body>',
        '</html>'
    ].join('');

    if (!ready) {
        html += '<script>setTimeout(function(){location.reload()},2000)</script>';
    }

    res.send(html);
});

app.get('/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
        success: true,
        state: waState,
        ready: waState === 'READY',
        hasQr: Boolean(qrDataUrl),
        error: lastError,
        incomingQueue: incomingQueue.size,
        mappedContacts: contactIdentityMap.size
    });
});

app.post('/send', async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const doctorId = String(req.body.doctor_id || '').trim();
    const message = String(req.body.message || '').trim();

    terminalLog('PERMINTAAN KIRIM WHATSAPP', {
        Status: 'MEMPROSES',
        DoctorId: doctorId || '-',
        Tujuan: phone || '-',
        PanjangPesan: message.length
    });

    try {
        if (waState !== 'READY') {
            return res.status(503).json({
                success: false,
                message: 'WhatsApp belum terhubung. Scan QR terlebih dahulu.',
                state: waState
            });
        }

        if (!phone || !/^62\d{8,15}$/.test(phone)) {
            return res.status(422).json({
                success: false,
                message: 'Format nomor WhatsApp tidak valid.'
            });
        }

        if (!message) {
            return res.status(422).json({
                success: false,
                message: 'Pesan WhatsApp kosong.'
            });
        }

        const numberId = await client.getNumberId(phone);

        if (!numberId) {
            return res.status(404).json({
                success: false,
                message: 'Nomor tidak terdaftar di WhatsApp.'
            });
        }

        rememberIdentity(numberId._serialized, phone, doctorId);
        rememberIdentity(numberId.user, phone, doctorId);

        const sentMessage = await client.sendMessage(
            numberId._serialized,
            message
        );

        const messageId = sentMessage?.id?._serialized || null;

        rememberIdentity(sentMessage?.to, phone, doctorId);
        rememberIdentity(sentMessage?.id?.remote, phone, doctorId);
        rememberIdentity(sentMessage?._data?.to?._serialized, phone, doctorId);
        rememberIdentity(sentMessage?._data?.to?.user, phone, doctorId);

        try {
            const chat = await sentMessage.getChat();

            rememberIdentity(chat?.id?._serialized, phone, doctorId);
            rememberIdentity(chat?.id?.user, phone, doctorId);
            rememberIdentity(chat?._data?.id?._serialized, phone, doctorId);
            rememberIdentity(chat?._data?.id?.user, phone, doctorId);

            try {
                const contact = await chat.getContact();
                rememberIdentity(contact?.id?._serialized, phone, doctorId);
                rememberIdentity(contact?.id?.user, phone, doctorId);
            } catch (contactError) {
            }
        } catch (chatError) {
            console.warn('Gagal menyimpan mapping chat outgoing:', chatError.message || chatError);
        }

        terminalLog('WHATSAPP BERHASIL DIKIRIM', {
            Status: 'BERHASIL',
            DoctorId: doctorId || '-',
            Tujuan: phone,
            MessageId: messageId || '-',
            Ack: sentMessage?.ack ?? '-',
            Mapping: contactIdentityMap.size
        });

        return res.json({
            success: true,
            message: 'Pesan WhatsApp berhasil dikirim.',
            phone,
            doctorId,
            messageId
        });
    } catch (error) {
        terminalLog('WHATSAPP GAGAL DIKIRIM', {
            Status: 'GAGAL',
            DoctorId: doctorId || '-',
            Tujuan: phone || '-',
            Alasan: error.message || 'Gagal mengirim WhatsApp'
        });

        return res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengirim WhatsApp.'
        });
    }
});

app.listen(PORT, HOST, () => {
    console.log(`WhatsApp gateway berjalan di http://localhost:${PORT}`);
});

function isStartupNavigationError(error) {
    const message = String(error?.message || error || '');

    return (
        message.includes('Execution context was destroyed') ||
        message.includes('Navigating frame was detached') ||
        message.includes('Session closed') ||
        message.includes('Target closed') ||
        message.includes('Protocol error')
    );
}

async function initializeReminderWithRetry() {
    const maxAttempts = 4;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            waState = 'STARTING';
            lastError = null;

            console.log(
                '[REMINDER] Inisialisasi WhatsApp percobaan ' +
                attempt +
                '/' +
                maxAttempts
            );

            await client.initialize();
            return true;
        } catch (error) {
            lastError = error.message || String(error);

            console.error(
                '[REMINDER] Gagal initialize percobaan ' +
                attempt +
                '/' +
                maxAttempts +
                ':',
                lastError
            );

            if (!isStartupNavigationError(error) || attempt >= maxAttempts) {
                waState = 'ERROR';
                return false;
            }

            waState = 'STARTING';

            try {
                await client.destroy();
            } catch (destroyError) {
                console.warn(
                    '[REMINDER] destroy setelah initialize gagal:',
                    destroyError.message || destroyError
                );
            }

            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }

    waState = 'ERROR';
    return false;
}

initializeReminderWithRetry().then((started) => {
    if (!started) {
        console.error(
            '[REMINDER] WhatsApp gagal diinisialisasi setelah seluruh percobaan.'
        );
    }
});


process.on('uncaughtException', (error) => {
    if (isRecoverableBrowserError(error)) {
        waState = 'DISCONNECTED';
        qrDataUrl = null;
        lastError = error.message || String(error);

        console.warn(
            '[REMINDER] Error browser WhatsApp dapat dipulihkan:',
            lastError
        );

        scheduleReminderRecovery(lastError);
        return;
    }

    console.error(
        '[REMINDER] Uncaught exception:',
        error.stack || error.message || error
    );
});

process.on('unhandledRejection', (reason) => {
    if (isRecoverableBrowserError(reason)) {
        waState = 'DISCONNECTED';
        qrDataUrl = null;
        lastError = String(reason?.message || reason);

        console.warn(
            '[REMINDER] Promise WhatsApp gagal tetapi dapat dipulihkan:',
            lastError
        );

        scheduleReminderRecovery(lastError);
        return;
    }

    console.error(
        '[REMINDER] Unhandled rejection:',
        reason
    );
});
