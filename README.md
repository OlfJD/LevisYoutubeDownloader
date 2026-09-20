<div align="center">

# 🎬 Levi's YouTube Downloader

**A Modern, High-Speed YouTube & Media Downloader with Instant Format Conversion**

[![Download Latest Release](https://img.shields.io/badge/Download-Latest_Release_(Windows)-F43F5E?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/OlfJD/LevisYoutubeDownloader/releases/latest/download/LevisYoutubeDownloader-v1.0.3-win-x64.zip)
[![GitHub Release](https://img.shields.io/github/v/release/OlfJD/LevisYoutubeDownloader?style=for-the-badge&color=10B981)](https://github.com/OlfJD/LevisYoutubeDownloader/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Windows_10_%2F_11-3B82F6?style=for-the-badge&logo=windows)](https://github.com/OlfJD/LevisYoutubeDownloader)

### 📥 [👉 Click Here to Download Levi's YouTube Downloader (.zip)](https://github.com/OlfJD/LevisYoutubeDownloader/releases/latest/download/LevisYoutubeDownloader-v1.0.3-win-x64.zip)

*(Standalone portable Windows application — pre-bundled with download engine & converters)*

</div>

---

## ⚡ Quick Start for Users

1. **[Download Levi's YouTube Downloader (.zip)](https://github.com/OlfJD/LevisYoutubeDownloader/releases/latest/download/LevisYoutubeDownloader-v1.0.3-win-x64.zip)**.
2. **Extract** the ZIP archive.
3. Run **`LevisYoutubeDownloader.exe`**.
4. Paste any YouTube/media URL, pick your desired format (MP4, MP3, etc.) and quality, and click **Download**!
5. Use the in-app **Update Tool** button at any time to automatically fetch core downloader and engine updates.

---

## ✨ Features

- **High-Speed Downloads**: Powered by `yt-dlp` and `ffmpeg` for maximum bandwidth utilization and clean remuxing.
- **Audio & Video Formats**: Support for MP4, MP3, best video/audio streams, custom qualities, and playlist batch downloads.
- **Built-in Auto-Updater**:
  - One-click update check for both the `yt-dlp` core download engine and the GUI application from GitHub releases.
- **Sleek Translucent Dark Interface**: Built with React, Tailwind CSS, and Lucide vector icons.
- **History & Queue**: Track completed downloads and manage your queue in real time.
- **Theme Editor**: Custom styling and accent configurations.

---

## 🛠️ Developer Setup & Architecture

- **Backend** (`app_backend/`): Python webview/FastAPI service managing process lifecycle, downloads, format conversion, and settings.
- **Frontend** (`app_frontend/youtube-downloader/`): React + TypeScript + Tailwind CSS UI running on Vite.

### Running from Source
```bash
# Frontend
cd app_frontend/youtube-downloader
npm install
npm run dev

# Backend
cd app_backend
python backend.py
```
