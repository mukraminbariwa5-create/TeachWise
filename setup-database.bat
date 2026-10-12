@echo off
title TeachWise - database setup
echo.
echo  TeachWise database setup
echo  ------------------------
echo  Make sure MySQL is started in the XAMPP Control Panel first.
echo  WARNING: this ERASES teachwise_db and fills it with demo data again.
echo  To keep your data, close this window and run update-database.bat instead.
echo.
pause
cd /d "%~dp0backend"
C:\xampp\php\php.exe -v
if errorlevel 1 goto nophp
C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS teachwise_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
if errorlevel 1 goto nomysql
C:\xampp\php\php.exe artisan migrate:fresh --seed --force
if errorlevel 1 goto failed
C:\xampp\php\php.exe artisan teachwise:demo
if errorlevel 1 goto failed
echo.
echo  Done! Now double-click start-teachwise.bat
echo.
pause
exit /b 0

:nophp
echo.
echo  Could not run C:\xampp\php\php.exe. Is XAMPP installed in C:\xampp ?
pause
exit /b 1

:nomysql
echo.
echo  Could not reach MySQL. Start MySQL in the XAMPP Control Panel, then run this again.
pause
exit /b 1

:failed
echo.
echo  Something went wrong above. Take a screenshot of this window and send it to Claude.
pause
exit /b 1
