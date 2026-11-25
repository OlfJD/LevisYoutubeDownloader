import os
import sys
import json
import shutil
import threading
import subprocess
import time
import re
import urllib.request
import hashlib
import ctypes
import functools
import traceback
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
ARIA2C_EXE = os.path.join(TOOLS_DIR, "aria2c.exe")
COOKIES_STORED = os.path.join(TOOLS_DIR, "cookies.txt")
SETTINGS_FILE = os.path.join(TOOLS_DIR, "settings.json")
HISTORY_FILE = os.path.join(TOOLS_DIR, "history.json")

USER_DOWNLOADS = os.path.join(os.path.expanduser("~"), "Downloads")
COOKIES_NEW = os.path.join(USER_DOWNLOADS, "youtube.com_cookies.txt")

# Hardcoded Local Version for GitHub Checks
CURRENT_VERSION = "v1.0.5"

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


def kill_process_tree(proc):
    """terminate() on Windows only kills yt-dlp itself; its ffmpeg/aria2c children would keep running."""
    try:
        if os.name == 'nt':
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                           capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=10)
        else:
            proc.terminate()
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


# --- JOB RUN NUMBERS ---
# Every download / update gets a run number. Stop and every new job bump it, and a job only acts while
# its number is still current: a stopped download that finishes late can no longer start the aria2c
# fallback (which used to restart the download after Stop) or touch the job that replaced it.
_job_lock = threading.Lock()
job_run = 0


def next_job_run():
    global job_run
    with _job_lock:
        job_run += 1
        return job_run


def job_current(run):
    return run is None or run == job_run


def background_job(name):
    """Runs fn(run, ...) under a fresh run number. A crash goes to errors.log and to the UI as CRITICAL ERROR,
    so a broken job can never leave the UI saying "downloading". The wrapper returns the run number."""
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            run = next_job_run()
            app_logs.clear()
            try:
                fn(run, *args, **kwargs)
            except Exception as e:
                log_error(f"{name} crashed: {e!r}\n{traceback.format_exc()}")
                if job_current(run):
                    app_logs.append(f"CRITICAL ERROR: {name} stopped unexpectedly ({e}). Details are in errors.log.")
            return run
        return wrapper
    return deco


# --- SAVING: temp file + swap, retries for briefly locked files, never defaults over unreadable data ---
class UnreadableFile(Exception):
    """The file exists but stayed locked: callers must not write defaults over it."""


def retry_locked(op, attempts=5, delay=0.1):
    """Virus scanners, OneDrive and backup tools lock files for a moment; retry before giving up."""
    for i in range(attempts):
        try:
            return op()
        except PermissionError:
            if i == attempts - 1:
                raise
            time.sleep(delay * (i + 1))


def write_json_atomic(path, data):
    """Write to a temp file and swap it in, so a crash mid-write can't leave a truncated JSON file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        retry_locked(lambda: os.replace(tmp, path))
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def read_json(path, expected_type, default):
    """Missing -> default. Corrupt -> moved aside to *.corrupt (logged) and default. Still locked after
    retries -> UnreadableFile, so a default is never mistaken for the user's data and saved over it."""
    if not os.path.exists(path):
        return default

    def _read():
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    try:
        text = retry_locked(_read)
    except OSError as e:
        raise UnreadableFile(f"{os.path.basename(path)} could not be read: {e}")
    try:
        data = json.loads(text)
        if not isinstance(data, expected_type):
            raise ValueError(f"expected {expected_type.__name__}")
        return data
    except ValueError as e:
        try:
            os.replace(path, path + ".corrupt")
        except OSError:
            pass
        log_error(f"{os.path.basename(path)} was damaged ({e}); kept as {os.path.basename(path)}.corrupt and started fresh")
        return default


# --- ERROR LOG: things the user would otherwise never see (failed saves, crashed background jobs) ---
ERRORS_LOG = os.path.join(APPDATA_DIR, "errors.log")
ERRORS_LOG_MAX = 64 * 1024
_errors_lock = threading.Lock()


