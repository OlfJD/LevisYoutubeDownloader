import os
import sys
import json
import shutil
import threading
import subprocess
import time
import re
import urllib.request
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
COOKIES_STORED = os.path.join(TOOLS_DIR, "cookies.txt")
SETTINGS_FILE = os.path.join(TOOLS_DIR, "settings.json")
HISTORY_FILE = os.path.join(TOOLS_DIR, "history.json")

USER_DOWNLOADS = os.path.join(os.path.expanduser("~"), "Downloads")
COOKIES_NEW = os.path.join(USER_DOWNLOADS, "youtube.com_cookies.txt")

# Hardcoded Local Version for GitHub Checks
CURRENT_VERSION = "v1.0.2"

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
        return r_parts > l_parts
    except Exception:
        return str(remote_ver).strip() != str(local_ver).strip()

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

    # 2. Check Levi's YouTube Downloader GitHub release
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
                    reasons.append(f"Levi's YouTube Downloader ({CURRENT_VERSION} -> {app_latest})")
    except Exception as e:
        app_logs.append(f"LeviDownloader update check skipped/failed: {e}")

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


# Global Variables
app_logs = []
download_dir = USER_DOWNLOADS
window = None
current_process = None

def initialize_assets():
    if not os.path.exists(TOOLS_DIR):
        os.makedirs(TOOLS_DIR)
    
    executables = ["yt-dlp.exe", "ffmpeg.exe", "ffprobe.exe"]
    
    for exe_name in executables:
        target_exe = os.path.join(TOOLS_DIR, exe_name)
        if not os.path.exists(target_exe):
            if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
                embedded_exe = os.path.join(sys._MEIPASS, "tools", exe_name)
                if os.path.exists(embedded_exe):
                    try:
                        shutil.copy(embedded_exe, target_exe)
                        app_logs.append(f"Engine asset {exe_name} initialized.")
                    except Exception as e:
                        app_logs.append(f"Failed to copy {exe_name}: {e}")

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
            json.dump(history_list[:10], f) # Always cap at last 10 entries
    except Exception as e:
        app_logs.append(f"History save error: {e}")

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
    if request.method == 'GET':
        try:
            with open(SETTINGS_FILE, 'r') as f:
                return jsonify(json.load(f))
        except:
            return jsonify({})
    else:
        new_data = request.json
        try:
            with open(SETTINGS_FILE, 'r') as f:
                data = json.load(f)
        except:
            data = {}
        data.update(new_data)
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
    result = window.create_file_dialog(webview.FOLDER_DIALOG)
    if result and len(result) > 0:
        download_dir = result[0]
        return jsonify({"success": True, "folder": download_dir})
    return jsonify({"success": False})

@app.route('/api/stop', methods=['POST'])
def api_stop():
    global current_process
    if current_process:
        current_process.terminate()
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
        app_logs.append("=== PART 2: Checking LeviDownloader Updates ===")
        app_logs.append(f"Current UI version: {CURRENT_VERSION}")
        
        # Pointing to OlfJD's active repository
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
            
        # Refresh cached update status immediately
        check_all_updates_worker()
        
        app_logs.append(" ")
        app_logs.append("Process Finished Successfully!")
    
    threading.Thread(target=run_update).start()
    return jsonify({"success": True})

@app.route('/api/download', methods=['POST'])
def api_download():
    data = request.json
    url = data.get('url')
    fmt = data.get('format', 'mp4') 
    quality = data.get('quality', 'Best')
    custom_name = data.get('customName', '').strip()
    playlist_mode = data.get('playlistMode', False)
    
    if not url:
        return jsonify({"success": False, "error": "No URL provided"})
    
    threading.Thread(target=run_download, args=(url, fmt, quality, custom_name, playlist_mode)).start()
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
            app_logs.append(line.strip())
            if len(app_logs) > 200:
                app_logs.pop(0)

        current_process.wait()
    except Exception as e:
        app_logs.append(f"CRITICAL ERROR: {str(e)}")
    finally:
        current_process = None

