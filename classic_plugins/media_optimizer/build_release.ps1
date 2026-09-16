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

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($archivePath, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($directory in @((Join-Path $PSScriptRoot 'Local'), $supportDirectory)) {
    Get-ChildItem -LiteralPath $directory -File -Recurse |
      Where-Object { $_.Extension -ne '.pyc' -and $_.FullName -notmatch '[\\/]__pycache__[\\/]' } |
      ForEach-Object {
        $relativePath = $_.FullName.Substring($PSScriptRoot.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $relativePath) | Out-Null
      }
  }
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $PSScriptRoot 'README.md'), 'README.md') | Out-Null
  $hdrGuide = Join-Path $PSScriptRoot '../../docs/hdr_tooling.md'
  if (Test-Path -LiteralPath $hdrGuide -PathType Leaf) {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $hdrGuide, 'HDR_SETUP.md') | Out-Null
  }
} finally {
  $archive.Dispose()
}

Write-Output $archivePath
