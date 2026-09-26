'use strict';

const fs = require('fs');
const path = require('path');

const frontendFiles = [
    'assets/back-to-top.js',
    'ijin/assets/js/master.js',
    'index.php',
    'ijin/index.php',
    'lab/index.php',
    'master.php',
    'pindah_jam_praktek.php',
    'report.php',
    'dokter_ijin.php',
    'ijin/report.php',
    'lab/report.php'
];

const forbiddenPatterns = [
    /document\.getElementById\s*\(/,
    /document\.querySelector(?:All)?\s*\(/,
    /\.addEventListener\s*\(/,
    /\bfetch\s*\(/,
    /\bnew\s+DataTable\s*\(/,
    /window\.confirm\s*\(/
];

const requiredPatterns = [
    /\$\(function\s*\(/,
    /\$\.ajax\s*\(/
];

function read(relativePath) {
    return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

for (const file of frontendFiles) {
    const content = read(file);

    for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
            throw new Error(`Forbidden non-jQuery frontend pattern in ${file}: ${pattern}`);
        }
    }

    if (file.endsWith('.js') && !/\$\(/.test(content)) {
        throw new Error(`Expected jQuery usage in frontend asset: ${file}`);
    }
}

for (const file of ['index.php', 'ijin/index.php', 'lab/index.php', 'master.php', 'report.php']) {
    const content = read(file);

    if (!/code\.jquery\.com\/jquery-3\.7\.1\.min\.js/.test(content)) {
        throw new Error(`jQuery CDN is missing from ${file}`);
    }
}

console.log('jQuery frontend contract passed.');