def log_error(message):
    """Appends to a small errors.log; past 64 KB the older half is dropped. Never raises."""
    try:
        os.makedirs(APPDATA_DIR, exist_ok=True)
        with _errors_lock:
            if os.path.exists(ERRORS_LOG) and os.path.getsize(ERRORS_LOG) > ERRORS_LOG_MAX:
                with open(ERRORS_LOG, 'rb') as f:
                    data = f.read()
                keep = data[len(data) // 2:]
                keep = keep[keep.find(b"\n") + 1:]
                with open(ERRORS_LOG, 'wb') as f:
                    f.write(keep)
            with open(ERRORS_LOG, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S}  {message}\n")
    except Exception:
        pass


# --- LIMITS IN ONE PLACE: settings and download requests are checked against these ---
QUALITIES = {"Best", "1080p", "720p", "480p"}
FORMATS = {"mp4", "mp3", "wav"}
NAME_MAX = 180
_INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*%\x00-\x1f]')


def sanitize_settings(data):
    """Unknown keys and out-of-range values are dropped, so a hand-edited or old settings.json can't break
    the app: the UI then uses its own default for that key."""
    clean = {}
    if not isinstance(data, dict):
        return clean
    if data.get("quality") in QUALITIES:
        clean["quality"] = data["quality"]
    if isinstance(data.get("playlistMode"), bool):
        clean["playlistMode"] = data["playlistMode"]
    return clean


def sanitize_filename(name):
    """Custom names go straight into Windows paths and yt-dlp templates: strip characters that are
    illegal on Windows (or '%', which yt-dlp would treat as a template field)."""
    return _INVALID_FILENAME_CHARS.sub('', name or '').strip().rstrip('. ')


class JobOptionError(ValueError):
    pass


def job_options(data):
    """Checks a download request and returns run_download's arguments; refuses with a one-line reason."""
    url = str(data.get('url') or '').strip()
    if not url:
        raise JobOptionError("No URL provided")
    if url.startswith('-'):
        raise JobOptionError("Invalid URL")  # yt-dlp would read it as an option (e.g. --exec)
    fmt = data.get('format', 'mp4')
    if fmt not in FORMATS:
        raise JobOptionError(f"Format must be one of: {', '.join(sorted(FORMATS))}")
    quality = data.get('quality', 'Best')
    if quality not in QUALITIES:
        raise JobOptionError(f"Quality must be one of: {', '.join(sorted(QUALITIES))}")
    playlist_mode = data.get('playlistMode', False)
    if not isinstance(playlist_mode, bool):
        raise JobOptionError("Playlist mode must be on or off")
    custom_name = str(data.get('customName') or '')
    if len(custom_name) > NAME_MAX:
        raise JobOptionError(f"File name can be at most {NAME_MAX} characters")
    return {"url": url, "fmt": fmt, "quality": quality, "custom_name": sanitize_filename(custom_name),
            "playlist_mode": playlist_mode}


_settings_lock = threading.Lock()
_pending_settings = {}  # changes that could not be saved yet (file locked); retried on the next save


def load_settings(strict=False):
    """strict=True raises UnreadableFile instead of pretending the file is empty."""
    try:
        data = sanitize_settings(read_json(SETTINGS_FILE, dict, {}))
    except UnreadableFile:
        if strict:
            raise
        data = {}
    data.update(_pending_settings)
    return data


def update_settings(changes):
    """Read-modify-write under a lock so two requests can't drop each other's keys. If the file stays
    locked, the change is kept in memory (and logged) and goes out with the next save that works."""
    with _settings_lock:
        _pending_settings.update(sanitize_settings(changes))
        try:
            data = load_settings(strict=True)
            write_json_atomic(SETTINGS_FILE, data)
            _pending_settings.clear()
            return True
        except (UnreadableFile, OSError) as e:
            log_error(f"Settings not saved yet, kept in memory: {e}")
            return False

def initialize_assets():
    if not os.path.exists(TOOLS_DIR):
        os.makedirs(TOOLS_DIR)
    
    executables = ["yt-dlp.exe", "ffmpeg.exe", "ffprobe.exe", "aria2c.exe"]
    
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

def check_cookies():
    if os.path.exists(COOKIES_NEW):
        try:
            if not os.path.exists(TOOLS_DIR): os.makedirs(TOOLS_DIR)
            shutil.move(COOKIES_NEW, COOKIES_STORED)
            app_logs.append("Cookies moved to safe storage!")
        except Exception as e:
            app_logs.append(f"Cookie Error: {e}")

# --- HISTORY DATABASE FUNCTIONS ---
HISTORY_MAX = 10  # Always cap at last 10 entries
_history_lock = threading.Lock()


