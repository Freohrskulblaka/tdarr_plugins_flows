/*
 * Media Optimizer Metadata Actions
 * Created by: Freohrskulblaka
 * Created on: 2026-09-09
 * Description: Adds in-place MKV metadata edits for cleanup that does not require a remux.
 */

function addMetadataMkvpropeditActions(context, args) {
  const metadataPlan = context.plan?.metadata || {};
  const updates = [];

  if (metadataPlan.stripGlobalTags) {
    args.push('--tags', 'global:');
    updates.push({action: 'removeGlobalTags', tagCount: metadataPlan.globalTagKeys.length});
  }

  if (metadataPlan.removeFileTitle) {
    args.push('--edit', 'info', '--delete', 'title');
    updates.push({action: 'removeFileTitle'});
  }

  (metadataPlan.videoTitleTracks || []).forEach((track) => {
    if (track.action === 'removeTitle') {
      args.push('--edit', `track:v${track.sourceOrder + 1}`, '--delete', 'name');
      updates.push({action: 'removeVideoTitle', videoIndex: track.sourceOrder});
    }
  });

  return updates;
}

module.exports = {
  addMetadataMkvpropeditActions,
};
