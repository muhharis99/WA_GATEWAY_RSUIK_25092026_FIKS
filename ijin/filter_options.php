<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require_once dirname(__DIR__) . '/app/Config/config.php';

$type = trim((string) ($_GET['type'] ?? ''));
$q = trim((string) ($_GET['q'] ?? ''));

$columns = [
    'poli' => 'nama_poli',
    'dokter' => 'nama_dokter'
];

if (!isset($columns[$type])) {
    http_response_code(400);
    echo json_encode([
        'results' => [],
        'error' => 'Parameter type tidak valid.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$config = $GLOBALS['databases']['ijin'] ?? null;

if (!is_array($config)) {
    http_response_code(500);
    echo json_encode([
        'results' => [],
        'error' => 'Konfigurasi database IJIN tidak tersedia.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    $pdo = new PDO(
        sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            (string) ($config['host'] ?? ''),
            (int) ($config['port'] ?? 3306),
            (string) ($config['name'] ?? '')
        ),
        (string) ($config['user'] ?? ''),
        (string) ($config['pass'] ?? ''),
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 5,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );

    $column = $columns[$type];
    $sql = "
        SELECT DISTINCT TRIM({$column}) AS label
        FROM batal_praktek_detil_wa
        WHERE TRIM(COALESCE({$column}, '')) <> ''
    ";

    $params = [];

    if ($q !== '') {
        $sql .= " AND {$column} LIKE ?";
        $params[] = '%' . $q . '%';
    }

    $sql .= " ORDER BY label ASC LIMIT 50";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $results = [];

    foreach ($stmt->fetchAll() as $row) {
        $label = trim((string) ($row['label'] ?? ''));

        if ($label === '') {
            continue;
        }

        $results[] = [
            'id' => $label,
            'text' => $label
        ];
    }

    echo json_encode([
        'results' => $results,
        'pagination' => [
            'more' => count($results) === 50
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'results' => [],
        'error' => 'Gagal mengambil pilihan filter.',
        'detail' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
