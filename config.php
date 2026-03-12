<?php
/**
 * SHARED CONFIGURATION FILE
 *
 * Central place for all constants used across the VivacityAI Studio platform.
 */

/* -------------------------------------------------------------------------
 * Google OAuth configuration
 * ------------------------------------------------------------------------- */
define('GOOGLE_CLIENT_ID',     'YOUR_GOOGLE_CLIENT_ID');
define('GOOGLE_CLIENT_SECRET', 'YOUR_GOOGLE_CLIENT_SECRET');
define('GOOGLE_REDIRECT_URI',  'https://yourdomain.com/auth.php?action=callback');
define('SESSION_NAME',         'vivacity_ai_session');

/* -------------------------------------------------------------------------
 * OpenAI configuration
 * ------------------------------------------------------------------------- */
define('OPENAI_API_KEY', 'YOUR_OPENAI_API_KEY');

/* -------------------------------------------------------------------------
 * File‑system configuration
 * ------------------------------------------------------------------------- */
define('DATA_FOLDER',        __DIR__ . '/data');               // Root data folder
define('UPLOAD_FOLDER',      DATA_FOLDER . '/uploads');        // Generic uploads
define('IMAGE_FOLDER',       DATA_FOLDER . '/images');         // Global images (if needed)
define('MAX_FILE_SIZE',      500 * 1024 * 1024);               // 500 MiB
define('ALLOWED_MIME_TYPES', [
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'text/csv',
    'application/json',
]);

/* -------------------------------------------------------------------------
 * User‑specific paths (all under DATA_FOLDER/user_<GOOGLE_ID>/)
 * ------------------------------------------------------------------------- */
define('USER_BASE_PATH', DATA_FOLDER . '/user_'); // Append Google ID

/* -------------------------------------------------------------------------
 * Miscellaneous
 * ------------------------------------------------------------------------- */
date_default_timezone_set('UTC');
?>