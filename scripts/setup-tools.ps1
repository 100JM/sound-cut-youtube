$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$toolDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) '.tools'
New-Item -ItemType Directory -Force -Path $toolDirectory | Out-Null
Write-Host 'Downloading yt-dlp...'
Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile (Join-Path $toolDirectory 'yt-dlp.exe') -TimeoutSec 120
Write-Host 'Downloading Deno for YouTube JavaScript challenges...'
$denoArchive = Join-Path $toolDirectory 'deno.zip'
Invoke-WebRequest -Uri 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip' -OutFile $denoArchive -TimeoutSec 180
Expand-Archive -LiteralPath $denoArchive -DestinationPath $toolDirectory -Force
Remove-Item -LiteralPath $denoArchive
Write-Host 'Downloading FFmpeg...'
$archive = Join-Path $toolDirectory 'ffmpeg-github.zip'
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/GyanD/codexffmpeg/releases/latest' -TimeoutSec 30
$asset = $release.assets | Where-Object { $_.name -match 'essentials_build.zip$' } | Select-Object -First 1
if (-not $asset) { throw 'FFmpeg release archive was not found.' }
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archive -TimeoutSec 180
Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $toolDirectory 'ffmpeg-package') -Force
Get-ChildItem -LiteralPath (Join-Path $toolDirectory 'ffmpeg-package') -Filter '*.exe' -Recurse | Where-Object { $_.Name -in @('ffmpeg.exe', 'ffprobe.exe') } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $toolDirectory $_.Name) -Force }
Remove-Item -LiteralPath $archive
Write-Host 'Ready. Run npm run dev.'
