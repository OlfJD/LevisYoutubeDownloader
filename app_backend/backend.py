import os
import sys
import json
import shutil
import threading
import subprocess
import time
import re
import urllib.request
import urllib.parse
import zipfile
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, abort
import ipaddress
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

# Live Stream DVR State
live_recording_state = {
    "is_recording": False,
    "url": "",
    "title": "",
    "filename": "",
    "output_path": "",
    "start_time": 0,
    "duration_sec": 0,
    "bytes_downloaded": 0,
    "quality": "Best",
    "live_from_start": True
}
live_process = None

# Batch Queue State
download_queue = []
queue_worker_active = False

# Set by /api/stop; cleared when a new job starts. run_process won't start a process while it is set.
cancel_event = threading.Event()


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
                    reasons.append(f"Levi's Downloader ({CURRENT_VERSION} -> {app_latest})")
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
    
    executables = ["yt-dlp.exe", "ffmpeg.exe", "ffprobe.exe", "aria2c.exe"]
    
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
            urllib.request.urlretrieve("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe", target_ytdlp + ".part")
            os.replace(target_ytdlp + ".part", target_ytdlp)
            app_logs.append("yt-dlp engine downloaded successfully.")
        except Exception as e:
            app_logs.append(f"Error downloading yt-dlp: {e}")

    target_ffmpeg = os.path.join(TOOLS_DIR, "ffmpeg.exe")
    if not os.path.exists(target_ffmpeg):
        try:
            app_logs.append("Fetching FFmpeg & FFprobe engine binaries...")
            url = "https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            # Stream the ~150 MB archive to disk instead of holding it in memory
            zip_path = os.path.join(TOOLS_DIR, "_ffmpeg_download.zip")
            try:
                with urllib.request.urlopen(req, timeout=60) as resp, open(zip_path, 'wb') as out:
                    shutil.copyfileobj(resp, out, 1024 * 1024)
                with zipfile.ZipFile(zip_path) as z:
                    for name in z.namelist():
                        base = os.path.basename(name)
                        if base in ('ffmpeg.exe', 'ffprobe.exe'):
                            # write under a temp name: a half-written ffmpeg.exe would skip this download next start
                            part = os.path.join(TOOLS_DIR, base + ".part")
                            with z.open(name) as src, open(part, 'wb') as dst:
                                shutil.copyfileobj(src, dst, 1024 * 1024)
                            os.replace(part, os.path.join(TOOLS_DIR, base))
            finally:
                if os.path.exists(zip_path):
                    os.remove(zip_path)
            app_logs.append("FFmpeg engine installed successfully.")
        except Exception as e:
            app_logs.append(f"Error downloading FFmpeg: {e}")

BROWSER_LABELS = {"chrome": "Chrome", "edge": "Edge", "brave": "Brave", "firefox": "Firefox",
                  "vivaldi": "Vivaldi", "opera": "Opera", "operagx": "Opera GX"}
YT_LOGIN_COOKIES = {"SID", "__Secure-1PSID", "__Secure-3PSID", "LOGIN_INFO", "SAPISID"}


def cookie_rows(content):
    """Netscape cookies.txt rows as column lists (HttpOnly rows are prefixed with #HttpOnly_)."""
    rows = []
    for line in content.splitlines():
        line = line[len("#HttpOnly_"):] if line.startswith("#HttpOnly_") else line
        if not line.strip() or line.startswith("#"):
            continue
        cols = line.split("\t")
        if len(cols) >= 7:
            rows.append(cols)
    return rows


def is_youtube_domain(domain):
    """youtube.com and its subdomains only. google.com (the account itself) is deliberately excluded."""
    d = domain[len("#HttpOnly_"):] if domain.startswith("#HttpOnly_") else domain
    return re.search(r'(^|\.)youtube\.com$', d, re.I) is not None


def has_youtube_login(content):
    return any(is_youtube_domain(c[0]) and c[5] in YT_LOGIN_COOKIES for c in cookie_rows(content))


def merge_youtube_cookies(browser_dump):
    """Keeps only youtube.com rows from a full browser dump and merges them into the stored file:
    its old YouTube rows are replaced, anything else already in it (e.g. the Twitch token) is kept."""
    def yt_row(line):
        cols = line.split("\t")
        return len(cols) >= 7 and is_youtube_domain(cols[0])

    yt = [l for l in browser_dump.splitlines() if yt_row(l)]
    kept = []
    if os.path.exists(COOKIES_STORED):
        with open(COOKIES_STORED, 'r', encoding='utf-8', errors='ignore') as f:
            kept = [l for l in f.read().splitlines()
                    if l.strip() and not l.startswith("# ") and l != "# Netscape HTTP Cookie File" and not yt_row(l)]
    return yt, "\n".join(["# Netscape HTTP Cookie File"] + kept + yt) + "\n"


def browser_spec(key):
    """yt-dlp --cookies-from-browser value. yt-dlp only knows "Opera Stable", so Opera GX gets an explicit profile path."""
    if key not in BROWSER_LABELS:
        return None
    opera_dir = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "Opera Software")
    # "Opera" picked but only Opera GX installed: use GX instead of failing
    if key == "opera" and not os.path.isdir(os.path.join(opera_dir, "Opera Stable")) \
            and os.path.isdir(os.path.join(opera_dir, "Opera GX Stable")):
        key = "operagx"
    if key != "operagx":
        return key
    # yt-dlp's "opera" mode doesn't support profiles and only knows "Opera Stable". GX is Chromium, so use
    # chrome mode with the profile path: it reads <profile>/Network/Cookies and the key from the parent's Local State.
    return "chrome:" + os.path.join(opera_dir, "Opera GX Stable", "Default")


def cookie_args(browser_cookies):
    """Stored cookies.txt wins (it is what Sync writes); live browser extraction is the fallback."""
    if os.path.exists(COOKIES_STORED) and os.path.getsize(COOKIES_STORED) > 0:
        return ["--cookies", COOKIES_STORED]
    spec = browser_spec(browser_cookies) if browser_cookies and browser_cookies != "none" else None
    return ["--cookies-from-browser", spec] if spec else []


_js_runtime = []
_js_runtime_checked = False


def js_runtime_args():
    """YouTube needs a JS runtime for signature challenges; yt-dlp only auto-enables deno."""
    global _js_runtime, _js_runtime_checked
    if not _js_runtime_checked:
        _js_runtime_checked = True
        node = shutil.which("node")
        if node and not shutil.which("deno"):
            _js_runtime = ["--js-runtimes", f"node:{node}"]
    return list(_js_runtime)


