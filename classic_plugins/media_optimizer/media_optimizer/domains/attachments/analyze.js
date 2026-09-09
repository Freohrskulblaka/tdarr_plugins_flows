/*
 * Media Optimizer Attachment Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds normalized attachment stream facts for the media optimizer workflow.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka:
 *   - Extracted attachment source facts from the analysis coordinator.
 *   - Reused shared analysis utility helpers.
 * - 2026-07-15 - Freohrskulblaka: Normalized attachment filenames, MIME types, extensions, and type classification.
 */

const FONT_FORMATS = ['ttf', 'otf', 'ttc', 'woff', 'woff2'];
const FONT_MIME_TYPES = ['font/ttf', 'font/otf', 'font/collection', 'font/woff', 'font/woff2', 'application/x-truetype-font', 'application/vnd.ms-opentype', 'application/font-woff', 'application/font-woff2', 'application/x-font-ttf', 'application/x-font-otf', 'application/x-font-opentype'];

function analyzeAttachmentStreams(attachmentStreams) {
  const items = attachmentStreams.map(normalizeAttachmentStream);

  return {
    items,
    count: items.length,
    hasAttachments: items.length > 0,
  };
}

function normalizeAttachmentStream(stream) {
  const fileName = getTagValue(stream, ['filename', 'FILENAME']) || '';
  const mimeType = normalizeValue(getTagValue(stream, ['mimetype', 'MIMETYPE', 'mime_type', 'MIME_TYPE']));
  const codecName = normalizeValue(stream?.codec_name);
  const extension = getFileExtension(fileName);

  return {
    sourceIndex: stream?.index,
    fileName,
    mimeType,
    codecName,
    extension,
    isFont: isFontAttachment(extension, mimeType, codecName),
  };
}

function getTagValue(stream, tagNames) {
  const tags = stream?.tags || {};

  for (const tagName of tagNames) {
    if (tags[tagName] !== undefined && tags[tagName] !== null) {
      return tags[tagName];
    }
  }

  return '';
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function getFileExtension(fileName) {
  const match = String(fileName || '').trim().toLowerCase().match(/(\.[^.\\/\s]+)$/);

  return match ? match[1] : '';
}

function isFontAttachment(extension, mimeType, codecName) {
  return FONT_FORMATS.includes(extension.slice(1))
    || FONT_MIME_TYPES.includes(mimeType)
    || mimeType.startsWith('font/')
    || FONT_FORMATS.includes(codecName);
}

module.exports = {
  analyzeAttachmentStreams,
};