def run_download(url, fmt, quality, custom_name, playlist_mode):
    global app_logs
    app_logs.clear()
    check_cookies()
    app_logs.append(f"Preparing download for: {url}")
    
    # 1.5 second delay to let UI catch up
    time.sleep(1.5) 
    
    filename_template = f"{custom_name}.%(ext)s" if custom_name else "%(title)s.%(ext)s"
    output_path = os.path.join(download_dir, filename_template)
    
    cmd = [YTDLP_EXE]
    if os.path.exists(COOKIES_STORED):
        cmd.extend(["--cookies", COOKIES_STORED])
    
    if fmt == 'wav':
        cmd.extend(["-f", "bestaudio", "--extract-audio", "--audio-format", "wav", "--audio-quality", "0"])
    elif fmt == 'mp3':
        cmd.extend(["-f", "bestaudio", "--extract-audio", "--audio-format", "mp3", "--audio-quality", "0"])
        cmd.extend(["--embed-thumbnail", "--add-metadata"])
    else: 
        if quality == "Best":
            cmd.extend(["-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"])
        elif quality == "1080p":
            cmd.extend(["-f", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best"])
        elif quality == "720p":
            cmd.extend(["-f", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best"])
        elif quality == "480p":
            cmd.extend(["-f", "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best"])
        cmd.extend(["--merge-output-format", "mp4", "--embed-thumbnail", "--add-metadata"])
    
    cmd.extend(["--newline", "-o", output_path])
    
    if not playlist_mode:
        cmd.insert(1, "--no-playlist")
    
    cmd.append(url)
    
    app_logs.append(f"Engine command built. Starting engine...")
    run_process(cmd)
    
    # Advanced History Filter: Ignore intermediate formats (.webm, .m4a, and .fXXX temporary formats)
    new_history = []
    valid_exts = ('.mp3', '.mp4', '.wav')
    
    for l in app_logs:
        fname = None
        if "[download] Destination:" in l:
            fname = l.split("Destination: ")[-1].strip()
        elif "has already been downloaded" in l:
            fname = l.replace("[download] ", "").split(" has already")[0].strip()
        elif "[Merger] Merging formats into" in l:
            try:
                fname = l.split('"')[1].strip()
            except:
                pass
        elif "[ExtractAudio] Destination:" in l:
            fname = l.split("Destination: ")[-1].strip()
            
        if fname:
            fname = fname.split("\\")[-1].split("/")[-1] # Clean slashes
            # Ignore intermediate chunk formats (e.g. format tags like .f399.mp4, .f140.m4a)
            if re.search(r'\.f\d+\.[a-zA-Z0-9]+$', fname.lower()):
                continue
                
            if fname.lower().endswith(valid_exts) and fname not in new_history:
                new_history.append(fname)
            
    if new_history:
        try:
            date_str = datetime.now().strftime("%d.%m.%Y")
            current_hist = load_history()
            for f in new_history:
                if not any(item['filename'] == f for item in current_hist):
                    current_hist.insert(0, {"date": date_str, "filename": f})
            save_history(current_hist)
        except:
            pass

    app_logs.append("Process Finished Successfully!")

# --- STARTUP ---
def start_flask():
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    app.run(host='127.0.0.1', port=54321, threaded=True)

if __name__ == '__main__':
    initialize_assets()  # Extract tools automatically
    threading.Thread(target=check_all_updates_worker, daemon=True).start()
    threading.Thread(target=start_flask, daemon=True).start()
    
    window = webview.create_window(
        "Levi's YouTube Downloader", 
        "http://127.0.0.1:54321",
        width=1160, 
        height=960,
        min_size=(1160, 960),
        frameless=True,
        easy_drag=True,
        background_color='#212128'
    )
    webview.start()