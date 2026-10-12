@echo off
title TeachWise - upload to GitHub
echo.
echo  Upload TeachWise to GitHub
echo  --------------------------
echo  Sends the project to github.com/mukraminbariwa5-create/TeachWise
echo  The first time, a browser window may ask you to sign in to GitHub.
echo.
cd /d "%~dp0"
where git >nul 2>&1
if errorlevel 1 goto nogit
git config --global --add safe.directory "%CD:\=/%" >nul 2>&1
git push -u origin main
if errorlevel 1 goto failed
echo.
echo  Done! Open https://github.com/mukraminbariwa5-create/TeachWise
echo.
pause
exit /b 0

:nogit
echo  Git is not installed on this computer.
echo  Install it from https://git-scm.com/download/win (keep the default options),
echo  then double-click this file again.
echo.
pause
exit /b 1

:failed
echo.
echo  The upload didn't finish. Take a screenshot of this window and send it to Claude.
pause
exit /b 1
