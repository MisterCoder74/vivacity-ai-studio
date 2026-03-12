<?php
/**
 * AUTHENTICATION HANDLER
 *
 * Provides a single entry‑point for all authentication‑related actions:
 *   - signup (create new user)
 *   - login  (authenticate existing user)
 *   - check   (session verification, JSON response)
 *   - logout  (session termination)
 *   - update_profile (update user profile)
 */

require_once __DIR__ . '/config.php';

/* -------------------------------------------------------------------------
 * Helper: start a named session
 * ------------------------------------------------------------------------- */
function start_vivacity_session()
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_set_cookie_params(SESSION_LIFETIME);
        session_start();
    }
}

/* -------------------------------------------------------------------------
 * Helper: generate user object for session / response
 * ------------------------------------------------------------------------- */
function generate_user_object($user_id, $name, $email)
{
    return [
        'user_id' => $user_id,
        'name'    => $name,
        'email'   => $email,
    ];
}

/* -------------------------------------------------------------------------
 * Signup endpoint
 * ------------------------------------------------------------------------- */
function signup_endpoint()
{
    $data = json_decode(file_get_contents('php://input'), true);
    if (!isset($data['name'], $data['email'], $data['password'], $data['password_confirm'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields'], JSON_PRETTY_PRINT);
        return;
    }

    $name            = trim($data['name']);
    $email           = trim(strtolower($data['email']));
    $password        = $data['password'];
    $password_confirm = $data['password_confirm'];

    if ($name === '' || $email === '' || $password === '' || $password_confirm === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Fields cannot be empty'], JSON_PRETTY_PRINT);
        return;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email format'], JSON_PRETTY_PRINT);
        return;
    }

    if (strlen($password) < PASSWORD_MIN_LENGTH) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least ' . PASSWORD_MIN_LENGTH . ' characters'], JSON_PRETTY_PRINT);
        return;
    }

    if ($password !== $password_confirm) {
        http_response_code(400);
        echo json_encode(['error' => 'Passwords do not match'], JSON_PRETTY_PRINT);
        return;
    }

    $usersFile = USERS_FILE;
    $users = json_decode(file_get_contents($usersFile), true);

    foreach ($users as $u) {
        if ($u['email'] === $email) {
            http_response_code(400);
            echo json_encode(['error' => 'Email already exists'], JSON_PRETTY_PRINT);
            return;
        }
    }

    $user_id = uniqid('usr_', true);
    $hashed_password = password_hash($password, PASSWORD_BCRYPT);

    $new_user = [
        'user_id'    => $user_id,
        'name'       => $name,
        'email'      => $email,
        'password'   => $hashed_password,
        'created_at' => date('Y-m-d H:i:s'),
        'last_login' => date('Y-m-d H:i:s'),
    ];

    $users[] = $new_user;

    $fp = fopen($usersFile, 'w');
    flock($fp, LOCK_EX);
    fwrite($fp, json_encode($users, JSON_PRETTY_PRINT));
    flock($fp, LOCK_UN);
    fclose($fp);

    // Create per‑user folder structure
    $userBase = DATA_FOLDER . '/user_' . $user_id;
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

    // Initialise default JSON files
    $defaults = [
        $userBase . '/config/config.json'   => ['apiKey' => ''],
        $userBase . '/canvas/canvas.json'   => ['cards' => [], 'connections' => []],
        $userBase . '/history/history.json' => [],
        $userBase . '/uploads/undo.json'    => ['undoStack' => [], 'redoStack' => []],
    ];
    foreach ($defaults as $path => $content) {
        if (!file_exists($path)) {
            file_put_contents($path, json_encode($content, JSON_PRETTY_PRINT));
        }
    }

    session_regenerate_id(true);
    start_vivacity_session();
    $_SESSION['user'] = generate_user_object($user_id, $name, $email);

    header('Content-Type: application/json');
    echo json_encode([
        'authenticated' => true,
        'user' => $_SESSION['user'],
    ], JSON_PRETTY_PRINT);
}

/* -------------------------------------------------------------------------
 * Login endpoint
 * ------------------------------------------------------------------------- */
function login_endpoint()
{
    $data = json_decode(file_get_contents('php://input'), true);
    if (!isset($data['email'], $data['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields'], JSON_PRETTY_PRINT);
        return;
    }

    $email    = trim(strtolower($data['email']));
    $password = $data['password'];

    $usersFile = USERS_FILE;
    $users = json_decode(file_get_contents($usersFile), true);

    foreach ($users as &$user) {
        if ($user['email'] === $email) {
            if (password_verify($password, $user['password'])) {
                $user['last_login'] = date('Y-m-d H:i:s');

                $fp = fopen($usersFile, 'w');
                flock($fp, LOCK_EX);
                fwrite($fp, json_encode($users, JSON_PRETTY_PRINT));
                flock($fp, LOCK_UN);
                fclose($fp);

                session_regenerate_id(true);
                start_vivacity_session();
                $_SESSION['user'] = generate_user_object($user['user_id'], $user['name'], $email);

                header('Content-Type: application/json');
                echo json_encode([
                    'authenticated' => true,
                    'user' => $_SESSION['user'],
                ], JSON_PRETTY_PRINT);
                return;
            } else {
                http_response_code(401);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Invalid credentials'], JSON_PRETTY_PRINT);
                return;
            }
        }
    }

    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid credentials'], JSON_PRETTY_PRINT);
}

/* -------------------------------------------------------------------------
 * Session verification endpoint
 * ------------------------------------------------------------------------- */
function session_check_endpoint()
{
    start_vivacity_session();
    header('Content-Type: application/json');
    if (isset($_SESSION['user'])) {
        echo json_encode([
            'authenticated' => true,
            'user' => $_SESSION['user'],
        ], JSON_PRETTY_PRINT);
    } else {
        echo json_encode(['authenticated' => false], JSON_PRETTY_PRINT);
    }
}

/* -------------------------------------------------------------------------
 * Logout endpoint
 * ------------------------------------------------------------------------- */
function logout_endpoint()
{
    start_vivacity_session();
    $_SESSION = [];

    if (isset($_COOKIE[SESSION_NAME])) {
        setcookie(SESSION_NAME, '', time() - 3600, '/');
    }

    session_destroy();
    header('Content-Type: application/json');
    echo json_encode(['success' => true], JSON_PRETTY_PRINT);
}

/* -------------------------------------------------------------------------
 * Update profile endpoint
 * ------------------------------------------------------------------------- */
function update_profile_endpoint()
{
    start_vivacity_session();
    if (!isset($_SESSION['user'])) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Unauthorized'], JSON_PRETTY_PRINT);
        return;
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $user_id = $_SESSION['user']['user_id'];
    $usersFile = USERS_FILE;
    $users = json_decode(file_get_contents($usersFile), true);

    foreach ($users as &$user) {
        if ($user['user_id'] === $user_id) {
            if (isset($data['name'])) {
                $user['name'] = trim($data['name']);
            }

            if (isset($data['current_password'], $data['new_password'])) {
                $current_password = $data['current_password'];
                $new_password = $data['new_password'];

                if (!password_verify($current_password, $user['password'])) {
                    http_response_code(401);
                    header('Content-Type: application/json');
                    echo json_encode(['error' => 'Invalid current password'], JSON_PRETTY_PRINT);
                    return;
                }

                if (strlen($new_password) < PASSWORD_MIN_LENGTH) {
                    http_response_code(400);
                    header('Content-Type: application/json');
                    echo json_encode(['error' => 'Password must be at least ' . PASSWORD_MIN_LENGTH . ' characters'], JSON_PRETTY_PRINT);
                    return;
                }

                $user['password'] = password_hash($new_password, PASSWORD_BCRYPT);
            }

            $fp = fopen($usersFile, 'w');
            flock($fp, LOCK_EX);
            fwrite($fp, json_encode($users, JSON_PRETTY_PRINT));
            flock($fp, LOCK_UN);
            fclose($fp);

            $_SESSION['user'] = generate_user_object($user_id, $user['name'], $user['email']);

            header('Content-Type: application/json');
            echo json_encode(['success' => true], JSON_PRETTY_PRINT);
            return;
        }
    }

    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'User not found'], JSON_PRETTY_PRINT);
}

/* -------------------------------------------------------------------------
 * Router
 * ------------------------------------------------------------------------- */
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'signup':
        signup_endpoint();
        break;
    case 'login':
        login_endpoint();
        break;
    case 'check':
        session_check_endpoint();
        break;
    case 'logout':
        logout_endpoint();
        break;
    case 'update_profile':
        update_profile_endpoint();
        break;
    default:
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid action'], JSON_PRETTY_PRINT);
        break;
}
?>