def load_history(strict=False):
    try:
        items = read_json(HISTORY_FILE, list, [])
    except UnreadableFile:
        if strict:
            raise
        return []
    return [h for h in items if isinstance(h, dict) and isinstance(h.get("filename"), str)][:HISTORY_MAX]


def add_history_entries(filenames):
    """strict read: an unreadable history must not be replaced by a list holding only the new entries."""
    try:
        date_str = datetime.now().strftime("%d.%m.%Y")
        with _history_lock:
            current_hist = load_history(strict=True)
            for f in filenames:
                if not any(item['filename'] == f for item in current_hist):
                    current_hist.insert(0, {"date": date_str, "filename": f})
            write_json_atomic(HISTORY_FILE, current_hist[:HISTORY_MAX])
    except Exception as e:
        app_logs.append(f"History not updated: {e}")
        log_error(f"History not updated for {', '.join(filenames)}: {e}")

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
        return jsonify(load_settings())
    else:
        saved = update_settings(request.get_json(silent=True) or {})
        # saved=False: kept in memory and retried on the next change (see errors.log)
        return jsonify({"success": True, "saved": saved})

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
    # New run number first, so the stopped download doesn't restart through the aria2c fallback
    next_job_run()
    proc = current_process
    if proc:
        kill_process_tree(proc)
        # Deliberately no "Process Finished Successfully!": a cancelled job is not a finished download
        app_logs.append("Process stopped by user.")
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
    @background_job("Update")
    def run_update(run):
        app_logs.append("=== PART 1: Updating Core Engine (yt-dlp) ===")
        app_logs.append("Fetching latest release from yt-dlp GitHub...")
        # yt-dlp -U checks the new build against the release's SHA2-256SUMS itself
        run_process([YTDLP_EXE, "-U"], run=run)
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
    
    threading.Thread(target=run_update, daemon=True).start()
    return jsonify({"success": True})

@app.route('/api/download', methods=['POST'])
def api_download():
    try:
        opts = job_options(request.get_json(silent=True) or {})
    except JobOptionError as e:
        return jsonify({"success": False, "error": str(e)})

    threading.Thread(target=run_download, kwargs=opts, daemon=True).start()
    return jsonify({"success": True})

# --- CORE PROCESS RUNNER ---
def run_process(cmd_list, run=None):
    """With a run number, nothing starts once that run was stopped or replaced."""
    global app_logs, current_process
    my_env = os.environ.copy()
    my_env["PATH"] += os.pathsep + TOOLS_DIR

    startupinfo = None
    if os.name == 'nt':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

    ret_code = 1
    if not job_current(run):
        return ret_code
    proc = None
    try:
        proc = subprocess.Popen(
            cmd_list,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            startupinfo=startupinfo,
            env=my_env,
            universal_newlines=True,
            encoding='utf-8',
            errors='ignore'
        )
        current_process = proc
        if not job_current(run):
            kill_process_tree(proc)  # Stop arrived while it was starting

        for line in proc.stdout:
            app_logs.append(line.strip())
            if len(app_logs) > 200:
                app_logs.pop(0)

        proc.wait()
        ret_code = proc.returncode
    except Exception as e:
        app_logs.append(f"CRITICAL ERROR: {str(e)}")
    finally:
        # only clear our own process: a newer job may already have registered its own
        if current_process is proc:
            current_process = None
    return ret_code

@background_job("Download")
def run_download(run, url, fmt, quality, custom_name, playlist_mode):
    check_cookies()
    app_logs.append(f"Preparing download for: {url}")
    
    # 1.5 second delay to let UI catch up
    time.sleep(1.5) 
    
    filename_template = f"{custom_name}.%(ext)s" if custom_name else "%(title)s.%(ext)s"
    output_path = os.path.join(download_dir, filename_template)
    
    cmd = [YTDLP_EXE]
    
    # Turbo Acceleration with aria2c
    used_aria = False
    if os.path.exists(ARIA2C_EXE):
        cmd.extend(["--downloader", ARIA2C_EXE, "--downloader-args", "aria2c:-x 16 -s 16 -k 1M -j 16"])
        used_aria = True
        app_logs.append("⚡ Turbo Acceleration Active: 16x Multi-Thread Engine enabled.")
        
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
    ret = run_process(cmd, run=run)
    if not job_current(run):
        return  # stopped by the user

    # Automatic Fallback if aria2c was throttled by host
    if ret != 0 and used_aria:
        app_logs.append("Turbo engine encountered host limit. Automatically retrying with native downloader...")
        cmd_fallback = [c for c in cmd if c not in ("--downloader", ARIA2C_EXE, "--downloader-args", "aria2c:-x 16 -s 16 -k 1M -j 16")]
        ret = run_process(cmd_fallback, run=run)
        if not job_current(run):
            return

    # Say why it stopped instead of reporting a failed download as finished
    if ret != 0:
        recent = "\n".join(app_logs[-30:]).lower()
        if "sign in to confirm" in recent or "members-only" in recent or "must be logged" in recent:
            app_logs.append("CRITICAL ERROR: This video needs a signed-in account. Save your YouTube cookies as youtube.com_cookies.txt in your Downloads folder and try again.")
        elif "unsupported url" in recent:
            app_logs.append("CRITICAL ERROR: This link isn't supported.")
        else:
            app_logs.append("CRITICAL ERROR: The download failed. The log says why; updating the tool often helps.")
        return

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
        add_history_entries(new_history)

    app_logs.append("Process Finished Successfully!")

