@echo off
rem Usuwa skroty "DnD Spell Book" z pulpitu i menu Start. Nie usuwa programu ani danych.
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "foreach($f in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))){" ^
  " $p=Join-Path $f 'DnD Spell Book.lnk'; if(Test-Path $p){ Remove-Item $p }}"
echo Skroty usuniete. Program i zapisane dane zostaly bez zmian.
pause
endlocal
