/*
 * Media Optimizer FFmpeg Command Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-15
 * Description: Compatibility entry point for the focused FFmpeg command renderers.
 * Updates:
 * - 2026-07-15 - Freohrskulblaka: Added first-slice command rendering for remux, video, copy/convert audio, embedded subtitles, attachments, chapters, and metadata cleanup.
 * - 2026-07-15 - Freohrskulblaka: Guarded video transcode arguments behind transcode actions and indexed video codec output.
 * - 2026-07-15 - Freohrskulblaka: Rendered generated audio tracks in the main FFmpeg command with output-specific channel counts.
 * - 2026-07-15 - Freohrskulblaka: Preserved the generated-audio volume boost from the classic workflow.
 * - 2026-07-15 - Freohrskulblaka: Rendered external SRT subtitle imports in the main FFmpeg command.
 * - 2026-07-21 - Freohrskulblaka: Rendered generated chapter markers as an FFmpeg metadata input.
 * - 2026-07-21 - Freohrskulblaka: Split command rendering into focused modules under media_optimizer/command.
 */

module.exports = require('./command');
