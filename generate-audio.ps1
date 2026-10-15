param([string]$ScenePath = "./scenes/cyber_01.json")

Set-Location $PSScriptRoot

$scene = Get-Content $ScenePath -Raw | ConvertFrom-Json
$text = "$($scene.data.title). $($scene.data.subtitle)"

$tempText = Join-Path $PSScriptRoot "audio\temp_$($scene.scene_id).txt"
[System.IO.File]::WriteAllText($tempText, $text, (New-Object System.Text.UTF8Encoding $false))

$outputAudio = Join-Path $PSScriptRoot "audio\$($scene.scene_id).mp3"
python -m edge_tts --voice vi-VN-NamMinhNeural --file $tempText --write-media $outputAudio

Write-Host "Audio: $outputAudio"