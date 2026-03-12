# VivacityAI Studio

A unified AI creative platform combining three powerful tools into a single, cohesive experience.

![VivacityAI Studio](https://img.shields.io/badge/VivacityAI-Studio-blueviolet?style=for-the-badge)

## 🚀 Tools

### 🎨 AI Canvas
Visual AI workspace — create, connect, and explore ideas on an infinite canvas with AI-powered chat, image generation (DALL-E 3), image analysis (GPT-4 Vision), and text analysis.

### 🎴 Éventail AI  
AI card generator — generate beautiful fan cards with AI-powered creativity. Features chat-based card design, image generation, and a gallery of all generated cards.

### 🌐 Web Agency Pipeline
AI web builder — generate complete, deployable web projects through a 5-stage AI pipeline (Strategist → Frontend → Backend + SEO → Validator).

## ✨ Features

- **Unified Dashboard** — one place to launch and manage all tools
- **Shared Authentication** — Google OAuth 2.0 login across all tools
- **Shared User Data** — user files, configurations, and API keys shared between tools
- **Consistent UI** — dark theme with gradient accents, responsive design
- **Zero Dependencies** — pure vanilla HTML/CSS/JS + PHP backend

## 📁 Project Structure

```
vivacity-ai-studio/
├── index.html              # Main dashboard
├── config.php              # Shared configuration (API keys, OAuth)
├── auth.php                # Google OAuth authentication
├── api.php                 # Unified API endpoint
├── .gitignore
├── tools/
│   ├── canvas/             # AI Canvas tool
│   │   ├── index.html
│   │   ├── script.js
│   │   └── style.css
│   ├── eventail/           # Éventail AI tool
│   │   └── index.html
│   └── pipeline/           # Web Agency Pipeline tool
│       ├── index.html
│       └── prompts.json
└── data/                   # User data (auto-created, gitignored)
    └── user_{google_id}/
        ├── config.json
        ├── canvas/
        ├── images/
        └── generations/
```

## 🛠 Setup

### Prerequisites
- PHP 7.4+ with cURL extension
- Apache or Nginx with PHP support
- Google Cloud OAuth 2.0 credentials
- OpenAI API key

### Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/MisterCoder74/vivacity-ai-studio.git
   cd vivacity-ai-studio
   ```

2. **Configure credentials**
   ```bash
   cp config.php.example config.php
   # Edit config.php with your Google OAuth and OpenAI credentials
   ```

3. **Set up Google OAuth**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create OAuth 2.0 credentials
   - Set redirect URI to `https://yourdomain.com/auth.php?action=callback`
   - Add Client ID and Secret to `config.php`

4. **Deploy**
   ```bash
   # Point your web server to the project root
   # Ensure data/ directory is writable
   chmod 755 data/
   ```

5. **Set API key**
   - Log in via Google
   - Open Settings from the dashboard
   - Enter your OpenAI API key

## 🔒 Security

- API keys stored server-side per user (not exposed to browser)
- Google OAuth 2.0 for authentication
- Session-based authorization for all API calls
- User data isolated by Google ID
- Config file gitignored to prevent credential leaks

## 🎨 Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Backend**: PHP 7.4+
- **Auth**: Google OAuth 2.0
- **AI APIs**: OpenAI (GPT-4, DALL-E 3, GPT-4 Vision)
- **No frameworks, no dependencies, no build tools**

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 👨‍💻 Author

**Alessandro Demontis** — [Vivacity Design](https://www.vivacitydesign.net/)

*"Knowledge is a tool, not a constraint."*
