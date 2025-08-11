# AgriCare – Crop Disease Assistant 🌱

Modern, responsive web app to detect crop diseases from images using Google Gemini Vision, then generate and download a PDF report. Built with Node.js + Express and a clean, mobile-first UI.

Repo: [kapayashwanth/agricare](https://github.com/kapayashwanth/agricare)

## Features

- Drag-and-drop image upload with instant preview
- AI analysis via Gemini 1.5 (Vision)
- Organized results cards: Disease, Medicines/Treatments, Description, Causes
- PDF report generation and automatic download
- Secure server-side storage for uploaded images and PDF reports
- Mobile-friendly, green agricultural theme with loading indicator
- Accepts JPG/JPEG/PNG up to 10MB

## Quick Start

1. Prerequisites

- Node.js 18+ (22+ recommended)
- A Gemini API key from Google AI Studio (free tier available)

2. Environment
   Create a `.env` file in the project root with:

```
GEMINI_API_KEY=your_api_key_here
PORT=3000
```

Get an API key: https://aistudio.google.com/app/apikey

3. Install & Run

```
npm install
npm run dev
```

Open http://localhost:3000

## How It Works

- Upload a crop image (JPG/PNG). Preview appears immediately.
- Click Analyze. The image is sent to the server and forwarded to Gemini Vision.
- The AI returns:
  - disease: string
  - medicines: string[]
  - description: string
  - causes: string[]
- Results are displayed in neatly labeled sections.
- Click Download Analysis to generate a PDF; it will also be saved on the server (or Netlify Blobs when deployed on Netlify).

## API

- POST `/api/analyze`
  - Local dev (Express): multipart form-data `image` (file)
  - Netlify: JSON `{ imageDataUrl, mimeType, originalName }`
- POST `/api/save-report`
  - JSON: `{ pdfDataUrl, baseName, analysis, imageFilename }`
- GET `/health` (local only)

## Storage

- Local: `uploads/`, `reports/`, `reports/meta/`
- Netlify: Blobs storage under paths `uploads/`, `reports/`, `meta/`

## Deploy to Netlify

- This repo includes `netlify.toml` and two functions:
  - `netlify/functions/analyze.js`
  - `netlify/functions/save-report.js`
- Set environment variables in Netlify dashboard:
  - `GEMINI_API_KEY`
- Build settings:
  - Build command: `npm install`
  - Publish directory: `public`
  - Functions directory: `netlify/functions`
- After deploy, the frontend automatically uses Netlify Functions and Blobs.

## Security Notes

- File uploads are restricted by type/size locally; on Netlify we accept base64 JSON and validate mime type.
- For production, use HTTPS and private storage (e.g., S3 or Netlify Blobs with access controls).
- Keep `GEMINI_API_KEY` secret.

## Project Structure

```
public/
  index.html
  styles.css
  script.js
netlify/
  functions/
    analyze.js
    save-report.js
server.js
package.json
netlify.toml
```

## Publish to GitHub

If this repo is empty on GitHub, push the local project:

```bash
git init
git branch -M main
git add .
git commit -m "feat: initial AgriCare app"
git remote add origin https://github.com/kapayashwanth/agricare.git
git push -u origin main
```

## License

MIT
