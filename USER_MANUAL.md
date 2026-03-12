# VivacityAI Studio — User Manual  

---

## 🚀 Getting Started  

1. **Log in** – Click **“Sign in with Google”** on the landing page and authenticate with your Google account.  
2. **Dashboard overview** – After login you’ll see the main dashboard:  
   - **Three tool cards** (AI Canvas, Éventail AI, Web Agency Pipeline) each with a **Launch** button.  
   - **User info** in the top‑right corner (avatar, name, Google ID).  
   - **Settings icon** (gear) for API key and other preferences.  
3. **Set up your OpenAI API key**  
   - Open the **Settings** panel (gear icon).  
   - Paste your OpenAI API key into the **“OpenAI API Key”** field.  
   - Click **Save**. The key is stored securely on the server and will be used by all tools.  

---

## 📊 The Dashboard  

| Element | What it does |
|---------|--------------|
| **Tool cards** | Click **Launch** to open the selected tool in a new page. |
| **User profile** (top‑right) | Shows your name & avatar; click to view profile details or logout. |
| **Settings panel** (gear) | Configure your OpenAI API key, change password, or clear stored data. |
| **Logout** | Ends your session and returns you to the Google sign‑in screen. |

You can always return to the dashboard via the **Home** button in any tool.  

---

## 🎨 Tool 1: AI Canvas  

### What it does  
An infinite visual workspace where you can create “cards”, connect them, and tap into AI for chat, image generation, image analysis, and text analysis.  

### Core workflow  

1. **Create a card** – Click anywhere on the canvas, type your content, press **Enter**.  
2. **Connect cards** – Hover a card, drag from a connection point to another card to draw a link.  
3. **AI Chat** – Open the **Chat** sidebar, type a question or prompt; the AI replies as a new card placed on the canvas.  
4. **Image Generation** – In the **Image** tab, describe the picture you need; DALL‑E 3 returns an image that appears as a card.  
5. **Image Analysis** – Upload or paste an image, select **Analyze**; GPT‑4 Vision returns a description/analysis as a card.  
6. **Text Analysis** – Paste any text, click **Analyze**; the AI summarizes, extracts keywords, or provides sentiment as a new card.  
7. **Saving / Loading** – Click the **Save** icon to store the current canvas (saved per user). Use **Load** to retrieve any of your saved canvases.  

### Tips & tricks  

- **Use colors & tags** on cards to visually group ideas.  
- **Zoom & pan** with mouse wheel / two‑finger gestures for large canvases.  
- **Batch AI requests**: write a list of prompts in one card, then select “Run all” to generate multiple cards quickly.  

---

## 🎴 Tool 2: Éventail AI  

### What it does  
A dedicated AI‑powered fan‑card generator that helps you design, visualize, and export beautiful fan cards.  

### How to use  

1. **Start a design** – In the chat box, describe the card you want (theme, style, text).  
2. **Iterate** – The AI replies with a draft; refine by replying with adjustments (e.g., “make the background darker”).  
3. **Image generation** – Once satisfied, click **Generate Artwork**; DALL‑E 3 creates the card image.  
4. **Gallery** – All generated cards appear in the **Gallery** tab; click a thumbnail to view, edit, or delete.  
5. **Download / Share** – Use the **Download** button to save as PNG/JPEG or copy a shareable link.  

### Quick pointers  

- Keep prompts concise for faster generation.  
- Use the **Style** presets (e.g., “retro”, “minimalist”) to guide the AI.  

---

## 🌐 Tool 3: Web Agency Pipeline  

### What it does  
An end‑to‑end AI web builder that creates a complete, deployable website through a five‑stage pipeline.  

### The 5 stages (simplified)  

| Stage | Role | Output |
|-------|------|--------|
| **1️⃣ Strategist** | Analyzes your brief, defines site goals, sitemap, and tech stack. | Project plan (JSON). |
| **2️⃣ Frontend Developer** | Generates HTML, CSS, and client‑side JavaScript based on the plan. | Frontend files. |
| **3️⃣ Backend Developer** | Writes server‑side code (PHP) and sets up APIs; runs **in parallel** with SEO. | Backend files. |
| **4️⃣ SEO Specialist** | Optimizes meta tags, headings, and content for search engines; also runs **in parallel** with Backend. | SEO config. |
| **5️⃣ Validator** | Reviews all generated assets, runs sanity checks, and bundles the final project. | Deployable zip folder. |

### Using the pipeline  

1. **Enter project description** – Provide a concise brief (e.g., “Portfolio site for a photographer, dark theme, contact form”).  
2. **Click **Generate** – The pipeline runs automatically, showing a progress bar for each stage.  
3. **Live preview** – As soon as the Frontend stage finishes, a **Preview** button appears to view the site in real time.  
4. **Activity log** – A scrollable log details what each AI agent is doing (useful for debugging).  
5. **Download** – When the Validator finishes, click **Download Project** to get a zip file ready for deployment.  

### Handy notes  

- You can **pause** after any stage to edit the generated output before proceeding.  
- The pipeline respects the **OpenAI token limits**; very large briefs may be split automatically.  

---

## 🔗 Shared Features  

- **Single sign‑on** – One Google login gives access to all three tools.  
- **Shared file storage** – Images, canvas files, and generated website assets are stored under `data/user_{google_id}/` and are accessible from any tool.  
- **Consistent navigation** – A persistent **Home** button returns you to the dashboard from anywhere.  

---

## 🛠 Troubleshooting  

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| **API key not working** | Wrong or expired key | Open **Settings**, re‑enter a valid OpenAI API key, save. |
| **Login failed** | Stale session or blocked cookies | Clear browser cookies, reload, and sign in again. |
| **Generation failed** | Insufficient OpenAI quota or overly long prompt | Check your OpenAI usage, shorten the prompt, retry. |
| **Page not loading** | Network issue or server error | Verify internet connection, refresh the page, or check server logs if self‑hosting. |

---

## ❓ FAQ  

- **Is VivacityAI Studio free?**  
  The platform itself is free to use, but you pay for OpenAI API usage (tokens).  

- **What AI models are used?**  
  - **GPT‑4** for chat & text analysis  
  - **DALL‑E 3** for image generation  
  - **GPT‑4 Vision** for image analysis  

- **Is my data safe?**  
  Yes. All user data is stored server‑side in a folder isolated by your Google ID and is never shared with other users.  

- **Can I use generated content commercially?**  
  Yes, provided you comply with OpenAI’s usage policy and any applicable licensing for third‑party assets.  

---  

*Enjoy creating with VivacityAI Studio!*