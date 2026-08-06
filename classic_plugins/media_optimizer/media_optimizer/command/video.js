/*
 * Media Optimizer FFmpeg Video Command Renderer
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Renders planned video tracks into FFmpeg output arguments.
 */

const { addDisposition, addStreamMetadata, quoteArg } = require('./args');

function addVideoArgs(args, videoPlan, streamIndexes) {
  (videoPlan?.tracks || []).forEach((track) => {
    if (track.action === 'remove') {
      return;
    }

    args.push('-map', `0:${track.sourceIndex}`);
    args.push(`-c:v:${streamIndexes.video}`, track.ffmpeg?.codec || 'copy');

    if (track.action === 'transcode' && track.ffmpeg?.args?.length > 0) {
      args.push(...track.ffmpeg.args);
    }

    if (track.action === 'transcode' && track.ffmpeg?.filters?.length > 0) {
      args.push('-vf', quoteArg(track.ffmpeg.filters.join(',')));
    }

    addStreamMetadata(args, 'v', streamIndexes.video, {
      language: track.language,
    });
    addDisposition(args, 'v', streamIndexes.video, {
      default: track.default,
    });
    streamIndexes.video += 1;
  });
}

module.exports = {
  addVideoArgs,
};
