/*
 * Media Parts Extractor Audio Naming Library
 * Created by: Freohrskulblaka
 * Created on: 2026-09-18
 * Description: Builds donor audio filenames and codec extensions.
 */

const path = require('path');
const { getOutputDirectory, formatNameParts, sanitizeToken } = require('../../utils/naming');

const AUDIO_EXTENSIONS = {
  aac: '.aac',
  ac3: '.ac3',
  dts: '.dts',
  eac3: '.eac3',
  flac: '.flac',
  mp3: '.mp3',
  opus: '.opus',
  truehd: '.thd',
};

function buildAudioOutputPath(context, stream) {
  const audio = stream.analysis.audio;
  const parts = [
    context.analysis.file.nameNoExtension,
    'audio',
    String(stream.index),
    audio.language || 'und',
    audio.channelFamily || '',
    audio.languageVariant || '',
    audio.codec || 'unknown',
  ];
  const extension = AUDIO_EXTENSIONS[audio.codec] || `.${sanitizeToken(audio.codec || 'audio')}`;

  return path.join(getOutputDirectory(context), `${formatNameParts(parts)}${extension}`);
}

module.exports = { buildAudioOutputPath };
