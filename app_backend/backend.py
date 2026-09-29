import os
import sys
import json
import shutil
import threading
import subprocess
import time
import re
import urllib.request
import zipfile
import io
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
import webview

# --- STANDALONE PORTABLE PATHS ---
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    UI_DIR = sys._MEIPASS  # PyInstaller temp folder
else:
    UI_DIR = os.path.dirname(os.path.abspath(__file__))

DIST_DIR = os.path.join(UI_DIR, "dist")

APPDATA_DIR = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "LeviDownloader")
TOOLS_DIR = os.path.join(APPDATA_DIR, "tools")
YTDLP_EXE = os.path.join(TOOLS_DIR, "yt-dlp.exe")
FFMPEG_EXE = os.path.join(TOOLS_DIR, "ffmpeg.exe")
FFPROBE_EXE = os.path.join(TOOLS_DIR, "ffprobe.exe")
COOKIES_STORED = os.path.join(TOOLS_DIR, "cookies.txt")
SETTINGS_FILE = os.path.join(TOOLS_DIR, "settings.json")
HISTORY_FILE = os.path.join(TOOLS_DIR, "history.json")

USER_DOWNLOADS = os.path.join(os.path.expanduser("~"), "Downloads")
COOKIES_NEW = os.path.join(USER_DOWNLOADS, "youtube.com_cookies.txt")

# Hardcoded Local Version for GitHub Checks (Dev Branch Pro Edition)
CURRENT_VERSION = "v1.1.0-dev"

# Cached Update Status
cached_update_info = {
    "update_available": False,
    "ytdlp_update": False,
    "ytdlp_current": "",
    "ytdlp_latest": "",
    "app_update": False,
    "app_current": CURRENT_VERSION,
    "app_latest": "",
    "app_release_url": "",
    "message": "",
    "checked": False
}

# Global Variables
app_logs = []
download_dir = USER_DOWNLOADS
window = None
current_process = None

def get_installed_ytdlp_version():
    try:
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        
        exe_path = YTDLP_EXE
        if not os.path.exists(exe_path):
            exe_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools", "yt-dlp.exe")
        
        if os.path.exists(exe_path):
            res = subprocess.run(
                [exe_path, "--version"],
                capture_output=True,
                text=True,
                startupinfo=startupinfo,
                timeout=5
            )
            if res.returncode == 0:
                return res.stdout.strip()
    except Exception as e:
        app_logs.append(f"Could not get yt-dlp version: {e}")
    return ""

def is_newer_version(remote_ver, local_ver):
    if not remote_ver or not local_ver:
        return False
    try:
        r_parts = [int(x) for x in re.findall(r'\d+', str(remote_ver))]
        l_parts = [int(x) for x in re.findall(r'\d+', str(local_ver))]
        if not r_parts or not l_parts:
            return False
        max_len = max(len(r_parts), len(l_parts))
        r_padded = r_parts + [0] * (max_len - len(r_parts))
        l_padded = l_parts + [0] * (max_len - len(l_parts))
        return r_padded > l_padded
    except Exception:
        return False

