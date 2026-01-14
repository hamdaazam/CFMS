@echo off
REM ============================================================
REM CFMS Project - Backup/Save Script
REM This script creates a backup of your entire project
REM ============================================================

echo.
echo ============================================================
echo   CFMS Project - Save/Backup Script
echo ============================================================
echo.

REM Get the current directory (project root)
set PROJECT_DIR=%~dp0
set PROJECT_NAME=cfms_final_project
set BACKUP_DIR=%USERPROFILE%\Desktop
set TIMESTAMP=%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_NAME=%PROJECT_NAME%_%TIMESTAMP%

echo Project Directory: %PROJECT_DIR%
echo Backup Location: %BACKUP_DIR%\%BACKUP_NAME%
echo.

REM Ask user for backup method
echo Choose backup method:
echo 1. Copy entire project folder (Recommended for deployment)
echo 2. Create ZIP file (Recommended for backup/archive)
echo.
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" goto COPY_METHOD
if "%choice%"=="2" goto ZIP_METHOD
echo Invalid choice. Exiting...
pause
exit /b 1

:COPY_METHOD
echo.
echo Copying project to: %BACKUP_DIR%\%BACKUP_NAME%
echo This may take a few minutes...
echo.

REM Create destination folder
mkdir "%BACKUP_DIR%\%BACKUP_NAME%" 2>nul

REM Copy project excluding unnecessary files
echo Copying files (excluding node_modules, venv, __pycache__, etc.)...
xcopy "%PROJECT_DIR%Fyp Project Client" "%BACKUP_DIR%\%BACKUP_NAME%\Fyp Project Client" /E /I /H /Y /EXCLUDE:exclude_list.txt 2>nul

REM Create exclude list if it doesn't exist
if not exist exclude_list.txt (
    (
        echo node_modules\
        echo venv\
        echo __pycache__\
        echo *.pyc
        echo .git\
        echo dist\
        echo *.log
        echo .env
        echo .DS_Store
        echo Thumbs.db
    ) > exclude_list.txt
)

REM Manual copy with exclusions (more reliable)
echo.
echo Copying project files (this may take a few minutes)...
robocopy "%PROJECT_DIR%Fyp Project Client" "%BACKUP_DIR%\%BACKUP_NAME%\Fyp Project Client" /E /XD node_modules venv __pycache__ .git dist /XF *.pyc *.log .env .DS_Store Thumbs.db /NFL /NDL /NJH /NJS /R:3 /W:5

REM Copy root level files
if exist "%PROJECT_DIR%start-backend.bat" copy "%PROJECT_DIR%start-backend.bat" "%BACKUP_DIR%\%BACKUP_NAME%\" >nul
if exist "%PROJECT_DIR%start-frontend.bat" copy "%PROJECT_DIR%start-frontend.bat" "%BACKUP_DIR%\%BACKUP_NAME%\" >nul

echo.
echo ============================================================
echo   SUCCESS! Project saved to:
echo   %BACKUP_DIR%\%BACKUP_NAME%
echo ============================================================
goto END

:ZIP_METHOD
echo.
echo Creating ZIP file...
echo This may take a few minutes...
echo.

REM Check if PowerShell is available
powershell -Command "Compress-Archive -Path '%PROJECT_DIR%Fyp Project Client' -DestinationPath '%BACKUP_DIR%\%BACKUP_NAME%.zip' -Force" 2>nul

if %errorLevel% EQU 0 (
    echo.
    echo ============================================================
    echo   SUCCESS! ZIP file created:
    echo   %BACKUP_DIR%\%BACKUP_NAME%.zip
    echo ============================================================
) else (
    echo.
    echo ERROR: Failed to create ZIP file.
    echo Trying alternative method...
    
    REM Alternative: Use 7-Zip if available, or manual instructions
    echo.
    echo Please manually create a ZIP file:
    echo 1. Right-click on "Fyp Project Client" folder
    echo 2. Select "Send to" ^> "Compressed (zipped) folder"
    echo 3. Rename it to: %BACKUP_NAME%.zip
    echo.
)

:END
echo.
echo Backup completed!
echo.
echo Note: The backup excludes:
echo   - node_modules (can be reinstalled with npm install)
echo   - venv (can be recreated)
echo   - __pycache__ (auto-generated)
echo   - dist (build output)
echo   - .git (version control)
echo.
pause

