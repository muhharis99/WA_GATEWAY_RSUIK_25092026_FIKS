'use strict';

const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const services = [
  { name: 'REMINDER', script: path.join(projectRoot, 'services/reminder/server.js'), port: 3210 },
  { name: 'LAB', script: path.join(projectRoot, 'services/lab/server.js'), port: 9000 },
  { name: 'IJIN', script: path.join(projectRoot, 'services/ijin/server.js'), port: 3000 }
];

const children = new Map();
const timers = new Map();
let shuttingDown = false;

function startService(item) {
  if (shuttingDown) return;
  const child = spawn(process.execPath, [item.script], {
    cwd: projectRoot,
    env: { ...process.env },
    stdio: 'inherit',
    windowsHide: false
  });
  children.set(item.name, child);
  child.on('error', (error) => console.error('[ALTERNATIF][' + item.name + ']', error.message));
  child.on('exit', (code, signal) => {
    children.delete(item.name);
    if (!shuttingDown) scheduleRestart(item);
    console.warn('[ALTERNATIF][' + item.name + '] exit code=' + code + ' signal=' + signal + '; service lain tetap berjalan.');
  });
}

function scheduleRestart(item) {
  if (shuttingDown || timers.has(item.name)) return;
  const timer = setTimeout(() => {
    timers.delete(item.name);
    startService(item);
  }, 5000);
  timers.set(item.name, timer);
  timer.unref?.();
}

for (const item of services) startService(item);

function shutdown() {
  shuttingDown = true;
  for (const child of children.values()) child.kill();
  for (const timer of timers.values()) clearTimeout(timer);
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
