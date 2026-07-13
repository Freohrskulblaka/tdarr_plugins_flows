/*
 * Media Optimizer Attachment Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds normalized attachment stream facts for the media optimizer workflow.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Extracted attachment source facts from the analysis coordinator.
 * - 2026-07-13 - Freohrskulblaka: Reused shared analysis utility helpers.
 */

const { getUniqueValues } = require('./analysis_utils');

function analyzeAttachmentStreams(attachmentStreams) {
  const attachmentInfo = {
    items: attachmentStreams,
    count: attachmentStreams.length,
    hasAttachments: attachmentStreams.length > 0,
    mimeTypes: getUniqueValues(attachmentStreams, (stream) => stream?.tags?.mimetype || stream?.codec_name || 'unknown'),
  };

  return attachmentInfo;
}

module.exports = {
  analyzeAttachmentStreams,
};