def parse_cookies_file_info(cookie_path=COOKIES_STORED):
    """Inspects cookie file and returns detailed metadata about stored tokens/domains."""
    info = {
        "hasCookies": False,
        "fileSize": 0,
        "lineCount": 0,
        "hasTwitch": False,
        "hasYouTube": False,
        "hasKick": False,
        "summary": "No stored cookies"
    }
    if os.path.exists(cookie_path):
        try:
            sz = os.path.getsize(cookie_path)
            if sz > 0:
                info["hasCookies"] = True
                info["fileSize"] = sz
                with open(cookie_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    lines = [l for l in content.splitlines() if l.strip() and not l.strip().startswith('#')]
                    info["lineCount"] = len(lines)
                    if 'twitch.tv' in content or 'auth-token' in content:
                        info["hasTwitch"] = True
                    # Only a signed-in session counts: logged-out exports still contain visitor youtube.com cookies
                    info["hasYouTube"] = has_youtube_login(content)
                    info["youTubeGuestOnly"] = not info["hasYouTube"] and 'youtube.com' in content
                    if 'kick.com' in content:
                        info["hasKick"] = True
                    
                    found_domains = []
                    if info["hasTwitch"]: found_domains.append("Twitch")
                    if info["hasYouTube"]: found_domains.append("YouTube")
                    if info["hasKick"]: found_domains.append("Kick")
                    
                    kb_str = f"{round(sz / 1024, 1)} KB" if sz >= 1024 else f"{sz} B"
                    if found_domains:
                        info["summary"] = f"Active ({', '.join(found_domains)}) · {kb_str}"
                    else:
                        info["summary"] = f"Active ({info['lineCount']} cookies) · {kb_str}"
        except Exception as e:
            info["summary"] = f"Error reading cookies: {e}"
    return info

def write_json_atomic(path, data):
    """Write to a temp file and swap it in, so a crash mid-write can't leave a truncated JSON file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f)
    os.replace(tmp, path)


_settings_lock = threading.Lock()


def load_settings():
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def update_settings(changes):
    """Read-modify-write under a lock so two requests can't drop each other's keys."""
    with _settings_lock:
        data = load_settings()
        data.update(changes)
        write_json_atomic(SETTINGS_FILE, data)
        return data


def get_cookie_status_dict():
    info = parse_cookies_file_info(COOKIES_STORED)
    settings = load_settings()
    info["twitchToken"] = settings.get("twitchToken", "")
    info["browserCookies"] = settings.get("browserCookies", "none")
    return info

def update_twitch_auth_cookie(token_str):
    """Writes or updates Twitch auth-token in Netscape cookies.txt format."""
    if not os.path.exists(TOOLS_DIR):
        os.makedirs(TOOLS_DIR)
    
    clean_token = token_str.strip()
    if clean_token.lower().startswith('auth-token='):
        clean_token = clean_token.split('=', 1)[1].strip()
    elif clean_token.lower().startswith('oauth:'):
        clean_token = clean_token.split(':', 1)[1].strip()

    existing_lines = []
    if os.path.exists(COOKIES_STORED):
        try:
            with open(COOKIES_STORED, 'r', encoding='utf-8', errors='ignore') as f:
                existing_lines = f.readlines()
        except:
            existing_lines = []

    # Filter out existing twitch auth-token lines
    filtered_lines = []
    has_header = False
    for line in existing_lines:
        if '# Netscape HTTP Cookie File' in line:
            has_header = True
            filtered_lines.append(line)
        elif 'twitch.tv' in line and 'auth-token' in line:
            continue
        else:
            filtered_lines.append(line)

    if not has_header:
        filtered_lines.insert(0, "# Netscape HTTP Cookie File\n# Generated by Levi's Downloader\n")

    if clean_token:
        # Add twitch auth-token line
        filtered_lines.append(f".twitch.tv\tTRUE\t/\tTRUE\t2147483647\tauth-token\t{clean_token}\n")

    with open(COOKIES_STORED, 'w', encoding='utf-8') as f:
        f.writelines(filtered_lines)

def check_cookies():
    """Smart scan of user's Downloads folder for any exported cookie files."""
    if not os.path.exists(TOOLS_DIR):
        os.makedirs(TOOLS_DIR)

    # Check for known cookie files in Downloads
    candidate_names = [
        "youtube.com_cookies.txt", "twitch.tv_cookies.txt", "twitch_cookies.txt",
        "cookies.txt", "www.youtube.com_cookies.txt", "www.twitch.tv_cookies.txt"
    ]
    
    # Only files newer than the stored jar: the export is left where it is (no more deleting things from
    # Downloads), and this keeps it from being re-imported on every download.
    stored_mtime = os.path.getmtime(COOKIES_STORED) if os.path.exists(COOKIES_STORED) else 0
    found_file = None
    for name in candidate_names:
        p = os.path.join(USER_DOWNLOADS, name)
        if os.path.exists(p) and os.path.getsize(p) > 0 and os.path.getmtime(p) > stored_mtime:
            found_file = p
            break

    if found_file:
        try:
            with open(found_file, 'r', encoding='utf-8', errors='ignore') as f:
                incoming = f.read()
            if not cookie_rows(incoming):
                return  # not a Netscape cookies.txt (e.g. some unrelated "cookies.txt")
            existing = ''
            if os.path.exists(COOKIES_STORED):
                with open(COOKIES_STORED, 'r', encoding='utf-8', errors='ignore') as f:
                    existing = f.read()
            with open(COOKIES_STORED, 'w', encoding='utf-8') as f:
                f.write(merge_cookie_jars(existing, incoming))
            app_logs.append(f"Auto-imported cookies from {os.path.basename(found_file)} into safe storage!")
        except Exception as e:
            app_logs.append(f"Cookie auto-import warning: {e}")


def merge_cookie_jars(existing, incoming):
    """Incoming rows replace stored rows for the same domains; rows for other domains (e.g. a YouTube
    sync when a Twitch export arrives) are kept instead of being overwritten."""
    def domain(line):
        d = line[len("#HttpOnly_"):] if line.startswith("#HttpOnly_") else line
        return d.split("\t", 1)[0].lstrip('.').lower()

    def rows(content):
        return [l for l in content.splitlines()
                if len(l.split("\t")) >= 7 and (l.startswith("#HttpOnly_") or not l.startswith("#"))]

    new_rows = rows(incoming)
    new_domains = {domain(l) for l in new_rows}
    kept = [l for l in rows(existing) if domain(l) not in new_domains]
    return "\n".join(["# Netscape HTTP Cookie File"] + kept + new_rows) + "\n"

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
        write_json_atomic(HISTORY_FILE, history_list[:30])  # Keep up to last 30 entries
    except Exception as e:
        app_logs.append(f"History save error: {e}")

_history_lock = threading.Lock()

def add_history_entry(filename, format_type="MP4"):
    try:
        date_str = datetime.now().strftime("%d.%m.%Y %H:%M")
        with _history_lock:
            current_hist = load_history()
            current_hist.insert(0, {
                "date": date_str,
                "filename": filename,
                "type": format_type
            })
            save_history(current_hist)
    except Exception as e:
        app_logs.append(f"Add history error: {e}")

# --- LAN IP HELPER ---
def get_local_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return '127.0.0.1'

# --- FLASK SERVER SETUP ---
app = Flask(__name__, static_folder=DIST_DIR)

# The server listens on all interfaces so phones can fetch Wi-Fi shared files, but everything else
# (settings incl. the Twitch token, cookies, downloads, folder dialogs, close...) is local-only.
# The UI is same-origin, so no CORS header is sent: with the old `Access-Control-Allow-Origin: *`
# any website open in the browser could read /api/settings or pull files from the download folder.
_LOOPBACK_ADDRS = {'127.0.0.1', '::1', '::ffff:127.0.0.1'}
shared_files = set()  # basenames explicitly shared via /api/share_info

def _is_ip_or_localhost(host):
    host = host.strip('[]').lower()
    if host == 'localhost':
        return True
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False

@app.before_request
def restrict_access():
    # Only IP-literal / localhost Host headers: blocks DNS-rebinding pages (evil.example -> 127.0.0.1)
    host = request.host or ''
    host = host.rsplit(':', 1)[0] if not host.endswith(']') else host
    if not _is_ip_or_localhost(host):
        abort(403)
    if request.remote_addr in _LOOPBACK_ADDRS:
        # A website open in the user's browser can still *send* requests to 127.0.0.1 (it just can't read
        # the answers). Browsers label those, so refuse API calls that come from another origin.
        if request.path.startswith('/api/'):
            origin = request.headers.get('Origin')
            if origin and urllib.parse.urlparse(origin).netloc != request.host:
                abort(403)
            if request.headers.get('Sec-Fetch-Site') in ('cross-site', 'same-site'):
                abort(403)
        return None
    # LAN clients (phones scanning the share QR code) may only download explicitly shared files
    if request.path.startswith('/api/download_file/'):
        return None
    abort(403)

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

_INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*%\x00-\x1f]')

