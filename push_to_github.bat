@echo off
echo Starting git operations...

REM Check current directory
echo Current directory: %CD%

REM Add all files
echo Adding files...
git add .

REM Check status
echo Git status:
git status

REM Commit if there are changes
echo Checking for changes...
git diff --cached --quiet
if %errorlevel% neq 0 (
    echo Committing changes...
    git commit -m "Update project code - MediPath Ease medical management system"
) else (
    echo No changes to commit
)

REM Push to repository
echo Pushing to repository...
git push -u origin master

echo Done!
pause