def check_all_updates_worker():
    global cached_update_info
    ytdlp_has_update = False
    app_has_update = False
    ytdlp_curr = get_installed_ytdlp_version()
    ytdlp_latest = ""
    app_latest = ""
    app_url = ""
    reasons = []

    # 1. Check yt-dlp GitHub release
    try:
        req = urllib.request.Request(
            "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode())
                ytdlp_latest = data.get("tag_name", "").strip()
                if ytdlp_curr and ytdlp_latest and is_newer_version(ytdlp_latest, ytdlp_curr):
                    ytdlp_has_update = True
                    reasons.append(f"yt-dlp Core Engine ({ytdlp_curr} -> {ytdlp_latest})")
    except Exception as e:
        app_logs.append(f"yt-dlp update check skipped/failed: {e}")

    # 2. Check GitHub release
    try:
        req = urllib.request.Request(
            "https://api.github.com/repos/OlfJD/LevisYoutubeDownloader/releases/latest",
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode())
                app_latest = data.get("tag_name", CURRENT_VERSION).strip()
                app_url = data.get("html_url", "")
                if app_latest and is_newer_version(app_latest, CURRENT_VERSION):
                    app_has_update = True
                    reasons.append(f"Levi's Downloader Pro ({CURRENT_VERSION} -> {app_latest})")
    except Exception as e:
        app_logs.append(f"App update check skipped/failed: {e}")

    msg = ""
    if reasons:
        msg = f"Update available for {', '.join(reasons)}! Click 'Update Tool' to install."

    cached_update_info = {
        "update_available": ytdlp_has_update or app_has_update,
        "ytdlp_update": ytdlp_has_update,
        "ytdlp_current": ytdlp_curr,
        "ytdlp_latest": ytdlp_latest,
        "app_update": app_has_update,
        "app_current": CURRENT_VERSION,
        "app_latest": app_latest,
        "app_release_url": app_url,
        "message": msg,
        "checked": True
    }

def initialize_assets():
    if not os.path.exists(TOOLS_DIR):
        os.makedirs(TOOLS_DIR)
    
    executables = ["yt-dlp.exe", "ffmpeg.exe", "ffprobe.exe"]
    
    # 1. Check if embedded/local tools exist and copy
    for exe_name in executables:
        target_exe = os.path.join(TOOLS_DIR, exe_name)
        embedded_exe = None
        if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
            embedded_exe = os.path.join(sys._MEIPASS, "tools", exe_name)
        else:
            local_tools = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools", exe_name)
            if os.path.exists(local_tools):
                embedded_exe = local_tools

        should_copy = False
        if not os.path.exists(target_exe):
            should_copy = True
        elif embedded_exe and os.path.exists(embedded_exe) and exe_name == "yt-dlp.exe":
            try:
                emb_res = subprocess.run([embedded_exe, "--version"], capture_output=True, text=True, timeout=5)
                tgt_res = subprocess.run([target_exe, "--version"], capture_output=True, text=True, timeout=5)
                if emb_res.returncode == 0 and tgt_res.returncode == 0:
                    if is_newer_version(emb_res.stdout.strip(), tgt_res.stdout.strip()):
                        should_copy = True
            except Exception:
                pass

        if should_copy and embedded_exe and os.path.exists(embedded_exe):
            try:
                shutil.copy2(embedded_exe, target_exe)
                app_logs.append(f"Engine asset {exe_name} initialized.")
            except Exception as e:
                app_logs.append(f"Failed to copy {exe_name}: {e}")

    # 2. Automated fallback: Download missing binaries if not present
    target_ytdlp = os.path.join(TOOLS_DIR, "yt-dlp.exe")
    if not os.path.exists(target_ytdlp):
        try:
            app_logs.append("Fetching yt-dlp core binary...")
            urllib.request.urlretrieve("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe", target_ytdlp)
            app_logs.append("yt-dlp engine downloaded successfully.")
        except Exception as e:
            app_logs.append(f"Error downloading yt-dlp: {e}")

    target_ffmpeg = os.path.join(TOOLS_DIR, "ffmpeg.exe")
    if not os.path.exists(target_ffmpeg):
        try:
            app_logs.append("Fetching FFmpeg & FFprobe engine binaries...")
            url = "https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=60) as resp:
                z = zipfile.ZipFile(io.BytesIO(resp.read()))
                for name in z.namelist():
                    base = os.path.basename(name)
                    if base in ('ffmpeg.exe', 'ffprobe.exe'):
                        with open(os.path.join(TOOLS_DIR, base), 'wb') as f:
                            f.write(z.read(name))
            app_logs.append("FFmpeg engine installed successfully.")
        except Exception as e:
            app_logs.append(f"Error downloading FFmpeg: {e}")

def check_cookies():
    if os.path.exists(COOKIES_NEW):
        try:
            if not os.path.exists(TOOLS_DIR): os.makedirs(TOOLS_DIR)
            shutil.move(COOKIES_NEW, COOKIES_STORED)
            app_logs.append("Cookies moved to safe storage!")
        except Exception as e:
            app_logs.append(f"Cookie Error: {e}")

# --- HISTORY DATABASE FUNCTIONS ---
def load_history():
    try:
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, 'r') as f:
                return json.load(f)
    except:
        pass
    return []

def save_history(history_list):
    try:
        if not os.path.exists(TOOLS_DIR):
            os.makedirs(TOOLS_DIR)
        with open(HISTORY_FILE, 'w') as f:
            json.dump(history_list[:30], f)  # Keep up to last 30 entries
    except Exception as e:
        app_logs.append(f"History save error: {e}")

