'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const required = [
  ['src/entrypoints/reminder.js', /app\.post\('\/send'/],
  ['src/entrypoints/reminder.js', /app\.get\('\/status'/],
  ['src/entrypoints/lab.js', /app\.post\('\/send'/],
  ['src/entrypoints/lab.js', /app\.get\('\/health'/],
  ['src/entrypoints/ijin.js', /app\.post\('\/send'/],
  ['src/entrypoints/ijin.js', /app\.get\('\/health'/],
  ['src/whatsapp/createClient.js', /patchWhatsAppWebMediaBug/],
  ['api/lab-send.php', /127\.0\.0\.1:9000\/send/],
  ['api/ijin-send.php', /127\.0\.0\.1:3000\/send/],
  ['.env.example', /LAB_GATEWAY_PORT=9000/],
  ['.env.example', /IJIN_GATEWAY_PORT=3000/],
  ['.env.example', /REMINDER_GATEWAY_PORT=3210/],
  ['src/whatsapp/WhatsAppLifecycle.js', /client\.on\('disconnected'/],
  ['src/whatsapp/createClient.js', /resolveBrowserExecutable/],
  ['src/whatsapp/createClient.js', /webVersionCache: \{ type: 'none' \}/],
  ['src/whatsapp/WhatsAppLifecycle.js', /watchAuthenticatedReady/],
  ['src/services/ReminderGatewayService.js', /sendSeen: false/],
  ['src/services/IjinGatewayService.js', /sendSeen: false/],
  ['src/services/LabGatewayService.js', /sendSeen: false/],
  ['src/whatsapp/WhatsAppLifecycle.js', /client\.on\('auth_failure'/],
  ['src/whatsapp/WhatsAppLifecycle.js', /client\.on\('error'/]
];

for (const [file, pattern] of required) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error('Missing contract file: ' + file);
  const content = fs.readFileSync(full, 'utf8');
  if (!pattern.test(content)) throw new Error('Contract missing: ' + file);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (pkg.scripts.start !== 'node src/entrypoints/reminder.js') {
  throw new Error('Reminder MVC runtime is not canonical');
}
if (pkg.scripts['start:lab'] !== 'node src/entrypoints/lab.js') {
  throw new Error('LAB MVC runtime is not canonical');
}
if (pkg.scripts['start:ijin'] !== 'node src/entrypoints/ijin.js') {
  throw new Error('IJIN MVC runtime is not canonical');
}
if (pkg.scripts['start:alternatif'] !== 'node src/entrypoints/alternatif.js') {
  throw new Error('Supervisor MVC runtime is not canonical');
}

for (const file of ['app/Config/config.php']) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (content.includes('4dm1n3dp') || content.includes('admin3dp')) {
    throw new Error('Hardcoded database credential detected in ' + file);
  }
}

for (const file of ['src/entrypoints/lab.js', 'src/entrypoints/ijin.js']) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (content.includes('qrDataUrl:')) {
    throw new Error('QR payload must not be exposed through health endpoint: ' + file);
  }
}

if (fs.existsSync(path.join(root, 'test.txt'))) {
  throw new Error('Obsolete test.txt must be removed');
}

console.log('Static compatibility and architecture contract: PASS');
