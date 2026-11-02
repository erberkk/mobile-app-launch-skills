# Starts Chrome with a dedicated automation profile and a CDP port (Windows PowerShell).
# Sign in to the consoles once in this window; the profile keeps the session.
param(
  [int]$Port = 9333,
  [string]$ProfileDir = "$env:USERPROFILE\.store-automation\chrome-profile"
)
New-Item -ItemType Directory -Force $ProfileDir | Out-Null
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
Start-Process $chrome -ArgumentList "--remote-debugging-port=$Port", "--remote-debugging-address=127.0.0.1", "--user-data-dir=`"$ProfileDir`"", "--no-first-run", "--no-default-browser-check"
Write-Output "Chrome on 127.0.0.1:$Port with profile $ProfileDir"
