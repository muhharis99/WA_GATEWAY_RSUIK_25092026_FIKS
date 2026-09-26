<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require_once dirname(__DIR__) . '/app/Support/functions.php';

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

try {
    $pdo = get_db('ijin');
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

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
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
