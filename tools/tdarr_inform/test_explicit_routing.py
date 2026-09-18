import importlib.util
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch


# Avoid enabling the startup hook in the test runner's Python environment.
spec = importlib.util.spec_from_file_location(
    "routing_under_test", Path(__file__).with_name("explicit_routing.py")
)
routing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(routing)


class RoutingTests(unittest.TestCase):
    routes = [
        ("/data/media/movies", "/mnt/media/movies", "movies-test"),
        ("/data/media/tv", "/mnt/media/tv", "tv-test"),
    ]

    def test_routes_empty_libraries_without_database_queries(self):
        self.assertEqual(
            routing.route_paths([
                "/data/media/movies/films/Example Movie/Example.mkv",
                "/data/media/tv/tv shows/Example/Season 01/Episode.mkv",
            ], self.routes),
            {
                "movies-test": ["/mnt/media/movies/films/Example Movie/Example.mkv"],
                "tv-test": ["/mnt/media/tv/tv shows/Example/Season 01/Episode.mkv"],
            },
        )

    def test_deduplicates_and_preserves_case_spaces_and_unicode(self):
        path = "/data/media/tv/Show \u00f1/Season 01/Episode.MKV"
        self.assertEqual(
            routing.route_paths([path, path], self.routes),
            {"tv-test": ["/mnt/media/tv/Show \u00f1/Season 01/Episode.MKV"]},
        )

    def test_deleted_and_renamed_paths_do_not_need_to_exist(self):
        self.assertEqual(len(routing.route_paths([
            "/data/media/movies/Example/old.mkv",
            "/data/media/movies/Example/new.mkv",
        ], self.routes)["movies-test"]), 2)

    def test_rejects_unmapped_traversal_and_whole_library_paths(self):
        for path in [
            "/data/media/movies", "/data/media/movies/", "/data/media/tv",
            "/data/media/movies-other/Example.mkv", "/data/media/books/book.mkv",
            "/data/media/movies/../tv/Example.mkv", "relative.mkv",
            "//data/media/movies/Example.mkv", None, "/data/media/movies/\x00.mkv",
        ]:
            with self.subTest(path=path), self.assertRaises(ValueError):
                routing.route_paths([path], self.routes)

    def test_more_specific_route_wins(self):
        routes = sorted(self.routes + [
            ("/data/media/movies/special", "/mnt/special", "special-test")
        ], key=lambda route: len(route[0]), reverse=True)
        self.assertEqual(
            routing.route_paths(["/data/media/movies/special/movie.mkv"], routes),
            {"special-test": ["/mnt/special/movie.mkv"]},
        )

    def test_invalid_and_missing_configuration_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "routes.json"
            with self.assertRaises(OSError):
                routing.load_routes(path)
            for document in [None, {}, {"routes": []}, {"routes": [None]},
                             {"routes": [{"source": "/", "target": "/tmp", "library_id": "x"}]},
                             {"routes": [{"source": "/media", "target": "/tmp", "library_id": ""}]}]:
                path.write_text(json.dumps(document), encoding="utf-8")
                with self.subTest(document=document), self.assertRaises(ValueError):
                    routing.load_routes(path)

    def test_startup_override_replaces_only_library_lookup(self):
        class FakeTdarr:
            event_uuid = "test-event"
            logger = logging.getLogger("routing-test")

            def get_inform_dict(self, paths):
                raise AssertionError("Old database lookup must not run")

            def inform(self, routes):
                return routes

        module = types.ModuleType("Tdarr_Inform.tdarr")
        module.Tdarr = FakeTdarr
        original_inform = FakeTdarr.inform
        with patch.dict(sys.modules, {"Tdarr_Inform.tdarr": module}):
            routing.install()
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "routes.json"
            path.write_text(json.dumps({"routes": [
                {"source": source, "target": target, "library_id": library_id}
                for source, target, library_id in self.routes
            ]}), encoding="utf-8")
            with patch.dict(os.environ, {"TDARR_INFORM_ROUTES_FILE": str(path)}):
                self.assertEqual(
                    FakeTdarr().get_inform_dict(["/data/media/movies/Example.mkv"]),
                    {"movies-test": ["/mnt/media/movies/Example.mkv"]},
                )
        self.assertIs(FakeTdarr.inform, original_inform)

    def test_python_startup_installs_override_and_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            package = Path(folder) / "Tdarr_Inform"
            package.mkdir()
            (package / "__init__.py").write_text("", encoding="utf-8")
            (package / "tdarr.py").write_text(
                "class Tdarr:\n    pass\n", encoding="utf-8"
            )
            environment = dict(os.environ, PYTHONPATH=os.pathsep.join([
                str(Path(__file__).parent), folder
            ]))
            result = subprocess.run([
                sys.executable, "-c",
                "from Tdarr_Inform.tdarr import Tdarr; "
                "assert callable(Tdarr.get_inform_dict)",
            ], env=environment, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("Explicit library routing enabled", result.stderr)

            (package / "tdarr.py").write_text(
                "raise RuntimeError('Incompatible upstream module')\n", encoding="utf-8"
            )
            result = subprocess.run([
                sys.executable, "-c", "raise AssertionError('Must not start')",
            ], env=environment, capture_output=True, text=True)
            self.assertEqual(result.returncode, 78, result.stderr)
            self.assertIn("Startup failed", result.stderr)


if __name__ == "__main__":
    unittest.main()
