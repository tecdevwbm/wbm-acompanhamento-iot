@echo off
title WBM Acompanhamento Automatizado - WebApp Server
echo Iniciando servidor local do WBM Acompanhamento Automatizado em http://localhost:8080 ...
start "" "http://localhost:8080"
cd /d "%~dp0webapp"
python -m http.server 8080
