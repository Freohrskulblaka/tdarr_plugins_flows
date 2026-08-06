/*
 * Media Optimizer Attachment Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds attachment copy/removal decisions from normalized attachment analysis facts.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Extracted attachment planning from the planning coordinator.
 * - 2026-07-15 - Freohrskulblaka: Planned attachments from normalized attachment facts and added attachment counts.
 */

function planAttachments(context) {
  const attachmentItems = context.analysis.streams.attachment.items;
  const tracks = attachmentItems.map((attachment) => planAttachmentTrack(attachment, context.settings.metadata));
  
  const removedTracks = tracks.filter((track) => track.action === 'remove');
  const copiedTracks = tracks.filter((track) => track.action === 'copy');
  const reasons = collectAttachmentReasons(tracks);

  return {
    tracks,
    removedTracks,
    copiedTracks,
    keptCount: copiedTracks.length,
    removedCount: removedTracks.length,
    fontCount: tracks.filter((track) => track.isFont).length,
    nonFontCount: tracks.filter((track) => !track.isFont).length,
    shouldProcess: removedTracks.length > 0,
    reasons,
  };
}

function planAttachmentTrack(attachment, metadataSettings) {
  const action = getAttachmentAction(attachment, metadataSettings);
  const reasons = getAttachmentPlanReasons(attachment, action, metadataSettings);

  return {
    sourceIndex: attachment.sourceIndex,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    codecName: attachment.codecName,
    extension: attachment.extension,
    attachmentType: attachment.attachmentType,
    isFont: attachment.isFont,
    isImage: attachment.isImage,
    isLikelySubtitleFont: attachment.isLikelySubtitleFont,
    action,
    reasons,
  };
}

function getAttachmentAction(attachment, metadataSettings) {
  if (!metadataSettings.removeNonFontAttachments) {
    return 'copy';
  }

  if (metadataSettings.keepFontAttachments && attachment.isFont) {
    return 'copy';
  }

  return 'remove';
}

function getAttachmentPlanReasons(attachment, action, metadataSettings) {
  if (action === 'copy' && attachment.isFont) {
    return ['Font attachment is preserved for styled subtitles.'];
  }

  if (action === 'copy' && !metadataSettings.removeNonFontAttachments) {
    return ['Attachment is preserved by the selected metadata profile.'];
  }

  if (action === 'remove' && !attachment.isFont) {
    return ['Non-font attachment is removed by the selected metadata profile.'];
  }

  return ['Attachment is removed by the selected metadata profile.'];
}

function collectAttachmentReasons(tracks) {
  const reasons = [];

  tracks.forEach((track) => {
    track.reasons.forEach((reason) => {
      if (reason && !reasons.includes(reason)) {
        reasons.push(reason);
      }
    });
  });

  return reasons;
}

module.exports = {
  planAttachments,
};