def sanitize_filename(name):
    """Custom output names go straight into Windows paths and yt-dlp templates: strip characters
    that are illegal on Windows (or '%', which yt-dlp would treat as a template field)."""
    cleaned = _INVALID_FILENAME_CHARS.sub('', name or '').strip().rstrip('. ')
    return cleaned

QUALITY_HEIGHTS = {"1440p": 1440, "1080p": 1080, "720p": 720, "480p": 480}

def quality_format(quality):
    """yt-dlp -f selector for a quality label; Best, 4K and anything unknown get the best available."""
    h = QUALITY_HEIGHTS.get(quality)
    if not h:
        return "bestvideo+bestaudio/best"
    return f"bestvideo[height<={h}]+bestaudio/best[height<={h}]/best"

def is_valid_media_url(url):
    """A "URL" starting with '-' would be parsed by yt-dlp as an option (e.g. --exec)."""
    return bool(url) and not url.startswith('-')

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
        data = load_settings()
        if not data:
            return jsonify({
                "downloadDir": download_dir,
                "turboMode": True,
                "splitChapters": False,
                "twitchToken": ""
            })
        if "downloadDir" in data and os.path.exists(data["downloadDir"]):
            download_dir = data["downloadDir"]
        data["downloadDir"] = download_dir
        return jsonify(data)
    else:
        new_data = request.get_json(silent=True) or {}
        update_settings(new_data)
        if "downloadDir" in new_data and os.path.exists(new_data["downloadDir"]):
            download_dir = new_data["downloadDir"]
        if "twitchToken" in new_data:
            update_twitch_auth_cookie(new_data["twitchToken"])
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
            update_settings({"downloadDir": download_dir})
            return jsonify({"success": True, "folder": download_dir})
    return jsonify({"success": False, "folder": download_dir})

@app.route('/api/open_folder', methods=['POST'])
def api_open_folder():
    try:
        # get_json(silent=True): the Settings button posts without a JSON body, which Flask 3 rejects with 415
        folder = (request.get_json(silent=True) or {}).get('folder') or download_dir
        # os.startfile *runs* files, so only ever hand it a directory
        if os.path.isfile(folder):
            folder = os.path.dirname(folder)
        if not os.path.exists(folder):
            os.makedirs(folder, exist_ok=True)
        if not os.path.isdir(folder):
            return jsonify({"success": False, "error": "Not a folder"})
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
            info = probe_media_file(selected_path)
            return jsonify({"success": True, "filePath": selected_path, "fileName": os.path.basename(selected_path), "info": info})
    return jsonify({"success": False})

@app.route('/api/probe_media', methods=['POST'])
def api_probe_media():
    data = request.get_json(silent=True) or {}
    path_or_url = data.get('target', '')
    if not path_or_url:
        return jsonify({"success": False, "error": "No target provided"})
    info = probe_media_file(path_or_url)
    return jsonify({"success": True, "info": info})

def probe_media_file(target):
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
    # Flag first so run_download doesn't fall back to another downloader or start the conversion step
    cancel_event.set()
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
    global app_logs
    app_logs.clear()
    cancel_event.clear()

    def run_update_thread():
        app_logs.append("Starting engine updater pipeline...")
        cmd = [YTDLP_EXE, "-U"]
        run_process(cmd)
        
        # Re-check update status to refresh info immediately
        check_all_updates_worker()
        app_logs.append("Update cycle finished.")
        app_logs.append("Process Finished Successfully!")

    threading.Thread(target=run_update_thread).start()
    return jsonify({"success": True})

@app.route('/api/cookie_status', methods=['GET'])
def api_cookie_status():
    check_cookies()
    return jsonify(get_cookie_status_dict())

@app.route('/api/import_cookies', methods=['POST'])
def api_import_cookies():
    if window:
        file_types = ('Cookie Text Files (*.txt;*.cookies)', 'All files (*.*)')
        result = window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        if result and len(result) > 0:
            selected_path = result[0]
            try:
                if not os.path.exists(TOOLS_DIR): os.makedirs(TOOLS_DIR)
                shutil.copy2(selected_path, COOKIES_STORED)
                status = get_cookie_status_dict()
                app_logs.append(f"Successfully imported cookies from {os.path.basename(selected_path)}! ({status.get('summary', '')})")
                return jsonify({"success": True, "status": status})
            except Exception as e:
                return jsonify({"success": False, "error": str(e)})
    return jsonify({"success": False, "error": "Dialog cancelled or window unavailable"})

@app.route('/api/save_twitch_token', methods=['POST'])
def api_save_twitch_token():
    data = request.get_json(silent=True) or {}
    token = data.get('token', '').strip()
    try:
        update_settings({'twitchToken': token})
        update_twitch_auth_cookie(token)
        status = get_cookie_status_dict()
        if token:
            app_logs.append("Twitch authentication token saved & cookie storage updated!")
        else:
            app_logs.append("Twitch authentication token cleared.")
        return jsonify({"success": True, "status": status})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/clear_cookies', methods=['POST'])
