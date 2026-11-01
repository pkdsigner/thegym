@echo off
rem Double-click to start StandVault at http://localhost:5173.
rem Keep this window open while you use it (minimise it); close it to stop StandVault.
rem If the server ever stops, it is restarted automatically; what happened is written to app\server.log.
title StandVault
cd /d "%~dp0app"
echo Preparing StandVault...
call npm run build --silent >nul 2>&1
set PORT=5173
start "" /b cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5173"
:run
echo StandVault is running at http://localhost:5173 - keep this window open.
node server\index.js >> server.log 2>&1
echo %date% %time% StandVault stopped unexpectedly, restarting... >> server.log
echo StandVault stopped unexpectedly - restarting in 2 seconds (details in app\server.log)
timeout /t 2 /nobreak >nul
goto run
