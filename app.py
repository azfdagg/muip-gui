import sys
import os
import re
import json
import glob
import requests
import hashlib
import random
import string
import urllib.parse
import time
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

CONFIG_PATH = 'data/config.json'
DATA_FILE = 'data/data.json'

def get_muip_config():
    """Загрузка конфигурационных данных хоста и секретного ключа для MUIP."""
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)['muip']['dev_docker']
        except Exception as e:
            print(f"Предупреждение: Ошибка чтения config.json ({e}). Используются базовые настройки.")
    return {
        "host": "http://127.0.0.1:21051",
        "sign": "9H2UrJ5J4yZJf95FqMkqi628snEmzvyV9oAp"
    }

def sha256_sign(secret, message):
    """Генерация хеша подписи по стандарту MUIP сервера."""
    sha256 = hashlib.sha256()
    sha256.update(f"{message}{secret}".encode())
    return sha256.hexdigest()

def load_data():
    """Чтение сохраненных пользовательских макросов и UID."""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Ошибка чтения data.json: {e}")
    return {"uid": "1", "custom_commands": ["item add 201 10000", "wudi global avatar on"]}

def save_data(data):
    """Сохранение макросов и UID в data.json."""
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Ошибка записи в data.json: {e}")

def parse_handbook():
    """Парсинг справочника ID предметов и персонажей из текстовых файлов."""
    items = []
    files = glob.glob("data/*Handbook*.txt") + glob.glob("data/*.txt")
    seen = set()
    
    for f_path in files:
        if "muip_commands" in f_path or "КОМАНДЫ" in f_path:
            continue
        try:
            with open(f_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    line = line.strip()
                    match = re.match(r'^(\d+)\s*:\s*(.*)', line)
                    if match:
                        item_id = match.group(1)
                        name = match.group(2).strip()
                        if (item_id, name) not in seen:
                            seen.add((item_id, name))
                            items.append({"id": item_id, "name": name})
        except Exception as e:
            print(f"Ошибка парсинга файла справочника {f_path}: {e}")
    
    if not items:
        print("Предупреждение: Не найдено ни одного файла справочника. Справочник пуст.")
    
    return items

def parse_muip_commands():
    """Сбор доступных MUIP функций из текстового файла."""
    commands = {}
    path = "data/muip_commands.txt"
    
    if not os.path.exists(path):
        print(f"Предупреждение: Файл {path} не найден. MUIP команды не загружены.")
        return commands
    
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):  # Пропускаем пустые строки и комментарии
                    continue
                parts = [p.strip() for p in line.split("=>")]
                if len(parts) >= 2:
                    cmd_id = parts[0]
                    handler_info = parts[1]
                    name = handler_info.split("::")[-1]
                    params = []
                    if len(parts) >= 3:
                        params = [p.strip() for p in parts[2].split(",")]
                    commands[cmd_id] = {"name": name, "params": params}
    except Exception as e:
        print(f"Ошибка чтения muip_commands.txt: {e}")
    
    if not commands:
        print("Предупреждение: Не удалось загрузить ни одной MUIP команды.")
    
    return commands

@app.route('/')
@app.route('/index.html')
def index():
    return render_template('index.html')

@app.route('/api/state', methods=['GET', 'POST'])
def handle_state():
    if request.method == 'POST':
        save_data(request.json)
        return jsonify({"status": "ok"})
    return jsonify(load_data())

@app.route('/api/schema', methods=['GET'])
def get_schema():
    return jsonify({
        "handbook": parse_handbook(),
        "muip": parse_muip_commands()
    })

