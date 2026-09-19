/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Settings, X, ChevronDown, PenLine, FolderOpen, RefreshCcw, Square, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ThemeEditor from './ThemeEditor';

// Native Drag-friendly Title Bar for Borderless Frame
function CustomTitleBar({ theme }) {
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
          Levi's YouTube Downloader
        </span>
      </div>
      <div className="flex items-center gap-1">
        {/* Minimize Button */}
        <button 
          onClick={handleMinimize}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10 active:scale-95"
          style={{ color: theme.textMain }}
        >
          <span className="text-lg leading-none -mt-0.5">—</span>
        </button>
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-600/90 active:scale-95 hover:text-white"
          style={{ color: theme.textMain }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<'main' | 'settings' | 'log' | 'update' | 'prename'>('main');
  
  const [url, setUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  
  const [playlistMode, setPlaylistMode] = useState(false);
  const [showPlaylistPopup, setShowPlaylistPopup] = useState(false);
  const [quality, setQuality] = useState('Best');
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
  
  const [historyItems, setHistoryItems] = useState<{date: string, filename: string}[]>([]);

  // Pull real history items
  const fetchHistory = () => {
    fetch('/api/history').then(r=>r.json()).then(d => setHistoryItems(d || [])).catch(e=>{});
  };

  useEffect(() => { fetchHistory(); }, []);

  // Automatic Background Startup Update Check (both yt-dlp and LeviDownloader)
  useEffect(() => {
    let attempts = 0;
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/check_updates');
        const data = await res.json();
        if (data && data.checked) {
          setUpdateInfo(data);
          if (data.update_available) {
            setUpdateAvailable(true);
            setShowUpdatePopup(true);
          }
        } else if (attempts < 5) {
          attempts++;
          setTimeout(checkUpdate, 1500);
        }
      } catch (e) {
        if (attempts < 5) {
          attempts++;
          setTimeout(checkUpdate, 2000);
        }
      }
    };
    checkUpdate();
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if(d.quality) setQuality(d.quality);
        if(d.playlistMode !== undefined) setPlaylistMode(d.playlistMode);
      }).catch(e => console.log("Engine starting..."));
  }, []);

  const saveSetting = (key: string, value: any) => {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    }).catch(e => console.log("Waiting for backend..."));
  };

  const handleQualityChange = (val: string) => { setQuality(val); saveSetting('quality', val); };
  const handlePlaylistModeChange = (val: boolean) => { setPlaylistMode(val); saveSetting('playlistMode', val); };

  // Real Download Initialization
  const startRealDownload = async (format: string) => {
    if (!url || isDownloading) return;
    
    if (url.toLowerCase() === 'error') {
      setDownloadError(true);
      return;
    }

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
          playlistMode: playlistMode 
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

  const [theme, setTheme] = useState({
    bg: '#212128',
    textMain: '#D9D9D9',
    textSecondary: '#D9D9D9',
    accent: '#FF0033',
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
  });

  return (
    <div 
      className="min-h-screen flex flex-col justify-between font-sans overflow-hidden relative"
      style={{ backgroundColor: theme.bg, color: theme.textMain }}
    >
      {/* Seamless Custom Header */}
      <CustomTitleBar theme={theme} />

      <div className="flex-1 flex flex-col items-center justify-between pt-6 pb-24 relative">
        <div className="relative mb-0 mt-4">
          <h1 
            className="text-[64px] font-medium tracking-tight mb-2 select-none relative backdrop-blur-[2px] border py-2 px-10 rounded-3xl mix-blend-screen text-center"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 20px rgba(0,0,0,0.2)'
            }}
          >
            <span style={{ color: theme.textSecondary, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>You</span><span style={{ color: theme.accent, textShadow: `0 2px 10px ${theme.accent}88` }}>Tube</span>
            <span style={{ color: theme.textSecondary, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}> Downloader</span>
          </h1>
        </div>

        <div className="flex-1 w-full max-w-5xl flex flex-col items-center px-4 relative mt-4">
          <AnimatePresence mode="wait">
            {activeView === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="w-full flex justify-center"
              >
                <SettingsView 
                  theme={theme} 
                  playlistMode={playlistMode} 
                  setPlaylistMode={handlePlaylistModeChange} 
                  quality={quality}
                  setQuality={handleQualityChange}
                  historyItems={historyItems}
                />
              </motion.div>
            )}
            {['main', 'prename'].includes(activeView) && (
              <motion.div
                key="main"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="w-full flex justify-center"
              >
                <MainView 
                  url={url} 
                  setUrl={handleUrlChange} 
                  theme={theme} 
                  playlistMode={playlistMode}
                  setActiveView={setActiveView}
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
                className="w-full flex justify-center"
              >
                <LogView theme={theme} />
              </motion.div>
            )}
            {activeView === 'update' && (
              <motion.div
                key="update"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="w-full flex justify-center"
              >
                <UpdateView theme={theme} setActiveView={setActiveView} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
           {activeView === 'prename' && (
             <PrenameView theme={theme} setActiveView={setActiveView} customName={customName} setCustomName={setCustomName} />
           )}
        </AnimatePresence>

        {/* Footer */}
        <div className="absolute bottom-8 w-full flex justify-between items-end pointer-events-none px-8">
          <button 
            onClick={() => setActiveView(activeView === 'settings' ? 'main' : 'settings')} 
            className="pointer-events-auto rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group border border-white/5 shadow-lg"
            style={{ width: '60px', height: '60px', backgroundColor: theme.btnDarkBg, color: theme.btnDarkText, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` }}
          >
            <Settings strokeWidth={1.5} size={30} />
          </button>

          <button 
            onClick={() => setActiveView(activeView === 'log' ? 'main' : 'log')}
            className="pointer-events-auto rounded-2xl flex items-center justify-center font-bold transition-all text-[18px] active:translate-y-[4px] relative overflow-hidden group border border-white/5 shadow-lg"
            style={{ width: '60px', height: '60px', backgroundColor: theme.btnDarkBg, color: theme.btnDarkText, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` }}
          >
            <span className="uppercase tracking-widest pl-[0.1em]">Log</span>
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
                {updateInfo?.message || "A new update is available for yt-dlp engine or Levi's YouTube Downloader. Click below to install."}
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
              <p className="text-sm font-medium relative z-10 w-[240px] leading-relaxed" style={{ color: theme.textSecondary }}>The download encountered an error. Please try updating the tool and downloading again.</p>
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

function MainView({ url, setUrl, theme, playlistMode, setActiveView, startRealDownload, isDownloading, setIsDownloading, changeDownloadFolder, handleUpdate, setDownloadError, customName, setCustomName, fetchHistory, updateAvailable, updateInfo, showUpdatePopup, setShowUpdatePopup }: any) {
  const [progress, setProgress] = useState(0);
  const [downloadTitle, setDownloadTitle] = useState('Preparing...');

  const handleStopProcess = async () => {
    try { await fetch('/api/stop', { method: 'POST' }); } catch(e){}
    setIsDownloading(false);
  };

  // Strict Poller for real progress, queue generation, and end-of-process
  useEffect(() => {
    if (!isDownloading) {
      setProgress(0);
      setDownloadTitle('Preparing...');
      return;
    }

    const interval = setInterval(() => {
      fetch('/api/logs').then(r => r.json()).then(logs => {
        if (!Array.isArray(logs)) return;

        // Check if backend finished process
        const isDone = logs.some(l => l.includes('Process Finished Successfully!'));
        const isError = logs.some(l => l.includes('CRITICAL ERROR:'));

        if (isDone || isError) {
            setIsDownloading(false);
            if (isError) setDownloadError(true);
            else setCustomName(''); // Wipe custom name on success
            fetchHistory();
            return;
        }

        // Parse Progress
        const dlLogs = logs.filter(l => typeof l === 'string' && l.includes('[download]') && l.includes('%'));
        if (dlLogs.length > 0) {
          const match = dlLogs[dlLogs.length - 1].match(/(\d+(?:\.\d+)?)%/);
          if (match) setProgress(parseFloat(match[1]));
        }

        // Parse Title (Video 1 of 5, or direct filename)
        const pMatch = logs.find(l => typeof l === 'string' && l.includes('Downloading video '));
        if (pMatch) {
            const m = pMatch.match(/Downloading video (\d+) of (\d+)/);
            if (m) setDownloadTitle(`Video ${m[1]} of ${m[2]}`);
        } else if (!customName) {
            const nameLog = logs.find(l => typeof l === 'string' && l.includes('[download] Destination:'));
            if (nameLog) {
                let file = nameLog.split('Destination: ')[1].split('\\').pop().split('/').pop();
                file = file.replace(/\.f\d+\.(m4a|webm|mp4)$/, ''); // Strip intermediate extensions visually
                setDownloadTitle(file);
            }
        }
      }).catch(e => {});
    }, 250);

    return () => clearInterval(interval);
  }, [isDownloading, customName]);

  const displayTitle = customName ? `${customName} (Custom)` : downloadTitle;

  return (
    <motion.div layout className="w-full max-w-[800px] flex flex-col items-center relative gap-8">
      
      {/* Input Area with Inline Stop Button */}
      <div className="w-full relative flex gap-3 h-[46px] items-center">
        <div className="flex-1 flex h-full rounded-[10px] overflow-hidden p-[2px] shadow-inner relative z-10 transition-all" style={{ backgroundColor: theme.inputBg }}>
          <input 
            type="text" value={url} onChange={(e) => setUrl(e.target.value)} disabled={isDownloading} placeholder="Paste YouTube Link Here..." 
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
      
      {/* Waveform & Video Name (Smooth transition collapse) */}
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

      {/* Download Buttons */}
      <motion.div layout className="flex flex-col items-center gap-6">
        <div className="flex gap-8">
          <button onClick={() => startRealDownload('mp3')} disabled={isDownloading} className="disabled:opacity-50 disabled:cursor-not-allowed font-extrabold uppercase tracking-widest text-[22px] py-[14px] px-12 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group" style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText, boxShadow: isDownloading ? 'none' : `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)` }}><span className="relative drop-shadow-md">Download MP3</span></button>
          <button onClick={() => startRealDownload('mp4')} disabled={isDownloading} className="disabled:opacity-50 disabled:cursor-not-allowed font-extrabold uppercase tracking-widest text-[22px] py-[14px] px-12 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group" style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText, boxShadow: isDownloading ? 'none' : `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)` }}><span className="relative drop-shadow-md">Download MP4</span></button>
        </div>
        <button onClick={() => startRealDownload('wav')} disabled={isDownloading} className="disabled:opacity-50 disabled:cursor-not-allowed font-extrabold uppercase tracking-widest text-[22px] py-[14px] px-12 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group" style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText, boxShadow: isDownloading ? 'none' : `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)` }}><span className="relative drop-shadow-md">Download WAV</span></button>
      </motion.div>

      {/* Bottom Action Buttons */}
      <motion.div layout className="mt-28 flex flex-col items-center gap-[20px] w-[800px]">
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
  );
}

