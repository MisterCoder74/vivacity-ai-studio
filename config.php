<?php
/**
 * SHARED CONFIGURATION FILE
 *
 * Central place for all constants used across the VivacityAI Studio platform.
 */

/* -------------------------------------------------------------------------
 * Session configuration
 * ------------------------------------------------------------------------- */
define('SESSION_NAME', 'vivacity_ai_studio');
define('SESSION_LIFETIME', 2592000); // 30 days

/* -------------------------------------------------------------------------
 * OpenAI configuration
 * ------------------------------------------------------------------------- */
define('OPENAI_API_KEY', 'YOUR_OPENAI_API_KEY');

/* -------------------------------------------------------------------------
 * File‑system configuration
 * ------------------------------------------------------------------------- */
define('DATA_FOLDER', __DIR__ . '/data');               // Root data folder
define('UPLOAD_FOLDER', DATA_FOLDER . '/uploads');        // Generic uploads
define('MAX_FILE_SIZE', 500 * 1024 * 1024);               // 500 MiB
define('USERS_FILE', DATA_FOLDER . '/users.json');

/* -------------------------------------------------------------------------
 * User configuration
 * ------------------------------------------------------------------------- */
define('PASSWORD_MIN_LENGTH', 8);

/* -------------------------------------------------------------------------
 * Helper function to initialize data directory
 * ------------------------------------------------------------------------- */
function initDataDir()
{
    if (!is_dir(DATA_FOLDER)) {
        mkdir(DATA_FOLDER, 0755, true);
    }

    $usersFile = USERS_FILE;
    if (!file_exists($usersFile)) {
        file_put_contents($usersFile, json_encode([], JSON_PRETTY_PRINT));
    }
}

initDataDir();
?>