def api_clear_cookies():
    try:
        if os.path.exists(COOKIES_STORED):
            os.remove(COOKIES_STORED)
        if os.path.exists(SETTINGS_FILE):
            update_settings({'twitchToken': ''})
        app_logs.append("Stored cookies and credentials cleared.")
        return jsonify({"success": True, "status": get_cookie_status_dict()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/sync_cookies', methods=['POST'])
def api_sync_cookies():
    data = request.get_json(silent=True) or {}
    browser = str(data.get('browser', 'chrome')).lower()
    spec = browser_spec(browser)
    label = BROWSER_LABELS.get(browser, browser)
    if not spec:
        return jsonify({"success": False, "error": f"Unknown browser: {browser}", "status": get_cookie_status_dict()})

    # Write to a temp file first: an existing cookies.txt must not make a failed sync look successful
    tmp = os.path.join(TOOLS_DIR, f"_cookie_sync_{int(time.time())}.txt")
    try:
        app_logs.append(f"Synchronizing session cookies from {label}...")
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        # No URL: yt-dlp still loads the browser jar and writes it to --cookies on exit
        proc = subprocess.run([YTDLP_EXE, "--cookies-from-browser", spec, "--cookies", tmp],
                              capture_output=True, text=True, encoding='utf-8', errors='ignore',
                              startupinfo=startupinfo, timeout=120)
        out = (proc.stdout or '') + (proc.stderr or '')
        # yt-dlp can only dump the whole jar; read it, delete it immediately, keep only youtube.com
        dump = ''
        if os.path.exists(tmp):
            with open(tmp, 'r', encoding='utf-8', errors='ignore') as f:
                dump = f.read()
            os.remove(tmp)
        any_cookies = bool(cookie_rows(dump))
        yt, content = merge_youtube_cookies(dump)
        dump = ''
        rows = cookie_rows("\n".join(yt))

        if any_cookies and not rows:
            err_msg = f"{label} has no youtube.com cookies. Open youtube.com in {label}, sign in, close it and sync again."
            app_logs.append(f"⚠️ Cookie Sync Note: {err_msg}")
            return jsonify({"success": False, "error": err_msg, "status": get_cookie_status_dict()})

        if not rows:
            low = out.lower()
            if 'could not copy' in low or 'database is locked' in low:
                err_msg = f"{label} is running and has its cookie database locked. Close {label} completely (check the tray), click Sync again, then reopen it."
            elif 'could not find' in low or 'failed to find' in low:
                err_msg = f"No {label} profile found on this PC."
            elif 'decrypt' in low:
                err_msg = f"{label} encrypts its cookies in a way yt-dlp cannot read. Use 'Import cookies.txt' instead."
            else:
                err_msg = f"Could not read cookies from {label}."
            app_logs.append(f"⚠️ Cookie Sync Note: {err_msg}")
            # yt-dlp's own error lines (no cookie values are ever printed by yt-dlp)
            for line in [l for l in out.splitlines() if l.strip().startswith(("ERROR", "WARNING"))][-3:]:
                app_logs.append(f"   yt-dlp: {line.strip()}")
            return jsonify({"success": False, "error": err_msg, "status": get_cookie_status_dict()})

        with open(COOKIES_STORED, 'w', encoding='utf-8') as f:
            f.write(content)
        status = get_cookie_status_dict()
        if status.get("hasYouTube"):
            msg = f"Synced {len(rows)} youtube.com cookies from {label} (YouTube login found). Nothing else was saved."
        else:
            msg = f"Synced {len(rows)} youtube.com cookies from {label}, but no YouTube login was found. Sign in to YouTube in {label} and sync again."
        app_logs.append(msg)
        return jsonify({"success": True, "message": msg, "youTubeLoggedIn": bool(status.get("hasYouTube")), "status": status})
    except Exception as e:
        app_logs.append(f"Cookie sync error: {e}")
        return jsonify({"success": False, "error": str(e), "status": get_cookie_status_dict()})
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass

# --- LOCAL WI-FI SHARE & SERVING ENDPOINTS ---
@app.route('/api/share_info', methods=['GET'])
def api_share_info():
    filename = request.args.get('filename', '').strip()
    if filename:
        shared_files.add(os.path.basename(filename))
    local_ip = get_local_ip()
    port = 54321
    encoded_name = urllib.parse.quote(filename)
    share_url = f"http://{local_ip}:{port}/api/download_file/{encoded_name}"
    return jsonify({
        "ip": local_ip,
        "port": port,
        "shareUrl": share_url,
        "filename": filename
    })

@app.route('/api/download_file/<path:filename>', methods=['GET'])
def api_download_file(filename):
    unquoted = urllib.parse.unquote(filename)
    if os.path.basename(unquoted) not in shared_files:
        return "File not found", 404
    file_path = os.path.join(download_dir, unquoted)
    if os.path.exists(file_path):
        return send_from_directory(download_dir, unquoted, as_attachment=True)
    # Check recursive folders
    for root, dirs, files in os.walk(download_dir):
        if unquoted in files:
            return send_from_directory(root, unquoted, as_attachment=True)
    return "File not found", 404

# --- LIVE STREAM DVR RECORDER ENDPOINTS ---
@app.route('/api/record_live', methods=['POST'])
def api_record_live():
    global live_recording_state, live_process
    data = request.get_json(silent=True) or {}
    url = data.get('url', '').strip()
    quality = data.get('quality', 'Best')
    live_from_start = data.get('liveFromStart', False)
    custom_name = sanitize_filename(data.get('customName', ''))
    if not is_valid_media_url(url):
        return jsonify({"success": False, "error": "Invalid URL"})
    browser_cookies = data.get('browserCookies', 'none')

    if not url:
        return jsonify({"success": False, "error": "No Live URL provided"})
    
    if live_recording_state["is_recording"]:
        return jsonify({"success": False, "error": "A live recording is already in progress"})

    custom_dir = data.get('downloadDir', '').strip()
    target_dir = custom_dir if (custom_dir and os.path.exists(custom_dir)) else download_dir

    if custom_name:
        output_template = f"{custom_name}.%(ext)s"
        initial_title = custom_name
        initial_filename = f"{custom_name}.mp4"
        initial_path = os.path.join(target_dir, initial_filename)
    else:
        # Default name format: Channelname - Title of the stream
        output_template = "%(uploader,channel,creator,uploader_id)s - %(title)s.%(ext)s"
        initial_title = "Resolving broadcast stream..."
        initial_filename = "Resolving Live Stream Title..."
        initial_path = ""

    live_recording_state = {
        "is_recording": True,
        "url": url,
        "title": initial_title,
        "filename": initial_filename,
        "output_path": initial_path,
        "start_time": time.time(),
        "duration_sec": 0,
        "bytes_downloaded": 0,
        "quality": quality,
        "live_from_start": live_from_start
    }

    threading.Thread(target=run_live_recorder, args=(url, target_dir, output_template, quality, live_from_start, browser_cookies, custom_name)).start()
    return jsonify({"success": True, "state": live_recording_state})

def run_live_recorder(url, target_dir, output_template, quality, live_from_start, browser_cookies, custom_name):
    global live_recording_state, live_process, app_logs
    
    current_live_from_start = live_from_start
    
    my_env = os.environ.copy()
    my_env["PATH"] += os.pathsep + TOOLS_DIR
    startupinfo = None
    if os.name == 'nt':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

    while live_recording_state.get("is_recording", False):
        cmd = [YTDLP_EXE]
        cmd.extend(js_runtime_args() + cookie_args(browser_cookies))

        if current_live_from_start:
            cmd.append("--live-from-start")
        else:
            cmd.append("--no-live-from-start")

        fmt = quality_format(quality)

        cmd.extend([
            # before_dl: a plain `--print filename` implies --simulate, so nothing would be recorded
            "--print", "before_dl:filename",
            "-P", target_dir,
            "-o", output_template,
            "--no-part",
            "--hls-use-mpegts",
            "-f", fmt,
            "--merge-output-format", "mp4",
            url
        ])

        app_logs.append(f"🔴 Live Stream DVR: Connecting to stream {url}...")
        
        fallback_to_live = False
        
        try:
            live_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE,
                startupinfo=startupinfo,
                env=my_env,
                universal_newlines=True,
                encoding='utf-8',
                errors='ignore'
            )

            for line in live_process.stdout:
                clean_line = line.strip()
                if clean_line:
                    # Detect filename output from --print filename or destination
                    if (clean_line.endswith('.mp4') or clean_line.endswith('.ts') or clean_line.endswith('.mkv')) and not clean_line.startswith('['):
                        resolved_path = clean_line if os.path.isabs(clean_line) else os.path.join(target_dir, clean_line)
                        resolved_name = os.path.basename(resolved_path)
                        live_recording_state["output_path"] = resolved_path
                        live_recording_state["filename"] = resolved_name
                        live_recording_state["title"] = os.path.splitext(resolved_name)[0]
                    elif "[download] Destination: " in clean_line:
                        dest = clean_line.split("[download] Destination: ", 1)[1].strip()
                        if dest:
                            resolved_path = dest if os.path.isabs(dest) else os.path.join(target_dir, dest)
                            resolved_name = os.path.basename(resolved_path)
                            live_recording_state["output_path"] = resolved_path
                            live_recording_state["filename"] = resolved_name
                            live_recording_state["title"] = os.path.splitext(resolved_name)[0]
                    elif "[Merger] Merging formats into " in clean_line:
                        dest = clean_line.split("[Merger] Merging formats into ", 1)[1].strip().strip('"')
                        if dest:
                            resolved_path = dest if os.path.isabs(dest) else os.path.join(target_dir, dest)
                            resolved_name = os.path.basename(resolved_path)
                            live_recording_state["output_path"] = resolved_path
                            live_recording_state["filename"] = resolved_name
                            live_recording_state["title"] = os.path.splitext(resolved_name)[0]

                    # Detect live-from-start rewind limitation
                    if current_live_from_start and (
                        "--no-live-from-start" in clean_line or 
                        "no formats that can be downloaded from the start" in clean_line or
                        "Unable to extract the VOD" in clean_line
                    ):
                        fallback_to_live = True
                    
                    app_logs.append(clean_line)
                    if len(app_logs) > 300:
                        app_logs.pop(0)

            live_process.wait()
        except Exception as e:
            app_logs.append(f"Live DVR Error: {e}")
            break

        # If --live-from-start failed because no start format exists, switch directly to live stream recording
        if fallback_to_live and current_live_from_start and live_recording_state.get("is_recording", False):
            app_logs.append("⚠️ Notice: Broadcast does not support rewinding to start (no VOD archive available). Switching to real-time live recording...")
            current_live_from_start = False
            time.sleep(0.5)
            continue
        
        break

    live_process = None
    live_recording_state["is_recording"] = False
    
    output_path = live_recording_state.get("output_path", "")
    if not (output_path and os.path.exists(output_path)):
        try:
            recent_files = [
                os.path.join(target_dir, f) for f in os.listdir(target_dir) 
                if f.endswith(('.mp4', '.mkv', '.ts')) and os.path.getmtime(os.path.join(target_dir, f)) >= live_recording_state.get("start_time", 0) - 5
            ]
            if recent_files:
                recent_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
                output_path = recent_files[0]
                live_recording_state["output_path"] = output_path
                live_recording_state["filename"] = os.path.basename(output_path)
                live_recording_state["title"] = os.path.splitext(os.path.basename(output_path))[0]
        except Exception:
            pass

    if output_path and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        add_history_entry(os.path.basename(output_path), "LIVE DVR")
        app_logs.append(f"🔴 Live Stream finalized and saved: {os.path.basename(output_path)}")

@app.route('/api/stop_live', methods=['POST'])
def api_stop_live():
    global live_process, live_recording_state
    if live_process:
        # Set first so the recorder loop doesn't restart; the tree kill also ends yt-dlp's ffmpeg child,
        # which would otherwise keep recording. --hls-use-mpegts keeps the file playable after a hard stop.
        live_recording_state["is_recording"] = False
        kill_process_tree(live_process)
        app_logs.append("🔴 Live Stream recording stopped by user. Finalizing video container...")
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "No active recording"})

