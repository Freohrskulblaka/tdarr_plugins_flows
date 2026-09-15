/*
 * Media Optimizer Attachment Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds attachment copy/removal decisions from normalized attachment analysis facts.
 */

function planAttachments(context) {
  const attachmentItems = context.analysis.streams.attachment.items;
  const tracks = attachmentItems.map((attachment) => ({
    ...attachment,
    action: attachment.isFont ? 'copy' : 'remove',
  }));
  const keptCount = tracks.filter((track) => track.isFont).length;
  const removedCount = tracks.length - keptCount;
  const reasons = removedCount > 0
    ? ['Non-font attachments will be removed; subtitle font attachments will be preserved.']
    : [];

  return {
    tracks,
    keptCount,
    removedCount,
    shouldProcess: removedCount > 0,
    reasons,
  };
}

module.exports = {
  planAttachments,
};
