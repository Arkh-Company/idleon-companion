@echo off
rem The Steam launch option of Legends of Idleon calls this script with the game command line (docs/steam-setup.md).
rem It runs the keeper in the foreground, so Steam tracks it, and passes the Steam command line through.
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\node_modules\electron\dist\electron.exe" "%~dp0..\out\main\keeper.js" %*
