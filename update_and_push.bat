@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ===============================
REM update_and_push.bat  (universal)
REM Usage:
REM   update_and_push.bat                 -> uses existing origin; creates empty commit if no changes
REM   update_and_push.bat <GIT_URL>       -> if no .git, init and set origin to <GIT_URL>
REM Notes:
REM - Pushes current branch; if none, creates/uses 'main'.
REM - First push sets upstream automatically.
REM ===============================

REM 0) require Git
git --version >NUL 2>&1
IF ERRORLEVEL 1 (
  echo [ERROR] Git is not installed or not in PATH.
  exit /b 1
)

REM 1) optional arg: remote url
set "REMOTE_URL=%~1"

REM 2) ensure we're in a git repo (or init if URL given)
IF NOT EXIST ".git" (
  IF "%REMOTE_URL%"=="" (
    echo [ERROR] No .git in this folder. Pass repo URL:
    echo   update_and_push.bat https://github.com/USER/REPO.git
    exit /b 1
  )
  echo [INIT] No .git found. Initializing new repo on branch 'main' and setting origin...
  git init -b main || (echo [ERROR] git init failed & exit /b 1)
  git remote add origin "%REMOTE_URL%" || (echo [ERROR] adding origin failed & exit /b 1)
)

REM 3) make sure we have a branch name; prefer current, else create/checkout main
for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD 2^>NUL') do set "BR=%%B"
IF "%BR%"=="" (
  set "BR=main"
  git checkout -B "%BR%" >NUL 2>&1
)

REM 4) if origin missing but URL was provided, set it
for /f "delims=" %%R in ('git remote 2^>NUL') do set "HASREMOTE=1"
IF NOT DEFINED HASREMOTE (
  IF "%REMOTE_URL%"=="" (
    echo [ERROR] No remote configured. Pass repo URL:
    echo   update_and_push.bat https://github.com/USER/REPO.git
    exit /b 1
  )
  git remote add origin "%REMOTE_URL%" || (echo [ERROR] adding origin failed & exit /b 1)
)

REM 5) stage and commit (allow empty to trigger CI/Vercel)
git add -A
set "MSG=update %date% %time%"
git commit -m "%MSG%" --allow-empty >NUL 2>&1

REM 6) push: try normal push first; if fails (no upstream), push with -u
git push
IF ERRORLEVEL 1 (
  git push -u origin "%BR%"
  IF ERRORLEVEL 1 (
    echo [ERROR] Push failed.
    exit /b 1
  )
)

echo [OK] Pushed to %CD% on branch "%BR%".
exit /b 0