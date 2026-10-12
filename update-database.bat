@echo off
title TeachWise - update database
echo.
echo  TeachWise database update
echo  -------------------------
echo  Adds the newest tables and settings to your existing teachwise_db.
echo  Your data is kept. Make sure MySQL is running in XAMPP.
echo.
cd /d "%~dp0backend"
C:\xampp\php\php.exe artisan migrate --force
if errorlevel 1 goto failed
C:\xampp\php\php.exe artisan db:seed --class=QuestionSeeder --force
if errorlevel 1 goto failed
C:\xampp\php\php.exe artisan db:seed --class=SignupDetailsSeeder --force
if errorlevel 1 goto failed
rem Demo data from an older version gets the new parts (schools, departments, owner account).
C:\xampp\php\php.exe artisan teachwise:demo --upgrade-only
if errorlevel 1 goto failed
C:\xampp\php\php.exe artisan optimize:clear >nul
echo.
echo  Done! You can close this window.
echo.
pause
exit /b 0

:failed
echo.
echo  Something went wrong above. Take a screenshot of this window and send it to Claude.
pause
exit /b 1
