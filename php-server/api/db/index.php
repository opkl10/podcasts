<?php
// CastFlow Studio - PHP DB API for Standard Web Hosting (uPress / cPanel / Apache / Nginx)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dbDir = __DIR__ . '/../../data';
$dbFile = $dbDir . '/podcast_studio.db.json';

if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

// GET: Return JSON Database
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($dbFile)) {
        $content = file_get_contents($dbFile);
        echo $content ?: json_encode(['podcasts' => [], 'episodes' => []]);
    } else {
        echo json_encode(['podcasts' => [], 'episodes' => []]);
    }
    exit;
}

// POST: Save JSON Database
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    if (!$rawInput) {
        http_response_code(400);
        echo json_encode(['error' => 'No data received']);
        exit;
    }

    $decoded = json_decode($rawInput, true);
    if ($decoded === null) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    file_put_contents($dbFile, json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode([
        'success' => true,
        'message' => 'Database saved successfully on server',
        'timestamp' => date('c')
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
