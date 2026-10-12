@echo off
title TeachWise - create an admin account
echo.
echo  Create an admin for a school
echo  --------------------------------
echo  Pick an existing school or create a new one, then answer the questions.
echo  The password is hidden while you type.
echo.
cd /d "%~dp0backend"
C:\xampp\php\php.exe artisan teachwise:create-admin
echo.
pause
