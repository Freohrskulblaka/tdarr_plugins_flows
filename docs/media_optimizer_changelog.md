# Media Optimizer Changelog

History of `../classic_plugins/media_optimizer/Local/Tdarr_Plugin_Media_Optimizer.js` and the supporting `../classic_plugins/media_optimizer/media_optimizer/` libraries used by the classic Tdarr Media Optimizer plugin.

---

## 2026-09-17 - Freohrskulblaka

### Cross-checked static HDR metadata

Compare source MKV mastering/light headers with a short raw-HEVC sample before encoding. Reject conflicting or changing sampled values instead of overwriting the baseline. Check sampled encoder/restorer SEI against that verified baseline and final container properties directly through MKVToolNix, including incomplete coordinate headers FFprobe can omit. Keep fixed-decimal rendering, container-only metadata support, one video encode, and existing dynamic-HDR/timestamp/track validation. These are bounded static-metadata checks, not automatic RGB repair or a full-file static audit. Existing copy modes remain unchanged. Version: `0.1.13`.

Runtime marker: `media-optimizer-hdr-static-validation-2026-09-17-54`.

### Added verified Dolby Vision 1080p downscaling

Extend the existing opt-in restoration mode to square-pixel 3840x2160-to-1920x1080 Dolby Vision resizing and HDR10-compatible Profile 8.1 input. Keep source/output geometry separate, halve Level 5 active-area offsets without cropping, retain per-frame ranges, and verify adjusted metadata before publishing. Odd offsets fail before encoding; FEL, Profile 5, other compatibility IDs, combined formats, and resized HDR10+ remain unsupported. Compliant 1080p output avoids repeat encoding. Render static-HDR header values as bounded fixed decimals to avoid MKVToolNix scientific-notation and long-decimal parsing errors on previously restored input. Existing HDR modes remain unchanged. Version: `0.1.12`.

Runtime marker: `media-optimizer-dv-1080p-restore-2026-09-17-53`.

## 2026-09-16 - Freohrskulblaka

### Preserved dynamic HDR timestamp precision

Use the source demuxer time base for the single HDR encode as well as frame passthrough. This avoids encoder-clock rounding that changes frame presentation times for 23.976-fps MKV sources with negative AAC start timestamps. Strict frame/timeline checks remain unchanged; errors now identify the first mismatching frame and relative timestamp delta. Document worker-wide executable permissions for installed HDR tools. Version: `0.1.10`.

Runtime marker: `media-optimizer-hdr-timestamp-precision-2026-09-16-51`.

### Discovered dynamic HDR tools automatically

Standard worker layouts no longer require HDR path environment variables. Discover the Python alias and HDR binaries in the persistent server `tools/hdr/` directory, reuse Tdarr's supplied/bundled FFmpeg and FFprobe, and locate MKVToolNix through sibling paths or worker PATH. Explicit environment overrides remain available and authoritative for custom installations. External binaries still require separate installation. Version: `0.1.9`.

Runtime marker: `media-optimizer-hdr-tool-discovery-2026-09-16-50`.

### Added opt-in dynamic HDR compression and restoration

Added `Compress And Restore Dynamic HDR` without changing the default or either existing HDR mode. Experimental native-4K MKV restoration supports HDR10+ or full-file Dolby Vision Profile 7 MEL converted to Profile 8.1. Resizing, unsupported profiles, and dual-format inputs remain copied. Unsupported full-file metadata or tool failures stop the job without accepting a degraded output.

The classic custom-CLI runner reuses the complete existing audio/subtitle/attachment/chapter/metadata command, performs one video encode, injects metadata, and verifies frame correspondence, synchronization, track headers/tags, chapters, attachments, audio/subtitle payloads, and a full video decode before publishing the cache file. Requires worker-side Python 3.10+, MKVToolNix, and pinned HDR tools only for this new mode. Version: `0.1.8`.

Runtime marker: `media-optimizer-dynamic-hdr-opt-in-2026-09-16-49`.

### Linked compatibility audio to its main soundtrack

