/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Settings, X, ChevronDown, GripVertical, PlaySquare, PenLine, FolderOpen, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import ThemeEditor from './ThemeEditor';

export default function App() {
  const [activeView, setActiveView] = useState<'main' | 'settings' | 'log' | 'update' | 'prename'>('main');
  
  // --- DOWNLOAD STATES ---
  const [url, setUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  
  // --- SETTINGS STATES ---
  const [playlistMode, setPlaylistMode] = useState(false);
  const [disablePlaylistPopup, setDisablePlaylistPopup] = useState(false);
  const [showPlaylistPopup, setShowPlaylistPopup] = useState(false);
  const [autoOpenQueue, setAutoOpenQueue] = useState(true);
  const [showQueue, setShowQueue] = useState(false);
  const [quality, setQuality] = useState('Best');

  const [queueItems, setQueueItems] = useState([
    { id: '1', title: 'Awesome Video Track.mp4', progress: 45, status: 'downloading' },
    { id: '2', title: 'Cool Audio Track.mp3', progress: 0, status: 'waiting' }
  ]);

  // --- 1. LOAD SETTINGS ON STARTUP ---
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if(d.quality) setQuality(d.quality);
        if(d.autoOpenQueue !== undefined) setAutoOpenQueue(d.autoOpenQueue);
        if(d.playlistMode !== undefined) setPlaylistMode(d.playlistMode);
        if(d.disablePopups !== undefined) setDisablePlaylistPopup(d.disablePopups);
      }).catch(e => console.log("Engine starting..."));
  }, []);

  // --- 2. SAVE SETTING TO BACKEND ---
  const saveSetting = (key: string, value: any) => {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    }).catch(e => console.log("Waiting for backend..."));
  };

  // --- 3. HANDLERS FOR UI TOGGLES ---
  const handleQualityChange = (val: string) => { setQuality(val); saveSetting('quality', val); };
  const handleAutoOpenQueueChange = (val: boolean) => { setAutoOpenQueue(val); saveSetting('autoOpenQueue', val); };
  const handlePlaylistModeChange = (val: boolean) => { setPlaylistMode(val); saveSetting('playlistMode', val); };
  const handleDisablePopupChange = (val: boolean) => { setDisablePlaylistPopup(val); saveSetting('disablePopups', val); };

  // --- 4. REAL DOWNLOAD FUNCTION ---
  const startRealDownload = async (format: string) => {
    if (!url || isDownloading) return;
    setIsDownloading(true);
    
    if (playlistMode && autoOpenQueue) setShowQueue(true);

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
      if (!data.success) alert("Download Failed: " + data.error);
    } catch (error) {
      console.log("Waiting for backend...");
    } finally {
      setTimeout(() => setIsDownloading(false), 2000);
    }
  };

  // --- 5. BOTTOM ACTION BUTTONS ---
  const changeDownloadFolder = async () => {
    try {
      await fetch('/api/change_folder', { method: 'POST' });
    } catch (error) {
      console.log("Waiting for backend...");
    }
  };

  const handleUpdate = async () => {
    setActiveView('update');
    try {
      await fetch('/api/update', { method: 'POST' });
    } catch (error) {
      console.log("Failed to run updater.");
    }
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (newUrl.includes('list=') && !playlistMode && !disablePlaylistPopup) {
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
      className="min-h-screen flex flex-col items-center justify-between font-sans pt-12 pb-24 overflow-hidden relative"
      style={{ backgroundColor: theme.bg, color: theme.textMain }}
    >
      {/* <ThemeEditor theme={theme} setTheme={setTheme} /> */}

      {/* Header */}
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

      {/* Main Content Area */}
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
                disablePopup={disablePlaylistPopup} 
                setDisablePopup={handleDisablePopupChange} 
                autoOpenQueue={autoOpenQueue}
                setAutoOpenQueue={handleAutoOpenQueueChange}
                quality={quality}
                setQuality={handleQualityChange}
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
                autoOpenQueue={autoOpenQueue}
                setShowQueue={setShowQueue}
                setActiveView={setActiveView}
                startRealDownload={startRealDownload}
                isDownloading={isDownloading}
                changeDownloadFolder={changeDownloadFolder}
                handleUpdate={handleUpdate}
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
           <PrenameView 
             theme={theme} 
             setActiveView={setActiveView}
             customName={customName}
             setCustomName={setCustomName}
           />
         )}
      </AnimatePresence>

      {/* Footer */}
      <div className="absolute bottom-8 w-full flex justify-between items-end pointer-events-none px-8">
        <button 
          onClick={() => setActiveView(activeView === 'settings' ? 'main' : 'settings')} 
          className="pointer-events-auto rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group border border-white/5 shadow-lg"
          style={{ 
            width: '60px', height: '60px', 
            backgroundColor: theme.btnDarkBg, color: theme.btnDarkText,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`
          }}
          onMouseDown={(e) => e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 transparent'}
          onMouseUp={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`}
          aria-label="Settings"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
          <Settings strokeWidth={1.5} size={30} className="relative z-10" />
        </button>

        <button 
          onClick={() => setActiveView(activeView === 'log' ? 'main' : 'log')}
          className="pointer-events-auto rounded-2xl flex items-center justify-center font-bold transition-all text-[18px] active:translate-y-[4px] relative overflow-hidden group border border-white/5 shadow-lg"
          style={{ 
            width: '60px', height: '60px', 
            backgroundColor: theme.btnDarkBg, color: theme.btnDarkText,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`
          }}
          onMouseDown={(e) => e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 transparent'}
          onMouseUp={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
          <span className="relative z-10 uppercase tracking-widest">Log</span>
        </button>
      </div>

      {/* Playlist Detected Popup */}
      <AnimatePresence>
        {showPlaylistPopup && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 pointer-events-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[550px] p-8 rounded-[30px] shadow-2xl flex flex-col gap-6 relative"
              style={{ backgroundColor: theme.panelOuter, color: theme.textMain }}
            >
              <button 
                onClick={() => setShowPlaylistPopup(false)}
                className="absolute top-6 right-6 transition-transform hover:scale-110 active:scale-95"
                style={{ color: theme.textMain }}
              >
                <X size={32} />
              </button>
              
              <h3 className="text-[32px] font-medium text-center mt-2">Playlist Detected</h3>
              
              <p className="text-[20px] text-center opacity-80 leading-relaxed px-2">
                You pasted a playlist link, but Playlist Mode is currently turned off. Would you like to turn it on to download the entire list?
              </p>

              <div className="flex flex-col gap-4 mt-4">
                <button 
                  onClick={() => { setPlaylistMode(true); setShowPlaylistPopup(false); }}
                  className="py-4 rounded-xl font-bold text-[22px] transition-all hover:brightness-110 active:translate-y-[4px]"
                  style={{ 
                    backgroundColor: theme.accent, color: '#fff',
                    boxShadow: `0 4px 0 #99001b`
                  }}
                  onMouseDown={(e) => e.currentTarget.style.boxShadow = '0 0 0 transparent'}
                  onMouseUp={(e) => e.currentTarget.style.boxShadow = `0 4px 0 #99001b`}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = `0 4px 0 #99001b`}
                >
                  Turn On & Download All
                </button>
                <button 
                  onClick={() => setShowPlaylistPopup(false)}
                  className="py-4 rounded-xl font-bold text-[22px] transition-all hover:bg-white/5 active:translate-y-[2px] border-[3px]"
                  style={{ borderColor: theme.btnDarkBorder, color: theme.textMain }}
                >
                  No, just this video
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queue Drawer */}
      <AnimatePresence>
        {showQueue && (
          <motion.div
            initial={{ x: '120%' }}
            animate={{ x: 0 }}
            exit={{ x: '120%' }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed right-6 top-[120px] bottom-[110px] w-[400px] shadow-2xl z-40 flex flex-col pointer-events-auto rounded-[24px] p-4"
            style={{ backgroundColor: theme.panelOuter }}
          >
            <div className="flex justify-between items-center px-4 pt-2 pb-4">
              <h2 className="text-[28px] font-medium" style={{ color: theme.textMain }}>Download Queue</h2>
              <button 
                onClick={() => setShowQueue(false)}
                className="transition-transform hover:scale-110 active:scale-95 p-2 rounded-lg"
                style={{ color: theme.textMain }}
              >
                <X size={28} />
              </button>
            </div>
            
            <Reorder.Group 
              axis="y" 
              values={queueItems} 
              onReorder={setQueueItems} 
              className="flex-1 overflow-y-auto p-4 rounded-[20px] flex flex-col gap-4 custom-scrollbar" 
              style={{ backgroundColor: theme.panelInner }}
            >
              {queueItems.map((item) => (
                <Reorder.Item 
                  key={item.id} 
                  value={item}
                  className={`p-4 rounded-xl flex flex-col gap-2 border-[2px] cursor-grab active:cursor-grabbing bg-white ${item.status === 'waiting' ? 'opacity-70' : ''}`}
                  style={{ backgroundColor: theme.panelInner, borderColor: theme.btnDarkBorder }}
                >
                  <div className="flex gap-3 items-center">
                    <GripVertical size={20} className="opacity-50 shrink-0 cursor-grab active:cursor-grabbing" style={{ color: theme.textMain }} />
                    <div className="text-[18px] font-medium truncate flex-1" style={{ color: theme.textMain }}>{item.title}</div>
                  </div>
                  {item.status === 'downloading' ? (
                    <>
                      <div className="w-full h-2 rounded-full overflow-hidden mt-1" style={{ backgroundColor: theme.inputBg }}>
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${item.progress}%`, backgroundColor: theme.accent }}></div>
                      </div>
                      <div className="text-[14px] self-end font-bold opacity-80 mt-[-6px]" style={{ color: theme.accent }}>{item.progress}%</div>
                    </>
                  ) : (
                    <div className="text-[14px] mt-[-2px] ml-[32px]" style={{ color: theme.textMain }}>Waiting...</div>
                  )}
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}

function MainView({ url, setUrl, theme, playlistMode, autoOpenQueue, setShowQueue, setActiveView, startRealDownload, isDownloading, changeDownloadFolder, handleUpdate }: any) {
  const [progress, setProgress] = useState(0);

  return (
    <div className="w-full max-w-[800px] flex flex-col items-center relative gap-8">
      
      {/* Input Area */}
      <div className="w-full relative">
        <div 
          className="flex rounded-[10px] overflow-hidden p-[2px] shadow-inner relative z-10"
          style={{ backgroundColor: theme.inputBg }}
        >
          <input 
            type="text" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isDownloading}
            placeholder="Paste YouTube Link Here..." 
            className="flex-1 bg-transparent px-4 py-[3px] outline-none font-medium placeholder:opacity-60 text-[19px] disabled:opacity-50 tracking-wide"
            style={{ color: theme.inputText }}
          />
          <div className="w-[3px] h-[28px] overflow-hidden rounded-full self-center ml-3 mr-1" style={{ backgroundColor: theme.inputText }}></div>
          <button 
            onClick={() => setUrl('')}
            className="flex items-center justify-center transition-all hover:opacity-70 active:translate-y-[4px] disabled:opacity-50 disabled:active:translate-y-0 disabled:hover:opacity-50 mr-2"
            style={{ color: theme.inputText }}
            disabled={!url || isDownloading}
          >
            <X size={34} strokeWidth={2.5} />
          </button>
        </div>
        
        {/* Waveform & Video Name */}
        <AnimatePresence>
          {isDownloading && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="w-[98%] mx-auto flex justify-between items-center px-2 pt-4"
            >
              <div className="text-[20px] font-medium flex items-center gap-4" style={{ color: theme.textMain }}>
                <span>Downloading... <span className="opacity-70">(Check Logs)</span></span>
              </div>
              <div className="flex items-center gap-[4px] h-[36px]">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-[5px] rounded-full"
                      style={{ backgroundColor: theme.accent }}
                      animate={{ height: ['20%', '100%', '20%'] }}
                      transition={{ 
                        duration: 0.5 + Math.random() * 0.5, 
                        repeat: Infinity, 
                        ease: "easeInOut",
                        delay: Math.random() * 0.5 
                      }}
                    />
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Download Buttons */}
      <div className="mt-8 flex flex-col items-center gap-6">
        <div className="flex gap-8">
          <button 
            onClick={() => startRealDownload('mp3')}
            disabled={isDownloading}
            className="disabled:opacity-50 disabled:cursor-not-allowed font-extrabold uppercase tracking-widest text-[22px] py-[14px] px-12 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group"
            style={{ 
              backgroundColor: theme.btnLightBg, color: theme.btnLightText, 
              boxShadow: isDownloading ? 'none' : `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)` 
            }}
            onMouseDown={(e) => !isDownloading && (e.currentTarget.style.boxShadow = 'inset 0 2px 0 rgba(255,255,255,0.4), 0 0 0 transparent')}
            onMouseUp={(e) => !isDownloading && (e.currentTarget.style.boxShadow = `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)`)}
            onMouseLeave={(e) => !isDownloading && (e.currentTarget.style.boxShadow = `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)`)}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none"></div>
            <span className="relative drop-shadow-md">Download MP3</span>
          </button>
          <button 
            onClick={() => startRealDownload('mp4')}
            disabled={isDownloading}
            className="disabled:opacity-50 disabled:cursor-not-allowed font-extrabold uppercase tracking-widest text-[22px] py-[14px] px-12 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group"
            style={{ 
              backgroundColor: theme.btnLightBg, color: theme.btnLightText, 
              boxShadow: isDownloading ? 'none' : `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)` 
            }}
            onMouseDown={(e) => !isDownloading && (e.currentTarget.style.boxShadow = 'inset 0 2px 0 rgba(255,255,255,0.4), 0 0 0 transparent')}
            onMouseUp={(e) => !isDownloading && (e.currentTarget.style.boxShadow = `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)`)}
            onMouseLeave={(e) => !isDownloading && (e.currentTarget.style.boxShadow = `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)`)}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none"></div>
            <span className="relative drop-shadow-md">Download MP4</span>
          </button>
        </div>
        <button 
          onClick={() => startRealDownload('wav')}
          disabled={isDownloading}
          className="disabled:opacity-50 disabled:cursor-not-allowed font-extrabold uppercase tracking-widest text-[22px] py-[14px] px-12 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] relative overflow-hidden group mt-2"
          style={{ 
            backgroundColor: theme.btnLightBg, color: theme.btnLightText, 
            boxShadow: isDownloading ? 'none' : `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)` 
          }}
          onMouseDown={(e) => !isDownloading && (e.currentTarget.style.boxShadow = 'inset 0 2px 0 rgba(255,255,255,0.4), 0 0 0 transparent')}
          onMouseUp={(e) => !isDownloading && (e.currentTarget.style.boxShadow = `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)`)}
          onMouseLeave={(e) => !isDownloading && (e.currentTarget.style.boxShadow = `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 ${theme.btnLightBorder}, 0 10px 15px rgba(0,0,0,0.2)`)}
          >
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none mix-blend-overlay"></div>
          <span className="relative drop-shadow-md">Download WAV</span>
        </button>
      </div>

      {/* Bottom Action Buttons */}
      <div className="mt-28 flex flex-col items-center gap-[20px] w-[800px]">
        <button 
          onClick={() => setActiveView('prename')}
          className="w-[280px] gap-3 font-bold py-[12px] px-8 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] text-[16px] uppercase tracking-widest whitespace-nowrap relative overflow-hidden group border border-white/5"
          style={{ 
            backgroundColor: theme.btnDarkBg, color: theme.btnDarkText, 
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` 
          }}
          onMouseDown={(e) => e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 transparent'}
          onMouseUp={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
          <PenLine size={20} className="relative z-10" />
          <span className="relative z-10">Prename File</span>
        </button>

        <div className="flex justify-center gap-[24px]">
          <button 
            onClick={changeDownloadFolder}
            className="w-[280px] gap-3 font-bold py-[12px] px-8 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] text-[16px] uppercase tracking-widest whitespace-nowrap relative overflow-hidden group border border-white/5"
            style={{ 
              backgroundColor: theme.btnDarkBg, color: theme.btnDarkText, 
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` 
            }}
            onMouseDown={(e) => e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 transparent'}
            onMouseUp={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
            <FolderOpen size={20} className="relative z-10" />
            <span className="relative z-10">Change Folder</span>
          </button>

          <button 
            onClick={handleUpdate}
            className="w-[280px] gap-3 font-bold py-[12px] px-8 rounded-2xl flex items-center justify-center transition-all active:translate-y-[4px] text-[16px] uppercase tracking-widest whitespace-nowrap relative overflow-hidden group border border-white/5"
            style={{ 
              backgroundColor: theme.btnDarkBg, color: theme.btnDarkText, 
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)` 
            }}
            onMouseDown={(e) => e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 transparent'}
            onMouseUp={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.15), 0 5px 0 ${theme.btnDarkBorder}, 0 8px 10px rgba(0,0,0,0.15)`}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
            <RefreshCcw size={20} className="relative z-10" />
            <span className="relative z-10">Update Tool</span>
          </button>
        </div>
      </div>
      
    </div>
  );
}

function SettingsView({ 
  theme, 
  playlistMode, 
  setPlaylistMode, 
  disablePopup, 
  setDisablePopup, 
  autoOpenQueue, 
  setAutoOpenQueue,
  quality,
  setQuality
}: any) {
  return (
    <div 
      className="w-[1050px] h-[600px] rounded-[24px] shadow-2xl p-6 flex gap-6 mt-4"
      style={{ backgroundColor: theme.panelOuter }}
    >
      
      {/* Settings Panel */}
      <div 
        className="flex-1 rounded-[20px] p-6 flex flex-col"
        style={{ backgroundColor: theme.panelInner }}
      >
        <h2 className="text-[34px] mb-8 font-medium text-center w-full" style={{ color: theme.textMain }}>Settings</h2>
        
        <div className="w-full flex flex-col gap-6 pl-2 mt-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-start gap-4 mx-4">
              <span className="text-[24px] whitespace-nowrap" style={{ color: theme.textMain }}>Download Quality:</span>
              <div 
                className="flex items-center pl-3 pr-2 py-1 rounded-lg text-[20px] min-w-[120px]"
                style={{ backgroundColor: theme.btnLightBg, color: theme.btnLightText }}
              >
                <div className="font-bold tracking-wide w-full text-center pr-3">{quality}</div>
                <div className="w-[5px] h-[22px] rounded-full shrink-0" style={{ backgroundColor: theme.btnLightBorder }}></div>
                <div className="relative flex items-center justify-center cursor-pointer pl-3 pr-2 w-[40px]">
                  <ChevronDown size={28} strokeWidth={4} className="pointer-events-none" />
                  <select 
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full font-bold text-[18px]"
                  >
                    <option className="font-bold text-black bg-white">Best</option>
                    <option className="font-bold text-black bg-white">High</option>
                    <option className="font-bold text-black bg-white">Medium</option>
                    <option className="font-bold text-black bg-white">Low</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 mx-4 mt-6">
              <div className="flex items-center justify-between w-[320px]">
                <span className="text-[24px]" style={{ color: theme.textMain }}>Auto-Open Queue</span>
                <button 
                  onClick={() => setAutoOpenQueue(!autoOpenQueue)}
                  className={`relative flex items-center w-14 h-5 rounded-full transition-colors ml-4`}
                  style={{ backgroundColor: autoOpenQueue ? theme.accent : '#555' }}
                  aria-pressed={autoOpenQueue}
                >
                  <div 
                    className={`absolute w-8 h-8 rounded-full transition-all shadow-md`}
                    style={{ 
                      backgroundColor: autoOpenQueue ? theme.inputBg : '#a0a0a8',
                      left: autoOpenQueue ? 'auto' : '-4px',
                      right: autoOpenQueue ? '-4px' : 'auto',
                    }} 
                  />
                </button>
              </div>

              <div className="flex items-center justify-between w-[320px]">
                <span className="text-[24px]" style={{ color: theme.textMain }}>Playlist Mode</span>
                <button 
                  onClick={() => setPlaylistMode(!playlistMode)}
                  className={`relative flex items-center w-14 h-5 rounded-full transition-colors ml-4`}
                  style={{ backgroundColor: playlistMode ? theme.accent : '#555' }}
                  aria-pressed={playlistMode}
                >
                  <div 
                    className={`absolute w-8 h-8 rounded-full transition-all shadow-md`}
                    style={{ 
                      backgroundColor: playlistMode ? theme.inputBg : '#a0a0a8',
                      left: playlistMode ? 'auto' : '-4px',
                      right: playlistMode ? '-4px' : 'auto',
                    }} 
                  />
                </button>
              </div>

              <div className="flex items-center justify-between w-[320px]">
                <span className="text-[24px]" style={{ color: theme.textMain }}>Disable Popups</span>
                <button 
                  onClick={() => setDisablePopup(!disablePopup)}
                  className={`relative flex items-center w-14 h-5 rounded-full transition-colors ml-4`}
                  style={{ backgroundColor: disablePopup ? theme.accent : '#555' }}
                  aria-pressed={disablePopup}
                >
                  <div 
                    className={`absolute w-8 h-8 rounded-full transition-all shadow-md`}
                    style={{ 
                      backgroundColor: disablePopup ? theme.inputBg : '#a0a0a8',
                      left: disablePopup ? 'auto' : '-4px',
                      right: disablePopup ? '-4px' : 'auto',
                    }} 
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Download History Panel */}
      <div 
        className="flex-[1.4] rounded-[20px] p-6 flex flex-col"
        style={{ backgroundColor: theme.panelInner }}
      >
        <h2 className="text-[30px] mb-6 font-medium text-center w-full" style={{ color: theme.textMain }}>Download History</h2>
        
        <div className="w-full flex-1 flex overflow-y-auto pl-4">
          <div className="w-[140px] pt-1 flex flex-col items-end pr-3 border-r-[2px] gap-3" style={{ borderColor: theme.btnDarkBorder }}>
             <div className="text-[24px] font-mono tracking-tight" style={{ color: theme.textMain }}>06.05.2026</div>
             <div className="text-[24px] font-mono tracking-tight" style={{ color: theme.textMain }}>03.05.2026</div>
          </div>
          
          <div className="flex-1 pt-1 flex flex-col pl-4 gap-3">
             <div className="text-[24px]" style={{ color: theme.textMain }}>Example Beat.mp3</div>
             <div className="text-[24px]" style={{ color: theme.textMain }}>Example Video.mp4</div>
          </div>
        </div>
      </div>
      
    </div>
  );
}

function LogView({ theme }: { theme: any }) {
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const fetchLogs = () => {
      fetch('/api/logs')
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) setLogs(d);
        })
        .catch(e => {});
    };
    
    fetchLogs();
    const interval = setInterval(fetchLogs, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const filtered = logs.filter(l => l.toLowerCase().includes(search.toLowerCase()));

  return (
    <div 
      className="w-[1050px] h-[600px] rounded-[24px] shadow-2xl p-6 flex flex-col mt-4"
      style={{ backgroundColor: theme.panelOuter }}
    >
      <div 
        className="flex-1 rounded-[20px] p-6 flex flex-col font-mono text-[18px] overflow-hidden"
        style={{ backgroundColor: theme.panelInner, color: theme.textSecondary }}
      >
        <h2 className="text-[28px] mb-4 font-medium font-sans text-center shrink-0" style={{ color: theme.textMain }}>Application Logs</h2>
        
        <div className="w-[85%] h-[2px] mb-6 self-center shrink-0" style={{ backgroundColor: theme.btnDarkBorder }}></div>

        <div className="flex justify-end mb-4 pr-4 shrink-0">
          <input 
            type="text" 
            placeholder="Search logs..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg outline-none font-sans text-[16px]"
            style={{ backgroundColor: theme.inputBg, color: theme.inputText }}
          />
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pl-4 pr-2 custom-scrollbar">
          {filtered.length > 0 ? (
            filtered.map((log, i) => {
              const isError = log.toLowerCase().includes('error');
              return (
                <div key={i} className={isError ? 'font-bold' : 'opacity-70'} style={isError ? { color: theme.accent } : {}}>
                  {log}
                </div>
              );
            })
          ) : (
            <div className="opacity-50 italic">Waiting for engine logs...</div>
          )}
        </div>
      </div>
    </div>
  );
}

function UpdateView({ theme, setActiveView }: { theme: any, setActiveView: (v: any) => void }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let checkInterval: NodeJS.Timeout;

    const fetchLogs = () => {
      fetch('/api/logs')
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) {
            setLogs(d);
            if (d.join(' ').includes("Process Finished Successfully!") || d.join(' ').includes("GitHub Update check skipped/failed")) {
              setDone(true);
              clearInterval(checkInterval);
              setTimeout(() => {
                setActiveView('main');
              }, 3000);
            }
          }
        })
        .catch(e => {});
    };

    fetchLogs();
    checkInterval = setInterval(fetchLogs, 1000);
    
    return () => clearInterval(checkInterval);
  }, [setActiveView]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div 
      className="w-[1050px] h-[600px] rounded-[24px] shadow-2xl p-6 flex flex-col mt-4"
      style={{ backgroundColor: theme.panelOuter }}
    >
      <div 
        className="flex-1 rounded-[20px] p-6 flex flex-col font-mono text-[18px] overflow-hidden"
        style={{ backgroundColor: theme.panelInner, color: theme.textSecondary }}
      >
        <h2 className="text-[28px] mb-4 font-medium font-sans text-center shrink-0" style={{ color: theme.textMain }}>Tool Update</h2>
        <div className="w-[85%] h-[2px] mb-6 self-center shrink-0" style={{ backgroundColor: theme.btnDarkBorder }}></div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-4 opacity-90 animate-fade-in">
              <span style={{ color: theme.accent }}>{">"}</span>
              <span style={{ color: theme.textMain }}>{log}</span>
            </div>
          ))}
          {done && (
            <div className="flex gap-4 opacity-90 animate-fade-in mt-4 text-green-400 font-bold">
              <span style={{ color: theme.accent }}>{">"}</span>
              <span>Update successful! Returning to main menu...</span>
            </div>
          )}
          {!done && logs.length < 8 && (
            <div className="flex gap-4 opacity-90 animate-fade-in mt-2">
              <span className="animate-pulse" style={{ color: theme.accent }}>_</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}

function PrenameView({ theme, setActiveView, customName, setCustomName }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-[500px] rounded-[24px] shadow-2xl p-6 flex flex-col items-center justify-center relative border border-white/10"
        style={{ backgroundColor: theme.panelOuter }}
      >
        <button 
          onClick={() => setActiveView('main')}
          className="absolute top-4 right-4 transition-transform active:scale-95 z-10 opacity-70 hover:opacity-100"
          style={{ color: theme.textMain }}
        >
          <X size={28} strokeWidth={2.5} />
        </button>

        <h2 className="text-[26px] mt-2 mb-6 font-bold" style={{ color: theme.textMain }}>Prename Next Download</h2>
        <input 
          type="text" 
          placeholder="Enter custom filename..."
          value={customName}
          onChange={e => setCustomName(e.target.value)}
          className="w-full px-5 py-4 rounded-xl outline-none font-medium text-[20px] tracking-wide mb-8 shadow-inner"
          style={{ backgroundColor: theme.inputBg, color: theme.inputText }}
        />
        <button 
          onClick={() => setActiveView('main')}
          className="font-bold text-[20px] py-[10px] px-10 rounded-2xl transition-all active:translate-y-[4px] relative overflow-hidden group"
          style={{ 
            backgroundColor: theme.accent, color: theme.inputBg,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 5px 0 rgba(0,0,0,0.3)` 
          }}
          onMouseDown={(e) => e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.4), 0 0 0 transparent'}
          onMouseUp={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.4), 0 5px 0 rgba(0,0,0,0.3)`}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.4), 0 5px 0 rgba(0,0,0,0.3)`}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
          <span className="relative z-10">Save & Close</span>
        </button>
      </motion.div>
    </motion.div>
  );
}