/*
 * Media Optimizer FFmpeg Command Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Assembles focused command renderers into a dry-run-safe Tdarr FFmpeg preset preview.
 */

const { addAttachmentArgs } = require('../domains/attachments/command');
const { addAudioArgs } = require('../domains/audio/command');
const { addChapterArgs, addGeneratedChapterInput } = require('../domains/chapters/command');
const { addMetadataArgs } = require('../domains/metadata/command');
const { buildSubtitleCommandArgs } = require('../domains/subtitles/command');
const { addVideoArgs } = require('../domains/video/command');

function buildFfmpegCommand(context) {
  const plan = context.plan || {};
  const inputArgs = [];
  const outputArgs = [];
  const unsupportedSteps = [];
  const warnings = [];
  const streamIndexes = {
    video: 0,
    audio: 0,
    subtitle: 0,
    attachment: 0,
  };
  const subtitleCommand = buildSubtitleCommandArgs(plan.subtitles, streamIndexes, 1);
  inputArgs.push(...subtitleCommand.inputArgs);
  const chapterInputs = addGeneratedChapterInput(
    context,
    plan.chapters,
    inputArgs,
    subtitleCommand.nextInputIndex,
    !context.settings.dryRun,
  );

  addVideoArgs(outputArgs, plan.video, streamIndexes);
  addAudioArgs(outputArgs, plan.audio, streamIndexes);
  outputArgs.push(...subtitleCommand.outputArgs);
  addAttachmentArgs(outputArgs, plan.attachments, streamIndexes);
  addChapterArgs(outputArgs, plan.chapters, chapterInputs.chapterInput, unsupportedSteps);
  addMetadataArgs(outputArgs, plan, warnings, unsupportedSteps);

  if (streamIndexes.video === 0 || streamIndexes.audio === 0) {
    warnings.push('Command preview has no mapped video or audio stream; plan validation should normally prevent execution.');
  }

  outputArgs.push('-max_muxing_queue_size', '9999');

  const args = [...inputArgs, ...outputArgs];
  if (args.some((arg) => String(arg).includes(','))) {
    unsupportedSteps.push('An FFmpeg argument contains a comma, which Tdarr classic preset parsing would truncate. Processing is blocked to prevent stream loss.');
  }
  const preset = args.length > 0 ? `, ${args.join(' ')}` : '';
  let custom = null;
  const restorationTrack = plan.video?.tracks.find((track) => track.restoreDynamicHdr);
  if (restorationTrack) {
    const fs = require('fs');
    const path = require('path');
    const cliPath = process.env.MEDIA_OPTIMIZER_HDR_RUNNER_PATH;
    const outputPath = context.otherArguments?.cacheFilePath;
    const sourcePath = context.file?._id || context.file?.file;
    if (!cliPath || !path.isAbsolute(cliPath) || !fs.existsSync(cliPath)
      || !path.basename(cliPath).toLowerCase().includes('ffmpeg')) {
      unsupportedSteps.push('Dynamic HDR restoration requires MEDIA_OPTIMIZER_HDR_RUNNER_PATH: an absolute path to a Python 3.10+ executable alias whose name includes ffmpeg (for Tdarr progress reporting).');
    }
    if (!outputPath || !path.isAbsolute(outputPath) || path.resolve(outputPath) === path.resolve(sourcePath || '.')) {
      unsupportedSteps.push('Dynamic HDR restoration requires a separate, absolute Tdarr cacheFilePath.');
    }
    warnings.push('Experimental native-4K restoration: one video encode and four compressed-video-sized temporary writes. Unsupported or invalid metadata will fail the job without accepting the output.');
    if (!context.settings.dryRun && plan.isValid && plan.shouldProcess && unsupportedSteps.length === 0) {
      const workDir = fs.mkdtempSync(path.join(path.dirname(outputPath), '.media-optimizer-hdr-'));
      const tool = (name, fallback) => process.env[`MEDIA_OPTIMIZER_HDR_${name}_PATH`] || fallback;
      const mkvpropedit = tool('MKVPROPEDIT', context.otherArguments?.mkvpropeditPath || 'mkvpropedit');
      const sibling = (name) => path.isAbsolute(mkvpropedit)
        ? path.join(path.dirname(mkvpropedit), `${name}${path.extname(mkvpropedit)}`) : name;
      const unquote = (arg) => /^".*"$/.test(arg) ? arg.slice(1, -1).replace(/\\"/g, '"') : String(arg);
      const jobPath = path.join(workDir, 'job.json');
      fs.writeFileSync(jobPath, JSON.stringify({
        version: 1, sourcePath, outputPath, workDir,
        type: restorationTrack.hdr.hasDolbyVision ? 'dolbyVision' : 'hdr10plus',
        width: restorationTrack.width, height: restorationTrack.height,
        targetKbps: restorationTrack.bitrate.selected.targetKbps,
        inputArgs: inputArgs.map(unquote), outputArgs: outputArgs.map(unquote),
        tools: {
          ffmpeg: tool('FFMPEG', context.otherArguments?.ffmpegPath || 'ffmpeg'),
          ffprobe: tool('FFPROBE', context.otherArguments?.ffprobePath || 'ffprobe'),
          mkvmerge: tool('MKVMERGE', sibling('mkvmerge')),
          mkvextract: tool('MKVEXTRACT', sibling('mkvextract')),
          mkvpropedit,
          dovi: tool('DOVI', 'dovi_tool'), hdr10plus: tool('HDR10PLUS', 'hdr10plus_tool'),
        },
      }), { flag: 'wx' });
      custom = { cliPath, args: [path.resolve(__dirname, 'dynamic_hdr.py'), jobPath], outputPath };
    }
  }

  return {
    preset,
    args,
    unsupportedSteps,
    warnings,
    custom,
    isExecutable: unsupportedSteps.length === 0,
  };
}

module.exports = {
  buildFfmpegCommand,
};
