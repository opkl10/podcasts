<?php
// CastFlow Studio - PHP Network IP Endpoint
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

$clientIp = $_SERVER['HTTP_CLIENT_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
$serverIp = $_SERVER['SERVER_ADDR'] ?? '127.0.0.1';

echo json_encode([
    'clientIp' => $clientIp,
    'serverIp' => $serverIp,
    'localIps' => [$serverIp]
]);
