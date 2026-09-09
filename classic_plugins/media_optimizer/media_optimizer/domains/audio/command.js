/*
 * Media Optimizer FFmpeg Audio Command Renderer
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Renders planned audio tracks, including generated derivatives, into FFmpeg output arguments.
 */

const { addDisposition, addStreamMetadata, quoteArg } = require('../../utils/command_args');

const AUDIO_ENCODING_SETTINGS = {
  ac3: {'5.1': {bitrate: '640k', sampleRate: '48000'}},
  aac: {stereo: {bitrate: '192k', sampleRate: '48000'}},
};
const AUDIO_NORMALIZATION_FILTER = 'loudnorm=I=-18:LRA=7:TP=-1.5:linear=false';

function addAudioArgs(args, audioPlan, streamIndexes) {
  (audioPlan?.tracks || []).forEach((track) => {
    const outputIndex = streamIndexes.audio;
    const encodingSettings = track.generated ? AUDIO_ENCODING_SETTINGS[track.targetCodec]?.[track.channelFamily] : null;

    args.push('-map', `0:${track.sourceIndex}`);
    args.push(`-c:a:${outputIndex}`, track.generated ? track.targetCodec : 'copy');

    if (track.generated) {
      args.push(`-ac:a:${outputIndex}`, String(track.channels));
      args.push(`-b:a:${outputIndex}`, encodingSettings.bitrate);
      args.push(`-ar:a:${outputIndex}`, encodingSettings.sampleRate);
      args.push(`-filter:a:${outputIndex}`, quoteArg(AUDIO_NORMALIZATION_FILTER));
    }

    addStreamMetadata(args, 'a', outputIndex, {
      language: track.language,
      title: track.title,
    });
    addDisposition(args, 'a', outputIndex, {
      default: track.default,
    });
    streamIndexes.audio += 1;
  });
}

module.exports = {
  addAudioArgs,
};
