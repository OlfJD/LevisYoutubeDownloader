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
import hashlib
import ctypes
import functools
import traceback
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

# --- JOB RUN NUMBERS ---
# Every download / conversion / update gets a run number. Stop and every new job bump it, and a job only
# acts while its number is still current. A stopped job that finishes late can then neither start its
# fallback or conversion step nor touch the state of the job that replaced it.
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

    # 2. Automated fallback: Download missing binaries if not present.
    # These are programs we then run, so they are only installed when their SHA-256 matches what GitHub publishes.
    target_ytdlp = os.path.join(TOOLS_DIR, "yt-dlp.exe")
    if not os.path.exists(target_ytdlp):
        try:
            app_logs.append("Fetching yt-dlp core binary...")
            download_verified("yt-dlp/yt-dlp", "yt-dlp.exe", target_ytdlp)
            app_logs.append("yt-dlp engine downloaded and verified (SHA-256).")
        except Exception as e:
            app_logs.append(f"Error downloading yt-dlp: {e}")
            log_error(f"yt-dlp download failed: {e}")

    target_ffmpeg = os.path.join(TOOLS_DIR, "ffmpeg.exe")
    if not os.path.exists(target_ffmpeg):
        try:
            app_logs.append("Fetching FFmpeg & FFprobe engine binaries...")
            # Streamed to disk (the archive is ~200 MB) and checked before anything is extracted
            zip_path = os.path.join(TOOLS_DIR, "_ffmpeg_download.zip")
            try:
                download_verified("yt-dlp/FFmpeg-Builds", "ffmpeg-master-latest-win64-gpl.zip", zip_path)
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
            app_logs.append("FFmpeg engine downloaded, verified (SHA-256) and installed.")
        except Exception as e:
            app_logs.append(f"Error downloading FFmpeg: {e}")
            log_error(f"FFmpeg download failed: {e}")


def parse_checksum_file(text, name):
    """SHA-256 for `name` from a sha256sum-style file ("<hash>  <name>" or "<hash> *<name>")."""
    for line in text.splitlines():
        parts = line.strip().split()
        if len(parts) >= 2 and parts[-1].lstrip('*') == name and re.fullmatch(r'[0-9a-fA-F]{64}', parts[0]):
            return parts[0].lower()
    return None


def github_release_asset(repo, name):
    """Download URL and expected SHA-256 of an asset in the repo's latest release. GitHub publishes a digest
    per asset; releases without one fall back to the checksum file published next to the asset."""
    headers = {'User-Agent': 'LevisDownloader', 'Accept': 'application/vnd.github+json'}
    req = urllib.request.Request(f"https://api.github.com/repos/{repo}/releases/latest", headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        release = json.loads(resp.read().decode())
    assets = {a.get("name"): a for a in release.get("assets", [])}
    asset = assets.get(name)
    if not asset:
        raise RuntimeError(f"{name} is not part of {repo}'s latest release")
    digest = (asset.get("digest") or "").lower()
    expected = digest.split(":", 1)[1] if digest.startswith("sha256:") else None
    if not expected:
        for sums_name in ("SHA2-256SUMS", "checksums.sha256"):
            if sums_name in assets:
                sreq = urllib.request.Request(assets[sums_name]["browser_download_url"], headers={'User-Agent': 'LevisDownloader'})
                with urllib.request.urlopen(sreq, timeout=15) as resp:
                    expected = parse_checksum_file(resp.read().decode('utf-8', 'ignore'), name)
                if expected:
                    break
    return asset["browser_download_url"], expected


def download_verified(repo, name, dest):
    """Downloads a release asset to `dest` only if its SHA-256 matches; otherwise nothing is installed."""
    url, expected = github_release_asset(repo, name)
    if not expected:
        raise RuntimeError(f"no SHA-256 is published for {name}, so it was not installed")
    part = dest + ".part"
    sha = hashlib.sha256()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'LevisDownloader'})
        with urllib.request.urlopen(req, timeout=60) as resp, open(part, 'wb') as out:
            while True:
                chunk = resp.read(1024 * 1024)
                if not chunk:
                    break
                sha.update(chunk)
                out.write(chunk)
        if sha.hexdigest() != expected:
            raise RuntimeError(f"{name} failed the SHA-256 check (download damaged or tampered with), so it was not installed")
        os.replace(part, dest)
    finally:
        if os.path.exists(part):
            os.remove(part)

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


