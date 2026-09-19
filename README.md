# Levi's YouTube Downloader

A modern YouTube Downloader application with a React + Vite frontend and a Python backend (leveraging `yt-dlp` and `ffmpeg`).

## Architecture

- **Backend** (`app_backend/`): Python service running FastAPI/webview backend to handle media downloads, metadata extraction, format selection, and conversions via `yt-dlp` and `ffmpeg`.
- **Frontend** (`app_frontend/youtube-downloader/`): React, TypeScript, Tailwind CSS, and Vite providing a fast and intuitive UI.

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js & npm
- `yt-dlp` & `ffmpeg` binaries (placed in `app_backend/tools/`)

### Running the Frontend
```bash
cd app_frontend/youtube-downloader
npm install
npm run dev
```

### Running the Backend
```bash
cd app_backend
python backend.py
```
