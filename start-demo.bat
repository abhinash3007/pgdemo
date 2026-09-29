@echo off
set PATH=C:\node-latest\node-v25.2.1-win-x64;%PATH%
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run dev
