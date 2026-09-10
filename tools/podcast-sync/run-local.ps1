param(
  [Parameter(Mandatory=$true)][string]$ServiceAccountPath,
  [string]$PythonPath = 'python',
  [string]$Only,
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$account = (Resolve-Path -LiteralPath $ServiceAccountPath).Path
$local = Join-Path $PSScriptRoot '.local'
New-Item -ItemType Directory -Force $local | Out-Null
$env:GOOGLE_APPLICATION_CREDENTIALS = $account
$env:FIREBASE_STORAGE_BUCKET = 'wifa-trainer-gruen.firebasestorage.app'
$apiSource = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot '../../js/api.js')
$env:PODCAST_LERNTEXTE_API_URL = [regex]::Match($apiSource, 'const API_BASE_URL = "([^"]+)"').Groups[1].Value
$env:PODCAST_STATUS_LOG = Join-Path $local 'status.jsonl'

Push-Location $PSScriptRoot
try {
  if (!(Test-Path -LiteralPath 'node_modules/firebase-admin')) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci fehlgeschlagen' }
  }
  if (!$DryRun) {
    $venvPython = Join-Path $local 'venv/Scripts/python.exe'
    if (!(Test-Path -LiteralPath $venvPython)) {
      & $PythonPath -m venv (Join-Path $local 'venv')
      if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 oder neuer erforderlich; -PythonPath angeben' }
    }
    $requirementsHash = (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'requirements-local.txt') -Algorithm SHA256).Hash
    $readyFile = Join-Path $local 'requirements-installed.txt'
    if (!(Test-Path -LiteralPath $readyFile) -or (Get-Content -Raw -LiteralPath $readyFile).Trim() -ne $requirementsHash) {
      & $venvPython -m pip install -r (Join-Path $PSScriptRoot 'requirements-local.txt')
      if ($LASTEXITCODE -ne 0) { throw 'Lokale Audio-Abhängigkeiten konnten nicht installiert werden' }
      Set-Content -LiteralPath $readyFile -Value $requirementsHash
    }
    $models = Join-Path $local 'models'
    New-Item -ItemType Directory -Force $models | Out-Null
    $model = Join-Path $models 'de_DE-thorsten-medium.onnx'
    if (!(Test-Path -LiteralPath $model) -or !(Test-Path -LiteralPath ($model + '.json'))) {
      Push-Location $models
      try {
        & $venvPython -m piper.download_voices de_DE-thorsten-medium
        if ($LASTEXITCODE -ne 0) { throw 'Kostenloses Piper-Stimmenmodell konnte nicht geladen werden' }
      } finally { Pop-Location }
    }
    $env:PODCAST_PYTHON = $venvPython
    $env:PODCAST_PIPER_MODEL = $model
  }
  $syncArgs = @('sync-all.js')
  if ($DryRun) { $syncArgs += '--dry-run' }
  if ($Only) { $syncArgs += @('--only', $Only) }
  & node @syncArgs
  if ($LASTEXITCODE -ne 0) { throw 'Sync meldet Fehler; Statusprotokoll prüfen und denselben Aufruf wiederholen' }
} finally { Pop-Location }
