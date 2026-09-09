/*
 * Media Parts Extractor Naming Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-22
 * Description: Creates stable sidecar names for extracted donor audio and subtitle streams.
 */

const path = require('path');

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

const SUBTITLE_EXTENSIONS = {
  ass: '.ass',
  dvd_subtitle: '.sub',
  hdmv_pgs_subtitle: '.sup',
  mov_text: '.srt',
  ssa: '.ssa',
  srt: '.srt',
  subrip: '.srt',
  webvtt: '.vtt',
};

function getOutputDirectory(context) {
  if (context.settings.output.mode === 'Configured Directory') {
    return context.settings.output.directory;
  }

  return context.analysis.file.directory;
}

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

function buildSubtitleOutputPath(context, stream) {
  const subtitle = getSubtitleAnalysis(stream);
  const forced = subtitle.currentForced ? 'forced' : '';
  const accessibility = subtitle.accessibility && subtitle.accessibility !== 'regular' ? subtitle.accessibility : '';
  const parts = [
    context.analysis.file.nameNoExtension,
    'subtitle',
    String(subtitle.sourceIndex),
    subtitle.language || 'und',
    subtitle.subtitleType || '',
    subtitle.languageVariant || '',
    forced,
    accessibility,
    subtitle.codec || 'unknown',
  ];
  const extension = SUBTITLE_EXTENSIONS[subtitle.codec] || `.${sanitizeToken(subtitle.codec || 'subtitle')}`;

  return path.join(getOutputDirectory(context), `${formatNameParts(parts)}${extension}`);
}

function formatNameParts(parts) {
  return parts
    .map(sanitizeToken)
    .filter(Boolean)
    .join('.');
}

function sanitizeToken(value) {
  return String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+|\.+$/g, '');
}

function getSubtitleAnalysis(stream) {
  return stream.analysis?.subtitle || stream;
}

module.exports = {
  buildAudioOutputPath,
  buildSubtitleOutputPath,
  getOutputDirectory,
};
