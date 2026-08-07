/*
 * Media Optimizer FFmpeg Audio Command Renderer
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Renders planned audio tracks, including generated derivatives, into FFmpeg output arguments.
 */

const { addDisposition, addStreamMetadata, quoteArg } = require('../../utils/command_args');

function addAudioArgs(args, audioPlan, streamIndexes) {
  (audioPlan?.tracks || []).forEach((track) => {
    args.push('-map', `0:${track.sourceIndex}`);
    args.push(`-c:a:${streamIndexes.audio}`, getAudioCodec(track));

    if (track.generated) {
      args.push(`-ac:a:${streamIndexes.audio}`, String(track.channels));
      addGeneratedAudioBitrateArgs(args, streamIndexes.audio, track);
      args.push(`-filter:a:${streamIndexes.audio}`, quoteArg('volume=1.5'));
    }

    addStreamMetadata(args, 'a', streamIndexes.audio, {
      language: track.language,
      title: track.title,
    });
    addDisposition(args, 'a', streamIndexes.audio, {
      default: track.default,
    });
    streamIndexes.audio += 1;
  });
}

function getAudioCodec(track) {
  if (track.generated || track.action === 'convert') {
    return track.targetCodec;
  }

  return 'copy';
}

function addGeneratedAudioBitrateArgs(args, outputIndex, track) {
  const bitrateByCodecAndFamily = {
    ac3: {
      '5.1': '640k',
      stereo: '192k',
    },
    aac: {
      stereo: '192k',
    },
  };
  const codecRates = bitrateByCodecAndFamily[track.targetCodec] || {};
  const bitrate = codecRates[track.channelFamily] || '';

  if (bitrate) {
    args.push(`-b:a:${outputIndex}`, bitrate);
  }
}

module.exports = {
  addAudioArgs,
};
