/*
 * Media Optimizer Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Builds the normalized file, media, stream, chapter, metadata, and original-language inventory used by the media optimizer workflow.
 * Updates:
 * - 2026-06-29 - Freohrskulblaka: Created analysis helpers for media optimizer classic plugin and future flow components.
 * - 2026-07-01 - Freohrskulblaka: Added normalized video stream facts for image classification, bitrate, frame rate, resolution, and HDR.
 * - 2026-07-01 - Freohrskulblaka: Moved video-specific stream enrichment into the video analysis library.
 * - 2026-07-13 - Freohrskulblaka: Extracted file, attachment, chapter, and media identity source facts into focused analysis modules.
 */

const { analyzeAttachmentStreams } = require('./attachment');
const { analyzeVideoStreams } = require('./video');
const { analyzeAudioStreams } = require('./audio');
const { analyzeChapters } = require('./chapter');
const { analyzeFileInfo } = require('./file');
const { analyzeMediaInfo } = require('./media_info');
const { analyzeExternalSubtitleFiles, analyzeSubtitleStreams } = require('./subtitle');

function analyzeFile(context) {
  const streams = context.file?.ffProbeData?.streams || [];
  const mediaInfoTracks = context.file?.mediaInfo?.track || [];
  const fileInfo = analyzeFileInfo(context.file, context.settings);
  const streamInfo = analyzeStreams(streams, mediaInfoTracks, context.file);
  const chapterInfo = analyzeChapters(mediaInfoTracks);
  const mediaInfo = analyzeMediaInfo(fileInfo.nameNoExtension, mediaInfoTracks);
  const externalSubtitles = analyzeExternalSubtitleFiles(fileInfo);
  const globalTags = context.file?.ffProbeData?.format?.tags || {};
  const summary = createAnalysisSummary(fileInfo, streamInfo, chapterInfo, globalTags, externalSubtitles);

  const analysis = {
    file: fileInfo,
    media: mediaInfo,
    streams: streamInfo,
    summary,
    chapters: chapterInfo.chapters,
    externalSubtitles,
    globalTags,
    originalLanguage: null,
    videoSettings: context.settings.video,
  };

  return analysis;
}

function analyzeStreams(streams, mediaInfoTracks, file) {
  const videoStreams = streams.filter((stream) => stream.codec_type === 'video');
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
  const subtitleStreams = streams.filter((stream) => stream.codec_type === 'subtitle');
  const attachmentStreams = streams.filter((stream) => stream.codec_type === 'attachment');

  const streamInfo = {
    all: streams,
    video: analyzeVideoStreams(videoStreams, mediaInfoTracks, file),
    audio: analyzeAudioStreams(audioStreams, mediaInfoTracks),
    subtitle: analyzeSubtitleStreams(subtitleStreams, mediaInfoTracks),
    attachment: analyzeAttachmentStreams(attachmentStreams),
  };

  return streamInfo;
}

function createAnalysisSummary(fileInfo, streamInfo, chapterInfo, globalTags, externalSubtitles) {
  const summary = {
    isVideoFile: fileInfo.medium === 'video',
    isNotVideoFile: fileInfo.medium !== 'video',
    needsRemux: fileInfo.needsRemux,
    useGenpts: fileInfo.useGenpts,
    hasVideo: streamInfo.video.hasStreams,
    hasAudio: streamInfo.audio.hasStreams,
    hasSubtitles: streamInfo.subtitle.hasStreams,
    hasAttachments: streamInfo.attachment.hasAttachments,
    hasChapters: chapterInfo.hasChapters,
    hasMultipleVideoStreams: streamInfo.video.hasMultipleStreams,
    hasMultipleAudioStreams: streamInfo.audio.hasMultipleStreams,
    hasMultipleAudioLanguages: streamInfo.audio.hasMultipleLanguages,
    hasUntaggedAudioStreams: streamInfo.audio.hasUntaggedStreams,
    hasMultipleSubtitleStreams: streamInfo.subtitle.hasMultipleStreams,
    hasMultipleSubtitleLanguages: streamInfo.subtitle.hasMultipleLanguages,
    hasPictureSubtitles: streamInfo.subtitle.hasPictureSubtitles,
    videoStreamCount: streamInfo.video.count,
    audioStreamCount: streamInfo.audio.count,
    subtitleStreamCount: streamInfo.subtitle.count,
    externalSubtitleCount: externalSubtitles.length,
    attachmentCount: streamInfo.attachment.count,
    chapterCount: chapterInfo.count,
    audioLanguages: streamInfo.audio.languages,
    audioChannels: streamInfo.audio.channels,
    audioCodecs: streamInfo.audio.codecs,
    subtitleLanguages: streamInfo.subtitle.languages,
    subtitleCodecs: streamInfo.subtitle.codecs,
    globalTagKeys: Object.keys(globalTags),
  };

  return summary;
}

function summarizeAnalysis(analysis) {
  const summary = {
    file: analysis.file,
    media: {
      type: analysis.media.type,
      name: analysis.media.name,
      year: analysis.media.year,
      season: analysis.media.season,
      episode: analysis.media.episode,
      absoluteEpisode: analysis.media.absoluteEpisode,
      resolution: analysis.media.resolution,
      imdbId: analysis.media.imdbId,
      tvdbId: analysis.media.tvdbId,
    },
    container: analysis.file.container,
    fileMedium: analysis.file.medium,
    videoCodec: analysis.streams.video.codecs[0] || '',
    videoResolution: analysis.media.resolution,
    videoSettings: analysis.videoSettings,
    streamSummary: analysis.summary,
    originalLanguage: analysis.originalLanguage,
  };

  return summary;
}

module.exports = {
  analyzeFile,
  summarizeAnalysis,
};
