/*
 * Media Optimizer Response Library
 * Created by: Freohrskulblaka
 * Created on: 2026-08-06
 * Description: Builds Tdarr classic plugin responses from Media Optimizer runtime context.
 */

function createResponse(context) {
  const command = context.plan?.command || null;
  const canExecute = Boolean(context.plan?.isValid && context.plan?.shouldProcess && command?.isExecutable && !context.settings.dryRun);

  return Object.assign({}, context.response, {
    processFile: canExecute,
    preset: canExecute ? command.preset : '',
    FFmpegMode: canExecute,
    ffmpegMode: canExecute,
    cliToUse: canExecute ? 'ffmpeg' : '',
    infoLog: context.log.toString(),
  });
}

module.exports = {
  createResponse,
};
