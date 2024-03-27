const details = () => ({
    id: "Tdarr_Plugin_001_Clean_Files",
    Name: "Skull's Clean File (Remove Unwanted Images, Subs, and Languages)",
    Stage: "Pre-processing",
    Type: "Video, Audio, Subtitles",
    Operation: "Transcode",
    Description: "This process allows you to removes images from the video streams. Remove the unwanted audio tracks. Remove the unwanted subtitle tracks. Remove Commentaries and Descriptions.\n It tags the audio and subtitles with the language you want. Plus More",
    Version: "1.6",
    Tags: "pre-processing, ffmpeg, configurable",
    Inputs:[
        {
            name: 'RemoveImages',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `False will keep the video tracks that are images in the file, true will remove them.`
        },
        {
            name: 'RemoveAttachments',
            type: 'string',
            defaultValue: 'none',
            inputUI: { type: 'dropdown', options: ['all', 'none','fonts','others'] },
            tooltip: `All will remove all tracks that are classified as attachments, fonts will remove any fonts attached to the file, others will keep the fonts, but remove anything else, and none disables the feature..`
        },
        {
            name: 'CleanVideoTitle',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `Remove the Title of the Video track if it has one`
        },
        {
            name: 'RemoveCommentary',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `False will keep the commentary tracks, True will remove commentary tracks`
        },
        {
            name: 'RemoveUnwantedAudio',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `True will remove the unwanted audio from the file. False will leave the audio as is.`
        },
        {
            name: 'AudioLanguageList',
            type: 'string',
            defaultValue: 'eng,spa,lat,jpn,und',
            inputUI: {type: 'text'},
            tooltip: `Specify language tag/s here for the audio tracks you'd like to keep. Recommended to keep "und" as this stands for undertermined
            \\nSome files may not have the language specified. Must follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
            \\nExample:\\n
            eng
            \\nExample:\\n
            eng,und
            \\nExample:\\n
            eng,und,jpn`
        },
        {
            name: 'TagAudioTracks',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `True will tag audio track with undifined audio. False will leave the audio as is.`
        },
        {
            name: 'TagAudioLang',
            type: 'string',
            defaultValue: 'eng',
            inputUI: {
              type: 'text',
            },
            tooltip: `Specify a single language for audio tracks with no language or unknown language to be tagged with. You must have "und" in your list of languages to keep for this to function.
            \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes.
            \\nExample:\\n
            eng        
            \\nExample:\\n
            por`
        },
        {
            name: 'RemoveUnwantedSubs',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `True will remove the unwanted subtitles from the file. False will leave the subtitles as is.`
        },
        {
            name: 'SubsLanguageList',
            type: 'string',
            defaultValue: 'eng,spa,und',
            inputUI: {type: 'text'},
            tooltip: `Specify language tag/s here for the subtitle tracks you'd like to keep. Recommended to keep "und" as this stands for undertermined
            \\nSome files may not have the language specified. Must follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
            \\nExample:\\n
            eng
            \\nExample:\\n
            eng,und
            \\nExample:\\n
            eng,und,jpn`
        },
        {
            name: 'TagSubtitleTracks',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `True will tag subtitle tracks with undifined language. False will leave it as is.`
        },
        {
            name: 'TagSubtitleLang',
            type: 'string',
            defaultValue: 'eng',
            inputUI: {
              type: 'text',
            },
            tooltip: `Specify a single language for subtitle tracks with no language or unknown language to be tagged with. You must have "und" in your list of languages to keep for this to function.
            \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes.
            \\nExample:\\n
            eng        
            \\nExample:\\n
            por`
        },
        {
            name: 'AddChapters',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `True will add missing channels with 5 minutes of increment.`
        }
    ],
});