@app.route('/api/live_status', methods=['GET'])
def api_live_status():
    global live_recording_state
    if live_recording_state["is_recording"]:
        live_recording_state["duration_sec"] = int(time.time() - live_recording_state["start_time"])
        out_path = live_recording_state.get("output_path", "")
        if out_path and os.path.exists(out_path):
            try:
                live_recording_state["bytes_downloaded"] = os.path.getsize(out_path)
            except:
                pass
    return jsonify(live_recording_state)

# --- BATCH QUEUE ENDPOINTS ---
@app.route('/api/queue', methods=['GET', 'POST', 'DELETE'])
def api_queue_handler():
    global download_queue
    if request.method == 'GET':
        return jsonify({"queue": download_queue, "isProcessing": queue_worker_active})
    elif request.method == 'POST':
        data = request.get_json(silent=True) or {}
        items = [it for it in data.get('items', []) if is_valid_media_url(str(it.get('url', '')).strip())]
        for it in items:
            it['customName'] = sanitize_filename(it.get('customName', ''))
            it['id'] = str(int(time.time() * 1000)) + f"_{len(download_queue)}"
            it['status'] = 'queued'
            download_queue.append(it)
        start_queue_worker_if_needed()
        return jsonify({"success": True, "queue": download_queue})
    elif request.method == 'DELETE':
        item_id = request.args.get('id', '')
        if item_id == 'all':
            download_queue = [it for it in download_queue if it.get('status') == 'downloading']
        else:
            download_queue = [it for it in download_queue if it.get('id') != item_id]
        return jsonify({"success": True, "queue": download_queue})

def start_queue_worker_if_needed():
    global queue_worker_active
    if not queue_worker_active:
        threading.Thread(target=process_queue_worker, daemon=True).start()

def process_queue_worker():
    global queue_worker_active, download_queue
    queue_worker_active = True
    try:
        while True:
            pending = [it for it in download_queue if it.get('status') == 'queued']
            if not pending:
                break
            item = pending[0]
            item['status'] = 'downloading'
            try:
                run_download(
                    url=item.get('url', ''),
                    fmt=item.get('format', 'mp4'),
                    quality=item.get('quality', 'Best'),
                    custom_name=item.get('customName', ''),
                    playlist_mode=item.get('playlistMode', False),
                    start_time=item.get('startTime', ''),
                    end_time=item.get('endTime', ''),
                    sponsor_block=item.get('sponsorBlock', False),
                    browser_cookies=item.get('browserCookies', 'none'),
                    embed_metadata=item.get('embedMetadata', True),
                    video_codec=item.get('videoCodec', 'auto'),
                    turbo_mode=item.get('turboMode', True),
                    split_chapters=item.get('splitChapters', False)
                )
                item['status'] = 'cancelled' if cancel_event.is_set() else 'completed'
            except Exception as e:
                item['status'] = 'failed'
                item['error'] = str(e)
            time.sleep(1)
    finally:
        queue_worker_active = False

