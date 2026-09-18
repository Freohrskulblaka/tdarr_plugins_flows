/*
 * Media Parts Extractor Subtitle Naming Library
 * Created by: Freohrskulblaka
 * Created on: 2026-09-18
 * Description: Builds donor subtitle filenames and codec extensions.
 */

const path = require('path');
const { getOutputDirectory, formatNameParts, sanitizeToken } = require('../../utils/naming');

const { getSubtitleAnalysis } = require('./analyze');

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

module.exports = { buildSubtitleOutputPath };
