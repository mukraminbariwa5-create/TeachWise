@echo off
title TeachWise - create the owner account
echo.
echo  Create the TeachWise owner account
echo  ----------------------------------
echo  The owner approves schools that apply, and can pause them.
echo  The owner never sees evaluation answers.
echo.
cd /d "%~dp0backend"
C:\xampp\php\php.exe artisan teachwise:create-admin --platform
echo.
pause
