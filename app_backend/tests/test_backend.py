"""Backend logic tests. Nothing here touches the real %APPDATA% data, the Downloads folder or the network:
paths point into a temp folder and downloads are faked.

Run from the repository root:  python -m unittest discover -s app_backend/tests -v
"""
import hashlib
import io
import json
import os
import shutil
import sys
import tempfile
import threading
import time
import types
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    import webview  # noqa: F401
except ImportError:  # the GUI library isn't needed for these tests
    sys.modules['webview'] = types.ModuleType('webview')
import backend as b  # noqa: E402


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def read_bytes(path):
    with open(path, 'rb') as f:
        return f.read()


class TempDataDir(unittest.TestCase):
    """Points every data path of the backend at a fresh temp folder."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.patches = [
            mock.patch.object(b, 'APPDATA_DIR', self.tmp),
            mock.patch.object(b, 'TOOLS_DIR', self.tmp),
            mock.patch.object(b, 'SETTINGS_FILE', os.path.join(self.tmp, 'settings.json')),
            mock.patch.object(b, 'HISTORY_FILE', os.path.join(self.tmp, 'history.json')),
            mock.patch.object(b, 'ERRORS_LOG', os.path.join(self.tmp, 'errors.log')),
            mock.patch.object(b, 'download_dir', os.path.join(self.tmp, 'dl')),
        ]
        for p in self.patches:
            p.start()
        os.makedirs(b.download_dir)
        b._pending_settings.clear()
        b.app_logs.clear()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        b._pending_settings.clear()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def errors_log(self):
        if not os.path.exists(b.ERRORS_LOG):
            return ''
        with open(b.ERRORS_LOG, encoding='utf-8') as f:
            return f.read()


# --- 1.7 settings and job options: limits in one place ---
class SettingsValidation(unittest.TestCase):
    def test_bad_values_and_unknown_keys_are_dropped(self):
        clean = b.sanitize_settings({
            "quality": "1080p", "videoCodec": "mpeg1", "turboMode": "yes", "splitChapters": False,
            "gifFps": 999, "browserCookies": "operagx", "downloadDir": "x" * 5000, "theme": "pink",
        })
        self.assertEqual(clean, {"quality": "1080p", "splitChapters": False, "browserCookies": "operagx"})

    def test_not_a_dict(self):
        self.assertEqual(b.sanitize_settings(["quality", "Best"]), {})


class JobOptions(unittest.TestCase):
    def test_defaults_are_valid(self):
        opts = b.job_options({}, b.DOWNLOAD_FORMATS)
        self.assertEqual((opts["fmt"], opts["quality"], opts["speed"], opts["crop"]), ("mp4", "Best", "1", "none"))

    def test_what_the_gif_studio_sends(self):
        opts = b.job_options({"format": "gif", "fps": "15", "scale": "480p", "dither": "sierra", "crop": "9:16_blur",
                              "speed": "1.5", "startTime": "00:00:05", "endTime": "1:30", "memeTop": "100% real",
                              "boomerang": True, "maxFileSize": "8M"}, b.DOWNLOAD_FORMATS)
        self.assertEqual((opts["fmt"], opts["speed"], opts["end_time"], opts["boomerang"]), ("gif", "1.5", "1:30", True))

    def test_refused_with_a_reason(self):
        cases = [
            ({"fps": "1000"}, "Frame rate"),
            ({"speed": "50"}, "Speed"),
            ({"speed": "fast"}, "Speed"),
            ({"startTime": "5 minutes"}, "Start time"),
            ({"memeTop": "x" * 500}, "Top caption"),
            ({"turboMode": "false"}, "Turbo"),
            ({"format": "exe"}, "Format"),
            ({"crop": "crop=iw:ih,drawtext=x"}, "Shape"),
        ]
        for data, words in cases:
            with self.subTest(data=data):
                with self.assertRaises(b.JobOptionError) as ctx:
                    b.job_options(data, b.DOWNLOAD_FORMATS)
                self.assertIn(words, str(ctx.exception))

    def test_convert_formats_exclude_downloads_only(self):
        with self.assertRaises(b.JobOptionError):
            b.job_options({"format": "webm"}, b.CONVERT_FORMATS)


# --- 1.2 saving that survives crashes, locked files and unreadable files ---
class Saving(TempDataDir):
    def test_missing_file_gives_default(self):
        self.assertEqual(b.read_json(b.SETTINGS_FILE, dict, {"d": 1}), {"d": 1})

    def test_corrupt_file_is_kept_aside_and_logged(self):
        with open(b.SETTINGS_FILE, 'w', encoding='utf-8') as f:
            f.write('{"quality": "720p"')  # cut off mid-write by an old version
        self.assertEqual(b.load_settings(), {})
        self.assertTrue(os.path.exists(b.SETTINGS_FILE + ".corrupt"))
        self.assertIn("damaged", self.errors_log())

    def test_locked_file_is_never_overwritten_with_defaults(self):
        b.write_json_atomic(b.SETTINGS_FILE, {"quality": "720p", "turboMode": False})
        real_open = open

        def locked_open(path, *a, **kw):
            if os.path.abspath(path) == os.path.abspath(b.SETTINGS_FILE):
                raise PermissionError(32, "being used by another process")
            return real_open(path, *a, **kw)

        with mock.patch('builtins.open', locked_open), mock.patch.object(b.time, 'sleep'):
            self.assertFalse(b.update_settings({"sponsorBlock": True}))  # kept in memory, not written
        self.assertEqual(load_json(b.SETTINGS_FILE), {"quality": "720p", "turboMode": False})
        self.assertIn("kept in memory", self.errors_log())
        # the next save that works carries the change that was waiting
        self.assertTrue(b.update_settings({"gifFps": "30"}))
        self.assertEqual(load_json(b.SETTINGS_FILE),
                         {"quality": "720p", "turboMode": False, "sponsorBlock": True, "gifFps": "30"})

    def test_brief_lock_on_replace_is_retried(self):
        real_replace = os.replace
        calls = {"n": 0}

        def flaky_replace(src, dst):
            calls["n"] += 1
            if calls["n"] < 3:
                raise PermissionError(5, "Access is denied")  # virus scanner holding the file
            return real_replace(src, dst)

        with mock.patch.object(b.os, 'replace', flaky_replace), mock.patch.object(b.time, 'sleep'):
            b.write_json_atomic(b.SETTINGS_FILE, {"quality": "480p"})
        self.assertEqual(load_json(b.SETTINGS_FILE), {"quality": "480p"})
        self.assertFalse(os.path.exists(b.SETTINGS_FILE + ".tmp"))

    def test_unreadable_history_is_not_replaced(self):
        b.write_json_atomic(b.HISTORY_FILE, [{"filename": "old.mp4", "date": "x", "type": "MP4"}])
        with mock.patch.object(b, 'read_json', side_effect=b.UnreadableFile("locked")):
            b.add_history_entry("new.mp4")
        self.assertEqual([h["filename"] for h in load_json(b.HISTORY_FILE)], ["old.mp4"])
        self.assertIn("History not updated", self.errors_log())

    def test_history_is_capped(self):
        for i in range(b.HISTORY_MAX + 5):
            b.add_history_entry(f"f{i}.mp4")
        hist = b.load_history()
        self.assertEqual(len(hist), b.HISTORY_MAX)
        self.assertEqual(hist[0]["filename"], f"f{b.HISTORY_MAX + 4}.mp4")


# --- 1.3 errors.log ---
class ErrorLog(TempDataDir):
    def test_keeps_the_newer_half_past_the_limit(self):
        with mock.patch.object(b, 'ERRORS_LOG_MAX', 2000):
            for i in range(200):
                b.log_error(f"error number {i:03d}")
            text = self.errors_log()
        self.assertLess(len(text.encode()), 2000 + 100)
        self.assertIn("error number 199", text)
        self.assertNotIn("error number 000", text)
        self.assertTrue(all(line.startswith("20") for line in text.splitlines()))  # no half lines


# --- 1.9 verify what we download ---
class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class VerifiedDownloads(TempDataDir):
    PAYLOAD = b"MZ pretend this is yt-dlp.exe" * 1000

    def fake_release(self, digest):
        release = {"assets": [{"name": "yt-dlp.exe", "browser_download_url": "https://example.invalid/yt-dlp.exe",
                               "digest": digest}]}

        def urlopen(req, timeout=None):
            url = req.full_url if hasattr(req, 'full_url') else req
            if "api.github.com" in url:
                return FakeResponse(json.dumps(release).encode())
            return FakeResponse(self.PAYLOAD)
        return urlopen

    def test_matching_hash_installs(self):
        good = "sha256:" + hashlib.sha256(self.PAYLOAD).hexdigest()
        dest = os.path.join(self.tmp, "yt-dlp.exe")
        with mock.patch.object(b.urllib.request, 'urlopen', self.fake_release(good)):
            b.download_verified("yt-dlp/yt-dlp", "yt-dlp.exe", dest)
        self.assertEqual(read_bytes(dest), self.PAYLOAD)
        self.assertFalse(os.path.exists(dest + ".part"))

    def test_wrong_hash_installs_nothing(self):
        dest = os.path.join(self.tmp, "yt-dlp.exe")
        with mock.patch.object(b.urllib.request, 'urlopen', self.fake_release("sha256:" + "0" * 64)):
            with self.assertRaises(RuntimeError) as ctx:
                b.download_verified("yt-dlp/yt-dlp", "yt-dlp.exe", dest)
        self.assertIn("SHA-256", str(ctx.exception))
        self.assertFalse(os.path.exists(dest))
        self.assertFalse(os.path.exists(dest + ".part"))

    def test_no_published_hash_installs_nothing(self):
        dest = os.path.join(self.tmp, "yt-dlp.exe")
        with mock.patch.object(b.urllib.request, 'urlopen', self.fake_release(None)):
            with self.assertRaises(RuntimeError):
                b.download_verified("yt-dlp/yt-dlp", "yt-dlp.exe", dest)
        self.assertFalse(os.path.exists(dest))

    def test_checksum_file_format(self):
        text = ("0f" * 32 + "  yt-dlp\n" + "ab" * 32 + "  yt-dlp.exe\n" + "cd" * 32 + " *ffmpeg.zip\n")
        self.assertEqual(b.parse_checksum_file(text, "yt-dlp.exe"), "ab" * 32)
        self.assertEqual(b.parse_checksum_file(text, "ffmpeg.zip"), "cd" * 32)
        self.assertIsNone(b.parse_checksum_file(text, "missing.exe"))


# --- 1.4 run numbers and clean-up that always runs ---
class Jobs(TempDataDir):
    def test_stopped_job_starts_nothing_more(self):
        run = b.next_job_run()
        b.next_job_run()  # Stop (or a newer job)
        with mock.patch.object(b.subprocess, 'Popen') as popen:
            self.assertEqual(b.run_process(["yt-dlp", "--version"], run=run), 1)
        popen.assert_not_called()

    def test_old_job_does_not_clear_the_new_jobs_process(self):
        newer = object()
        with mock.patch.object(b.subprocess, 'Popen') as popen:
            popen.return_value.stdout = iter(["line\n"])
            popen.return_value.returncode = 0

            def wait():
                b.current_process = newer  # a newer job registered its process meanwhile
            popen.return_value.wait.side_effect = wait
            b.run_process(["x"], run=b.next_job_run())
        self.assertIs(b.current_process, newer)
        b.current_process = None

    def test_crash_reaches_the_ui_and_errors_log(self):
        @b.background_job("Test job")
        def broken(run):
            raise KeyError("boom")
        broken()
        self.assertTrue(any(l.startswith("CRITICAL ERROR: Test job stopped unexpectedly") for l in b.app_logs))
        self.assertIn("KeyError", self.errors_log())

    def test_late_live_cleanup_leaves_the_new_recording_alone(self):
        old_state = {"is_recording": True, "output_path": "", "start_time": time.time()}
        new_state = {"is_recording": True, "output_path": "", "start_time": time.time()}
        new_proc = object()

        def old_recording(state, started, *args):
            started["proc"] = object()
            # meanwhile: user stopped it and started a new recording
            b.live_recording_state = new_state
            b.live_process = new_proc

        with mock.patch.object(b, '_record_live', old_recording):
            b.run_live_recorder(old_state, "https://example.invalid/live", self.tmp, "%(title)s.%(ext)s", "Best", False, "none")
        self.assertFalse(old_state["is_recording"])
        self.assertTrue(new_state["is_recording"])
        self.assertIs(b.live_process, new_proc)
        b.live_process = None

    def test_live_crash_never_leaves_rec_showing(self):
        state = {"is_recording": True, "output_path": "", "start_time": time.time()}
        with mock.patch.object(b, '_record_live', side_effect=OSError("disk full")):
            b.run_live_recorder(state, "https://example.invalid/live", self.tmp, "%(title)s.%(ext)s", "Best", False, "none")
        self.assertFalse(state["is_recording"])
        self.assertIn("disk full", self.errors_log())


# --- 1.1 single instance ---
@unittest.skipUnless(os.name == 'nt', "Windows only")
class SingleInstance(TempDataDir):
    def test_second_copy_hands_over_and_quits(self):
        shown = threading.Event()
        fake_window = mock.Mock()
        fake_window.restore.side_effect = lambda: shown.set()
        with mock.patch.object(b, 'window', fake_window), mock.patch.object(b, '_instance_handles', []):
            self.assertTrue(b.claim_single_instance(self.tmp))    # first copy
            self.assertFalse(b.claim_single_instance(self.tmp))   # second copy: asks the first to show itself
            self.assertTrue(shown.wait(5), "the first copy's window was not brought forward")
            other = os.path.join(self.tmp, "other-profile")
            self.assertTrue(b.claim_single_instance(other))       # a copy on its own data folder may run
            k32 = b._kernel32()
            for h in b._instance_handles:
                k32.CloseHandle(h)


# --- smaller pure functions ---
class PureFunctions(TempDataDir):
    def test_history_picks_resolve_to_the_download_folder(self):
        sub = os.path.join(b.download_dir, "Album")
        os.makedirs(sub)
        with open(os.path.join(sub, "clip.mp4"), 'w'):
            pass
        self.assertEqual(b.resolve_input_file("clip.mp4"), os.path.join(sub, "clip.mp4"))
        self.assertIsNone(b.resolve_input_file("..\\..\\clip.mp4"))
        self.assertIsNone(b.resolve_input_file("missing.mp4"))

    def test_output_tracker_records_final_files(self):
        t = b.OutputFileTracker()
        for line in ['[download] Destination: C:\\d\\Song.webm', '[ExtractAudio] Destination: C:\\d\\Song.mp3',
                     '[download] Destination: C:\\d\\Clip.f137.mp4', '[Merger] Merging formats into "C:\\d\\Clip.mp4"']:
            t.feed(line)
        self.assertEqual(t.files(), ["Song.mp3", "Clip.mp4"])

    def test_cookie_merge_keeps_other_domains(self):
        stored = "# Netscape HTTP Cookie File\n.twitch.tv\tTRUE\t/\tTRUE\t0\tauth-token\tT\n"
        incoming = ".youtube.com\tTRUE\t/\tTRUE\t0\tSID\tY\n"
        merged = b.merge_cookie_jars(stored, incoming)
        self.assertIn("auth-token", merged)
        self.assertIn("SID", merged)

    def test_versions(self):
        self.assertTrue(b.is_newer_version("2026.11.23", "2026.08.19"))
        self.assertFalse(b.is_newer_version("v1.1.0", "v1.1.0-dev"))
        self.assertTrue(b.is_newer_version("v1.2.0", "v1.1.0-dev"))


if __name__ == '__main__':
    unittest.main()