@app.route('/api/download', methods=['POST'])
def api_download():
    data = request.get_json(silent=True) or {}
    url = data.get('url', '').strip()
    fmt = data.get('format', 'mp4')
    quality = data.get('quality', 'Best')
    custom_name = sanitize_filename(data.get('customName', ''))
    playlist_mode = data.get('playlistMode', False)
    start_time = data.get('startTime', '').strip()
    end_time = data.get('endTime', '').strip()
    fps = data.get('fps', 'original')
    scale = data.get('scale', 'original')
    dither = data.get('dither', 'bayer')
    boomerang = data.get('boomerang', False)
    crop = data.get('crop', 'none')
    speed = data.get('speed', '1.0')
    meme_top = data.get('memeTop', '')
    meme_bottom = data.get('memeBottom', '')
    max_file_size = data.get('maxFileSize', 'none')
    sponsor_block = data.get('sponsorBlock', False)
    browser_cookies = data.get('browserCookies', 'none')
    embed_metadata = data.get('embedMetadata', True)
    video_codec = data.get('videoCodec', 'auto')
    turbo_mode = data.get('turboMode', True)
    split_chapters = data.get('splitChapters', False)
    
    if not url:
        return jsonify({"success": False, "error": "No URL provided"})
    if not is_valid_media_url(url):
        return jsonify({"success": False, "error": "Invalid URL"})

    threading.Thread(target=run_download, args=(
        url, fmt, quality, custom_name, playlist_mode, start_time, end_time, fps, scale, dither,
        boomerang, crop, speed, meme_top, meme_bottom, max_file_size, sponsor_block, browser_cookies, embed_metadata, video_codec,
        turbo_mode, split_chapters
    )).start()
    return jsonify({"success": True})

@app.route('/api/convert_local', methods=['POST'])
def api_convert_local():
    data = request.get_json(silent=True) or {}
    input_file = data.get('filePath', '').strip()
    target_format = data.get('format', 'gif')
    custom_name = sanitize_filename(data.get("customName", ""))
    start_time = data.get('startTime', '').strip()
    end_time = data.get('endTime', '').strip()
    fps = data.get('fps', 'original')
    scale = data.get('scale', 'original')
    dither = data.get('dither', 'bayer')
    boomerang = data.get('boomerang', False)
    crop = data.get('crop', 'none')
    speed = data.get('speed', '1.0')
    meme_top = data.get('memeTop', '')
    meme_bottom = data.get('memeBottom', '')
    max_file_size = data.get('maxFileSize', 'none')
    
    if not input_file or not os.path.exists(input_file):
        return jsonify({"success": False, "error": "Input file does not exist"})
    
    threading.Thread(target=run_local_convert, args=(
        input_file, target_format, custom_name, start_time, end_time, fps, scale, dither,
        boomerang, crop, speed, meme_top, meme_bottom, max_file_size
    )).start()
    return jsonify({"success": True})

# --- CORE PROCESS RUNNER ---
def run_process(cmd_list, on_line=None):
    """on_line sees every output line, including ones that later fall out of the 300-line app_logs window."""
    global app_logs, current_process
    my_env = os.environ.copy()
    my_env["PATH"] += os.pathsep + TOOLS_DIR
    
    startupinfo = None
    if os.name == 'nt':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

    ret_code = 1
    if cancel_event.is_set():
        return ret_code
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
                if on_line:
                    on_line(clean_line)

        current_process.wait()
        ret_code = current_process.returncode
    except Exception as e:
        app_logs.append(f"CRITICAL ERROR: {str(e)}")
    finally:
        current_process = None
    return ret_code

class OutputFileTracker:
    """Collects the final file of each item from yt-dlp's output. Later stages win per item: an MP3 download
    first prints the source "Destination: x.webm", then "[ExtractAudio] Destination: x.mp3"."""
    VALID_EXTS = ('.mp3', '.mp4', '.wav', '.flac', '.webm', '.gif', '.m4a', '.mkv')

    def __init__(self):
        self._by_item = {}  # name without extension (or .fNNN part) -> final filename, in download order

    def feed(self, line):
        fname = None
        if "[download] Destination:" in line or "[ExtractAudio] Destination:" in line:
            fname = line.split("Destination: ", 1)[-1].strip()
        elif "has already been downloaded" in line:
            fname = line.replace("[download] ", "").split(" has already")[0].strip()
        elif "[Merger] Merging formats into" in line:
            parts = line.split('"')
            fname = parts[1].strip() if len(parts) > 1 else None
        # [ChapterSplit] lines are left out on purpose: one album would flood the 30-entry history
        if not fname:
            return
        fname = fname.replace("\\", "/").split("/")[-1]
        low = fname.lower()
        if re.search(r'\.f\d+\.[a-z0-9]+$', low) or not low.endswith(self.VALID_EXTS):
            # format fragment (.f137.mp4) or a temp/thumbnail file: still marks the item, but isn't the result
            key = re.sub(r'(\.f\d+)?\.[a-z0-9]+$', '', fname, flags=re.I)
            self._by_item.setdefault(key, None)
            return
        self._by_item[os.path.splitext(fname)[0]] = fname

    def files(self):
        return [f for f in self._by_item.values() if f]


# --- HIGH-QUALITY VIDEO TO GIF / CONVERSION ENGINE ---
# Aspect-ratio crops take the largest box of that ratio that fits, so a source narrower than the
# ratio no longer asks ffmpeg for a crop wider than the frame (which made the render fail).
CROP_FILTERS = {
    '1:1': "crop=min(iw\\,ih):min(iw\\,ih)",
    '9:16': "crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9)",
    '4:3': "crop=min(iw\\,ih*4/3):min(ih\\,iw*3/4)",
    # Smart Blur Background: blurred, zoomed copy behind the original
    '16:9_blur': "split[v0][v1];[v0]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=25:5[bg];[v1]scale=-1:1080[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2",
    '9:16_blur': "split[v0][v1];[v0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];[v1]scale=1080:-1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2",
}
SCALE_HEIGHTS = {"1080p": 1080, "720p": 720, "480p": 480, "360p": 360}


def crop_fps_scale_filters(crop_val, fps_val, scale_val):
    """The crop -> fps -> Lanczos scale chain shared by the GIF and WebP renders."""
    filters = []
    if crop_val in CROP_FILTERS:
        filters.append(CROP_FILTERS[crop_val])
    if fps_val and fps_val != "original":
        filters.append(f"fps={fps_val}")
    if scale_val in SCALE_HEIGHTS:
        filters.append(f"scale=-1:{SCALE_HEIGHTS[scale_val]}:flags=lanczos")
    return filters


def webp_args(crop_val, fps_val, scale_val, output_path):
    vf = crop_fps_scale_filters(crop_val, fps_val, scale_val)
    return ["-vf", ",".join(vf) if vf else "null", "-vcodec", "libwebp", "-q:v", "90", "-loop", "0", "-an", output_path]


