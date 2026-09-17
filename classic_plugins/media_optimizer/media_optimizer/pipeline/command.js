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
    const extension = process.platform === 'win32' ? '.exe' : '';
    const hdrDirectory = path.resolve(__dirname, '../../../../tools/hdr');
    const bundleDirectories = [
      path.resolve(path.dirname(process.execPath), '../assets/app/ffmpeg', `${process.platform}_${process.arch}`),
      `/app/Tdarr_Node/assets/app/ffmpeg/${process.platform}_${process.arch}`,
      `/app/Tdarr_Server/assets/app/ffmpeg/${process.platform}_${process.arch}`,
    ];
    const tool = (name, candidates) => {
      const override = process.env[`MEDIA_OPTIMIZER_HDR_${name}_PATH`];
      if (override) return override;
      for (const candidate of candidates.filter(Boolean)) {
        const locations = path.isAbsolute(candidate) ? [candidate]
          : (process.env.PATH || '').split(path.delimiter).filter(Boolean).map((directory) => path.resolve(directory, candidate));
        for (const location of locations) {
          try {
            fs.accessSync(location, fs.constants.X_OK);
            if (fs.statSync(location).isFile()) return location;
          } catch { /* Try the next standard location. */ }
        }
      }
      return candidates[candidates.length - 1];
    };
    const cliPath = tool('RUNNER', [
      path.join(hdrDirectory, `media_optimizer_hdr_ffmpeg${extension}`),
      `/app/server/tools/hdr/media_optimizer_hdr_ffmpeg${extension}`,
      `media_optimizer_hdr_ffmpeg${extension}`,
    ]);
    const outputPath = context.otherArguments?.cacheFilePath;
    const sourcePath = context.file?._id || context.file?.file;
    if (!cliPath || !path.isAbsolute(cliPath) || !fs.existsSync(cliPath)
      || !path.basename(cliPath).toLowerCase().includes('ffmpeg')) {
      unsupportedSteps.push('Dynamic HDR restoration could not find a Python 3.10+ executable alias named media_optimizer_hdr_ffmpeg in the server tools/hdr folder or worker PATH. Create the alias as documented, or override its location with MEDIA_OPTIMIZER_HDR_RUNNER_PATH.');
    }
    if (!outputPath || !path.isAbsolute(outputPath) || path.resolve(outputPath) === path.resolve(sourcePath || '.')) {
      unsupportedSteps.push('Dynamic HDR restoration requires a separate, absolute Tdarr cacheFilePath.');
    }
    warnings.push('Experimental dynamic HDR restoration: one video encode and four compressed-video-sized temporary writes. Unsupported or invalid metadata will fail the job without accepting the output.');
    if (!context.settings.dryRun && plan.isValid && plan.shouldProcess && unsupportedSteps.length === 0) {
      const workDir = fs.mkdtempSync(path.join(path.dirname(outputPath), '.media-optimizer-hdr-'));
      const ffmpeg = tool('FFMPEG', [context.otherArguments?.ffmpegPath,
        ...bundleDirectories.map((directory) => path.join(directory, `ffmpeg${extension}`)), `ffmpeg${extension}`]);
      const mkvpropedit = tool('MKVPROPEDIT', [context.otherArguments?.mkvpropeditPath, `mkvpropedit${extension}`]);
      const sibling = (name) => path.isAbsolute(mkvpropedit)
        ? path.join(path.dirname(mkvpropedit), `${name}${path.extname(mkvpropedit)}`) : `${name}${extension}`;
      const unquote = (arg) => /^".*"$/.test(arg) ? arg.slice(1, -1).replace(/\\"/g, '"') : String(arg);
      const jobPath = path.join(workDir, 'job.json');
      fs.writeFileSync(jobPath, JSON.stringify({
        version: 1, sourcePath, outputPath, workDir,
        type: restorationTrack.hdr.hasDolbyVision ? 'dolbyVision' : 'hdr10plus',
        width: restorationTrack.width, height: restorationTrack.height,
        outputWidth: restorationTrack.outputWidth, outputHeight: restorationTrack.outputHeight,
        targetKbps: restorationTrack.bitrate.selected.targetKbps,
        inputArgs: inputArgs.map(unquote), outputArgs: outputArgs.map(unquote),
        tools: {
          ffmpeg,
          ffprobe: tool('FFPROBE', [context.otherArguments?.ffprobePath,
            path.isAbsolute(ffmpeg) ? path.join(path.dirname(ffmpeg), `ffprobe${extension}`) : null,
            ...bundleDirectories.map((directory) => path.join(directory, `ffprobe${extension}`)), `ffprobe${extension}`]),
          mkvmerge: tool('MKVMERGE', [sibling('mkvmerge')]),
          mkvextract: tool('MKVEXTRACT', [sibling('mkvextract')]),
          mkvpropedit,
          dovi: tool('DOVI', [path.join(hdrDirectory, `dovi_tool${extension}`),
            `/app/server/tools/hdr/dovi_tool${extension}`, `dovi_tool${extension}`]),
          hdr10plus: tool('HDR10PLUS', [path.join(hdrDirectory, `hdr10plus_tool${extension}`),
            `/app/server/tools/hdr/hdr10plus_tool${extension}`, `hdr10plus_tool${extension}`]),
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
