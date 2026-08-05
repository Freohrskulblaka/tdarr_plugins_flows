/* === Check Function === */
function checkFile(file, userInputs) {
    // Default response object
    let res = {
        validFile: true,
        message: '',
        fileInfo: {
            fileContainer: '', // e.g., mkv, mp4, avi
            fileMedium: '', // e.g., video, audio, subtitle
            fileName: '', // e.g., "Better Call Saul (2015)..."
            fileNameNoExt: '', // e.g., "Better Call Saul (2015)"
            fileExtension: '', // e.g., .mkv, .mp4, .avi
            useGenpts: false,
            fileContentType: '', // 'movie' or 'tvshow'
            fileNeedsRemux: false,
            video: {
                hasVideoStream: false,
                hasVideoTitle: false,
                hasMultipleVideoStreams: false,
                hasInvalidDuration: false,
                videoStreamCount: 0,
                videoStreamIndices: [],
                videoStreams: [],
            },
            audio: {
                hasAudioStream: false,
                hasMultipleAudioStreams: false,
                hasMultipleAudioLanguages: false,
                hasUntaggedAudioStreams: false,
                audioStreamCount: 0,
                audioStreams: [],
                audioLanguages: [],
                audioChannels: [],
                audioCodec: [],
            },
            subtitle: {
                hasSubtitleStream: false,
                hasMultipleSubtitleStreams: false,
                hasMultipleSubtitleLanguages: false,
                hasPictureSubtitles: false,
                subtitleStreamCount: 0,
                subtitleStreams: [],
                subtitleLanguages: [],
                subtitleTypes: [],
            },
            attachments: {
                hasAttachments: false,
                attachmentCount: 0,
            },
            chapters: {
                hasChapters: false,
            },
            mediaInfo: {
                mediaName: '',
                mediaYear: '',
                mediaType: '', // TV Show or Movie
                mediaSeason: '',
                mediaEpisode: '',
                mediaResolution: '',
                tvdbId: null,
                imdbId: null,
                tracks: [],
            },
        },
    };

    // #region File General Validation and Information
    // Extract file medium
    const fileMedium = file?.fileMedium || '';
    res.fileInfo.fileMedium = fileMedium;

    // Check if the file is a video
    if (fileMedium !== 'video') {
        res.validFile = false;
        res.message += '→ The file is not a valid video file. \n';
        return res;
    }
    
    // General file information
    res.fileInfo.fileContainer = file?.container || '';
    res.fileInfo.fileName = file?.meta?.FileName || '';
    res.fileInfo.fileNameNoExt = res.fileInfo.fileName.replace(/\.[^/.]+$/, ''); // Remove file extension
    res.fileInfo.fileExtension = file?.container ? `.${file.container}` : '';
    res.message += '→ The file is a valid video file. \n';
    res.message += `→→ File Container: ${res.fileInfo.fileContainer}\n`;
   
    // Check for invalid duration
    if (file?.ffProbeData?.streams) {
        const hasInvalidDuration = file.ffProbeData.streams.some((stream) => !stream.duration || stream.duration === 'N/A');
        if (hasInvalidDuration) {
            res.fileInfo.video.hasInvalidDuration = true;
            res.fileInfo.useGenpts = true;
            res.message += '→→ The file has invalid duration timestamps. The genpts flag will be used. \n';
        }
    }
    // #endregion

    // #region Remux Check
    const targetContainer = userInputs?.targetFileType || 'mkv';
    if (res.fileInfo.fileContainer !== targetContainer) {
        res.fileInfo.fileNeedsRemux = true;
        res.message += `→→ The file container (${res.fileInfo.fileContainer}) does not match the target (${targetContainer}). Remuxing is required.\n`;
        return res; // No need to check further if remuxing is required
    } else {
        res.message += `→→ The file container (${res.fileInfo.fileContainer}) matches the target (${targetContainer}). No remuxing required.\n`;
    }
    // #endregion
    
    // #region Video Stream Checks
    // Video stream checks
    const videoStreams = file?.ffProbeData?.streams?.filter((stream) => stream.codec_type === 'video') || [];
    res.fileInfo.video.videoStreams = videoStreams;
    res.fileInfo.video.videoStreamCount = videoStreams.length;
    res.fileInfo.video.hasVideoStream = videoStreams.length > 0;
    res.fileInfo.video.hasMultipleVideoStreams = videoStreams.length > 1;
    res.fileInfo.video.hasVideoTitle = videoStreams.some((stream) => stream?.tags?.title); // Check if there's a title in the first video stream
    res.fileInfo.video.videoStreamIndices = videoStreams.map((stream) => stream.index || -1);

    // Log information
    if (res.fileInfo.video.videoStreamCount > 0) {
        res.message += `→→ Video Stream Count: ${res.fileInfo.video.videoStreamCount}\n`;
        res.message += `→→ Video Stream Indices: ${res.fileInfo.video.videoStreamIndices.join(', ')}\n`;
        res.message += `→→ Video Titles Present: ${res.fileInfo.video.hasVideoTitle ? 'Yes' : 'No'}\n`;
    } else {
        res.message += '→→ No video streams detected.\n';
        return res; // No need to check further if there are no video streams
    }
    // #endregion

    // #region Audio Stream Checks
    // Audio stream checks
    const audioStreams = file?.ffProbeData?.streams?.filter((stream) => stream.codec_type === 'audio') || [];
    res.fileInfo.audio.audioStreams = audioStreams;
    res.fileInfo.audio.audioStreamCount = audioStreams.length;
    res.fileInfo.audio.hasAudioStream = audioStreams.length > 0;
    res.fileInfo.audio.hasMultipleAudioStreams = audioStreams.length > 1;

    // Extract unique audio languages
    res.fileInfo.audio.audioLanguages = [...new Set(audioStreams.map((stream) => stream?.tags?.language || 'und'))];
    res.fileInfo.audio.hasMultipleAudioLanguages = res.fileInfo.audio.audioLanguages.length > 1;

    // Check for untagged audio streams using audioLanguages array
    res.fileInfo.audio.hasUntaggedAudioStreams = res.fileInfo.audio.audioLanguages.includes('und');

    // Extract unique audio channels
    res.fileInfo.audio.audioChannels = [...new Set(audioStreams.map((stream) => stream?.channels || 'unknown'))];

    // Extract unique audio codecs
    res.fileInfo.audio.audioCodec = [...new Set(audioStreams.map((stream) => stream?.codec_name || 'unknown'))];

    // Log information
    if (res.fileInfo.audio.audioStreamCount > 0) {
        res.message += `→→ Audio Stream Count: ${res.fileInfo.audio.audioStreamCount}\n`;
        res.message += `→→ Audio Languages: ${res.fileInfo.audio.audioLanguages.join(', ')}\n`;
        res.message += `→→ Audio Channels: ${res.fileInfo.audio.audioChannels.join(', ')}\n`;
        res.message += `→→ Audio Codecs: ${res.fileInfo.audio.audioCodec.join(', ')}\n`;
        res.message += `→→ Untagged Audio Streams: ${res.fileInfo.audio.hasUntaggedAudioStreams ? 'Yes' : 'No'}\n`;
    } else {
        res.message += '→→ No audio streams detected.\n';
        return res; // No need to check further if there are no audio streams
    }
    // #endregion

    // #region Subtitle Stream Checks
    // Subtitle stream checks
    const subtitleStreams = file?.ffProbeData?.streams?.filter((stream) => stream.codec_type === 'subtitle') || [];
    res.fileInfo.subtitle.subtitleStreams = subtitleStreams;
    res.fileInfo.subtitle.subtitleStreamCount = subtitleStreams.length;
    res.fileInfo.subtitle.hasSubtitleStream = subtitleStreams.length > 0;
    res.fileInfo.subtitle.hasMultipleSubtitleStreams = subtitleStreams.length > 1;

    // Extract unique subtitle languages
    res.fileInfo.subtitle.subtitleLanguages = [...new Set(subtitleStreams.map((stream) => stream?.tags?.language || 'und'))];
    res.fileInfo.subtitle.hasMultipleSubtitleLanguages = res.fileInfo.subtitle.subtitleLanguages.length > 1;

    // Check for picture-based subtitles
    const pictureSubtitleCodecs = ['hdmv_pgs_subtitle', 'dvd_subtitle'];
    res.fileInfo.subtitle.hasPictureSubtitles = subtitleStreams.some((stream) => pictureSubtitleCodecs.includes(stream?.codec_name));

    // Extract unique subtitle types (e.g., text, bitmap)
    res.fileInfo.subtitle.subtitleTypes = [...new Set(subtitleStreams.map((stream) => stream?.codec_name || 'unknown'))];

    // Log information
    if (res.fileInfo.subtitle.subtitleStreamCount > 0) {
        res.message += `→→ Subtitle Stream Count: ${res.fileInfo.subtitle.subtitleStreamCount}\n`;
        res.message += `→→ Subtitle Languages: ${res.fileInfo.subtitle.subtitleLanguages.join(', ')}\n`;
        res.message += `→→ Subtitle Types: ${res.fileInfo.subtitle.subtitleTypes.join(', ')}\n`;
        res.message += `→→ Picture-Based Subtitles: ${res.fileInfo.subtitle.hasPictureSubtitles ? 'Yes' : 'No'}\n`;
    } else {
        res.message += '→→ No subtitle streams detected.\n';
    }
    // #endregion

    // #region Attachments Check
    // Attachments check
    const attachmentStreams = file?.ffProbeData?.streams?.filter((stream) => stream.codec_type === 'attachment') || [];
    res.fileInfo.attachments.hasAttachments = attachmentStreams.length > 0;
    res.fileInfo.attachments.attachmentCount = attachmentStreams.length;

    // Log information
    if (res.fileInfo.attachments.hasAttachments) {
        res.message += `→→ Attachment Count: ${res.fileInfo.attachments.attachmentCount}\n`;
        res.message += '→→ Attachments detected. Non font attachments will be removed.\n';
    } else {
        res.message += '→→ No attachments detected.\n';
    }
    // #endregion

    // #region Chapters Check
    // Chapters check
    const chapters = file?.mediaInfo?.track?.find((track) => track['@type'] === 'Menu') || {};
    res.fileInfo.chapters.hasChapters = !!Object.keys(chapters).length;

    // Log information
    if (res.fileInfo.chapters.hasChapters) {
        res.message += '→→ Chapters detected in the file. Chapters will be passed to the output.\n';
    } else {
        res.message += '→→ No chapters detected in the file. Chapters will be added.\n';
    }
    // #endregion

    // #region MediaInfo Check
    // Extract media information
    const fileName = res.fileInfo.fileNameNoExt;

    // Extract media name and year
    const nameYearMatch = fileName.match(/(.+?) \((\d{4})\)/);
    res.fileInfo.mediaInfo.mediaName = nameYearMatch?.[1] || '';
    res.fileInfo.mediaInfo.mediaYear = nameYearMatch?.[2] || '';

    // Determine media type (TV Show or Movie)
    if (fileName.includes('tvdbid') && fileName.match(/- s\d{2}e\d{1,3} -/i)) {
        res.fileInfo.mediaInfo.mediaType = 'TV Show';

        // Extract TVDB ID
        const tvdbIdMatch = fileName.match(/\[tvdbid-(\d+)]/i);
        res.fileInfo.mediaInfo.tvdbId = tvdbIdMatch?.[1] || null;

        // Extract season and episode numbers
        const seasonEpisodeMatch = fileName.match(/s(\d{2})e(\d{1,3})/i); // Matches episodes with 1 to 3 digits
        res.fileInfo.mediaInfo.mediaSeason = seasonEpisodeMatch?.[1] || '';
        res.fileInfo.mediaInfo.mediaEpisode = seasonEpisodeMatch?.[2] || '';
    } else if (fileName.includes('imdb-tt')) {
        res.fileInfo.mediaInfo.mediaType = 'Movie';

        // Extract IMDb ID
        const imdbIdMatch = fileName.match(/\[imdb-(tt\d+)]/i);
        res.fileInfo.mediaInfo.imdbId = imdbIdMatch?.[1] || null;
    } else {
        res.fileInfo.mediaInfo.mediaType = 'Unknown';
    }

    // Extract resolution
    const resolutionMatch = fileName.match(/(1080p|720p|4k|2160p|480p)/i);
    res.fileInfo.mediaInfo.mediaResolution = resolutionMatch?.[1] || '';

    // Collect mediaInfo tracks
    res.fileInfo.mediaInfo.tracks = file?.mediaInfo?.track || [];

    // Log information
    res.message += `→→ Media Type: ${res.fileInfo.mediaInfo.mediaType}\n`;
    if (res.fileInfo.mediaInfo.mediaType === 'TV Show') {
        res.message += `→→ Show Name: ${res.fileInfo.mediaInfo.mediaName}\n`;
        res.message += `→→ Show Year: ${res.fileInfo.mediaInfo.mediaYear}\n`;
        res.message += `→→ TVDB ID: ${res.fileInfo.mediaInfo.tvdbId || 'Not found'}\n`;
        res.message += `→→ Season: ${res.fileInfo.mediaInfo.mediaSeason}, Episode: ${res.fileInfo.mediaInfo.mediaEpisode}\n`;
    } else if (res.fileInfo.mediaInfo.mediaType === 'Movie') {
        res.message += `→→ Movie Name: ${res.fileInfo.mediaInfo.mediaName}\n`;
        res.message += `→→ Movie Year: ${res.fileInfo.mediaInfo.mediaYear}\n`;
        res.message += `→→ IMDb ID: ${res.fileInfo.mediaInfo.imdbId || 'Not found'}\n`;
    }
    res.message += `→→ Media Resolution: ${res.fileInfo.mediaInfo.mediaResolution}\n`;
    // #endregion

    // Final message if no issues are detected
    if (res.validFile && !res.fileInfo.fileNeedsRemux) {
        res.message += '→ The file passed all checks and does not require remuxing.\n';
    }

    return res;    
}