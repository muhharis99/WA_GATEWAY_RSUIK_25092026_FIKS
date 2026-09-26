const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

const SERVICES = [
  {
    name: 'REMINDER',
    script: path.join(PROJECT_ROOT, 'services', 'reminder', 'server.js'),
    port: 3210
  },
  {
    name: 'LAB',
    script: path.join(PROJECT_ROOT, 'services', 'lab', 'server.js'),
    port: 9000
  },
  {
    name: 'IJIN',
    script: path.join(PROJECT_ROOT, 'services', 'ijin', 'server.js'),
    port: 3000
  }
];

const children = new Map();
let shuttingDown = false;

function log(name, message) {
  console.log('[ALTERNATIF][' + name + '] ' + message);
}

function startService(service) {
  if (shuttingDown) return null;

  const child = spawn(process.execPath, [service.script], {
    cwd: PROJECT_ROOT,
    env: { ...process.env },
    stdio: 'inherit',
    windowsHide: false
  });

  children.set(service.name, child);

  log(service.name, 'STARTED -> ' + service.script + ' -> port ' + service.port + ' (PID ' + child.pid + ')');

  child.on('error', (error) => {
    log(service.name, 'ERROR: ' + error.message);
  });

  child.on('exit', (code, signal) => {
    children.delete(service.name);

    if (shuttingDown) {
      log(service.name, 'STOPPED (' + (signal || code || 0) + ')');
      return;
    }

    log(service.name, 'BERHENTI TIDAK TERDUGA (code=' + (code === null ? 'null' : code) + ', signal=' + (signal || 'null') + ')');
    void gracefulShutdown(code && code !== 0 ? code : 1);
  });

  return child;
}

function sendStop(child) {
  if (!child || child.killed) return;

  child.kill();
}

async function gracefulShutdown(exitCode) {
  if (shuttingDown) return;

  shuttingDown = true;
  exitCode = Number.isInteger(exitCode) ? exitCode : 0;

  console.log('\n==================================================');
  console.log('MENGHENTIKAN ALTERNATIF SERVICE');
  console.log('==================================================');

  for (const service of SERVICES) {
    const child = children.get(service.name);
    if (!child) continue;
    log(service.name, 'Mengirim signal shutdown...');
    sendStop(child);
  }

  const timeout = setTimeout(() => {
    console.error('Timeout saat menghentikan child services.');
    process.exit(exitCode || 1);
  }, 10000);
  timeout.unref();

  await new Promise((resolve) => {
    if (children.size === 0) {
      resolve();
      return;
    }

    const check = setInterval(() => {
      if (children.size === 0) {
        clearInterval(check);
        resolve();
      }
    }, 100);
    check.unref();
  });

  clearTimeout(timeout);
  console.log('Semua service berhenti.');
  process.exit(exitCode);
}

console.log('==================================================');
console.log('ALTERNATIF SERVICE');
console.log('==================================================');
console.log('Menjalankan 3 gateway sekaligus:');
console.log('Reminder -> http://localhost:3210');
console.log('LAB      -> http://localhost:9000');
console.log('IJIN     -> http://localhost:3000');
console.log('==================================================\n');

async function startAllServices() {
  for (const service of SERVICES) {
    startService(service);

    // Beri waktu Chromium / WhatsApp Web service sebelumnya
    // menyelesaikan startup sebelum service berikutnya dimulai.
    await new Promise((resolve) => setTimeout(resolve, 20000));
  }
}

void startAllServices();

process.on('SIGINT', () => { void gracefulShutdown(0); });
process.on('SIGTERM', () => { void gracefulShutdown(0); });

process.on('uncaughtException', (error) => {
  console.error('ALTERNATIF uncaught exception:', error.stack || error.message || error);
  void gracefulShutdown(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('ALTERNATIF unhandled rejection:', reason);
});

process.stdin.resume();
