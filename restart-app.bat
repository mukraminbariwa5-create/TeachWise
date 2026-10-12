@echo off
rem Restarts the Expo app window (closes the old one first). The API window is left alone.
taskkill /FI "WINDOWTITLE eq TeachWise App*" /T /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":8081 .*LISTENING"') do taskkill /PID %%a /T /F >nul 2>&1
timeout /t 2 /nobreak >nul
start "TeachWise App (keep open)" /D "%~dp0app" cmd /k "set BROWSER=none&& set EXPO_NO_BROWSER=1&& npx expo start --clear"
