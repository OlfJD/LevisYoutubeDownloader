/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, X, ChevronDown, PenLine, FolderOpen, RefreshCcw, Square, 
  AlertCircle, Sparkles, Film, Music, Sliders, Scissors, Volume2, 
  VolumeX, Zap, Check, Copy, ExternalLink, FolderCheck, Tv, Share2, 
  Play, FileVideo, Video, Globe, Search, Terminal, History, ArrowRight,
  Radio, HardDrive, DownloadCloud, FileCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ThemeEditor from './ThemeEditor';

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
      className="w-full h-11 flex items-center justify-between pl-6 pr-2 select-none relative z-[100] pywebview-drag"
      style={{ backgroundColor: 'rgba(0,0,0,0.22)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/5 border border-white/5">
          <Sparkles size={14} className="text-amber-400" />
          <span className="text-xs font-bold tracking-wider uppercase" style={{ color: theme.textSecondary }}>
            Levi's Media Engine
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            DEV PRO v1.1.0
          </span>
        </div>
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

// Helper to detect platform
function detectPlatform(urlStr: string) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const u = urlStr.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    return { name: 'YouTube', icon: Video, color: '#FF0033', bg: 'rgba(255,0,51,0.12)', border: 'rgba(255,0,51,0.3)' };
  }
  if (u.includes('tiktok.com')) {
    return { name: 'TikTok', icon: Music, color: '#00F2FE', bg: 'rgba(0,242,254,0.12)', border: 'rgba(0,242,254,0.3)' };
  }
  if (u.includes('twitter.com') || u.includes('x.com')) {
    return { name: 'Twitter / X', icon: Share2, color: '#38BDF8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.3)' };
  }
  if (u.includes('instagram.com')) {
    return { name: 'Instagram', icon: Film, color: '#E1306C', bg: 'rgba(225,48,108,0.12)', border: 'rgba(225,48,108,0.3)' };
  }
  if (u.includes('twitch.tv')) {
    return { name: 'Twitch', icon: Tv, color: '#9146FF', bg: 'rgba(145,70,255,0.12)', border: 'rgba(145,70,255,0.3)' };
  }
  if (u.includes('reddit.com') || u.includes('redd.it')) {
    return { name: 'Reddit', icon: Share2, color: '#FF4500', bg: 'rgba(255,69,0,0.12)', border: 'rgba(255,69,0,0.3)' };
  }
  if (u.includes('facebook.com') || u.includes('fb.watch')) {
    return { name: 'Facebook', icon: Video, color: '#1877F2', bg: 'rgba(24,119,242,0.12)', border: 'rgba(24,119,242,0.3)' };
  }
  if (u.includes('vimeo.com')) {
    return { name: 'Vimeo', icon: Play, color: '#1AB7EA', bg: 'rgba(26,183,234,0.12)', border: 'rgba(26,183,234,0.3)' };
  }
  if (u.includes('soundcloud.com')) {
    return { name: 'SoundCloud', icon: Radio, color: '#FF5500', bg: 'rgba(255,85,0,0.12)', border: 'rgba(255,85,0,0.3)' };
  }
  if (u.includes('.m3u8') || u.includes('.mpd') || u.includes('.mp4')) {
    return { name: 'Direct Stream', icon: Globe, color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' };
  }
  if (u.startsWith('http://') || u.startsWith('https://')) {
    return { name: 'Universal Web Media', icon: Globe, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' };
  }
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'universal' | 'gif_studio' | 'history' | 'settings' | 'log'>('universal');
  
  // Download State
  const [url, setUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [playlistMode, setPlaylistMode] = useState(false);
  const [showPlaylistPopup, setShowPlaylistPopup] = useState(false);
  const [quality, setQuality] = useState('Best');
  const [downloadFolder, setDownloadFolder] = useState('');

  // Trimming State
  const [enableTrim, setEnableTrim] = useState(false);
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:15');

  // Updates State
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // History State
  const [historyItems, setHistoryItems] = useState<{date: string, filename: string, type?: string}[]>([]);

  // Theme State
  const [theme, setTheme] = useState({
    bg: '#171720',
    textMain: '#E8E8EE',
    textSecondary: '#A0A0B2',
    accent: '#FF0033',
    accentGradient: 'linear-gradient(135deg, #FF0033 0%, #D8002B 100%)',
    inputBg: '#232330',
    inputText: '#F0F0F8',
    btnLightBg: '#2c2d3c',
    btnLightBorder: '#3d3e52',
    btnLightText: '#FFFFFF',
    btnDarkBg: '#212230',
    btnDarkBorder: '#161622',
    btnDarkText: '#D9D9E8',
    panelOuter: '#1d1e2a',
    panelInner: '#14141d',
    settingsBtnBg: '#262738',
  });

  const detectedPlatform = useMemo(() => detectPlatform(url), [url]);

  // Pull real history & settings
  const fetchHistory = () => {
    fetch('/api/history').then(r=>r.json()).then(d => setHistoryItems(d || [])).catch(() => {});
  };

  const fetchSettings = () => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if(d.quality) setQuality(d.quality);
        if(d.playlistMode !== undefined) setPlaylistMode(d.playlistMode);
        if(d.downloadDir) setDownloadFolder(d.downloadDir);
      }).catch(() => {});
  };

  useEffect(() => { 
    fetchHistory(); 
    fetchSettings();
  }, []);

  // Startup Update Check
  const checkUpdates = async (force: boolean = false) => {
    try {
      const res = await fetch(`/api/check_updates${force ? '?force=true' : ''}`);
      const data = await res.json();
      if (data && data.checked) {
        setUpdateInfo(data);
        setUpdateAvailable(Boolean(data.update_available));
        if (data.update_available) setShowUpdatePopup(true);
      }
    } catch (e) {}
  };

  useEffect(() => {
    checkUpdates();
  }, []);

  const saveSetting = (key: string, value: any) => {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    }).catch(() => {});
  };

  const handleQualityChange = (val: string) => { setQuality(val); saveSetting('quality', val); };
  const handlePlaylistModeChange = (val: boolean) => { setPlaylistMode(val); saveSetting('playlistMode', val); };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (newUrl.includes('list=') && !playlistMode) {
      setShowPlaylistPopup(true);
    }
  };

  const startUniversalDownload = async (format: string, customPayload: any = {}) => {
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
          startTime: enableTrim ? startTime : '',
          endTime: enableTrim ? endTime : '',
          ...customPayload
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
      if (data.success && data.folder) {
        setDownloadFolder(data.folder);
      }
    } catch (error) {}
  };

  const openDownloadFolder = async () => {
    try {
      await fetch('/api/open_folder', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: downloadFolder })
      });
    } catch (error) {}
  };

  const handleUpdate = async () => {
    setActiveTab('log');
    try {
      await fetch('/api/update', { method: 'POST' });
    } catch (error) {}
  };

  return (
    <div 
      className="min-h-screen flex flex-col justify-between font-sans overflow-hidden relative select-none"
      style={{ backgroundColor: theme.bg, color: theme.textMain }}
    >
      {/* Custom Header */}
      <CustomTitleBar theme={theme} />

      {/* Primary Navigation Tabs */}
      <div className="w-full flex justify-center pt-3 pb-1 px-6 relative z-20">
        <div 
          className="flex items-center gap-1.5 p-1.5 rounded-2xl backdrop-blur-xl border border-white/5 shadow-xl"
          style={{ backgroundColor: 'rgba(25, 26, 38, 0.75)' }}
        >
          <TabButton 
            active={activeTab === 'universal'} 
            onClick={() => setActiveTab('universal')} 
            icon={Zap} 
            label="Universal Downloader" 
            badge="Any Site"
            theme={theme}
          />
          <TabButton 
            active={activeTab === 'gif_studio'} 
            onClick={() => setActiveTab('gif_studio')} 
            icon={Film} 
            label="Video to GIF & Loop Studio" 
            badge="Master Quality"
            theme={theme}
          />
          <TabButton 
            active={activeTab === 'history'} 
            onClick={() => { setActiveTab('history'); fetchHistory(); }} 
            icon={History} 
            label="History" 
            count={historyItems.length}
            theme={theme}
          />
          <TabButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
            icon={Settings} 
            label="Settings" 
            theme={theme}
          />
          <TabButton 
            active={activeTab === 'log'} 
            onClick={() => setActiveTab('log')} 
            icon={Terminal} 
            label="Terminal" 
            theme={theme}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col items-center px-4 relative mt-2 pb-6">
        <AnimatePresence mode="wait">
          {activeTab === 'universal' && (
            <motion.div
              key="universal"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="w-full flex flex-col items-center"
            >
              <UniversalDownloaderView 
                url={url}
                setUrl={handleUrlChange}
                detectedPlatform={detectedPlatform}
                theme={theme}
                quality={quality}
                setQuality={handleQualityChange}
                playlistMode={playlistMode}
                setPlaylistMode={handlePlaylistModeChange}
                customName={customName}
                setCustomName={setCustomName}
                enableTrim={enableTrim}
                setEnableTrim={setEnableTrim}
                startTime={startTime}
                setStartTime={setStartTime}
                endTime={endTime}
                setEndTime={setEndTime}
                isDownloading={isDownloading}
                setIsDownloading={setIsDownloading}
                startUniversalDownload={startUniversalDownload}
                setDownloadError={setDownloadError}
                fetchHistory={fetchHistory}
                changeDownloadFolder={changeDownloadFolder}
                openDownloadFolder={openDownloadFolder}
                downloadFolder={downloadFolder}
                updateAvailable={updateAvailable}
                handleUpdate={handleUpdate}
                setActiveTab={setActiveTab}
              />
            </motion.div>
          )}

          {activeTab === 'gif_studio' && (
            <motion.div
              key="gif_studio"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="w-full flex justify-center"
            >
              <GifStudioView 
                theme={theme}
                url={url}
                setUrl={handleUrlChange}
                customName={customName}
                setCustomName={setCustomName}
                downloadFolder={downloadFolder}
                isDownloading={isDownloading}
                setIsDownloading={setIsDownloading}
                setDownloadError={setDownloadError}
                fetchHistory={fetchHistory}
                openDownloadFolder={openDownloadFolder}
              />
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="w-full flex justify-center"
            >
              <HistoryView 
                theme={theme}
                historyItems={historyItems}
                openDownloadFolder={openDownloadFolder}
                downloadFolder={downloadFolder}
              />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="w-full flex justify-center"
            >
              <SettingsView 
                theme={theme}
                setTheme={setTheme}
                playlistMode={playlistMode}
                setPlaylistMode={handlePlaylistModeChange}
                quality={quality}
                setQuality={handleQualityChange}
                downloadFolder={downloadFolder}
                changeDownloadFolder={changeDownloadFolder}
                openDownloadFolder={openDownloadFolder}
                handleUpdate={handleUpdate}
                updateAvailable={updateAvailable}
              />
            </motion.div>
          )}

          {activeTab === 'log' && (
            <motion.div
              key="log"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="w-full flex justify-center"
            >
              <LogView theme={theme} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Playlist Detection Modal */}
      <AnimatePresence>
        {showPlaylistPopup && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4 pointer-events-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[520px] p-8 rounded-[28px] shadow-2xl flex flex-col gap-6 relative border border-white/10"
              style={{ backgroundColor: theme.panelOuter, color: theme.textMain }}
            >
              <button onClick={() => setShowPlaylistPopup(false)} className="absolute top-6 right-6 opacity-60 hover:opacity-100"><X size={26} /></button>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Film size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Playlist Detected</h3>
                  <p className="text-xs text-gray-400">Batch download entire list or single item</p>
                </div>
              </div>
              <p className="text-base opacity-80 leading-relaxed">
                You pasted a playlist link, but Playlist Mode is currently turned off. Would you like to enable it and download the whole playlist?
              </p>
              <div className="flex flex-col gap-3 mt-2">
                <button 
                  onClick={() => { handlePlaylistModeChange(true); setShowPlaylistPopup(false); }} 
                  className="py-3.5 rounded-xl font-bold text-lg transition-transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-2" 
                  style={{ backgroundColor: theme.accent, color: '#fff' }}
                >
                  <Sparkles size={18} /> Turn On Playlist Mode
                </button>
                <button 
                  onClick={() => setShowPlaylistPopup(false)} 
                  className="py-3 rounded-xl font-semibold text-base border border-white/10 hover:bg-white/5 transition-colors" 
                  style={{ color: theme.textSecondary }}
                >
                  No, just this single video
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Error Banner */}
      <AnimatePresence>
        {downloadError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-14 right-6 z-50 p-4 rounded-2xl bg-red-950/90 border border-red-500/30 text-white shadow-2xl backdrop-blur-xl flex items-center gap-3 max-w-md"
          >
            <AlertCircle size={24} className="text-red-400 shrink-0" />
            <div className="flex-1 text-sm">
              <div className="font-bold">Download or Conversion Failed</div>
              <div className="text-xs opacity-80 mt-0.5">Please check the Terminal log or try updating the engine.</div>
            </div>
            <button onClick={() => setDownloadError(false)} className="opacity-60 hover:opacity-100 p-1"><X size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Tab Button Component
function TabButton({ active, onClick, icon: Icon, label, badge, count, theme }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all relative ${
        active ? 'shadow-lg' : 'opacity-70 hover:opacity-100 hover:bg-white/5'
      }`}
      style={{
        backgroundColor: active ? theme.btnLightBg : 'transparent',
        color: active ? '#FFFFFF' : theme.textSecondary,
        border: active ? `1px solid ${theme.btnLightBorder}` : '1px solid transparent'
      }}
    >
      <Icon size={16} className={active ? 'text-amber-400' : ''} />
      <span>{label}</span>
      {badge && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-amber-400/15 text-amber-300 border border-amber-400/20">
          {badge}
        </span>
      )}
      {count !== undefined && count > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-white/10 text-white">
          {count}
        </span>
      )}
    </button>
  );
}

// Universal Downloader Main View
function UniversalDownloaderView({ 
  url, setUrl, detectedPlatform, theme, quality, setQuality, 
  playlistMode, setPlaylistMode, customName, setCustomName,
  enableTrim, setEnableTrim, startTime, setStartTime, endTime, setEndTime,
  isDownloading, setIsDownloading, startUniversalDownload, setDownloadError, 
  fetchHistory, changeDownloadFolder, openDownloadFolder, downloadFolder,
  updateAvailable, handleUpdate, setActiveTab
}: any) {
  const [progress, setProgress] = useState(0);
  const [downloadTitle, setDownloadTitle] = useState('Preparing Engine...');
  const [speedText, setSpeedText] = useState('');

  const handleStopProcess = async () => {
    try { await fetch('/api/stop', { method: 'POST' }); } catch(e){}
    setIsDownloading(false);
  };

  // Progress Poller
  useEffect(() => {
    if (!isDownloading) {
      setProgress(0);
      setDownloadTitle('Preparing Engine...');
      setSpeedText('');
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

        // Parse Progress & Speed
        const dlLogs = logs.filter(l => typeof l === 'string' && l.includes('[download]') && l.includes('%'));
        if (dlLogs.length > 0) {
          const lastLog = dlLogs[dlLogs.length - 1];
          const match = lastLog.match(/(\d+(?:\.\d+)?)%/);
          if (match) setProgress(parseFloat(match[1]));

          const speedMatch = lastLog.match(/at\s+([\d.]+\s*\w+\/s)/);
          if (speedMatch) setSpeedText(speedMatch[1]);
        }

        // Parse Title
        const pMatch = logs.find(l => typeof l === 'string' && l.includes('Downloading video '));
        if (pMatch) {
          const m = pMatch.match(/Downloading video (\d+) of (\d+)/);
          if (m) setDownloadTitle(`Playlist Item ${m[1]} of ${m[2]}`);
        } else if (!customName) {
          const nameLog = logs.find(l => typeof l === 'string' && l.includes('[download] Destination:'));
          if (nameLog) {
            let file = nameLog.split('Destination: ')[1].split('\\').pop().split('/').pop();
            file = file.replace(/\.f\d+\.(m4a|webm|mp4)$/, '');
            setDownloadTitle(file);
          }
        }
      }).catch(() => {});
    }, 250);

    return () => clearInterval(interval);
  }, [isDownloading, customName]);

  const displayTitle = customName ? `${customName} (Custom Prename)` : downloadTitle;

  return (
    <div className="w-full max-w-[860px] flex flex-col items-center gap-5 mt-2">
      {/* Hero Header */}
      <div className="flex flex-col items-center text-center">
        <h1 
          className="text-4xl md:text-5xl font-extrabold tracking-tight select-none backdrop-blur-md py-2 px-8 rounded-3xl border border-white/5 flex items-center gap-3"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 30px rgba(0,0,0,0.3)'
          }}
        >
          <span style={{ color: theme.textMain }}>Universal</span>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-pink-500 to-amber-400">Media Downloader</span>
        </h1>
        <p className="text-xs md:text-sm font-medium opacity-60 mt-2">
          Download ultra-high quality videos, audio, and streams from YouTube, TikTok, Twitter/X, Instagram, Twitch, and 1,000+ sites.
        </p>
      </div>

      {/* URL Input Bar with Platform Pill */}
      <div className="w-full flex flex-col gap-2">
        <div 
          className="w-full relative flex items-center h-14 rounded-2xl border border-white/10 shadow-inner px-3 gap-2 transition-all focus-within:border-red-500/60"
          style={{ backgroundColor: theme.inputBg }}
        >
          {/* Dynamic Platform Badge */}
          {detectedPlatform ? (
            <div 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 animate-fade-in border"
              style={{ 
                color: detectedPlatform.color, 
                backgroundColor: detectedPlatform.bg,
                borderColor: detectedPlatform.border
              }}
            >
              <detectedPlatform.icon size={15} />
              <span>{detectedPlatform.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 bg-white/5 text-gray-400 border border-white/5">
              <Globe size={15} />
              <span>Any URL</span>
            </div>
          )}

          <input 
            type="text" 
            value={url} 
            onChange={(e) => setUrl(e.target.value)} 
            disabled={isDownloading} 
            placeholder="Paste any Video, Media, or Stream Link here..." 
            className="flex-1 bg-transparent px-2 py-1 outline-none font-medium text-lg placeholder:opacity-40 tracking-wide"
            style={{ color: theme.inputText }}
          />

          {url && (
            <button 
              onClick={() => setUrl('')} 
              disabled={isDownloading}
              className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-white/10 transition-all text-gray-300"
              title="Clear URL"
            >
              <X size={20} />
            </button>
          )}

          {isDownloading && (
            <button 
              onClick={handleStopProcess}
              className="px-4 py-2 rounded-xl flex items-center gap-1.5 font-bold text-sm text-white uppercase tracking-wider bg-red-600 hover:bg-red-500 transition-colors shadow-lg animate-pulse"
            >
              <Square size={14} fill="currentColor" /> Stop
            </button>
          )}
        </div>

        {/* Pro Options Bar (Quality, Prename, Trim, Playlist Mode) */}
        <div className="w-full flex flex-wrap items-center justify-between gap-3 px-2 text-xs font-medium" style={{ color: theme.textSecondary }}>
          <div className="flex items-center gap-3">
            {/* Quality Selector */}
            <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5">
              <span className="opacity-70">Quality:</span>
              <select 
                value={quality} 
                onChange={(e) => setQuality(e.target.value)}
                className="bg-transparent font-bold outline-none cursor-pointer text-white"
              >
                <option value="Best" className="bg-gray-900 text-white">Source Max (4K/8K)</option>
                <option value="1440p" className="bg-gray-900 text-white">1440p (2K)</option>
                <option value="1080p" className="bg-gray-900 text-white">1080p (Full HD)</option>
                <option value="720p" className="bg-gray-900 text-white">720p (HD)</option>
                <option value="480p" className="bg-gray-900 text-white">480p (SD)</option>
              </select>
            </div>

            {/* Custom Prename File Pill */}
            <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5">
              <PenLine size={13} className="text-amber-400" />
              <input 
                type="text" 
                placeholder="Custom filename (optional)" 
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="bg-transparent outline-none text-white text-xs w-36 placeholder:opacity-40"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timestamp Trimming Toggle */}
            <button 
              onClick={() => setEnableTrim(!enableTrim)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                enableTrim ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
              }`}
            >
              <Scissors size={13} />
              <span>Trim Clip {enableTrim ? `(${startTime} - ${endTime})` : ''}</span>
            </button>

            {/* Playlist Mode Toggle */}
            <button 
              onClick={() => setPlaylistMode(!playlistMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                playlistMode ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
              }`}
            >
              <Film size={13} />
              <span>Playlist Mode: {playlistMode ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Trim Configuration Bar */}
        <AnimatePresence>
          {enableTrim && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3 rounded-2xl bg-white/5 border border-amber-500/20 flex items-center justify-between gap-4 mt-1">
                <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold">
                  <Scissors size={15} />
                  <span>Segment Trimmer:</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="opacity-70">Start:</span>
                    <input 
                      type="text" 
                      value={startTime} 
                      onChange={e => setStartTime(e.target.value)} 
                      className="w-20 px-2 py-1 rounded bg-black/40 border border-white/10 text-center font-mono text-white text-xs"
                      placeholder="00:00:00"
                    />
                  </div>
                  <span className="opacity-40">→</span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="opacity-70">End:</span>
                    <input 
                      type="text" 
                      value={endTime} 
                      onChange={e => setEndTime(e.target.value)} 
                      className="w-20 px-2 py-1 rounded bg-black/40 border border-white/10 text-center font-mono text-white text-xs"
                      placeholder="00:00:30"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Real-Time Progress Bar & Animated Waveform */}
      <AnimatePresence initial={false}>
        {isDownloading && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="w-full p-4 rounded-2xl border border-red-500/20 shadow-xl overflow-hidden flex flex-col gap-2"
            style={{ backgroundColor: 'rgba(255, 0, 51, 0.05)' }}
          >
            <div className="flex justify-between items-center text-sm font-medium">
              <div className="flex items-center gap-2 truncate max-w-[75%]">
                <span className="px-2 py-0.5 rounded font-mono text-xs bg-red-500/20 text-red-300 border border-red-500/30">
                  DOWNLOADING
                </span>
                <span className="truncate opacity-80" title={displayTitle}>{displayTitle}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {speedText && <span className="text-xs font-mono opacity-60">{speedText}</span>}
                <span className="font-extrabold text-lg text-red-400">{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Progress Bar Line */}
            <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden relative">
              <motion.div 
                className="h-full rounded-full bg-gradient-to-r from-red-500 via-pink-500 to-amber-400"
                style={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
                transition={{ ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Universal Format Selector Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        {/* Video Card */}
        <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Video size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Full Video Streams</h3>
              <p className="text-[11px] opacity-60">High-bitrate video + audio merged</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => startUniversalDownload('mp4')} 
              disabled={isDownloading}
              className="w-full py-3 rounded-xl font-extrabold text-sm uppercase tracking-wider transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText, border: `1px solid ${theme.btnLightBorder}` }}
            >
              <Film size={15} /> Download MP4 ({quality})
            </button>
            <button 
              onClick={() => startUniversalDownload('webm')} 
              disabled={isDownloading}
              className="w-full py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 disabled:opacity-50"
            >
              Download WebM
            </button>
          </div>
        </div>

        {/* Audio Card */}
        <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Music size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Audiophile Audio</h3>
              <p className="text-[11px] opacity-60">HQ 320kbps + Album Art embedded</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => startUniversalDownload('mp3')} 
              disabled={isDownloading}
              className="w-full py-3 rounded-xl font-extrabold text-sm uppercase tracking-wider transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText, border: `1px solid ${theme.btnLightBorder}` }}
            >
              <Music size={15} /> Download MP3 (320k)
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => startUniversalDownload('wav')} 
                disabled={isDownloading}
                className="py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 disabled:opacity-50"
              >
                WAV (PCM)
              </button>
              <button 
                onClick={() => startUniversalDownload('flac')} 
                disabled={isDownloading}
                className="py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 disabled:opacity-50"
              >
                FLAC (Lossless)
              </button>
            </div>
          </div>
        </div>

        {/* GIF & Loop Card */}
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.02] flex flex-col justify-between gap-3 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm">GIF & Sound Loop</h3>
                <p className="text-[11px] opacity-60">Master quality 2-pass palette</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('gif_studio')} 
              className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-0.5"
            >
              Pro Studio <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => startUniversalDownload('gif')} 
              disabled={isDownloading}
              className="w-full py-3 rounded-xl font-extrabold text-sm uppercase tracking-wider transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2 disabled:opacity-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white"
            >
              <Film size={15} /> Download as GIF (HQ)
            </button>
            <button 
              onClick={() => startUniversalDownload('loop_mp4')} 
              disabled={isDownloading}
              className="w-full py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Volume2 size={13} /> Looping Clip (With Sound)
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="w-full flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs opacity-70">
          <FolderOpen size={15} className="text-amber-400" />
          <span className="truncate max-w-[280px]" title={downloadFolder}>{downloadFolder || 'Default Downloads'}</span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={openDownloadFolder}
            className="px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
            title="Open download destination folder in Windows Explorer"
          >
            <FolderCheck size={14} className="text-emerald-400" />
            <span>Open Folder</span>
          </button>
          <button 
            onClick={changeDownloadFolder}
            className="px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
          >
            <FolderOpen size={14} />
            <span>Change Destination</span>
          </button>
          <button 
            onClick={handleUpdate}
            className="px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border"
            style={{
              backgroundColor: updateAvailable ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
              borderColor: updateAvailable ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.05)',
              color: updateAvailable ? '#FBBF24' : theme.textSecondary
            }}
          >
            <RefreshCcw size={14} className={updateAvailable ? 'animate-spin-slow text-amber-400' : ''} />
            <span>{updateAvailable ? 'Update Tool' : 'Engine Up-to-Date'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Video to GIF & Loop Studio View
function GifStudioView({ 
  theme, url, setUrl, customName, setCustomName, downloadFolder,
  isDownloading, setIsDownloading, setDownloadError, fetchHistory, openDownloadFolder
}: any) {
  const [mode, setMode] = useState<'url' | 'local'>('local');
  const [localFile, setLocalFile] = useState('');
  const [localFileInfo, setLocalFileInfo] = useState<any>(null);

  // Conversion Options
  const [targetFormat, setTargetFormat] = useState<'gif' | 'loop_mp4' | 'webp'>('gif');
  const [fps, setFps] = useState('original');
  const [scale, setScale] = useState('original');
  const [dither, setDither] = useState('bayer');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:10');

  const [renderingProgress, setRenderingProgress] = useState(0);

  // Select Local File via Native Windows Dialog
  const handleSelectLocalFile = async () => {
    try {
      const res = await fetch('/api/select_local_file', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.filePath) {
        setLocalFile(data.filePath);
        if (data.info) {
          setLocalFileInfo(data.info);
          if (data.info.duration) {
            const endSec = Math.min(10, Math.floor(data.info.duration));
            setEndTime(`00:00:${endSec < 10 ? '0' : ''}${endSec}`);
          }
        }
      }
    } catch (e) {}
  };

  const handleStartConversion = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadError(false);

    try {
      if (mode === 'local') {
        if (!localFile) {
          setIsDownloading(false);
          return;
        }
        const res = await fetch('/api/convert_local', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: localFile,
            format: targetFormat,
            customName: customName,
            startTime: startTime,
            endTime: endTime,
            fps: fps,
            scale: scale,
            dither: dither
          })
        });
        const data = await res.json();
        if (!data.success) {
          setDownloadError(true);
          setIsDownloading(false);
        }
      } else {
        if (!url) {
          setIsDownloading(false);
          return;
        }
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url,
            format: targetFormat,
            customName: customName,
            startTime: startTime,
            endTime: endTime,
            fps: fps,
            scale: scale,
            dither: dither
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

  // Monitor process
  useEffect(() => {
    if (!isDownloading) return;
    const interval = setInterval(() => {
      fetch('/api/logs').then(r => r.json()).then(logs => {
        if (!Array.isArray(logs)) return;
        if (logs.some(l => l.includes('Process Finished Successfully!'))) {
          setIsDownloading(false);
          fetchHistory();
        } else if (logs.some(l => l.includes('CRITICAL ERROR:'))) {
          setIsDownloading(false);
          setDownloadError(true);
        }
      }).catch(() => {});
    }, 500);
    return () => clearInterval(interval);
  }, [isDownloading]);

  return (
    <div className="w-full max-w-[900px] flex flex-col gap-6 mt-1">
      {/* Studio Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div>
          <h2 className="text-2xl font-extrabold flex items-center gap-2.5">
            <Film className="text-amber-400" />
            <span>Master Video to GIF & Loop Studio</span>
          </h2>
          <p className="text-xs opacity-60 mt-0.5">
            Generate pixel-perfect GIFs retaining 100% original quality & framerate (2-pass palettegen) or Looping Clips with full sound.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/5 text-xs font-bold">
          <button 
            onClick={() => setMode('local')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              mode === 'local' ? 'bg-amber-500 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <HardDrive size={14} /> From Local File
          </button>
          <button 
            onClick={() => setMode('url')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              mode === 'url' ? 'bg-amber-500 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Globe size={14} /> From Web Link
          </button>
        </div>
      </div>

      {/* Source Selection Card */}
      {mode === 'local' ? (
        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col gap-4 shadow-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <FileVideo size={24} />
              </div>
              <div>
                <h4 className="font-bold text-base">Select Local Video File</h4>
                <p className="text-xs opacity-60">Supports MP4, MOV, MKV, WebM, AVI, FLV, TS</p>
              </div>
            </div>
            <button 
              onClick={handleSelectLocalFile}
              className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-black shadow-lg transition-all active:scale-[0.98] flex items-center gap-2"
            >
              <FolderOpen size={16} /> Pick Video File
            </button>
          </div>

          {localFile ? (
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono font-bold text-amber-300 truncate max-w-[500px]" title={localFile}>
                  {localFile}
                </span>
                <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  READY
                </span>
              </div>
              {localFileInfo && (
                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-white/5 text-[11px] opacity-75 font-mono">
                  <div>FPS: <strong className="text-white">{localFileInfo.fps || 'Original'}</strong></div>
                  <div>Res: <strong className="text-white">{localFileInfo.width ? `${localFileInfo.width}x${localFileInfo.height}` : 'Original'}</strong></div>
                  <div>Duration: <strong className="text-white">{localFileInfo.duration ? `${localFileInfo.duration}s` : 'Unknown'}</strong></div>
                  <div>Audio: <strong className="text-white">{localFileInfo.has_audio ? 'Stereo Track' : 'No Audio'}</strong></div>
                </div>
              )}
            </div>
          ) : (
            <div 
              onClick={handleSelectLocalFile}
              className="border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500/40 hover:bg-white/[0.01] transition-all"
            >
              <FileVideo size={36} className="text-gray-500 mb-2" />
              <div className="text-sm font-semibold text-gray-300">Click to Browse and Select a Video File</div>
              <div className="text-xs text-gray-500 mt-1">Convert your recordings, clips, or gameplay to smooth 60fps GIFs</div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col gap-3 shadow-lg">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Web Video / Media URL</label>
          <div className="flex items-center h-12 rounded-xl bg-black/40 border border-white/10 px-3 gap-2">
            <Globe size={18} className="text-amber-400 shrink-0" />
            <input 
              type="text" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="Paste YouTube, TikTok, Twitter/X, Twitch, or Direct Video link..."
              className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:opacity-40"
            />
          </div>
        </div>
      )}

      {/* Target Format & Quality Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Format Selector */}
        <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-400" /> Output Format
          </label>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setTargetFormat('gif')}
              className={`p-3 rounded-xl border text-left transition-all ${
                targetFormat === 'gif' ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
              }`}
            >
              <div className="font-bold text-xs text-amber-300 flex items-center justify-between">
                <span>Master GIF (.gif)</span>
                {targetFormat === 'gif' && <Check size={14} />}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">2-Pass Palettegen, zero color banding, original quality & FPS</div>
            </button>

            <button
              onClick={() => setTargetFormat('loop_mp4')}
              className={`p-3 rounded-xl border text-left transition-all ${
                targetFormat === 'loop_mp4' ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
              }`}
            >
              <div className="font-bold text-xs text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-1"><Volume2 size={13} /> Looping Clip with Sound</span>
                {targetFormat === 'loop_mp4' && <Check size={14} />}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">"GIF with Sound" — Seamless video loop + crystal-clear audio</div>
            </button>

            <button
              onClick={() => setTargetFormat('webp')}
              className={`p-3 rounded-xl border text-left transition-all ${
                targetFormat === 'webp' ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
              }`}
            >
              <div className="font-bold text-xs text-amber-300 flex items-center justify-between">
                <span>Animated WebP (.webp)</span>
                {targetFormat === 'webp' && <Check size={14} />}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">24-bit TrueColor (16.7M colors), 60fps lossless support</div>
            </button>
          </div>
        </div>

        {/* Framerate & Resolution Tuning */}
        <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Sliders size={14} className="text-blue-400" /> Framerate & Scale
          </label>
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-xs opacity-70 block mb-1">Target Framerate (FPS):</span>
              <select 
                value={fps} 
                onChange={e => setFps(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 font-bold text-xs text-white outline-none"
              >
                <option value="original">Preserve Original FPS (100% Smooth)</option>
                <option value="60">60 FPS (Ultra Smooth)</option>
                <option value="30">30 FPS (Standard)</option>
                <option value="24">24 FPS (Cinematic)</option>
                <option value="15">15 FPS (Compact Size)</option>
              </select>
            </div>

            <div>
              <span className="text-xs opacity-70 block mb-1">Resolution Scale:</span>
              <select 
                value={scale} 
                onChange={e => setScale(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 font-bold text-xs text-white outline-none"
              >
                <option value="original">Original Resolution (1:1 Pixel Match)</option>
                <option value="1080p">1080p (Lanczos Rescale)</option>
                <option value="720p">720p (HD)</option>
                <option value="480p">480p (Standard)</option>
                <option value="360p">360p (Lightweight)</option>
              </select>
            </div>

            {targetFormat === 'gif' && (
              <div>
                <span className="text-xs opacity-70 block mb-1">Dithering & Palette:</span>
                <select 
                  value={dither} 
                  onChange={e => setDither(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 font-bold text-xs text-white outline-none"
                >
                  <option value="bayer">Bayer Matrix (Master Crisp Dither)</option>
                  <option value="sierra">Sierra 2-4A (Smooth Gradients)</option>
                  <option value="floyd">Floyd-Steinberg (Classic)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Clip Trimmer & Output Name */}
        <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Scissors size={14} className="text-emerald-400" /> Timestamp Trimmer
          </label>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs opacity-70 block mb-1">Start Time:</span>
                <input 
                  type="text" 
                  value={startTime} 
                  onChange={e => setStartTime(e.target.value)} 
                  placeholder="00:00:00"
                  className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-center text-xs text-white outline-none"
                />
              </div>
              <div>
                <span className="text-xs opacity-70 block mb-1">End Time:</span>
                <input 
                  type="text" 
                  value={endTime} 
                  onChange={e => setEndTime(e.target.value)} 
                  placeholder="00:00:10"
                  className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-center text-xs text-white outline-none"
                />
              </div>
            </div>

            <div>
              <span className="text-xs opacity-70 block mb-1">Output Name:</span>
              <input 
                type="text" 
                value={customName} 
                onChange={e => setCustomName(e.target.value)} 
                placeholder="Auto-generated if empty"
                className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white outline-none"
              />
            </div>

            <div className="pt-2">
              <button 
                onClick={handleStartConversion}
                disabled={isDownloading || (mode === 'local' && !localFile) || (mode === 'url' && !url)}
                className="w-full py-3.5 rounded-xl font-extrabold text-sm uppercase tracking-wider transition-all active:scale-[0.98] shadow-xl flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white disabled:opacity-40"
              >
                {isDownloading ? (
                  <>
                    <RefreshCcw size={16} className="animate-spin" /> Rendering...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Render & Convert Master File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Download History View
function HistoryView({ theme, historyItems, openDownloadFolder, downloadFolder }: any) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="w-full max-w-[900px] flex flex-col gap-4 mt-2">
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div>
          <h2 className="text-2xl font-extrabold flex items-center gap-2.5">
            <History className="text-amber-400" />
            <span>Download & Conversion History</span>
          </h2>
          <p className="text-xs opacity-60 mt-0.5">Track your recently downloaded videos, converted GIFs, and audio tracks.</p>
        </div>
        <button 
          onClick={openDownloadFolder}
          className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
        >
          <FolderOpen size={15} className="text-amber-400" />
          <span>Open Destination Folder</span>
        </button>
      </div>

      <div className="w-full flex-1 flex flex-col gap-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
        {historyItems && historyItems.length > 0 ? (
          historyItems.map((item: any, idx: number) => {
            const ext = item.filename.split('.').pop()?.toUpperCase() || 'FILE';
            return (
              <div 
                key={idx} 
                className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 truncate max-w-[75%]">
                  <span className={`px-2 py-1 rounded-lg font-mono text-[10px] font-bold border ${
                    ext === 'GIF' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                    ext === 'MP3' || ext === 'WAV' || ext === 'FLAC' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                    'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  }`}>
                    {ext}
                  </span>
                  <span className="font-medium text-sm truncate" style={{ color: theme.textMain }} title={item.filename}>
                    {item.filename}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono opacity-50">{item.date}</span>
                  <button 
                    onClick={() => copyToClipboard(item.filename, idx)}
                    className="p-1.5 rounded-lg opacity-40 group-hover:opacity-100 hover:bg-white/10 transition-all"
                    title="Copy Filename"
                  >
                    {copiedIndex === idx ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-center opacity-50">
            <History size={40} className="mb-3 opacity-40" />
            <div className="text-base font-semibold">No downloads or conversions recorded yet</div>
            <div className="text-xs mt-1">Files you download or convert will automatically appear here.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Settings View
function SettingsView({ 
  theme, setTheme, playlistMode, setPlaylistMode, quality, setQuality, 
  downloadFolder, changeDownloadFolder, openDownloadFolder, handleUpdate, updateAvailable 
}: any) {
  return (
    <div className="w-full max-w-[850px] flex flex-col gap-5 mt-2">
      <div className="border-b border-white/5 pb-3">
        <h2 className="text-2xl font-extrabold flex items-center gap-2.5">
          <Settings className="text-amber-400" />
          <span>Application Settings & Engine</span>
        </h2>
        <p className="text-xs opacity-60 mt-0.5">Configure download preferences, engine locations, and theme appearance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Destination Folder */}
        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col justify-between gap-4">
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2">
              <FolderOpen size={16} className="text-amber-400" /> Default Download Folder
            </h4>
            <p className="text-xs opacity-60 mt-1">Directory where all downloaded media and converted GIFs are stored.</p>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 font-mono text-xs text-gray-300 truncate" title={downloadFolder}>
            {downloadFolder || 'Default Downloads'}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={changeDownloadFolder}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            >
              Change Folder
            </button>
            <button 
              onClick={openDownloadFolder}
              className="px-4 py-2 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 transition-colors border border-white/10 flex items-center gap-1.5"
            >
              <ExternalLink size={13} /> Explorer
            </button>
          </div>
        </div>

        {/* Engine Updates */}
        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col justify-between gap-4">
          <div>
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" /> Engine & Updates
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PRO DEV v1.1.0
              </span>
            </div>
            <p className="text-xs opacity-60 mt-1">Dual check for yt-dlp core extractor and Levi's Downloader release.</p>
          </div>
          <div className="text-xs space-y-1 font-mono opacity-80">
            <div>yt-dlp Core Engine: <span className="text-emerald-400">Bundled & Ready</span></div>
            <div>FFmpeg 2-Pass Converter: <span className="text-emerald-400">Installed</span></div>
          </div>
          <button 
            onClick={handleUpdate}
            className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black shadow-lg"
          >
            <RefreshCcw size={14} /> Update Core Engine
          </button>
        </div>

        {/* Download Behavior */}
        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col gap-4">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <Sliders size={16} className="text-blue-400" /> Default Download Quality
          </h4>
          <select 
            value={quality} 
            onChange={e => setQuality(e.target.value)}
            className="p-2.5 rounded-xl bg-black/40 border border-white/10 font-bold text-xs text-white outline-none cursor-pointer"
          >
            <option value="Best">Source Maximum (4K / 8K / Best Stream)</option>
            <option value="1440p">1440p (2K Resolution)</option>
            <option value="1080p">1080p (Full HD Resolution)</option>
            <option value="720p">720p (HD Resolution)</option>
            <option value="480p">480p (Standard Definition)</option>
          </select>
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-xs font-medium">Default Playlist Batching</span>
            <button 
              onClick={() => setPlaylistMode(!playlistMode)}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${playlistMode ? 'bg-amber-500' : 'bg-gray-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${playlistMode ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col justify-between gap-4">
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-purple-400" /> Appearance & Theme
            </h4>
            <p className="text-xs opacity-60 mt-1">Obsidian Dark Glassmorphism is optimized for high contrast and clean presentation.</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="w-6 h-6 rounded-full bg-[#171720] border border-white/20" />
            <div className="w-6 h-6 rounded-full bg-[#FF0033] border border-white/20" />
            <div className="w-6 h-6 rounded-full bg-[#00F2FE] border border-white/20" />
            <span className="opacity-60">Dark Glass Engine Active</span>
          </div>
          <div className="text-[11px] opacity-50 font-mono">
            Frameless Native PyWebView with hardware acceleration
          </div>
        </div>
      </div>
    </div>
  );
}

// Terminal Log View
function LogView({ theme }: { theme: any }) {
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  
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

  const filtered = logs.filter(l => l.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full max-w-[900px] h-[620px] rounded-2xl shadow-2xl p-4 flex flex-col border border-white/10 bg-black/50 backdrop-blur-xl">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-amber-400" />
          <h3 className="font-bold text-sm">Live Engine Console & Process Logs</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search console logs..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-8 pr-3 py-1.5 rounded-xl outline-none font-mono text-xs bg-white/5 border border-white/10 text-white w-52"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 custom-scrollbar pr-2 select-text">
        {filtered.length > 0 ? (
          filtered.map((log, i) => {
            const isError = log.toLowerCase().includes('error');
            const isSuccess = log.includes('Successfully') || log.includes('saved:');
            const isDownload = log.includes('[download]') || log.includes('[ffmpeg]');
            return (
              <div 
                key={i} 
                className={`py-0.5 leading-relaxed ${
                  isError ? 'text-red-400 font-bold' : 
                  isSuccess ? 'text-emerald-400 font-semibold' : 
                  isDownload ? 'text-blue-300 opacity-90' : 
                  'text-gray-300 opacity-75'
                }`}
              >
                <span className="opacity-30 mr-2">{">"}</span>
                {log}
              </div>
            );
          })
        ) : (
          <div className="opacity-40 italic py-6 text-center">Engine logs will stream live during download and conversion processes.</div>
        )}
      </div>
    </div>
  );
}