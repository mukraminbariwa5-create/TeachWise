@echo off
title TeachWise - install app packages
echo.
echo  TeachWise app packages
echo  ----------------------
echo  Installs the parts the new version needs (push notifications, haptics, offline cache).
echo  Needs internet. Takes a minute or two.
echo.
cd /d "%~dp0app"
call npx expo install expo-notifications expo-device expo-haptics @react-native-async-storage/async-storage
if errorlevel 1 goto failed
call npm install
if errorlevel 1 goto failed
echo.
echo  Done! Now double-click restart-app.bat
echo.
pause
exit /b 0

:failed
echo.
echo  Something went wrong above. Check your internet, then run this again.
echo  If it keeps failing, take a screenshot of this window and send it to Claude.
pause
exit /b 1
