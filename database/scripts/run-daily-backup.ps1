$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path "$PSScriptRoot\..\.."
$backendPath = Join-Path $projectRoot "backend"

Write-Host "Running Lensaya daily backup workflow..."
Push-Location $backendPath
try {
  npm run backup:daily
}
finally {
  Pop-Location
}

Write-Host "Lensaya backup workflow completed."
