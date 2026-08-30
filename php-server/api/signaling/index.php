<?php
// CastFlow Studio - PHP WebRTC Signaling for Standard Web Hosting
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$stateFile = __DIR__ . '/../../data/rooms_signaling.json';
$rooms = file_exists($stateFile) ? json_decode(file_get_contents($stateFile), true) ?: [] : [];

// Clean stale rooms older than 15 mins
$now = time();
foreach ($rooms as $rId => $rData) {
    if (isset($rData['lastActive']) && ($now - $rData['lastActive'] > 900)) {
        unset($rooms[$rId]);
    }
}

$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: [];

$action = $body['action'] ?? '';
$roomId = $body['roomId'] ?? '';
$data = $body['data'] ?? null;
$role = $body['role'] ?? 'client';
$frame = $body['frame'] ?? null;

if (!$roomId) {
    http_response_code(400);
    echo json_encode(['error' => 'Room ID is required']);
    exit;
}

if (!isset($rooms[$roomId])) {
    $rooms[$roomId] = [
        'candidates' => [],
        'lastActive' => $now
    ];
}
$rooms[$roomId]['lastActive'] = $now;

switch ($action) {
    case 'join':
        echo json_encode([
            'status' => 'ok',
            'hasOffer' => !empty($rooms[$roomId]['offer']),
            'hasAnswer' => !empty($rooms[$roomId]['answer']),
            'hasFrame' => !empty($rooms[$roomId]['lastFrame'])
        ]);
        break;

    case 'send-offer':
        $rooms[$roomId]['offer'] = $data;
        unset($rooms[$roomId]['answer']);
        $rooms[$roomId]['candidates'] = array_values(array_filter($rooms[$roomId]['candidates'] ?? [], function($c) {
            return ($c['sender'] ?? '') !== 'host';
        }));
        echo json_encode(['status' => 'offer-saved']);
        break;

    case 'get-offer':
        echo json_encode(['offer' => $rooms[$roomId]['offer'] ?? null]);
        break;

    case 'send-answer':
        $rooms[$roomId]['answer'] = $data;
        echo json_encode(['status' => 'answer-saved']);
        break;

    case 'get-answer':
        echo json_encode(['answer' => $rooms[$roomId]['answer'] ?? null]);
        break;

    case 'send-candidate':
        if ($data) {
            $rooms[$roomId]['candidates'][] = [
                'sender' => $role,
                'candidate' => $data
            ];
        }
        echo json_encode(['status' => 'candidate-added']);
        break;

    case 'get-candidates':
        $target = ($role === 'host') ? 'client' : 'host';
        $matching = [];
        foreach ($rooms[$roomId]['candidates'] ?? [] as $c) {
            if (($c['sender'] ?? '') === $target) {
                $matching[] = $c['candidate'];
            }
        }
        echo json_encode(['candidates' => $matching]);
        break;

    case 'push-frame':
        if ($frame) {
            $rooms[$roomId]['lastFrame'] = $frame;
            $rooms[$roomId]['lastFrameTime'] = microtime(true);
        }
        echo json_encode(['status' => 'frame-received']);
        break;

    case 'pull-frame':
        $frameTime = $rooms[$roomId]['lastFrameTime'] ?? 0;
        $isFresh = $frameTime && ((microtime(true) - $frameTime) < 4.0);
        echo json_encode([
            'frame' => $rooms[$roomId]['lastFrame'] ?? null,
            'frameTime' => $frameTime,
            'isFresh' => $isFresh
        ]);
        break;

    case 'reset':
        unset($rooms[$roomId]);
        echo json_encode(['status' => 'room-reset']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        break;
}

// Save room state
file_put_contents($stateFile, json_encode($rooms));
