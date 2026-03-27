# WorkBreeze

AI-powered file analysis for small business teams. Upload Excel, CSV, or PDF files and get instant summaries, charts, and reports.

---

## Deploy to Vercel (5 minutes)

### Step 1 — Get your Anthropic API key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Click **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`) — you won't see it again

### Step 2 — Push to GitHub
```bash
# In this folder:
git init
git add .
git commit -m "Initial WorkBreeze deploy"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/workbreeze.git
git push -u origin main
```

### Step 3 — Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import your `workbreeze` repository
4. Click **Deploy** (leave all settings as default)

### Step 4 — Add your API key
1. In your Vercel project dashboard, go to **Settings → Environment Variables**
2. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-...` (your key from Step 1)
3. Click **Save**
4. Go to **Deployments** → click the three dots on your latest deploy → **Redeploy**

Your app is now live at `https://workbreeze-xxx.vercel.app` 🎉

---

## Project Structure

```
workbreeze/
├── api/
│   └── analyze.js      # Serverless function — calls Anthropic API securely
├── public/
│   └── index.html      # Frontend — calls /api/analyze (never Anthropic directly)
├── package.json
├── vercel.json
└── README.md
```

## How it works

```
User uploads file
      ↓
Browser reads file content (Excel/CSV parsed client-side)
      ↓
POST /api/analyze  ← your Vercel serverless function
      ↓
Anthropic API (API key is safe, server-side only)
      ↓
Result returned to browser → displayed + available to download
```

## Rate Limiting

The API route limits each IP to **20 requests per hour** to protect your Anthropic bill. You can adjust this in `api/analyze.js`.

## Local Development

```bash
npm install -g vercel
npm install
vercel dev
```

Then visit `http://localhost:3000`. You'll need a `.env.local` file:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
