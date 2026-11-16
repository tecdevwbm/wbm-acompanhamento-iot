@echo off
title WBM Coletor MQTT Postman (AWS + ORACLE)
echo Iniciando Coletor Direto MQTT (Postman -> AWS 52.67.133.240 e ORACLE 163.176.56.133)...
start "" "http://localhost:8080"
cd /d "%~dp0webapp"
python coletor_mqtt_postman.py