Compatibility selection now checks source identity rather than blindly reusing lower-quality AC3/AAC streams with matching language and channels. Both derivatives use the best eligible main source per language variant, with no stereo-to-surround upmix. Identified commentary and descriptive tracks remain outside main-source selection.

Added a versioned `MEDIA_OPTIMIZER_AUDIO_SOURCE` stream tag containing parent channel count, quality rank, and hashed identity. It allows follow-up runs to reuse generated tracks after the original source is removed, keeps retained-surround and preserve-all profiles stable, and invalidates derivatives when a better replacement source is selected. Untagged legacy compatibility tracks may be regenerated once. The plugin version is now `0.1.7`; dynamic-HDR behavior is unchanged.

Runtime marker: `media-optimizer-main-audio-source-2026-09-16-48`.

### Calculated resize bitrate before encoding

Upscaling and 4K downscaling now calculate their bitrate profiles from the expected even-pixel output dimensions within the 1920x1080 boundary. This matches the native-resolution calculation used when Tdarr checks the finished output. The corrected Constantine run exposed a second encode because its first pass targeted the full boundary while its follow-up used the smaller widescreen frame.

Added regression coverage for first-pass bitrate targets and compatible HEVC follow-up decisions across widescreen, 16:9, anamorphic, and 4K inputs, with exact output dimensions checked through optional real FFmpeg tests. No resize filter or stream mappings changed. The plugin version is now `0.1.6`.

Runtime marker: `media-optimizer-resized-bitrate-2026-09-16-47`.

### Prevented classic preset truncation during resizing

Removed the separate `setsar=1` filter from upscaling and 4K downscaling. The single `scale` filter preserves display aspect ratio through sample-aspect adjustment and avoids a filter-chain comma that Tdarr classic preset parsing interpreted as another input/output delimiter. The repeated Constantine test showed that the previous command was truncated before every audio and subtitle mapping, despite quotes around the filter expression.

Command assembly now marks presets containing commas inside arguments as non-executable, preventing the same silent truncation from future filter chains, explicit metadata values, or external paths. Added local regression coverage for complete downstream mappings, unsafe-argument rejection, and optional real FFmpeg aspect-ratio checks on widescreen, 16:9, anamorphic, and 4K sources. The plugin version is now `0.1.5`.

Runtime marker: `media-optimizer-resize-preset-safety-2026-09-16-46`.

## 2026-09-15 - Freohrskulblaka

### Added Sonarr title fallback for episodes without TVDB IDs

Changed TV-show original-language lookup to derive a normalized series title and optional year from standard and dotted episode filenames. When a TVDB ID is unavailable, the plugin now checks the configured Sonarr library and accepts only one exact title-and-year match, or one exact title match when the filename has no year. Ambiguous and unmatched results remain unresolved instead of accepting the first Sonarr response.

Arr-mode local fallback now prefers the first configured audio language that is actually present instead of assuming the first stream is the original language. When no configured language is present, the first usable audio stream remains the safety fallback. The plugin version is now `0.1.4`.

Runtime marker: `media-optimizer-sonarr-title-fallback-2026-09-15-45`.

### Applied HEVC bitrate efficiency during H.264 conversion

Changed same-resolution H.264-to-HEVC planning to use 65% of the lower source or profile bitrate baseline. High-bitrate sources therefore use 65% of the selected resolution profile, while already-compressed sources use 65% of their current video bitrate instead of being transcoded at effectively the same bitrate.

True below-1080p upscales retain the full 1080p profile target so a low-resolution source bitrate does not starve the enlarged output. The plugin version is now `0.1.3`.

Runtime marker: `media-optimizer-hevc-bitrate-efficiency-2026-09-15-44`.

### Compacted normal processing logs

Changed normal logging to report high-level retained, generated, and removed track counts without printing a line and repeated reason for every removed track. Full analysis, per-track decisions, reasons, and command previews remain available in debug mode; normal dry runs continue to include the command preview.

The plugin version is now `0.1.2`.

Runtime marker: `media-optimizer-compact-normal-logs-2026-09-15-43`.

### Secured Arr connection configuration

