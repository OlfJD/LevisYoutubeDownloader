/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, X, PenLine, FolderOpen, RefreshCcw, Square, 
  ChevronRight, ChevronLeft, Film, Sparkles, HardDrive, 
  History, Scissors, Volume2, Check, Video, Play, Sliders,
  Repeat, Crop, Type, Globe, Shield, Download, Cookie, CheckCircle2,
  AlertCircle, Copy, Trash2, Smartphone, Radio, Zap, ListPlus,
  Layers, QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import CustomDropdown, { DropdownOption } from './CustomDropdown';

// Native Drag-friendly Title Bar for Borderless Frame
function CustomTitleBar({ theme }: { theme: any }) {
  const handleMinimize = () => {
    fetch('/api/minimize', { method: 'POST' }).catch(() => {});
  };
  const handleClose = () => {
    fetch('/api/close', { method: 'POST' }).catch(() => {});
  };

  return (
    <div
      className="w-full h-10 flex items-center justify-between pl-6 pr-2 select-none relative z-[100] pywebview-drag"
      style={{ backgroundColor: 'rgba(0,0,0,0.18)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold tracking-wider uppercase opacity-40" style={{ color: theme.textSecondary }}>
          Levi's Media Downloader Pro · Live DVR & GIF Studio
        </span>
      </div>
      <div className="flex items-center gap-1">
        {/* Minimize Button */}
        <button 
          onClick={handleMinimize}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10 active:scale-95"
          style={{ color: theme.textMain }}
          title="Minimize"
        >
          <span className="text-lg leading-none -mt-0.5">—</span>
        </button>
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-600/90 active:scale-95 hover:text-white"
          style={{ color: theme.textMain }}
          title="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// LOCAL WI-FI SHARE MODAL (QR CODE TO PHONE)
// -------------------------------------------------------------
function ShareModal({ 
  file, 
  onClose, 
  theme 
}: { 
  file: { filename: string; shareUrl: string; ip: string; port: number }; 
  onClose: () => void; 
  theme: any 
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(file.shareUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error("QR Code generation error:", err));
  }, [file.shareUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(file.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-md px-4 pointer-events-auto"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="w-full max-w-[460px] p-7 rounded-[32px] border border-white/10 shadow-2xl flex flex-col items-center gap-5 relative overflow-hidden"
        style={{ backgroundColor: theme.panelOuter, color: theme.textMain }}
      >
        <button 
          onClick={onClose} 
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 text-blue-400 font-bold tracking-wide uppercase text-xs">
          <Smartphone size={16} />
          <span>Local Wi-Fi Quick Share</span>
        </div>

        <div className="text-center px-4">
          <h3 className="text-lg font-bold text-white truncate max-w-[360px]">{file.filename}</h3>
          <p className="text-xs text-gray-400 mt-1">Scan with your iPhone or Android camera on the same Wi-Fi network to save directly to your phone.</p>
        </div>

        <div className="p-3.5 bg-white rounded-2xl shadow-2xl flex items-center justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-[200px] h-[200px] rounded-lg" />
          ) : (
            <div className="w-[200px] h-[200px] flex items-center justify-center text-black font-semibold text-xs">Generating QR...</div>
          )}
        </div>

        <div className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs text-white/80">
          <span className="truncate flex-1 font-mono text-[11px] opacity-75">{file.shareUrl}</span>
          <button 
            onClick={handleCopy} 
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-all shrink-0 text-xs shadow-md"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// -------------------------------------------------------------
// MAIN APP ROOT
// -------------------------------------------------------------
export default function App() {
  const [activeView, setActiveView] = useState<'main' | 'gif_machine' | 'live_dvr' | 'settings' | 'log' | 'update' | 'prename'>('main');
  const [activeSection, setActiveSection] = useState<'downloader' | 'gif' | 'live_dvr'>('downloader');
  
  const [url, setUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  
  // Downloader Settings State
  const [playlistMode, setPlaylistMode] = useState(false);
  const [showPlaylistPopup, setShowPlaylistPopup] = useState(false);
  const [quality, setQuality] = useState('Best');
  const [sponsorBlock, setSponsorBlock] = useState(false);
  const [browserCookies, setBrowserCookies] = useState('none');
  const [embedMetadata, setEmbedMetadata] = useState(true);
  const [videoCodec, setVideoCodec] = useState('auto');
  const [maxFileSize, setMaxFileSize] = useState('none');
  const [turboMode, setTurboMode] = useState(true);
  const [splitChapters, setSplitChapters] = useState(false);
  const [clipboardMonitor, setClipboardMonitor] = useState(true);

  // Update Status State
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    update_available: boolean;
    ytdlp_update: boolean;
    ytdlp_current: string;
    ytdlp_latest: string;
    app_update: boolean;
    app_current: string;
    app_latest: string;
    app_release_url: string;
    message: string;
  } | null>(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(true);
  
  const [historyItems, setHistoryItems] = useState<{date: string, filename: string, type?: string}[]>([]);

  // GIF Machine Settings State
  const [gifFps, setGifFps] = useState('original');
  const [gifScale, setGifScale] = useState('original');
  const [gifDither, setGifDither] = useState('bayer');
  const [gifAudioLoop, setGifAudioLoop] = useState(false);
  const [gifBoomerang, setGifBoomerang] = useState(false);
  const [gifCrop, setGifCrop] = useState('none');
  const [gifSpeed, setGifSpeed] = useState('1.0');
  const [gifMemeTop, setGifMemeTop] = useState('');
  const [gifMemeBottom, setGifMemeBottom] = useState('');
  const [gifMaxFileSize, setGifMaxFileSize] = useState('none');

  // Wi-Fi Share Modal State
  const [shareModalFile, setShareModalFile] = useState<{ filename: string; shareUrl: string; ip: string; port: number } | null>(null);

  // Smart Clipboard Monitor State
  const [clipboardToastUrl, setClipboardToastUrl] = useState<string | null>(null);
  const [dismissedClipboardUrl, setDismissedClipboardUrl] = useState<string | null>(null);

  // Pull real history items
  const fetchHistory = () => {
    fetch('/api/history').then(r=>r.json()).then(d => setHistoryItems(d || [])).catch(e=>{});
  };

  useEffect(() => { fetchHistory(); }, []);

  // Trigger Share Modal for a file
  const handleOpenShareModal = async (filename: string) => {
    try {
      const res = await fetch(`/api/share_info?filename=${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (data && data.shareUrl) {
        setShareModalFile(data);
      }
    } catch(e) {
      console.error("Share info error:", e);
    }
  };

  // Smart Clipboard Monitor Loop
  useEffect(() => {
    if (!clipboardMonitor) return;

    const checkClipboard = async () => {
      try {
        if (document.hasFocus()) {
          const text = await navigator.clipboard.readText();
          if (text && typeof text === 'string') {
            const clean = text.trim();
            const isMediaUrl = /https?:\/\/(www\.)?(youtube\.com|youtu\.be|tiktok\.com|twitter\.com|x\.com|twitch\.tv|instagram\.com|reddit\.com)/i.test(clean);
            if (isMediaUrl && clean !== url && clean !== dismissedClipboardUrl) {
              setClipboardToastUrl(clean);
            }
          }
        }
      } catch (e) {
        // Ignored if clipboard permissions are restricted
      }
    };

    window.addEventListener('focus', checkClipboard);
    const interval = setInterval(checkClipboard, 3000);
    return () => {
      window.removeEventListener('focus', checkClipboard);
      clearInterval(interval);
    };
  }, [clipboardMonitor, url, dismissedClipboardUrl]);

  // Automatic Background Startup Update Check
  const checkUpdates = async (force: boolean = false) => {
    try {
      const res = await fetch(`/api/check_updates${force ? '?force=true' : ''}`);
      const data = await res.json();
      if (data && data.checked) {
        setUpdateInfo(data);
        setUpdateAvailable(Boolean(data.update_available));
        if (data.update_available) {
          setShowUpdatePopup(true);
        } else {
          setShowUpdatePopup(false);
        }
      }
    } catch (e) {
      console.log("Update check error:", e);
    }
  };

  useEffect(() => {
    let attempts = 0;
    const initialCheck = async () => {
      try {
        const res = await fetch('/api/check_updates');
        const data = await res.json();
        if (data && data.checked) {
          setUpdateInfo(data);
          setUpdateAvailable(Boolean(data.update_available));
          if (data.update_available) {
            setShowUpdatePopup(true);
          } else {
            setShowUpdatePopup(false);
          }
        } else if (attempts < 5) {
          attempts++;
          setTimeout(initialCheck, 1500);
        }
      } catch (e) {
        if (attempts < 5) {
          attempts++;
          setTimeout(initialCheck, 2000);
        }
      }
    };
    initialCheck();
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.quality) setQuality(d.quality);
        if (d.playlistMode !== undefined) setPlaylistMode(d.playlistMode);
        if (d.gifFps) setGifFps(d.gifFps);
        if (d.gifScale) setGifScale(d.gifScale);
        if (d.gifDither) setGifDither(d.gifDither);
        if (d.gifAudioLoop !== undefined) setGifAudioLoop(d.gifAudioLoop);
        if (d.sponsorBlock !== undefined) setSponsorBlock(d.sponsorBlock);
        if (d.browserCookies) setBrowserCookies(d.browserCookies);
        if (d.embedMetadata !== undefined) setEmbedMetadata(d.embedMetadata);
        if (d.videoCodec) setVideoCodec(d.videoCodec);
        if (d.gifMaxFileSize) setGifMaxFileSize(d.gifMaxFileSize);
        if (d.turboMode !== undefined) setTurboMode(d.turboMode);
        if (d.splitChapters !== undefined) setSplitChapters(d.splitChapters);
        if (d.clipboardMonitor !== undefined) setClipboardMonitor(d.clipboardMonitor);
      })
      .catch(() => {});
  }, []);

  const saveSettings = (updated: any) => {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(() => {});
  };

  const handleQualityChange = (q: string) => { setQuality(q); saveSettings({ quality: q }); };
  const handlePlaylistModeChange = (p: boolean) => { setPlaylistMode(p); saveSettings({ playlistMode: p }); };
  const handleGifFpsChange = (f: string) => { setGifFps(f); saveSettings({ gifFps: f }); };
  const handleGifScaleChange = (s: string) => { setGifScale(s); saveSettings({ gifScale: s }); };
  const handleGifDitherChange = (d: string) => { setGifDither(d); saveSettings({ gifDither: d }); };
  const handleGifAudioLoopChange = (a: boolean) => { setGifAudioLoop(a); saveSettings({ gifAudioLoop: a }); };
  const handleSponsorBlockChange = (sb: boolean) => { setSponsorBlock(sb); saveSettings({ sponsorBlock: sb }); };
  const handleBrowserCookiesChange = (b: string) => { setBrowserCookies(b); saveSettings({ browserCookies: b }); };
  const handleEmbedMetadataChange = (m: boolean) => { setEmbedMetadata(m); saveSettings({ embedMetadata: m }); };
  const handleVideoCodecChange = (vc: string) => { setVideoCodec(vc); saveSettings({ videoCodec: vc }); };
  const handleGifMaxFileSizeChange = (m: string) => { setGifMaxFileSize(m); saveSettings({ gifMaxFileSize: m }); };
  const handleTurboModeChange = (t: boolean) => { setTurboMode(t); saveSettings({ turboMode: t }); };
  const handleSplitChaptersChange = (sc: boolean) => { setSplitChapters(sc); saveSettings({ splitChapters: sc }); };
  const handleClipboardMonitorChange = (cm: boolean) => { setClipboardMonitor(cm); saveSettings({ clipboardMonitor: cm }); };

  // View switches (3-Screen Glide Navigation)
  const handleSwitchToLiveDvr = () => {
    setActiveSection('live_dvr');
    setActiveView('live_dvr');
  };

  const handleSwitchToGif = () => {
    setActiveSection('gif');
    setActiveView('gif_machine');
  };

  const handleSwitchToMain = () => {
    setActiveSection('downloader');
    setActiveView('main');
  };

  // Start Real Universal Download
  const startRealDownload = async (format: string) => {
    if (!url || isDownloading) return;
    setIsDownloading(true);
    setDownloadError(false);

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: url, 
          format: format, 
          quality: quality, 
          customName: customName,
          playlistMode: playlistMode,
          sponsorBlock: sponsorBlock,
          browserCookies: browserCookies,
          embedMetadata: embedMetadata,
          videoCodec: videoCodec,
          maxFileSize: maxFileSize,
          turboMode: turboMode,
          splitChapters: splitChapters
        })
      });
      const data = await response.json();
      if (!data.success) {
        setDownloadError(true);
        setIsDownloading(false);
      }
    } catch (error) {
      setDownloadError(true);
      setIsDownloading(false);
    }
  };

  const changeDownloadFolder = async () => {
    try {
      await fetch('/api/change_folder', { method: 'POST' });
    } catch (error) {}
  };

  const handleUpdate = async () => {
    setActiveView('update');
    try {
      await fetch('/api/update', { method: 'POST' });
    } catch (error) {}
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (newUrl.includes('list=') && !playlistMode) {
      setShowPlaylistPopup(true);
    }
  };

  const theme = {
    bg: '#212128',
    textMain: '#D9D9D9',
    textSecondary: '#D9D9D9',
    accent: '#FF0033',
    gifAccent: '#F59E0B',
    liveAccent: '#3B82F6',
    inputBg: '#e2e2e8',
    inputText: '#222222',
    btnLightBg: '#e2e2e8',
    btnLightBorder: '#c0c0c6',
    btnLightText: '#2c2d33',
    btnDarkBg: '#2a2b36',
    btnDarkBorder: '#1b1c23',
    btnDarkText: '#D9D9D9',
    panelOuter: '#292a34',
    panelInner: '#202128',
    settingsBtnBg: '#292a33',
  };

  const isGifActive = activeView === 'gif_machine' || (activeSection === 'gif' && ['settings', 'log'].includes(activeView));
  const isLiveActive = activeView === 'live_dvr' || (activeSection === 'live_dvr' && ['settings', 'log'].includes(activeView));

  return (
    <div 
      className="min-h-screen flex flex-col justify-between font-sans overflow-hidden relative select-none"
      style={{ backgroundColor: theme.bg, color: theme.textMain }}
    >
      {/* Seamless Custom Header */}
      <CustomTitleBar theme={theme} />

      {/* Floating Smart Clipboard Toast */}
      <AnimatePresence>
        {clipboardToastUrl && activeView === 'main' && (
          <motion.div
            initial={{ y: -30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0, scale: 0.95 }}
            className="absolute top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-full border border-rose-500/30 shadow-2xl backdrop-blur-2xl bg-black/80 text-white text-xs font-medium"
          >
            <Sparkles size={15} className="text-rose-400 shrink-0 animate-pulse" />
            <span className="truncate max-w-[280px]">Link in Clipboard: <strong className="text-rose-300">{clipboardToastUrl}</strong></span>
            <button
              onClick={() => {
                setUrl(clipboardToastUrl);
                setClipboardToastUrl(null);
              }}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full font-bold transition-all shrink-0 text-xs shadow-md"
            >
              Paste Link
            </button>
            <button
              onClick={() => {
                setDismissedClipboardUrl(clipboardToastUrl);
                setClipboardToastUrl(null);
              }}
              className="p-1 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col items-center justify-between pt-4 pb-20 relative">
        
        {/* Dynamic Glowing Title */}
        <div className="relative mb-0 mt-2 flex flex-col items-center">
          <h1 
            className="text-[58px] font-medium tracking-tight mb-1 select-none relative backdrop-blur-[2px] border py-1.5 px-10 rounded-3xl mix-blend-screen text-center transition-all duration-300"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 20px rgba(0,0,0,0.2)'
            }}
          >
            {isLiveActive ? (
              <>
                <span style={{ color: theme.textSecondary, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Live Stream </span>
                <span style={{ color: theme.liveAccent, textShadow: `0 2px 14px ${theme.liveAccent}aa` }}>DVR</span>
                <span style={{ color: theme.textSecondary, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}> & Recorder</span>
              </>
            ) : isGifActive ? (
              <>
                <span style={{ color: theme.textSecondary, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Advanced </span>
                <span style={{ color: theme.gifAccent, textShadow: `0 2px 14px ${theme.gifAccent}aa` }}>GIF</span>
                <span style={{ color: theme.textSecondary, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}> Machine</span>
              </>
            ) : (
              <>
                <span style={{ color: theme.textSecondary, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Media </span>
                <span style={{ color: theme.accent, textShadow: `0 2px 10px ${theme.accent}88` }}>& Video</span>
                <span style={{ color: theme.textSecondary, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}> Downloader</span>
              </>
            )}
          </h1>
        </div>

        {/* View Switcher Carousel / Container (Standardized Height for Perfect Alignment) */}
        <div className="flex-1 w-full max-w-5xl flex flex-col items-center px-4 relative mt-2">
          <AnimatePresence mode="wait">
            {activeView === 'main' && (
              <motion.div
                key="main"
                initial={{ opacity: 0, x: -25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -25 }}
                transition={{ duration: 0.18 }}
                className="w-full h-[580px] flex justify-center items-center relative"
              >
                <MainView 
                  url={url} 
                  setUrl={handleUrlChange} 
                  theme={theme} 
                  playlistMode={playlistMode}
                  setActiveView={setActiveView}
                  handleSwitchToGif={handleSwitchToGif}
                  handleSwitchToLiveDvr={handleSwitchToLiveDvr}
                  startRealDownload={startRealDownload}
                  isDownloading={isDownloading}
                  setIsDownloading={setIsDownloading}
                  changeDownloadFolder={changeDownloadFolder}
                  handleUpdate={handleUpdate}
                  setDownloadError={setDownloadError}
                  customName={customName}
                  setCustomName={setCustomName}
                  fetchHistory={fetchHistory}
                  updateAvailable={updateAvailable}
                  updateInfo={updateInfo}
                  showUpdatePopup={showUpdatePopup}
                  setShowUpdatePopup={setShowUpdatePopup}
                  splitChapters={splitChapters}
                  setSplitChapters={handleSplitChaptersChange}
                  onShareFile={handleOpenShareModal}
                />
              </motion.div>
            )}

            {activeView === 'live_dvr' && (
              <motion.div
                key="live_dvr"
                initial={{ opacity: 0, x: -25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -25 }}
                transition={{ duration: 0.18 }}
                className="w-full h-[580px] flex justify-center items-center relative"
              >
                <LiveDvrView
                  theme={theme}
                  setActiveView={setActiveView}
                  handleSwitchToMain={handleSwitchToMain}
                  fetchHistory={fetchHistory}
                  browserCookies={browserCookies}
                  onShareFile={handleOpenShareModal}
                />
              </motion.div>
            )}

            {activeView === 'gif_machine' && (
              <motion.div
                key="gif_machine"
                initial={{ opacity: 0, x: 25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 25 }}
                transition={{ duration: 0.18 }}
                className="w-full h-[580px] flex justify-center items-center relative"
              >
                <AdvancedGifMachineView 
                  theme={theme}
                  setActiveView={setActiveView}
                  handleSwitchToMain={handleSwitchToMain}
                  historyItems={historyItems}
                  fetchHistory={fetchHistory}
                  url={url}
                  setUrl={setUrl}
                  isDownloading={isDownloading}
                  setIsDownloading={setIsDownloading}
                  setDownloadError={setDownloadError}
                  fps={gifFps}
                  setFps={handleGifFpsChange}
                  scale={gifScale}
                  setScale={handleGifScaleChange}
                  dither={gifDither}
                  setDither={handleGifDitherChange}
                  boomerang={gifBoomerang}
                  setBoomerang={setGifBoomerang}
                  crop={gifCrop}
                  setCrop={setGifCrop}
                  speed={gifSpeed}
                  setSpeed={setGifSpeed}
                  memeTop={gifMemeTop}
                  setMemeTop={setGifMemeTop}
                  memeBottom={gifMemeBottom}
                  setMemeBottom={setGifMemeBottom}
                  maxFileSize={gifMaxFileSize}
                  setMaxFileSize={handleGifMaxFileSizeChange}
                  onShareFile={handleOpenShareModal}
                />
              </motion.div>
            )}

            {activeView === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="w-full h-[580px] flex justify-center items-center"
              >
                <SettingsView 
                  theme={theme} 
                  activeSection={activeSection}
                  setActiveView={setActiveView}
                  playlistMode={playlistMode} 
                  setPlaylistMode={handlePlaylistModeChange} 
                  quality={quality}
                  setQuality={handleQualityChange}
                  sponsorBlock={sponsorBlock}
                  setSponsorBlock={handleSponsorBlockChange}
                  browserCookies={browserCookies}
                  setBrowserCookies={handleBrowserCookiesChange}
                  embedMetadata={embedMetadata}
                  setEmbedMetadata={handleEmbedMetadataChange}
                  videoCodec={videoCodec}
                  setVideoCodec={handleVideoCodecChange}
                  turboMode={turboMode}
                  setTurboMode={handleTurboModeChange}
                  splitChapters={splitChapters}
                  setSplitChapters={handleSplitChaptersChange}
                  clipboardMonitor={clipboardMonitor}
                  setClipboardMonitor={handleClipboardMonitorChange}
                  gifFps={gifFps}
                  setGifFps={handleGifFpsChange}
                  gifScale={gifScale}
                  setGifScale={handleGifScaleChange}
                  gifDither={gifDither}
                  setGifDither={handleGifDitherChange}
                  gifAudioLoop={gifAudioLoop}
                  setGifAudioLoop={handleGifAudioLoopChange}
                  gifMaxFileSize={gifMaxFileSize}
                  setGifMaxFileSize={handleGifMaxFileSizeChange}
                  changeDownloadFolder={changeDownloadFolder}
                  historyItems={historyItems}
                  onShareFile={handleOpenShareModal}
                />
              </motion.div>
            )}

            {activeView === 'log' && (
              <motion.div
                key="log"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="w-full h-[580px] flex justify-center items-center"
              >
                <LogView theme={theme} activeSection={activeSection} setActiveView={setActiveView} />
              </motion.div>
            )}

            {activeView === 'update' && (
              <motion.div
                key="update"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="w-full h-[580px] flex justify-center items-center"
              >
                <UpdateView 
                  theme={theme} 
                  setActiveView={setActiveView} 
                  checkUpdates={checkUpdates}
                  setUpdateAvailable={setUpdateAvailable}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Prename Modal */}
        <AnimatePresence>
           {activeView === 'prename' && (
             <PrenameView theme={theme} setActiveView={setActiveView} customName={customName} setCustomName={setCustomName} />
           )}
        </AnimatePresence>

        {/* Wi-Fi Share QR Code Modal */}
        <AnimatePresence>
          {shareModalFile && (
            <ShareModal file={shareModalFile} onClose={() => setShareModalFile(null)} theme={theme} />
          )}
        </AnimatePresence>

        {/* Bottom Navigation Footer (Contextual to active section) */}
        <div className="absolute bottom-6 w-full flex justify-between items-end pointer-events-none px-8 z-30">
          <button 
            onClick={() => setActiveView(activeView === 'settings' ? (activeSection === 'live_dvr' ? 'live_dvr' : activeSection === 'gif' ? 'gif_machine' : 'main') : 'settings')} 
            className="pointer-events-auto rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group border border-white/5 shadow-lg"
            style={{ 
              width: '60px', 
              height: '60px', 
              backgroundColor: activeView === 'settings' ? `${isLiveActive ? theme.liveAccent : isGifActive ? theme.gifAccent : theme.accent}22` : theme.btnDarkBg, 
              color: activeView === 'settings' ? (isLiveActive ? theme.liveAccent : isGifActive ? theme.gifAccent : theme.accent) : theme.btnDarkText, 
              borderColor: activeView === 'settings' ? `${isLiveActive ? theme.liveAccent : isGifActive ? theme.gifAccent : theme.accent}66` : 'rgba(255,255,255,0.05)',
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` 
            }}
            title={activeSection === 'live_dvr' ? "Live DVR Settings" : activeSection === 'gif' ? "GIF Machine Settings" : "Downloader Settings"}
          >
            <Settings strokeWidth={1.5} size={30} style={activeView === 'settings' ? { filter: `drop-shadow(0 2px 8px ${isLiveActive ? theme.liveAccent : isGifActive ? theme.gifAccent : theme.accent}88)` } : {}} />
          </button>

          <button 
            onClick={() => setActiveView(activeView === 'log' ? (activeSection === 'live_dvr' ? 'live_dvr' : activeSection === 'gif' ? 'gif_machine' : 'main') : 'log')} 
            className="pointer-events-auto rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] text-[18px] font-bold border border-white/5 shadow-lg"
            style={{ 
              width: '60px', 
              height: '60px', 
              backgroundColor: activeView === 'log' ? `${isLiveActive ? theme.liveAccent : isGifActive ? theme.gifAccent : theme.accent}22` : theme.btnDarkBg, 
              color: activeView === 'log' ? (isLiveActive ? theme.liveAccent : isGifActive ? theme.gifAccent : theme.accent) : theme.btnDarkText,
              borderColor: activeView === 'log' ? `${isLiveActive ? theme.liveAccent : isGifActive ? theme.gifAccent : theme.accent}66` : 'rgba(255,255,255,0.05)',
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` 
            }}
            title="Open Stream & Process Log"
          >
            LOG
          </button>
        </div>

        {/* Update Available Notification Popup */}
        <AnimatePresence>
          {updateAvailable && showUpdatePopup && activeView === 'main' && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-6 right-6 pointer-events-auto z-50 flex flex-col gap-3 p-5 rounded-3xl border border-amber-500/20 shadow-2xl backdrop-blur-3xl overflow-hidden group max-w-[380px]"
              style={{ backgroundColor: `${theme.panelOuter}f2`, color: theme.textMain, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 12px 36px rgba(0,0,0,0.4)` }}
            >
              <div className="flex items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </div>
                  <span className="font-bold tracking-wide text-lg text-white">Update Available</span>
                </div>
                <button onClick={() => setShowUpdatePopup(false)} className="hover:opacity-100 opacity-60 p-1 transition-opacity bg-white/5 hover:bg-white/10 rounded-full"><X size={18} /></button>
              </div>
              <p className="text-sm font-medium relative z-10 leading-relaxed" style={{ color: theme.textSecondary }}>
                {updateInfo?.message || "A new update is available for yt-dlp engine or Levi's Downloader. Click below to install."}
              </p>
              <button
                 onClick={() => { setShowUpdatePopup(false); handleUpdate(); }}
                 className="mt-2 font-bold py-2.5 px-4 rounded-2xl transition-all active:translate-y-[2px] flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                 style={{ backgroundColor: theme.accent, color: '#ffffff', boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 0 rgba(0,0,0,0.3)` }}
              >
                <RefreshCcw size={16} />
                <span>Update Tool Now</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Download Error Notification Popup */}
        <AnimatePresence>
          {downloadError && activeView === 'main' && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="absolute top-6 left-6 pointer-events-auto z-50 flex flex-col gap-3 p-5 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-3xl overflow-hidden group"
              style={{ backgroundColor: `${theme.panelOuter}e6`, color: theme.textMain, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 10px 30px rgba(0,0,0,0.3)` }}
            >
              <div className="flex items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                  <span className="font-bold tracking-wide text-lg text-white">Download Failed</span>
                </div>
                <button onClick={() => setDownloadError(false)} className="hover:opacity-100 opacity-60 p-1 transition-opacity bg-white/5 hover:bg-white/10 rounded-full"><X size={18} /></button>
              </div>
              <p className="text-sm font-medium relative z-10 w-[240px] leading-relaxed" style={{ color: theme.textSecondary }}>The process encountered an error. Please check the logs or update the tool.</p>
              <button
                 onClick={() => { setDownloadError(false); handleUpdate(); }}
                 className="mt-2 font-bold py-2.5 px-4 rounded-2xl transition-all active:translate-y-[2px]"
                 style={{ backgroundColor: theme.accent, color: theme.inputBg, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 0 rgba(0,0,0,0.3)` }}
              >
                Update Tool
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Playlist Detected Modal */}
        <AnimatePresence>
          {showPlaylistPopup && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 pointer-events-auto"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-[550px] p-8 rounded-[30px] shadow-2xl flex flex-col gap-6 relative"
                style={{ backgroundColor: theme.panelOuter, color: theme.textMain }}
              >
                <button onClick={() => setShowPlaylistPopup(false)} className="absolute top-6 right-6 hover:scale-110 active:scale-95"><X size={32} /></button>
                <h3 className="text-[32px] font-medium text-center mt-2">Playlist Detected</h3>
                <p className="text-[20px] text-center opacity-80 leading-relaxed px-2">You pasted a playlist link, but Playlist Mode is off. Would you like to turn it on to download the entire list?</p>
                <div className="flex flex-col gap-4 mt-4">
                  <button onClick={() => { handlePlaylistModeChange(true); setShowPlaylistPopup(false); }} className="py-4 rounded-xl font-bold text-[22px]" style={{ backgroundColor: theme.accent, color: '#fff', boxShadow: `0 4px 0 #99001b` }}>Turn On & Download All</button>
                  <button onClick={() => setShowPlaylistPopup(false)} className="py-4 rounded-xl font-bold text-[22px] border-[3px]" style={{ borderColor: theme.btnDarkBorder, color: theme.textMain }}>No, just this video</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// ORIGINAL PAGE 1 VIEW: Faithful 100% OG Layout + Dual Left & Right Glide Arrows
// -------------------------------------------------------------
function MainView({ 
  url, setUrl, theme, playlistMode, setActiveView, handleSwitchToGif, handleSwitchToLiveDvr,
  startRealDownload, isDownloading, setIsDownloading, changeDownloadFolder, handleUpdate, 
  setDownloadError, customName, setCustomName, fetchHistory, updateAvailable, updateInfo, 
  showUpdatePopup, setShowUpdatePopup, splitChapters, setSplitChapters, onShareFile
}: any) {
  const [progress, setProgress] = useState(0);
  const [downloadTitle, setDownloadTitle] = useState('Preparing...');

  const handleStopProcess = async () => {
    try { await fetch('/api/stop', { method: 'POST' }); } catch(e){}
    setIsDownloading(false);
  };

  useEffect(() => {
    if (!isDownloading) {
      setProgress(0);
      setDownloadTitle('Preparing...');
      return;
    }

    const interval = setInterval(() => {
      fetch('/api/logs').then(r => r.json()).then(logs => {
        if (!Array.isArray(logs)) return;

        const isDone = logs.some(l => l.includes('Process Finished Successfully!'));
        const isError = logs.some(l => l.includes('CRITICAL ERROR:'));

        if (isDone || isError) {
            setIsDownloading(false);
            if (isError) setDownloadError(true);
            else setCustomName('');
            fetchHistory();
            return;
        }

        const dlLogs = logs.filter(l => typeof l === 'string' && l.includes('[download]') && l.includes('%'));
        if (dlLogs.length > 0) {
          const match = dlLogs[dlLogs.length - 1].match(/(\d+(?:\.\d+)?)%/);
          if (match) setProgress(parseFloat(match[1]));
        }

        const pMatch = logs.find(l => typeof l === 'string' && l.includes('Downloading video '));
        if (pMatch) {
            const m = pMatch.match(/Downloading video (\d+) of (\d+)/);
            if (m) setDownloadTitle(`Video ${m[1]} of ${m[2]}`);
        } else if (!customName) {
            const nameLog = logs.find(l => typeof l === 'string' && l.includes('[download] Destination:'));
            if (nameLog) {
                let file = nameLog.split('Destination: ')[1].split('\\').pop().split('/').pop();
                file = file.replace(/\.f\d+\.(m4a|webm|mp4)$/, '');
                setDownloadTitle(file);
            }
        }
      }).catch(e => {});
    }, 250);

    return () => clearInterval(interval);
  }, [isDownloading, customName]);

  const displayTitle = customName ? `${customName} (Custom)` : downloadTitle;

  return (
    <div className="w-[1050px] h-[580px] flex justify-center items-center relative">
      
      {/* Symmetrical Floating Left Button -> Live Stream DVR (Sapphire Blue #3B82F6) */}
      <div 
        className="absolute -left-16 top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-40" 
        onClick={handleSwitchToLiveDvr}
      >
        <button 
          className="w-12 h-28 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all group-hover:scale-110 active:scale-95 relative overflow-hidden"
          style={{ 
            backgroundColor: theme.btnDarkBg, 
            color: theme.liveAccent,
            border: `1px solid rgba(59, 130, 246, 0.3)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 12px rgba(0,0,0,0.25)` 
          }}
          title="Switch to Live Stream DVR & Broadcast Recorder"
        >
          <ChevronLeft size={28} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" style={{ color: theme.liveAccent, filter: `drop-shadow(0 2px 8px ${theme.liveAccent}88)` }} />
          <span 
            className="text-[10px] font-black uppercase tracking-wider"
            style={{ color: theme.liveAccent, textShadow: `0 2px 10px ${theme.liveAccent}aa` }}
          >
            DVR
          </span>
        </button>
      </div>

      {/* Symmetrical Floating Right Button -> GIF Machine (Amber Yellow #F59E0B) */}
      <div 
        className="absolute -right-16 top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-40" 
        onClick={handleSwitchToGif}
      >
        <button 
          className="w-12 h-28 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all group-hover:scale-110 active:scale-95 relative overflow-hidden"
          style={{ 
            backgroundColor: theme.btnDarkBg, 
            color: theme.gifAccent,
            border: `1px solid rgba(245, 158, 11, 0.25)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 12px rgba(0,0,0,0.25)` 
          }}
          title="Switch to Advanced GIF Machine"
        >
          <ChevronRight size={28} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" style={{ color: theme.gifAccent, filter: `drop-shadow(0 2px 8px ${theme.gifAccent}88)` }} />
          <span 
            className="text-[11px] font-black uppercase tracking-wider"
            style={{ color: theme.gifAccent, textShadow: `0 2px 10px ${theme.gifAccent}aa` }}
          >
            GIF
          </span>
        </button>
      </div>

      <motion.div layout className="w-full max-w-[800px] flex flex-col items-center relative gap-8 my-auto">
        {/* Input Area with Inline Stop Button */}
        <div className="w-full relative flex gap-3 h-[46px] items-center">
          <div className="flex-1 flex h-full rounded-[10px] overflow-hidden p-[2px] shadow-inner relative z-10 transition-all" style={{ backgroundColor: theme.inputBg }}>
            <input 
              type="text" value={url} onChange={(e) => setUrl(e.target.value)} disabled={isDownloading} placeholder="Paste Video Link (YouTube, TikTok, Twitter, Any Site)..." 
              className="flex-1 bg-transparent px-4 py-[3px] outline-none font-medium placeholder:opacity-60 text-[19px] disabled:opacity-50 tracking-wide" style={{ color: theme.inputText }}
            />
            <div className="w-[3px] h-[28px] overflow-hidden rounded-full self-center ml-3 mr-1" style={{ backgroundColor: theme.inputText }}></div>
            <button 
              onClick={() => setUrl('')} disabled={!url || isDownloading}
              className="flex items-center justify-center transition-all hover:opacity-70 active:translate-y-[4px] disabled:opacity-50 mr-2" style={{ color: theme.inputText }}
            ><X size={34} strokeWidth={2.5} /></button>
          </div>

          <AnimatePresence>
            {isDownloading && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 140, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="h-full overflow-hidden shrink-0 rounded-[10px]">
                <button 
                  onClick={handleStopProcess}
                  className="w-full h-full flex items-center justify-center gap-2 font-bold text-white uppercase tracking-widest bg-[#E33] hover:bg-[#ff4444] transition-colors shadow-inner"
                >
                  <Square size={16} fill="currentColor" /> Stop
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Waveform & Video Name */}
        <AnimatePresence initial={false}>
          {isDownloading && (
            <motion.div 
              layout
              initial={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }} 
              animate={{ height: 50, opacity: 1, marginTop: 4, marginBottom: 4 }} 
              exit={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="w-[98%] mx-auto relative flex justify-between items-center px-2 overflow-hidden shrink-0"
            >
              <div className="text-[20px] font-medium flex items-center gap-4 truncate max-w-[80%]" style={{ color: theme.textMain }}>
                <span className="shrink-0">Downloading:</span> 
                <span className="opacity-70 truncate" title={displayTitle}>{displayTitle}</span>
                <span className="font-bold text-[22px] shrink-0 ml-2" style={{ color: theme.accent }}>{Math.round(progress)}%</span>
              </div>
              <div className="flex items-center gap-[4px] h-[36px]">
                  {[...Array(12)].map((_, i) => (
                    <motion.div key={i} className="w-[5px] rounded-full" style={{ backgroundColor: theme.accent }} animate={{ height: ['20%', '100%', '20%'] }} transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, ease: "easeInOut", delay: Math.random() * 0.5 }} />
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ORIGINAL 3 DOWNLOAD BUTTONS (MP3, MP4, WAV) */}
        <motion.div layout className="flex flex-col items-center gap-6">
          <div className="flex gap-8">
            <button onClick={() => startRealDownload('mp3')} disabled={isDownloading} className="disabled:opacity-50 disabled:cursor-not-allowed font-extrabold uppercase tracking-widest text-[22px] py-[14px] px-12 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group" style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText, boxShadow: isDownloading ? 'none' : `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)` }}><span className="relative drop-shadow-md">Download MP3</span></button>
            <button onClick={() => startRealDownload('mp4')} disabled={isDownloading} className="disabled:opacity-50 disabled:cursor-not-allowed font-extrabold uppercase tracking-widest text-[22px] py-[14px] px-12 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group" style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText, boxShadow: isDownloading ? 'none' : `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)` }}><span className="relative drop-shadow-md">Download MP4</span></button>
          </div>
          <button onClick={() => startRealDownload('wav')} disabled={isDownloading} className="disabled:opacity-50 disabled:cursor-not-allowed font-extrabold uppercase tracking-widest text-[22px] py-[14px] px-12 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group" style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText, boxShadow: isDownloading ? 'none' : `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)` }}><span className="relative drop-shadow-md">Download WAV</span></button>
        </motion.div>

        {/* Bottom Action Buttons */}
        <motion.div layout className="mt-16 flex flex-col items-center gap-[18px] w-[800px]">
          <button onClick={() => setActiveView('prename')} className="w-[280px] gap-3 font-bold py-[12px] px-8 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] text-[16px] uppercase tracking-widest whitespace-nowrap relative overflow-hidden group border border-white/5" style={{ backgroundColor: theme.btnDarkBg, color: theme.btnDarkText, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` }}><PenLine size={20} /><span className="relative z-10">Prename File</span></button>
          <div className="flex justify-center gap-[24px]">
            <button onClick={changeDownloadFolder} className="w-[280px] gap-3 font-bold py-[12px] px-8 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] text-[16px] uppercase tracking-widest whitespace-nowrap relative overflow-hidden group border border-white/5" style={{ backgroundColor: theme.btnDarkBg, color: theme.btnDarkText, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` }}><FolderOpen size={20} /><span className="relative z-10">Change Folder</span></button>
            <button onClick={handleUpdate} className="w-[280px] gap-3 font-bold py-[12px] px-8 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] text-[16px] uppercase tracking-widest whitespace-nowrap relative overflow-hidden group border border-white/5" style={{ backgroundColor: updateAvailable ? `${theme.accent}2b` : theme.btnDarkBg, borderColor: updateAvailable ? `${theme.accent}80` : 'rgba(255,255,255,0.05)', color: theme.btnDarkText, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` }}>
              {updateAvailable && (
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
              )}
              <RefreshCcw size={20} className={updateAvailable ? "text-amber-400 animate-spin-slow" : ""} />
              <span className="relative z-10">{updateAvailable ? "Update Available" : "Update Tool"}</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// -------------------------------------------------------------
// LIVE STREAM DVR VIEW: Sapphire Blue #3B82F6 Theme
// Real-time broadcast recording, --live-from-start rewind & HUD telemetry
// -------------------------------------------------------------
function LiveDvrView({ 
  theme, setActiveView, handleSwitchToMain, fetchHistory, browserCookies, onShareFile 
}: any) {
  const [liveUrl, setLiveUrl] = useState('');
  const [liveQuality, setLiveQuality] = useState('Best');
  const [liveFromStart, setLiveFromStart] = useState(true);
  const [customLiveName, setCustomLiveName] = useState('');
  
  const [recordingStatus, setRecordingStatus] = useState<any>({
    is_recording: false,
    duration_sec: 0,
    bytes_downloaded: 0,
    title: ''
  });
  const [isStopping, setIsStopping] = useState(false);

  // Poll live status every second
  useEffect(() => {
    const fetchStatus = () => {
      fetch('/api/live_status')
        .then(r => r.json())
        .then(d => {
          setRecordingStatus(d);
          if (d && !d.is_recording && isStopping) {
            setIsStopping(false);
            fetchHistory();
          }
        })
        .catch(() => {});
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, [isStopping]);

  const handleStartRecording = async () => {
    if (!liveUrl || recordingStatus.is_recording) return;
    try {
      await fetch('/api/record_live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: liveUrl,
          quality: liveQuality,
          liveFromStart: liveFromStart,
          customName: customLiveName,
          browserCookies: browserCookies
        })
      });
    } catch(e) {
      console.error(e);
    }
  };

  const handleStopRecording = async () => {
    setIsStopping(true);
    try {
      await fetch('/api/stop_live', { method: 'POST' });
    } catch(e) {
      console.error(e);
      setIsStopping(false);
    }
  };

  // Format Duration into HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Format Bytes into MB / GB
  const formatBytes = (bytes: number) => {
    if (!bytes) return '0.0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const isRecording = Boolean(recordingStatus?.is_recording);

  return (
    <div className="w-[1050px] h-[580px] rounded-[24px] shadow-2xl p-6 flex gap-6 relative" style={{ backgroundColor: theme.panelOuter }}>
      
      {/* Symmetrical Right Arrow to return to Downloader */}
      <div 
        onClick={handleSwitchToMain}
        className="absolute -right-16 top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-40"
      >
        <button 
          className="w-12 h-28 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all group-hover:scale-110 active:scale-95 relative overflow-hidden"
          style={{ 
            backgroundColor: theme.btnDarkBg, 
            color: theme.liveAccent,
            border: `1px solid rgba(59, 130, 246, 0.3)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 12px rgba(0,0,0,0.25)` 
          }}
          title="Back to Downloader"
        >
          <ChevronRight size={28} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" style={{ color: theme.liveAccent, filter: `drop-shadow(0 2px 8px ${theme.liveAccent}88)` }} />
          <span 
            className="text-[11px] font-black uppercase tracking-wider"
            style={{ color: theme.liveAccent, textShadow: `0 2px 10px ${theme.liveAccent}aa` }}
          >
            MAIN
          </span>
        </button>
      </div>

      {/* Left Panel: Stream Link & DVR Options */}
      <div className="flex-1 rounded-[20px] p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelInner }}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[22px] font-bold text-white flex items-center gap-2">
              <Radio size={22} className="text-blue-400" />
              <span>1. Live Stream Source</span>
            </h2>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Sapphire DVR
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            {/* Live Stream URL Input */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-2">
              <span className="text-xs font-bold text-gray-300">Paste Live Stream URL:</span>
              <input 
                type="text"
                value={liveUrl}
                onChange={e => setLiveUrl(e.target.value)}
                disabled={isRecording}
                placeholder="YouTube Live or Twitch Stream Link..."
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white outline-none disabled:opacity-50"
              />
            </div>

            {/* Rewind & Start From Beginning (DVR Buffer) */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Repeat size={16} className="text-blue-400" />
                  <span>Rewind to Broadcast Start</span>
                </span>
                <span className="text-[11px] text-gray-400">Captures entire live stream from 0:00 (`--live-from-start`)</span>
              </div>
              <button 
                onClick={() => setLiveFromStart(!liveFromStart)}
                disabled={isRecording}
                className="relative flex items-center w-12 h-5 rounded-full transition-colors ml-4 shrink-0 disabled:opacity-50" 
                style={{ backgroundColor: liveFromStart ? theme.liveAccent : '#555' }}
              >
                <div 
                  className="absolute w-7 h-7 rounded-full transition-all shadow-md" 
                  style={{ 
                    backgroundColor: liveFromStart ? theme.inputBg : '#a0a0a8', 
                    left: liveFromStart ? 'auto' : '-3px', 
                    right: liveFromStart ? '-3px' : 'auto' 
                  }} 
                />
              </button>
            </div>

            {/* Custom File Name */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-gray-300">Custom Recording Name (Optional):</span>
              <input 
                type="text"
                value={customLiveName}
                onChange={e => setCustomLiveName(e.target.value)}
                disabled={isRecording}
                placeholder="Leave blank for automatic broadcast title..."
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white outline-none disabled:opacity-50"
              />
            </div>

            {/* Stream Quality Selector */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300">Stream Quality:</span>
              <CustomDropdown 
                value={liveQuality}
                options={[
                  { value: 'Best', label: 'Best (Source Quality)', badge: 'Max' },
                  { value: '1080p', label: '1080p Full HD' },
                  { value: '720p', label: '720p HD' },
                  { value: '480p', label: '480p SD' },
                ]}
                onChange={setLiveQuality}
                theme={theme}
                variant="tactile-light"
                size="sm"
                accentColor={theme.liveAccent}
              />
            </div>
          </div>
        </div>

        <div className="text-xs font-mono opacity-60">
          Target Format: <strong className="text-blue-400 font-bold">MPEG-TS Remuxed MP4</strong>
        </div>
      </div>

      {/* Right Panel: Live HUD Telemetry & Stop / Start Controls */}
      <div className="flex-[1.2] rounded-[20px] p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelInner }}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[22px] font-bold text-white">2. Recording Telemetry HUD</h2>
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-black animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                <span>REC LIVE</span>
              </div>
            )}
          </div>

          {/* Telemetry Display Card */}
          <div className="w-full p-6 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-6 shadow-inner relative overflow-hidden">
            {isRecording ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Elapsed Recording Time:</span>
                    <span className="text-4xl font-mono font-black text-white mt-1">
                      {formatTime(recordingStatus?.duration_sec || 0)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Captured File Size:</span>
                    <span className="text-2xl font-mono font-bold text-blue-400 mt-1">
                      {formatBytes(recordingStatus?.bytes_downloaded || 0)}
                    </span>
                  </div>
                </div>

                {/* Animated Stream Visualizer Wave */}
                <div className="flex items-center justify-between gap-1.5 h-12 py-2">
                  {[...Array(24)].map((_, i) => (
                    <motion.div 
                      key={i} 
                      className="flex-1 rounded-full bg-blue-500" 
                      animate={{ height: ['15%', '100%', '15%'] }} 
                      transition={{ 
                        duration: 0.4 + (i % 5) * 0.15, 
                        repeat: Infinity, 
                        ease: "easeInOut", 
                        delay: (i * 0.05) % 0.4 
                      }} 
                    />
                  ))}
                </div>

                <div className="text-xs text-gray-400 truncate">
                  Stream Output: <span className="font-mono text-white">{recordingStatus?.filename || 'Levi_Live_Stream.mp4'}</span>
                </div>
              </>
            ) : (
              <div className="py-10 flex flex-col items-center justify-center text-center gap-3 text-gray-400">
                <Radio size={48} className="text-blue-500/50" />
                <div className="text-sm font-medium text-gray-300">Ready to Capture Live Stream</div>
                <div className="text-xs text-gray-500 max-w-[320px]">
                  Paste any active YouTube Live or Twitch URL and hit start. Stream segments are continuously stitched into a high-fidelity MP4.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div>
          {isRecording ? (
            <button
              onClick={handleStopRecording}
              disabled={isStopping}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-lg text-white shadow-2xl transition-all active:translate-y-[2px] flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 border border-red-400/40"
              style={{ boxShadow: `0 6px 20px rgba(239,68,68,0.4)` }}
            >
              <Square size={20} fill="currentColor" />
              <span>{isStopping ? 'Finalizing Container...' : 'Stop & Finalize MP4'}</span>
            </button>
          ) : (
            <button
              onClick={handleStartRecording}
              disabled={!liveUrl}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-lg text-white shadow-2xl transition-all active:translate-y-[2px] flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-400/40"
              style={{ boxShadow: `0 6px 20px rgba(59,130,246,0.3)` }}
            >
              <Radio size={20} />
              <span>Start Live Recording</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// ADVANCED GIF MACHINE: Import video, pick from downloads, 2-pass master quality
// Boomerang, Smart Blur Padding, Speed, Meme Banners, Max File Size
// -------------------------------------------------------------
function AdvancedGifMachineView({ 
  theme, setActiveView, handleSwitchToMain, historyItems, fetchHistory, 
  url, setUrl, isDownloading, setIsDownloading, setDownloadError, 
  fps, setFps, scale, setScale, dither, setDither,
  boomerang, setBoomerang, crop, setCrop, speed, setSpeed,
  memeTop, setMemeTop, memeBottom, setMemeBottom,
  maxFileSize, setMaxFileSize, onShareFile
}: any) {
  const [selectedSourceType, setSelectedSourceType] = useState<'local' | 'history' | 'url'>('local');
  const [localFilePath, setLocalFilePath] = useState('');
  const [localFileInfo, setLocalFileInfo] = useState<any>(null);
  const [selectedHistoryFile, setSelectedHistoryFile] = useState('');
  
  const [gifFormat, setGifFormat] = useState<'gif' | 'loop_mp4' | 'webp'>('gif');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:10');
  const [customGifName, setCustomGifName] = useState('');
  const [showMemeInputs, setShowMemeInputs] = useState(false);

  // Customizable Quality Settings Modal
  const [showQualityModal, setShowQualityModal] = useState(false);

  // Pick local video from PC via Windows dialog
  const handlePickLocalVideo = async () => {
    try {
      const res = await fetch('/api/select_local_file', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.filePath) {
        setLocalFilePath(data.filePath);
        setSelectedSourceType('local');
        if (data.info) {
          setLocalFileInfo(data.info);
          if (data.info.duration) {
            const endSec = Math.min(10, Math.floor(data.info.duration));
            setEndTime(`00:00:${endSec < 10 ? '0' : ''}${endSec}`);
          }
        }
      }
    } catch(e) {}
  };

  // Start conversion
  const handleStartGifRender = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadError(false);

    let targetFile = '';
    if (selectedSourceType === 'local') {
      targetFile = localFilePath;
    } else if (selectedSourceType === 'history') {
      targetFile = selectedHistoryFile;
    }

    try {
      if (selectedSourceType === 'url') {
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url,
            format: gifFormat,
            customName: customGifName,
            startTime: startTime,
            endTime: endTime,
            fps: fps,
            scale: scale,
            dither: dither,
            boomerang: boomerang,
            crop: crop,
            speed: speed,
            memeTop: memeTop,
            memeBottom: memeBottom,
            maxFileSize: maxFileSize
          })
        });
        const data = await res.json();
        if (!data.success) {
          setDownloadError(true);
          setIsDownloading(false);
        }
      } else {
        const res = await fetch('/api/convert_local', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: targetFile,
            format: gifFormat,
            customName: customGifName,
            startTime: startTime,
            endTime: endTime,
            fps: fps,
            scale: scale,
            dither: dither,
            boomerang: boomerang,
            crop: crop,
            speed: speed,
            memeTop: memeTop,
            memeBottom: memeBottom,
            maxFileSize: maxFileSize
          })
        });
        const data = await res.json();
        if (!data.success) {
          setDownloadError(true);
          setIsDownloading(false);
        }
      }
    } catch (e) {
      setDownloadError(true);
      setIsDownloading(false);
    }
  };

  // Filter video history items
  const videoHistory = (historyItems || []).filter((h: any) => {
    const fn = (h.filename || '').toLowerCase();
    return fn.endsWith('.mp4') || fn.endsWith('.webm') || fn.endsWith('.mkv') || fn.endsWith('.mov');
  });

  const qualitySummary = `${fps === 'original' ? 'Original FPS' : `${fps} FPS`} · ${scale === 'original' ? '100% Res' : scale}`;

  // Dropdown options with Smart Blur Background
  const cropOptions: DropdownOption[] = [
    { value: 'none', label: 'No Crop (Original Aspect)' },
    { value: '16:9_blur', label: '16:9 (Smart Blur Background)', badge: 'Pro Blur' },
    { value: '9:16_blur', label: '9:16 (Smart Blur Background)', badge: 'Reels Blur' },
    { value: '1:1', label: '1:1 Square', badge: 'Avatar / IG' },
    { value: '9:16', label: '9:16 Vertical Hard Crop', badge: 'Shorts' },
    { value: '4:3', label: '4:3 Classic TV' },
  ];

  const speedOptions: DropdownOption[] = [
    { value: '0.5', label: '0.5x Slowmo' },
    { value: '0.75', label: '0.75x Speed' },
    { value: '1.0', label: '1.0x Normal Speed' },
    { value: '1.25', label: '1.25x Speed' },
    { value: '1.5', label: '1.5x Fast' },
    { value: '2.0', label: '2.0x 2x Speed' },
  ];

  const maxFileSizeOptions: DropdownOption[] = [
    { value: 'none', label: 'No Limit (Max Fidelity)' },
    { value: '8M', label: 'Discord Free (8 MB)', badge: '8MB' },
    { value: '15M', label: 'Twitter / X (15 MB)', badge: '15MB' },
    { value: '25M', label: 'Discord Nitro (25 MB)', badge: '25MB' },
    { value: '50M', label: 'Web / Telegram (50 MB)', badge: '50MB' },
  ];

  return (
    <div className="w-[1050px] h-[580px] rounded-[24px] shadow-2xl p-6 flex gap-6 relative" style={{ backgroundColor: theme.panelOuter }}>
      
      {/* Symmetrical Left Arrow to return to Downloader */}
      <div 
        onClick={handleSwitchToMain}
        className="absolute -left-16 top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-40"
      >
        <button 
          className="w-12 h-28 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all group-hover:scale-110 active:scale-95 relative overflow-hidden"
          style={{ 
            backgroundColor: theme.btnDarkBg, 
            color: theme.gifAccent,
            border: `1px solid rgba(245, 158, 11, 0.25)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 12px rgba(0,0,0,0.25)` 
          }}
          title="Back to Downloader"
        >
          <ChevronLeft size={28} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" style={{ color: theme.gifAccent, filter: `drop-shadow(0 2px 8px ${theme.gifAccent}88)` }} />
          <span 
            className="text-[11px] font-black uppercase tracking-wider"
            style={{ color: theme.gifAccent, textShadow: `0 2px 10px ${theme.gifAccent}aa` }}
          >
            MAIN
          </span>
        </button>
      </div>

      {/* Left Panel: Video Source Selector */}
      <div className="flex-1 rounded-[20px] p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelInner }}>
        <div>
          {/* Header on ONE Single Line */}
          <div className="flex items-center justify-between gap-3 mb-4 w-full">
            <h2 className="text-[22px] font-bold whitespace-nowrap text-white">1. Choose Video Source</h2>
            
            {/* Clickable Custom Quality Pill Button with Subtle Yellow Glow */}
            <button 
              onClick={() => setShowQualityModal(true)}
              className="px-3 py-1.5 rounded-full font-bold text-xs whitespace-nowrap border hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: `${theme.gifAccent}66`,
                color: theme.textMain
              }}
              title="Click to customize FFmpeg video quality, framerate & dithering"
            >
              <Sliders size={13} style={{ color: theme.gifAccent }} />
              <span style={{ textShadow: `0 1px 6px ${theme.gifAccent}44` }}>{qualitySummary}</span>
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {/* Option A: Import Local File */}
            <button
              onClick={handlePickLocalVideo}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                selectedSourceType === 'local' && localFilePath ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <div className="p-2 rounded-lg bg-white/10" style={{ color: theme.gifAccent }}>
                  <HardDrive size={18} />
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-white">Import Your Own Video File</div>
                  <div className="text-xs text-gray-400 truncate max-w-[280px]">
                    {localFilePath ? localFilePath.split('\\').pop() : 'Click to select MP4, MOV, MKV, AVI from PC'}
                  </div>
                </div>
              </div>
              <FolderOpen size={18} style={{ color: theme.gifAccent }} className="shrink-0 ml-2" />
            </button>

            {/* Option B: Pick From Downloaded Ones */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <History size={16} className="text-amber-400" />
                  <span>Pick From Downloaded Videos:</span>
                </div>
              </div>

              {videoHistory.length > 0 ? (
                <div className="max-h-24 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1">
                  {videoHistory.map((v: any, i: number) => (
                    <div 
                      key={i}
                      onClick={() => {
                        setSelectedHistoryFile(v.filename);
                        setSelectedSourceType('history');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer truncate transition-all flex items-center justify-between ${
                        selectedSourceType === 'history' && selectedHistoryFile === v.filename
                          ? 'bg-white/15 text-white border border-white/30 font-bold'
                          : 'bg-black/30 hover:bg-black/60 text-gray-300'
                      }`}
                      title={v.filename}
                    >
                      <span className="truncate">{v.filename}</span>
                      {selectedSourceType === 'history' && selectedHistoryFile === v.filename && (
                        <Check size={14} style={{ color: theme.gifAccent }} className="shrink-0 ml-1" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic py-2 text-center">No downloaded videos in history yet.</div>
              )}
            </div>

            {/* Option C: Direct Web Link */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Film size={16} className="text-yellow-400" />
                <span>Or From Current URL:</span>
              </div>
              <input 
                type="text"
                placeholder="Paste video URL directly..."
                value={url}
                onChange={e => {
                  setUrl(e.target.value);
                  setSelectedSourceType('url');
                }}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Selected Source Status */}
        <div className="text-xs font-mono opacity-60 truncate">
          Active Source: <strong style={{ color: theme.gifAccent }} className="font-bold">{selectedSourceType.toUpperCase()}</strong>
        </div>
      </div>

      {/* Right Panel: Advanced 2-Pass Palettegen & Power Controls */}
      <div className="flex-[1.2] rounded-[20px] p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelInner }}>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[22px] font-bold whitespace-nowrap" style={{ color: theme.textMain }}>2. GIF Output & Engine</h2>
          </div>

          <div className="flex flex-col gap-3">
            {/* Format Selection */}
            <div className="flex gap-2">
              <button 
                onClick={() => setGifFormat('gif')}
                className={`flex-1 py-2 px-3 rounded-xl border text-center transition-all ${
                  gifFormat === 'gif' ? 'bg-white/15 border-amber-500/40 text-white font-bold' : 'bg-black/30 border-white/5 text-gray-400'
                }`}
              >
                <div className="text-xs font-bold" style={{ color: theme.textMain }}>Master GIF (.gif)</div>
                <div className="text-[10px] opacity-70">2-Pass Palettegen (60fps)</div>
              </button>

              <button 
                onClick={() => setGifFormat('loop_mp4')}
                className={`flex-1 py-2 px-3 rounded-xl border text-center transition-all ${
                  gifFormat === 'loop_mp4' ? 'bg-white/15 border-amber-500/40 text-white font-bold' : 'bg-black/30 border-white/5 text-gray-400'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-center gap-1" style={{ color: theme.textMain }}>
                  <Volume2 size={12} style={{ color: theme.gifAccent }} />
                  <span>Looping Clip (.mp4)</span>
                </div>
                <div className="text-[10px] opacity-70">Clean Video with Audio</div>
              </button>
            </div>

            {/* Time Trim Range */}
            <div className="flex gap-2">
              <div className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-gray-400">Start Time:</span>
                <input 
                  type="text"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  placeholder="00:00:00"
                  className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 font-mono text-xs text-white outline-none"
                />
              </div>

              <div className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-gray-400">End Time:</span>
                <input 
                  type="text"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  placeholder="00:00:10"
                  className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 font-mono text-xs text-white outline-none"
                />
              </div>
            </div>

            {/* Power Filters: Boomerang & Aspect Ratio Cropping */}
            <div className="flex gap-2 items-center">
              {/* Boomerang Toggle */}
              <button
                onClick={() => setBoomerang(!boomerang)}
                className={`flex-1 p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                  boomerang ? 'bg-amber-500/20 border-amber-500/40 text-white' : 'bg-white/5 border-white/5 text-gray-400'
                }`}
                title="Plays forward then in reverse seamlessly"
              >
                <div className="flex items-center gap-2">
                  <Repeat size={14} style={{ color: boomerang ? theme.gifAccent : 'inherit' }} />
                  <span className="text-xs font-bold">Boomerang Loop</span>
                </div>
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${boomerang ? 'bg-amber-500 border-amber-400' : 'border-gray-500'}`}>
                  {boomerang && <Check size={10} className="text-black font-bold" />}
                </div>
              </button>

              {/* Aspect Ratio / Smart Blur Dropdown */}
              <div className="flex-1">
                <CustomDropdown 
                  value={crop}
                  options={cropOptions}
                  onChange={setCrop}
                  theme={theme}
                  variant="tactile-dark"
                  size="sm"
                  accentColor={theme.gifAccent}
                  className="w-full"
                />
              </div>
            </div>

            {/* Speed & Meme Caption Controls */}
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <CustomDropdown 
                  value={speed}
                  options={speedOptions}
                  onChange={setSpeed}
                  theme={theme}
                  variant="tactile-dark"
                  size="sm"
                  accentColor={theme.gifAccent}
                  className="w-full"
                />
              </div>

              <button
                onClick={() => setShowMemeInputs(!showMemeInputs)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  showMemeInputs || memeTop || memeBottom ? 'bg-amber-500/20 border-amber-500/40 text-white' : 'bg-white/5 border-white/5 text-gray-400'
                }`}
              >
                <Type size={14} style={{ color: theme.gifAccent }} />
                <span>Meme Text</span>
              </button>
            </div>

            {/* Collapsible Meme Banner Inputs */}
            <AnimatePresence>
              {showMemeInputs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden flex flex-col gap-2 p-2.5 rounded-xl bg-black/40 border border-white/10"
                >
                  <input 
                    type="text"
                    value={memeTop}
                    onChange={e => setMemeTop(e.target.value)}
                    placeholder="TOP TEXT (Classic Meme Style)..."
                    className="w-full px-2 py-1 rounded bg-black/60 border border-white/10 text-xs text-white font-bold uppercase tracking-wider outline-none"
                  />
                  <input 
                    type="text"
                    value={memeBottom}
                    onChange={e => setMemeBottom(e.target.value)}
                    placeholder="BOTTOM TEXT..."
                    className="w-full px-2 py-1 rounded bg-black/60 border border-white/10 text-xs text-white font-bold uppercase tracking-wider outline-none"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom Output Name */}
            <input 
              type="text"
              placeholder="Custom Output Name (Optional)..."
              value={customGifName}
              onChange={e => setCustomGifName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/5 text-xs text-white outline-none"
            />
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={handleStartGifRender}
            disabled={isDownloading || (!localFilePath && !selectedHistoryFile && !url)}
            className="w-full py-3.5 rounded-2xl font-black uppercase tracking-wider text-base text-black shadow-2xl transition-all active:translate-y-[2px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: theme.gifAccent, 
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 5px 0 #b45309, 0 8px 15px rgba(245,158,11,0.3)` 
            }}
          >
            <Sparkles size={18} />
            <span>Generate Master GIF</span>
          </button>
        </div>
      </div>

      {/* Quality Settings Modal */}
      <AnimatePresence>
        {showQualityModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4 pointer-events-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[500px] p-6 rounded-[28px] shadow-2xl flex flex-col gap-5 relative border border-white/10"
              style={{ backgroundColor: theme.panelOuter, color: theme.textMain }}
            >
              <button 
                onClick={() => setShowQualityModal(false)}
                className="absolute top-5 right-5 hover:opacity-100 opacity-60 p-1 transition-opacity bg-white/5 hover:bg-white/10 rounded-full"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-2.5">
                <Sliders size={20} style={{ color: theme.gifAccent }} />
                <h3 className="text-xl font-bold text-white">FFmpeg 2-Pass Quality Settings</h3>
              </div>

              <div className="flex flex-col gap-4 text-xs">
                {/* Framerate Selection */}
                <div className="flex flex-col gap-1.5">
                  <span className="opacity-80 font-bold">1. Target Framerate (FPS):</span>
                  <CustomDropdown 
                    value={fps}
                    options={[
                      { value: 'original', label: 'Original FPS (Match Source Video)', badge: 'Recommended' },
                      { value: '60', label: '60 FPS (Ultra Smooth)' },
                      { value: '50', label: '50 FPS' },
                      { value: '30', label: '30 FPS (Standard Web)' },
                      { value: '24', label: '24 FPS (Cinematic)' },
                      { value: '15', label: '15 FPS (Compact File Size)' },
                    ]}
                    onChange={setFps}
                    theme={theme}
                    variant="tactile-dark"
                    accentColor={theme.gifAccent}
                    className="w-full"
                  />
                </div>

                {/* Resolution / Scale Selection */}
                <div className="flex flex-col gap-1.5">
                  <span className="opacity-80 font-bold">2. Video Resolution (Lanczos Scale):</span>
                  <CustomDropdown 
                    value={scale}
                    options={[
                      { value: 'original', label: 'Original Source Resolution', badge: '1:1 Pixel Match' },
                      { value: '1080p', label: '1080p Full HD (Lanczos Filter)' },
                      { value: '720p', label: '720p HD (Balanced Quality)' },
                      { value: '480p', label: '480p Standard (Medium GIF)' },
                      { value: '360p', label: '360p Lightweight (Small Discord)' },
                    ]}
                    onChange={setScale}
                    theme={theme}
                    variant="tactile-dark"
                    accentColor={theme.gifAccent}
                    className="w-full"
                  />
                </div>

                {/* Dithering & Palette Matrix */}
                <div className="flex flex-col gap-1.5">
                  <span className="opacity-80 font-bold">3. Color Palette & Dithering Algorithm:</span>
                  <CustomDropdown 
                    value={dither}
                    options={[
                      { value: 'bayer', label: 'Bayer Matrix Scale 5', badge: 'Recommended' },
                      { value: 'sierra', label: 'Sierra 2-4A (Smooth Gradients)' },
                      { value: 'floyd', label: 'Floyd-Steinberg (Classic Precision)' },
                      { value: 'none', label: 'No Dither (Hard Edge / Cartoon)' },
                    ]}
                    onChange={setDither}
                    theme={theme}
                    variant="tactile-dark"
                    accentColor={theme.gifAccent}
                    className="w-full"
                  />
                </div>

                {/* Max File Size Limit */}
                <div className="flex flex-col gap-1.5">
                  <span className="opacity-80 font-bold">4. Max File Size Target:</span>
                  <CustomDropdown 
                    value={maxFileSize}
                    options={maxFileSizeOptions}
                    onChange={setMaxFileSize}
                    theme={theme}
                    variant="tactile-dark"
                    accentColor={theme.gifAccent}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <button 
                  onClick={() => setShowQualityModal(false)}
                  className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider text-black shadow-lg transition-all active:scale-[0.98]"
                  style={{ backgroundColor: theme.gifAccent, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 0 #b45309` }}
                >
                  Save Quality Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------------
// CONTEXTUAL SETTINGS VIEW: Dedicated Dev Settings, Turbo aria2c & History
// -------------------------------------------------------------
function SettingsView({ 
  theme, activeSection, setActiveView, 
  playlistMode, setPlaylistMode, 
  quality, setQuality,
  sponsorBlock, setSponsorBlock,
  browserCookies, setBrowserCookies,
  embedMetadata, setEmbedMetadata,
  videoCodec, setVideoCodec,
  turboMode, setTurboMode,
  splitChapters, setSplitChapters,
  clipboardMonitor, setClipboardMonitor,
  gifFps, setGifFps, 
  gifScale, setGifScale, 
  gifDither, setGifDither, 
  gifAudioLoop, setGifAudioLoop, 
  gifMaxFileSize, setGifMaxFileSize,
  changeDownloadFolder, historyItems, onShareFile
}: any) {
  const isGifSection = activeSection === 'gif';
  const isLiveSection = activeSection === 'live_dvr';
  const accentColor = isLiveSection ? theme.liveAccent : isGifSection ? theme.gifAccent : theme.accent;

  const [cookieSyncStatus, setCookieSyncStatus] = useState<string | null>(null);
  const [isSyncingCookies, setIsSyncingCookies] = useState(false);

  const handleSyncBrowserCookies = async (browser: string) => {
    if (isSyncingCookies) return;
    setIsSyncingCookies(true);
    setCookieSyncStatus(`Syncing from ${browser}...`);
    try {
      const res = await fetch('/api/sync_cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ browser })
      });
      const data = await res.json();
      if (data.success) {
        setCookieSyncStatus(`Success! Cookies synced from ${browser}.`);
        setBrowserCookies(browser);
      } else {
        setCookieSyncStatus(`Error: ${data.error || 'Failed'}`);
      }
    } catch(e: any) {
      setCookieSyncStatus(`Failed: ${e.message}`);
    } finally {
      setIsSyncingCookies(false);
    }
  };

  const displayedHistory = isGifSection 
    ? (historyItems || []).filter((h: any) => {
        const fn = (h.filename || '').toLowerCase();
        const type = (h.type || '').toUpperCase();
        return fn.endsWith('.gif') || fn.endsWith('.webp') || type === 'GIF' || type === 'LOOP_MP4' || type === 'WEBP';
      })
    : historyItems;

  const qualityOptions: DropdownOption[] = [
    { value: 'Best', label: 'Best Quality (4K / 1080p)', badge: 'Max' },
    { value: '1440p', label: '1440p QHD' },
    { value: '1080p', label: '1080p Full HD' },
    { value: '720p', label: '720p HD' },
    { value: '480p', label: '480p Standard' },
  ];

  const browserOptions: DropdownOption[] = [
    { value: 'none', label: 'No Browser Cookies (Default)' },
    { value: 'chrome', label: 'Google Chrome' },
    { value: 'firefox', label: 'Mozilla Firefox' },
    { value: 'brave', label: 'Brave Browser' },
    { value: 'edge', label: 'Microsoft Edge' },
    { value: 'opera', label: 'Opera' },
    { value: 'vivaldi', label: 'Vivaldi' },
  ];

  const codecOptions: DropdownOption[] = [
    { value: 'auto', label: 'Auto (Best Quality & Speed)', badge: 'Auto' },
    { value: 'h264', label: 'H.264 / AVC (Max Device Compatibility)', badge: 'H.264' },
    { value: 'av1', label: 'AV1 / VP9 (Maximum Compression)', badge: 'AV1' },
  ];

  return (
    <div className="w-[1050px] h-[580px] rounded-[24px] shadow-2xl p-6 flex gap-6 relative" style={{ backgroundColor: theme.panelOuter }}>
      
      {/* Left Panel: Contextual Settings Controls */}
      <div className="flex-1 rounded-[20px] p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelInner }}>
        <div className="overflow-y-auto custom-scrollbar pr-1">
          <h2 className="text-[24px] mb-4 font-bold text-center w-full" style={{ color: theme.textMain }}>
            {isLiveSection ? 'Live DVR Settings' : isGifSection ? 'GIF Machine Settings' : 'Downloader Power Settings'}
          </h2>
          
          <div className="w-full flex flex-col gap-3 pl-1 mt-1">
            {isGifSection ? (
              <>
                {/* GIF Quality Preferences */}
                <div className="flex items-center justify-between mx-2">
                  <span className="text-[14px] font-medium" style={{ color: theme.textMain }}>Default Framerate:</span>
                  <CustomDropdown 
                    value={gifFps}
                    options={['original', '60', '50', '30', '24', '15']}
                    onChange={setGifFps}
                    theme={theme}
                    variant="tactile-light"
                    size="sm"
                    accentColor={accentColor}
                  />
                </div>

                <div className="flex items-center justify-between mx-2">
                  <span className="text-[14px] font-medium" style={{ color: theme.textMain }}>Default Resolution:</span>
                  <CustomDropdown 
                    value={gifScale}
                    options={['original', '1080p', '720p', '480p', '360p']}
                    onChange={setGifScale}
                    theme={theme}
                    variant="tactile-light"
                    size="sm"
                    accentColor={accentColor}
                  />
                </div>

                <div className="flex items-center justify-between mx-2">
                  <span className="text-[14px] font-medium" style={{ color: theme.textMain }}>Dithering Engine:</span>
                  <CustomDropdown 
                    value={gifDither}
                    options={[
                      { value: 'bayer', label: 'Bayer Matrix 5' },
                      { value: 'sierra', label: 'Sierra 2-4A' },
                      { value: 'floyd', label: 'Floyd-Steinberg' },
                      { value: 'none', label: 'No Dithering' }
                    ]}
                    onChange={setGifDither}
                    theme={theme}
                    variant="tactile-light"
                    size="sm"
                    accentColor={accentColor}
                  />
                </div>

                <div className="flex items-center justify-between mx-2 pt-1">
                  <span className="text-[14px] font-medium" style={{ color: theme.textMain }}>Sound Loop MP4 Default:</span>
                  <button 
                    onClick={() => setGifAudioLoop(!gifAudioLoop)} 
                    className="relative flex items-center w-12 h-5 rounded-full transition-colors ml-4" 
                    style={{ backgroundColor: gifAudioLoop ? accentColor : '#555' }}
                  >
                    <div 
                      className="absolute w-7 h-7 rounded-full transition-all shadow-md" 
                      style={{ 
                        backgroundColor: gifAudioLoop ? theme.inputBg : '#a0a0a8', 
                        left: gifAudioLoop ? 'auto' : '-3px', 
                        right: gifAudioLoop ? '-3px' : 'auto' 
                      }} 
                    />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* 1. Turbo Multi-Thread Acceleration (aria2c) */}
                <div className="flex items-center justify-between mx-2 pt-0.5 p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold flex items-center gap-1.5 text-blue-400">
                      <Zap size={16} />
                      <span>Turbo 16x Multi-Thread Engine</span>
                    </span>
                    <span className="text-[10px] text-gray-400">Bypasses throttling with aria2c & auto-fallback</span>
                  </div>
                  <button 
                    onClick={() => setTurboMode(!turboMode)} 
                    className="relative flex items-center w-12 h-5 rounded-full transition-colors ml-4 shrink-0" 
                    style={{ backgroundColor: turboMode ? '#3B82F6' : '#555' }}
                  >
                    <div 
                      className="absolute w-7 h-7 rounded-full transition-all shadow-md" 
                      style={{ 
                        backgroundColor: turboMode ? theme.inputBg : '#a0a0a8', 
                        left: turboMode ? 'auto' : '-3px', 
                        right: turboMode ? '-3px' : 'auto' 
                      }} 
                    />
                  </button>
                </div>

                {/* 2. Smart Chapter Splitter */}
                <div className="flex items-center justify-between mx-2 pt-0.5">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-medium flex items-center gap-1.5 text-white">
                      <ListPlus size={16} className="text-amber-400" />
                      <span>Auto-Split Video Chapters</span>
                    </span>
                    <span className="text-[10px] text-gray-400">Divides albums / DJ sets into numbered MP3 tracks</span>
                  </div>
                  <button 
                    onClick={() => setSplitChapters(!splitChapters)} 
                    className="relative flex items-center w-12 h-5 rounded-full transition-colors ml-4 shrink-0" 
                    style={{ backgroundColor: splitChapters ? '#F59E0B' : '#555' }}
                  >
                    <div 
                      className="absolute w-7 h-7 rounded-full transition-all shadow-md" 
                      style={{ 
                        backgroundColor: splitChapters ? theme.inputBg : '#a0a0a8', 
                        left: splitChapters ? 'auto' : '-3px', 
                        right: splitChapters ? '-3px' : 'auto' 
                      }} 
                    />
                  </button>
                </div>

                {/* 3. Smart Clipboard Monitor */}
                <div className="flex items-center justify-between mx-2 pt-0.5">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-medium flex items-center gap-1.5 text-white">
                      <Sparkles size={16} className="text-rose-400" />
                      <span>Smart Clipboard Link Monitor</span>
                    </span>
                    <span className="text-[10px] text-gray-400">Shows floating 1-click download pill on copy</span>
                  </div>
                  <button 
                    onClick={() => setClipboardMonitor(!clipboardMonitor)} 
                    className="relative flex items-center w-12 h-5 rounded-full transition-colors ml-4 shrink-0" 
                    style={{ backgroundColor: clipboardMonitor ? theme.accent : '#555' }}
                  >
                    <div 
                      className="absolute w-7 h-7 rounded-full transition-all shadow-md" 
                      style={{ 
                        backgroundColor: clipboardMonitor ? theme.inputBg : '#a0a0a8', 
                        left: clipboardMonitor ? 'auto' : '-3px', 
                        right: clipboardMonitor ? '-3px' : 'auto' 
                      }} 
                    />
                  </button>
                </div>

                {/* 4. Download Quality */}
                <div className="flex items-center justify-between mx-2">
                  <span className="text-[14px] font-medium whitespace-nowrap" style={{ color: theme.textMain }}>Download Quality:</span>
                  <CustomDropdown 
                    value={quality}
                    options={qualityOptions}
                    onChange={setQuality}
                    theme={theme}
                    variant="tactile-light"
                    size="sm"
                    accentColor={accentColor}
                  />
                </div>

                {/* 5. SponsorBlock */}
                <div className="flex items-center justify-between mx-2">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-medium flex items-center gap-1.5" style={{ color: theme.textMain }}>
                      <Shield size={15} className="text-emerald-400" />
                      <span>SponsorBlock Auto-Skip</span>
                    </span>
                  </div>
                  <button 
                    onClick={() => setSponsorBlock(!sponsorBlock)} 
                    className="relative flex items-center w-12 h-5 rounded-full transition-colors ml-4 shrink-0" 
                    style={{ backgroundColor: sponsorBlock ? '#10B981' : '#555' }}
                  >
                    <div 
                      className="absolute w-7 h-7 rounded-full transition-all shadow-md" 
                      style={{ 
                        backgroundColor: sponsorBlock ? theme.inputBg : '#a0a0a8', 
                        left: sponsorBlock ? 'auto' : '-3px', 
                        right: sponsorBlock ? '-3px' : 'auto' 
                      }} 
                    />
                  </button>
                </div>

                {/* 6. Browser Cookie Extractor */}
                <div className="flex flex-col gap-1.5 mx-2 p-2 rounded-xl bg-black/30 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium flex items-center gap-1.5 text-white">
                      <Cookie size={13} className="text-amber-400" />
                      <span>Browser Cookie Sync:</span>
                    </span>
                    {cookieSyncStatus && (
                      <span className="text-[10px] font-mono text-amber-300 truncate max-w-[130px]">{cookieSyncStatus}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <CustomDropdown 
                      value={browserCookies}
                      options={browserOptions}
                      onChange={setBrowserCookies}
                      theme={theme}
                      variant="glass-dark"
                      size="sm"
                      accentColor={accentColor}
                      className="flex-1"
                    />
                    <button
                      onClick={() => handleSyncBrowserCookies(browserCookies === 'none' ? 'chrome' : browserCookies)}
                      disabled={isSyncingCookies}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white shrink-0 border border-white/10"
                    >
                      {isSyncingCookies ? '...' : 'Sync'}
                    </button>
                  </div>
                </div>

                {/* 7. Codec Selection */}
                <div className="flex items-center justify-between mx-2">
                  <span className="text-[14px] font-medium whitespace-nowrap" style={{ color: theme.textMain }}>Video Codec Priority:</span>
                  <CustomDropdown 
                    value={videoCodec}
                    options={codecOptions}
                    onChange={setVideoCodec}
                    theme={theme}
                    variant="tactile-light"
                    size="sm"
                    accentColor={accentColor}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Change Folder Action */}
        <div className="pt-2">
          <button 
            onClick={changeDownloadFolder} 
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-white/10 hover:bg-white/5 transition-all"
            style={{ color: theme.textMain }}
          >
            <FolderOpen size={16} style={{ color: accentColor }} />
            <span>Change Default Download Folder</span>
          </button>
        </div>
      </div>

      {/* Right Panel: Download History & Wi-Fi Share */}
      <div className="flex-1 rounded-[20px] p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelInner }}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[22px] font-bold" style={{ color: theme.textMain }}>Download History</h2>
            <span className="text-xs font-mono opacity-60">{(displayedHistory || []).length} items</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1 max-h-[410px]">
            {displayedHistory && displayedHistory.length > 0 ? (
              displayedHistory.map((item: any, index: number) => (
                <div 
                  key={index} 
                  className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-3 group hover:bg-white/10 transition-colors"
                >
                  <div className="flex flex-col truncate flex-1">
                    <span className="text-xs font-bold text-white truncate" title={item.filename}>{item.filename}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono opacity-50">{item.date}</span>
                      {item.type && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/10 text-gray-300">
                          {item.type}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Wi-Fi Share Button */}
                    <button 
                      onClick={() => onShareFile(item.filename)}
                      className="p-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-white transition-all shadow-sm"
                      title="Share to Phone via Local Wi-Fi QR Code"
                    >
                      <Smartphone size={14} />
                    </button>
                    {/* Open in Explorer */}
                    <button 
                      onClick={() => fetch('/api/open_folder', { method: 'POST' })}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-all"
                      title="Open in Windows Explorer"
                    >
                      <FolderOpen size={14} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-xs text-gray-500 italic py-16">
                No recent downloads.
              </div>
            )}
          </div>
        </div>

        <div className="text-[11px] font-mono text-center opacity-40 pt-2 border-t border-white/5">
          Levi's YouTube Downloader Pro · v1.1.0-dev (Turbo Enabled)
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// LOG VIEW
// -------------------------------------------------------------
function LogView({ theme, activeSection, setActiveView }: any) {
  const [logs, setLogs] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'engine' | 'errors'>('all');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchLogs = () => {
      fetch('/api/logs').then(r => r.json()).then(d => {
        if (Array.isArray(d)) setLogs(d);
      }).catch(() => {});
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter(l => {
    if (filter === 'errors') return l.toLowerCase().includes('error') || l.toLowerCase().includes('critical') || l.toLowerCase().includes('failed');
    if (filter === 'engine') return l.includes('[download]') || l.includes('[ffmpeg]') || l.includes('[Merger]') || l.includes('[ChapterSplit]');
    return true;
  });

  const accentColor = activeSection === 'live_dvr' ? theme.liveAccent : activeSection === 'gif' ? theme.gifAccent : theme.accent;

  return (
    <div className="w-[1050px] h-[580px] rounded-[24px] shadow-2xl p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelOuter }}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[24px] font-bold text-white">Stream & Process Log</h2>
            <div className="flex gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5">
              <button 
                onClick={() => setFilter('all')} 
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filter === 'all' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                All Logs ({logs.length})
              </button>
              <button 
                onClick={() => setFilter('engine')} 
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filter === 'engine' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Engine Stream
              </button>
              <button 
                onClick={() => setFilter('errors')} 
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filter === 'errors' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}
              >
                Errors Only
              </button>
            </div>
          </div>

          <button 
            onClick={handleCopyLogs}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white flex items-center gap-1.5"
          >
            <Copy size={14} />
            <span>{copied ? 'Copied!' : 'Copy All'}</span>
          </button>
        </div>

        {/* Terminal Window */}
        <div className="w-full h-[450px] p-4 rounded-2xl bg-black/70 border border-white/10 font-mono text-xs overflow-y-auto custom-scrollbar flex flex-col gap-1 shadow-inner select-text">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log, index) => {
              const isErr = log.toLowerCase().includes('error') || log.toLowerCase().includes('critical');
              const isSuccess = log.includes('Successfully') || log.includes('Saved:') || log.includes('initialized');
              return (
                <div 
                  key={index} 
                  className={`leading-relaxed ${isErr ? 'text-red-400 font-bold' : isSuccess ? 'text-emerald-400' : 'text-gray-300'}`}
                >
                  <span className="opacity-40 mr-2">[{index + 1}]</span>
                  <span>{log}</span>
                </div>
              );
            })
          ) : (
            <div className="text-gray-500 italic py-10 text-center">No log messages found for this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// UPDATE VIEW
// -------------------------------------------------------------
function UpdateView({ theme, setActiveView, checkUpdates, setUpdateAvailable }: any) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/logs').then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          setLogs(d);
          if (d.some(l => l.includes('Update cycle finished.') || l.includes('Process Finished Successfully!'))) {
            setIsDone(true);
            setUpdateAvailable(false);
            checkUpdates(true);
          }
        }
      }).catch(() => {});
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-[1050px] h-[580px] rounded-[24px] shadow-2xl p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelOuter }}>
      <div>
        <h2 className="text-[24px] font-bold text-white mb-2">Engine Updater Pipeline</h2>
        <p className="text-xs text-gray-400 mb-4">Fetching the latest upstream `yt-dlp` core binaries and dependencies...</p>

        <div className="w-full h-[410px] p-4 rounded-2xl bg-black/70 border border-white/10 font-mono text-xs overflow-y-auto custom-scrollbar flex flex-col gap-1 shadow-inner select-text">
          {logs.map((log, i) => (
            <div key={i} className="text-gray-300">
              <span className="opacity-40 mr-2">[{i + 1}]</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button 
          onClick={() => setActiveView('main')}
          disabled={!isDone}
          className="py-3 px-8 rounded-xl font-bold text-sm uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-all"
        >
          {isDone ? 'Return to Downloader' : 'Updating in Progress...'}
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// PRENAME MODAL
// -------------------------------------------------------------
function PrenameView({ theme, setActiveView, customName, setCustomName }: any) {
  const [tempName, setTempName] = useState(customName);

  const handleSave = () => {
    setCustomName(tempName.trim());
    setActiveView('main');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4 pointer-events-auto"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-[500px] p-7 rounded-[28px] shadow-2xl flex flex-col gap-5 relative border border-white/10"
        style={{ backgroundColor: theme.panelOuter, color: theme.textMain }}
      >
        <button 
          onClick={() => setActiveView('main')}
          className="absolute top-5 right-5 hover:opacity-100 opacity-60 p-1 transition-opacity bg-white/5 hover:bg-white/10 rounded-full"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2.5">
          <PenLine size={20} style={{ color: theme.accent }} />
          <h3 className="text-xl font-bold text-white">Prename Output File</h3>
        </div>

        <p className="text-xs text-gray-400">Specify a custom name for your next downloaded audio or video file without extension:</p>

        <input 
          type="text"
          value={tempName}
          onChange={e => setTempName(e.target.value)}
          placeholder="e.g. Favorite_Song_Remix_2026..."
          className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 text-sm text-white font-medium outline-none shadow-inner"
          autoFocus
        />

        <div className="flex gap-3 mt-2">
          <button 
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider text-white shadow-lg transition-all active:scale-[0.98]"
            style={{ backgroundColor: theme.accent, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 0 #99001b` }}
          >
            Apply Name
          </button>
          <button 
            onClick={() => { setCustomName(''); setActiveView('main'); }}
            className="px-4 py-3 rounded-xl font-bold text-sm text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-all"
          >
            Clear
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}