def add_history_entry(filename, format_type="MP4"):
    try:
        date_str = datetime.now().strftime("%d.%m.%Y %H:%M")
        current_hist = load_history()
        current_hist.insert(0, {
            "date": date_str,
            "filename": filename,
            "type": format_type
        })
        save_history(current_hist)
    except Exception as e:
        app_logs.append(f"Add history error: {e}")

# --- FLASK SERVER SETUP ---
app = Flask(__name__, static_folder=DIST_DIR)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# --- API ENDPOINTS ---
@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    global download_dir
    if request.method == 'GET':
        try:
            with open(SETTINGS_FILE, 'r') as f:
                data = json.load(f)
                if "downloadDir" in data and os.path.exists(data["downloadDir"]):
                    download_dir = data["downloadDir"]
                data["downloadDir"] = download_dir
                return jsonify(data)
        except:
            return jsonify({"downloadDir": download_dir})
    else:
        new_data = request.json or {}
        try:
            with open(SETTINGS_FILE, 'r') as f:
                data = json.load(f)
        except:
            data = {}
        data.update(new_data)
        if "downloadDir" in new_data and os.path.exists(new_data["downloadDir"]):
            download_dir = new_data["downloadDir"]
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(data, f)
        return jsonify({"success": True})

@app.route('/api/history', methods=['GET'])
def get_history():
    return jsonify(load_history())

@app.route('/api/logs', methods=['GET'])
def get_logs():
    return jsonify(app_logs)

@app.route('/api/change_folder', methods=['POST'])
def api_change_folder():
    global download_dir
    if window:
        result = window.create_file_dialog(webview.FOLDER_DIALOG)
        if result and len(result) > 0:
            download_dir = result[0]
            # Save to settings
            try:
                with open(SETTINGS_FILE, 'r') as f:
                    data = json.load(f)
            except:
                data = {}
            data["downloadDir"] = download_dir
            with open(SETTINGS_FILE, 'w') as f:
                json.dump(data, f)
            return jsonify({"success": True, "folder": download_dir})
    return jsonify({"success": False, "folder": download_dir})

@app.route('/api/open_folder', methods=['POST'])
def api_open_folder():
    try:
        folder = request.json.get('folder', download_dir) if request.json else download_dir
        if not os.path.exists(folder):
            os.makedirs(folder, exist_ok=True)
        if os.name == 'nt':
            os.startfile(folder)
        else:
            subprocess.Popen(['xdg-open', folder])
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/select_local_file', methods=['POST'])
def api_select_local_file():
    if window:
        file_types = ('Video & Media Files (*.mp4;*.mov;*.mkv;*.webm;*.avi;*.flv;*.ts;*.m4v;*.wmv;*.gif)', 'All files (*.*)')
        result = window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        if result and len(result) > 0:
            selected_path = result[0]
            # Probe file info
            info = probe_media_file(selected_path)
            return jsonify({"success": True, "filePath": selected_path, "fileName": os.path.basename(selected_path), "info": info})
    return jsonify({"success": False})

@app.route('/api/probe_media', methods=['POST'])
def api_probe_media():
    data = request.json or {}
    path_or_url = data.get('target', '')
    if not path_or_url:
        return jsonify({"success": False, "error": "No target provided"})
    info = probe_media_file(path_or_url)
    return jsonify({"success": True, "info": info})

def probe_media_file(target):
    # Returns duration, fps, resolution, format
    startupinfo = None
    if os.name == 'nt':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

    my_env = os.environ.copy()
    my_env["PATH"] += os.pathsep + TOOLS_DIR

    info = {"duration": 0, "fps": 30, "width": 0, "height": 0, "format": "", "has_audio": False}
    try:
        if os.path.exists(target) and os.path.exists(FFPROBE_EXE):
            cmd = [
                FFPROBE_EXE, "-v", "error", "-show_entries",
                "stream=width,height,r_frame_rate,avg_frame_rate,codec_type,duration:format=duration",
                "-of", "json", target
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, startupinfo=startupinfo, env=my_env, timeout=10)
            if res.returncode == 0:
                data = json.loads(res.stdout)
                streams = data.get("streams", [])
                for s in streams:
                    if s.get("codec_type") == "video":
                        info["width"] = s.get("width", 0)
                        info["height"] = s.get("height", 0)
                        rate_str = s.get("avg_frame_rate", s.get("r_frame_rate", "30/1"))
                        if "/" in rate_str:
                            num, den = rate_str.split("/")
                            if float(den) > 0:
                                info["fps"] = round(float(num) / float(den), 2)
                        else:
                            info["fps"] = round(float(rate_str), 2)
                    elif s.get("codec_type") == "audio":
                        info["has_audio"] = True
                
                fmt = data.get("format", {})
                if "duration" in fmt:
                    info["duration"] = round(float(fmt["duration"]), 2)
    except Exception as e:
        app_logs.append(f"Probe warning: {e}")
    return info

