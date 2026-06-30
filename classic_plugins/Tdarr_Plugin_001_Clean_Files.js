/* === Global Imports === */
const fs = require('fs');
const crypto = require('crypto');
const proc = require('child_process');

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
        res.message += formatMessage('error', 'The file is not a valid video file.');
        return res;
    }
    
    // General file information
    res.fileInfo.fileContainer = file?.container || '';
    res.fileInfo.fileName = file?.meta?.FileName || '';
    res.fileInfo.fileNameNoExt = res.fileInfo.fileName.replace(/\.[^/.]+$/, ''); // Remove file extension
    res.fileInfo.fileExtension = file?.container ? `.${file.container}` : '';
    res.message += formatMessage('success','The file is a valid video file.');
    res.message += formatMessage('info', `File Container: ${res.fileInfo.fileContainer}`);
   
    // Check for invalid duration
    if (file?.ffProbeData?.streams) {
        const hasInvalidDuration = file.ffProbeData.streams.some((stream) => !stream.duration || stream.duration === 'N/A');
        if (hasInvalidDuration) {
            res.fileInfo.video.hasInvalidDuration = true;
            res.fileInfo.useGenpts = true;
            res.message +=  formatMessage('info', 'The file has invalid duration timestamps. The genpts flag will be used.');
        }
    }
    // #endregion

    // #region Remux Check
    const targetContainer = userInputs?.targetFileType || 'mkv';
    if (res.fileInfo.fileContainer !== targetContainer) {
        res.fileInfo.fileNeedsRemux = true;
        res.message += formatMessage('info', `The file container (${res.fileInfo.fileContainer}) does not match the target (${targetContainer}). Remuxing is required.`);
        return res; // No need to check further if remuxing is required
    } else {
        res.message += formatMessage('success', `The file container (${res.fileInfo.fileContainer}) matches the target (${targetContainer}). No remuxing required.`);
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
    res.fileInfo.video.videoStreamIndices = videoStreams.map((stream) => stream.index ?? -1); // Extract stream indices, default to -1 if missing

    // Log information
    if (res.fileInfo.video.videoStreamCount > 0) {
        res.message += formatMessage('info', `Video Stream Count: ${res.fileInfo.video.videoStreamCount}`);
        res.message += formatMessage('info', `Video Stream Indices: ${res.fileInfo.video.videoStreamIndices.join(', ')}`);
        res.message += formatMessage('info', `Video Titles Present: ${res.fileInfo.video.hasVideoTitle ? 'Yes' : 'No'}`);
    } else {
        res.message += formatMessage('error', 'No video streams detected.');
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
        res.message += formatMessage('info', `Audio Stream Count: ${res.fileInfo.audio.audioStreamCount}`);
        res.message += formatMessage('info', `Audio Languages: ${res.fileInfo.audio.audioLanguages.join(', ')}`);
        res.message += formatMessage('info', `Audio Channels: ${res.fileInfo.audio.audioChannels.join(', ')}`);
        res.message += formatMessage('info', `Audio Codecs: ${res.fileInfo.audio.audioCodec.join(', ')}`);
        res.message += formatMessage('info', `Untagged Audio Streams: ${res.fileInfo.audio.hasUntaggedAudioStreams ? 'Yes' : 'No'}`);
    } else {
        res.message += formatMessage('error', '→→ No audio streams detected.');
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
        res.message += formatMessage('info', `Subtitle Stream Count: ${res.fileInfo.subtitle.subtitleStreamCount}`);
        res.message += formatMessage('info', `Subtitle Languages: ${res.fileInfo.subtitle.subtitleLanguages.join(', ')}`);
        res.message += formatMessage('info', `Subtitle Types: ${res.fileInfo.subtitle.subtitleTypes.join(', ')}`);
        res.message += formatMessage('info', `Picture-Based Subtitles: ${res.fileInfo.subtitle.hasPictureSubtitles ? 'Yes' : 'No'}`);
    } else {
        res.message += formatMessage('warning', 'No subtitle streams detected.');
    }
    // #endregion

    // #region Attachments Check
    // Attachments check
    const attachmentStreams = file?.ffProbeData?.streams?.filter((stream) => stream.codec_type === 'attachment') || [];
    res.fileInfo.attachments.hasAttachments = attachmentStreams.length > 0;
    res.fileInfo.attachments.attachmentCount = attachmentStreams.length;

    // Log information
    if (res.fileInfo.attachments.hasAttachments) {
        res.message += formatMessage('info', `Attachment Count: ${res.fileInfo.attachments.attachmentCount}`);
        res.message += formatMessage('info', 'Attachments detected. Non font attachments will be removed.');
    } else {
        res.message += formatMessage('info', 'No attachments detected.');
    }
    // #endregion

    // #region Chapters Check
    // Chapters check
    const chapters = file?.mediaInfo?.track?.find((track) => track['@type'] === 'Menu') || {};
    res.fileInfo.chapters.hasChapters = !!Object.keys(chapters).length;

    // Log information
    if (res.fileInfo.chapters.hasChapters) {
        res.message += formatMessage('success', 'Chapters detected in the file. Chapters will be passed to the output.');
    } else {
        res.message += formatMessage('info', 'No chapters detected in the file. Chapters will be added.');
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
    res.message += formatMessage('info', `Media Type: ${res.fileInfo.mediaInfo.mediaType}`);
    if (res.fileInfo.mediaInfo.mediaType === 'TV Show') {
        res.message += formatMessage('info', `Show Name: ${res.fileInfo.mediaInfo.mediaName}`);
        res.message += formatMessage('info', `Show Year: ${res.fileInfo.mediaInfo.mediaYear}`);
        res.message += formatMessage('info', `TVDB ID: ${res.fileInfo.mediaInfo.tvdbId || 'Not found'}`);
        res.message += formatMessage('info', `Season: ${res.fileInfo.mediaInfo.mediaSeason}, Episode: ${res.fileInfo.mediaInfo.mediaEpisode}`);
    } else if (res.fileInfo.mediaInfo.mediaType === 'Movie') {
        res.message += formatMessage('info', `Movie Name: ${res.fileInfo.mediaInfo.mediaName}`);
        res.message += formatMessage('info', `Movie Year: ${res.fileInfo.mediaInfo.mediaYear}`);
        res.message += formatMessage('info', `IMDb ID: ${res.fileInfo.mediaInfo.imdbId || 'Not found'}`);
    }
    res.message += formatMessage('info', `Media Resolution: ${res.fileInfo.mediaInfo.mediaResolution}`);
    // #endregion

    // Final message if no issues are detected
    if (res.validFile && !res.fileInfo.fileNeedsRemux) {
        res.message += formatMessage('success', 'The file passed all checks and does not require remuxing.');
    }

    return res;    
}

/* === Stats Update Function === */
function ensureStatsUpdated(file) {
    // Default response object
    let res = { message: '', statsAreCurrent: false };

    // Ensure the file container is MKV
    if (file.container !== 'mkv') {
        res.message += ' → File is not in MKV format; no stats update required. \n';
        return res;
    }

    // Define date thresholds
    const defaultDate = Date.parse(new Date(1970, 1).toISOString()); // A far past date
    const statsThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    // Get statistics writing date
    let statsDate = defaultDate;
    const firstStreamTags = file.ffProbeData?.streams?.[0]?.tags;

    if (firstStreamTags && firstStreamTags['_STATISTICS_WRITING_DATE_UTC-eng']) {
        statsDate = Date.parse(`${firstStreamTags['_STATISTICS_WRITING_DATE_UTC-eng']} GMT`);
    }

    // Check if stats are current
    if (statsDate >= statsThreshold) {
        res.statsAreCurrent = true;
        res.message += ' → File stats are up to date. \n';
        res.message += ` → Stats Threshold: ${new Date(statsThreshold).toISOString()}, Stats Date: ${new Date(statsDate).toISOString()}\n`;
    } else {
        res.message += ' → File stats are outdated; updating stats. \n';
    }

    // Update stats if they are outdated
    if (!res.statsAreCurrent) {
        if (!file._id) {
            res.message += ' → Cannot update stats: Missing file ID. \n';
            return res;
        }

        try {
            proc.execSync(`mkvpropedit --add-track-statistics-tags "${file._id}"`);
            res.message += ' → Stats successfully updated. \n';
        } catch (error) {
            res.message += ` → Failed to update stats: ${error.message} \n`;
        }
    }

    return res;
}

/* === Processing Functions === */
function removeImages(file) {
    // Default response object
    let res = { processFile: false, preset: '', message: '' };
    
    // List of non-video codecs that are images
    let nonVideoCodecs = ['mjpeg', 'png', 'gif', 'image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/bmp', 'image/webp', 'image/tiff', 'image/x-ms-bmp'];

    // Grab the video streams from the file
    const videoStreams = file.ffProbeData?.streams?.filter(stream => stream.codec_type === 'video') || [];

    // Check if there are more than 1 video stream
    if (videoStreams.length > 1) {
        // Track if any image tracks are found
        let hasImageTracks = false;

        for (let i = 0; i < videoStreams.length; i++) {
            let codecName = videoStreams[i].codec_name?.toLowerCase();
            let tagsMime = videoStreams[i].tags?.['MIMETYPE']?.toLowerCase();

            if ((codecName && nonVideoCodecs.includes(codecName)) || (tagsMime && nonVideoCodecs.includes(tagsMime))) {
                hasImageTracks = true;
                res.processFile = true;
                res.preset += ` -map -v:${i} `;
                res.message += ` → The ${codecName || tagsMime} track at index ${i} is identified as an image and will be removed. \n`;
            } else {
                res.message += ` → The video track at index ${i} is not an image. \n`;
            }
        }

        if (!hasImageTracks) {
            res.message += ' → No image tracks were detected among the video streams. \n';
        }
    }

    if (!res.processFile) {
        res.message += ' → Image removal process completed, no image tracks were detected. \n';
    }

    return res;
}

function cleanTitles(file, options = { cleanFileTitle: true, cleanStreamTitles: true }) {
    // Default response object
    let res = { processFile: false, preset: '', message: '' };

    // Grab the video streams from the file.
    const videoStreams = file.ffProbeData?.streams?.filter(stream => stream.codec_type === 'video') || [];

    // Grag the file info from the mediaInfo track.
    const fileInfo = file.mediaInfo?.track?.find(r => r['@type'] === 'General') || {};

    // Clean video stream titles
    if (options.cleanStreamTitles && videoStreams.length > 0) {
        let hasVideoTitle = false;

        for (let i = 0; i < videoStreams.length; i++) {
            let tagsTitle = videoStreams[i]?.tags?.title;

            if (tagsTitle?.trim()) {
                hasVideoTitle = true;
                res.processFile = true;
                res.preset += ` -metadata:s:v:${i} title= `;
                res.message += ` → Removing video title from the video track at index ${i}. \n`;
            }
        }

        if (!hasVideoTitle) {
            res.message += ' → No video titles were detected among the video streams. \n';
        }
    }

    // Clean file title
    if (options.cleanFileTitle) {
        let fileTitle = fileInfo.Title?.trim() || '';
        if (fileTitle) {
            res.processFile = true;
            res.preset += ` -metadata title= `;
            res.message += ' → Removing title from the file. \n';
        } else {
            res.message += ' → No title was detected in the file. \n';
        }
    }

    // Summary message in case no titles needed cleaning
    if (!res.processFile) {
        res.message += ' → No titles needed cleaning. \n';
    }
    
    return res;
}

function removeAttachments(file, options = { removeNonFontAttachments: true }) {
    // Default response object
    let res = { processFile: false, preset: '', message: '' };

    // Grab the attachment streams from the file
    const attachmentStreams = file.ffProbeData?.streams?.filter(stream => stream.codec_type === 'attachment') || [];

    // Check if there are any attachment streams
    if (attachmentStreams.length > 0) {
        for (let i = 0; i < attachmentStreams.length; i++) {
            let tagsMime = attachmentStreams[i]?.tags?.['MIMETYPE']?.toLowerCase();

            if (tagsMime) {
                if (options.removeNonFontAttachments && !tagsMime.startsWith('font')) {
                    res.processFile = true;
                    res.preset += ` -map -0:t:${i} `;
                    res.message += ` → Removing non-font attachment at index ${i} with MIME type ${tagsMime}. \n`;
                }
            } else {
                res.message += ` → Attachment at index ${i} has no MIME type and will be skipped. \n`;
            }
        }
    
        if (!res.processFile) {
            res.message += ' → No non-font attachments were detected among the attachment streams. \n';
        }
    } else {
        res.message += ' → No attachment streams were detected in the file. \n';
    }
    return res;
}

function removeCommentary(file) {
    // Default response object
    let res = { processFile: false, preset: '', message: '' };

    // Lets define a list of commentary indicators to look for in the stream tags
    let commentaryIndicators = [
        // English indicators
        'commentary', 'director commentary', 'audio commentary',
        'description', 'descriptive', 'director', 'narration', 
        'narrative', 'narrator', 'producer commentary',
        'behind the scenes', 'voiceover', 'audio description',
    
        // Spanish indicators
        'comentarios', 'comentarios del director', 'audio comentarios',
        'descripcion', 'descriptivo', 'director', 'narracion', 
        'narrativa', 'narrador', 'comentarios del productor',
        'detrás de las cámaras', 'narración de voz', 'audio descripción'
    ];

    // Object with the commands needed to remove the audio and subtitle commentary tracks
    let commands = {audio : ' -map -0:a:', subtitle: ' -map -0:s:'};
    
    // Grab the audio streams from the file
    const audioStreams = file.ffProbeData?.streams?.filter(stream => stream.codec_type === 'audio') || [];

    // Lets process the audio streams
    if (audioStreams.length > 0) {
        if (audioStreams.length === 1) {
            res.message += ' → Only one audio track detected, skipping audio commentary removal. \n';
        } else {
            audioStreams.forEach((stream, i) => {
                let description = stream.tags?.description?.toLowerCase() || '';
                let title = stream.tags?.title?.toLowerCase() || '';
                let language = stream.tags?.language?.toLowerCase() || '';
                let hasCommentaryTag = commentaryIndicators.some(tag => description.includes(tag));
                let hasCommentaryLang = commentaryIndicators.some(tag => language.includes(tag));
                let hasCommentaryTitle = commentaryIndicators.some(tag => title.includes(tag));

                if ( hasCommentaryTag || hasCommentaryLang || hasCommentaryTitle) {
                    res.processFile = true;
                    res.preset += commands.audio + `${i} `;
                    res.message += ` → Removing audio commentary track at index ${i} with description: "${description}", and title: "${title}". \n`;
                }
            });
        }
    } else {
        res.message += ' → No audio streams were detected in the file. \n';
    }

    // Grab the subtitle streams from the file
    const subtitleStreams = file.ffProbeData?.streams?.filter(stream => stream.codec_type === 'subtitle') || [];

    // Lets process the subtitle streams
    if (subtitleStreams.length > 0) {
        subtitleStreams.forEach((stream, i) => {
            let description = stream.tags?.description?.toLowerCase() || '';
            let language = stream.tags?.language?.toLowerCase() || '';
            let title = stream.tags?.title?.toLowerCase() || '';
            let hasCommentaryTag = commentaryIndicators.some(tag => description.includes(tag));
            let hasCommentaryLang = commentaryIndicators.some(tag => language.includes(tag));
            let hasCommentaryTitle = commentaryIndicators.some(tag => title.includes(tag));
    
            if ( hasCommentaryTag || hasCommentaryLang || hasCommentaryTitle) {
                res.processFile = true;
                res.preset += commands.subtitle + `${i} `;
                res.message += ` → Removing subtitle commentary track at index ${i} with description: "${description}", and title: "${title}". \n`;
            }
        });
    } else {
        res.message += ' → No subtitle streams were detected in the file. \n';
    }

    if (!res.processFile) {
        res.message += ' → No commentary tracks were detected or removed. \n';
    }

    return res;
}

function addChapters(file, librarySettings, options = { addChapters: true }) {
    // Default response object
    let res = {processFile: false, chaptersCommand: '', message: ''};

    // Get a chapter list from the file
    const fileChapters = file.mediaInfo?.track?.find(r => r['@type'] === 'Menu');

    // Check if the file has chapters
    if (fileChapters) {
        res.message += ' → File already contains chapters. Passing chapters to the output. \n';
        res.chaptersCommand += '-map_chapters 0 ';
        return res;
    }

    if (options.addChapters && file.container === 'mkv') {
        res.message += ' → Adding chapters to the file. \n';
        
        const totalDuration = file.meta.Duration; // Total duration in seconds
        const minimumChapters = 10;
        const maxChapterDuration = 300; // Max duration of 5 minutes per chapter

        // Calculate the chapter duration dynamically
        let chapterDuration = totalDuration > 1200 ? Math.min(totalDuration / minimumChapters, maxChapterDuration) : totalDuration / minimumChapters;

        // Ensure it's an integer
        chapterDuration = Math.floor(chapterDuration);

        // Create the chapter variables.
        let intChapNum = 0;
        let strChapterFile = '';
        let strChapterFileLoc = `${librarySettings.cache}/${crypto.createHash('md5').update(file._id).digest('hex')}.txt`;

        for (let i = 0; i < totalDuration; i += chapterDuration) {
            intChapNum += 1;
            let chapterNum = String(intChapNum).padStart(2, '0');
            let timeString = new Date(i * 1000).toISOString().substring(11, 23);
            strChapterFile += `CHAPTER${chapterNum}=${timeString} \n`;
            strChapterFile += `CHAPTER${chapterNum}NAME=CHAPTER ${chapterNum} \n`;
        }

        // Add a final chapter 1 second before the end
        intChapNum += 1;
        let finalChapterNum = String(intChapNum).padStart(2, '0');
        let finalTimeString = new Date((Math.floor(totalDuration) - 1) * 1000).toISOString().substring(11, 23);
        strChapterFile += `CHAPTER${finalChapterNum}=${finalTimeString} \n`;
        strChapterFile += `CHAPTER${finalChapterNum}NAME=CHAPTER ${finalChapterNum} \n`;
         
        // Write chapter file to cache
        fs.writeFileSync(strChapterFileLoc, strChapterFile);
        res.message += ` → Chapter file created at ${strChapterFileLoc}. \n`;

        // Add chapters to the file
        try {
            proc.execSync(`mkvpropedit "${file._id}" --chapters "${strChapterFileLoc}"`);
            res.message += ' → Chapters successfully added to the file. \n';
            res.processFile = true;
        } catch (error) {
            res.message += ` → Failed to add chapters: ${error.message}. \n`;
        } finally {
            // Remove the temporary chapter file
            if (fs.existsSync(strChapterFileLoc)) {
                fs.unlinkSync(strChapterFileLoc);
                res.message += ' → Temporary chapter file removed. \n';
            }
        }
    } else {
        res.message += ' → Chapter creation skipped: File does not meet criteria or AddChapters is disabled. \n';
    }

    return res;
}

/* === Language Processing Functions === */
// function getISO3Code(languageName) {
//     const ISO6393 = require('iso-639-3/iso-639-3.json');
//     const iso1Code = require('iso-639-1').getCode(languageName.toLowerCase()) || 'und';
//     const iso3Entry = ISO6393.find(entry => entry.iso6391 === iso1Code);
//     return iso3Entry ? iso3Entry.iso6393 : 'und';
// }

function getISO3Code(languageName) {
    const langs = require('langs');
    // Capitalize first letter
    const capitalizedName = languageName.charAt(0).toUpperCase() + languageName.slice(1).toLowerCase();
    const langData = langs.where("name", capitalizedName) || langs.where("name", languageName.toLowerCase());
    return langData ? langData["3"] : 'und'; // "3" is the ISO 639-3 code
}

async function getOriginalLanguage(fileDetails, inputs) {
    // Default response object
    let res = { processFile: false, message: '', originalLanguage: null };

    try {
        const { mediaInfo } = fileDetails;
        
        if (mediaInfo.mediaType === 'TV Show') {
            const tvdbId = mediaInfo.tvdbId || null;
           
            if(tvdbId) {
                res.message += ` →→ Retriving original language for TV show ${mediaInfo.mediaName} (${mediaInfo.mediaYear}) with TVDB ID: ${tvdbId}.\n`;
                
                if (!inputs.Sonnar || !inputs.SonnarAPI) {
                    res.message += ' →→→ Missing required parameters for Sonarr request. Skipping language retrieval.\n';
                    return res;
                }

                try {
                    // Build the Sonarr API URL
                    const sonarrURL = `http://${inputs.Sonnar}/api/v3/series?tvdbId=${tvdbId}&includeSeasonImages=false&apikey=${inputs.SonnarAPI}`
                
                    // Perform the API request
                    const response = await fetch(sonarrURL);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    
                    // Validate the response and extract the original language
                    const seriesData = (await response.json())?.[0];
            
                    if (seriesData?.originalLanguage?.name) {
                        const originalLanguageName = seriesData.originalLanguage.name.toLowerCase();
                        const iso3Code = getISO3Code(originalLanguageName);
                        res.originalLanguage = iso3Code
                        res.message += ` →→ Fetched original language: ${originalLanguageName} (ISO-3: ${res.originalLanguage}).\n`;
                    } else {
                        res.message += ' →→→ Original language not found in the series data.\n';
                    }
                } catch (error) {
                    res.message += ` →→→ Error fetching original language from Sonarr: ${error.message}\n`;
                }
            }      
        } else if (mediaInfo.mediaType === 'Movie') {
            const imdbId = mediaInfo.imdbId || null;

            if (imdbId) {
                res.message += ` →→ Retriving original language for movie ${mediaInfo.mediaName} (${mediaInfo.mediaYear}) IMDb ID: ${imdbId}.\n`;

                if (!inputs.Radarr || !inputs.RadarrAPI) {
                    res.message += ' →→→ Missing required parameters for Radarr request. Skipping language retrieval.\n';
                    return res;
                }

                try {
                    // Build the Radarr API URL
                    const radarrURL = `http://${inputs.Radarr}/api/v3/movie/lookup/imdb?imdbId=${imdbId}&apikey=${inputs.RadarrAPI}`;
            
                    // Perform the API request
                    const response = await fetch(radarrURL);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
                    // Validate the response and extract the original language
                    const movieData = await response.json();
            
                    if (movieData?.originalLanguage?.name) {
                        const originalLanguageName = movieData.originalLanguage.name.toLowerCase();
                        const iso3Code = getISO3Code(originalLanguageName);
            
                        res.originalLanguage = iso3Code;
                        res.message += ` →→ Fetched original language: ${originalLanguageName} (ISO-3: ${res.originalLanguage}).\n`;
                    } else {
                        res.message += ' →→→ Original language not found in the movie data.\n';
                    }
                } catch (error) {
                    res.message += ` →→→ Error fetching original language from Radarr: ${error.message}\n`;
                }
            }
        } else {
            res.message += ' →→ Media type is unknown. Skipping original language retrieval.\n';
        }
    } catch (error) {
        res.message += ` →→→ Error while retrieving original language: ${error.message}\n`;
    }

    return res;
}

async function processLanguages(fileDetails, inputs) {
    // #region General Information
    // Default response object
    let res = { processFile: false, preset: '', message: '' };
    
    // Define commands for tagging and removing streams
    let commands = {
        remove: {audio: ' -map -0:a:', subtitle: ' -map -0:s:'},
        tag: {audio: ' -metadata:s:a:', subtitle: ' -metadata:s:s:'},
    };

    // Parse wanted languages
    const wantedLangs = {
        audio: inputs.audioLangList.split(',').map(lang => lang.toLowerCase()),
        subtitle: inputs.subtitleLangList.split(',').map(lang => lang.toLowerCase())
    };

    // Store default language for und tracks
    const defaultLangs = {
        audio: wantedLangs.audio[0],
        subtitle: wantedLangs.subtitle[0]
    };
    // #endregion

    // #region Original Language Processing
    // Fetch the original language from external sources (Sonarr/Radarr)
    const originalLanguageData = await getOriginalLanguage(fileDetails, inputs);
    res.message += originalLanguageData.message;
 
    const originalLanguage = originalLanguageData.originalLanguage;
    if (originalLanguage && !wantedLangs.audio.includes(originalLanguage)) {
        res.message += ` → Adding original language (${originalLanguage}) to the wanted audio languages.\n`;
        wantedLangs.audio.push(originalLanguage);
    }
    // #endregion

    // #region Audio Processing
    // Process audio streams
    const { audioStreams, hasAudioStream, hasMultipleAudioLanguages } = fileDetails.audio;
       
    if (hasAudioStream) {
        if (!hasMultipleAudioLanguages) {
            res.message += ' → Only one audio language detected, skipping audio language removal. \n';
        } else {
            audioStreams.forEach((stream, i) => {
                let language = stream.tags?.language?.toLowerCase() || 'und';
                
                // Let's tag the und tracks
                if (language === 'und') {
                    res.processFile = true;
                    res.preset += `${commands.tag.audio}${i} language=${defaultLangs.audio} `;
                    res.message += ` → Tagging audio track at index ${i} with language ${defaultLangs.audio}. \n`;
                }

                if (language !== 'und' && !wantedLangs.audio.includes(language)) {
                    res.processFile = true;
                    res.preset += `${commands.remove.audio}${i} `;
                    res.message += ` → Removing audio track at index ${i} with language ${language}. \n`;
                }
            });
        }
    } else {
        res.message += ' → The file does not contain any audio streams.\n';
    }
    // #endregion

    // #region Subtitle Processing
    // Process subtitle streams
    const { subtitleStreams, hasSubtitleStream } = fileDetails.subtitle;
    
    if (hasSubtitleStream) {
        subtitleStreams.forEach((stream, i) => {
            let language = stream.tags?.language?.toLowerCase() || 'und';

            // Let's tag the und tracks
            if (language === 'und') {
                res.processFile = true;
                res.preset += `${commands.tag.subtitle}${i} language=${defaultLangs.subtitle} `;
                res.message += ` → Tagging subtitle track at index ${i} with language ${defaultLangs.subtitle}. \n`;
            }

            if (language !== 'und' && !wantedLangs.subtitle.includes(language)) {
                res.processFile = true;
                res.preset += `${commands.remove.subtitle}${i} `;
                res.message += ` → Removing subtitle track at index ${i} with language ${language}. \n`;
            }
        });

    } else {
        res.message += ' → The file does not contain any subtitle streams.\n';
    }
    // #endregion

    if (!res.processFile) {
        res.message += ' → The file already contains the desired audio and subtitle languages. \n';
    }

    return res;
}

function formatMessage(type, message) {
    const prefixMap = {
        success: '✔️ → ',  // For success messages
        error: '❌ → ',    // For error messages
        info: 'ℹ️ → ',     // For informational messages
        warning: '⚠️ ←→ ', // For warnings
    };
    const prefix = prefixMap[type] || '';
    let formattedMessage = `${prefix}${message}\n`;
    return formattedMessage;
}

// === Core Plugin Logic ===
function details() {
    return ({
        id: "Tdarr_Plugin_001_Clean_Files",
        Name: "Clean Video Files",
        Stage: "Pre-processing",
        Type: "Video, Audio, Subtitles",
        Operation: "Transcode",
        Description: "This plugin will clean video files by removing unwanted streams, attachments, titles, and adding chapters.",
        Version: "1.6",
        Tags: "pre-processing, ffmpeg, configurable",
        Inputs:[
            {
                name: 'targetFileType',
                type: 'string',
                defaultValue: 'mkv',
                inputUI: { type: 'dropdown', options: ['mkv', 'mp4']},
                tooltip: 'Select the desired output file format.'
            },
            {
                name: 'cleanFile',
                type: 'boolean',
                defaultValue: true,
                inputUI: { type: 'dropdown', options: ['false', 'true'] },
                tooltip: `This feature will do a few things. \n
                    1- Removes the video tracks that are embeded images. \n
                    2- Removes the attachments from the file with the exception of fonts.\n
                    3- Removes all video and file titles. \n
                    4- Removes all the commentary audio and subtitle tracks. \n
                    5- Will use the audioLangList and the subtitleLangList to keep only those languages.\n
                    6- Will use the audioLangList and the subtitleLangList to tag undifined tracks using the first value\n`
            },
            {
                name: 'audioLangList',
                type: 'string',
                defaultValue: 'eng,spa,jpn',
                inputUI: {type: 'text'},
                tooltip: `List of languagues that will be kept. The first value will be used to tag und tracks.
                \\nExample (keep this list):\\n
                eng,und,jpn`
            },
            {
                name: 'subtitleLangList',
                type: 'string',
                defaultValue: 'eng,spa',
                inputUI: {type: 'text'},
                tooltip: `List of languagues that will be kept. The first value will be used to tag und tracks.
                \\nExample (keep this list):\\n
                eng,jpn`
            },
            {
                name: 'AddChapters',
                type: 'boolean',
                defaultValue: true,
                inputUI: { type: 'dropdown', options: ['false', 'true'] },
                tooltip: `True will add missing channels with 5 minutes of increment.`
            },
            {
                name: 'Sonnar',
                type: 'string',
                defaultValue: '10.10.20.210:8989',
                inputUI: {type: 'text'},
                tooltip: `The IP address of the Sonarr server, 0.0.0.0:PortNumber`
            },
            {
                name: 'SonnarAPI',
                type: 'string',
                defaultValue: '',
                inputUI: {type: 'text'},
                tooltip: `The API key for the Sonarr server.`
            },
            {
                name: 'Radarr',
                type: 'string',
                defaultValue: '10.10.20.210:7878',
                inputUI: {type: 'text'},
                tooltip: `The IP address of the Radarr server, 0.0.0.0:PortNumber`
            },
            {
                name: 'RadarrAPI',
                type: 'string',
                defaultValue: '',
                inputUI: {type: 'text'},
                tooltip: `The API key for the Radarr server.`
            },
        ],
    })
};

async function plugin(file, librarySettings, Inputs) {
    const lib = require('../methods/lib')(); //load the library needed to read the inputs
    let userInputs = lib.loadDefaultValues(Inputs, details); // load the default values from the inputs in details

    // Default response object
    const res = {processFile: false, preset: '', container: `.${userInputs.targetFileType}`, handBrakeMode: false, FFmpegMode: true, reQueueAfter: true, infoLog: ''}

    // #region File Checks
    // Run the check function and grab the response
    const fileCheck = checkFile(file, userInputs);
    res.infoLog += fileCheck.message;
    
    if (!fileCheck.validFile){
        return res;
    }

    let fileDetails = fileCheck.fileInfo;
    // #endregion
    
    // #region Remux the file is needed
    if (fileDetails.fileNeedsRemux) {
        let remuxCommands = {mkv: ', -map 0 -c copy', mp4: ', -map 0:v? -c:v copy -map 0:a? -c:a copy -map 0:s? -c:s mov_text -map 0:t? -c:t copy'};
        res.infoLog += '→→→ File remuxing required due to container mismatch.\n';
        res.preset += fileDetails.fileContainer === 'avi' ? `${remuxCommands.mp4} -fflags +genpts` : remuxCommands[userInputs.targetFileType];
        res.processFile = true;
        return res;
    }
    // #endregion

    // #region Ensure the file stats are updated
    let statsUpdated = ensureStatsUpdated(file);
    res.infoLog += statsUpdated.message;
    // #endregion

    // #region Add chapters if needed
    let chapterCode = fileDetails.chapters.hasChapters ? '-map_chapters 0 ' : '';
    if (!fileDetails.chapters.hasChapters) {
        // Lets add chapters to the file
        let proccessedChapters = addChapters(file, librarySettings);
        res.infoLog += proccessedChapters.message;
    } else {
        res.infoLog += '→→→ File already contains chapters. Passing chapters to the output.\n';
    }
    // #endregion
 
    // #region Clean the file
    let cleanFileCode = '';
    if (userInputs.cleanFile) {
        res.infoLog += '→ Starting the Cleanup Process\n';

        // 1 - Removes the video tracks that are embeded images.
        let imgRemoved = removeImages(file);
        res.infoLog += imgRemoved.message;
        res.processFile = res.processFile || imgRemoved.processFile;
        cleanFileCode += imgRemoved.preset;

        // 2 - Removes all video and file titles.
        let titlesCleaned = cleanTitles(file);
        res.infoLog += titlesCleaned.message;
        res.processFile = res.processFile || titlesCleaned.processFile;
        cleanFileCode += titlesCleaned.preset;

        // 3 - Removes the attachments from the file with the exception of fonts.\n
        let attchRemoved = removeAttachments(file);
        res.infoLog += attchRemoved.message;
        res.processFile = res.processFile || attchRemoved.processFile;
        cleanFileCode += attchRemoved.preset;

        // 4- Removes all the commentary audio and subtitle tracks.
        let comntRemoved = removeCommentary(file);
        res.infoLog += comntRemoved.message;
        res.processFile = res.processFile || comntRemoved.processFile;
        cleanFileCode += comntRemoved.preset;

        // 5- Remove Unwanted Audio and Subtitle Tracks and Tag the und tracks.
        let processedLangs = await processLanguages(fileDetails, userInputs);
        res.infoLog += processedLangs.message;
        res.processFile = res.processFile || processedLangs.processFile;
        cleanFileCode += processedLangs.preset;

        // 6 - Lets fix any problems with the file times being off.
        let fixTimeFlag = fileCheck.useGenpts ? ' -fflags +genpts' : '';

        res.infoLog += '→ Cleanup Process Completed\n';

        // Evaluate if the file needs to run any of the code above
        if (res.processFile) {
            res.preset += `, -map 0:v -c:v copy -map 0:a? -c:a copy -map 0:s? -c:s copy -map 0:t? -c:t copy ${cleanFileCode} ${chapterCode} ${fixTimeFlag} -max_muxing_queue_size 9999 `;
            return res;
        }
    } else {
        res.infoLog += '→ Cleanup Process Skipped\n';
    }
    // #endregion

    return res;
}

// === Exports ===
module.exports.details = details;
module.exports.plugin = plugin;
module.exports.dependencies = ['langs'];