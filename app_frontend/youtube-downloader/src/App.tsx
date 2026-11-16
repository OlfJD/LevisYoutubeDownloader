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
  Layers, QrCode, Key, FileText, Lock, Eye, EyeOff, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import CustomDropdown, { DropdownOption } from './CustomDropdown';

// -------------------------------------------------------------
// Shared form pieces: one look for Settings, GIF studio and Live DVR
// -------------------------------------------------------------
const fieldClass = "w-full px-3 py-2 rounded-control bg-[#17171d] border border-white/[0.08] text-[13px] text-white outline-none placeholder:text-gray-500 focus:border-white/25 disabled:opacity-50 transition-colors";

function Toggle({ on, onChange, accent, disabled, label }: { on: boolean; onChange: (v: boolean) => void; accent: string; disabled?: boolean; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} title={label} disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ backgroundColor: on ? accent : '#3a3b46' }}
    >
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
    </button>
  );
}

function SettingRow({ icon, label, hint, children }: { icon?: React.ReactNode; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[0.06] last:border-b-0">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <span className="mt-0.5 shrink-0 text-gray-400">{icon}</span>}
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#D9D9D9]">{label}</div>
          {hint && <div className="text-[11px] text-gray-400 leading-snug">{hint}</div>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{children}</label>;
}

function PanelTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4 min-h-[32px]">
      <h2 className="text-[20px] font-bold text-white whitespace-nowrap">{children}</h2>
      {aside}
    </div>
  );
}