@app.route('/api/stop', methods=['POST'])
def api_stop():
    global current_process
    if current_process:
        try:
            current_process.terminate()
        except:
            pass
        app_logs.append("Process stopped by user.")
        app_logs.append("Process Finished Successfully!")
        return jsonify({"success": True})
    return jsonify({"success": False})

@app.route('/api/minimize', methods=['POST'])
def api_minimize():
    if window:
        window.minimize()
        return jsonify({"success": True})
    return jsonify({"success": False})

@app.route('/api/close', methods=['POST'])
def api_close():
    if window:
        window.destroy()
        return jsonify({"success": True})
    return jsonify({"success": False})

@app.route('/api/check_updates', methods=['GET'])
def api_check_updates():
    force = request.args.get('force', 'false').lower() == 'true'
    if force or not cached_update_info["checked"]:
        check_all_updates_worker()
    return jsonify(cached_update_info)

@app.route('/api/update', methods=['POST'])
def api_update():
    def run_update():
        global app_logs
        app_logs.clear()
        app_logs.append("=== PART 1: Updating Core Engine (yt-dlp) ===")
        app_logs.append("Fetching latest release from yt-dlp GitHub...")
        run_process([YTDLP_EXE, "-U"])
        app_logs.append(" ")
        app_logs.append("=== PART 2: Checking Levi's Downloader Updates ===")
        app_logs.append(f"Current UI version: {CURRENT_VERSION}")
        
        try:
            req = urllib.request.Request(
                "https://api.github.com/repos/OlfJD/LevisYoutubeDownloader/releases/latest",
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    latest_tag = data.get("tag_name", CURRENT_VERSION)
                    app_logs.append(f"Latest release found on GitHub: {latest_tag}")
                    if latest_tag != CURRENT_VERSION and is_newer_version(latest_tag, CURRENT_VERSION):
                        app_logs.append("New update available!")
                        app_logs.append(f"Get the update at: {data.get('html_url')}")
                    else:
                        app_logs.append("UI is completely up to date!")
                else:
                    app_logs.append("Failed to fetch GitHub version data.")
        except Exception as e:
            app_logs.append(f"GitHub Update check skipped/failed: {e}")
            
        check_all_updates_worker()
        app_logs.append(" ")
        app_logs.append("Process Finished Successfully!")
    
    threading.Thread(target=run_update).start()
    return jsonify({"success": True})

@app.route('/api/download', methods=['POST'])
def api_download():
    data = request.json or {}
    url = data.get('url', '').strip()
    fmt = data.get('format', 'mp4')
    quality = data.get('quality', 'Best')
    custom_name = data.get('customName', '').strip()
    playlist_mode = data.get('playlistMode', False)
    start_time = data.get('startTime', '').strip()
    end_time = data.get('endTime', '').strip()
    fps = data.get('fps', 'original')
    scale = data.get('scale', 'original')
    dither = data.get('dither', 'bayer')
    
    if not url:
        return jsonify({"success": False, "error": "No URL provided"})
    
    threading.Thread(target=run_download, args=(
        url, fmt, quality, custom_name, playlist_mode, start_time, end_time, fps, scale, dither
    )).start()
    return jsonify({"success": True})

@app.route('/api/convert_local', methods=['POST'])
def api_convert_local():
    data = request.json or {}
    input_file = data.get('filePath', '').strip()
    target_format = data.get('format', 'gif') # gif, loop_mp4, webp, mp3, wav, flac
    custom_name = data.get('customName', '').strip()
    start_time = data.get('startTime', '').strip()
    end_time = data.get('endTime', '').strip()
    fps = data.get('fps', 'original')
    scale = data.get('scale', 'original')
    dither = data.get('dither', 'bayer')
    
    if not input_file or not os.path.exists(input_file):
        return jsonify({"success": False, "error": "Input file does not exist"})
    
    threading.Thread(target=run_local_convert, args=(
        input_file, target_format, custom_name, start_time, end_time, fps, scale, dither
    )).start()
    return jsonify({"success": True})

# --- CORE PROCESS RUNNER ---
def run_process(cmd_list):
    global app_logs, current_process
    my_env = os.environ.copy()
    my_env["PATH"] += os.pathsep + TOOLS_DIR
    
    startupinfo = None
    if os.name == 'nt':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

    try:
        current_process = subprocess.Popen(
            cmd_list,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            startupinfo=startupinfo,
            env=my_env,
            universal_newlines=True,
            encoding='utf-8',
            errors='ignore'
        )

        for line in current_process.stdout:
            clean_line = line.strip()
            if clean_line:
                app_logs.append(clean_line)
                if len(app_logs) > 300:
                    app_logs.pop(0)

        current_process.wait()
    except Exception as e:
        app_logs.append(f"CRITICAL ERROR: {str(e)}")
    finally:
        current_process = None

# --- HIGH-QUALITY VIDEO TO GIF / CONVERSION ENGINE ---
def build_gif_filter_graph(fps_val, scale_val, dither_val):
    filters = []
    
    # 1. FPS filter if specific fps requested
    if fps_val and fps_val != "original":
        filters.append(f"fps={fps_val}")
        
    # 2. Lanczos high-quality scale if requested
    if scale_val and scale_val != "original":
        if scale_val == "1080p":
            filters.append("scale=-1:1080:flags=lanczos")
        elif scale_val == "720p":
            filters.append("scale=-1:720:flags=lanczos")
        elif scale_val == "480p":
            filters.append("scale=-1:480:flags=lanczos")
        elif scale_val == "360p":
            filters.append("scale=-1:360:flags=lanczos")
            
    prefix = ",".join(filters)
    if prefix:
        prefix += ","
        
    # 3. Two-pass Palettegen + Paletteuse filter for master quality (no color banding, preserved full colors)
    dither_opt = "bayer:bayer_scale=5" if dither_val == "bayer" else "sierra2_4a" if dither_val == "sierra" else "floyd_steinberg"
    graph = f"{prefix}split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff:reserve_transparent=on[p];[s1][p]paletteuse=dither={dither_opt}:diff_mode=rectangle"
    return graph

def run_download(url, fmt, quality, custom_name, playlist_mode, start_time, end_time, fps, scale, dither):
    global app_logs
    app_logs.clear()
    check_cookies()
    app_logs.append(f"Universal Media Engine: Preparing download for {url}")
    
    time.sleep(1.0)
    
    timestamp = int(time.time())
    base_name = custom_name if custom_name else "%(title)s"
    
    # Handle GIF or Looping Video with Sound
    if fmt == 'gif' or fmt == 'loop_mp4' or fmt == 'webp':
        temp_video = os.path.join(download_dir, f"_temp_raw_{timestamp}.mp4")
        
        # 1. Download video stream with yt-dlp
        cmd = [YTDLP_EXE]
        if os.path.exists(COOKIES_STORED):
            cmd.extend(["--cookies", COOKIES_STORED])
            
        cmd.extend(["-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4"])
        if start_time and end_time:
            cmd.extend(["--download-sections", f"*{start_time}-{end_time}"])
            
        cmd.extend(["--newline", "-o", temp_video, "--no-playlist", url])
        app_logs.append(f"Downloading source stream for {fmt.upper()} conversion...")
        run_process(cmd)
        
        if not os.path.exists(temp_video):
            # Check if downloaded with another extension or title
            found_temp = None
            for f in os.listdir(download_dir):
                if f.startswith(f"_temp_raw_{timestamp}"):
                    found_temp = os.path.join(download_dir, f)
                    break
            if found_temp:
                temp_video = found_temp
            else:
                app_logs.append("CRITICAL ERROR: Source video could not be fetched for conversion.")
                return

        # 2. Convert to Target Format
        out_ext = "gif" if fmt == 'gif' else "mp4" if fmt == 'loop_mp4' else "webp"
        final_filename = f"{custom_name}.{out_ext}" if custom_name else f"Levi_Master_Clip_{timestamp}.{out_ext}"
        final_output = os.path.join(download_dir, final_filename)
        
        if fmt == 'gif':
            app_logs.append("Rendering Master-Quality GIF (Original Framerate & 2-Pass Palette Filter)...")
            filter_graph = build_gif_filter_graph(fps, scale, dither)
            conv_cmd = [FFMPEG_EXE, "-y"]
            if start_time and not ("--download-sections" in cmd):
                conv_cmd.extend(["-ss", start_time])
            if end_time and not ("--download-sections" in cmd):
                conv_cmd.extend(["-to", end_time])
            conv_cmd.extend(["-i", temp_video, "-vf", filter_graph, final_output])
            run_process(conv_cmd)
        elif fmt == 'loop_mp4':
            app_logs.append("Rendering Looping Video Clip with Audio (Original Sound & 60fps+ Fidelity)...")
            conv_cmd = [FFMPEG_EXE, "-y"]
            if start_time and not ("--download-sections" in cmd):
                conv_cmd.extend(["-ss", start_time])
            if end_time and not ("--download-sections" in cmd):
                conv_cmd.extend(["-to", end_time])
            conv_cmd.extend([
                "-i", temp_video,
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18",
                "-c:a", "aac", "-b:a", "320k",
                "-movflags", "+faststart", final_output
            ])
            run_process(conv_cmd)
        elif fmt == 'webp':
            app_logs.append("Rendering Animated 24-Bit WebP (Lossless / High-Fidelity)...")
            vf = []
            if fps and fps != "original": vf.append(f"fps={fps}")
            if scale and scale != "original":
                if scale == "1080p": vf.append("scale=-1:1080:flags=lanczos")
                elif scale == "720p": vf.append("scale=-1:720:flags=lanczos")
                elif scale == "480p": vf.append("scale=-1:480:flags=lanczos")
            vf_str = ",".join(vf) if vf else "null"
            conv_cmd = [FFMPEG_EXE, "-y", "-i", temp_video, "-vf", vf_str, "-vcodec", "libwebp", "-q:v", "90", "-loop", "0", "-an", final_output]
            run_process(conv_cmd)

        # Cleanup temp file
        try:
            if os.path.exists(temp_video):
                os.remove(temp_video)
        except:
            pass

        if os.path.exists(final_output):
            add_history_entry(os.path.basename(final_output), fmt.upper())
            app_logs.append(f"Saved: {os.path.basename(final_output)}")

    else:
        # Standard Universal Downloads: MP4, MP3, WAV, FLAC, WebM
        filename_template = f"{base_name}.%(ext)s"
        output_path = os.path.join(download_dir, filename_template)
        
        cmd = [YTDLP_EXE]
        if os.path.exists(COOKIES_STORED):
            cmd.extend(["--cookies", COOKIES_STORED])
        
        if fmt == 'wav':
            cmd.extend(["-f", "bestaudio", "--extract-audio", "--audio-format", "wav", "--audio-quality", "0"])
        elif fmt == 'flac':
            cmd.extend(["-f", "bestaudio", "--extract-audio", "--audio-format", "flac", "--audio-quality", "0", "--embed-thumbnail", "--add-metadata"])
        elif fmt == 'mp3':
            cmd.extend(["-f", "bestaudio", "--extract-audio", "--audio-format", "mp3", "--audio-quality", "0", "--embed-thumbnail", "--add-metadata"])
        elif fmt == 'webm':
            cmd.extend(["-f", "bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]/best", "--merge-output-format", "webm"])
        else: # Default MP4
            if quality == "Best" or quality == "4K":
                cmd.extend(["-f", "bestvideo+bestaudio/best"])
            elif quality == "1440p":
                cmd.extend(["-f", "bestvideo[height<=1440]+bestaudio/best[height<=1440]/best"])
            elif quality == "1080p":
                cmd.extend(["-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"])
            elif quality == "720p":
                cmd.extend(["-f", "bestvideo[height<=720]+bestaudio/best[height<=720]/best"])
            elif quality == "480p":
                cmd.extend(["-f", "bestvideo[height<=480]+bestaudio/best[height<=480]/best"])
            cmd.extend(["--merge-output-format", "mp4", "--embed-thumbnail", "--add-metadata"])
        
        if start_time and end_time:
            cmd.extend(["--download-sections", f"*{start_time}-{end_time}"])
            
        cmd.extend(["--newline", "-o", output_path])
        
        if not playlist_mode:
            cmd.insert(1, "--no-playlist")
        
        cmd.append(url)
        app_logs.append(f"Starting universal download...")
        run_process(cmd)
        
        # Track history
        valid_exts = ('.mp3', '.mp4', '.wav', '.flac', '.webm', '.gif')
        for l in app_logs:
            fname = None
            if "[download] Destination:" in l:
                fname = l.split("Destination: ")[-1].strip()
            elif "has already been downloaded" in l:
                fname = l.replace("[download] ", "").split(" has already")[0].strip()
            elif "[Merger] Merging formats into" in l:
                try: fname = l.split('"')[1].strip()
                except: pass
            elif "[ExtractAudio] Destination:" in l:
                fname = l.split("Destination: ")[-1].strip()
                
            if fname:
                fname = fname.split("\\")[-1].split("/")[-1]
                if not re.search(r'\.f\d+\.[a-zA-Z0-9]+$', fname.lower()) and fname.lower().endswith(valid_exts):
                    add_history_entry(fname, fmt.upper())
                    break

    app_logs.append("Process Finished Successfully!")

def run_local_convert(input_file, target_format, custom_name, start_time, end_time, fps, scale, dither):
    global app_logs
    app_logs.clear()
    app_logs.append(f"Local Studio: Converting '{os.path.basename(input_file)}' to {target_format.upper()}...")
    
    timestamp = int(time.time())
    raw_base = custom_name if custom_name else os.path.splitext(os.path.basename(input_file))[0]
    out_ext = "gif" if target_format == 'gif' else "mp4" if target_format == 'loop_mp4' else target_format
    output_filename = f"{raw_base}_{timestamp}.{out_ext}" if not custom_name else f"{custom_name}.{out_ext}"
    output_path = os.path.join(download_dir, output_filename)
    
    cmd = [FFMPEG_EXE, "-y"]
    if start_time:
        cmd.extend(["-ss", start_time])
    if end_time:
        cmd.extend(["-to", end_time])
        
    cmd.extend(["-i", input_file])
    
    if target_format == 'gif':
        graph = build_gif_filter_graph(fps, scale, dither)
        cmd.extend(["-vf", graph, output_path])
    elif target_format == 'loop_mp4':
        cmd.extend([
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18",
            "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", output_path
        ])
    elif target_format == 'webp':
        vf = []
        if fps and fps != "original": vf.append(f"fps={fps}")
        if scale and scale != "original":
            if scale == "1080p": vf.append("scale=-1:1080:flags=lanczos")
            elif scale == "720p": vf.append("scale=-1:720:flags=lanczos")
            elif scale == "480p": vf.append("scale=-1:480:flags=lanczos")
        vf_str = ",".join(vf) if vf else "null"
        cmd.extend(["-vf", vf_str, "-vcodec", "libwebp", "-q:v", "90", "-loop", "0", "-an", output_path])
    elif target_format in ('mp3', 'wav', 'flac'):
        if target_format == 'mp3':
            cmd.extend(["-vn", "-c:a", "libmp3lame", "-b:a", "320k", output_path])
        elif target_format == 'wav':
            cmd.extend(["-vn", "-c:a", "pcm_s16le", output_path])
        elif target_format == 'flac':
            cmd.extend(["-vn", "-c:a", "flac", output_path])
            
    app_logs.append("Executing FFmpeg conversion...")
    run_process(cmd)
    
    if os.path.exists(output_path):
        add_history_entry(os.path.basename(output_path), target_format.upper())
        app_logs.append(f"Master file saved: {output_path}")
        
    app_logs.append("Process Finished Successfully!")

# --- STARTUP ---
def start_flask():
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    app.run(host='127.0.0.1', port=54321, threaded=True)

if __name__ == '__main__':
    initialize_assets()
    threading.Thread(target=check_all_updates_worker, daemon=True).start()
    threading.Thread(target=start_flask, daemon=True).start()
    
    window = webview.create_window(
        "Levi's Media Engine Pro - Universal Downloader & GIF Studio", 
        "http://127.0.0.1:54321",
        width=1240, 
        height=980,
        min_size=(1160, 940),
        frameless=True,
        easy_drag=True,
        background_color='#1a1a24'
    )
    webview.start()