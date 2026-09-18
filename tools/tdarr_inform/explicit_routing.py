"""Explicit library routing for Tdarr Inform. Maintained by Freohrskulblaka."""

import json
import os
from pathlib import Path, PurePosixPath


def normalized_path(value):
    if not isinstance(value, str) or not value.startswith("/") or "\x00" in value:
        raise ValueError("Routing requires an absolute Linux path")
    path = PurePosixPath(value)
    if ".." in path.parts or value.startswith("//"):
        raise ValueError("Routing rejects traversal and network paths")
    return str(path)


def load_routes(config_path):
    document = json.loads(Path(config_path).read_text(encoding="utf-8"))
    routes = document.get("routes") if isinstance(document, dict) else None
    if not isinstance(routes, list) or not routes:
        raise ValueError("Configure at least one explicit library route")

    result = []
    sources = set()
    for route in routes:
        if not isinstance(route, dict):
            raise ValueError("Each library route must be an object")
        source = normalized_path(route.get("source"))
        target = normalized_path(route.get("target"))
        library_id = route.get("library_id")
        if source == "/" or target == "/" or source in sources:
            raise ValueError("Routes require unique, non-root source paths")
        if not isinstance(library_id, str) or not library_id.strip():
            raise ValueError("Each route requires a Tdarr library ID")
        sources.add(source)
        result.append((source, target, library_id))

    # A more specific route takes precedence over its parent.
    return sorted(result, key=lambda route: len(route[0]), reverse=True)


def route_paths(file_paths, routes):
    if not isinstance(file_paths, (list, tuple)) or not file_paths:
        raise ValueError("Provide at least one event path")
    routed = {}
    for value in file_paths:
        path = normalized_path(value)
        for source, target, library_id in routes:
            if path == source:
                raise ValueError("Whole-library scans are not allowed")
            if path.startswith(source + "/"):
                translated = target + path[len(source):]
                paths = routed.setdefault(library_id, [])
                if translated not in paths:
                    paths.append(translated)
                break
        else:
            raise ValueError("Event path is outside the configured libraries")
    return routed


def install():
    from Tdarr_Inform.tdarr import Tdarr

    def get_inform_dict(self, file_paths):
        config_path = os.environ.get(
            "TDARR_INFORM_ROUTES_FILE", "/config/library_routes.json"
        )
        try:
            routed = route_paths(file_paths, load_routes(config_path))
        except (OSError, ValueError) as error:
            self.logger.error("Explicit library routing rejected event: %s", error)
            raise
        self.logger.info(
            "[%s] Explicit routing: %s path(s), %s library/libraries",
            self.event_uuid,
            sum(len(paths) for paths in routed.values()),
            len(routed),
        )
        return routed

    Tdarr.get_inform_dict = get_inform_dict