def build_gif_filter_graph(fps_val, scale_val, dither_val, boomerang=False, crop_val='none', speed_val='1.0', meme_top='', meme_bottom=''):
    filters = []

    # 1. Playback Speed Multiplier
    try:
        sp = float(speed_val)
        if sp > 0 and sp != 1.0:
            filters.append(f"setpts={1.0/sp:.4f}*PTS")
    except (TypeError, ValueError):
        pass

    # 2-4. Crop / blur padding, FPS, Lanczos scale
    filters.extend(crop_fps_scale_filters(crop_val, fps_val, scale_val))

    # 5. Meme text overlays
    if meme_top:
        safe_top = meme_top.replace("'", "").replace(":", "").replace("[", "").replace("]", "").replace("\\", "")
        # expansion=none: otherwise drawtext treats '%' as a %{...} sequence and "100%" fails the render
        filters.append(f"drawtext=text='{safe_top}':expansion=none:fontcolor=white:fontsize=28:borderw=3:bordercolor=black:x=(w-text_w)/2:y=15")
    if meme_bottom:
        safe_bot = meme_bottom.replace("'", "").replace(":", "").replace("[", "").replace("]", "").replace("\\", "")
        filters.append(f"drawtext=text='{safe_bot}':expansion=none:fontcolor=white:fontsize=28:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-text_h-15")

    prefix = ",".join(filters)
    if prefix:
        prefix += ","
        
    # 6. Two-pass Palettegen + Paletteuse filter for master quality
    dither_opt = "bayer:bayer_scale=5" if dither_val == "bayer" else "sierra2_4a" if dither_val == "sierra" else "floyd_steinberg" if dither_val == "floyd" else "none"
    
    if boomerang:
        graph = f"{prefix}split[v0][v1];[v1]reverse[vr];[v0][vr]concat=n=2:v=1:a=0[vcat];[vcat]split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff:reserve_transparent=on[p];[s1][p]paletteuse=dither={dither_opt}:diff_mode=rectangle"
    else:
        graph = f"{prefix}split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff:reserve_transparent=on[p];[s1][p]paletteuse=dither={dither_opt}:diff_mode=rectangle"
    return graph

def run_download(url, fmt, quality, custom_name, playlist_mode, start_time, end_time, fps="original", scale="original", dither="bayer",
                 boomerang=False, crop="none", speed="1.0", meme_top="", meme_bottom="", max_file_size="none",
                 sponsor_block=False, browser_cookies="none", embed_metadata=True, video_codec="auto",
                 turbo_mode=True, split_chapters=False):
    global app_logs
    app_logs.clear()
    cancel_event.clear()
    check_cookies()
    app_logs.append(f"Universal Media Engine: Preparing download for {url}")
    
    time.sleep(0.5)
    
    timestamp = int(time.time())
    base_name = custom_name if custom_name else "%(title)s"
    
    # Handle GIF or Looping Video with Sound
    if fmt == 'gif' or fmt == 'loop_mp4' or fmt == 'webp':
        temp_video = os.path.join(download_dir, f"_temp_raw_{timestamp}.mp4")
        
        # 1. Download video stream with yt-dlp
        cmd = [YTDLP_EXE]
        cmd.extend(js_runtime_args() + cookie_args(browser_cookies))
            
        if sponsor_block:
            cmd.extend(["--sponsorblock-remove", "sponsor,intro,outro,selfpromo"])
            
        cmd.extend(["-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4"])
        if start_time and end_time:
            cmd.extend(["--download-sections", f"*{start_time}-{end_time}"])
            
        cmd.extend(["--newline", "-o", temp_video, "--no-playlist", url])
        app_logs.append(f"Downloading source stream for {fmt.upper()} conversion...")
        run_process(cmd)
        if cancel_event.is_set():
            return

        if not os.path.exists(temp_video):
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
        conv_ret = 1
        out_ext = "gif" if fmt == 'gif' else "mp4" if fmt == 'loop_mp4' else "webp"
        final_filename = f"{custom_name}.{out_ext}" if custom_name else f"Levi_Master_Clip_{timestamp}.{out_ext}"
        final_output = os.path.join(download_dir, final_filename)
        
        if fmt == 'gif':
            app_logs.append("Rendering Master-Quality GIF (2-Pass Palette Filter & Custom Graph)...")
            filter_graph = build_gif_filter_graph(fps, scale, dither, boomerang, crop, speed, meme_top, meme_bottom)
            conv_cmd = [FFMPEG_EXE, "-y"]
            if start_time and not ("--download-sections" in cmd):
                conv_cmd.extend(["-ss", start_time])
            if end_time and not ("--download-sections" in cmd):
                conv_cmd.extend(["-to", end_time])
            conv_cmd.extend(["-i", temp_video, "-vf", filter_graph, final_output])
            conv_ret = run_process(conv_cmd)
        elif fmt == 'loop_mp4':
            app_logs.append("Rendering Looping Video Clip with Audio...")
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
            conv_ret = run_process(conv_cmd)
        elif fmt == 'webp':
            app_logs.append("Rendering Animated 24-Bit WebP...")
            conv_cmd = [FFMPEG_EXE, "-y", "-i", temp_video] + webp_args(crop, fps, scale, final_output)
            conv_ret = run_process(conv_cmd)

        try:
            if os.path.exists(temp_video):
                os.remove(temp_video)
        except:
            pass

        if cancel_event.is_set():
            return
        # The UI only stops waiting once it sees one of these two markers
        if conv_ret == 0 and os.path.exists(final_output):
            add_history_entry(os.path.basename(final_output), fmt.upper())
            app_logs.append(f"Saved: {os.path.basename(final_output)}")
            app_logs.append("Process Finished Successfully!")
        else:
            app_logs.append(f"CRITICAL ERROR: {fmt.upper()} conversion failed.")

    else:
        # Standard Universal Downloads: MP4, MP3, WAV, FLAC, WebM
        filename_template = f"{base_name}.%(ext)s"
        output_path = os.path.join(download_dir, filename_template)
        
        cmd = [YTDLP_EXE]
        
        # Turbo Acceleration with aria2c
        used_aria = False
        if turbo_mode and os.path.exists(ARIA2C_EXE):
            cmd.extend(["--downloader", ARIA2C_EXE, "--downloader-args", "aria2c:-x 16 -s 16 -k 1M -j 16"])
            used_aria = True
            app_logs.append("⚡ Turbo Acceleration Active: 16x Multi-Thread Engine enabled.")
            
        cmd.extend(js_runtime_args() + cookie_args(browser_cookies))
            
        if sponsor_block:
            cmd.extend(["--sponsorblock-remove", "sponsor,intro,outro,selfpromo"])
            
        if max_file_size and max_file_size != 'none':
            cmd.extend(["--max-filesize", max_file_size])
            
        if video_codec == 'h264':
            cmd.extend(["-S", "vcodec:h264,res,acodec:m4a"])
        elif video_codec == 'av1':
            cmd.extend(["-S", "vcodec:av01,res"])
        
        if split_chapters:
            cmd.extend(["--split-chapters", "-o", "chapter:%(title)s/%(section_number)02d - %(section_title)s.%(ext)s"])
            app_logs.append("🎵 Smart Chapter Splitter Active: Will organize songs into dedicated album folder.")
        
        if fmt == 'wav':
            cmd.extend(["-f", "bestaudio", "--extract-audio", "--audio-format", "wav", "--audio-quality", "0"])
        elif fmt == 'flac':
            cmd.extend(["-f", "bestaudio", "--extract-audio", "--audio-format", "flac", "--audio-quality", "0"])
            if embed_metadata:
                cmd.extend(["--embed-thumbnail", "--add-metadata"])
        elif fmt == 'mp3':
            cmd.extend(["-f", "bestaudio", "--extract-audio", "--audio-format", "mp3", "--audio-quality", "0"])
            if embed_metadata:
                cmd.extend(["--embed-thumbnail", "--add-metadata"])
        elif fmt == 'webm':
            cmd.extend(["-f", "bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]/best", "--merge-output-format", "webm"])
        else: # Default MP4
            cmd.extend(["-f", quality_format(quality), "--merge-output-format", "mp4"])
            if embed_metadata:
                cmd.extend(["--embed-thumbnail", "--add-metadata"])
        
        if start_time and end_time:
            cmd.extend(["--download-sections", f"*{start_time}-{end_time}"])
            
        if not split_chapters:
            cmd.extend(["--newline", "-o", output_path])
        else:
            cmd.extend(["--newline"])
        
        if not playlist_mode:
            cmd.insert(1, "--no-playlist")
        
        cmd.append(url)
        app_logs.append(f"Starting universal download...")
        tracker = OutputFileTracker()
        ret = run_process(cmd, tracker.feed)
        if cancel_event.is_set():
            return

        # Transparent Auto-Fallback if aria2c was blocked by host
        if ret != 0 and used_aria:
            app_logs.append("Turbo accelerator encountered server connection throttle. Automatically retrying with native downloader...")
            cmd_fallback = [c for c in cmd if c not in ("--downloader", ARIA2C_EXE, "--downloader-args", "aria2c:-x 16 -s 16 -k 1M -j 16")]
            ret = run_process(cmd_fallback, tracker.feed)
            if cancel_event.is_set():
                return

        # Error diagnostics & subscriber/auth check
        if ret != 0:
            recent_logs = "\n".join(app_logs[-30:]).lower()
            if "subscriber-only" in recent_logs or "must be logged into an account" in recent_logs:
                app_logs.append("🔒 AUTHENTICATION REQUIRED: This Twitch VOD or stream is subscriber-only.")
                app_logs.append("👉 Solution: In Settings -> Authentication & Cookies, enter your Twitch Auth Token or click 'Import cookies.txt' from a subscribed account.")
            elif "members-only" in recent_logs or "available to this channel's members" in recent_logs:
                app_logs.append("🔒 AUTHENTICATION REQUIRED: This video is restricted to channel members.")
                app_logs.append("👉 Solution: Sync cookies from your browser or import cookies.txt in Settings -> Authentication & Cookies.")
            elif "sign in to confirm you’re not a bot" in recent_logs or "sign in to confirm your age" in recent_logs:
                app_logs.append("🔒 AUTHENTICATION REQUIRED: Platform requested account or age verification.")
                app_logs.append("👉 Solution: Sync browser cookies or import cookies.txt in Settings -> Authentication & Cookies.")
            elif "database is locked" in recent_logs or "could not copy chrome cookie database" in recent_logs:
                app_logs.append("⚠️ BROWSER COOKIE LOCK: Your browser database is locked while the browser is running.")
                app_logs.append("👉 Solution: Click 'Import cookies.txt' or paste your Twitch Auth Token directly in Settings.")

            app_logs.append("CRITICAL ERROR: Download process failed.")
            return

        # Track history: one entry per finished file, so a playlist records every video
        for fname in tracker.files():
            add_history_entry(fname, fmt.upper())

        app_logs.append("Process Finished Successfully!")

