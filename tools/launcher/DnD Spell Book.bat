@echo off
rem Otwiera DnD Spell Book we wlasnym oknie (Edge lub Chrome w trybie --app).
setlocal
set "APP=%~dp0DnD Spell Book.html"
if not exist "%APP%" (
  echo Nie znaleziono pliku "DnD Spell Book.html" obok tego skryptu.
  pause
  exit /b 1
)
set "URL=file:///%APP:\=/%"
set "BROWSER="
for %%P in (
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  "%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do (
  if not defined BROWSER if exist %%P set "BROWSER=%%~P"
)
if defined BROWSER (
  start "" "%BROWSER%" --app="%URL%" --window-size=1360,900
) else (
  rem Brak Edge i Chrome: otworz w domyslnej przegladarce.
  start "" "%APP%"
)
endlocal