# --- SETTINGS: limits in one place; everything loaded or posted is checked against them ---
SETTING_CHOICES = {
    "quality": {"Best", "4K", "1440p", "1080p", "720p", "480p"},
    "videoCodec": {"auto", "h264", "av1"},
    "browserCookies": {"none"} | set(BROWSER_LABELS),
    "gifFps": {"original", "60", "50", "30", "24", "15"},
    "gifScale": {"original", "1080p", "720p", "480p", "360p"},
    "gifDither": {"bayer", "sierra", "floyd", "none"},
    "gifMaxFileSize": {"none", "8M", "15M", "25M", "50M"},
}
SETTING_BOOLS = {"playlistMode", "sponsorBlock", "embedMetadata", "turboMode", "splitChapters", "gifAudioLoop"}
SETTING_TEXT_MAX = {"twitchToken": 4096, "downloadDir": 1024}


def sanitize_settings(data):
    """Unknown keys and out-of-range values are dropped, so a hand-edited or old settings.json can't break
    the app: the UI then uses its own default for that key."""
    clean = {}
    if not isinstance(data, dict):
        return clean
    for key, value in data.items():
        if key in SETTING_CHOICES:
            ok = isinstance(value, str) and value in SETTING_CHOICES[key]
        elif key in SETTING_BOOLS:
            ok = isinstance(value, bool)
        elif key in SETTING_TEXT_MAX:
            ok = isinstance(value, str) and len(value) <= SETTING_TEXT_MAX[key]
        else:
            ok = False
        if ok:
            clean[key] = value
    return clean


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
HISTORY_MAX = 30


def load_history(strict=False):
    try:
        items = read_json(HISTORY_FILE, list, [])
    except UnreadableFile:
        if strict:
            raise
        return []
    return [h for h in items if isinstance(h, dict) and isinstance(h.get("filename"), str)][:HISTORY_MAX]

_history_lock = threading.Lock()

def add_history_entry(filename, format_type="MP4"):
    try:
        date_str = datetime.now().strftime("%d.%m.%Y %H:%M")
        with _history_lock:
            # strict: an unreadable history must not be replaced by a list holding only this entry
            current_hist = load_history(strict=True)
            current_hist.insert(0, {
                "date": date_str,
                "filename": filename,
                "type": format_type
            })
            write_json_atomic(HISTORY_FILE, current_hist[:HISTORY_MAX])
    except Exception as e:
        app_logs.append(f"History not updated: {e}")
        log_error(f"History not updated for {filename}: {e}")

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
        if "downloadDir" in data and os.path.isdir(data["downloadDir"]):
            download_dir = data["downloadDir"]
        data["downloadDir"] = download_dir
        return jsonify(data)
    else:
        new_data = sanitize_settings(request.get_json(silent=True) or {})
        saved = update_settings(new_data)
        if "downloadDir" in new_data and os.path.isdir(new_data["downloadDir"]):
            download_dir = new_data["downloadDir"]
        if "twitchToken" in new_data:
            update_twitch_auth_cookie(new_data["twitchToken"])
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
    # New run number first, so the stopped job doesn't fall back to another downloader or start converting
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
    def run_update_thread(run):
        app_logs.append("Starting engine updater pipeline...")
        # yt-dlp -U checks the new build against the release's SHA2-256SUMS itself
        run_process([YTDLP_EXE, "-U"], run=run)

        # Re-check update status to refresh info immediately
        check_all_updates_worker()
        app_logs.append("Update cycle finished.")
        app_logs.append("Process Finished Successfully!")

    threading.Thread(target=run_update_thread, daemon=True).start()
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
    url = str(data.get('url', '')).strip()
    quality = data.get('quality', 'Best')
    live_from_start = data.get('liveFromStart', False) is True
    custom_name = sanitize_filename(str(data.get('customName', ''))[:NAME_MAX])
    browser_cookies = data.get('browserCookies', 'none')
    if not url:
        return jsonify({"success": False, "error": "No Live URL provided"})
    if not is_valid_media_url(url):
        return jsonify({"success": False, "error": "Invalid URL"})
    if quality not in SETTING_CHOICES["quality"]:
        return jsonify({"success": False, "error": "Unknown quality"})
    if browser_cookies not in SETTING_CHOICES["browserCookies"]:
        browser_cookies = 'none'

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

    # The thread gets this recording's own state dict: when a new recording starts, the old thread's late
    # clean-up only ever touches its own (replaced) dict, never the new recording's.
    threading.Thread(target=run_live_recorder, args=(live_recording_state, url, target_dir, output_template, quality, live_from_start, browser_cookies), daemon=True).start()
    return jsonify({"success": True, "state": live_recording_state})

