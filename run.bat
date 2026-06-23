@echo off
chcp 65001 >nul
echo Установка и обновление зависимостей...
python -m pip install -r requirements.txt
echo.
echo Запуск сервера Web UI...
python app.py
pause