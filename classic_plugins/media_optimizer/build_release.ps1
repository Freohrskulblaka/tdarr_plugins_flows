[CmdletBinding()]
param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot 'dist')
)

$ErrorActionPreference = 'Stop'

$entrypoint = Join-Path $PSScriptRoot 'Local\Tdarr_Plugin_Media_Optimizer.js'
$supportDirectory = Join-Path $PSScriptRoot 'media_optimizer'

if (-not (Test-Path -LiteralPath $entrypoint -PathType Leaf)) {
  throw "Media Optimizer entrypoint was not found: $entrypoint"
}

if (-not (Test-Path -LiteralPath $supportDirectory -PathType Container)) {
  throw "Media Optimizer support directory was not found: $supportDirectory"
}

$entrypointText = [IO.File]::ReadAllText($entrypoint)
$versionMatch = [regex]::Match($entrypointText, "Version:\s*'([^']+)'")

if (-not $versionMatch.Success) {
  throw 'Media Optimizer version could not be read from the entrypoint.'
}

$resolvedOutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$archivePath = Join-Path $resolvedOutputDirectory "Tdarr_Media_Optimizer_$($versionMatch.Groups[1].Value).zip"

New-Item -ItemType Directory -Path $resolvedOutputDirectory -Force | Out-Null

if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Compress-Archive -Path @(
  (Join-Path $PSScriptRoot 'Local'),
  $supportDirectory
) -DestinationPath $archivePath -CompressionLevel Optimal

Write-Output $archivePath
