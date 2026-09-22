@echo off
rem Bagra - run the redesign locally, with its own test database.
rem Double-click. Stop by closing the server window.
rem
rem The database belongs to the address. http://localhost:8799 is its own origin:
rem nothing is shared with the published app on GitHub Pages or with any other port.
rem Chrome is opened with a separate test profile as well. Delete that folder to
rem start again from empty.
cd /d "%~dp0\..\.."
set PORT=8799
set PROFILE=%LOCALAPPDATA%\bagra-design-test-profile
set URL=http://localhost:%PORT%/index.html
set PY=
where py >nul 2>nul && set PY=py
if "%PY%"=="" where python >nul 2>nul && set PY=python
if "%PY%"=="" (
  echo Python is needed: https://www.python.org/downloads/  ^(tick "Add python.exe to PATH"^)
  pause
  exit /b 1
)
start "Bagra local server - close to stop" %PY% -m http.server %PORT% --bind 127.0.0.1
timeout /t 2 /nobreak >nul
set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
if exist "%CHROME%" (
  start "" "%CHROME%" --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check %URL%
) else (
  echo Chrome not found; opening the default browser. The database is still separate.
  start "" %URL%
)
echo Test profile: %PROFILE%
