# Media Optimizer Changelog

History of `../classic_plugins/media_optimizer/tdarr_plugin_media_optimizer.js` and the supporting `../classic_plugins/media_optimizer/media_optimizer/` libraries used by the classic Tdarr Media Optimizer plugin.

---

## 2026-08-05 - Freohrskulblaka

### Escaped tooltip line breaks for Tdarr rendering

Changed tooltip line break markers from single escaped newlines to double
escaped `\\n` sequences in the JavaScript source so Tdarr receives the literal
line break markers its tooltip renderer expects.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-38`.

### Restored plugin description to a regular string

Changed the classic plugin metadata description back to a regular quoted
string after confirming Tdarr sanitizes multiline description formatting and
handles wrapping on its own. Detailed multiline guidance remains in the input
tooltips.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-37`.

### Added option-by-option tooltip details

Expanded every classic plugin input tooltip with Tdarr-friendly explicit
newline escapes. Dropdown inputs now describe each option, and text/boolean
inputs include examples and rollout cautions so the detailed guidance lives in
the tooltip UI instead of the sanitized plugin description modal.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-36`.

### Expanded input tooltips with multiline guidance

Changed the classic plugin input tooltips from dense single-line strings to
multiline template literals. The tooltip text now carries the detailed UI
guidance for video, audio, subtitles, metadata, language order, Arr lookup,
dry run, and log verbosity because Tdarr sanitizes the plugin-level
description field.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-35`.

### Matched Tdarr's padded multiline description style

Changed the classic plugin metadata description to a single padded multiline
template literal with blank lines between sentences. This matches the style
used by Tdarr plugins that display longer descriptions and avoids array joins
or generated separators.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-34`.

### Reworked description source as a multiline template literal

Changed the classic plugin metadata description from a sentence array to a
single multiline template literal. This keeps the source exactly formatted as
the desired Tdarr description text while validating whether Tdarr preserves
literal multiline plugin metadata differently from constructed strings.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-33`.

### Tried Unicode line separators for Tdarr descriptions

Changed the classic plugin metadata description separator from HTML line breaks
to Unicode line separators after the Tdarr description modal rendered `<br />`
as literal escaped text. This keeps the description source sentence-per-line
and tests whether Tdarr's plain text renderer honors explicit line separators.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-32`.

### Rendered description sentence breaks in Tdarr

Changed the classic plugin metadata description separator from newline
characters to HTML line breaks because the Tdarr description modal collapses
plain whitespace. The source still keeps each description sentence on its own
line.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-31`.

### Split the Tdarr plugin description into readable lines

Changed the classic plugin metadata description so each sentence is maintained
on its own line, making the Tdarr UI text and source metadata easier to scan.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-30`.

### Expanded the Tdarr plugin description

Updated the classic plugin metadata description to explain the validated
workflow in the Tdarr UI: video copy/transcode planning, audio cleanup and
compatibility track generation, subtitle and external SRT handling, attachment
policy, chapter handling, metadata cleanup, Arr original-language lookup, and
no-process behavior for already-compliant files.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-29`.

### Made summary logging quiet but still useful

Changed summary logging so it emits a compact compliance summary instead of
empty dry-run section headers. Summary mode now avoids the analysis dump,
planned final track table, and FFmpeg command preview while still reporting
whether the file would process and what the plan would retain or change.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-28`.

### Retagged undetermined audio to the best fallback language

Changed audio planning to retag `und` audio to the resolved original language
when one is available, or to the first configured audio language otherwise.
The base audio language order also skips implicit `und` unless it is explicitly
configured. This prevents a cache follow-up pass from dropping the only audio
track after an MP4 or untagged file has already been converted to MKV while
still producing clean language tags.

This was found with `La Hipocondríaca Capítulo 116 (FIN).mp4`: the first pass
converted the file and copied the AAC stereo audio, but a cache-output
follow-up treated the `und` audio as outside the target `eng,spa` order and
produced a video-only MKV.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-27`.

### Preserved title-indicated forced subtitles

Changed subtitle planning to treat titles and sidecar filenames containing
forced-subtitle cues, such as `forced`, as desired forced subtitle tracks even
when the source stream's forced disposition flag is missing. Active FFmpeg
commands now render the planned forced disposition instead of clearing all
forced flags, and no-op `mkvpropedit` repair can set forced flags to the
planned state.

This was found with `The Bank Job`, where the retained English subtitle was
titled `English (forced)` but the source stream did not expose a forced flag.
The previous command copied the track as a default subtitle while leaving
`forced=0`.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-25`.

## 2026-08-04 - Freohrskulblaka

### Stabilized generated chapter metadata file placement

Changed generated chapter metadata placement so the plugin only uses a Tdarr
work directory when the current source or process directory is clearly inside
one. If neither path identifies the active job work directory, the metadata
file is written directly under the configured Tdarr cache root instead of
guessing the most recently modified `tdarr-workDir*` directory.

This avoids a cross-job temp path when Tdarr reruns the plugin during
CPU/GPU worker handoff. The previous heuristic could successfully complete if
the prior job's ffmetadata file was still present, but the command was brittle
because it referenced another job's work directory.

Runtime marker: `media-optimizer-arr-profile-2026-08-05-24`.

### Combined FFmpeg disposition flags into one option per stream

Changed the FFmpeg command argument helper to render disposition changes as one value per output stream, such as `+default-forced` or `-default-forced`. The previous rendering emitted separate `-disposition:s:n` options for `default` and `forced`; FFmpeg accepted the command but warned that only the last disposition option for each stream would be used.