function SettingsView({ theme, playlistMode, setPlaylistMode, quality, setQuality, historyItems }: any) {
  return (
    <div className="w-[1050px] h-[600px] rounded-[24px] shadow-2xl p-6 flex gap-6 mt-4" style={{ backgroundColor: theme.panelOuter }}>
      <div className="flex-1 rounded-[20px] p-6 flex flex-col" style={{ backgroundColor: theme.panelInner }}>
        <h2 className="text-[34px] mb-8 font-medium text-center w-full" style={{ color: theme.textMain }}>Settings</h2>
        <div className="w-full flex flex-col gap-6 pl-2 mt-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-start gap-4 mx-4">
              <span className="text-[24px] whitespace-nowrap" style={{ color: theme.textMain }}>Download Quality:</span>
              <div className="flex items-center pl-3 pr-2 py-1 rounded-lg text-[20px] min-w-[120px]" style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText }}>
                <div className="font-bold tracking-wide w-full text-center pr-3">{quality}</div>
                <div className="w-[5px] h-[22px] rounded-full shrink-0" style={{ backgroundColor: theme.btnLightBorder }}></div>
                <div className="relative flex items-center justify-center cursor-pointer pl-3 pr-2 w-[40px]"><ChevronDown size={28} strokeWidth={4} className="pointer-events-none" /><select value={quality} onChange={(e) => setQuality(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full font-bold text-[18px]"><option className="font-bold text-black bg-white">Best</option><option className="font-bold text-black bg-white">High</option><option className="font-bold text-black bg-white">Medium</option><option className="font-bold text-black bg-white">Low</option></select></div>
              </div>
            </div>
            <div className="flex flex-col gap-6 mx-4 mt-6">
              <div className="flex items-center justify-between w-[320px]">
                <span className="text-[24px]" style={{ color: theme.textMain }}>Playlist Mode</span>
                <button onClick={() => setPlaylistMode(!playlistMode)} className={`relative flex items-center w-14 h-5 rounded-full transition-colors ml-4`} style={{ backgroundColor: playlistMode ? theme.accent : '#555' }} aria-pressed={playlistMode}><div className={`absolute w-8 h-8 rounded-full transition-all shadow-md`} style={{ backgroundColor: playlistMode ? theme.inputBg : '#a0a0a8', left: playlistMode ? 'auto' : '-4px', right: playlistMode ? '-4px' : 'auto' }} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-[1.4] rounded-[20px] p-6 flex flex-col" style={{ backgroundColor: theme.panelInner }}>
        <h2 className="text-[30px] mb-6 font-medium text-center w-full" style={{ color: theme.textMain }}>Download History</h2>
        
        {/* REDESIGNED GRID LAYOUT FOR HISTORY WRAPPING */}
        <div className="w-full flex-1 flex flex-col overflow-y-auto px-2 gap-4 custom-scrollbar">
          {historyItems.length > 0 ? historyItems.map((h: any, i: number) => (
            <div key={i} className="flex gap-4 items-start border-b border-white/5 pb-3">
              <div className="text-[16px] font-mono tracking-tight shrink-0 opacity-70 mt-1" style={{ color: theme.textMain }}>{h.date}</div>
              <div className="text-[18px] leading-snug break-words flex-1" style={{ color: theme.textMain }}>{h.filename}</div>
            </div>
          )) : <div className="text-[18px] opacity-50 italic" style={{ color: theme.textMain }}>No downloads yet.</div>}
        </div>

      </div>
    </div>
  );
}

