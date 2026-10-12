@echo off
rem Opens the Laravel API and the Expo app in their own windows.
rem Keep both windows open while you use TeachWise. Parts already running are skipped.
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if errorlevel 1 (
  start "TeachWise API (keep open)" /D "%~dp0backend" cmd /k C:\xampp\php\php.exe artisan serve
) else (
  echo TeachWise API is already running.
)
netstat -ano | findstr /R /C:":8081 .*LISTENING" >nul
if errorlevel 1 (
  start "TeachWise App (keep open)" /D "%~dp0app" cmd /k "set BROWSER=none&& set EXPO_NO_BROWSER=1&& npx expo start --clear"
) else (
  echo TeachWise App is already running.
)
