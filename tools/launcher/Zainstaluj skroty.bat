@echo off
rem Tworzy skroty "DnD Spell Book" (z ikona) na pulpicie i w menu Start.
setlocal
set "DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$d=$env:DIR; $w=New-Object -ComObject WScript.Shell;" ^
  "foreach($f in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))){" ^
  " $s=$w.CreateShortcut((Join-Path $f 'DnD Spell Book.lnk'));" ^
  " $s.TargetPath=(Join-Path $d 'DnD Spell Book.bat'); $s.WorkingDirectory=$d;" ^
  " $s.IconLocation=(Join-Path $d 'icon.ico'); $s.WindowStyle=7; $s.Description='DnD Spell Book'; $s.Save() }"
if errorlevel 1 (
  echo Nie udalo sie utworzyc skrotow.
) else (
  echo Skroty utworzone na pulpicie i w menu Start.
  echo Jesli przeniesiesz ten folder, uruchom ten plik ponownie.
)
pause
endlocal
