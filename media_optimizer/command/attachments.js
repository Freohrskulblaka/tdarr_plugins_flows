/*
 * Media Optimizer FFmpeg Attachment Command Renderer
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Renders planned attachment copies into FFmpeg output arguments.
 */

function addAttachmentArgs(args, attachmentPlan, streamIndexes) {
  (attachmentPlan?.tracks || []).forEach((track) => {
    if (track.action === 'remove') {
      return;
    }

    args.push('-map', `0:${track.sourceIndex}`);
    args.push(`-c:t:${streamIndexes.attachment}`, 'copy');
    streamIndexes.attachment += 1;
  });
}

module.exports = {
  addAttachmentArgs,
};