function LogView({ theme }: { theme: any }) {
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  useEffect(() => {
    const fetchLogs = () => { fetch('/api/logs').then(r => r.json()).then(d => { if (Array.isArray(d)) setLogs(d); }).catch(e => {}); };
    fetchLogs(); 
    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, []);
  const filtered = logs.filter(l => l.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="w-[1050px] h-[600px] rounded-[24px] shadow-2xl p-6 flex flex-col mt-4" style={{ backgroundColor: theme.panelOuter }}>
      <div className="flex-1 rounded-[20px] p-6 flex flex-col font-mono text-[18px] overflow-hidden" style={{ backgroundColor: theme.panelInner, color: theme.textSecondary }}>
        <h2 className="text-[28px] mb-4 font-medium font-sans text-center shrink-0" style={{ color: theme.textMain }}>Application Logs</h2>
        <div className="w-[85%] h-[2px] mb-6 self-center shrink-0" style={{ backgroundColor: theme.btnDarkBorder }}></div>
        <div className="flex justify-end mb-4 pr-4 shrink-0"><input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-1.5 rounded-lg outline-none font-sans text-[16px]" style={{ backgroundColor: theme.inputBg, color: theme.inputText }} /></div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pl-4 pr-2 custom-scrollbar">
          {filtered.length > 0 ? filtered.map((log, i) => {
              const isError = log.toLowerCase().includes('error');
              return (<div key={i} className={isError ? 'font-bold' : 'opacity-70'} style={isError ? { color: theme.accent } : {}}>{log}</div>);
            }) : <div className="opacity-50 italic">Waiting for engine logs...</div>}
        </div>
      </div>
    </div>
  );
}

function UpdateView({ theme, setActiveView }: { theme: any, setActiveView: (v: any) => void }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const fetchLogs = () => {
      fetch('/api/logs').then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          setLogs(d);
          if (!done && d.some(l => l.includes('Process Finished Successfully!'))) {
            setDone(true);
            setTimeout(() => { setActiveView('main'); }, 3000); 
          }
        }
      }).catch(e => {});
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 500);
    return () => clearInterval(interval);
  }, [done, setActiveView]);

  return (
    <div className="w-[1050px] h-[600px] rounded-[24px] shadow-2xl p-6 flex flex-col mt-4" style={{ backgroundColor: theme.panelOuter }}>
      <div className="flex-1 rounded-[20px] p-6 flex flex-col font-mono text-[18px] overflow-hidden" style={{ backgroundColor: theme.panelInner, color: theme.textSecondary }}>
        <h2 className="text-[28px] mb-4 font-medium font-sans text-center shrink-0" style={{ color: theme.textMain }}>Tool Update</h2>
        <div className="w-[85%] h-[2px] mb-6 self-center shrink-0" style={{ backgroundColor: theme.btnDarkBorder }}></div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
          {logs.map((log, i) => (<div key={i} className="flex gap-4 opacity-90 animate-fade-in"><span style={{ color: theme.accent }}>{">"}</span><span style={{ color: theme.textMain }}>{log}</span></div>))}
          {done && (<div className="flex gap-4 opacity-90 animate-fade-in mt-4 text-green-400 font-bold"><span style={{ color: theme.accent }}>{">"}</span><span>Update successful! Returning to main menu...</span></div>)}
          {!done && (<div className="flex gap-4 opacity-90 animate-fade-in mt-2"><span className="animate-pulse" style={{ color: theme.accent }}>_</span></div>)}
        </div>
      </div>
    </div>
  );
}