def run_local_convert(input_file, target_format, custom_name, start_time, end_time, fps="original", scale="original", dither="bayer",
                      boomerang=False, crop="none", speed="1.0", meme_top="", meme_bottom="", max_file_size="none"):
    global app_logs
    app_logs.clear()
    cancel_event.clear()
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
        graph = build_gif_filter_graph(fps, scale, dither, boomerang, crop, speed, meme_top, meme_bottom)
        cmd.extend(["-vf", graph, output_path])
    elif target_format == 'loop_mp4':
        cmd.extend([
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18",
            "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", output_path
        ])
    elif target_format == 'webp':
        cmd.extend(webp_args(crop, fps, scale, output_path))
    elif target_format in ('mp3', 'wav', 'flac'):
        if target_format == 'mp3':
            cmd.extend(["-vn", "-c:a", "libmp3lame", "-b:a", "320k", output_path])
        elif target_format == 'wav':
            cmd.extend(["-vn", "-c:a", "pcm_s16le", output_path])
        elif target_format == 'flac':
            cmd.extend(["-vn", "-c:a", "flac", output_path])
            
    app_logs.append("Executing FFmpeg conversion...")
    ret = run_process(cmd)
    if cancel_event.is_set():
        return

    if ret == 0 and os.path.exists(output_path):
        add_history_entry(os.path.basename(output_path), target_format.upper())
        app_logs.append(f"Master file saved: {output_path}")
        app_logs.append("Process Finished Successfully!")
    else:
        app_logs.append(f"CRITICAL ERROR: {target_format.upper()} conversion failed.")

# --- STARTUP ---
def configure_webview_permissions():
    """Silently allow clipboard and notifications in WebView2 so their prompts never appear.
    Everything else (camera, microphone, location...) keeps WebView2's default handling."""
    try:
        import webview.platforms.edgechromium as ec
        from Microsoft.Web.WebView2.Core import CoreWebView2PermissionState, CoreWebView2PermissionKind
        allowed_kinds = {CoreWebView2PermissionKind.ClipboardRead, CoreWebView2PermissionKind.Notifications}

        orig_on_webview_ready = ec.EdgeChrome.on_webview_ready

        def custom_on_webview_ready(self, sender, args):
            orig_on_webview_ready(self, sender, args)
            if args.IsSuccess and sender.CoreWebView2:
                def on_permission_requested(s, p_args):
                    try:
                        if p_args.PermissionKind not in allowed_kinds:
                            return
                        p_args.State = CoreWebView2PermissionState.Allow
                        p_args.Handled = True
                    except Exception:
                        pass
                sender.CoreWebView2.PermissionRequested += on_permission_requested

        ec.EdgeChrome.on_webview_ready = custom_on_webview_ready
    except Exception:
        pass

def start_flask():
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    app.run(host='0.0.0.0', port=54321, threaded=True)

if __name__ == '__main__':
    initialize_assets()
    configure_webview_permissions()
    threading.Thread(target=check_all_updates_worker, daemon=True).start()
    threading.Thread(target=start_flask, daemon=True).start()
    
    window = webview.create_window(
        "Levi's Downloader", 
        "http://127.0.0.1:54321",
        width=1240, 
        height=980,
        min_size=(1160, 940),
        frameless=True,
        easy_drag=True,
        background_color='#1a1a24'
    )
    webview.start()