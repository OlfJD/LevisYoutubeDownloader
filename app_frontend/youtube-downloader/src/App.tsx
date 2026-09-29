/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Settings, X, ChevronDown, PenLine, FolderOpen, RefreshCcw, Square, 
  ChevronRight, ChevronLeft, Film, Sparkles, FolderCheck, HardDrive, 
  History, Scissors, Volume2, Check, Video, Play, FileVideo, ArrowRight, ArrowLeft
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
      className="w-full h-10 flex items-center justify-between pl-6 pr-2 select-none relative z-[100] pywebview-drag"
      style={{ backgroundColor: 'rgba(0,0,0,0.18)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold tracking-wider uppercase opacity-40" style={{ color: theme.textSecondary }}>
          Levi's Media Downloader & GIF Machine
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

export default function App() {
  const [activeView, setActiveView] = useState<'main' | 'gif_machine' | 'settings' | 'log' | 'update' | 'prename'>('main');
  
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
  
  const [historyItems, setHistoryItems] = useState<{date: string, filename: string, type?: string}[]>([]);

  // Pull real history items
  const fetchHistory = () => {
    fetch('/api/history').then(r=>r.json()).then(d => setHistoryItems(d || [])).catch(e=>{});
  };

  useEffect(() => { fetchHistory(); }, []);

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
      className="min-h-screen flex flex-col justify-between font-sans overflow-hidden relative select-none"
      style={{ backgroundColor: theme.bg, color: theme.textMain }}
    >
      {/* Seamless Custom Header */}
      <CustomTitleBar theme={theme} />

      <div className="flex-1 flex flex-col items-center justify-between pt-4 pb-20 relative">
        
        {/* Dynamic Glowing Title */}
        <div className="relative mb-0 mt-2 flex flex-col items-center">
          <h1 
            className="text-[58px] font-medium tracking-tight mb-1 select-none relative backdrop-blur-[2px] border py-1.5 px-10 rounded-3xl mix-blend-screen text-center"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 20px rgba(0,0,0,0.2)'
            }}
          >
            {activeView === 'gif_machine' ? (
              <>
                <span style={{ color: theme.textSecondary, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Advanced </span>
                <span style={{ color: '#F59E0B', textShadow: '0 2px 10px rgba(245,158,11,0.6)' }}>GIF</span>
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

        {/* View Switcher Carousel / Container */}
        <div className="flex-1 w-full max-w-5xl flex flex-col items-center px-4 relative mt-2">
          <AnimatePresence mode="wait">
            {activeView === 'main' && (
              <motion.div
                key="main"
                initial={{ opacity: 0, x: -25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -25 }}
                transition={{ duration: 0.18 }}
                className="w-full flex justify-center relative"
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

            {activeView === 'gif_machine' && (
              <motion.div
                key="gif_machine"
                initial={{ opacity: 0, x: 25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 25 }}
                transition={{ duration: 0.18 }}
                className="w-full flex justify-center relative"
              >
                <AdvancedGifMachineView 
                  theme={theme}
                  setActiveView={setActiveView}
                  historyItems={historyItems}
                  fetchHistory={fetchHistory}
                  url={url}
                  setUrl={setUrl}
                  isDownloading={isDownloading}
                  setIsDownloading={setIsDownloading}
                  setDownloadError={setDownloadError}
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

        {/* Bottom Navigation Footer */}
        <div className="absolute bottom-6 w-full flex justify-between items-end pointer-events-none px-8 z-30">
          <button 
            onClick={() => setActiveView(activeView === 'settings' ? 'main' : 'settings')} 
            className="pointer-events-auto rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group border border-white/5 shadow-lg"
            style={{ width: '60px', height: '60px', backgroundColor: theme.btnDarkBg, color: theme.btnDarkText, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` }}
            title="Settings"
          >
            <Settings strokeWidth={1.5} size={30} />
          </button>

          <button 
            onClick={() => setActiveView(activeView === 'log' ? 'main' : 'log')}
            className="pointer-events-auto rounded-2xl flex items-center justify-center font-bold transition-all text-[18px] active:translate-y-[4px] relative overflow-hidden group border border-white/5 shadow-lg"
            style={{ width: '60px', height: '60px', backgroundColor: theme.btnDarkBg, color: theme.btnDarkText, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` }}
            title="Logs"
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
              <p className="text-sm font-medium relative z-10 w-[240px] leading-relaxed" style={{ color: theme.textSecondary }}>The process encountered an error. Please try updating the tool and trying again.</p>
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
// ORIGINAL PAGE 1 VIEW: Faithful 100% OG Layout + Stylized Right Arrow
// -------------------------------------------------------------
function MainView({ url, setUrl, theme, playlistMode, setActiveView, startRealDownload, isDownloading, setIsDownloading, changeDownloadFolder, handleUpdate, setDownloadError, customName, setCustomName, fetchHistory, updateAvailable, updateInfo, showUpdatePopup, setShowUpdatePopup }: any) {
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
    <motion.div layout className="w-full max-w-[840px] flex flex-col items-center relative gap-7">
      
      {/* Stylized Floating Right Arrow to GIF Machine */}
      <div 
        className="absolute -right-20 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group cursor-pointer z-40" 
        onClick={() => setActiveView('gif_machine')}
      >
        <button 
          className="w-12 h-32 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group-hover:scale-110 active:scale-95 border border-amber-500/30 shadow-2xl relative overflow-hidden"
          style={{ 
            backgroundColor: `${theme.panelOuter}f0`, 
            color: '#F59E0B',
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 25px rgba(245,158,11,0.25)` 
          }}
          title="Switch to Advanced GIF Machine"
        >
          <Sparkles size={16} className="animate-pulse text-amber-400" />
          <ChevronRight size={26} strokeWidth={3} className="group-hover:translate-x-1 transition-transform text-amber-400" />
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">GIF</span>
        </button>
      </div>

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
      <motion.div layout className="mt-20 flex flex-col items-center gap-[20px] w-[800px]">
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

// -------------------------------------------------------------
// ADVANCED GIF MACHINE: Import video, pick from downloads, 2-pass master quality
// -------------------------------------------------------------
function AdvancedGifMachineView({ theme, setActiveView, historyItems, fetchHistory, url, setUrl, isDownloading, setIsDownloading, setDownloadError }: any) {
  const [selectedSourceType, setSelectedSourceType] = useState<'local' | 'history' | 'url'>('local');
  const [localFilePath, setLocalFilePath] = useState('');
  const [localFileInfo, setLocalFileInfo] = useState<any>(null);
  const [selectedHistoryFile, setSelectedHistoryFile] = useState('');
  
  const [gifFormat, setGifFormat] = useState<'gif' | 'loop_mp4' | 'webp'>('gif');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:10');
  const [customGifName, setCustomGifName] = useState('');

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
            fps: 'original',
            scale: 'original',
            dither: 'bayer'
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
            fps: 'original',
            scale: 'original',
            dither: 'bayer'
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

  return (
    <div className="w-[1050px] h-[580px] rounded-[24px] shadow-2xl p-6 flex gap-6 mt-1 relative" style={{ backgroundColor: theme.panelOuter }}>
      
      {/* Stylized Left Arrow to return to Downloader */}
      <div 
        onClick={() => setActiveView('main')}
        className="absolute -left-20 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group cursor-pointer z-40"
      >
        <button 
          className="w-12 h-32 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group-hover:scale-110 active:scale-95 border border-white/10 shadow-2xl relative overflow-hidden"
          style={{ 
            backgroundColor: `${theme.panelOuter}f0`, 
            color: theme.accent,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 25px rgba(0,0,0,0.4)` 
          }}
          title="Back to Downloader"
        >
          <ChevronLeft size={26} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-wider text-white opacity-90">Back</span>
        </button>
      </div>

      {/* Left Panel: Video Source Selector */}
      <div className="flex-1 rounded-[20px] p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelInner }}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[26px] font-bold" style={{ color: theme.textMain }}>1. Choose Video Source</h2>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              ORIGINAL QUALITY
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {/* Option A: Import Local File */}
            <button
              onClick={handlePickLocalVideo}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                selectedSourceType === 'local' && localFilePath ? 'bg-amber-500/20 border-amber-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <HardDrive size={18} />
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-white">Import Your Own Video File</div>
                  <div className="text-xs text-gray-400 truncate max-w-[280px]">
                    {localFilePath ? localFilePath.split('\\').pop() : 'Click to select MP4, MOV, MKV, AVI from PC'}
                  </div>
                </div>
              </div>
              <FolderOpen size={18} className="text-amber-400 shrink-0 ml-2" />
            </button>

            {/* Option B: Pick From Downloaded Ones */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <History size={16} className="text-blue-400" />
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
                          ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                          : 'bg-black/30 hover:bg-black/60 text-gray-300'
                      }`}
                      title={v.filename}
                    >
                      <span className="truncate">{v.filename}</span>
                      {selectedSourceType === 'history' && selectedHistoryFile === v.filename && (
                        <Check size={14} className="text-amber-400 shrink-0 ml-1" />
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
                <Film size={16} className="text-purple-400" />
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
          Active Source: <strong className="text-amber-400 font-bold">{selectedSourceType.toUpperCase()}</strong>
        </div>
      </div>

      {/* Right Panel: Advanced 2-Pass Palettegen & Render Controls */}
      <div className="flex-[1.2] rounded-[20px] p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelInner }}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[26px] font-bold" style={{ color: theme.textMain }}>2. GIF Quality & Timestamps</h2>
          </div>

          <div className="flex flex-col gap-4">
            {/* Format Selection */}
            <div className="flex gap-2">
              <button 
                onClick={() => setGifFormat('gif')}
                className={`flex-1 py-2.5 px-3 rounded-xl border text-center transition-all ${
                  gifFormat === 'gif' ? 'bg-amber-500/20 border-amber-500 text-white font-bold' : 'bg-black/30 border-white/5 text-gray-400'
                }`}
              >
                <div className="text-xs text-amber-300 font-bold">Master GIF (.gif)</div>
                <div className="text-[10px] opacity-70">2-Pass Palettegen (60fps)</div>
              </button>

              <button 
                onClick={() => setGifFormat('loop_mp4')}
                className={`flex-1 py-2.5 px-3 rounded-xl border text-center transition-all ${
                  gifFormat === 'loop_mp4' ? 'bg-amber-500/20 border-amber-500 text-white font-bold' : 'bg-black/30 border-white/5 text-gray-400'
                }`}
              >
                <div className="text-xs text-amber-300 font-bold flex items-center justify-center gap-1">
                  <Volume2 size={13} /> Sound Loop (MP4)
                </div>
                <div className="text-[10px] opacity-70">"GIF with Sound"</div>
              </button>
            </div>

            {/* Trimming Start & End */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Scissors size={14} />
                <span>Timestamp Trimmer (Start / End):</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
                  <span className="text-xs opacity-60">Start:</span>
                  <input 
                    type="text" 
                    value={startTime} 
                    onChange={e => setStartTime(e.target.value)} 
                    className="w-full bg-transparent font-mono text-xs text-white text-center outline-none"
                    placeholder="00:00:00"
                  />
                </div>
                <span className="text-gray-500">→</span>
                <div className="flex-1 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
                  <span className="text-xs opacity-60">End:</span>
                  <input 
                    type="text" 
                    value={endTime} 
                    onChange={e => setEndTime(e.target.value)} 
                    className="w-full bg-transparent font-mono text-xs text-white text-center outline-none"
                    placeholder="00:00:10"
                  />
                </div>
              </div>
            </div>

            {/* Custom Output Name */}
            <div className="flex flex-col gap-1">
              <span className="text-xs opacity-70">Custom GIF Name (optional):</span>
              <input 
                type="text" 
                placeholder="Auto-generated if left empty..."
                value={customGifName}
                onChange={e => setCustomGifName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Big 3D Tactile Render Button */}
        <div className="pt-4">
          <button 
            onClick={handleStartGifRender}
            disabled={isDownloading || (selectedSourceType === 'local' && !localFilePath) || (selectedSourceType === 'history' && !selectedHistoryFile) || (selectedSourceType === 'url' && !url)}
            className="w-full py-4 rounded-2xl font-extrabold uppercase tracking-widest text-[20px] transition-all active:translate-y-[4px] shadow-2xl flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ 
              backgroundColor: theme.btnLightBg, 
              color: theme.btnLightText, 
              boxShadow: `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.3)` 
            }}
          >
            <Sparkles size={22} className="text-amber-500" />
            <span>{isDownloading ? 'Rendering Master GIF...' : 'Render Master GIF'}</span>
          </button>
        </div>
      </div>
    </div>
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

function UpdateView({ theme, setActiveView, checkUpdates, setUpdateAvailable }: { theme: any, setActiveView: (v: any) => void, checkUpdates?: (force?: boolean) => void, setUpdateAvailable?: (v: boolean) => void }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const fetchLogs = () => {
      fetch('/api/logs').then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          setLogs(d);
          if (!done && d.some(l => l.includes('Process Finished Successfully!'))) {
            setDone(true);
            if (setUpdateAvailable) setUpdateAvailable(false);
            if (checkUpdates) checkUpdates(true);
            setTimeout(() => { 
              if (checkUpdates) checkUpdates(true);
              setActiveView('main'); 
            }, 2500); 
          }
        }
      }).catch(e => {});
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 500);
    return () => clearInterval(interval);
  }, [done, setActiveView, checkUpdates, setUpdateAvailable]);

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