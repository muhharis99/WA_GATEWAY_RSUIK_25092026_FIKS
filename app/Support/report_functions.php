<?php

declare(strict_types=1);

require_once __DIR__ . '/functions.php';

function parseReportDate(string $value, string $fallback): string
{
    foreach (['d-m-Y', 'Y-m-d'] as $format) {
        $date = DateTime::createFromFormat($format, $value);
        if ($date && $date->format($format) === $value) {
            return $date->format('Y-m-d');
        }
    }
    return $fallback;
}

function reportDateRange(): array
{
    $startDate = parseReportDate(
        trim((string) ($_GET['start_date'] ?? '')),
        date('Y-m-01')
    );
    $endDate = parseReportDate(
        trim((string) ($_GET['end_date'] ?? '')),
        date('Y-m-d')
    );

    if ($startDate > $endDate) {
        [$startDate, $endDate] = [$endDate, $startDate];
    }

    return [$startDate, $endDate];
}

function ensureGatewayReportTables(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS wa_gateway_lab_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            no_reg VARCHAR(50) NOT NULL,
            phone VARCHAR(32) NOT NULL,
            caption TEXT NULL,
            status TINYINT NOT NULL DEFAULT 2,
            status_message VARCHAR(500) NULL,
            sent_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_lab_sent_at (sent_at),
            KEY idx_lab_no_reg (no_reg),
            KEY idx_lab_status (status),
            KEY idx_lab_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS wa_gateway_ijin_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            phone VARCHAR(32) NOT NULL,
            message TEXT NOT NULL,
            status TINYINT NOT NULL DEFAULT 2,
            status_message VARCHAR(500) NULL,
            sent_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_ijin_sent_at (sent_at),
            KEY idx_ijin_status (status),
            KEY idx_ijin_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

function logGatewayLabResults(PDO $pdo, string $message, array $results): void
{
    $noReg = substr(trim($message), 0, 7);
    $caption = trim(substr($message, 7));
    $now = date('Y-m-d H:i:s');

    $statement = $pdo->prepare("
        INSERT INTO wa_gateway_lab_logs
            (no_reg, phone, caption, status, status_message, sent_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ");

    foreach ($results as $item) {
        $phone = trim((string) ($item['number'] ?? ''));
        if ($phone === '') {
            continue;
        }
        $statement->execute([
            $noReg,
            $phone,
            $caption,
            (int) ($item['status'] ?? 2),
            (string) ($item['message'] ?? ''),
            $now
        ]);
    }
}

function logGatewayIjinResults(PDO $pdo, string $message, array $results): void
{
    $now = date('Y-m-d H:i:s');
    $statement = $pdo->prepare("
        INSERT INTO wa_gateway_ijin_logs
            (phone, message, status, status_message, sent_at)
        VALUES (?, ?, ?, ?, ?)
    ");

    foreach ($results as $item) {
        $phone = trim((string) ($item['number'] ?? ''));
        if ($phone === '') {
            continue;
        }
        $statement->execute([
            $phone,
            $message,
            (int) ($item['status'] ?? 2),
            (string) ($item['message'] ?? ''),
            $now
        ]);
    }
}
