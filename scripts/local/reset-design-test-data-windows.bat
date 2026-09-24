@echo off
rem Deletes ONLY the redesign's test profile. Your everyday browser and the
rem published app are not touched. Close the test Chrome window first.
set PROFILE=%LOCALAPPDATA%\bagra-design-test-profile
if not exist "%PROFILE%" ( echo Nothing to delete. & pause & exit /b 0 )
set /p A=Delete %PROFILE% ? [y/N] 
if /i "%A%"=="y" rmdir /s /q "%PROFILE%" && echo Deleted. The next start begins with an empty database.
pause
