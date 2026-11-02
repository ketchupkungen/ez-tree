$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $repoRoot '.runtime/server.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'No launcher-managed server is recorded.'; exit }
$serverProcessId = [int](Get-Content -LiteralPath $pidFile)
$serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $serverProcessId"
if ($serverProcess -and $serverProcess.Name -eq 'node.exe' -and $serverProcess.CommandLine -like '*node_modules/vite/bin/vite.js preview --config vite.app.config.js*') {
    $listener = Get-NetTCPConnection -LocalPort 5178 -State Listen -ErrorAction SilentlyContinue | Where-Object OwningProcess -eq $serverProcessId
    if (-not $listener) { throw 'The recorded process is not listening on the Lab port; refusing to stop it.' }
    Stop-Process -Id $serverProcessId
    Write-Host 'EZ-Tree Lab stopped.'
} elseif ($serverProcess) { throw 'The recorded process no longer matches the Lab server; refusing to stop it.' }
Remove-Item -LiteralPath $pidFile
