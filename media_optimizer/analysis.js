/*
 * Media Optimizer Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Builds the normalized file, media, stream, chapter, metadata, and original-language inventory used by the media optimizer workflow.
 * Updates:
 * - 2026-06-29 - Freohrskulblaka: Created analysis helpers for media optimizer classic plugin and future flow components.
 * - 2026-07-01 - Freohrskulblaka: Added normalized video stream facts for image classification, bitrate, frame rate, resolution, and HDR.
 * - 2026-07-01 - Freohrskulblaka: Moved video-specific stream enrichment into the video analysis library.
 */

const { analyzeVideoStreams } = require('./video_analysis');

const PICTURE_SUBTITLE_CODECS = ['hdmv_pgs_subtitle', 'dvd_subtitle'];

function analyzeFile(context) {
  const streams = context.file?.ffProbeData?.streams || [];
  const mediaInfoTracks = context.file?.mediaInfo?.track || [];
  const fileInfo = analyzeFileInfo(context.file, context.settings);
  const streamInfo = analyzeStreams(streams, mediaInfoTracks, context.file);
  const chapterInfo = analyzeChapters(mediaInfoTracks);
  const mediaInfo = analyzeMediaInfo(fileInfo.nameNoExtension, mediaInfoTracks);
  const globalTags = context.file?.ffProbeData?.format?.tags || {};
  const summary = createAnalysisSummary(fileInfo, streamInfo, chapterInfo, globalTags);

  const analysis = {
    file: fileInfo,
    media: mediaInfo,
    streams: streamInfo,
    summary,
    chapters: chapterInfo.chapters,
    globalTags,
    originalLanguage: null,
    videoSettings: context.settings.video,
  };

  return analysis;
}

function analyzeFileInfo(file, settings) {
  const hasInvalidStreamDuration = (streams) => {
    const hasInvalidDuration = streams.some((stream) => {
      const duration = stream?.duration;
      const durationIsMissing = !duration;
      const durationIsNotAvailable = duration === 'N/A';

      return durationIsMissing || durationIsNotAvailable;
    });

    return hasInvalidDuration;
  };
  const fileName = file?.meta?.FileName || '';
  const nameNoExtension = file?.fileNameWithoutExtension || fileName.replace(/\.[^/.]+$/, '');
  const container = file?.container || '';
  const targetContainer = settings.output.container;
  const fileExtension = file?.meta?.FileTypeExtension || container;

  const fileInfo = {
    id: file?._id || '',
    directory: file?.meta?.Directory || '',
    container,
    medium: file?.fileMedium || '',
    nameNoExtension,
    extension: fileExtension ? `.${fileExtension}` : '',
    type: file?.meta?.FileType || '',
    targetContainer,
    needsRemux: Boolean(container && container !== targetContainer),
    useGenpts: hasInvalidStreamDuration(file?.ffProbeData?.streams || []),
  };

  return fileInfo;
}

function analyzeStreams(streams, mediaInfoTracks, file) {
  const videoStreams = streams.filter((stream) => stream.codec_type === 'video');
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
  const subtitleStreams = streams.filter((stream) => stream.codec_type === 'subtitle');
  const attachmentStreams = streams.filter((stream) => stream.codec_type === 'attachment');

  const streamInfo = {
    all: streams,
    video: analyzeVideoStreams(videoStreams, mediaInfoTracks, file),
    audio: analyzeAudioStreams(audioStreams),
    subtitle: analyzeSubtitleStreams(subtitleStreams),
    attachment: analyzeAttachmentStreams(attachmentStreams),
  };

  return streamInfo;
}

function analyzeAudioStreams(audioStreams) {
  const languages = getUniqueValues(audioStreams, (stream) => stream?.tags?.language || 'und');

  const audioInfo = {
    items: audioStreams,
    count: audioStreams.length,
    hasStreams: audioStreams.length > 0,
    hasMultipleStreams: audioStreams.length > 1,
    hasMultipleLanguages: languages.length > 1,
    hasUntaggedStreams: languages.includes('und'),
    languages,
    channels: getUniqueValues(audioStreams, (stream) => stream?.channels || 'unknown'),
    codecs: getUniqueValues(audioStreams, (stream) => stream?.codec_name || 'unknown'),
  };

  return audioInfo;
}

