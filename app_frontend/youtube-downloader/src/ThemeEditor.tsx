import { useState } from 'react';

export default function ThemeEditor({ theme, setTheme }: { theme: any, setTheme: (v: any) => void }) {
  const handleChange = (k: string, v: string) => setTheme((prev: any) => ({ ...prev, [k]: v}));
  
  const exportThemeToPython = () => {
    // Generate a python dict string that could be copied
    const pyDict = `theme = {\n${Object.entries(theme).map(([k, v]) => `    '${k}': '${v}'`).join(',\n')}\n}`;
    const blob = new Blob([pyDict], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theme.py';
    a.click();
  };

  return (
    <div className="fixed top-4 right-4 bg-black/40 p-4 rounded-xl backdrop-blur-md border border-white/10 shadow-2xl z-50 w-[240px] flex flex-col gap-2">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-white text-sm font-bold">Theme Editor</h3>
        <button 
          onClick={exportThemeToPython}
          className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded transition-colors"
          title="Export to Python"
        >
          Export
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto flex flex-col gap-2 pr-2 custom-scrollbar">
        {Object.entries(theme).map(([key, val]) => (
          <div key={key} className="flex justify-between items-center text-xs text-white">
            <span>{key}</span>
            <input 
              type="color" 
              value={val as string} 
              onChange={e => handleChange(key, e.target.value)} 
              className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" 
            />
          </div>
        ))}
      </div>
    </div>
  );
}
