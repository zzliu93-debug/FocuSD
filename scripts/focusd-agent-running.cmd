@echo off
setlocal

set "PROVIDER=%~1"
if /I "%PROVIDER%"=="codex" (
  set "MARKER=agent-codex-running.flag"
  set "HOLD=agent-codex-running-hold.flag"
) else if /I "%PROVIDER%"=="claudeCode" (
  set "MARKER=agent-claudeCode-running.flag"
  set "HOLD=agent-claudeCode-running-hold.flag"
) else (
  exit /b 2
)

if defined FOCUSD_AGENT_STATUS_DIR (
  set "STATUS_DIR=%FOCUSD_AGENT_STATUS_DIR%"
) else (
  if defined APPDATA (
    set "STATUS_DIR=%APPDATA%\com.focusd.island"
  ) else (
    set "STATUS_DIR=%LOCALAPPDATA%\com.focusd.island"
  )
)

if not exist "%STATUS_DIR%" mkdir "%STATUS_DIR%" >nul 2>nul
break > "%STATUS_DIR%\%MARKER%"
del "%STATUS_DIR%\%HOLD%" >nul 2>nul

exit /b 0
