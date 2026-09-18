"""Optional Radarr filename tagging. Maintained by Freohrskulblaka."""

import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, url):
        return None


def load_settings(path):
    settings = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(settings, dict):
        raise ValueError("Filename tag settings must be an object")
    if settings.get("enabled") is False:
        return None
    for field in ("url", "api_key", "match_text", "tag_label"):
        if not isinstance(settings.get(field), str) or not settings[field].strip():
            raise ValueError("Filename tagging requires a nonempty " + field)
    url = urlsplit(settings["url"])
    if (url.scheme not in ("http", "https") or not url.hostname
            or url.username or url.password or url.query or url.fragment):
        raise ValueError("Use a plain Radarr base URL without embedded credentials")
    interval = settings.get("interval_seconds", 1800)
    if type(interval) is not int or not 30 <= interval <= 86400:
        raise ValueError("Tagging interval must be 30 to 86400 seconds")
    settings["interval_seconds"] = interval
    return settings


def api_request(settings, resource, method="GET", payload=None):
    request = Request(
        settings["url"].rstrip("/") + "/api/v3/" + resource,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers={"X-Api-Key": settings["api_key"], "Content-Type": "application/json"},
        method=method,
    )
    # Do not forward the API key to an unexpected redirect destination.
    with build_opener(NoRedirects()).open(request, timeout=20) as response:
        body = response.read()
    return json.loads(body) if body else None


def sync_tags(settings, request=api_request):
    movies = request(settings, "movie")
    needle = settings["match_text"].casefold()
    matches = []
    for movie in movies:
        movie_file = movie.get("movieFile") or {}
        filename = movie_file.get("relativePath") or movie_file.get("path") or ""
        filename = filename.replace("\\", "/").rsplit("/", 1)[-1]
        if needle in filename.casefold():
            matches.append(movie)
    if not matches:
        return 0
    tags = request(settings, "tag")
    tag = next((tag for tag in tags
                if tag["label"].casefold() == settings["tag_label"].casefold()), None)
    if tag is None:
        tag = request(settings, "tag", "POST", {"label": settings["tag_label"]})
    ids = [movie["id"] for movie in matches if tag["id"] not in (movie.get("tags") or [])]
    if ids:
        # Add only the requested tag, preserving tags and all other movie settings.
        request(settings, "movie/editor", "PUT", {
            "movieIds": ids, "tags": [tag["id"]], "applyTags": "add",
        })
    return len(ids)


def install():
    config_path = Path(os.environ.get(
        "RADARR_FILENAME_TAGS_FILE", "/config/radarr_filename_tags.json"
    ))
    if not config_path.exists():
        return
    from Tdarr_Inform.scheduler import Scheduler

    original_startup = Scheduler.startup_tasks

    def startup_tasks(self):
        result = original_startup(self)
        try:
            settings = load_settings(config_path)
        except (OSError, ValueError):
            self.logger.error("Radarr filename tagging disabled: invalid configuration")
            return result
        if settings is None:
            return result

        def update_filename_tags():
            try:
                current = load_settings(config_path)
                if current is None:
                    return
                count = sync_tags(current)
                if count:
                    self.logger.info("Radarr filename tagging: added tag to %s movie(s)", count)
            except Exception as error:
                # Network errors can contain URLs or credentials; log only their type.
                self.logger.warning("Radarr filename tagging failed (%s); will retry",
                                    type(error).__name__)

        job_name = "Radarr filename tags"
        self.remove(job_name)
        self.schedule.every(settings["interval_seconds"]).seconds.do(
            update_filename_tags
        ).tag(job_name)
        self.logger.info("Radarr filename tagging enabled; interval %s seconds",
                         settings["interval_seconds"])
        update_filename_tags()
        return result

    Scheduler.startup_tasks = startup_tasks
