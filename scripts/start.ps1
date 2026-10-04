[CmdletBinding()]
param(
  [switch]$Foreground
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop is required. Install it, start it, then run this script again."
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Warning "Created .env from .env.example. Add your Google and Cloudinary values before using login or uploads."
}

$composeArgs = @("compose", "up", "--build", "--remove-orphans")
if (-not $Foreground) {
  $composeArgs += "--detach"
}

& docker @composeArgs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

if (-not $Foreground) {
  & docker compose ps
  Write-Output "Streamwise is starting. Open http://localhost:5173 when the frontend status is running."
}