In practice, the later `-forced` operation could overwrite the earlier default decision and force a follow-up `mkvpropedit` repair pass. This keeps first-pass external SRT imports aligned with the planned subtitle default state and should prevent the extra no-op repair cycle when the fresh FFmpeg output already has the correct flags.

Runtime marker: `media-optimizer-arr-profile-2026-08-04-23`.

### Moved safe no-op actions out of the classic plugin entrypoint

Moved in-place maintenance work into `../classic_plugins/media_optimizer/media_optimizer/actions/in_place.js` so the classic plugin entrypoint can stay focused on Tdarr input handling, analysis, planning, command rendering, and response construction.

The first actions in this module remove matched external SRT sidecars that are already embedded in the MKV and repair subtitle default flags with `mkvpropedit` when a no-op file is already compliant except for bad subtitle
dispositions. These actions intentionally keep the Tdarr response in no-process mode; they are maintenance fixes for files that do not need a new FFmpeg transcode/remux.

Matched sidecar cleanup now runs before subtitle disposition repair. This keeps the deletion log independent from any `mkvpropedit` side effect and makes it easier to confirm that an already-embedded external subtitle file was removed during a no-op pass.

Runtime marker: `media-optimizer-arr-profile-2026-08-04-22`.

### Trimmed the classic plugin header, kept detailed history here

Reduced the top-of-file comment in
`../classic_plugins/media_optimizer/tdarr_plugin_media_optimizer.js` to the stable plugin
description plus a pointer to this changelog. The detailed iteration history
now lives here where it can grow without crowding the runtime entrypoint.

### Corrected no-op subtitle disposition repair selectors

Corrected the `mkvpropedit` subtitle track selectors used by the no-op repair
path to use one-based subtitle indexes. This matches the selector convention
expected by `mkvpropedit` for subtitle tracks and allows already-processed MKV
files to be repaired without running a full FFmpeg command again.

Runtime marker: `media-optimizer-arr-profile-2026-08-04-21`.

### Added no-op subtitle default repair with mkvpropedit

Added an in-place repair path for MKV files that otherwise meet the Media
Optimizer plan but have incorrect subtitle default flags from an earlier
processing pass. The repair only runs when the plan is valid, the file should
not otherwise process, dry run is disabled, and a subtitle disposition mismatch
is detected.

Runtime marker: `media-optimizer-arr-profile-2026-08-04-20`.

### Removed already-matched external SRT sidecars during no-op passes

Added cleanup for external SRT files that are already represented by embedded
subtitle tracks in the target MKV. This closes the loop after a successful
import: a second pass should recognize the subtitle as present, skip FFmpeg,
and remove the now-redundant sidecar instead of importing the same subtitle
again.

Runtime marker: `media-optimizer-arr-profile-2026-08-04-19`.

### Applied subtitle dispositions during active FFmpeg remuxes

Applied planned subtitle default and forced dispositions while FFmpeg is
actively remuxing or transcoding subtitle streams. Embedded subtitle metadata
and titles remain preserved, while imported external subtitles receive the
planned language, title, and disposition metadata as part of the same command.

Runtime marker: `media-optimizer-arr-profile-2026-08-04-18`.

### Reworked no-op logging for compliant files

Added compact no-op compliance logging for files that already satisfy the
plan. Normal no-op reports now summarize retained video, audio, subtitle,
chapter, metadata, and original-language state without printing the full final
track table, the planned FFmpeg command, noisy analysis JSON, or diagnostic
reason breadcrumbs that only matter when a file is actually going to process.

Dry-run mode still keeps command previews because the whole point of dry run
is to inspect what would happen before enabling real processing.

### Added loop guards for generated output and metadata-only churn

Added guards for cache outputs, generated chapter files, MediaInfo Menu data,
encoder tags, MenuCount metadata, and genpts-only cases so already-compliant
files do not keep re-entering the stack for non-actionable differences.

These guards are meant to distinguish real cleanup work from harmless
container or reporting details that Tdarr, FFmpeg, or MediaInfo may surface
after a successful pass.

### Replaced separate Arr lookup inputs with one connection profile

Added a single classic input for the Sonarr/Radarr connection profile instead
of requiring four separate host and API key inputs. Original-language lookup
now uses that profile to resolve movie language from Radarr or episode/series
language from Sonarr.

This change keeps the plugin compatible with classic Tdarr inputs while
avoiding dependence on global or library variable resolution inside the
classic plugin helper path.

### Cleared support-module cache before local classic runs

Expanded local classic-plugin reload behavior so the Media Optimizer support
modules under `../classic_plugins/media_optimizer/media_optimizer/` are cleared before each local run. This
makes iterative testing through Tdarr more predictable after the node or server
reloads plugin files.

## 2026-07-15 - Freohrskulblaka

### Added dry-run FFmpeg command preview wiring

Added dry-run command preview support so the plugin can analyze a file,
produce a plan, and print the FFmpeg command that would be executed without
actually processing the file.

This became the main validation path for reviewing generated audio, subtitle,
chapter, attachment, and metadata operations before enabling live processing.

## 2026-06-29 - Freohrskulblaka

### Created the modular Media Optimizer classic plugin

Created the Media Optimizer classic plugin entrypoint at
`../classic_plugins/media_optimizer/tdarr_plugin_media_optimizer.js` and split the work into
supporting libraries under `../classic_plugins/media_optimizer/media_optimizer/`.

The initial modular shape separated analysis, planning, formatting, metadata
lookup, and FFmpeg command rendering so each part of the optimization workflow
could be tested and evolved without turning the classic Tdarr entrypoint into
one large process file.