def run_live_recorder(state, url, target_dir, output_template, quality, live_from_start, browser_cookies):
    global live_process
    started = {}  # the yt-dlp process this recording started, so clean-up only clears its own
    try:
        _record_live(state, started, url, target_dir, output_template, quality, live_from_start, browser_cookies)
    except Exception as e:
        log_error(f"Live recording crashed: {e!r}\n{traceback.format_exc()}")
        app_logs.append(f"Live DVR Error: {e} (details in errors.log)")
    finally:
        # always runs: the UI must never keep showing REC for a recorder that is gone
        state["is_recording"] = False
        if live_process is started.get("proc"):
            live_process = None
    _finalize_live(state, target_dir)


def _record_live(state, started, url, target_dir, output_template, quality, live_from_start, browser_cookies):
    global live_process
    current_live_from_start = live_from_start

    my_env = os.environ.copy()
    my_env["PATH"] += os.pathsep + TOOLS_DIR
    startupinfo = None
    if os.name == 'nt':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

    while state.get("is_recording", False):
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
            proc = subprocess.Popen(
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
            started["proc"] = proc
            live_process = proc
            if not state.get("is_recording"):
                kill_process_tree(proc)  # Stop arrived while it was starting

            for line in proc.stdout:
                clean_line = line.strip()
                if clean_line:
                    # Detect filename output from --print filename or destination
                    if (clean_line.endswith('.mp4') or clean_line.endswith('.ts') or clean_line.endswith('.mkv')) and not clean_line.startswith('['):
                        resolved_path = clean_line if os.path.isabs(clean_line) else os.path.join(target_dir, clean_line)
                        resolved_name = os.path.basename(resolved_path)
                        state["output_path"] = resolved_path
                        state["filename"] = resolved_name
                        state["title"] = os.path.splitext(resolved_name)[0]
                    elif "[download] Destination: " in clean_line:
                        dest = clean_line.split("[download] Destination: ", 1)[1].strip()
                        if dest:
                            resolved_path = dest if os.path.isabs(dest) else os.path.join(target_dir, dest)
                            resolved_name = os.path.basename(resolved_path)
                            state["output_path"] = resolved_path
                            state["filename"] = resolved_name
                            state["title"] = os.path.splitext(resolved_name)[0]
                    elif "[Merger] Merging formats into " in clean_line:
                        dest = clean_line.split("[Merger] Merging formats into ", 1)[1].strip().strip('"')
                        if dest:
                            resolved_path = dest if os.path.isabs(dest) else os.path.join(target_dir, dest)
                            resolved_name = os.path.basename(resolved_path)
                            state["output_path"] = resolved_path
                            state["filename"] = resolved_name
                            state["title"] = os.path.splitext(resolved_name)[0]

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

            proc.wait()
        except Exception as e:
            app_logs.append(f"Live DVR Error: {e}")
            break

        # If --live-from-start failed because no start format exists, switch directly to live stream recording
        if fallback_to_live and current_live_from_start and state.get("is_recording", False):
            app_logs.append("⚠️ Notice: Broadcast does not support rewinding to start (no VOD archive available). Switching to real-time live recording...")
            current_live_from_start = False
            time.sleep(0.5)
            continue
        
        break


def _finalize_live(state, target_dir):
    """Finds the recorded file (also after a hard stop) and adds it to the history."""
    output_path = state.get("output_path", "")
    if not (output_path and os.path.exists(output_path)):
        try:
            recent_files = [
                os.path.join(target_dir, f) for f in os.listdir(target_dir) 
                if f.endswith(('.mp4', '.mkv', '.ts')) and os.path.getmtime(os.path.join(target_dir, f)) >= state.get("start_time", 0) - 5
            ]
            if recent_files:
                recent_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
                output_path = recent_files[0]
                state["output_path"] = output_path
                state["filename"] = os.path.basename(output_path)
                state["title"] = os.path.splitext(os.path.basename(output_path))[0]
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
                run = run_download(
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
                item['status'] = 'completed' if job_current(run) else 'cancelled'
            except Exception as e:
                item['status'] = 'failed'
                item['error'] = str(e)
            time.sleep(1)
    finally:
        queue_worker_active = False

# --- JOB OPTIONS: limits in one place; a request outside them is refused with a one-line reason ---
DOWNLOAD_FORMATS = {"mp4", "mp3", "wav", "flac", "webm", "gif", "loop_mp4", "webp"}
CONVERT_FORMATS = {"gif", "loop_mp4", "webp", "mp3", "wav", "flac"}
TIME_RE = re.compile(r'^\d{1,2}(:\d{1,2}){0,2}(\.\d{1,3})?$')
SPEED_MIN, SPEED_MAX = 0.25, 4.0
CAPTION_MAX = 80
NAME_MAX = 180


class JobOptionError(ValueError):
    pass


def job_options(data, formats):
    """Checks a download / conversion request and returns the run_download / run_local_convert arguments."""
    def choice(key, allowed, default, label):
        value = data.get(key, default)
        if value not in allowed:
            raise JobOptionError(f"{label} must be one of: {', '.join(sorted(allowed))}")
        return value

    def flag(key, default, label):
        value = data.get(key, default)
        if not isinstance(value, bool):
            raise JobOptionError(f"{label} must be on or off")
        return value

    def clock(key, label):
        value = str(data.get(key) or '').strip()
        if value and not TIME_RE.match(value):
            raise JobOptionError(f"{label} time must look like 00:01:30")
        return value

    def text(key, limit, label):
        value = str(data.get(key) or '')
        if len(value) > limit:
            raise JobOptionError(f"{label} can be at most {limit} characters")
        return value

    try:
        speed = float(data.get('speed', '1.0'))
    except (TypeError, ValueError):
        raise JobOptionError("Speed must be a number")
    if not SPEED_MIN <= speed <= SPEED_MAX:
        raise JobOptionError(f"Speed must be between {SPEED_MIN}x and {SPEED_MAX}x")

    return {
        "fmt": choice('format', formats, 'mp4' if 'mp4' in formats else 'gif', "Format"),
        "quality": choice('quality', SETTING_CHOICES["quality"], 'Best', "Quality"),
        "custom_name": sanitize_filename(text('customName', NAME_MAX, "File name")),
        "playlist_mode": flag('playlistMode', False, "Playlist mode"),
        "start_time": clock('startTime', "Start"),
        "end_time": clock('endTime', "End"),
        "fps": choice('fps', SETTING_CHOICES["gifFps"], 'original', "Frame rate"),
        "scale": choice('scale', SETTING_CHOICES["gifScale"], 'original', "Resolution"),
        "dither": choice('dither', SETTING_CHOICES["gifDither"], 'bayer', "Dithering"),
        "boomerang": flag('boomerang', False, "Boomerang"),
        "crop": choice('crop', {"none"} | set(CROP_FILTERS), 'none', "Shape"),
        "speed": f"{speed:g}",
        "meme_top": text('memeTop', CAPTION_MAX, "Top caption"),
        "meme_bottom": text('memeBottom', CAPTION_MAX, "Bottom caption"),
        "max_file_size": choice('maxFileSize', SETTING_CHOICES["gifMaxFileSize"], 'none', "Size limit"),
        "sponsor_block": flag('sponsorBlock', False, "Skip sponsor segments"),
        "browser_cookies": choice('browserCookies', SETTING_CHOICES["browserCookies"], 'none', "Browser"),
        "embed_metadata": flag('embedMetadata', True, "Embed metadata"),
        "video_codec": choice('videoCodec', SETTING_CHOICES["videoCodec"], 'auto', "Video codec"),
        "turbo_mode": flag('turboMode', True, "Turbo downloads"),
        "split_chapters": flag('splitChapters', False, "Split into chapters"),
    }


def resolve_input_file(path):
    """A full path is used as is. A bare file name (the GIF studio's "From your downloads" list sends the
    history entry's name) is looked up in the download folder and its subfolders."""
    path = (path or '').strip()
    if not path:
        return None
    if os.path.isfile(path):
        return path
    if os.path.basename(path) != path:
        return None
    candidate = os.path.join(download_dir, path)
    if os.path.isfile(candidate):
        return candidate
    for root, _dirs, files in os.walk(download_dir):
        if path in files:
            return os.path.join(root, path)
    return None


@app.route('/api/download', methods=['POST'])
def api_download():
    data = request.get_json(silent=True) or {}
    url = str(data.get('url', '')).strip()
    if not url:
        return jsonify({"success": False, "error": "No URL provided"})
    if not is_valid_media_url(url):
        return jsonify({"success": False, "error": "Invalid URL"})
    try:
        opts = job_options(data, DOWNLOAD_FORMATS)
    except JobOptionError as e:
        return jsonify({"success": False, "error": str(e)})

    threading.Thread(target=run_download, kwargs=dict(opts, url=url), daemon=True).start()
    return jsonify({"success": True})

@app.route('/api/convert_local', methods=['POST'])
def api_convert_local():
    data = request.get_json(silent=True) or {}
    input_file = resolve_input_file(str(data.get('filePath', '')))
    if not input_file:
        return jsonify({"success": False, "error": "Input file does not exist"})
    try:
        opts = job_options(data, CONVERT_FORMATS)
    except JobOptionError as e:
        return jsonify({"success": False, "error": str(e)})

    keys = ("custom_name", "start_time", "end_time", "fps", "scale", "dither", "boomerang", "crop", "speed",
            "meme_top", "meme_bottom", "max_file_size")
    kwargs = {k: opts[k] for k in keys}
    threading.Thread(target=run_local_convert, kwargs=dict(kwargs, input_file=input_file, target_format=opts["fmt"]), daemon=True).start()
    return jsonify({"success": True})

# --- CORE PROCESS RUNNER ---
def run_process(cmd_list, on_line=None, run=None):
    """on_line sees every output line, including ones that later fall out of the 300-line app_logs window.
    With a run number, nothing starts once that run was stopped or replaced."""
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
            clean_line = line.strip()
            if clean_line:
                app_logs.append(clean_line)
                if len(app_logs) > 300:
                    app_logs.pop(0)
                if on_line:
                    on_line(clean_line)

        proc.wait()
        ret_code = proc.returncode
    except Exception as e:
        app_logs.append(f"CRITICAL ERROR: {str(e)}")
    finally:
        # only clear our own process: a newer job may already have registered its own
        if current_process is proc:
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

@background_job("Download")
def run_download(run, url, fmt, quality, custom_name, playlist_mode, start_time, end_time, fps="original", scale="original", dither="bayer",
                 boomerang=False, crop="none", speed="1.0", meme_top="", meme_bottom="", max_file_size="none",
                 sponsor_block=False, browser_cookies="none", embed_metadata=True, video_codec="auto",
                 turbo_mode=True, split_chapters=False):
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
        run_process(cmd, run=run)
        if not job_current(run):
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
            conv_ret = run_process(conv_cmd, run=run)
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
            conv_ret = run_process(conv_cmd, run=run)
        elif fmt == 'webp':
            app_logs.append("Rendering Animated 24-Bit WebP...")
            conv_cmd = [FFMPEG_EXE, "-y", "-i", temp_video] + webp_args(crop, fps, scale, final_output)
            conv_ret = run_process(conv_cmd, run=run)

        try:
            if os.path.exists(temp_video):
                os.remove(temp_video)
        except:
            pass

        if not job_current(run):
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
        ret = run_process(cmd, tracker.feed, run=run)
        if not job_current(run):
            return

        # Transparent Auto-Fallback if aria2c was blocked by host
        if ret != 0 and used_aria:
            app_logs.append("Turbo accelerator encountered server connection throttle. Automatically retrying with native downloader...")
            cmd_fallback = [c for c in cmd if c not in ("--downloader", ARIA2C_EXE, "--downloader-args", "aria2c:-x 16 -s 16 -k 1M -j 16")]
            ret = run_process(cmd_fallback, tracker.feed, run=run)
            if not job_current(run):
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

@background_job("Conversion")
def run_local_convert(run, input_file, target_format, custom_name, start_time, end_time, fps="original", scale="original", dither="bayer",
                      boomerang=False, crop="none", speed="1.0", meme_top="", meme_bottom="", max_file_size="none"):
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
    ret = run_process(cmd, run=run)
    if not job_current(run):
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
    for proc in (current_process, live_process):
        if proc:
            kill_process_tree(proc)


def start_flask():
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    app.run(host='0.0.0.0', port=54321, threaded=True)

if __name__ == '__main__':
    if not claim_single_instance():
        sys.exit(0)  # the running copy was asked to show its window
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
    stop_running_jobs()