<?php
/**
 * UNIFIED API ENDPOINT
 *
 * All functional endpoints of the platform are accessed via:
 *   api.php?action=<NAME>
 *
 * Every request first verifies that the user is authenticated.
 * Responses are always JSON (except for the raw image serving endpoint).
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

/* -------------------------------------------------------------------------
 * Ensure the user is logged in – otherwise return a JSON error.
 * ------------------------------------------------------------------------- */
start_vivacity_session();
if (!isset($_SESSION['user']) || $_SESSION['user']['logged_in'] !== true) {
    echo json_encode(['success' => false, 'error' => 'Non autenticato'], JSON_PRETTY_PRINT);
    exit;
}

/* -------------------------------------------------------------------------
 * Helper: build absolute path to a per‑user resource.
 * ------------------------------------------------------------------------- */
function user_path(string $subPath): string
{
    $googleId = $_SESSION['user']['google_id'];
    return USER_BASE_PATH . $googleId . '/' . ltrim($subPath, '/');
}

/* -------------------------------------------------------------------------
 * Helper: send a JSON response and terminate.
 * ------------------------------------------------------------------------- */
function json_response(array $payload, int $httpCode = 200): void
{
    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo json_encode($payload, JSON_PRETTY_PRINT);
    exit;
}

/* -------------------------------------------------------------------------
 * Main router
 * ------------------------------------------------------------------------- */
$action = $_GET['action'] ?? '';