const plugin = (file, librarySettings, Inputs, otherArguments) => {
    const lib = require('../methods/lib')(); //load the library needed to read the inputs
    Inputs = lib.loadDefaultValues(Inputs, details); // load the default values from the inputs in details
    const fs = require('fs');
    const ct = require("crypto");
    const proc = require('child_process');
    let currentfilename = file._id;

    //create the default reponse object.
    const response = {processFile: false, preset: '', container: '.mkv', handBrakeMode: false, FFmpegMode: true, reQueueAfter: true, infoLog: ''}

    //Check if file is a video. If it isn't then exit plugin.
    if (file.fileMedium !== 'video') {
        response.infoLog += '- This is not a valid video file. \n';
        return response;
    }

    response.infoLog += '- Starting the Cleanup Process';

    //Check to make sure that stats are updated
    if (file.container === 'mkv') {
        // Check that Stats are update for the file
        let stats_are_current = false;

        //start by defining a random date
        let datStats = Date.parse(new Date(70, 1).toISOString());
        let statsThres = Date.parse(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString());

        //Check if the file has stats at all. 
        if (typeof file.ffProbeData.streams[0].tags !== 'undefined'){
            if(typeof file.ffProbeData.streams[0].tags['_STATISTICS_WRITING_DATE_UTC-eng'] !== 'undefined') {
                datStats = Date.parse(`${file.ffProbeData.streams[0].tags['_STATISTICS_WRITING_DATE_UTC-eng']} GMT`);
            }
        }

        if (datStats >= statsThres) {
            stats_are_current = true;
            response.infoLog += "File Stats are okay \n";
            response.infoLog += `StatsThres: ${statsThres}, StatsDate: ${datStats}\n`;
        }

        if (!stats_are_current) {
            response.infoLog += 'Stats need to be updated! \n';
            proc.execSync(`mkvpropedit --add-track-statistics-tags "${currentfilename}"`);
            return response;
        }
    }

    //Filtering Arrays
    let nonVideoCodecs = ['mjpeg', 'png', 'gif', 'image/jpeg'];
    let commentaryTags = ['commentary', 'comentarios', 'description', 'descripcion'];
    let attachmentsCodecs = ['otf', 'ttf'];

    //Data Arrays
    const fileStreams = file.ffProbeData.streams; //Grab Entire Stream Array
    const fileMediaInfo = file.mediaInfo.track; //Grab the mediaInfo track Array
    const fileInfo = fileMediaInfo.filter(r => r['@type'] === 'General')[0];
    const fileChapters = fileMediaInfo.filter(r => r['@type'] === 'Menu')[0];
    const videoStreams = fileStreams.filter(codec => codec.codec_type === 'video'); //Filter to only the video streams
	const audioStreams = fileStreams.filter(codec => codec.codec_type === 'audio'); //Filter to only the audio streams
    const subStreams = fileStreams.filter(codec => codec.codec_type === 'subtitle'); //Filter to only the subtitle streams
    const attachmentStreams = fileStreams.filter(codec => codec.codec_type === 'attachment'); //Filter to only the attachment streams

    //Code Execution Variables
    let convertFile = false;
    let videoCommand = '';
    let audioCommand = '';
    let subtitleCommand = '';
    let attachmentCommand = '';

    //Video Streams
    if(typeof videoStreams !== 'undefined'){
        let removeImageCode = '-map 0:v? -c:v copy ';
        let removeVideoTitleCode = '';
        
        //Check to make sure we have a valid file Info data
        if(typeof fileInfo === 'undefined'){
            response.infoLog += '- No File Info was extracted from the File Media Info';
            return response;
        }

        for (let i = 0; i < videoStreams.length; i++) {
             //Remove images process
            if (Inputs.RemoveImages === true) {
                //Check if Video Stream includes images
                if(nonVideoCodecs.includes(videoStreams[i].codec_name) || (videoStreams[i].tags['MIMETYPE'] !== 'undefined' && nonVideoCodecs.includes(videoStreams[i].tags['MIMETYPE']))) {
                    convertFile = true;
                    removeImageCode += `-map -v:${i} `;
                    response.infoLog += `- Removing video stream ${i} from the file, detected as ${videoStreams[i].codec_name}. \n`;
                }
            }

            //Clean the Video Title
            if (Inputs.CleanVideoTitle === true){
                //check that our video stream has tags
                if(typeof videoStreams[i].tags !== 'undefined'){
                    //check if the title of the video track is undifined.
                    if(typeof videoStreams[i].tags.title !== 'undefined'){
                        convertFile = true;
                        removeVideoTitleCode = `-metadata:s:v title= `;
                        response.infoLog += '- Removing title from video stream \n';
                    }
                }
            }
        }

        if (Inputs.CleanVideoTitle === true){
            if(typeof fileInfo.Title !== 'undefined') {
                convertFile = true;
                removeVideoTitleCode += `-metadata title= `;
                response.infoLog += '- Removing title from the file \n';
            }
        }

        //Compile the Video Part of the ffmpeg Command
        videoCommand = `${removeImageCode} ${removeVideoTitleCode}`;

    }

    //Audio Streams
    if (typeof audioStreams !== 'undefined') {
        let AudioCode = '';
        let audioLanguages = Inputs.AudioLanguageList.split(',');
        let AudioTagLanguage = Inputs.TagAudioLang.split(',');

        for (let i = 0; i < audioStreams.length; i++) {
            (typeof audioStreams[i].tags === 'undefined') ? audioTitle = void 0 : audioTitle = audioStreams[i].tags.title;
            (typeof audioStreams[i].tags === 'undefined') ? langTag = 'und' : langTag = audioStreams[i].tags.language;

            //Audio Commentary and Descriptions
            if(Inputs.RemoveCommentary === true) {
                if (typeof audioTitle !== 'undefined') {
                    if(commentaryTags.some(tag => audioTitle.toLowerCase().includes(tag)) && !AudioCode.includes(`-0:a:${i}`)) {
                        convertFile = true;
                        AudioCode += `-map -0:a:${i} `;
                        response.infoLog += `- Removing Audio stream, detected as being commentary/descriptive. \n`;
                    }
                }
            }

            //Remove Unwated Audio Track Languages.
            if(Inputs.RemoveUnwantedAudio === true) {
                if(typeof langTag !== 'undefined') {
                    if(!audioLanguages.includes(langTag.toLowerCase())) {
                        convertFile = true;
                        AudioCode += `-map -0:a:${i} `;
                        response.infoLog += `- Audio stream detected as being unwanted - ${langTag}, removing stream 0:a:${i} \n`;
                    }
                }
            }

            //Tag Audio Languages that are undifined. 
            if(Inputs.TagAudioTracks === true){
                if(typeof langTag !== 'undefined') {
                    if(langTag.toLowerCase() === 'und') {
                        convertFile = true;
                        AudioCode += `-metadata:s:a:${i} language=${AudioTagLanguage} `;
                        response.infoLog += `- Audio stream detected as having no language, tagging as ${AudioTagLanguage}. \n`;
                    }
                }              
            }
        }

        audioCommand += `-map 0:a? -c:a copy ${AudioCode}`;

    }

    //Subtitle Streams
    if (typeof subStreams !== 'undefined') {
        let SubtitleCode = '';
        let subLanguages = Inputs.SubsLanguageList.split(',');
        let SubtitleTagLanguage = Inputs.TagSubtitleLang.split(',');

        for (let i = 0; i < subStreams.length; i++) {
            subsTitle = (typeof subStreams[i].tags === 'undefined') ? void 0 : subStreams[i].tags.title;
            langTag = (typeof subStreams[i].tags === 'undefined') ? 'und' : subStreams[i].tags.language;
            subCodec = (typeof subStreams[i].codec_name === 'undefined') ? 'und' : subStreams[i].codec_name;

            //Remove Subtitle Commentary and Descriptions
            if(Inputs.RemoveCommentary === true) {
                if (typeof subsTitle !== 'undefined'){
                    if(commentaryTags.some(tag => subsTitle.toLowerCase().includes(tag)) && !SubtitleCode.includes(`-0:s:${i}`)) {
                        convertFile = true;
                        SubtitleCode += `-map -0:s:${i} `;
                        response.infoLog += `- Removing Subtitle stream detected as being commentary/descriptive. \n`;
                    }
                }
            }
            
            //Remove Unwanted Subtitle tracks
            if(Inputs.RemoveUnwantedSubs === true){
                if (typeof langTag !== 'undefined') {
                    if(!subLanguages.includes(langTag.toLowerCase())) {
                        convertFile = true;
                        SubtitleCode += `-map -0:s:${i} `;
                        response.infoLog += `- Subtitle stream detected as being unwanted - ${langTag}, removing. Stream 0:s:${i} \n`;
                    }
                }
            }
                
            //Tag Subtitle tracks that are undifined.
            if(Inputs.TagSubtitleTracks === true){                  
                if (typeof langTag !== 'undefined'){
                    if(langTag.toLowerCase() === 'und') {
                        convertFile = true;
                        SubtitleCode += `-metadata:s:s:${i} language=${SubtitleTagLanguage} `;
                        response.infoLog += `- Subtitle stream detected as having no language, tagging as ${SubtitleTagLanguage}. \n`;
                    }
                }
            }

            if (subCodec === "mov_text"){
                convertFile = true;
                SubtitleCode += `-scodec srt -metadata:s:s:${i} language=${langTag} `;
                response.infoLog += `- Subtitle stream detected as mov_text, converting to SRT and tagging as ${langTag}. \n`;
            }
        }

        subtitleCommand += `-map 0:s? -c:s copy ${SubtitleCode}`;

    }

    //Attachment Streams
    if(typeof attachmentStreams !== 'undefined'){
        //Remove attachments from the file
        if (Inputs.RemoveAttachments !== 'none' && attachmentStreams.length > 0) {
            //remove all attachments
            if(Inputs.RemoveAttachments === 'all'){
                convertFile = true;
                attachmentCommand += `-map -t `;
                response.infoLog += `- Removing attachments \n`;
            }
            
            //handle other attachments
            for (let i = 0; i < attachmentStreams.length; i++) {
                aCodec = (typeof attachmentStreams[i].codec_name === 'undefined') ?  void 0 : attachmentStreams[i].codec_name;
                if(Inputs.RemoveAttachments === 'others' && typeof aCodec !== 'undefined'){
                    if(!attachmentsCodecs.includes(aCodec)) {
                        convertFile = true;
                        attachmentCommand += `-map -0:t:${i} `;
                        response.infoLog += `- Removing attached images \n`;
                    }
                }

                //Removing Fonts
                if(Inputs.RemoveAttachments === 'fonts' && typeof aCodec !== 'undefined'){
                    if(attachmentsCodecs.includes(aCodec)) {
                        convertFile = true;
                        attachmentCommand += `-map -0:t:${i} `;
                        response.infoLog += `- Removing attached ${i}, detected as unwanted font. \n`;
                    }
                }
            }
        }
    }

    /*
    //  This section will check for chapters and will clean them up or add them to the file. 
    //  Credit goes to JB69 who implemented a similar process on his file.    
    */
    let hasChapters = false;
    let chaptersCommand = '';
    //pass the chapters on if the file contains them
    if(typeof fileChapters !== 'undefined'){
        hasChapters = true;
        chaptersCommand = '-map_chapters 0 ';
    }
    //Create chapters if they are not part of the file.
    if(!hasChapters && Inputs.AddChapters === true && file.container === 'mkv'){
        response.infoLog += 'Creating the Chapter File. \n';
        let chapterDuration = 300;
        let intChapNum = 0;
        let strChapNum = "";
        let strChapterFile = '';
        let strChapterFileLoc = librarySettings.cache + "/" + ct.createHash("md5").update(file._id).digest("hex") + ".txt";
        // let strChapterFileLoc = ct.createHash("md5").update(file._id).digest("hex") + ".txt";

        for (var i = 0; i < file.meta.Duration; i += chapterDuration) {
            intChapNum += 1;
            strChapNum = String(intChapNum).padStart(2, '0');
            var timeString = new Date(i * 1000).toISOString().substring(11, 23);
            strChapterFile += `CHAPTER${strChapNum}=${timeString} \n`;
            strChapterFile += `CHAPTER${strChapNum}NAME=CHAPTER ${strChapNum} \n`;
        }

        //Add a chapter 1 sec before the end
        intChapNum += 1;
        strChapNum = String(intChapNum).padStart(2, '0');
        var timeString = new Date((Math.floor(file.meta.Duration) - 1) * 1000).toISOString().substring(11, 23);
        strChapterFile += `CHAPTER${strChapNum}=${timeString} \n`;
        strChapterFile += `CHAPTER${strChapNum}NAME=CHAPTER ${strChapNum} \n`;
        
        //Write the file out to the cache folder.
        fs.writeFileSync(strChapterFileLoc, strChapterFile);

        //Attach the chapters to the file
        proc.execSync(`mkvpropedit "${currentfilename}" --chapters "${strChapterFileLoc}"`);

        //Remove the Chapters file
        fs.unlinkSync(strChapterFileLoc);
    }

	// Convert file if convertFile variable is set to true.
    if (convertFile === true) {
        response.processFile = true;
        response.infoLog += '- Cleaning File';
        response.preset = `, ${videoCommand} ${audioCommand} ${subtitleCommand} ${attachmentCommand} ${chaptersCommand} -metadata "file_cleaned_date=${new Date().toISOString()}" -max_muxing_queue_size 9999 `;
    }
    else {
        response.infoLog += '- Cleanup Process Completed';
    }

    return response
}

module.exports.details = details;
module.exports.plugin = plugin;