function FolderField({ folder, onChange, onOpen, accent, disabled }: { folder: string; onChange: () => void; onOpen?: (f: string) => void; accent: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Save folder</FieldLabel>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 px-3 py-2 rounded-control bg-[#17171d] border border-white/[0.08] text-[12px] font-mono text-gray-300 truncate" title={folder || 'Downloads (Default)'}>
          {folder || 'Downloads (Default)'}
        </div>
        {folder && onOpen && (
          <button onClick={() => onOpen(folder)} title="Open in Windows Explorer" className="p-2 rounded-control border border-white/[0.08] hover:bg-white/10 text-gray-300 hover:text-white transition-colors shrink-0">
            <FolderOpen size={16} />
          </button>
        )}
        <button onClick={onChange} disabled={disabled} className="px-3.5 py-2 rounded-control text-xs font-bold uppercase tracking-wider border border-white/[0.08] hover:bg-white/10 transition-colors shrink-0 text-[#D9D9D9] disabled:opacity-50" style={{ color: accent }}>
          Change
        </button>
      </div>
    </div>
  );
}

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
          className="w-8 h-8 rounded-chip flex items-center justify-center transition-colors hover:bg-white/10 active:scale-95"
          style={{ color: theme.textMain }}
          title="Minimize"
        >
          <span className="text-lg leading-none -mt-0.5">—</span>
        </button>
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="w-8 h-8 rounded-chip flex items-center justify-center transition-colors hover:bg-red-600/90 active:scale-95 hover:text-white"
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
        className="w-full max-w-[460px] p-7 rounded-panel border border-white/10 shadow-2xl flex flex-col items-center gap-5 relative overflow-hidden"
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

        <div className="p-3.5 bg-white rounded-card shadow-2xl flex items-center justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-[200px] h-[200px] rounded-chip" />
          ) : (
            <div className="w-[200px] h-[200px] flex items-center justify-center text-black font-semibold text-xs">Generating QR...</div>
          )}
        </div>

        <div className="w-full flex items-center gap-2 p-2.5 rounded-control bg-black/40 border border-white/5 text-xs text-white/80">
          <span className="truncate flex-1 font-mono text-[11px] opacity-75">{file.shareUrl}</span>
          <button 
            onClick={handleCopy} 
            className="px-3 py-1.5 rounded-chip bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-all shrink-0 text-xs shadow-md"
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
  const [authErrorDetected, setAuthErrorDetected] = useState(false);
  
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
  const [downloadFolder, setDownloadFolder] = useState('');
  const [twitchToken, setTwitchToken] = useState('');
  const [cookieStatus, setCookieStatus] = useState<{
    hasCookies: boolean;
    summary: string;
    hasTwitch: boolean;
    hasYouTube: boolean;
    twitchToken: string;
    browserCookies: string;
    fileSize: number;
  } | null>(null);

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

  // Pull real history items & cookie status
  const fetchHistory = () => {
    fetch('/api/history').then(r=>r.json()).then(d => setHistoryItems(d || [])).catch(e=>{});
  };

  const fetchCookieStatus = () => {
    fetch('/api/cookie_status')
      .then(r => r.json())
      .then(d => {
        setCookieStatus(d);
        if (d && d.twitchToken) setTwitchToken(d.twitchToken);
      })
      .catch(() => {});
  };

  useEffect(() => { 
    fetchHistory();
    fetchCookieStatus();
  }, []);

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
        if (d.downloadDir) setDownloadFolder(d.downloadDir);
        if (d.twitchToken) setTwitchToken(d.twitchToken);
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
      const res = await fetch('/api/change_folder', { method: 'POST' });
      const data = await res.json();
      if (data && data.folder) {
        setDownloadFolder(data.folder);
      }
    } catch (error) {}
  };

  const openDownloadFolder = async (folderPath?: string) => {
    try {
      await fetch('/api/open_folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: folderPath || downloadFolder })
      });
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
    fieldBg: '#17171d',
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

      <div className="flex-1 flex flex-col items-center justify-between pt-4 pb-20 relative">
        
        {/* Dynamic Glowing Title */}
        <div className="relative mb-0 mt-2 flex flex-col items-center">
          <h1 
            className="text-[58px] font-medium tracking-tight mb-1 select-none relative backdrop-blur-[2px] border py-1.5 px-10 rounded-panel mix-blend-screen text-center transition-all duration-300"
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
                  authErrorDetected={authErrorDetected}
                  setAuthErrorDetected={setAuthErrorDetected}
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
                  cookieStatus={cookieStatus}
                  onShareFile={handleOpenShareModal}
                  downloadFolder={downloadFolder}
                  changeDownloadFolder={changeDownloadFolder}
                  openDownloadFolder={openDownloadFolder}
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
                  downloadFolder={downloadFolder}
                  changeDownloadFolder={changeDownloadFolder}
                  openDownloadFolder={openDownloadFolder}
                  historyItems={historyItems}
                  onShareFile={handleOpenShareModal}
                  cookieStatus={cookieStatus}
                  fetchCookieStatus={fetchCookieStatus}
                  twitchToken={twitchToken}
                  setTwitchToken={setTwitchToken}
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
            className="pointer-events-auto rounded-card flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group border border-white/5 shadow-lg"
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
            className="pointer-events-auto rounded-card flex items-center justify-center transition-all active:translate-y-[4px] text-[18px] font-bold border border-white/5 shadow-lg"
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
              className="absolute top-6 right-6 pointer-events-auto z-50 flex flex-col gap-3 p-5 rounded-panel border border-amber-500/20 shadow-2xl backdrop-blur-3xl overflow-hidden group max-w-[380px]"
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
                 className="mt-2 font-bold py-2.5 px-4 rounded-card transition-all active:translate-y-[2px] flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
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
              className="absolute top-6 left-6 pointer-events-auto z-50 flex flex-col gap-3 p-5 rounded-panel border shadow-2xl backdrop-blur-3xl overflow-hidden group max-w-[340px]"
              style={{ 
                backgroundColor: `${theme.panelOuter}f2`, 
                color: theme.textMain, 
                borderColor: authErrorDetected ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.1)',
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 10px 30px rgba(0,0,0,0.4)` 
              }}
            >
              <div className="flex items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${authErrorDetected ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                  <span className="font-bold tracking-wide text-base text-white">
                    {authErrorDetected ? "Subscriber / Auth Required" : "Download Failed"}
                  </span>
                </div>
                <button onClick={() => setDownloadError(false)} className="hover:opacity-100 opacity-60 p-1 transition-opacity bg-white/5 hover:bg-white/10 rounded-full"><X size={18} /></button>
              </div>
              <p className="text-xs font-medium relative z-10 leading-relaxed text-gray-300">
                {authErrorDetected 
                  ? "This Twitch VOD or stream is subscriber-only or requires account login. Configure credentials in Cookie Settings."
                  : "The download process encountered an error. Check logs for details or update the tool."}
              </p>
              <div className="flex gap-2 mt-1">
                {authErrorDetected ? (
                  <>
                    <button
                       onClick={() => { setDownloadError(false); setActiveView('settings'); }}
                       className="flex-1 font-bold py-2 px-3 rounded-control transition-all active:translate-y-[2px] text-xs flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white shadow-md cursor-pointer"
                    >
                      <Key size={13} />
                      <span>Cookie Settings</span>
                    </button>
                    <button
                       onClick={() => { setDownloadError(false); setActiveView('log'); }}
                       className="font-bold py-2 px-3 rounded-control transition-all active:translate-y-[2px] text-xs bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer"
                    >
                      Logs
                    </button>
                  </>
                ) : (
                  <>
                    <button
                       onClick={() => { setDownloadError(false); handleUpdate(); }}
                       className="flex-1 font-bold py-2 px-3 rounded-control transition-all active:translate-y-[2px] text-xs flex items-center justify-center gap-1.5 text-white cursor-pointer"
                       style={{ backgroundColor: theme.accent, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 0 rgba(0,0,0,0.3)` }}
                    >
                      Update Tool
                    </button>
                    <button
                       onClick={() => { setDownloadError(false); setActiveView('log'); }}
                       className="font-bold py-2 px-3 rounded-control transition-all active:translate-y-[2px] text-xs bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer"
                    >
                      Logs
                    </button>
                  </>
                )}
              </div>
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
                className="w-full max-w-[550px] p-8 rounded-panel shadow-2xl flex flex-col gap-6 relative"
                style={{ backgroundColor: theme.panelOuter, color: theme.textMain }}
              >
                <button onClick={() => setShowPlaylistPopup(false)} className="absolute top-6 right-6 hover:scale-110 active:scale-95"><X size={32} /></button>
                <h3 className="text-[32px] font-medium text-center mt-2">Playlist Detected</h3>
                <p className="text-[20px] text-center opacity-80 leading-relaxed px-2">You pasted a playlist link, but Playlist Mode is off. Would you like to turn it on to download the entire list?</p>
                <div className="flex flex-col gap-4 mt-4">
                  <button onClick={() => { handlePlaylistModeChange(true); setShowPlaylistPopup(false); }} className="py-4 rounded-control font-bold text-[22px]" style={{ backgroundColor: theme.accent, color: '#fff', boxShadow: `0 4px 0 #99001b` }}>Turn On & Download All</button>
                  <button onClick={() => setShowPlaylistPopup(false)} className="py-4 rounded-control font-bold text-[22px] border-[3px]" style={{ borderColor: theme.btnDarkBorder, color: theme.textMain }}>No, just this video</button>
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
  setDownloadError, authErrorDetected, setAuthErrorDetected, customName, setCustomName, fetchHistory, updateAvailable, updateInfo, 
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
        const isAuth = logs.some(l => l.includes('AUTHENTICATION REQUIRED') || l.includes('AUTHENTICATION ERROR') || l.includes('subscriber-only'));

        if (isDone || isError) {
            setIsDownloading(false);
            if (isError) {
                setDownloadError(true);
                if (setAuthErrorDetected) setAuthErrorDetected(Boolean(isAuth));
            } else {
                setCustomName('');
            }
            fetchHistory();
            return;
        }

        const dlLogs = logs.filter(l => typeof l === 'string' && l.includes('[download]') && l.includes('%'));
        if (dlLogs.length > 0) {
          const match = dlLogs[dlLogs.length - 1].match(/(\d+(?:\.\d+)?)%/);
          if (match) setProgress(parseFloat(match[1]));
        }

        // Search from the end: the newest line is the current item (find() kept showing "Video 1 of N")
        const findLatest = (pred: (l: string) => boolean) => {
          for (let i = logs.length - 1; i >= 0; i--) if (typeof logs[i] === 'string' && pred(logs[i])) return logs[i];
          return undefined;
        };
        const pMatch = findLatest(l => l.includes('Downloading video '));
        if (pMatch) {
            const m = pMatch.match(/Downloading video (\d+) of (\d+)/);
            if (m) setDownloadTitle(`Video ${m[1]} of ${m[2]}`);
        } else if (!customName) {
            const nameLog = findLatest(l => l.includes('[download] Destination:'));
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
          className="w-12 h-28 rounded-card flex flex-col items-center justify-center gap-1.5 transition-all group-hover:scale-110 active:scale-95 relative overflow-hidden"
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
          className="w-12 h-28 rounded-card flex flex-col items-center justify-center gap-1.5 transition-all group-hover:scale-110 active:scale-95 relative overflow-hidden"
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
          <div className="flex-1 flex h-full rounded-control overflow-hidden p-[2px] shadow-inner relative z-10 transition-all" style={{ backgroundColor: theme.inputBg }}>
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
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 140, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="h-full overflow-hidden shrink-0 rounded-control">
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

        {/* Download formats: one row, then the utility row */}
        <motion.div layout className="flex flex-col items-center gap-7">
          <div className="flex gap-6">
            {(['mp3', 'mp4', 'wav'] as const).map(f => (
              <button
                key={f}
                onClick={() => startRealDownload(f)}
                disabled={isDownloading}
                title={`Download as ${f.toUpperCase()}`}
                className="w-[196px] disabled:opacity-50 disabled:cursor-not-allowed font-extrabold uppercase tracking-widest text-[22px] py-[14px] rounded-control flex items-center justify-center gap-3 transition-all active:translate-y-[4px] relative overflow-hidden group"
                style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText, boxShadow: isDownloading ? 'none' : `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)` }}
              >
                <Download size={22} strokeWidth={2.75} className="opacity-70" />
                <span className="relative drop-shadow-md">{f}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-center gap-4">
            {[
              { key: 'rename', icon: <PenLine size={18} />, label: 'Rename', title: 'Set the output file name', onClick: () => setActiveView('prename') },
              { key: 'folder', icon: <FolderOpen size={18} />, label: 'Folder', title: 'Change the download folder', onClick: changeDownloadFolder },
            ].map(b => (
              <button key={b.key} onClick={b.onClick} title={b.title} className="w-[180px] gap-2.5 font-bold py-[11px] rounded-control flex items-center justify-center transition-all active:translate-y-[4px] text-[15px] uppercase tracking-widest whitespace-nowrap border border-white/5" style={{ backgroundColor: theme.btnDarkBg, color: theme.btnDarkText, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` }}>
                {b.icon}<span>{b.label}</span>
              </button>
            ))}
            <button onClick={handleUpdate} title={updateAvailable ? 'An update is available' : 'Check for updates'} className="w-[180px] gap-2.5 font-bold py-[11px] rounded-control flex items-center justify-center transition-all active:translate-y-[4px] text-[15px] uppercase tracking-widest whitespace-nowrap relative border" style={{ backgroundColor: updateAvailable ? `${theme.accent}2b` : theme.btnDarkBg, borderColor: updateAvailable ? `${theme.accent}80` : 'rgba(255,255,255,0.05)', color: theme.btnDarkText, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` }}>
              {updateAvailable && (
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
              )}
              <RefreshCcw size={18} className={updateAvailable ? "text-amber-400 animate-spin-slow" : ""} />
              <span>{updateAvailable ? "Update!" : "Update"}</span>
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
  theme, setActiveView, handleSwitchToMain, fetchHistory, browserCookies, onShareFile,
  downloadFolder, changeDownloadFolder, openDownloadFolder
}: any) {
  const [liveUrl, setLiveUrl] = useState('');
  const [liveQuality, setLiveQuality] = useState('Best');
  const [liveFromStart, setLiveFromStart] = useState(false);
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
          browserCookies: browserCookies,
          downloadDir: downloadFolder
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
    <div className="w-[1050px] h-[580px] rounded-panel shadow-2xl p-6 flex gap-6 relative" style={{ backgroundColor: theme.panelOuter }}>

      {/* Right arrow back to the downloader */}
      <div
        onClick={handleSwitchToMain}
        className="absolute -right-16 top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-40"
      >
        <button
          className="w-12 h-28 rounded-card flex flex-col items-center justify-center gap-1.5 transition-all group-hover:scale-110 active:scale-95 relative overflow-hidden"
          style={{
            backgroundColor: theme.btnDarkBg,
            color: theme.liveAccent,
            border: `1px solid rgba(59, 130, 246, 0.3)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 12px rgba(0,0,0,0.25)`
          }}
          title="Back to Downloader"
        >
          <ChevronRight size={28} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" style={{ color: theme.liveAccent, filter: `drop-shadow(0 2px 8px ${theme.liveAccent}88)` }} />
          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: theme.liveAccent, textShadow: `0 2px 10px ${theme.liveAccent}aa` }}>
            MAIN
          </span>
        </button>
      </div>

      {/* Left: what to record */}
      <div className="flex-1 rounded-card p-6 flex flex-col justify-between min-w-0" style={{ backgroundColor: theme.panelInner }}>
        <div className="flex flex-col">
          <PanelTitle>Stream</PanelTitle>

          <div className="flex flex-col gap-1.5 mb-4">
            <FieldLabel htmlFor="live-url">Live stream link</FieldLabel>
            <input
              id="live-url" type="text" value={liveUrl} onChange={e => setLiveUrl(e.target.value)} disabled={isRecording}
              placeholder="YouTube Live or Twitch link" className={fieldClass}
            />
          </div>

          <div className="flex flex-col gap-1.5 mb-1">
            <FieldLabel htmlFor="live-name">File name</FieldLabel>
            <input
              id="live-name" type="text" value={customLiveName} onChange={e => setCustomLiveName(e.target.value)} disabled={isRecording}
              placeholder="Optional, default is Channel - Title" className={fieldClass}
            />
          </div>

          <SettingRow label="Quality">
            <CustomDropdown
              value={liveQuality}
              options={[
                { value: 'Best', label: 'Best (source)' },
                { value: '1080p', label: '1080p' },
                { value: '720p', label: '720p' },
                { value: '480p', label: '480p' },
              ]}
              onChange={setLiveQuality} theme={theme} size="sm" accentColor={theme.liveAccent} minWidth={150}
            />
          </SettingRow>
          <SettingRow icon={<Repeat size={16} />} label="Record from the start" hint="Rewinds to when the broadcast began, if the site allows it">
            <Toggle on={liveFromStart} onChange={setLiveFromStart} accent={theme.liveAccent} disabled={isRecording} label="Record from the start" />
          </SettingRow>
        </div>

        <FolderField folder={downloadFolder} onChange={changeDownloadFolder} onOpen={openDownloadFolder} accent={theme.liveAccent} disabled={isRecording} />
      </div>

      {/* Right: recording status and the start / stop button */}
      <div className="flex-[1.2] rounded-card p-6 flex flex-col justify-between min-w-0" style={{ backgroundColor: theme.panelInner }}>
        <div>
          <PanelTitle aside={isRecording ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
              <span>REC</span>
            </div>
          ) : undefined}>
            Recording
          </PanelTitle>

          <div className="w-full p-6 rounded-card bg-black/30 border border-white/[0.06] flex flex-col gap-6 relative overflow-hidden">
            {isRecording ? (
              <>
                <div className="flex items-end justify-between">
                  <div className="flex flex-col">
                    <FieldLabel>Duration</FieldLabel>
                    <span className="text-4xl font-mono font-black text-white mt-1 tabular-nums">{formatTime(recordingStatus?.duration_sec || 0)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <FieldLabel>File size</FieldLabel>
                    <span className="text-2xl font-mono font-bold mt-1 tabular-nums" style={{ color: theme.liveAccent }}>{formatBytes(recordingStatus?.bytes_downloaded || 0)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1.5 h-12 py-2">
                  {[...Array(24)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-full"
                      style={{ backgroundColor: theme.liveAccent }}
                      animate={{ height: ['15%', '100%', '15%'] }}
                      transition={{ duration: 0.4 + (i % 5) * 0.15, repeat: Infinity, ease: "easeInOut", delay: (i * 0.05) % 0.4 }}
                    />
                  ))}
                </div>

                <div className="text-[12px] text-gray-400 truncate">
                  Saving to <span className="font-mono text-white">{recordingStatus?.filename || 'Looking up the stream title…'}</span>
                </div>
              </>
            ) : (
              <div className="py-10 flex flex-col items-center justify-center text-center gap-3 text-gray-400">
                <Radio size={44} style={{ color: `${theme.liveAccent}88` }} />
                <div className="text-[15px] font-semibold text-gray-200">Ready to record</div>
                <div className="text-[13px] text-gray-400 max-w-[320px]">
                  Paste a YouTube Live or Twitch link and press Start. The recording is saved as an MP4 when you stop.
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          {isRecording ? (
            <button
              onClick={handleStopRecording}
              disabled={isStopping}
              className="w-full py-4 rounded-control font-black uppercase tracking-widest text-lg text-white transition-all active:translate-y-[2px] flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 disabled:opacity-70"
              style={{ boxShadow: `0 6px 20px rgba(239,68,68,0.35)` }}
            >
              <Square size={20} fill="currentColor" />
              <span>{isStopping ? 'Saving…' : 'Stop & save'}</span>
            </button>
          ) : (
            <button
              onClick={handleStartRecording}
              disabled={!liveUrl}
              className="w-full py-4 rounded-control font-black uppercase tracking-widest text-lg text-white transition-all active:translate-y-[2px] flex items-center justify-center gap-3 disabled:cursor-not-allowed disabled:!bg-[#2a2b36] disabled:!text-gray-500 disabled:!shadow-none"
              style={{ backgroundColor: theme.liveAccent, boxShadow: `0 6px 20px rgba(59,130,246,0.3)` }}
            >
              <Radio size={20} />
              <span>{liveUrl ? 'Start recording' : 'Paste a link to start'}</span>
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

  // MainView's log poller isn't mounted here, so this view has to notice the end of its own render
  useEffect(() => {
    if (!isDownloading) return;
    const interval = setInterval(() => {
      fetch('/api/logs').then(r => r.json()).then(logs => {
        if (!Array.isArray(logs)) return;
        const isDone = logs.some(l => typeof l === 'string' && l.includes('Process Finished Successfully!'));
        const isError = logs.some(l => typeof l === 'string' && l.includes('CRITICAL ERROR:'));
        const isStopped = logs.some(l => typeof l === 'string' && l.includes('Process stopped by user.'));
        if (isDone || isError || isStopped) {
          setIsDownloading(false);
          if (isError) setDownloadError(true);
          fetchHistory();
        }
      }).catch(() => {});
    }, 500);
    return () => clearInterval(interval);
  }, [isDownloading]);

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

  const qualitySummary = `${fps === 'original' ? 'Original FPS' : `${fps} FPS`} · ${scale === 'original' ? 'full size' : scale}`;

  const cropOptions: DropdownOption[] = [
    { value: 'none', label: 'Original shape' },
    { value: '16:9_blur', label: '16:9, blurred sides', desc: 'Fits any video into widescreen' },
    { value: '9:16_blur', label: '9:16, blurred sides', desc: 'For Reels, Shorts, TikTok' },
    { value: '1:1', label: 'Square 1:1', desc: 'Avatars, Instagram' },
    { value: '9:16', label: '9:16, cropped', desc: 'Cuts the sides off' },
    { value: '4:3', label: '4:3, cropped' },
  ];

  const speedOptions: DropdownOption[] = [
    { value: '0.5', label: '0.5× (slow motion)' },
    { value: '0.75', label: '0.75×' },
    { value: '1.0', label: '1× (normal)' },
    { value: '1.25', label: '1.25×' },
    { value: '1.5', label: '1.5×' },
    { value: '2.0', label: '2×' },
  ];

  const maxFileSizeOptions: DropdownOption[] = [
    { value: 'none', label: 'No Limit (Max Fidelity)' },
    { value: '8M', label: 'Discord Free (8 MB)', badge: '8MB' },
    { value: '15M', label: 'Twitter / X (15 MB)', badge: '15MB' },
    { value: '25M', label: 'Discord Nitro (25 MB)', badge: '25MB' },
    { value: '50M', label: 'Web / Telegram (50 MB)', badge: '50MB' },
  ];

  const accent = theme.gifAccent;
  const hasSource = Boolean(localFilePath || selectedHistoryFile || url);
  const sourceCard = (active: boolean) =>
    `w-full p-3.5 rounded-control border text-left transition-colors ${active ? 'bg-white/[0.07]' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'}`;
  const sourceStyle = (active: boolean) => (active ? { borderColor: `${accent}99` } : undefined);
  const chip = (on: boolean) =>
    `flex-1 px-3 py-2 rounded-control border flex items-center justify-between gap-2 text-[13px] font-semibold transition-colors ${on ? 'text-white' : 'text-gray-300 border-white/[0.06] hover:bg-white/[0.05]'}`;

  return (
    <div className="w-[1050px] h-[580px] rounded-panel shadow-2xl p-6 flex gap-6 relative" style={{ backgroundColor: theme.panelOuter }}>

      {/* Left arrow back to the downloader */}
      <div
        onClick={handleSwitchToMain}
        className="absolute -left-16 top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-40"
      >
        <button
          className="w-12 h-28 rounded-card flex flex-col items-center justify-center gap-1.5 transition-all group-hover:scale-110 active:scale-95 relative overflow-hidden"
          style={{
            backgroundColor: theme.btnDarkBg,
            color: accent,
            border: `1px solid rgba(245, 158, 11, 0.25)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 12px rgba(0,0,0,0.25)`
          }}
          title="Back to Downloader"
        >
          <ChevronLeft size={28} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" style={{ color: accent, filter: `drop-shadow(0 2px 8px ${accent}88)` }} />
          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: accent, textShadow: `0 2px 10px ${accent}aa` }}>
            MAIN
          </span>
        </button>
      </div>

      {/* Left: pick one source */}
      <div className="flex-1 rounded-card p-6 flex flex-col min-w-0" style={{ backgroundColor: theme.panelInner }}>
        <PanelTitle>Source</PanelTitle>

        <div className="flex flex-col gap-3 min-h-0">
          {/* Local file */}
          <button onClick={handlePickLocalVideo} className={sourceCard(selectedSourceType === 'local')} style={sourceStyle(selectedSourceType === 'local')}>
            <div className="flex items-center gap-3 min-w-0">
              <HardDrive size={18} className="shrink-0" style={{ color: accent }} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-white">Video file on this PC</div>
                <div className="text-[12px] text-gray-400 truncate">
                  {localFilePath ? localFilePath.split('\\').pop() : 'MP4, MOV, MKV, AVI…'}
                </div>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider shrink-0" style={{ color: accent }}>{localFilePath ? 'Change' : 'Browse'}</span>
            </div>
          </button>

          {/* From history */}
          <div className={sourceCard(selectedSourceType === 'history')} style={sourceStyle(selectedSourceType === 'history')}>
            <div className="flex items-center gap-3 mb-2">
              <History size={18} className="shrink-0" style={{ color: accent }} />
              <div className="text-[14px] font-semibold text-white">From your downloads</div>
            </div>
            {videoHistory.length > 0 ? (
              <div className="max-h-[200px] overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                {videoHistory.map((v: any, i: number) => {
                  const picked = selectedSourceType === 'history' && selectedHistoryFile === v.filename;
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedHistoryFile(v.filename); setSelectedSourceType('history'); }}
                      className={`px-2.5 py-1.5 rounded-chip text-[12px] text-left truncate transition-colors flex items-center justify-between gap-2 ${picked ? 'bg-white/10 text-white font-semibold' : 'text-gray-300 hover:bg-white/[0.06]'}`}
                      title={v.filename}
                    >
                      <span className="truncate">{v.filename}</span>
                      {picked && <Check size={14} className="shrink-0" style={{ color: accent }} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-[12px] text-gray-500">Videos you download will show up here.</div>
            )}
          </div>

          {/* From a link */}
          <div className={sourceCard(selectedSourceType === 'url')} style={sourceStyle(selectedSourceType === 'url')}>
            <label htmlFor="gif-url" className="flex items-center gap-3 mb-2 cursor-text">
              <Film size={18} className="shrink-0" style={{ color: accent }} />
              <span className="text-[14px] font-semibold text-white">From a link</span>
            </label>
            <input
              id="gif-url" type="text" placeholder="Paste a video link" value={url}
              onChange={e => { setUrl(e.target.value); setSelectedSourceType('url'); }}
              onFocus={() => url && setSelectedSourceType('url')}
              className={fieldClass}
            />
          </div>
        </div>
      </div>

      {/* Right: output options and the create button */}
      <div className="flex-[1.2] rounded-card p-6 flex flex-col justify-between min-w-0" style={{ backgroundColor: theme.panelInner }}>
        <div className="flex flex-col gap-3">
          <PanelTitle aside={
            <button
              onClick={() => setShowQualityModal(true)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/[0.08] hover:bg-white/[0.06] transition-colors flex items-center gap-1.5 text-[#D9D9D9]"
              title="Frame rate, resolution, dithering and size limit"
            >
              <Sliders size={13} style={{ color: accent }} />
              <span>{qualitySummary}</span>
            </button>
          }>
            Output
          </PanelTitle>

          {/* Format */}
          <div className="flex p-1 rounded-control bg-[#17171d] border border-white/[0.06] -mt-3" role="tablist">
            {([['gif', 'GIF', 'Silent, plays anywhere'], ['loop_mp4', 'Looping MP4', 'Smaller, keeps the sound']] as const).map(([key, label, sub]) => (
              <button
                key={key} role="tab" aria-selected={gifFormat === key} onClick={() => setGifFormat(key)}
                className={`flex-1 py-1.5 rounded-chip text-center transition-colors ${gifFormat === key ? 'bg-white/10' : 'hover:bg-white/[0.04]'}`}
              >
                <div className={`text-[13px] font-bold ${gifFormat === key ? 'text-white' : 'text-gray-400'}`}>{label}</div>
                <div className="text-[11px] text-gray-500">{sub}</div>
              </button>
            ))}
          </div>

          {/* Trim */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <FieldLabel htmlFor="gif-start">Start</FieldLabel>
              <input id="gif-start" type="text" value={startTime} onChange={e => setStartTime(e.target.value)} placeholder="00:00:00" className={`${fieldClass} font-mono tabular-nums`} />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <FieldLabel htmlFor="gif-end">End</FieldLabel>
              <input id="gif-end" type="text" value={endTime} onChange={e => setEndTime(e.target.value)} placeholder="00:00:10" className={`${fieldClass} font-mono tabular-nums`} />
            </div>
          </div>

          {/* Crop and speed */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <FieldLabel>Shape</FieldLabel>
              <CustomDropdown value={crop} options={cropOptions} onChange={setCrop} theme={theme} accentColor={accent} className="w-full" align="left" />
            </div>
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <FieldLabel>Speed</FieldLabel>
              <CustomDropdown value={speed} options={speedOptions} onChange={setSpeed} theme={theme} accentColor={accent} className="w-full" />
            </div>
          </div>

          {/* Effects */}
          <div className="flex gap-3">
            <div className={chip(boomerang)} style={boomerang ? { borderColor: `${accent}66` } : undefined} title="Plays forward, then backwards">
              <span className="flex items-center gap-2"><Repeat size={15} className="text-gray-400" />Boomerang</span>
              <Toggle on={boomerang} onChange={setBoomerang} accent={accent} label="Boomerang" />
            </div>
            <div className={chip(showMemeInputs || Boolean(memeTop || memeBottom))} style={showMemeInputs || memeTop || memeBottom ? { borderColor: `${accent}66` } : undefined} title="Big captions at the top and bottom">
              <span className="flex items-center gap-2"><Type size={15} className="text-gray-400" />Captions</span>
              <Toggle on={showMemeInputs} onChange={v => { setShowMemeInputs(v); if (!v) { setMemeTop(''); setMemeBottom(''); } }} accent={accent} label="Captions" />
            </div>
          </div>

          <AnimatePresence>
            {showMemeInputs && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden flex gap-3"
              >
                <input type="text" value={memeTop} onChange={e => setMemeTop(e.target.value)} placeholder="Top caption" aria-label="Top caption" className={`${fieldClass} uppercase font-bold`} />
                <input type="text" value={memeBottom} onChange={e => setMemeBottom(e.target.value)} placeholder="Bottom caption" aria-label="Bottom caption" className={`${fieldClass} uppercase font-bold`} />
              </motion.div>
            )}
          </AnimatePresence>

          <input
            type="text" placeholder="File name (optional)" aria-label="File name"
            value={customGifName} onChange={e => setCustomGifName(e.target.value)} className={fieldClass}
          />
        </div>

        <button
          onClick={handleStartGifRender}
          disabled={isDownloading || !hasSource}
          className="w-full py-3.5 rounded-control font-black uppercase tracking-wider text-base text-black transition-all active:translate-y-[2px] flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:!bg-[#2a2b36] disabled:!text-gray-500 disabled:!shadow-none"
          style={{ backgroundColor: accent, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 5px 0 #b45309, 0 8px 15px rgba(245,158,11,0.3)` }}
        >
          <Sparkles size={18} />
          <span>{isDownloading ? 'Working…' : !hasSource ? 'Pick a video first' : gifFormat === 'gif' ? 'Create GIF' : 'Create looping MP4'}</span>
        </button>
      </div>

      {/* Quality settings */}
      <AnimatePresence>
        {showQualityModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4 pointer-events-auto"
            onClick={() => setShowQualityModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[480px] p-6 rounded-panel shadow-2xl flex flex-col gap-4 relative border border-white/10"
              style={{ backgroundColor: theme.panelOuter, color: theme.textMain }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5"><Sliders size={20} style={{ color: accent }} />Quality</h3>
                <button onClick={() => setShowQualityModal(false)} className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Close">
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col">
                <SettingRow label="Frame rate" hint="Lower is smaller">
                  <CustomDropdown
                    value={fps}
                    options={[
                      { value: 'original', label: 'Original' },
                      { value: '60', label: '60 FPS' }, { value: '50', label: '50 FPS' }, { value: '30', label: '30 FPS' },
                      { value: '24', label: '24 FPS' }, { value: '15', label: '15 FPS' },
                    ]}
                    onChange={setFps} theme={theme} accentColor={accent} minWidth={170}
                  />
                </SettingRow>
                <SettingRow label="Resolution">
                  <CustomDropdown
                    value={scale}
                    options={[
                      { value: 'original', label: 'Original' },
                      { value: '1080p', label: '1080p' }, { value: '720p', label: '720p' },
                      { value: '480p', label: '480p' }, { value: '360p', label: '360p' },
                    ]}
                    onChange={setScale} theme={theme} accentColor={accent} minWidth={170}
                  />
                </SettingRow>
                <SettingRow label="Dithering" hint="GIFs only">
                  <CustomDropdown
                    value={dither}
                    options={[
                      { value: 'bayer', label: 'Bayer (pattern)', desc: 'Good default' },
                      { value: 'sierra', label: 'Sierra (smooth)', desc: 'Best for gradients' },
                      { value: 'floyd', label: 'Floyd-Steinberg', desc: 'Fine detail' },
                      { value: 'none', label: 'None', desc: 'Flat colours, cartoons' },
                    ]}
                    onChange={setDither} theme={theme} accentColor={accent} minWidth={170}
                  />
                </SettingRow>
                <SettingRow label="Size limit">
                  <CustomDropdown value={maxFileSize} options={maxFileSizeOptions} onChange={setMaxFileSize} theme={theme} accentColor={accent} minWidth={170} />
                </SettingRow>
              </div>

              <button
                onClick={() => setShowQualityModal(false)}
                className="w-full py-3 rounded-control font-bold text-sm uppercase tracking-wider text-black transition-all active:scale-[0.98]"
                style={{ backgroundColor: accent, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 0 #b45309` }}
              >
                Done
              </button>
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
  gifFps, setGifFps, 
  gifScale, setGifScale, 
  gifDither, setGifDither, 
  gifAudioLoop, setGifAudioLoop, 
  gifMaxFileSize, setGifMaxFileSize,
  downloadFolder, changeDownloadFolder, openDownloadFolder,
  historyItems, onShareFile,
  cookieStatus, fetchCookieStatus,
  twitchToken, setTwitchToken
}: any) {
  const isGifSection = activeSection === 'gif';
  const isLiveSection = activeSection === 'live_dvr';
  const accentColor = isLiveSection ? theme.liveAccent : isGifSection ? theme.gifAccent : theme.accent;

  const [cookieSyncStatus, setCookieSyncStatus] = useState<string | null>(null);
  const [isSyncingCookies, setIsSyncingCookies] = useState(false);
  const [isImportingCookies, setIsImportingCookies] = useState(false);
  const [twitchTokenInput, setTwitchTokenInput] = useState(twitchToken || '');
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [showTokenText, setShowTokenText] = useState(false);
  const [showTwitchHelp, setShowTwitchHelp] = useState(false);
  const [rightTab, setRightTab] = useState<'history' | 'signin'>('history');

  useEffect(() => {
    if (twitchToken) setTwitchTokenInput(twitchToken);
  }, [twitchToken]);

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
        setCookieSyncStatus(data.youTubeLoggedIn ? 'Synced (YouTube signed in)' : 'Synced, but YouTube not signed in');
        setBrowserCookies(browser);
        if (fetchCookieStatus) fetchCookieStatus();
      } else {
        setCookieSyncStatus(`Note: ${data.error || 'Failed'}`);
      }
    } catch(e: any) {
      setCookieSyncStatus(`Failed: ${e.message}`);
    } finally {
      setIsSyncingCookies(false);
    }
  };

  const handleImportCookiesFile = async () => {
    if (isImportingCookies) return;
    setIsImportingCookies(true);
    try {
      const res = await fetch('/api/import_cookies', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCookieSyncStatus("Cookies imported successfully!");
        if (fetchCookieStatus) fetchCookieStatus();
      } else if (data.error && data.error !== 'Dialog cancelled or window unavailable') {
        setCookieSyncStatus(`Import error: ${data.error}`);
      }
    } catch(e: any) {
      setCookieSyncStatus(`Import failed: ${e.message}`);
    } finally {
      setIsImportingCookies(false);
    }
  };

  const handleSaveTwitchToken = async () => {
    if (isSavingToken) return;
    setIsSavingToken(true);
    try {
      const res = await fetch('/api/save_twitch_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: twitchTokenInput })
      });
      const data = await res.json();
      if (data.success) {
        if (setTwitchToken) setTwitchToken(twitchTokenInput);
        if (fetchCookieStatus) fetchCookieStatus();
        setCookieSyncStatus(twitchTokenInput ? "Twitch token saved!" : "Twitch token cleared.");
      }
    } catch(e: any) {
      setCookieSyncStatus(`Error: ${e.message}`);
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleClearCookies = async () => {
    try {
      const res = await fetch('/api/clear_cookies', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTwitchTokenInput('');
        if (setTwitchToken) setTwitchToken('');
        if (fetchCookieStatus) fetchCookieStatus();
        setCookieSyncStatus("All cookies and tokens cleared.");
      }
    } catch(e) {}
  };

  const displayedHistory = isGifSection 
    ? (historyItems || []).filter((h: any) => {
        const fn = (h.filename || '').toLowerCase();
        const type = (h.type || '').toUpperCase();
        return fn.endsWith('.gif') || fn.endsWith('.webp') || type === 'GIF' || type === 'LOOP_MP4' || type === 'WEBP';
      })
    : historyItems;

  const qualityOptions: DropdownOption[] = [
    { value: 'Best', label: 'Best available', desc: 'Up to 4K, whatever the video has' },
    { value: '1440p', label: '1440p' },
    { value: '1080p', label: '1080p' },
    { value: '720p', label: '720p' },
    { value: '480p', label: '480p' },
  ];

  const browserOptions: DropdownOption[] = [
    { value: 'none', label: 'Choose a browser' },
    { value: 'chrome', label: 'Google Chrome' },
    { value: 'firefox', label: 'Mozilla Firefox' },
    { value: 'brave', label: 'Brave Browser' },
    { value: 'edge', label: 'Microsoft Edge' },
    { value: 'opera', label: 'Opera' },
    { value: 'operagx', label: 'Opera GX' },
    { value: 'vivaldi', label: 'Vivaldi' },
  ];

  const codecOptions: DropdownOption[] = [
    { value: 'auto', label: 'Automatic', desc: 'Best quality the site offers' },
    { value: 'h264', label: 'H.264', desc: 'Plays on every device' },
    { value: 'av1', label: 'AV1', desc: 'Smallest files, newer devices' },
  ];

  const sectionName = isLiveSection ? 'Live recorder' : isGifSection ? 'GIF studio' : 'Downloader';
  const ytSignedIn = Boolean(cookieStatus?.hasYouTube);

  return (
    <div className="w-[1050px] h-[580px] rounded-panel shadow-2xl p-6 flex gap-6 relative" style={{ backgroundColor: theme.panelOuter }}>

      {/* Left: the settings for this section, as one flat list */}
      <div className="flex-1 rounded-card p-6 flex flex-col justify-between min-w-0" style={{ backgroundColor: theme.panelInner }}>
        <div className="min-h-0 overflow-y-auto custom-scrollbar pr-1">
          <PanelTitle aside={<span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border" style={{ color: accentColor, borderColor: `${accentColor}55` }}>{sectionName}</span>}>
            Settings
          </PanelTitle>

          {isGifSection ? (
            <div className="flex flex-col">
              <SettingRow label="Frame rate" hint="Lower frame rates make smaller files">
                <CustomDropdown
                  value={gifFps}
                  options={[
                    { value: 'original', label: 'Original' },
                    { value: '60', label: '60 FPS' }, { value: '50', label: '50 FPS' }, { value: '30', label: '30 FPS' },
                    { value: '24', label: '24 FPS' }, { value: '15', label: '15 FPS' },
                  ]}
                  onChange={setGifFps} theme={theme} size="sm" accentColor={accentColor} minWidth={150}
                />
              </SettingRow>
              <SettingRow label="Resolution">
                <CustomDropdown
                  value={gifScale}
                  options={[
                    { value: 'original', label: 'Original' },
                    { value: '1080p', label: '1080p' }, { value: '720p', label: '720p' },
                    { value: '480p', label: '480p' }, { value: '360p', label: '360p' },
                  ]}
                  onChange={setGifScale} theme={theme} size="sm" accentColor={accentColor} minWidth={150}
                />
              </SettingRow>
              <SettingRow label="Dithering" hint="How missing colours are blended in a GIF">
                <CustomDropdown
                  value={gifDither}
                  options={[
                    { value: 'bayer', label: 'Bayer (pattern)' },
                    { value: 'sierra', label: 'Sierra (smooth)' },
                    { value: 'floyd', label: 'Floyd-Steinberg' },
                    { value: 'none', label: 'None' }
                  ]}
                  onChange={setGifDither} theme={theme} size="sm" accentColor={accentColor} minWidth={150}
                />
              </SettingRow>
              <SettingRow label="Sound in looping clips" hint="Keep the audio when making a looping MP4">
                <Toggle on={gifAudioLoop} onChange={setGifAudioLoop} accent={accentColor} label="Sound in looping clips" />
              </SettingRow>
            </div>
          ) : (
            <div className="flex flex-col">
              <SettingRow label="Video quality">
                <CustomDropdown value={quality} options={qualityOptions} onChange={setQuality} theme={theme} size="sm" accentColor={accentColor} minWidth={170} />
              </SettingRow>
              <SettingRow label="Video codec" hint="H.264 plays everywhere, AV1 makes smaller files">
                <CustomDropdown value={videoCodec} options={codecOptions} onChange={setVideoCodec} theme={theme} size="sm" accentColor={accentColor} minWidth={170} />
              </SettingRow>
              <SettingRow icon={<Zap size={16} />} label="Turbo downloads" hint="Downloads in 16 parallel parts, falls back automatically">
                <Toggle on={turboMode} onChange={setTurboMode} accent={accentColor} label="Turbo downloads" />
              </SettingRow>
              <SettingRow icon={<ListPlus size={16} />} label="Split into chapters" hint="One file per chapter, for albums and DJ sets">
                <Toggle on={splitChapters} onChange={setSplitChapters} accent={accentColor} label="Split into chapters" />
              </SettingRow>
              <SettingRow icon={<Shield size={16} />} label="Skip sponsor segments" hint="Cuts sponsor, intro and outro parts (SponsorBlock)">
                <Toggle on={sponsorBlock} onChange={setSponsorBlock} accent={accentColor} label="Skip sponsor segments" />
              </SettingRow>
            </div>
          )}
        </div>

        <div className="pt-4">
          <FolderField folder={downloadFolder} onChange={changeDownloadFolder} onOpen={openDownloadFolder} accent={accentColor} />
        </div>
      </div>

      {/* Right: history, plus sign-in for the download sections */}
      <div className="flex-1 rounded-card p-6 flex flex-col min-w-0" style={{ backgroundColor: theme.panelInner }}>
        <PanelTitle aside={!isGifSection ? (
          <div className="flex p-1 rounded-control bg-[#17171d] border border-white/[0.06]" role="tablist">
            {([['history', 'History'], ['signin', 'Sign-in']] as const).map(([key, label]) => (
              <button
                key={key} role="tab" aria-selected={rightTab === key} onClick={() => setRightTab(key)}
                className={`px-3 py-1 rounded-chip text-xs font-bold transition-colors flex items-center gap-1.5 ${rightTab === key ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {label}
                {key === 'signin' && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ytSignedIn ? '#10B981' : '#6b6c78' }} />}
              </button>
            ))}
          </div>
        ) : <span className="text-xs font-mono text-gray-500">{(displayedHistory || []).length} items</span>}>
          {rightTab === 'signin' && !isGifSection ? 'Sign-in & cookies' : 'History'}
        </PanelTitle>

        {rightTab === 'signin' && !isGifSection ? (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-5">
            {/* Status */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-control bg-white/[0.04] border border-white/[0.06]">
              <Cookie size={16} className={cookieStatus?.hasCookies ? 'text-emerald-400' : 'text-gray-500'} />
              <span className="text-[13px] text-[#D9D9D9] truncate">
                {cookieStatus?.hasCookies ? cookieStatus.summary : 'No cookies stored. Needed only for members-only, age-restricted or sub-only videos.'}
              </span>
            </div>

            {/* Browser sync */}
            <div className="flex flex-col gap-2">
              <FieldLabel>Copy login from a browser</FieldLabel>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <CustomDropdown value={browserCookies} options={browserOptions} onChange={setBrowserCookies} theme={theme} accentColor={accentColor} className="w-full" align="left" />
                </div>
                <button
                  onClick={() => handleSyncBrowserCookies(browserCookies === 'none' ? 'chrome' : browserCookies)}
                  disabled={isSyncingCookies}
                  className="px-4 py-2 rounded-control text-xs font-bold uppercase tracking-wider text-white shrink-0 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSyncingCookies ? 'Syncing…' : 'Sync'}
                </button>
              </div>
              <span className="text-[11px] text-gray-400">Close the browser first, it locks its cookie database while running. Only youtube.com cookies are kept.</span>
              {cookieSyncStatus && <span className="text-[12px] text-amber-300">{cookieSyncStatus}</span>}
            </div>

            {/* Cookie file */}
            <div className="flex flex-col gap-2">
              <FieldLabel>Cookie file</FieldLabel>
              <div className="flex gap-2">
                <button
                  onClick={handleImportCookiesFile} disabled={isImportingCookies}
                  className="flex-1 px-3 py-2 rounded-control border border-white/[0.08] hover:bg-white/10 text-[#D9D9D9] font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  title="Import a cookies.txt file exported from your browser"
                >
                  <FileText size={14} />
                  <span>{isImportingCookies ? 'Importing…' : 'Import cookies.txt'}</span>
                </button>
                <button
                  onClick={handleClearCookies} disabled={!cookieStatus?.hasCookies && !twitchTokenInput}
                  className="px-3 py-2 rounded-control border border-red-500/25 hover:bg-red-500/15 text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-30"
                  title="Delete all stored cookies and the Twitch token"
                >
                  <Trash2 size={14} />
                  <span>Clear all</span>
                </button>
              </div>
            </div>

            {/* Twitch token */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="twitch-token">Twitch token (sub-only VODs)</FieldLabel>
                <button onClick={() => setShowTwitchHelp(!showTwitchHelp)} className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1">
                  <HelpCircle size={12} /><span>How to get it</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="twitch-token"
                  type={showTokenText ? "text" : "password"}
                  value={twitchTokenInput}
                  onChange={e => setTwitchTokenInput(e.target.value)}
                  placeholder="Paste your auth-token"
                  className={`${fieldClass} font-mono`}
                />
                <button onClick={() => setShowTokenText(!showTokenText)} className="p-2 rounded-control border border-white/[0.08] hover:bg-white/10 text-gray-300 shrink-0" title={showTokenText ? "Hide token" : "Show token"}>
                  {showTokenText ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={handleSaveTwitchToken} disabled={isSavingToken}
                  className="px-4 py-2 rounded-control text-xs font-bold uppercase tracking-wider border border-white/[0.08] hover:bg-white/10 text-[#D9D9D9] shrink-0 disabled:opacity-50"
                >
                  {isSavingToken ? '…' : 'Save'}
                </button>
              </div>
              {showTwitchHelp && (
                <ol className="text-[12px] text-gray-300 leading-relaxed list-decimal pl-5 flex flex-col gap-0.5">
                  <li>Open <span className="font-mono">twitch.tv</span> in a browser where you're signed in with the sub.</li>
                  <li>Press <kbd className="px-1 rounded-chip bg-white/10 font-mono">F12</kbd> and open <strong>Application</strong> (<strong>Storage</strong> in Firefox).</li>
                  <li>Under <strong>Cookies</strong>, pick <span className="font-mono">https://www.twitch.tv</span>.</li>
                  <li>Copy the value of <span className="font-mono text-white">auth-token</span> and paste it here.</li>
                </ol>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
              {displayedHistory && displayedHistory.length > 0 ? (
                displayedHistory.map((item: any, index: number) => (
                  <div key={index} className="px-3 py-2.5 rounded-control bg-white/[0.04] border border-white/[0.06] flex items-center justify-between gap-3 hover:bg-white/[0.08] transition-colors">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[13px] font-semibold text-white truncate" title={item.filename}>{item.filename}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.type && <span className="text-[10px] font-bold uppercase px-1.5 py-px rounded-chip bg-white/10 text-gray-300">{item.type}</span>}
                        <span className="text-[11px] font-mono text-gray-500">{item.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => onShareFile(item.filename)} className="p-2 rounded-chip text-gray-400 hover:bg-white/10 hover:text-white transition-colors" title="Send to your phone over Wi-Fi (QR code)">
                        <Smartphone size={15} />
                      </button>
                      <button onClick={() => fetch('/api/open_folder', { method: 'POST' })} className="p-2 rounded-chip text-gray-400 hover:bg-white/10 hover:text-white transition-colors" title="Open the download folder">
                        <FolderOpen size={15} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-gray-500">
                  <History size={28} className="opacity-50" />
                  <span className="text-[13px]">Nothing downloaded yet.</span>
                </div>
              )}
            </div>
            <div className="text-[11px] font-mono text-center text-gray-500 pt-3 mt-3 border-t border-white/[0.06]">
              Levi's YouTube Downloader Pro · v1.1.0-dev
            </div>
          </>
        )}
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
    <div className="w-[1050px] h-[580px] rounded-panel shadow-2xl p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelOuter }}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[24px] font-bold text-white">Stream & Process Log</h2>
            <div className="flex gap-1.5 p-1 rounded-control bg-black/40 border border-white/5">
              <button 
                onClick={() => setFilter('all')} 
                className={`px-3 py-1 rounded-chip text-xs font-bold transition-all ${filter === 'all' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                All Logs ({logs.length})
              </button>
              <button 
                onClick={() => setFilter('engine')} 
                className={`px-3 py-1 rounded-chip text-xs font-bold transition-all ${filter === 'engine' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Engine Stream
              </button>
              <button 
                onClick={() => setFilter('errors')} 
                className={`px-3 py-1 rounded-chip text-xs font-bold transition-all ${filter === 'errors' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}
              >
                Errors Only
              </button>
            </div>
          </div>

          <button 
            onClick={handleCopyLogs}
            className="px-3.5 py-1.5 rounded-control text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white flex items-center gap-1.5"
          >
            <Copy size={14} />
            <span>{copied ? 'Copied!' : 'Copy All'}</span>
          </button>
        </div>

        {/* Terminal Window */}
        <div className="w-full h-[450px] p-4 rounded-card bg-black/70 border border-white/10 font-mono text-xs overflow-y-auto custom-scrollbar flex flex-col gap-1 shadow-inner select-text">
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
    <div className="w-[1050px] h-[580px] rounded-panel shadow-2xl p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelOuter }}>
      <div>
        <h2 className="text-[24px] font-bold text-white mb-2">Engine Updater Pipeline</h2>
        <p className="text-xs text-gray-400 mb-4">Fetching the latest upstream `yt-dlp` core binaries and dependencies...</p>

        <div className="w-full h-[410px] p-4 rounded-card bg-black/70 border border-white/10 font-mono text-xs overflow-y-auto custom-scrollbar flex flex-col gap-1 shadow-inner select-text">
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
          className="py-3 px-8 rounded-control font-bold text-sm uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-all"
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
        className="w-full max-w-[500px] p-7 rounded-panel shadow-2xl flex flex-col gap-5 relative border border-white/10"
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
          className="w-full px-4 py-3 rounded-control bg-black/50 border border-white/15 text-sm text-white font-medium outline-none shadow-inner"
          autoFocus
        />

        <div className="flex gap-3 mt-2">
          <button 
            onClick={handleSave}
            className="flex-1 py-3 rounded-control font-bold text-sm uppercase tracking-wider text-white shadow-lg transition-all active:scale-[0.98]"
            style={{ backgroundColor: theme.accent, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 0 #99001b` }}
          >
            Apply Name
          </button>
          <button 
            onClick={() => { setCustomName(''); setActiveView('main'); }}
            className="px-4 py-3 rounded-control font-bold text-sm text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-all"
          >
            Clear
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}