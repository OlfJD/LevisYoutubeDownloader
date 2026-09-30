# Levi's YouTube Downloader - Developer Log & Technical Specification

## Project Overview
**Levi's YouTube Downloader** is a modern, high-performance media downloader and converter for Windows. It features a sleek translucent Obsidian/Dark Glass UI (built with React 19, Tailwind CSS, and Lucide vector icons) running inside a native Windows webview powered by a multi-threaded Python backend with `yt-dlp` and `ffmpeg`.

---

## Architecture & Subsystems

1. **Backend Subsystem (`app_backend/backend.py`)**:
   - **Engine Orchestration**:
     - Automatically manages and bundles `yt-dlp.exe`, `ffmpeg.exe`, and `ffprobe.exe`.
     - Extracts and persists tools in `%APPDATA%\LeviDownloader\tools\`.
     - Automatically synchronizes YouTube authentication cookies from `youtube.com_cookies.txt` in the user's Downloads folder.
   - **Process & Download Management**:
     - Executes `yt-dlp` commands with realtime stdout streaming to `/api/logs`.
     - Supports MP4 (Best, 1080p, 720p, 480p with thumbnail and metadata embedding), MP3 (320kbps extraction with thumbnail and tags), and high-fidelity WAV format.
     - Supports batch playlist downloading and custom destination folders.
   - **Dual Startup Update Engine**:
     - Background daemon thread automatically scans for updates on launch.
     - Checks `yt-dlp` core engine against upstream (`yt-dlp/yt-dlp/releases/latest`).
     - Checks Levi's YouTube Downloader UI against GitHub releases (`OlfJD/LevisYoutubeDownloader/releases/latest`).
     - Exposes `/api/check_updates` for reactive frontend notifications.
     - Provides `/api/update` to execute `yt-dlp -U` and refresh update state in real time.

2. **Frontend Subsystem (`app_frontend/youtube-downloader/`)**:
   - Built with **React 19**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Motion** (Framer Motion).
   - Real-time download progress bar and active queue monitor.
   - Intelligent playlist detection modal popup when playlist URLs are pasted.
   - In-app notification popup and glowing button badge when updates are available.
   - Theme customization and download history management.

---

## 📌 Semantic Versioning Policy (SemVer Standard)

All future releases and updates for this project **MUST** adhere to the **Semantic Versioning (`MAJOR.MINOR.PATCH`)** standard:

```
  v [MAJOR] . [MINOR] . [PATCH]
      │         │         │
      │         │         └── PATCH : Bug fixes, hotfixes, UI tweaks
      │         └─────────── MINOR : New features, new format support, settings
      └───────────────────── MAJOR : Major redesigns, breaking architecture changes
