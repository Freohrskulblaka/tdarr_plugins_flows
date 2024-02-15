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