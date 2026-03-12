<?php
/**
 * AUTHENTICATION HANDLER
 *
 * Provides a single entry‑point for all authentication‑related actions:
 *   - login (default)
 *   - callback (Google OAuth 2.0)
 *   - check   (session verification, JSON response)
 *   - logout  (session termination)
 *
 * All user data is stored under DATA_FOLDER/user_<GOOGLE_ID>/.
 */

require_once __DIR__ . '/config.php';

/* -------------------------------------------------------------------------
 * Helper: start a named session
 * ------------------------------------------------------------------------- */
function start_vivacity_session()
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_set_cookie_params(86400 * 7); // 7 days
        session_start();
    }
}

/* -------------------------------------------------------------------------
 * Google OAuth 2.0 – login redirect
 * ------------------------------------------------------------------------- */
function google_login()
{
    $state = bin2hex(random_bytes(16));
    start_vivacity_session();
    $_SESSION['oauth_state'] = $state;

    $params = [
        'client_id'     => GOOGLE_CLIENT_ID,
        'redirect_uri'  => GOOGLE_REDIRECT_URI,
        'response_type' => 'code',
        'scope'         => 'email profile',
        'state'         => $state,
        'access_type'   => 'online',
        'prompt'        => 'select_account',
    ];

    $authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);
    header('Location: ' . $authUrl);
    exit;
}

/* -------------------------------------------------------------------------
 * Google OAuth 2.0 – callback handling
 * ------------------------------------------------------------------------- */
function google_callback()
{
    // Verify state token (CSRF protection)
    start_vivacity_session();
    $savedState = $_SESSION['oauth_state'] ?? '';
    if (!isset($_GET['state']) || $_GET['state'] !== $savedState) {
        die('Errore: token di stato non valido.');
    }

    if (!isset($_GET['code'])) {
        die('Errore: codice di autorizzazione mancante.');
    }

    $code = $_GET['code'];

    // Exchange code for access token
    $tokenUrl = 'https://oauth2.googleapis.com/token';
    $tokenPayload = [
        'code'          => $code,
        'client_id'     => GOOGLE_CLIENT_ID,
        'client_secret' => GOOGLE_CLIENT_SECRET,
        'redirect_uri'  => GOOGLE_REDIRECT_URI,
        'grant_type'    => 'authorization_code',
    ];

    $ch = curl_init($tokenUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($tokenPayload));
    $tokenResponse = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        die('Errore nel recupero del token: ' . $tokenResponse);
    }

    $tokenData = json_decode($tokenResponse, true);
    $accessToken = $tokenData['access_token'] ?? '';

    // Retrieve user profile
    $profileUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
    $ch = curl_init($profileUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $accessToken]);
    $profileResponse = curl_exec($ch);
    curl_close($ch);

    $profile = json_decode($profileResponse, true);
    if (empty($profile['id'])) {
        die('Impossibile recuperare le informazioni utente da Google.');
    }

    // -----------------------------------------------------------------
    // Persist user data (users.json) and create per‑user folder
    // -----------------------------------------------------------------
    $googleId = $profile['id'];
    $email    = $profile['email'];
    $name     = $profile['name'] ?? '';
    $picture  = $profile['picture'] ?? '';

    // Ensure DATA_FOLDER exists
    if (!is_dir(DATA_FOLDER)) {
        mkdir(DATA_FOLDER, 0755, true);
    }

    $usersFile = DATA_FOLDER . '/users.json';
    $users = file_exists($usersFile) ? json_decode(file_get_contents($usersFile), true) : [];

    // Update or insert user entry
    $found = false;
    foreach ($users as &$u) {
        if ($u['google_id'] === $googleId) {
            $u['email']      = $email;
            $u['name']       = $name;
            $u['picture']    = $picture;
            $u['last_login'] = date('Y-m-d H:i:s');
            $found = true;
            break;
        }
    }
    if (!$found) {
        $users[] = [
            'google_id'  => $googleId,
            'email'      => $email,
            'name'       => $name,
            'picture'    => $picture,
            'created_at' => date('Y-m-d H:i:s'),
            'last_login' => date('Y-m-d H:i:s'),
        ];
    }
    file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT));

    // Create per‑user folder structure if it does not exist
    $userBase = USER_BASE_PATH . $googleId;
    $folders  = [
        $userBase,
        $userBase . '/uploads',
        $userBase . '/images',
        $userBase . '/cardimages',
        $userBase . '/canvas',
        $userBase . '/history',
        $userBase . '/config',
    ];
    foreach ($folders as $f) {
        if (!is_dir($f)) {
            mkdir($f, 0755, true);
        }
    }

    // Initialise default JSON files (if missing)
    $defaults = [
        $userBase . '/config/config.json'   => ['apiKey' => ''],
        $userBase . '/canvas/canvas.json'   => ['cards' => [], 'connections' => []],
        $userBase . '/history/history.json' => [],
        $userBase . '/uploads/undo.json'    => ['undoStack' => [], 'redoStack' => []],
    ];
    foreach ($defaults as $path => $data) {
        if (!file_exists($path)) {
            file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT));
        }
    }

    // -----------------------------------------------------------------
    // Create session
    // -----------------------------------------------------------------
    start_vivacity_session();
    $_SESSION['user'] = [
        'google_id' => $googleId,
        'email'     => $email,
        'name'      => $name,
        'picture'   => $picture,
        'logged_in' => true,
    ];

    // Redirect to the main UI
    header('Location: dashboard.html');
    exit;
}

/* -------------------------------------------------------------------------
 * Session verification (JSON)
 * ------------------------------------------------------------------------- */
function session_check_endpoint()
{
    start_vivacity_session();
    if (isset($_SESSION['user']) && $_SESSION['user']['logged_in'] === true) {
        echo json_encode([
            'authenticated' => true,
            'user' => [
                'google_id' => $_SESSION['user']['google_id'],
                'email'     => $_SESSION['user']['email'],
                'name'      => $_SESSION['user']['name'],
                'picture'   => $_SESSION['user']['picture'],
            ],
        ], JSON_PRETTY_PRINT);
    } else {
        echo json_encode(['authenticated' => false], JSON_PRETTY_PRINT);
    }
}

/* -------------------------------------------------------------------------
 * Logout
 * ------------------------------------------------------------------------- */
function logout()
{
    start_vivacity_session();
    $_SESSION = [];

    if (isset($_COOKIE[SESSION_NAME])) {
        setcookie(SESSION_NAME, '', time() - 3600, '/');
    }

    session_destroy();
    header('Location: index.html');
    exit;
}

/* -------------------------------------------------------------------------
 * Router
 * ------------------------------------------------------------------------- */
$action = $_GET['action'] ?? 'login';

switch ($action) {
    case 'login':
        google_login();
        break;
    case 'callback':
        google_callback();
        break;
    case 'check':
        session_check_endpoint();
        break;
    case 'logout':
        logout();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Azione non valida'], JSON_PRETTY_PRINT);
        break;
}
?>