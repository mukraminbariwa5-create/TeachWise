@echo off
title TeachWise - load demo data
echo.
echo  TeachWise demo data
echo  -------------------
echo  Adds sample teachers, students, classes and evaluations so you can try or present the app.
echo  Only for your own computer. Never run this on the real school server.
echo.
pause
cd /d "%~dp0backend"
C:\xampp\php\php.exe artisan teachwise:demo
if errorlevel 1 goto failed
echo.
echo  Done! Sign in with the demo accounts listed above.
echo.
pause
exit /b 0

:failed
echo.
echo  Something went wrong above. Take a screenshot of this window and send it to Claude.
pause
exit /b 1
