$wshell = New-Object -ComObject WScript.Shell
$startupDir = [System.Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir "MAMEKO-Server.lnk"

$repoRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName
$targetBat = Join-Path $repoRoot "backend\start-services.bat"
$iconPath = Join-Path $repoRoot "backend\cmd\manager\icon.ico"

$shortcut = $wshell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetBat
$shortcut.WorkingDirectory = Join-Path $repoRoot "backend"
$shortcut.WindowStyle = 7 # Minimized
if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}
$shortcut.Save()

# Also update Desktop shortcut
$desktopDir = [System.Environment]::GetFolderPath('Desktop')
$desktopShortcutPath = Join-Path $desktopDir "MAMEKO Server Manager.lnk"
$desktopShortcut = $wshell.CreateShortcut($desktopShortcutPath)
$desktopShortcut.TargetPath = Join-Path $repoRoot "MamekoServer.exe"
$desktopShortcut.WorkingDirectory = $repoRoot
if (Test-Path $iconPath) {
    $desktopShortcut.IconLocation = "$iconPath,0"
}
$desktopShortcut.Save()

Write-Output "Startup and Desktop shortcuts configured successfully!"