# --- SINGLE INSTANCE ---
# Two copies on the same data folder would overwrite each other's settings and history, and the second
# can't get port 54321 anyway. A named mutex is an atomic claim (two copies starting at the same moment
# can't both win, unlike looking for another process by name). "Local\" keeps it to this sign-in session,
# and the name comes from the data folder, so a test copy with its own %APPDATA% can run next to it.
ERROR_ALREADY_EXISTS = 183
EVENT_MODIFY_STATE = 0x0002
_instance_handles = []


def _instance_names(data_dir):
    tag = hashlib.sha1(os.path.normcase(os.path.abspath(data_dir)).encode('utf-8')).hexdigest()[:12]
    return f"Local\\LevisDownloader-{tag}", f"Local\\LevisDownloader-{tag}-show"


def _kernel32():
    from ctypes import wintypes
    k32 = ctypes.WinDLL('kernel32', use_last_error=True)
    k32.CreateMutexW.restype = wintypes.HANDLE
    k32.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
    k32.CreateEventW.restype = wintypes.HANDLE
    k32.CreateEventW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.BOOL, wintypes.LPCWSTR]
    k32.OpenEventW.restype = wintypes.HANDLE
    k32.OpenEventW.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR]
    k32.SetEvent.argtypes = [wintypes.HANDLE]
    k32.CloseHandle.argtypes = [wintypes.HANDLE]
    k32.WaitForSingleObject.restype = wintypes.DWORD
    k32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    return k32


def claim_single_instance(data_dir=APPDATA_DIR):
    """True if this is the only copy for this data folder. Otherwise the running copy is asked to bring
    its window forward, and False is returned so this copy can quit."""
    if os.name != 'nt':
        return True
    k32 = _kernel32()
    mutex_name, show_name = _instance_names(data_dir)
    handle = k32.CreateMutexW(None, False, mutex_name)
    already_running = ctypes.get_last_error() == ERROR_ALREADY_EXISTS
    if not handle:
        return True  # can't tell; better to start than to refuse
    if already_running:
        show = k32.OpenEventW(EVENT_MODIFY_STATE, False, show_name)
        if show:
            k32.SetEvent(show)
            k32.CloseHandle(show)
        k32.CloseHandle(handle)
        return False
    _instance_handles.append(handle)  # held until the process exits
    show = k32.CreateEventW(None, False, False, show_name)  # auto-reset
    if show:
        _instance_handles.append(show)
        threading.Thread(target=_wait_for_show_requests, args=(k32, show), daemon=True).start()
    return True


def _wait_for_show_requests(k32, show_event):
    while True:
        if k32.WaitForSingleObject(show_event, 0xFFFFFFFF) != 0:
            return
        if window is None:
            continue
        for step in (window.restore, window.show):
            try:
                step()
            except Exception:
                pass
        try:  # a quick on-top toggle brings it in front of other apps without keeping it there
            window.on_top = True
            window.on_top = False
        except Exception:
            pass


def stop_running_jobs():
    """Window closed: don't leave yt-dlp / ffmpeg running invisibly in the background."""
    next_job_run()
    if current_process:
        kill_process_tree(current_process)


# --- STARTUP ---
def start_flask():
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    app.run(host='127.0.0.1', port=54321, threaded=True)

if __name__ == '__main__':
    if not claim_single_instance():
        sys.exit(0)  # the running copy was asked to show its window
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
    stop_running_jobs()