switch ($action) {
    /* -----------------------------------------------------------------
     * 1️⃣ Chatbot – AI Canvas
     * ----------------------------------------------------------------- */
    case 'chat':
        $data = json_decode(file_get_contents('php://input'), true);
        $apiKey   = $data['apiKey']   ?? '';
        $messages = $data['messages'] ?? [];

        if (empty($apiKey) || empty($messages) || !is_array($messages)) {
            json_response(['success' => false, 'error' => 'Parametri mancanti'], 400);
        }

        $payload = [
            'model'       => 'gpt-4o-mini',
            'messages'    => $messages,
            'temperature' => 0.7,
            'max_tokens'  => 2000,
        ];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $response   = curl_exec($ch);
        $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpStatus === 200) {
            $result = json_decode($response, true);
            $content = $result['choices'][0]['message']['content'] ?? '';
            json_response(['success' => true, 'response' => $content]);
        } else {
            $err = json_decode($response, true);
            $msg = $err['error']['message'] ?? 'Errore API';
            json_response(['success' => false, 'error' => $msg], $httpStatus);
        }
        break;

    /* -----------------------------------------------------------------
     * 2️⃣ Image Generation – DALL·E 3 (AI Canvas)
     * ----------------------------------------------------------------- */
    case 'image_gen':
        $data   = json_decode(file_get_contents('php://input'), true);
        $apiKey = $data['apiKey'] ?? '';
        $prompt = $data['prompt'] ?? '';
        $size   = $data['size']   ?? '1024x1024';

        if (empty($apiKey) || empty($prompt)) {
            json_response(['success' => false, 'error' => 'Parametri mancanti'], 400);
        }

        $payload = [
            'model'  => 'dall-e-3',
            'prompt' => $prompt,
            'n'      => 1,
            'size'   => $size,
            'quality'=> 'standard',
        ];

        $ch = curl_init('https://api.openai.com/v1/images/generations');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $response   = curl_exec($ch);
        $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpStatus !== 200) {
            $err = json_decode($response, true);
            $msg = $err['error']['message'] ?? 'Errore API';
            json_response(['success' => false, 'error' => $msg], $httpStatus);
        }

        $result = json_decode($response, true);
        $imageUrl = $result['data'][0]['url'] ?? '';

        // Download the image and store it under the user’s image folder
        $imageData = @file_get_contents($imageUrl);
        if ($imageData === false) {
            json_response(['success' => false, 'error' => 'Impossibile scaricare l’immagine'], 500);
        }

        $userImgDir = user_path('images');
        if (!is_dir($userImgDir)) {
            mkdir($userImgDir, 0755, true);
        }

        $filename = 'img_' . time() . '_' . bin2hex(random_bytes(4)) . '.png';
        $fullPath = $userImgDir . '/' . $filename;
        file_put_contents($fullPath, $imageData);

        // Return the *relative* path that can be later fetched via get_image
        $relativePath = 'data/user_' . $_SESSION['user']['google_id'] . '/images/' . $filename;
        json_response([
            'success'   => true,
            'imageUrl'  => $relativePath,
            'filename'  => $filename,
        ]);
        break;

    /* -----------------------------------------------------------------
     * 3️⃣ Image Analysis – Vision (AI Canvas)
     * ----------------------------------------------------------------- */
    case 'image_analyze':
        $data   = json_decode(file_get_contents('php://input'), true);
        $apiKey = $data['apiKey']    ?? '';
        $image  = $data['imageData'] ?? '';
        $prompt = $data['prompt']    ?? '';

        if (empty($apiKey) || empty($image) || empty($prompt)) {
            json_response(['success' => false, 'error' => 'Parametri mancanti'], 400);
        }

        $payload = [
            'model' => 'gpt-4o-mini',
            'messages' => [
                [
                    'role'    => 'user',
                    'content' => [
                        ['type' => 'text', 'text' => $prompt],
                        [
                            'type' => 'image_url',
                            'image_url' => ['url' => $image],
                        ],
                    ],
                ],
            ],
            'max_tokens' => 1000,
        ];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $response   = curl_exec($ch);
        $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpStatus !== 200) {
            $err = json_decode($response, true);
            $msg = $err['error']['message'] ?? 'Errore API';
            json_response(['success' => false, 'error' => $msg], $httpStatus);
        }

        $result = json_decode($response, true);
        $analysis = $result['choices'][0]['message']['content'] ?? '';
        json_response(['success' => true, 'analysis' => $analysis]);
        break;

    /* -----------------------------------------------------------------
     * 4️⃣ Text Analysis – Code / Document (AI Canvas)
     * ----------------------------------------------------------------- */
    case 'text_analyze':
        $data = json_decode(file_get_contents('php://input'), true);
        $apiKey      = $data['apiKey']      ?? '';
        $fileContent = $data['fileContent'] ?? '';
        $fileName    = $data['fileName']    ?? 'file.txt';
        $prompt      = $data['prompt']      ?? '';

        if (empty($apiKey) || empty($fileContent) || empty($prompt)) {
            json_response(['success' => false, 'error' => 'Parametri mancanti'], 400);
        }

        // Infer file type for better prompting
        $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        $typeMap = [
            'py'   => 'Python',
            'php'  => 'PHP',
            'js'   => 'JavaScript',
            'html' => 'HTML',
            'css'  => 'CSS',
            'cpp'  => 'C++',
            'c'    => 'C',
            'h'    => 'C/C++ Header',
            'json' => 'JSON',
            'xml'  => 'XML',
            'sql'  => 'SQL',
            'sh'   => 'Shell Script',
            'bat'  => 'Batch Script',
            'md'   => 'Markdown',
            'txt'  => 'Plain Text',
        ];
        $fileType = $typeMap[$ext] ?? 'Unknown';

        $systemMessage = "Sei un esperto analista di codice e testi. Analizza accuratamente il contenuto fornito e rispondi in modo dettagliato e professionale. Segnala errori, bug o problemi e suggerisci miglioramenti con spiegazioni.";

        $userMessage = "File: {$fileName}\nTipo: {$fileType}\n\nContenuto:\n\n{$fileContent}\n\n\nRichiesta: {$prompt}";

        $payload = [
            'model' => 'gpt-4o-mini',
            'messages' => [
                ['role' => 'system', 'content' => $systemMessage],
                ['role' => 'user',   'content' => $userMessage],
            ],
            'temperature' => 0.7,
            'max_tokens'  => 2500,
        ];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $response   = curl_exec($ch);
        $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpStatus !== 200) {
            $err = json_decode($response, true);
            $msg = $err['error']['message'] ?? 'Errore API';
            json_response(['success' => false, 'error' => $msg], $httpStatus);
        }

        $result = json_decode($response, true);
        $analysis = $result['choices'][0]['message']['content'] ?? '';
        json_response(['success' => true, 'analysis' => $analysis]);
        break;

    /* -----------------------------------------------------------------
     * 5️⃣ User Data – Canvas, Config, History, Undo/Redo (AI Canvas)
     * ----------------------------------------------------------------- */
    case 'user_data':
        $type = $_GET['type'] ?? '';
        $validTypes = ['config', 'canvas', 'history', 'undo'];

        if (!in_array($type, $validTypes)) {
            json_response(['success' => false, 'error' => 'Tipo non valido'], 400);
        }

        $filePath = user_path($type . '/' . $type . '.json');

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (!file_exists($filePath)) {
                // Initialise empty default
                $default = $type === 'config' ? ['apiKey' => ''] : [];
                file_put_contents($filePath, json_encode($default, JSON_PRETTY_PRINT));
            }
            $data = json_decode(file_get_contents($filePath), true);
            json_response(['success' => true, 'data' => $data]);
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $payload = json_decode(file_get_contents('php://input'), true);
            if (!isset($payload['data'])) {
                json_response(['success' => false, 'error' => 'Dati mancanti'], 400);
            }
            $saved = file_put_contents($filePath, json_encode($payload['data'], JSON_PRETTY_PRINT));
            if ($saved === false) {
                json_response(['success' => false, 'error' => 'Errore nel salvataggio'], 500);
            }
            json_response(['success' => true, 'message' => 'Dati salvati']);
        }

        json_response(['success' => false, 'error' => 'Metodo non supportato'], 405);
        break;

    /* -----------------------------------------------------------------
     * 6️⃣ Serve User Images (raw binary output)
     * ----------------------------------------------------------------- */
    case 'get_image':
        $path = $_GET['path'] ?? '';
        if (empty($path)) {
            json_response(['success' => false, 'error' => 'Parametro path mancante'], 400);
        }

        // Security: ensure the requested path is inside the user folder
        $allowedPrefix = 'data/user_' . $_SESSION['user']['google_id'] . '/';
        if (strpos($path, $allowedPrefix) !== 0) {
            json_response(['success' => false, 'error' => 'Accesso non autorizzato'], 403);
        }

        $fullPath = __DIR__ . '/' . $path;
        if (!file_exists($fullPath) || !is_file($fullPath)) {
            json_response(['success' => false, 'error' => 'File non trovato'], 404);
        }

        $mime = finfo_file(finfo_open(FILEINFO_MIME_TYPE), $fullPath);
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($fullPath));
        readfile($fullPath);
        exit;

    /* -----------------------------------------------------------------
     * 7️⃣ Save Card Image – Éventail AI
     * ----------------------------------------------------------------- */
    case 'save_card_image':
        $payload = json_decode(file_get_contents('php://input'), true);
        $imageData = $payload['imageData'] ?? '';
        $prompt    = $payload['prompt']    ?? '';
        $timestamp = $payload['timestamp'] ?? date('c');

        if (empty($imageData)) {
            json_response(['success' => false, 'error' => 'Nessun dato immagine ricevuto'], 400);
        }

        $decoded = base64_decode($imageData);
        if ($decoded === false) {
            json_response(['success' => false, 'error' => 'Base64 non valida'], 400);
        }

        $cardImgDir = user_path('cardimages');
        if (!is_dir($cardImgDir)) {
            mkdir($cardImgDir, 0755, true);
        }

        $filename = 'img_' . uniqid() . '.png';
        $filePath = $cardImgDir . '/' . $filename;
        file_put_contents($filePath, $decoded);
        $sizeBytes = filesize($filePath);

        // Save metadata JSON
        $metadata = [
            'filename'    => $filename,
            'timestamp'   => $timestamp,
            'prompt'      => $prompt,
            'size_bytes'  => $sizeBytes,
            'size_human'  => format_bytes($sizeBytes),
        ];
        $metaPath =

function handleGetGenerations() {
    $userId = $_SESSION['google_id'];
    $dir = DATA_DIR . '/user_' . $userId . '/generations';

    if (!is_dir($dir)) {
        echo json_encode(['success' => true, 'generations' => []]);
        return;
    }

    $files = glob($dir . '/*.{jpg,jpeg,png,gif,webp}', GLOB_BRACE);
    $generations = [];
    foreach ($files as $file) {
        $generations[] = [
            'filename' => basename($file),
            'url' => 'data/user_' . $userId . '/generations/' . basename($file),
            'size' => filesize($file),
            'created' => filemtime($file)
        ];
    }

    usort($generations, function($a, $b) { return $b['created'] - $a['created']; });
    echo json_encode(['success' => true, 'generations' => $generations]);
}

}