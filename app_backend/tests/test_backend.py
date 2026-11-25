"""Backend logic tests. Nothing here touches the real %APPDATA% data, the Downloads folder or the network:
every path points into a temp folder and yt-dlp is replaced by a fake.

Run from the repository root:  python -m unittest discover -s app_backend/tests -v
"""
import json
import os
import shutil
import sys
import tempfile
import threading
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


class TempDataDir(unittest.TestCase):
    """Points every data path of the backend at a fresh temp folder."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        j = lambda name: os.path.join(self.tmp, name)  # noqa: E731
        self.patches = [
            mock.patch.object(b, 'APPDATA_DIR', self.tmp),
            mock.patch.object(b, 'TOOLS_DIR', self.tmp),
            mock.patch.object(b, 'SETTINGS_FILE', j('settings.json')),
            mock.patch.object(b, 'HISTORY_FILE', j('history.json')),
            mock.patch.object(b, 'ERRORS_LOG', j('errors.log')),
            mock.patch.object(b, 'COOKIES_NEW', j('youtube.com_cookies.txt')),
            mock.patch.object(b, 'COOKIES_STORED', j('cookies.txt')),
            mock.patch.object(b, 'ARIA2C_EXE', j('aria2c.exe')),
            mock.patch.object(b, 'download_dir', j('dl')),
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


# --- 1.7 settings and download requests: limits in one place ---
class Limits(unittest.TestCase):
    def test_bad_settings_are_dropped(self):
        self.assertEqual(b.sanitize_settings({"quality": "8K", "playlistMode": "yes", "theme": "pink"}), {})
        self.assertEqual(b.sanitize_settings({"quality": "720p", "playlistMode": True}), {"quality": "720p", "playlistMode": True})
        self.assertEqual(b.sanitize_settings(["quality"]), {})

    def test_valid_download_request(self):
        opts = b.job_options({"url": " https://youtu.be/x ", "format": "mp3", "quality": "720p", "customName": 'My: "mix"?'})
        self.assertEqual(opts, {"url": "https://youtu.be/x", "fmt": "mp3", "quality": "720p", "custom_name": "My mix", "playlist_mode": False})

    def test_refused_with_a_reason(self):
        cases = [
            ({}, "No URL"),
            ({"url": "--exec calc"}, "Invalid URL"),
            ({"url": "https://x", "format": "exe"}, "Format"),
            ({"url": "https://x", "quality": "8K"}, "Quality"),
            ({"url": "https://x", "playlistMode": "true"}, "Playlist"),
            ({"url": "https://x", "customName": "x" * 500}, "File name"),
        ]
        for data, words in cases:
            with self.subTest(data=data):
                with self.assertRaises(b.JobOptionError) as ctx:
                    b.job_options(data)
                self.assertIn(words, str(ctx.exception))

    def test_api_refuses_bad_requests(self):
        c = b.app.test_client()
        self.assertEqual(c.post('/api/download', json={"url": "--exec calc"}).get_json(), {"success": False, "error": "Invalid URL"})


# --- 1.2 saving that survives crashes, locked files and unreadable files ---
class Saving(TempDataDir):
    def test_corrupt_file_is_kept_aside_and_logged(self):
        with open(b.SETTINGS_FILE, 'w', encoding='utf-8') as f:
            f.write('{"quality": "720p"')
        self.assertEqual(b.load_settings(), {})
        self.assertTrue(os.path.exists(b.SETTINGS_FILE + ".corrupt"))
        self.assertIn("damaged", self.errors_log())

    def test_locked_file_is_never_overwritten_with_defaults(self):
        b.write_json_atomic(b.SETTINGS_FILE, {"quality": "720p"})
        real_open = open

        def locked_open(path, *a, **kw):
            if os.path.abspath(path) == os.path.abspath(b.SETTINGS_FILE):
                raise PermissionError(32, "being used by another process")
            return real_open(path, *a, **kw)

        with mock.patch('builtins.open', locked_open), mock.patch.object(b.time, 'sleep'):
            self.assertFalse(b.update_settings({"playlistMode": True}))
        self.assertEqual(load_json(b.SETTINGS_FILE), {"quality": "720p"})
        self.assertIn("kept in memory", self.errors_log())
        self.assertTrue(b.update_settings({"quality": "480p"}))
        self.assertEqual(load_json(b.SETTINGS_FILE), {"quality": "480p", "playlistMode": True})

    def test_brief_lock_on_replace_is_retried(self):
        real_replace = os.replace
        calls = {"n": 0}

        def flaky_replace(src, dst):
            calls["n"] += 1
            if calls["n"] < 3:
                raise PermissionError(5, "Access is denied")
            return real_replace(src, dst)

        with mock.patch.object(b.os, 'replace', flaky_replace), mock.patch.object(b.time, 'sleep'):
            b.write_json_atomic(b.SETTINGS_FILE, {"quality": "480p"})
        self.assertEqual(load_json(b.SETTINGS_FILE), {"quality": "480p"})
        self.assertFalse(os.path.exists(b.SETTINGS_FILE + ".tmp"))

    def test_unreadable_history_is_not_replaced(self):
        b.write_json_atomic(b.HISTORY_FILE, [{"filename": "old.mp4", "date": "x"}])
        with mock.patch.object(b, 'read_json', side_effect=b.UnreadableFile("locked")):
            b.add_history_entries(["new.mp4"])
        self.assertEqual([h["filename"] for h in load_json(b.HISTORY_FILE)], ["old.mp4"])
        self.assertIn("History not updated", self.errors_log())

    def test_history_is_capped_and_deduplicated(self):
        b.add_history_entries([f"f{i}.mp4" for i in range(15)] + ["f3.mp4"])
        hist = b.load_history()
        self.assertEqual(len(hist), b.HISTORY_MAX)
        self.assertEqual(len({h["filename"] for h in hist}), b.HISTORY_MAX)


# --- 1.3 errors.log ---
class ErrorLog(TempDataDir):
    def test_keeps_the_newer_half_past_the_limit(self):
        with mock.patch.object(b, 'ERRORS_LOG_MAX', 2000):
            for i in range(200):
                b.log_error(f"error number {i:03d}")
            text = self.errors_log()
        self.assertIn("error number 199", text)
        self.assertNotIn("error number 000", text)
        self.assertTrue(all(line.startswith("20") for line in text.splitlines()))


# --- 1.4 run numbers and clean-up that always runs ---
class Jobs(TempDataDir):
    def test_stop_does_not_restart_the_download_or_report_success(self):
        open(b.ARIA2C_EXE, 'w').close()  # turbo on: a failed first try would normally retry without aria2c
        calls = []

        def fake_run(cmd, run=None):
            calls.append(cmd)
            b.next_job_run()  # the user presses Stop while yt-dlp runs
            return 1          # ... which makes yt-dlp exit with an error

        with mock.patch.object(b, 'run_process', fake_run), mock.patch.object(b.time, 'sleep'):
            b.run_download(url="https://x", fmt="mp4", quality="Best", custom_name="", playlist_mode=False)
        self.assertEqual(len(calls), 1, "the aria2c fallback restarted a stopped download")
        self.assertFalse(any("Process Finished Successfully!" in l for l in b.app_logs))

    def test_failed_download_says_so(self):
        with mock.patch.object(b, 'run_process', return_value=1), mock.patch.object(b.time, 'sleep'):
            b.run_download(url="https://x", fmt="mp3", quality="Best", custom_name="", playlist_mode=False)
        self.assertTrue(any(l.startswith("CRITICAL ERROR:") for l in b.app_logs))
        self.assertFalse(any("Process Finished Successfully!" in l for l in b.app_logs))

    def test_stopped_job_starts_nothing_more(self):
        run = b.next_job_run()
        b.next_job_run()
        with mock.patch.object(b.subprocess, 'Popen') as popen:
            self.assertEqual(b.run_process(["yt-dlp"], run=run), 1)
        popen.assert_not_called()

    def test_old_job_does_not_clear_the_new_jobs_process(self):
        newer = object()
        with mock.patch.object(b.subprocess, 'Popen') as popen:
            popen.return_value.stdout = iter(["line\n"])
            popen.return_value.returncode = 0

            def wait():
                b.current_process = newer
            popen.return_value.wait.side_effect = wait
            b.run_process(["x"], run=b.next_job_run())
        self.assertIs(b.current_process, newer)
        b.current_process = None

    def test_crash_reaches_the_ui_and_errors_log(self):
        with mock.patch.object(b, 'check_cookies', side_effect=KeyError("boom")):
            b.run_download(url="https://x", fmt="mp4", quality="Best", custom_name="", playlist_mode=False)
        self.assertTrue(any(l.startswith("CRITICAL ERROR: Download stopped unexpectedly") for l in b.app_logs))
        self.assertIn("KeyError", self.errors_log())


# --- 1.1 single instance ---
@unittest.skipUnless(os.name == 'nt', "Windows only")
class SingleInstance(TempDataDir):
    def test_second_copy_hands_over_and_quits(self):
        shown = threading.Event()
        fake_window = mock.Mock()
        fake_window.restore.side_effect = lambda: shown.set()
        with mock.patch.object(b, 'window', fake_window), mock.patch.object(b, '_instance_handles', []):
            self.assertTrue(b.claim_single_instance(self.tmp))
            self.assertFalse(b.claim_single_instance(self.tmp))
            self.assertTrue(shown.wait(5), "the first copy's window was not brought forward")
            self.assertTrue(b.claim_single_instance(os.path.join(self.tmp, "other-profile")))
            k32 = b._kernel32()
            for h in b._instance_handles:
                k32.CloseHandle(h)


class Versions(unittest.TestCase):
    def test_versions(self):
        self.assertTrue(b.is_newer_version("2026.11.23", "2026.08.19"))
        self.assertFalse(b.is_newer_version("v1.0.5", "v1.0.5"))
        self.assertTrue(b.is_newer_version("v1.1.0", "v1.0.5"))


if __name__ == '__main__':
    unittest.main()