function analyzeSubtitleStreams(subtitleStreams) {
  const languages = getUniqueValues(subtitleStreams, (stream) => stream?.tags?.language || 'und');
  const codecs = getUniqueValues(subtitleStreams, (stream) => stream?.codec_name || 'unknown');

  const subtitleInfo = {
    items: subtitleStreams,
    count: subtitleStreams.length,
    hasStreams: subtitleStreams.length > 0,
    hasMultipleStreams: subtitleStreams.length > 1,
    hasMultipleLanguages: languages.length > 1,
    hasPictureSubtitles: subtitleStreams.some((stream) => PICTURE_SUBTITLE_CODECS.includes(stream?.codec_name)),
    languages,
    codecs,
  };

  return subtitleInfo;
}

function analyzeAttachmentStreams(attachmentStreams) {
  const attachmentInfo = {
    items: attachmentStreams,
    count: attachmentStreams.length,
    hasAttachments: attachmentStreams.length > 0,
    mimeTypes: getUniqueValues(attachmentStreams, (stream) => stream?.tags?.mimetype || stream?.codec_name || 'unknown'),
  };

  return attachmentInfo;
}

function analyzeChapters(mediaInfoTracks) {
  const chapters = mediaInfoTracks.filter((track) => track['@type'] === 'Menu');

  const chapterInfo = {
    chapters,
    count: chapters.length,
    hasChapters: chapters.length > 0,
  };

  return chapterInfo;
}

// Filename parsing follows the Radarr/Sonarr naming formats used by this workflow.
// Radarr movies include title, release year, optional edition tags, IMDb ID, quality,
// media info, audio languages, and subtitle language hints. Sonarr episodes include
// series title/year, TVDB ID, season/episode, optional anime absolute episode,
// episode title, quality/media info, audio languages, and subtitle language hints.
function analyzeMediaInfo(fileNameNoExtension, mediaInfoTracks) {
  const nameYearMatch = fileNameNoExtension.match(/(.+?) \((\d{4})\)/);
  const tvdbIdMatch = fileNameNoExtension.match(/\[tvdbid-(\d+)]/i) || fileNameNoExtension.match(/tvdbid-(\d+)/i);
  const imdbIdMatch = fileNameNoExtension.match(/\[imdb-(tt\d+)]/i) || fileNameNoExtension.match(/imdb-(tt\d+)/i);
  const seasonEpisodeMatch = fileNameNoExtension.match(/s(\d{2})e(\d{1,3})/i);
  const absoluteEpisodeMatch = fileNameNoExtension.match(/s\d{2}e\d{1,3} - (\d{3})/i);
  const resolutionMatch = fileNameNoExtension.match(/(2160p|4k|1080p|720p|480p)/i);
  const hasTvdbEpisode = Boolean(tvdbIdMatch && seasonEpisodeMatch);
  const hasImdbId = Boolean(imdbIdMatch);

  let mediaType = 'Unknown';

  if (hasTvdbEpisode) {
    mediaType = 'TV Show';
  } else if (hasImdbId) {
    mediaType = 'Movie';
  }

  const mediaInfo = {
    type: mediaType,
    name: nameYearMatch?.[1] || '',
    year: nameYearMatch?.[2] || '',
    season: seasonEpisodeMatch?.[1] || '',
    episode: seasonEpisodeMatch?.[2] || '',
    absoluteEpisode: absoluteEpisodeMatch?.[1] || '',
    resolution: resolutionMatch?.[1] || '',
    imdbId: imdbIdMatch?.[1] || null,
    tvdbId: tvdbIdMatch?.[1] || null,
    tracks: mediaInfoTracks,
  };

  return mediaInfo;
}

function createAnalysisSummary(fileInfo, streamInfo, chapterInfo, globalTags) {
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

function getUniqueValues(items, getValue) {
  const values = items.map(getValue);
  const uniqueValues = [...new Set(values)];

  return uniqueValues;
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
