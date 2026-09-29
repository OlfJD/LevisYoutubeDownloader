/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Settings, X, ChevronDown, PenLine, FolderOpen, RefreshCcw, Square, 
  ChevronRight, ChevronLeft, Film, Sparkles, FolderCheck, HardDrive, 
  History, Scissors, Volume2, Check, Video, Play, FileVideo, Sliders, CheckCircle2
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
  const [activeSection, setActiveSection] = useState<'downloader' | 'gif'>('downloader');
  
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

  // GIF Machine Settings State
  const [gifFps, setGifFps] = useState('original');
  const [gifScale, setGifScale] = useState('original');
  const [gifDither, setGifDither] = useState('bayer');
  const [gifAudioLoop, setGifAudioLoop] = useState(false);

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
        if(d.gifFps) setGifFps(d.gifFps);
        if(d.gifScale) setGifScale(d.gifScale);
        if(d.gifDither) setGifDither(d.gifDither);
        if(d.gifAudioLoop !== undefined) setGifAudioLoop(d.gifAudioLoop);
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
  const handleGifFpsChange = (val: string) => { setGifFps(val); saveSetting('gifFps', val); };
  const handleGifScaleChange = (val: string) => { setGifScale(val); saveSetting('gifScale', val); };
  const handleGifDitherChange = (val: string) => { setGifDither(val); saveSetting('gifDither', val); };
  const handleGifAudioLoopChange = (val: boolean) => { setGifAudioLoop(val); saveSetting('gifAudioLoop', val); };

  // Switch to Main or GIF Machine and record section
  const handleSwitchToMain = () => {
    setActiveSection('downloader');
    setActiveView('main');
  };

  const handleSwitchToGif = () => {
    setActiveSection('gif');
    setActiveView('gif_machine');
  };

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
            {activeView === 'gif_machine' || (activeSection === 'gif' && ['settings', 'log'].includes(activeView)) ? (
              <>
                <span style={{ color: theme.textSecondary, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Advanced </span>
                <span style={{ color: theme.accent, textShadow: `0 2px 10px ${theme.accent}88` }}>GIF</span>
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
                  gifFps={gifFps}
                  setGifFps={handleGifFpsChange}
                  gifScale={gifScale}
                  setGifScale={handleGifScaleChange}
                  gifDither={gifDither}
                  setGifDither={handleGifDitherChange}
                  gifAudioLoop={gifAudioLoop}
                  setGifAudioLoop={handleGifAudioLoopChange}
                  changeDownloadFolder={changeDownloadFolder}
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

        {/* Bottom Navigation Footer (Contextual to active section) */}
        <div className="absolute bottom-6 w-full flex justify-between items-end pointer-events-none px-8 z-30">
          <button 
            onClick={() => setActiveView(activeView === 'settings' ? (activeSection === 'gif' ? 'gif_machine' : 'main') : 'settings')} 
            className="pointer-events-auto rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group border border-white/5 shadow-lg"
            style={{ 
              width: '60px', 
              height: '60px', 
              backgroundColor: activeView === 'settings' ? `${theme.accent}22` : theme.btnDarkBg, 
              color: activeView === 'settings' ? theme.accent : theme.btnDarkText, 
              borderColor: activeView === 'settings' ? `${theme.accent}66` : 'rgba(255,255,255,0.05)',
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` 
            }}
            title={activeSection === 'gif' ? "GIF Machine Settings" : "Downloader Settings"}
          >
            <Settings strokeWidth={1.5} size={30} style={activeView === 'settings' ? { filter: `drop-shadow(0 2px 8px ${theme.accent}88)` } : {}} />
          </button>

          <button 
            onClick={() => setActiveView(activeView === 'log' ? (activeSection === 'gif' ? 'gif_machine' : 'main') : 'log')} 
            className="pointer-events-auto rounded-2xl flex items-center justify-center font-bold transition-all text-[18px] active:translate-y-[4px] relative overflow-hidden group border border-white/5 shadow-lg"
            style={{ 
              width: '60px', 
              height: '60px', 
              backgroundColor: activeView === 'log' ? `${theme.accent}22` : theme.btnDarkBg, 
              color: activeView === 'log' ? theme.accent : theme.btnDarkText, 
              borderColor: activeView === 'log' ? `${theme.accent}66` : 'rgba(255,255,255,0.05)',
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` 
            }}
            title={activeSection === 'gif' ? "GIF Machine Logs" : "Downloader Logs"}
          >
            <span 
              className="uppercase tracking-widest pl-[0.1em]"
              style={activeView === 'log' ? { textShadow: `0 2px 10px ${theme.accent}88` } : {}}
            >
              Log
            </span>
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
// ORIGINAL PAGE 1 VIEW: Faithful 100% OG Layout + Clean Stylized Right Arrow
// -------------------------------------------------------------
function MainView({ url, setUrl, theme, playlistMode, setActiveView, handleSwitchToGif, startRealDownload, isDownloading, setIsDownloading, changeDownloadFolder, handleUpdate, setDownloadError, customName, setCustomName, fetchHistory, updateAvailable, updateInfo, showUpdatePopup, setShowUpdatePopup }: any) {
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
    <motion.div layout className="w-full max-w-[800px] flex flex-col items-center relative gap-8 my-auto">
      
      {/* Stylized Floating Right Arrow to GIF Machine (Clean - No Star, Pushed Way Right, Matching '& Video' Glow) */}
      <div 
        className="absolute -right-52 top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-40" 
        onClick={handleSwitchToGif}
      >
        <button 
          className="w-12 h-28 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all group-hover:scale-110 active:scale-95 relative overflow-hidden"
          style={{ 
            backgroundColor: theme.btnDarkBg, 
            color: theme.accent,
            border: `1px solid rgba(255,255,255,0.06)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 12px rgba(0,0,0,0.25)` 
          }}
          title="Switch to Advanced GIF Machine"
        >
          <ChevronRight size={28} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" style={{ color: theme.accent, filter: `drop-shadow(0 2px 8px ${theme.accent}88)` }} />
          <span 
            className="text-[11px] font-black uppercase tracking-wider"
            style={{ color: theme.accent, textShadow: `0 2px 10px ${theme.accent}88` }}
          >
            GIF
          </span>
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
function AdvancedGifMachineView({ theme, setActiveView, handleSwitchToMain, historyItems, fetchHistory, url, setUrl, isDownloading, setIsDownloading, setDownloadError, fps, setFps, scale, setScale, dither, setDither }: any) {
  const [selectedSourceType, setSelectedSourceType] = useState<'local' | 'history' | 'url'>('local');
  const [localFilePath, setLocalFilePath] = useState('');
  const [localFileInfo, setLocalFileInfo] = useState<any>(null);
  const [selectedHistoryFile, setSelectedHistoryFile] = useState('');
  
  const [gifFormat, setGifFormat] = useState<'gif' | 'loop_mp4' | 'webp'>('gif');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:10');
  const [customGifName, setCustomGifName] = useState('');

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
            dither: dither
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

  // Filter video history items
  const videoHistory = (historyItems || []).filter((h: any) => {
    const fn = (h.filename || '').toLowerCase();
    return fn.endsWith('.mp4') || fn.endsWith('.webm') || fn.endsWith('.mkv') || fn.endsWith('.mov');
  });

  const qualitySummary = `${fps === 'original' ? 'Original FPS' : `${fps} FPS`} · ${scale === 'original' ? '100% Res' : scale}`;

  return (
    <div className="w-[1050px] h-[580px] rounded-[24px] shadow-2xl p-6 flex gap-6 relative" style={{ backgroundColor: theme.panelOuter }}>
      
      {/* Stylized Left Arrow to return to Downloader (Restored Snug Horizontal Position & Matching Vertical Height & Glow) */}
      <div 
        onClick={handleSwitchToMain}
        className="absolute -left-16 top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-40"
      >
        <button 
          className="w-12 h-28 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all group-hover:scale-110 active:scale-95 relative overflow-hidden"
          style={{ 
            backgroundColor: theme.btnDarkBg, 
            color: theme.accent,
            border: `1px solid rgba(255,255,255,0.06)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 12px rgba(0,0,0,0.25)` 
          }}
          title="Back to Downloader"
        >
          <ChevronLeft size={28} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" style={{ color: theme.accent, filter: `drop-shadow(0 2px 8px ${theme.accent}88)` }} />
          <span 
            className="text-[11px] font-black uppercase tracking-wider"
            style={{ color: theme.accent, textShadow: `0 2px 10px ${theme.accent}88` }}
          >
            Back
          </span>
        </button>
      </div>

      {/* Left Panel: Video Source Selector */}
      <div className="flex-1 rounded-[20px] p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelInner }}>
        <div>
          {/* Header on ONE Single Line */}
          <div className="flex items-center justify-between gap-3 mb-4 w-full">
            <h2 className="text-[22px] font-bold whitespace-nowrap text-white">1. Choose Video Source</h2>
            
            {/* Clickable Custom Quality Pill Button with Subtle Glow */}
            <button 
              onClick={() => setShowQualityModal(true)}
              className="px-3 py-1.5 rounded-full font-bold text-xs whitespace-nowrap border hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: `${theme.accent}66`,
                color: theme.textMain
              }}
              title="Click to customize FFmpeg video quality, framerate & dithering"
            >
              <Sliders size={13} style={{ color: theme.accent }} />
              <span style={{ textShadow: `0 1px 6px ${theme.accent}44` }}>{qualitySummary}</span>
              <ChevronDown size={14} className="opacity-70" />
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
                <div className="p-2 rounded-lg bg-white/10" style={{ color: theme.accent }}>
                  <HardDrive size={18} />
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-white">Import Your Own Video File</div>
                  <div className="text-xs text-gray-400 truncate max-w-[280px]">
                    {localFilePath ? localFilePath.split('\\').pop() : 'Click to select MP4, MOV, MKV, AVI from PC'}
                  </div>
                </div>
              </div>
              <FolderOpen size={18} style={{ color: theme.accent }} className="shrink-0 ml-2" />
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
                          ? 'bg-white/15 text-white border border-white/30 font-bold'
                          : 'bg-black/30 hover:bg-black/60 text-gray-300'
                      }`}
                      title={v.filename}
                    >
                      <span className="truncate">{v.filename}</span>
                      {selectedSourceType === 'history' && selectedHistoryFile === v.filename && (
                        <Check size={14} style={{ color: theme.accent }} className="shrink-0 ml-1" />
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
          Active Source: <strong style={{ color: theme.accent }} className="font-bold">{selectedSourceType.toUpperCase()}</strong>
        </div>
      </div>

      {/* Right Panel: Advanced 2-Pass Palettegen & Render Controls */}
      <div className="flex-[1.2] rounded-[20px] p-6 flex flex-col justify-between" style={{ backgroundColor: theme.panelInner }}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[22px] font-bold whitespace-nowrap" style={{ color: theme.textMain }}>2. GIF Output & Trimmer</h2>
          </div>

          <div className="flex flex-col gap-4">
            {/* Format Selection */}
            <div className="flex gap-2">
              <button 
                onClick={() => setGifFormat('gif')}
                className={`flex-1 py-2.5 px-3 rounded-xl border text-center transition-all ${
                  gifFormat === 'gif' ? 'bg-white/15 border-white/30 text-white font-bold' : 'bg-black/30 border-white/5 text-gray-400'
                }`}
              >
                <div className="text-xs font-bold" style={{ color: theme.textMain }}>Master GIF (.gif)</div>
                <div className="text-[10px] opacity-70">2-Pass Palettegen (60fps)</div>
              </button>

              <button 
                onClick={() => setGifFormat('loop_mp4')}
                className={`flex-1 py-2.5 px-3 rounded-xl border text-center transition-all ${
                  gifFormat === 'loop_mp4' ? 'bg-white/15 border-white/30 text-white font-bold' : 'bg-black/30 border-white/5 text-gray-400'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-center gap-1" style={{ color: theme.textMain }}>
                  <Volume2 size={13} /> Sound Loop (MP4)
                </div>
                <div className="text-[10px] opacity-70">"GIF with Sound"</div>
              </button>
            </div>

            {/* Trimming Start & End */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-bold" style={{ color: theme.accent }}>
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
            <Sparkles size={22} style={{ color: theme.accent }} />
            <span>{isDownloading ? 'Rendering Master GIF...' : 'Render Master GIF'}</span>
          </button>
        </div>
      </div>

      {/* FFmpeg Quality Customization Popover / Modal */}
      <AnimatePresence>
        {showQualityModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-[480px] p-6 rounded-[24px] shadow-2xl flex flex-col gap-5 border border-white/10"
              style={{ backgroundColor: theme.panelOuter, color: theme.textMain }}
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-base font-bold" style={{ color: theme.accent }}>
                  <Sliders size={18} />
                  <span>FFmpeg Master Quality Configuration</span>
                </div>
                <button onClick={() => setShowQualityModal(false)} className="opacity-60 hover:opacity-100 p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-4 text-xs font-medium">
                {/* Framerate Selection */}
                <div className="flex flex-col gap-1.5">
                  <span className="opacity-80 font-bold">1. Target Framerate (FPS):</span>
                  <select 
                    value={fps} 
                    onChange={e => setFps(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="original">Preserve Original FPS (100% Full Smoothness)</option>
                    <option value="60">60 FPS (Ultra Smooth Gamer Fidelity)</option>
                    <option value="50">50 FPS (PAL High Speed)</option>
                    <option value="30">30 FPS (Standard Web Frame Rate)</option>
                    <option value="24">24 FPS (Cinematic Look)</option>
                    <option value="15">15 FPS (Compact File Size)</option>
                  </select>
                </div>

                {/* Resolution / Scale Selection */}
                <div className="flex flex-col gap-1.5">
                  <span className="opacity-80 font-bold">2. Video Resolution (Lanczos Scale):</span>
                  <select 
                    value={scale} 
                    onChange={e => setScale(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="original">Original Source Resolution (1:1 Exact Pixel Match)</option>
                    <option value="1080p">1080p Full HD (Downscale with Lanczos Filter)</option>
                    <option value="720p">720p HD (Balanced Quality & Size)</option>
                    <option value="480p">480p Standard (Medium GIF Size)</option>
                    <option value="360p">360p Lightweight (Small Discord / Chat Size)</option>
                  </select>
                </div>

                {/* Dithering & Palette Matrix */}
                <div className="flex flex-col gap-1.5">
                  <span className="opacity-80 font-bold">3. Color Palette & Dithering Algorithm:</span>
                  <select 
                    value={dither} 
                    onChange={e => setDither(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="bayer">Bayer Matrix Scale 5 (Master Crisp Dither - Recommended)</option>
                    <option value="sierra">Sierra 2-4A (Smooth Gradients & Zero Banding)</option>
                    <option value="floyd">Floyd-Steinberg (Classic Precision)</option>
                    <option value="none">No Dither (Hard Edge / Cartoon Style)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <button 
                  onClick={() => setShowQualityModal(false)}
                  className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider text-white shadow-lg transition-all active:scale-[0.98]"
                  style={{ backgroundColor: theme.accent, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 0 #99001b` }}
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
// CONTEXTUAL SETTINGS VIEW: Dedicated GIF Settings vs Downloader Settings
// -------------------------------------------------------------
function SettingsView({ theme, activeSection, setActiveView, playlistMode, setPlaylistMode, quality, setQuality, gifFps, setGifFps, gifScale, setGifScale, gifDither, setGifDither, gifAudioLoop, setGifAudioLoop, changeDownloadFolder, historyItems }: any) {
  const isGifSection = activeSection === 'gif';

  // Filter history items for GIF if in GIF section
  const displayedHistory = isGifSection 
    ? historyItems.filter((h: any) => {
        const fn = (h.filename || '').toLowerCase();
        const type = (h.type || '').toUpperCase();
        return fn.endsWith('.gif') || fn.endsWith('.webp') || type === 'GIF' || type === 'LOOP_MP4' || type === 'WEBP';
      })
    : historyItems;

  return (
    <div className="w-[1050px] h-[580px] rounded-[24px] shadow-2xl p-6 flex gap-6 relative" style={{ backgroundColor: theme.panelOuter }}>
      
      {/* Return Button */}
      <button 
        onClick={() => setActiveView(isGifSection ? 'gif_machine' : 'main')} 
        className="absolute top-3 left-6 px-3 py-1 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/10 transition-all flex items-center gap-1.5 opacity-70 hover:opacity-100 z-10"
        style={{ color: theme.textMain }}
      >
        <ChevronLeft size={14} style={{ color: theme.accent }} />
        <span>Return to {isGifSection ? 'GIF Machine' : 'Downloader'}</span>
      </button>

      {/* Left Panel: Contextual Settings Controls */}
      <div className="flex-1 rounded-[20px] p-6 flex flex-col justify-between pt-8" style={{ backgroundColor: theme.panelInner }}>
        <div>
          <h2 className="text-[28px] mb-4 font-bold text-center w-full" style={{ color: theme.textMain }}>
            {isGifSection ? 'GIF Machine Settings' : 'Downloader Settings'}
          </h2>
          
          <div className="w-full flex flex-col gap-4 pl-2 mt-3">
            {isGifSection ? (
              <>
                {/* 1. GIF Framerate */}
                <div className="flex items-center justify-between mx-2">
                  <span className="text-[17px] font-medium whitespace-nowrap" style={{ color: theme.textMain }}>Default Framerate:</span>
                  <div className="flex items-center pl-3 pr-2 py-1 rounded-lg text-[15px] min-w-[140px] relative" style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText }}>
                    <div className="font-bold tracking-wide w-full text-center pr-2">
                      {gifFps === 'original' ? 'Original FPS' : `${gifFps} FPS`}
                    </div>
                    <div className="w-[3px] h-[18px] rounded-full shrink-0" style={{ backgroundColor: theme.btnLightBorder }}></div>
                    <div className="relative flex items-center justify-center cursor-pointer pl-2 pr-1 w-[32px]">
                      <ChevronDown size={20} strokeWidth={3} className="pointer-events-none" />
                      <select 
                        value={gifFps} 
                        onChange={(e) => setGifFps(e.target.value)} 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full font-bold text-[14px]"
                      >
                        <option value="original">Original FPS</option>
                        <option value="60">60 FPS</option>
                        <option value="50">50 FPS</option>
                        <option value="30">30 FPS</option>
                        <option value="24">24 FPS</option>
                        <option value="15">15 FPS</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. GIF Resolution Scale */}
                <div className="flex items-center justify-between mx-2">
                  <span className="text-[17px] font-medium whitespace-nowrap" style={{ color: theme.textMain }}>Default Resolution:</span>
                  <div className="flex items-center pl-3 pr-2 py-1 rounded-lg text-[15px] min-w-[140px] relative" style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText }}>
                    <div className="font-bold tracking-wide w-full text-center pr-2">
                      {gifScale === 'original' ? '100% Original' : gifScale}
                    </div>
                    <div className="w-[3px] h-[18px] rounded-full shrink-0" style={{ backgroundColor: theme.btnLightBorder }}></div>
                    <div className="relative flex items-center justify-center cursor-pointer pl-2 pr-1 w-[32px]">
                      <ChevronDown size={20} strokeWidth={3} className="pointer-events-none" />
                      <select 
                        value={gifScale} 
                        onChange={(e) => setGifScale(e.target.value)} 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full font-bold text-[14px]"
                      >
                        <option value="original">Original 100%</option>
                        <option value="1080p">1080p FHD</option>
                        <option value="720p">720p HD</option>
                        <option value="480p">480p SD</option>
                        <option value="360p">360p Compact</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. GIF Dithering Algorithm */}
                <div className="flex items-center justify-between mx-2">
                  <span className="text-[17px] font-medium whitespace-nowrap" style={{ color: theme.textMain }}>Dithering Engine:</span>
                  <div className="flex items-center pl-3 pr-2 py-1 rounded-lg text-[15px] min-w-[140px] relative" style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText }}>
                    <div className="font-bold tracking-wide w-full text-center pr-2">
                      {gifDither === 'bayer' ? 'Bayer Matrix' : gifDither === 'sierra' ? 'Sierra 2-4A' : gifDither === 'floyd' ? 'Floyd-Stein' : 'No Dither'}
                    </div>
                    <div className="w-[3px] h-[18px] rounded-full shrink-0" style={{ backgroundColor: theme.btnLightBorder }}></div>
                    <div className="relative flex items-center justify-center cursor-pointer pl-2 pr-1 w-[32px]">
                      <ChevronDown size={20} strokeWidth={3} className="pointer-events-none" />
                      <select 
                        value={gifDither} 
                        onChange={(e) => setGifDither(e.target.value)} 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full font-bold text-[14px]"
                      >
                        <option value="bayer">Bayer Matrix Scale 5</option>
                        <option value="sierra">Sierra 2-4A (Smooth)</option>
                        <option value="floyd">Floyd-Steinberg</option>
                        <option value="none">No Dithering</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. Sound Loop Default Toggle */}
                <div className="flex items-center justify-between mx-2 pt-1">
                  <span className="text-[17px] font-medium" style={{ color: theme.textMain }}>Sound Loop MP4 Default:</span>
                  <button 
                    onClick={() => setGifAudioLoop(!gifAudioLoop)} 
                    className="relative flex items-center w-12 h-5 rounded-full transition-colors ml-4" 
                    style={{ backgroundColor: gifAudioLoop ? theme.accent : '#555' }}
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

                {/* 5. GIF Folder Button */}
                <div className="pt-2 mx-2">
                  <button 
                    onClick={changeDownloadFolder} 
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-white/10 hover:bg-white/5 transition-all"
                    style={{ color: theme.textMain }}
                  >
                    <FolderOpen size={16} style={{ color: theme.accent }} />
                    <span>Change GIF Output Folder</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Standard Downloader Quality */}
                <div className="flex items-center justify-between mx-4">
                  <span className="text-[22px] whitespace-nowrap" style={{ color: theme.textMain }}>Download Quality:</span>
                  <div className="flex items-center pl-3 pr-2 py-1.5 rounded-lg text-[18px] min-w-[130px] relative" style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText }}>
                    <div className="font-bold tracking-wide w-full text-center pr-3">{quality}</div>
                    <div className="w-[5px] h-[22px] rounded-full shrink-0" style={{ backgroundColor: theme.btnLightBorder }}></div>
                    <div className="relative flex items-center justify-center cursor-pointer pl-3 pr-2 w-[40px]">
                      <ChevronDown size={28} strokeWidth={4} className="pointer-events-none" />
                      <select value={quality} onChange={(e) => setQuality(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full font-bold text-[18px]">
                        <option className="font-bold text-black bg-white">Best</option>
                        <option className="font-bold text-black bg-white">High</option>
                        <option className="font-bold text-black bg-white">Medium</option>
                        <option className="font-bold text-black bg-white">Low</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Playlist Mode Toggle */}
                <div className="flex items-center justify-between mx-4 mt-3">
                  <span className="text-[22px]" style={{ color: theme.textMain }}>Playlist Mode</span>
                  <button 
                    onClick={() => setPlaylistMode(!playlistMode)} 
                    className="relative flex items-center w-14 h-5 rounded-full transition-colors ml-4" 
                    style={{ backgroundColor: playlistMode ? theme.accent : '#555' }}
                  >
                    <div 
                      className="absolute w-8 h-8 rounded-full transition-all shadow-md" 
                      style={{ 
                        backgroundColor: playlistMode ? theme.inputBg : '#a0a0a8', 
                        left: playlistMode ? 'auto' : '-4px', 
                        right: playlistMode ? '-4px' : 'auto' 
                      }} 
                    />
                  </button>
                </div>

                {/* Change Folder Button */}
                <div className="pt-4 mx-4">
                  <button 
                    onClick={changeDownloadFolder} 
                    className="w-full py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-white/10 hover:bg-white/5 transition-all"
                    style={{ color: theme.textMain }}
                  >
                    <FolderOpen size={18} style={{ color: theme.accent }} />
                    <span>Change Download Folder</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="text-xs font-mono opacity-50 px-2">
          {isGifSection ? 'FFmpeg 2-Pass Palettegen Studio Core Active' : 'yt-dlp Core Universal Media Engine Active'}
        </div>
      </div>

      {/* Right Panel: Contextual History */}
      <div className="flex-[1.4] rounded-[20px] p-6 flex flex-col pt-8" style={{ backgroundColor: theme.panelInner }}>
        <h2 className="text-[28px] mb-4 font-bold text-center w-full" style={{ color: theme.textMain }}>
          {isGifSection ? 'GIF Conversion History' : 'Download History'}
        </h2>
        
        <div className="w-full flex-1 flex flex-col overflow-y-auto px-2 gap-3 custom-scrollbar">
          {displayedHistory.length > 0 ? displayedHistory.map((h: any, i: number) => (
            <div key={i} className="flex gap-3 items-center border-b border-white/5 pb-2.5">
              <div className="text-xs font-mono tracking-tight shrink-0 opacity-60" style={{ color: theme.textMain }}>{h.date}</div>
              <div className="text-sm leading-snug break-words flex-1 font-medium" style={{ color: theme.textMain }}>{h.filename}</div>
              {h.type && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10" style={{ color: theme.accent }}>
                  {h.type}
                </span>
              )}
            </div>
          )) : (
            <div className="text-sm opacity-50 italic text-center py-10" style={{ color: theme.textMain }}>
              {isGifSection ? 'No GIF conversions recorded yet.' : 'No downloads recorded yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CONTEXTUAL LOG VIEW: Dedicated GIF Logs vs Application Logs
// -------------------------------------------------------------
function LogView({ theme, activeSection, setActiveView }: { theme: any, activeSection: 'downloader' | 'gif', setActiveView: (v: any) => void }) {
  const isGifSection = activeSection === 'gif';
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'ffmpeg' | 'errors'>('all');
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchLogs = () => { 
      fetch('/api/logs').then(r => r.json()).then(d => { 
        if (Array.isArray(d)) setLogs(d); 
      }).catch(e => {}); 
    };
    fetchLogs(); 
    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, []);

  const filtered = logs.filter(l => {
    const matchSearch = l.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterMode === 'errors') return l.toLowerCase().includes('error');
    if (filterMode === 'ffmpeg') return l.toLowerCase().includes('ffmpeg') || l.toLowerCase().includes('palette') || l.toLowerCase().includes('render') || l.toLowerCase().includes('frame');
    return true;
  });

  return (
    <div className="w-[1050px] h-[580px] rounded-[24px] shadow-2xl p-6 flex flex-col relative" style={{ backgroundColor: theme.panelOuter }}>
      
      {/* Return Button */}
      <button 
        onClick={() => setActiveView(isGifSection ? 'gif_machine' : 'main')} 
        className="absolute top-3 left-6 px-3 py-1 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/10 transition-all flex items-center gap-1.5 opacity-70 hover:opacity-100 z-10"
        style={{ color: theme.textMain }}
      >
        <ChevronLeft size={14} style={{ color: theme.accent }} />
        <span>Return to {isGifSection ? 'GIF Machine' : 'Downloader'}</span>
      </button>

      <div className="flex-1 rounded-[20px] p-6 flex flex-col font-mono text-xs overflow-hidden pt-8" style={{ backgroundColor: theme.panelInner, color: theme.textSecondary }}>
        <div className="flex justify-between items-center mb-4 shrink-0 px-2">
          <div>
            <h2 className="text-[24px] font-sans font-bold" style={{ color: theme.textMain }}>
              {isGifSection ? 'GIF Machine & FFmpeg Logs' : 'Application Logs'}
            </h2>
            <div className="text-[11px] opacity-60 font-sans mt-0.5">
              {isGifSection ? 'Real-time 2-pass palettegen, frame rendering, and conversion stream' : 'Universal downloader process output and system diagnostics'}
            </div>
          </div>

          {/* Filter Chips & Search Bar */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/10 text-[11px] font-sans">
              <button 
                onClick={() => setFilterMode('all')} 
                className={`px-2.5 py-1 rounded-md transition-all ${filterMode === 'all' ? 'bg-white/15 text-white font-bold' : 'opacity-60'}`}
              >
                All Logs
              </button>
              <button 
                onClick={() => setFilterMode('ffmpeg')} 
                className={`px-2.5 py-1 rounded-md transition-all ${filterMode === 'ffmpeg' ? 'bg-white/15 text-white font-bold' : 'opacity-60'}`}
              >
                {isGifSection ? 'FFmpeg Engine' : 'Engine'}
              </button>
              <button 
                onClick={() => setFilterMode('errors')} 
                className={`px-2.5 py-1 rounded-md transition-all ${filterMode === 'errors' ? 'bg-red-500/30 text-red-300 font-bold' : 'opacity-60'}`}
              >
                Errors
              </button>
            </div>

            <input 
              type="text" 
              placeholder="Search logs..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="px-3 py-1.5 rounded-lg outline-none font-sans text-xs bg-black/40 border border-white/10 text-white w-40" 
            />
          </div>
        </div>

        <div className="w-full h-[1px] mb-3 self-center shrink-0 bg-white/5"></div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pl-2 pr-2 custom-scrollbar select-text">
          {filtered.length > 0 ? filtered.map((log, i) => {
            const isError = log.toLowerCase().includes('error');
            const isSuccess = log.includes('Successfully') || log.includes('Saved:');
            const isFfmpeg = log.includes('FFmpeg') || log.includes('Rendering') || log.includes('frame=');
            return (
              <div 
                key={i} 
                className={`py-0.5 leading-relaxed font-mono ${
                  isError ? 'font-bold' : isSuccess ? 'text-emerald-400 font-semibold' : isFfmpeg ? 'text-blue-300 opacity-90' : 'opacity-75'
                }`} 
                style={isError ? { color: theme.accent } : {}}
              >
                <span className="opacity-30 mr-2">{">"}</span>
                {log}
              </div>
            );
          }) : (
            <div className="opacity-40 italic py-8 text-center font-sans">
              {isGifSection ? 'GIF Machine conversion logs will appear here during processing.' : 'Waiting for engine logs...'}
            </div>
          )}
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
    <div className="w-[1050px] h-[580px] rounded-[24px] shadow-2xl p-6 flex flex-col mt-2" style={{ backgroundColor: theme.panelOuter }}>
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