<?php

declare(strict_types=1);
require_once dirname(__DIR__) . '/app/Support/functions.php';
$date = date('Y-m-d');
ensureReminders($date);
echo "Reminder siap untuk {$date}\n";
