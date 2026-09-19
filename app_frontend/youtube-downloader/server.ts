import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoints
  app.post('/api/download', (req, res) => {
    const { url, quality, playlistMode, format } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // In a real desktop app packaged with Electron, this would point to the local tool path.
    // For local development, it assumes yt-dlp is in PATH, or you can configure a specific path.
    const ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp'; 
    let cmdArgs: string[] = [];
    
    // Construct the command based on user options (adapted from the Python script)
    if (format === 'audio') {
      cmdArgs = [
        '-f', 'bestaudio',
        '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0',
        '--embed-thumbnail', '--add-metadata', '--newline',
        '-o', '%(title)s.%(ext)s'
      ];
    } else { // video
      let formatStr = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
      if (quality === '1080p') {
        formatStr = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best';
      } else if (quality === '720p') {
        formatStr = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best';
      } else if (quality === '480p') {
        formatStr = 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best';
      }

      cmdArgs = [
        '-f', formatStr,
        '--merge-output-format', 'mp4', '--embed-thumbnail', '--add-metadata', '--newline',
        '-o', '%(title)s.%(ext)s'
      ];
    }

    if (!playlistMode) {
      cmdArgs.unshift('--no-playlist');
    }

    cmdArgs.push(url);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
      const process = spawn(ytdlpPath, cmdArgs);
      
      process.stdout.on('data', (data) => {
        const output = data.toString();
        // Send logs to frontend real-time
        res.write(JSON.stringify({ type: 'log', data: output }) + '\n');
        
        // Parse progress
        const percentMatch = output.match(/(\d+\.\d+)%/);
        if (percentMatch) {
          const percentVal = parseFloat(percentMatch[1]);
          res.write(JSON.stringify({ type: 'progress', data: percentVal }) + '\n');
        }
      });

      process.stderr.on('data', (data) => {
        res.write(JSON.stringify({ type: 'log', data: data.toString() }) + '\n');
      });

      process.on('close', (code) => {
        if (code === 0) {
          res.write(JSON.stringify({ type: 'complete', code }) + '\n');
        } else {
          res.write(JSON.stringify({ type: 'error', data: `Process exited with code ${code}` }) + '\n');
        }
        res.end();
      });

      process.on('error', (err) => {
        res.write(JSON.stringify({ type: 'error', data: err.message }) + '\n');
        res.end();
      });

    } catch (e: any) {
      res.write(JSON.stringify({ type: 'error', data: e.message }) + '\n');
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
