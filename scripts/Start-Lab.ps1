param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
$node = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path 'node_modules/vite/bin/vite.js')) {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
if (-not (Test-Path 'dist/index.html')) {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
}
$url = 'http://127.0.0.1:5178'
$listeners = Get-NetTCPConnection -LocalPort 5178 -State Listen -ErrorAction SilentlyContinue
if ($listeners) {
    $page = Invoke-WebRequest -Uri $url -UseBasicParsing
    if ($page.Content -notmatch 'EZ-Tree Lab') { throw 'Port 5178 is used by another app. No processes were stopped.' }
} else {
    New-Item -ItemType Directory -Force '.runtime' | Out-Null
    $process = Start-Process -FilePath $node -ArgumentList 'node_modules/vite/bin/vite.js preview --config vite.app.config.js' -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$repoRoot/.runtime/server.log" -RedirectStandardError "$repoRoot/.runtime/server-error.log"
    $process.Id | Set-Content '.runtime/server.pid'
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try { $page = Invoke-WebRequest -Uri $url -UseBasicParsing; if ($page.Content -match 'EZ-Tree Lab') { $ready = $true; break } } catch { }
        if ($process.HasExited) { throw 'Server exited. See .runtime/server-error.log.' }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Server did not become ready. See .runtime/server.log.' }
}
Write-Host "EZ-Tree Lab is running at $url"
if (-not $NoBrowser) { Start-Process $url }
