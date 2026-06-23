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
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Локальные пути хранения конфигураций панели
CONFIG_PATH = 'data/config.json'
DATA_FILE = 'data.json'

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
    files = glob.glob("*Handbook*.txt") + glob.glob("*.txt")
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
        # Резервные базовые ID, если файлы справочников отсутствуют
        items = [
            {"id": "201", "name": "Камень Истока (Primogems)"},
            {"id": "202", "name": "Мора (Mora)"},
            {"id": "223", "name": "Переплетающиеся судьбы"},
            {"id": "224", "name": "Судьбоносные встречи"},
            {"id": "10000002", "name": "Камисато Аяка"}
        ]
    return items

def parse_muip_commands():
    """Сбор доступных MUIP функций из текстового файла или внутреннего словаря."""
    commands = {}
    path = "muip_commands.txt"
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
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
        # Полный структурированный список команд из ТЗ
        raw_list = [
            "1001 => RequestHandler::queryPlayerAccountUid => uid",
            "1002 => RequestHandler::queryPlayerUidByAccountUid => account_type, account_uid",
            "1004 => RequestHandler::queryPlayerBinInfo => uid",
            "1005 => RequestHandler::sendMail => uid, title, content, sender, expire_time, importance, config_id, item_limit_type, tag, source_type, item_list",
            "1006 => RequestHandler::queryRedisMailInfo => uid",
            "1007 => RequestHandler::queryPlayerPostion => uid",
            "1009 => RequestHandler::queryCombatForce => uid",
            "1011 => RequestHandler::queryRegions",
            "1012 => RequestHandler::queryPlayerWorldBinInfo => uid",
            "1013 => RequestHandler::queryPlayerBlockBinInfo => uid",
            "1014 => RequestHandler::queryPlayerGroupBinInfo => uid, group_id",
            "1015 => RequestHandler::queryPlayerQuestBinInfo => uid",
            "1016 => RequestHandler::queryPlayerItemBinInfo => uid",
            "1017 => RequestHandler::queryPlayerGroupBinInfo2 => uid, group_id, block_id",
            "1018 => RequestHandler::queryPlayerCoopBinInfo => uid",
            "1101 => RequestHandler::getPlayerNum",
            "1102 => RequestHandler::queryLoginBlackUid => uid",
            "1103 => RequestHandler::updateLoginBlackUid => uid, begin_time, end_time",
            "1104 => RequestHandler::delLoginBlackUid => uid",
            "1105 => RequestHandler::addWhiteAccountUid => account_type, account_uid",
            "1106 => RequestHandler::isWhiteAccountUid => account_type, account_uid",
            "1107 => RequestHandler::queryPlayerStatusRedisData => uid",
            "1108 => RequestHandler::queryPlayerOnline => uid, gameserver_id",
            "1109 => RequestHandler::delPlayerStatusRedisData => uid, last_login_rand",
            "1110 => RequestHandler::guestBindAccount => account_id, uid, account_type",
            "1111 => RequestHandler::delItem => uid, item_id, item_num",
            "1112 => RequestHandler::playerGoto => uid, scene_id, x, y, z",
            "1113 => RequestHandler::resetParentQuest => uid, parent_quest_id",
            "1114 => RequestHandler::refreshGroupSuite => uid, group_id, suite_id",
            "1115 => RequestHandler::setScenePointLockStatus",
            "1116 => RequestHandler::gmTalk => uid, msg",
            "1117 => RequestHandler::setNickName => uid, nickname",
            "1118 => RequestHandler::refreshShop => uid",
            "1119 => RequestHandler::unlockTalent => uid, avatar_id, skill_depot_id, talent_id",
            "1120 => RequestHandler::takeoffEquip => uid, avatar_id, equip_id",
            "1121 => RequestHandler::delMail => uid, mail_id",
            "1122 => RequestHandler::finishDailyTask => uid, daily_task_id",
            "1123 => RequestHandler::queryRedisOfflineMsg => uid",
            "1124 => RequestHandler::unlockArea => uid, area_id",
            "1125 => RequestHandler::delItemNegative => uid, item_id, item_num",
            "1126 => RequestHandler::delEquip => uid, guid",
            "1127 => RequestHandler::addItem => uid, item_id, item_count, extra_params",
            "1128 => RequestHandler::modifyBornPos => uid, scene_id, pos",
            "1129 => RequestHandler::getPlatformPlayerNum",
            "1134 => RequestHandler::delRedisMail => uid, mail_index, mail_ticket",
            "1135 => RequestHandler::subCoinNegative => uid, scoin, hcoin, mcoin, is_psn",
            "1136 => RequestHandler::bindGmUid => gm_uid, player_uid",
            "1137 => RequestHandler::unBindGmUid => gm_uid",
            "1138 => RequestHandler::getBindGmUid => app_id",
            "1139 => RequestHandler::setQuestContentProgress => uid, quest_id, finish_progress, fail_progress",
            "1140 => RequestHandler::queryOrderDataByUid => uid, begin_trade_time, end_trade_time",
            "1141 => RequestHandler::queryOrderDataByTradeNo => trade_no",
            "1143 => RequestHandler::finishOrder => order_id",
            "1144 => RequestHandler::delRedisMailByTicket => uid, mail_ticket",
            "1145 => RequestHandler::insertMailBlockTag",
            "1146 => RequestHandler::batchBlockPlayerChat => block_list",
            "1147 => RequestHandler::batchUnblockPlayerChat => unblock_uid_list",
            "1148 => RequestHandler::queryPlayerChatBlockStatus => uid",
            "1149 => RequestHandler::addOrModifyWatcher => uid, watcher_id, progress",
            "1150 => RequestHandler::delWatcher => uid, watcher_id",
            "1151 => RequestHandler::queryPlayerFriendList => uid",
            "1152 => RequestHandler::checkVersions => server_version, client_version, client_silence_version",
            "1153 => RequestHandler::queryPlayerBriefData => uid",
            "1154 => RequestHandler::queryPlayerExtraBinData => uid",
            "1155 => RequestHandler::updatePlayerSecurityLevel => uid, check_type, security_level",
            "1156 => RequestHandler::QueryPlayerRegPlatform => uid",
            "1157 => RequestHandler::addFeatureSwitch => id, type, msg",
            "1158 => RequestHandler::deleteFeatureSwitch => id",
            "1159 => RequestHandler::setSignature => uid, signature",
            "1160 => RequestHandler::addOrSubResin => uid, delta_count, is_sub",
            "1161 => RequestHandler::setQuestGlobalVarValue => uid, global_var_id, value",
            "1162 => RequestHandler::changeBindAccount => account_id, uid, account_type",
            "1163 => RequestHandler::SetUserTag => tag, uids",
            "1164 => RequestHandler::batchBlockPlayerMp => block_uid_list",
            "1165 => RequestHandler::batchUnblockPlayerMp => unblock_uid_list",
            "1166 => RequestHandler::queryPlayerMpBlockStatus => uid",
            "1167 => RequestHandler::queryCrcSuspiciousList => uid",
            "1168 => RequestHandler::addToCrcSuspiciousList => uid_list, is_notify",
            "1169 => RequestHandler::removeFromCrcSuspiciousList => uid_list",
            "1170 => RequestHandler::checkCrcVersions => platform_type, client_version",
            "1171 => RequestHandler::forceAcceptQuest => uid, quest_id",
            "1172 => RequestHandler::setMainCoopConfidence => uid, confidence",
            "1173 => RequestHandler::addCoopPointSavePointList => uid, coop_point_id, save_point_list, ticket",
            "1174 => RequestHandler::setFinishParentQuestChildQuestState => uid, quest_id, state",
            "1175 => RequestHandler::setLevel1AreaExplorePoint => uid, scene_id, level1_area_id, explore_point",
            "1176 => RequestHandler::setCodexOpenOrClose => uid, codex_type, codex_id, is_open",
            "1200 => RequestHandler::addMcoinVipPoint => uid, mcoin, vip_point, is_psn",
            "1201 => RequestHandler::getPlayerLoginPerSecond",
            "1210 => RequestHandler::getFineGrainedPlayerNum",
            "1211 => RequestHandler::removeGadgetInGroupByConfigId => uid, scene_id, group_id, config_id",
            "1212 => RequestHandler::operateDelGadgetInGroupByConfigId => uid, scene_id, group_id, config_id, is_add",
            "1213 => RequestHandler::operateGadgetStateInGroupByConfigId => uid, scene_id, group_id, config_id, state, is_create",
            "1214 => RequestHandler::removeMonsterInGroupByConfigId => uid, scene_id, group_id, config_id",
            "1215 => RequestHandler::operateDelMonsterInGroupByConfigId => uid, scene_id, group_id, config_id, is_add",
            "1216 => RequestHandler::removeGroupTriggerByName => uid, scene_id, group_id, trigger_name",
            "1217 => RequestHandler::setGroupTriggerCountByName => uid, scene_id, group_id, trigger_name, trigger_count",
            "1218 => RequestHandler::setGroupVariableByName => uid, scene_id, group_id, variable_name, value",
            "1219 => RequestHandler::setGroupTargetSuite => uid, scene_id, group_id, target_suite",
            "1220 => RequestHandler::removeGroupOneoffByConfigId => uid, scene_id, group_id, config_id, is_monster",
            "1221 => RequestHandler::finishRoutine => uid, routine_id",
            "1222 => RequestHandler::finishDailyTaskUnloadGroup => uid, daily_task_id",
            "1223 => RequestHandler::refreshBlossomCircleCamp => uid, refresh_id, circle_camp_id",
            "1224 => RequestHandler::queryPlayerShowAvatarInfo => uid, avatar_id",
            "1225 => RequestHandler::kickOutPlayerByAccountUid => account_type, account_uid",
            "1226 => RequestHandler::operateSetGroupDead => uid, scene_id, group_id",
            "1227 => RequestHandler::operateSetGroupUnregister => uid, scene_id, group_id",
            "1228 => RequestHandler::recoverWorldLevel => uid",
            "1229 => RequestHandler::addRegionSearchProgress => uid, region_id, add_recycle, add_progress",
            "1230 => RequestHandler::setMatchPunishTimes => uid, match_id, punish_times",
            "1231 => RequestHandler::resetChannellerSlabCampGroup => uid, stage_id, round_id",
            "1232 => RequestHandler::procSceneTag => uid, scene_id, scene_tag_id, op_type",
            "1233 => RequestHandler::setClimateAreaType => uid, scene_id, climate_area_id, climate_type",
            "1234 => RequestHandler::exchangeMcoin => uid, num, exchange_type",
            "1235 => RequestHandler::sendConcertProduct => uid, config_id",
            "1236 => RequestHandler::updateRedPoint => uid, red_point_list",
            "1237 => RequestHandler::queryConcertProductInfo => uid, config_id",
            "1238 => RequestHandler::kickOutPlayerByUid => uid, reason",
            "1301 => RequestHandler::registerGroupLinkBundle => uid, group_bundle_id, activity_id",
            "1302 => RequestHandler::finishGroupLinkBundle => uid, group_bundle_id",
            "1303 => RequestHandler::unregisterGroupLinkBundle => uid, group_bundle_id",
            "1405 => RequestHandler::AntiAddictNotify => msg_type, account_type, account_uid, msg, level",
            "5001 => RequestHandler::queryPlayerMemBasicData => uid",
            "5002 => RequestHandler::queryPlayerMemBasicDataByAccountUid => account_type, account_uid",
            "5003 => RequestHandler::queryPlayerRedisBasicData => uid",
            "5004 => RequestHandler::queryPlayerRedisBasicDataByAccountUid => account_type, account_uid",
            "5005 => RequestHandler::queryPlayerH5ActivityData => uid, h5_schedule_id_list",
            "6000 => RequestHandler::queryHomeBinInfo => uid",
            "6001 => RequestHandler::batchBlockHome => block_list",
            "6002 => RequestHandler::batchUnblockHome => unblock_uid_list",
            "6004 => RequestHandler::homeRestoreDefaultsArrangement => uid, module_id_list",
            "6005 => RequestHandler::homeRestoreDefaultsSceneArrangement => uid, module_id, scene_id",
            "6006 => RequestHandler::queryHomeBlockStatus => uid"
        ]
        for line in raw_list:
            parts = [p.strip() for p in line.split("=>")]
            if len(parts) >= 2:
                cmd_id = parts[0]
                handler_info = parts[1]
                name = handler_info.split("::")[-1]
                params = []
                if len(parts) >= 3:
                    params = [p.strip() for p in parts[2].split(",")]
                commands[cmd_id] = {"name": name, "params": params}
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

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8483, debug=True)
