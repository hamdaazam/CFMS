@echo off
echo Starting React Frontend Server...
cd "Fyp CFMS"
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
echo Starting development server...
call npm run dev
pause

