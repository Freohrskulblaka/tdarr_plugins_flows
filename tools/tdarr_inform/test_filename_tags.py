import importlib.util
import json
import logging
import os
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import Mock, patch


spec = importlib.util.spec_from_file_location(
    "filename_tags_under_test", Path(__file__).with_name("filename_tags.py")
)
tagging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tagging)


class FilenameTagTests(unittest.TestCase):
    settings = {
        "url": "http://radarr:7878", "api_key": "fixture-only",
        "match_text": "MyGroup", "tag_label": "optimized", "interval_seconds": 1800,
    }

    def test_matches_filename_without_brackets_and_preserves_existing_tags(self):
        movies = [
            {"id": 1, "tags": [7], "movieFile": {"relativePath": "Movie - myGROUP.mkv"}},
            {"id": 2, "tags": [], "movieFile": {"relativePath": "Movie [MyGroup].mkv"}},
            {"id": 3, "tags": [2], "movieFile": {"relativePath": "Movie MyGroup.mkv"}},
            {"id": 4, "tags": [], "movieFile": {"relativePath": "MyGroup/Movie.mkv"}},
            {"id": 5, "tags": [], "movieFile": None},
        ]
        request = Mock(side_effect=[movies, [{"id": 2, "label": "optimized"}], None])
        self.assertEqual(tagging.sync_tags(self.settings, request), 2)
        request.assert_called_with(self.settings, "movie/editor", "PUT", {
            "movieIds": [1, 2], "tags": [2], "applyTags": "add",
        })
        self.assertEqual(movies[0]["tags"], [7])

    def test_already_tagged_movies_are_not_rewritten(self):
        request = Mock(side_effect=[[
            {"id": 1, "tags": [2], "movieFile": {"relativePath": "MyGroup.mkv"}},
        ], [{"id": 2, "label": "OPTIMIZED"}]])
        self.assertEqual(tagging.sync_tags(self.settings, request), 0)
        self.assertEqual(request.call_count, 2)

    def test_no_matches_do_not_create_tags(self):
        request = Mock(return_value=[{"id": 1, "movieFile": {"relativePath": "Other.mkv"}}])
        self.assertEqual(tagging.sync_tags(self.settings, request), 0)
        self.assertEqual(request.call_count, 1)

    def test_missing_tag_is_created_and_absolute_windows_paths_match(self):
        request = Mock(side_effect=[[
            {"id": 1, "tags": [], "movieFile": {"path": "C:\\Movies\\MyGroup.mkv"}},
        ], [], {"id": 2, "label": "optimized"}, None])
        self.assertEqual(tagging.sync_tags(self.settings, request), 1)
        self.assertEqual(request.call_args_list[2].args,
                         (self.settings, "tag", "POST", {"label": "optimized"}))

    def test_settings_validate_and_can_disable_without_credentials(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "tags.json"
            path.write_text(json.dumps(self.settings), encoding="utf-8")
            self.assertEqual(tagging.load_settings(path), self.settings)
            without_interval = dict(self.settings)
            without_interval.pop("interval_seconds")
            path.write_text(json.dumps(without_interval), encoding="utf-8")
            self.assertEqual(tagging.load_settings(path)["interval_seconds"], 1800)
            for change in [{"match_text": ""}, {"api_key": ""}, {"interval_seconds": 1},
                           {"interval_seconds": True}, {"url": "http://user:secret@host"},
                           {"url": "http://host?api_key=secret"}]:
                path.write_text(json.dumps(dict(self.settings, **change)), encoding="utf-8")
                with self.subTest(change=change), self.assertRaises(ValueError):
                    tagging.load_settings(path)
            path.write_text('{"enabled": false}', encoding="utf-8")
            self.assertIsNone(tagging.load_settings(path))

    def test_requests_use_header_credentials_timeout_and_additive_payload(self):
        response = Mock()
        response.read.return_value = b'[]'
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        with patch.object(tagging, "build_opener") as opener:
            opener.return_value.open.return_value = response
            self.assertEqual(tagging.api_request(self.settings, "movie"), [])
            request = opener.return_value.open.call_args.args[0]
            self.assertEqual(request.full_url, "http://radarr:7878/api/v3/movie")
            self.assertNotIn("fixture-only", request.full_url)
            self.assertEqual(request.get_header("X-api-key"), "fixture-only")
            self.assertEqual(opener.return_value.open.call_args.kwargs, {"timeout": 20})
        self.assertIsNone(tagging.NoRedirects().redirect_request(None, None, 302, "", {}, ""))

    def test_scheduler_retains_startup_and_recovers_without_logging_secrets(self):
        class FakeScheduler:
            def __init__(self):
                self.logger = logging.getLogger("tagging-test")
                self.schedule = Mock()
                self.remove = Mock()

            def startup_tasks(self):
                return "original-startup"

        module = types.ModuleType("Tdarr_Inform.scheduler")
        module.Scheduler = FakeScheduler
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "tags.json"
            path.write_text(json.dumps(self.settings), encoding="utf-8")
            with patch.dict(os.environ, {"RADARR_FILENAME_TAGS_FILE": str(path)}), \
                    patch.dict("sys.modules", {"Tdarr_Inform.scheduler": module}):
                tagging.install()
            scheduler = FakeScheduler()
            with patch.object(tagging, "sync_tags", return_value=1):
                self.assertEqual(scheduler.startup_tasks(), "original-startup")
            scheduler.remove.assert_called_once_with("Radarr filename tags")
            scheduler.schedule.every.assert_called_once_with(1800)
            callback = scheduler.schedule.every.return_value.seconds.do.call_args.args[0]
            with patch.object(tagging, "sync_tags", side_effect=RuntimeError("private-secret")), \
                    self.assertLogs("tagging-test", level="WARNING") as logs:
                callback()
            self.assertNotIn("private-secret", " ".join(logs.output))
            with patch.object(tagging, "sync_tags", return_value=0) as sync:
                callback()
                sync.assert_called_once()
            path.write_text('{"enabled": false}', encoding="utf-8")
            with patch.object(tagging, "sync_tags") as sync:
                callback()
                sync.assert_not_called()


if __name__ == "__main__":
    unittest.main()
