'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const required = [
  ['services/reminder/server.js', /app\.post\('\/send'/],
  ['services/reminder/server.js', /app\.get\('\/status'/],
  ['services/lab/server.js', /app\.post\('\/send'/],
  ['services/lab/server.js', /app\.get\('\/health'/],
  ['services/ijin/server.js', /app\.post\('\/send'/],
  ['services/ijin/server.js', /app\.get\('\/health'/],
  ['api/lab-send.php', /127\.0\.0\.1:9000\/send/],
  ['api/ijin-send.php', /127\.0\.0\.1:3000\/send/],
  ['.env.example', /LAB_GATEWAY_PORT=9000/],
  ['.env.example', /IJIN_GATEWAY_PORT=3000/],
  ['.env.example', /REMINDER_GATEWAY_PORT=3210/],
  ['src/whatsapp/WhatsAppLifecycle.js', /client\.on\('disconnected'/],
  ['src/whatsapp/WhatsAppLifecycle.js', /client\.on\('auth_failure'/],
  ['src/whatsapp/WhatsAppLifecycle.js', /client\.on\('error'/]
];

for (const [file, pattern] of required) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error('Missing contract file: ' + file);
  const content = fs.readFileSync(full, 'utf8');
  if (!pattern.test(content)) throw new Error('Contract missing: ' + file);
}

console.log('Static compatibility contract: PASS');