@app.route('/api/execute_muip', methods=['POST'])
def execute_muip():
    req = request.json
    cmd_id = str(req.get('cmd_id'))
    params = req.get('params', {})
    
    config = get_muip_config()
    
    # Формируем базовые служебные ключи MUIP запроса
    query_params = {
        "region": "dev_docker",
        "ticket": "".join(random.choices(string.ascii_letters + string.digits, k=16)),
        "cmd": cmd_id
    }
    
    # Записываем пришедшие пользовательские аргументы формы
    for k, v in params.items():
        if v is not None and str(v).strip() != "":
            query_params[str(k)] = str(v)
            
    # Алфавитная сортировка параметров (КРИТИЧЕСКИ ВАЖНО ДЛЯ ВАЛИДНОСТИ ПОДПИСИ)
    sorted_keys = sorted(query_params.keys())
    kvs = [f"{k}={query_params[k]}" for k in sorted_keys]
    query_string = "&".join(kvs)
    
    # Хеширование упорядоченной строки запроса и приватного ключа
    sign = sha256_sign(config['sign'], query_string)
    
    # Сборка закодированного URL
    quoted_query = urllib.parse.quote_plus(query_string, safe='=&')
    url = f"{config['host']}/api?{quoted_query}&sign={sign}"
    
    try:
        res = requests.get(url, timeout=5)
        try:
            res_data = res.json()
            return jsonify({"retcode": 0, "data": res_data, "url_debug": url})
        except:
            return jsonify({"retcode": 0, "raw_response": res.text, "url_debug": url})
    except Exception as e:
        return jsonify({"retcode": -1, "message": str(e)}), 500


# Получение списка доступных пакетов квестов
@app.route('/api/quest_packages/list', methods=['GET'])
def get_quest_packages():
    packages = []
    quests_dir = 'data/quests'
    
    if not os.path.exists(quests_dir):
        return jsonify([])
    
    for file_path in glob.glob(os.path.join(quests_dir, '*.json')):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                packages.append({
                    'filename': os.path.basename(file_path),
                    'name': data.get('name', os.path.basename(file_path)),
                    'description': data.get('description', ''),
                    'quests': data.get('quests', [])
                })
        except Exception as e:
            print(f"Ошибка загрузки пакета {file_path}: {e}")
    
    return jsonify(packages)

# Загрузка конкретного пакета
@app.route('/api/quest_packages/load', methods=['POST'])
def load_quest_package():
    data = request.json
    filename = data.get('filename')
    
    if not filename:
        return jsonify({'error': 'Filename required'}), 400
    
    file_path = os.path.join('data/quests', filename)
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'Package not found'}), 404
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            package_data = json.load(f)
            return jsonify(package_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Выполнение пакета квестов (для кнопки "Подтвердить")
@app.route('/api/quest_packages/execute_step', methods=['POST'])
def execute_quest_step():
    data = request.json
    quest_id = data.get('quest_id')
    action = data.get('action')  # 'accept' или 'finish'
    uid = data.get('uid', '1')
    cooldown = data.get('cooldown', 0)
    
    if not quest_id or not action:
        return jsonify({'error': 'Quest ID and action required'}), 400
    
    # Формируем команду
    cmd = f"quest {action} {quest_id}"
    
    # Выполняем через sendMuipRequest (используем существующую функцию)
    # Но для ответа из бэкенда вызываем напрямую MUIP
    try:
        config = get_muip_config()
        query_params = {
            "region": "dev_docker",
            "ticket": "".join(random.choices(string.ascii_letters + string.digits, k=16)),
            "cmd": "1116",
            "uid": uid,
            "msg": cmd
        }
        
        sorted_keys = sorted(query_params.keys())
        kvs = [f"{k}={query_params[k]}" for k in sorted_keys]
        query_string = "&".join(kvs)
        
        sign = sha256_sign(config['sign'], query_string)
        quoted_query = urllib.parse.quote_plus(query_string, safe='=&')
        url = f"{config['host']}/api?{quoted_query}&sign={sign}"
        
        res = requests.get(url, timeout=5)
        
        # Если есть cooldown - ждем
        if cooldown > 0:
            time.sleep(cooldown / 1000.0)
        
        return jsonify({
            'success': True,
            'quest_id': quest_id,
            'action': action,
            'response': res.text
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8483, debug=True)
