@echo off
rem Opens the Laravel API and the Expo app in their own windows.
rem Keep both windows open while you use TeachWise. Parts already running are skipped.
rem Start the configured local AI service when installed but not running.
findstr /L /X /C:"OLLAMA_ENABLED=true" "%~dp0backend\.env" >nul 2>&1
if not errorlevel 1 (
  findstr /L /X /C:"OLLAMA_ENDPOINT=http://127.0.0.1:11434" /C:"OLLAMA_ENDPOINT=http://localhost:11434" "%~dp0backend\.env" >nul 2>&1
  if not errorlevel 1 (
    powershell -NoProfile -NonInteractive -Command "try { $tcpCheck = New-Object Net.Sockets.TcpClient; if ($tcpCheck.ConnectAsync('127.0.0.1', 11434).Wait(1000) -and $tcpCheck.Connected) { exit 0 }; exit 1 } catch { exit 1 } finally { if ($tcpCheck) { $tcpCheck.Dispose() } }" >nul 2>&1
    if errorlevel 1 if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
      start "" /B "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve >nul 2>&1
    )
  )
)
rem Check the conversation service and report actionable startup problems.
pushd "%~dp0backend"
C:\xampp\php\php.exe artisan wise:check
popd
powershell -NoProfile -NonInteractive -Command "try { $tcpCheck = New-Object Net.Sockets.TcpClient; if ($tcpCheck.ConnectAsync('127.0.0.1', 8000).Wait(1000) -and $tcpCheck.Connected) { exit 0 }; exit 1 } catch { exit 1 } finally { if ($tcpCheck) { $tcpCheck.Dispose() } }" >nul 2>&1
if errorlevel 1 (
  start "TeachWise API (keep open)" /D "%~dp0backend" cmd /k C:\xampp\php\php.exe artisan serve
) else (
  echo TeachWise API is already running.
)
powershell -NoProfile -NonInteractive -Command "try { $tcpCheck = New-Object Net.Sockets.TcpClient; if ($tcpCheck.ConnectAsync('127.0.0.1', 8081).Wait(1000) -and $tcpCheck.Connected) { exit 0 }; exit 1 } catch { exit 1 } finally { if ($tcpCheck) { $tcpCheck.Dispose() } }" >nul 2>&1
if errorlevel 1 (
  start "TeachWise App (keep open)" /D "%~dp0app" cmd /k "set BROWSER=none&& set EXPO_NO_BROWSER=1&& npx expo start --clear"
) else (
  echo TeachWise App is already running.
)
