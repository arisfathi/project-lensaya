$ErrorActionPreference = "Stop"

param(
  [string]$TaskName = "LensayaDailyBackup",
  [string]$RunTime = "02:15"
)

$scriptPath = Resolve-Path "$PSScriptRoot\run-daily-backup.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At $RunTime
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Lensaya PostgreSQL + R2 manifest daily backup"

Write-Host "Scheduled task '$TaskName' created to run daily at $RunTime."
