# Explicit Tdarr Inform Routing

Maintained by Freohrskulblaka. This optional integration is separate from Media
Optimizer and does not modify Tdarr plugins or their processing behavior.

Tdarr Inform's upstream library lookup searches already-indexed files. Empty
libraries therefore cannot reliably bootstrap, and different container paths
cannot be translated. This startup override replaces only that library lookup
with an explicit source-root, destination-root, and library-ID mapping. Upstream
webhook handling and targeted `scan-files` requests remain in use.

## Installation

1. Use the existing `ghcr.io/deathbybandaid/tdarr_inform` container.
2. Copy `sitecustomize.py`, `explicit_routing.py`, and `filename_tags.py` into the
   persistent config directory under `overrides/`.
3. Copy `library_routes.example.json` to `library_routes.json` in that config
   directory. Set the real source paths, Tdarr paths, and Tdarr library IDs.
   The ID is visible in the library page URL. Keep runtime configuration private.
4. Add the container environment variable `PYTHONPATH=/config/overrides:/app`.
   Preserve existing Python search paths if the container already defines it.
5. Recreate only Tdarr Inform to enable the startup hook. Look for
   `[tdarr-inform-routing] Explicit library routing enabled` in its logs.

Routes are loaded for every event, so editing the route JSON does not require a
restart. Deleted paths are allowed: Tdarr needs notification about files that no
longer exist. Unmapped paths, traversal, and source-root-only scan requests are
rejected. There is no fallback to recursive database lookup or a library scan.
When libraries are recreated, update their IDs before enabling import events.

Configure Radarr and Sonarr webhooks to POST to the notifier's `/api/events`
endpoint for import, upgrade, rename, and supported deletion events. Disable
grab, application-update, add-to-library, and Sonarr import-complete events.
Keep Tdarr startup, hourly, and folder-watch scans disabled for import-only use.
Enable Process Library and the desired processing types for each receiving
library. These processing switches do not initiate a whole-library scan.

The webhook Test button checks notifier connectivity, not actual routing to
Tdarr. Validate a targeted event separately and confirm the intended library and
translated path. Do not run a whole-library scan to test this integration.

## Rollback

Remove the added `PYTHONPATH` value and recreate Tdarr Inform. The original image
and its code are unchanged. The route JSON and override files can remain on disk.
Avoid using the upstream routing for mismatched paths or empty libraries.

## Validation

Run from the repository root, without adding the override directory to Python's
startup path:

```powershell
python -S tools/tdarr_inform/test_explicit_routing.py
```

Deployment validation on 2026-09-18 passed all eight local tests. Synthetic
Radarr and Sonarr import events for nonexistent files reached their explicitly
configured libraries; Tdarr completed both targeted scans with no queued files
or job history added. A real import from each application remains the final
end-to-end validation step. Rename and deletion handling were not live-tested.

## Optional Radarr Filename Tags

Radarr's native auto-tag conditions do not match filenames. The optional
`filename_tags.py` integration uses Tdarr Inform's existing scheduler to check
Radarr's indexed movie filenames, without scanning media folders, refreshing
movies, or requesting any transcodes. It is disabled when its config is absent.

Copy `radarr_filename_tags.example.json` to `/config/radarr_filename_tags.json`,
set the private connection details and filename substring, and set `enabled` to
`true`. Use the Radarr base URL, including any URL base but not `/api/v3`.
Restart only Tdarr Inform after deploying the updated startup hook. The job is
visible as `Radarr filename tags` in the notifier scheduler and runs at startup
and every 120 seconds by default.

Matching is case-insensitive and checks only the filename, not the folder name;
brackets are not required. The requested tag is created if absent and added only
to matching movies missing it. Existing tags, monitoring, quality profiles, and
files are untouched. Tags are not removed when a filename later stops matching.
A renamed file becomes eligible once Radarr's database reflects the new name.
This integration does not assign release groups or change filenames.

The config is reloaded for each job. Set `enabled` to `false` to stop tagging;
restart to change the interval. Failed checks log only the error type and retry
on the next interval; credentials and response bodies are not logged. Keep the
real config outside Git. The API key is sent in a header, with redirects blocked.

```powershell
python -S tools/tdarr_inform/test_filename_tags.py
```

Live validation confirmed that the startup check added the requested tag to a
matching movie without changing its filename, existing tags, monitoring, quality
profile, or other library settings.