Added preferred Arr connection resolution from complete library-variable pairs, global-variable pairs, or worker environment-variable pairs without mixing credentials between sources. The existing connection-profile input remains available as the final fallback for installations where Tdarr does not pass either preferred source to the classic plugin.

Added defensive log redaction for API keys, authorization values, passwords, secrets, and tokens. Debug output reports only whether each Arr service is configured and which configuration source was selected. Documentation warns that Tdarr may expose the fallback plugin input in its own job logs. The plugin version is now `0.1.1`.

Runtime marker: `media-optimizer-secure-arr-variables-2026-09-15-42`.

### Packaged for public deployment

Reorganized the package to mirror Tdarr's proven `Plugins/Local` entrypoint and sibling `Plugins/media_optimizer` support layout. The deployed filename now matches the plugin ID, and support dependencies load from inside the plugin execution path.

Added a release archive builder plus explicit installation, upgrade, backup, validation, and rollback instructions. Tdarr's existing `Plugins/methods` folder remains outside the release payload.

Runtime marker: `media-optimizer-release-package-2026-09-15-41`.

### Consolidated shared utility behavior

External subtitle filename languages now use the shared language normalizer instead of a separate four-language map. Language variant detection now recognizes underscore-separated codes and regional labels supplied through either language metadata or titles.

Simplified shared collection and FFmpeg argument helpers, preserved numeric and boolean quoted values, and folded the one-use output-index lookup into metadata command rendering.

Runtime marker: `media-optimizer-utils-2026-09-15-40`.

### Hardened and simplified runtime configuration

Runtime input parsing now canonicalizes recognized choices, booleans, and language aliases before planning. Malformed booleans, lookup modes, log levels, language tokens, and profile names produce controlled configuration errors, with invalid dry-run values failing closed to dry-run mode instead of enabling processing.

Removed retired disabled-profile state, duplicate context response fields, and unused configuration copies. Logging now uses a direct level-to-entry map, and the Tdarr methods adapter no longer hides dependency failures raised after a candidate helper has been resolved.

Runtime marker: `media-optimizer-runtime-2026-09-15-39`.

### Simplified pipeline orchestration and dry-run handling

Consolidated plan section processing, removed the unused duplicate FFmpeg argument list, and moved analysis and command-preview formatting into the formatting pipeline. Analysis now remains limited to source facts while command construction remains limited to execution arguments.

Dry-run chapter previews no longer create temporary `.ffmetadata` files. Process mode still materializes generated chapter metadata before returning an executable FFmpeg preset. Required but unsupported commands now produce an explicit error at every log level instead of silently returning no-process in summary mode.

### Simplified and hardened Arr original-language lookup

Removed retired global-variable, library-variable, and Flow-shaped lookup paths so the integration follows the Arr connection profile exposed by the classic plugin. Lookup requests now preserve reverse-proxy URL base paths, send API keys through the `X-Api-Key` header, and time out safely instead of leaving a worker waiting indefinitely.

Original-language fallback now consumes normalized audio analysis rather than raw lowercase tags. Shared language normalization covers the current Sonarr/Radarr language set and keeps unsupported response values from replacing a valid local fallback. Radarr title searches also require an unambiguous title/year match when multiple candidates are returned.

### Added fail-safe dynamic HDR preservation

Added explicit HDR handling profiles, richer HDR10, HLG, HDR10+, and Dolby Vision analysis, and a fail-safe video planning rule. Media Optimizer can transcode static HDR10 and HLG with source color signaling, but copies HDR10+ and Dolby Vision video so it never silently drops dynamic metadata.

Documented pinned `dovi_tool` and `hdr10plus_tool` releases and node paths for a separate future dynamic-HDR workflow in `hdr_tooling.md`.

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

## 2026-08-06 - Freohrskulblaka

### Reorganized the support library by runtime, pipeline, domain, and integration

Moved the Media Optimizer support modules into a more cohesive layout under
`runtime/`, `pipeline/`, `domains/`, `integrations/`, and `shared/`.

The classic plugin entrypoint, sibling plugins, and local harnesses now import
the current structure directly, leaving no root compatibility modules in the
release-facing support package.

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