function PrenameView({ theme, setActiveView, customName, setCustomName }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-[500px] rounded-[24px] shadow-2xl p-6 flex flex-col items-center justify-center relative border border-white/10" style={{ backgroundColor: theme.panelOuter }}>
        <button onClick={() => setActiveView('main')} className="absolute top-4 right-4 transition-transform active:scale-95 z-10 opacity-70 hover:opacity-100" style={{ color: theme.textMain }}><X size={28} strokeWidth={2.5} /></button>
        <h2 className="text-[26px] mt-2 mb-6 font-bold" style={{ color: theme.textMain }}>Prename Next Download</h2>
        <input type="text" placeholder="Enter custom filename..." value={customName} onChange={e => setCustomName(e.target.value)} className="w-full px-5 py-4 rounded-xl outline-none font-medium text-[20px] tracking-wide mb-8 shadow-inner" style={{ backgroundColor: theme.inputBg, color: theme.inputText }} />
        <button onClick={() => setActiveView('main')} className="font-bold text-[20px] py-[10px] px-10 rounded-2xl transition-all active:translate-y-[4px] relative overflow-hidden group" style={{ backgroundColor: theme.accent, color: theme.inputBg, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 5px 0 rgba(0,0,0,0.3)` }}><span className="relative z-10">Save & Close</span></button>
      </motion.div>
    </motion.div>
  );
}