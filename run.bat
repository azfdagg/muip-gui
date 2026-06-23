@echo off
chcp 65001 >nul
echo Install requirements...
python -m pip install -r requirements.txt
echo.
echo Start server Web UI...
python app.py
pause