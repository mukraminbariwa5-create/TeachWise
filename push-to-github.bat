@echo off
rem Keep this window open whatever happens, so messages can be read.
if not "%~1"=="keep" (
  cmd /k ""%~f0" keep"
  exit /b
)
title TeachWise - upload to GitHub
cd /d "%~dp0"
echo.
echo  Upload TeachWise to GitHub
echo  --------------------------
echo  Sends the project to github.com/mukraminbariwa5-create/TeachWise
echo  A browser window may ask you to sign in to GitHub. Please wait...
echo.
echo ==== %date% %time% ==== > push-log.txt
where git >> push-log.txt 2>&1
if errorlevel 1 (
  echo  Git is not installed on this computer.
  echo  Install it from https://git-scm.com/download/win with the default options,
  echo  then double-click this file again.
  echo GIT NOT FOUND >> push-log.txt
  goto end
)
git --version >> push-log.txt 2>&1
git config --global --add safe.directory "*" >> push-log.txt 2>&1
git status --short --branch >> push-log.txt 2>&1
git push -u origin main >> push-log.txt 2>&1
if errorlevel 1 (
  echo  The upload didn't finish. Tell Claude "it failed" so it can read push-log.txt.
  echo PUSH FAILED >> push-log.txt
  goto end
)
echo PUSH OK >> push-log.txt
echo  Done! Open https://github.com/mukraminbariwa5-create/TeachWise
:end
echo.
echo  You can close this window.
