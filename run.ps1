param([string]$SceneFile = "./scenes/cyber_01.json")

Set-Location $PSScriptRoot

Write-Host "AI VIDEO PIPELINE - CYBER MODE" -ForegroundColor Green
Write-Host "[1/3] Generating voiceover..." -ForegroundColor Cyan
.\generate-audio.ps1 -ScenePath $SceneFile

Write-Host "[2/3] Rendering HTML overlay..." -ForegroundColor Cyan
node render.js $SceneFile

Write-Host "[3/3] Pipeline complete." -ForegroundColor Cyan
Get-ChildItem ./output/*.webm, ./audio/*.mp3 -ErrorAction SilentlyContinue | Format-Table Name, Length -AutoSize