```

### Release Workflow Rules for Future Updates:

1. **Bump Version String**:
   - Always update `CURRENT_VERSION = "vX.Y.Z"` in [`app_backend/backend.py`](file:///c:/Users/Levi/Documents/Code/Levi's%20YoutubeDownloader/app_backend/backend.py#L33).
2. **Build Frontend**:
   - Run `npm run build` in `app_frontend/youtube-downloader/`.
   - Copy `app_frontend/youtube-downloader/dist/*` to `app_backend/dist/`.
3. **Compile Standalone Executable**:
   - Run `pyinstaller LevisYoutubeDownloader.spec --noconfirm` in `app_backend/`.
   - Copy `app_backend/dist/LevisYoutubeDownloader.exe` to `release/LevisYoutubeDownloader.exe`.
4. **Package & Publish Release**:
   - Create ZIP archive `LevisYoutubeDownloader-vX.Y.Z-win-x64.zip` containing `LevisYoutubeDownloader.exe`.
   - Publish to GitHub using GitHub CLI:
     ```bash
     gh release create vX.Y.Z "LevisYoutubeDownloader-vX.Y.Z-win-x64.zip" --title "vX.Y.Z" --notes "Release description" -R OlfJD/LevisYoutubeDownloader
     ```
5. **Update Documentation**:
   - Document changes in this `DEVLOG.md` under Release History.
   - Ensure `README.md` download links point to the latest release assets.

---

## 📜 Release History & Changelog

### **v1.1.0-dev** (2026-09-30) - *The Master Media Engine, Live Stream DVR & Spatial Studio Update*
- **3-Screen Spatial Navigation Architecture**:
  - **Left Screen: 🔵 Live Stream DVR Studio (`#3B82F6` Sapphire Blue)**:
    - Dedicated live broadcast recorder for YouTube Live and Twitch streams.
    - Full `--live-from-start` rewind DVR buffer support: record broadcasts from beginning even if joining mid-stream.
    - Live Telemetry HUD with real-time duration counter, live MB size counter, stream waveform visualizer, and 1-click `■ Stop & Finalize MP4`.
  - **Center Screen: 🎬 Universal Media Downloader (`#FF0033` Rose / Emerald / Obsidian)**:
    - Classic 3-button layout with symmetrical left (`DVR 🔴`) and right (`GIF ⚡`) glide arrows.
  - **Right Screen: ⚡ Advanced GIF Machine (`#F59E0B` Amber Yellow)**:
    - High-fidelity 2-pass palettegen GIF studio with boomerang, meme text banners, and multi-speed controls.
- **Turbo 16x Multi-Thread Acceleration (`aria2c`) with Auto-Fallback**:
  - Pre-bundled static 64-bit `aria2c.exe` in `tools/` with `--downloader aria2c --downloader-args "aria2c:-x 16 -s 16 -k 1M -j 16"`.
  - Bypasses per-connection server throttling for 5x–10x faster downloads on 4K/1080p60 media.
  - Transparent error recovery: if a host blocks multi-part requests, the engine automatically retries with native `yt-dlp` without failing.
- **Smart Chapter / Album Splitter**:
  - Automatically detects YouTube tracklists/chapters and organizes full concert/album videos into clean folders with individual numbered MP3/FLAC tracks (`--split-chapters`) with tags and embedded album art.
- **Local Wi-Fi Quick Share (Instant QR Code to Phone)**:
  - 1-click "📱 Share" action on any completed download in History or Queue.
  - Generates instant high-contrast QR code via `qrcode` for camera scanning over LAN (`http://<ip>:54321/api/download_file/<filename>`), downloading directly to mobile without cables.
- **Smart-Blur Background Margin Filters (Aspect Ratio Padding)**:
  - Added `16:9 (Smart Blur Background)` and `9:16 (Smart Blur Background)` in GIF & Video studio using two-pass FFmpeg boxblur padding filter graphs.
- **Smart Clipboard Link Auto-Detector**:
  - Real-time clipboard watcher displaying an animated floating glass pill when media links (YouTube, Twitch, TikTok, Twitter/X) are copied to Windows clipboard.
- **Obsidian Glass Custom Dropdowns**:
  - Replaced standard white Windows OS `<select>` / `<option>` menus with custom tactile dark Obsidian Glass dropdown components (`CustomDropdown.tsx`).
  - Added support for keyboard accessibility, smooth framer-motion micro-animations, custom badge chips, and click-outside dismissal.
- **Universal Downloader Power Settings**:
  - SponsorBlock integration, 1-click browser cookie synchronization (Chrome, Firefox, Brave, Edge, Opera, Vivaldi), video codec selector, and metadata embedding.

### **v1.0.5** (2026-09-29)
- **UI & Aesthetics**: Replaced standard white Windows OS `<select>` / `<option>` dropdown menus with custom tactile dark Obsidian Glass dropdown components (`CustomDropdown.tsx`).
- **Interaction**: Added smooth animations, keyboard navigation, and responsive dropdown popovers matching the application's dark aesthetic.

### **v1.0.4** (2026-09-21)
- **Fix**: Resolved false persistent "Update Available" notification on the Update Tool button by updating bundled `yt-dlp` core binary to the latest release (`2026.08.19`).
- **Fix**: Upgraded version comparison algorithm with zero-padded numeric segment comparisons to prevent false update alerts across version representations.
- **Engine**: Enhanced `initialize_assets()` to automatically upgrade local `%APPDATA%` tools when a newer bundled version is present.
- **Frontend**: Explicitly synchronized initial update check states to ensure clean initial button and notification rendering.

### **v1.0.3** (2026-09-20)
- **Release**: Published version update to verify and test the in-app update notification modal, reactive status endpoints, and badge workflows.
- **Engine**: Refreshed bundled web assets and distribution packages.

### **v1.0.2** (2026-09-19)
- **Fix**: Resolved persistent "Update Available" badge by adding auto-reset state callback when `UpdateView` completes.
- **Fix**: Synchronized `api_update()` to refresh `cached_update_info` prior to logging completion.
- **Spec**: Added `DEVLOG.md` documenting architecture, technical specifications, and SemVer release policy.

### **v1.0.1** (2026-09-19)
- **Feature**: Added dual-engine startup update scanning for `yt-dlp` core engine and application GitHub releases.
- **Feature**: Added top-right animated update notification card with 1-click update trigger.
- **Feature**: Added pulsing amber accent badge to the main "Update Tool" button.
- **Fix**: Corrected GitHub repository update endpoint to `OlfJD/LevisYoutubeDownloader`.

### **v1.0.0** (2026-09-19)
- **Initial Public Release**:
  - Full YouTube audio/video downloading engine with `yt-dlp` and `ffmpeg`.
  - Translucent Obsidian dark UI with React and Tailwind CSS.
  - Playlist batch support, custom filename pre-naming, and download history tracking.
