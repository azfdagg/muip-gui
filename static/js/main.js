            let state = { uid: "1", custom_commands: [] };
            let muipSchema = {};
            let fullHandbookList = [];

            window.addEventListener('DOMContentLoaded', async () => {
                await loadState();
                await loadSchema();
                initMailTab();
                initArtifactTab();
            });

            async function loadState() {
                try {
                    const res = await fetch('/api/state');
                    state = await res.json();
                    document.getElementById('global-uid').value = state.uid || "1337";
                    renderCustomCommands();
                } catch (e) {
                    logToTerminal("Ошибка синхронизации состояния: " + e, "err");
                }
            }

            async function saveState() {
                try {
                    await fetch('/api/state', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(state)
                    });
                } catch (e) {
                    logToTerminal("Ошибка сохранения состояния: " + e, "err");
                }
            }

            function syncUidChange() {
                state.uid = document.getElementById('global-uid').value.trim();
                saveState();
                logToTerminal(`Глобальный UID переключен на: ${state.uid}`, "info");
                
                document.querySelectorAll('.dyn-param-input').forEach(input => {
                    if(['uid', 'player_uid', 'gm_uid'].includes(input.dataset.param)) {
                        input.value = state.uid;
                    }
                });
            }

            async function loadSchema() {
                try {
                    const res = await fetch('/api/schema');
                    const data = await res.json();
                    muipSchema = data.muip || {};
                    fullHandbookList = data.handbook || [];
            filteredMailHandbook = fullHandbookList;
                    
                    const select = document.getElementById('muip-cmd-select');
                    select.innerHTML = '<option value="">-- Выберите команду --</option>';
                    
                    Object.keys(muipSchema).sort((a,b) => parseInt(a) - parseInt(b)).forEach(cmdId => {
                        const option = document.createElement('option');
                        option.value = cmdId;
                        option.textContent = `${cmdId} - ${muipSchema[cmdId].name}`;
                        select.appendChild(option);
                    });

                    renderHandbookTable(fullHandbookList.slice(0, 100));
                } catch (e) {
                    logToTerminal("Ошибка разбора схемы метаданных: " + e, "err");
                }
            }

        function switchTab(tabId) {
            document.querySelectorAll('.content-area').forEach(area => area.classList.remove('active'));
            document.querySelectorAll('.sidebar button').forEach(btn => btn.classList.remove('active'));
            
            document.getElementById(tabId).classList.add('active');
            if(document.getElementById('btn-' + tabId)) {
                document.getElementById('btn-' + tabId).classList.add('active');
            }

            const titleMap = {
                'tab-gm': 'Быстрые GM Команды',
                'tab-muip': 'Все MUIP Функции Напрямую',
                'tab-handbook': 'Книга Справочник ID (Handbook)',
                'tab-settings': 'Настройки Конфигурации',
                'tab-mail': ' Отправить почту (MUIP 1005)',
                'tab-spawn': ' Спавн монстров (MUIP 1116)',
                'tab-artifact': ' Выдать артефакт (MUIP 1127)',
                'tab-teleport': ' Телепорт (MUIP 1116)',
                'tab-player': ' Игрок (MUIP 1116)',
                'tab-weapons': ' Оружие (MUIP 1116)',
                'tab-characters': ' Персонажи (MUIP 1116)',
                'tab-quests': ' Квесты (MUIP 1116)',
                'tab-items': ' Предметы (MUIP 1116)',
                
            };
            document.getElementById('current-title').textContent = titleMap[tabId] || tabId;
        }

        function logToTerminal(msg, type = "success") {
            // Добавляем в консоль
            const consoleOutput = document.getElementById('consoleOutput');
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg}`;
            consoleOutput.appendChild(entry);
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
            
            // Обновляем счётчик записей
            const count = consoleOutput.children.length;
            document.getElementById('console-entry-count').textContent = `${count} записей`;
            
            // Показываем уведомление
            showNotification(msg, type);
        }

        function clearConsole() {
            const consoleOutput = document.getElementById('consoleOutput');
            consoleOutput.innerHTML = '';
            document.getElementById('console-entry-count').textContent = '0 записей';
        }

        function toggleConsole() {
            const container = document.getElementById('consoleContainer');
            const btn = document.getElementById('consoleToggleBtn');
            
            container.classList.toggle('visible');
            btn.classList.toggle('active');
            
            if (container.classList.contains('visible')) {
                btn.innerHTML = '<i class="icon-x"></i>';
                // Прокручиваем вниз
                const output = document.getElementById('consoleOutput');
                output.scrollTop = output.scrollHeight;
            } else {
                btn.innerHTML = '<i class="icon-terminal"></i><span class="notif-badge" id="notifBadge" style="display:none;">0</span>';
            }
}

        // ============================================
        // СИСТЕМА УВЕДОМЛЕНИЙ
        // ============================================

        let notificationQueue = [];
        let isNotificationVisible = false;

        function showNotification(msg, type = "success") {
            const container = document.getElementById('notification-container');
            
            // Определяем иконку в зависимости от типа
            let icon = '✅';
            let typeClass = '';
            if (type === 'err') {
                icon = '❌';
                typeClass = 'error';
            } else if (type === 'info') {
                icon = 'ℹ️';
                typeClass = 'info';
            } else if (type === 'warning') {
                icon = '⚠️';
                typeClass = 'warning';
            }
            
            // Создаём уведомление
            const notif = document.createElement('div');
            notif.className = `notification ${typeClass}`;
            
            // Форматируем сообщение
            let text = typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg;
            if (text.length > 100) {
                text = text.substring(0, 100) + '...';
            }
            
            notif.innerHTML = `
                <span class="notif-icon">${icon}</span>
                <span class="notif-text">${text}</span>
                <button class="notif-close" onclick="this.closest('.notification').remove()">✕</button>
            `;
            
            container.appendChild(notif);
            
            // Автоматическое скрытие через 5 секунд
            setTimeout(() => {
                if (notif.parentNode) {
                    notif.classList.add('fade-out');
                    setTimeout(() => {
                        if (notif.parentNode) {
                            notif.remove();
                        }
                    }, 300);
                }
            }, 5000);
            
            // Обновляем бейдж на кнопке консоли
            updateNotifBadge();
        }

        function updateNotifBadge() {
            const container = document.getElementById('notification-container');
            const count = container.children.length;
            const badge = document.getElementById('notifBadge');
            
            if (count > 0) {
                badge.style.display = 'flex';
                badge.textContent = count;
            } else {
                badge.style.display = 'none';
            }
        }

        // Наблюдатель за изменениями в контейнере уведомлений
        const observer = new MutationObserver(() => {
            updateNotifBadge();
        });

        // Запускаем наблюдатель после загрузки
        document.addEventListener('DOMContentLoaded', () => {
            const container = document.getElementById('notification-container');
            if (container) {
                observer.observe(container, { childList: true, subtree: true });
            }
        });

        async function sendMuipRequest(cmdId, params = {}) {
            try {
                const response = await fetch('/api/execute_muip', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ cmd_id: cmdId, params: params })
                });
                const resData = await response.json();
                
                if (resData.retcode === 0) {
                    logToTerminal(resData.data || resData.raw_response);
                } else {
                    logToTerminal("Сервер вернул ошибку: " + resData.message, "err");
                }
            } catch (e) {
                logToTerminal("Сетевой сбой отправки: " + e, "err");
            }
        }

        function executeRawGm() {
            const input = document.getElementById('raw-gm-cmd');
            const cmdText = input.value.trim();
            if(!cmdText) return;
            quickGm(cmdText);
            input.value = '';
        }

        function quickGm(commandString) {
            sendMuipRequest('1116', {
                'uid': document.getElementById('global-uid').value,
                'msg': commandString
            });
        }

        // === УПРАВЛЕНИЕ КВЕСТАМИ ===
        function questAction(action) {
            const questId = document.getElementById('quest-id-input').value.trim();
            if (!questId) {
                logToTerminal(" Введите ID квеста.", "err");
                return;
            }
            document.getElementById('current-quest-id-display').textContent = questId;
            
            const lower = questId.toLowerCase();
            if (lower.startsWith('finishv2') || lower.startsWith('finish ') || lower.startsWith('clear ') || lower.startsWith('add ') || lower.startsWith('accept ')) {
                quickGm(questId);
                return;
            }
            let cmd = '';
            if (action === 'add') cmd = `quest add ${questId}`;
            else if (action === 'accept') cmd = `quest accept ${questId}`;
            else if (action === 'finish') cmd = `quest finish ${questId}`;
            else {
                logToTerminal(" Неизвестное действие: " + action, "err");
                return;
            }
            quickGm(cmd);
        }
        // === КОНЕЦ УПРАВЛЕНИЯ КВЕСТАМИ ===



        function renderCustomCommands() {
            const container = document.getElementById('custom-commands-list');
            container.innerHTML = '';
            if(!state.custom_commands || state.custom_commands.length === 0) {
                container.innerHTML = '<div style="color:#555; font-size:13px; text-align:center; padding:10px;">Нет сохраненных команд</div>';
                return;
            }
            state.custom_commands.forEach((cmd, idx) => {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.gap = '5px';
                div.innerHTML = `
                    <button class="action-btn secondary" style="flex:1; text-align:left; font-family:monospace; font-size:13px;" onclick="quickGm('${cmd}')">${cmd}</button>
                    <button class="action-btn danger" style="padding:8px 12px;" onclick="deleteCustomCommand(${idx})">✖</button>
                `;
                container.appendChild(div);
            });
        }

        function addCustomCommand() {
            const input = document.getElementById('new-custom-cmd');
            const text = input.value.trim();
            if(!text) return;
            
            if(!state.custom_commands) state.custom_commands = [];
            if(!state.custom_commands.includes(text)) {
                state.custom_commands.push(text);
                saveState();
                renderCustomCommands();
            }
            input.value = '';
        }

        function deleteCustomCommand(idx) {
            state.custom_commands.splice(idx, 1);
            saveState();
            renderCustomCommands();
        }

        function renderMuipForm() {
            const cmdId = document.getElementById('muip-cmd-select').value;
            const formCard = document.getElementById('muip-form-card');
            const inputsContainer = document.getElementById('muip-dynamic-inputs');
            
            if(!cmdId) {
                formCard.style.display = 'none';
                return;
            }
            
            const commandInfo = muipSchema[cmdId];
            document.getElementById('muip-form-title').textContent = `${commandInfo.name} (Команда ${cmdId})`;
            inputsContainer.innerHTML = '';
            
            const currentUid = document.getElementById('global-uid').value;

            if(!commandInfo.params || commandInfo.params.length === 0 || commandInfo.params[0] === "") {
                inputsContainer.innerHTML = '<div style="grid-column: span 2; color:#888; font-size:14px; text-align:center;">У обработчика нет настраиваемых аргументов.</div>';
            } else {
                commandInfo.params.forEach(paramName => {
                    const cleanParamName = paramName.replace('[', '').replace(']', '').split(' ')[0].trim();
                    const group = document.createElement('div');
                    group.className = 'form-group';
                    
                    let defaultValue = "";
                    if(['uid', 'player_uid', 'gm_uid'].includes(cleanParamName)) {
                        defaultValue = currentUid;
                    }
                    
                    group.innerHTML = `
                        <label>${paramName}:</label>
                        <input type="text" class="dyn-param-input" data-param="${cleanParamName}" value="${defaultValue}">
                    `;
                    inputsContainer.appendChild(group);
                });
            }
            formCard.style.display = 'block';
        }

        function executeMuipCommand() {
            const cmdId = document.getElementById('muip-cmd-select').value;
            if(!cmdId) return;
            
            const params = {};
            document.querySelectorAll('.dyn-param-input').forEach(input => {
                params[input.dataset.param] = input.value.trim();
            });
            sendMuipRequest(cmdId, params);
        }

        function renderHandbookTable(items) {
            const tbody = document.getElementById('handbook-table-body');
            tbody.innerHTML = '';
            
            if(items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#555;">Совпадений нет</td></tr>';
                return;
            }
            
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family: monospace; font-weight: bold; color: #00bfff;">${item.id}</td>
                    <td>${item.name}</td>
                    <td style="text-align: right;">
                        <button class="quick-badge" style="background:#00439c;" onclick="giveHandbookItem('${item.id}', 1)">Дать 1 шт</button>
                        <button class="quick-badge" style="background:#222;" onclick="giveHandbookItem('${item.id}', 100)">x100</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function filterHandbook() {
            const query = document.getElementById('handbook-search-input').value.toLowerCase().trim();
            if(!query) {
                renderHandbookTable(fullHandbookList.slice(0, 100));
                return;
            }
            const filtered = fullHandbookList.filter(item => {
                return item.id.toString().includes(query) || item.name.toLowerCase().includes(query);
            });
            renderHandbookTable(filtered.slice(0, 100));
        }

        function giveHandbookItem(itemId, count = 1) {
            let gmMsg = `item add ${itemId} ${count}`;
            if (itemId.length === 8 && itemId.startsWith("10")) {
                gmMsg = `avatar add ${itemId}`;
            }
            quickGm(gmMsg);
        }

        // ============================================
        // ФУНКЦИИ ДЛЯ ВЫДАЧИ АРТЕФАКТОВ
        // ============================================

        function initArtifactTab() {
            // Устанавливаем значения по умолчанию
            document.getElementById('artifact-uid').value = document.getElementById('global-uid').value || '1';
            document.getElementById('artifact-id').value = '';
            document.getElementById('artifact-level').value = '21';
            document.getElementById('artifact-main-prop').value = '';
            document.getElementById('artifact-sub-stats').value = '';
        }

        function parseArtifactCommand() {
            const input = document.getElementById('artifact-parse-input').value.trim();
            if (!input) {
                alert(' Введите команду для парсинга.');
                return;
            }

            // Убираем /give в начале если есть
            let cmd = input;
            if (cmd.startsWith('/give ')) {
                cmd = cmd.substring(6);
            } else if (cmd.startsWith('give ')) {
                cmd = cmd.substring(5);
            }

            // Разбиваем на части
            const parts = cmd.split(/\s+/);
            
            // Ищем ID артефакта (первый токен, который число от 70000 до 79999)
            let artifactId = null;
            let level = 21;
            let count = 1;
            let mainProp = null;
            let subStats = [];

            for (let i = 0; i < parts.length; i++) {
                const token = parts[i].toLowerCase();
                
                // Проверяем на ID артефакта
                if (!artifactId && /^\d{5,6}$/.test(parts[i]) && parseInt(parts[i]) >= 70000 && parseInt(parts[i]) <= 79999) {
                    artifactId = parts[i];
                    continue;
                }

                // Проверяем на уровень: lv20 или lv21
                if (token.startsWith('lv') || token.startsWith('lvl')) {
                    const num = token.replace(/^lv/, '').replace(/^lvl/, '');
                    if (num && !isNaN(num)) {
                        level = parseInt(num);
                        // Если lv20, то преобразуем в 21 (потому что сервер ожидает 21 для уровня 20)
                        if (level === 20) {
                            level = 21;
                        }
                    }
                    continue;
                }

                // Проверяем на количество: x1
                if (token.startsWith('x')) {
                    const num = token.replace('x', '');
                    if (num && !isNaN(num)) {
                        count = parseInt(num);
                    }
                    continue;
                }

                // Проверяем на основную стату (5 цифр, начинается с 150)
                if (!mainProp && /^150\d{2}$/.test(parts[i])) {
                    mainProp = parts[i];
                    continue;
                }

                // Проверяем на второстепенные статы: 501034,2 или 501034:2 или 501034=2
                if (/^\d{6}[,:=]\d+$/.test(parts[i]) || /^\d{6}[,:=]\d+$/.test(parts[i].replace(/^,/, ''))) {
                    let statPart = parts[i];
                    // Убираем запятую в начале если есть
                    if (statPart.startsWith(',')) {
                        statPart = statPart.substring(1);
                    }
                    
                    // Разбиваем по разделителю
                    const separator = statPart.includes(',') ? ',' : statPart.includes(':') ? ':' : '=';
                    const [statId, statValue] = statPart.split(separator);
                    
                    if (statId && statId.length === 6 && /^\d+$/.test(statId)) {
                        subStats.push(statId);
                    }
                }
            }

            // Если ID артефакта не нашли, пробуем найти любой 5-значный ID
            if (!artifactId) {
                for (const part of parts) {
                    if (/^\d{5,6}$/.test(part) && parseInt(part) >= 70000 && parseInt(part) <= 79999) {
                        artifactId = part;
                        break;
                    }
                }
            }

            // Заполняем поля
            if (artifactId) {
                document.getElementById('artifact-id').value = artifactId;
            } else {
                alert(' Не удалось найти ID артефакта в команде.');
                return;
            }

            document.getElementById('artifact-level').value = level;
            document.getElementById('artifact-main-prop').value = mainProp || '';
            document.getElementById('artifact-sub-stats').value = subStats.join(', ');
            
            // Также пытаемся извлечь UID если есть
            const uidMatch = cmd.match(/uid\s*[=:]\s*(\d+)/i);
            if (uidMatch) {
                document.getElementById('artifact-uid').value = uidMatch[1];
            }

            logToTerminal(`✅ Распарсена команда: ID=${artifactId}, Уровень=${level}, Основная=${mainProp || 'не указана'}, Статы=${subStats.join(', ') || 'нет'}`, 'info');
            
            // Очищаем поле ввода
            document.getElementById('artifact-parse-input').value = '';
        }


        function filterArtifactItems() {
            const query = document.getElementById('artifact-search').value.toLowerCase().trim();
            const container = document.getElementById('artifact-search-results');
            
            if (!query) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Начните ввод для поиска...</div>';
                return;
            }

            // Ищем артефакты (ID от 70000 до 79999)
            const results = fullHandbookList.filter(item => {
                const id = item.id.toString();
                const name = item.name.toLowerCase();
                return (id >= '70000' && id <= '79999') && 
                       (id.includes(query) || name.includes(query.toLowerCase()));
            }).slice(0, 30);

            if (results.length === 0) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Артефактов не найдено</div>';
                return;
            }

            container.innerHTML = results.map(item => `
                <div style="padding: 6px 10px; cursor: pointer; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center;"
                     onclick="selectArtifactItem('${item.id}')"
                     onmouseover="this.style.background='#222'" onmouseout="this.style.background='transparent'">
                    <span><strong style="color: #00bfff;">${item.id}</strong> — ${item.name}</span>
                    <span style="color: #666; font-size: 12px;">📋</span>
                </div>
            `).join('');
        }

        function selectArtifactItem(itemId) {
            document.getElementById('artifact-id').value = itemId;
            document.getElementById('artifact-search').value = '';
            document.getElementById('artifact-search-results').innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Артефакт выбран, ID подставлен в поле выше</div>';
        }

        function sendArtifact() {
            const uid = document.getElementById('artifact-uid').value.trim() || '1';
            const itemId = document.getElementById('artifact-id').value.trim();
            const level = parseInt(document.getElementById('artifact-level').value) || 21;
            const mainPropId = parseInt(document.getElementById('artifact-main-prop').value.trim()) || 0;
            const subStatsRaw = document.getElementById('artifact-sub-stats').value.trim();
            
            if (!itemId) {
                alert(' Введите ID артефакта.');
                return;
            }

            if (!mainPropId) {
                alert(' Введите ID основной характеристики.');
                return;
            }

            // Парсим второстепенные характеристики
            let appendPropIdList = [];
            if (subStatsRaw) {
                appendPropIdList = subStatsRaw.split(',')
                    .map(s => parseInt(s.trim()))
                    .filter(id => !isNaN(id) && id > 0);
                
                if (appendPropIdList.length > 4) {
                    alert(' Нельзя добавить больше 4 второстепенных характеристик.');
                    return;
                }
            }

            // Формируем extra_params
            const extraParams = {
                level: level,
                main_prop_id: mainPropId,
                append_prop_id_list: appendPropIdList
            };

            const params = {
                uid: uid,
                item_id: itemId,
                item_count: '1',
                extra_params: JSON.stringify(extraParams)
            };

            logToTerminal(`⚔️ Выдача артефакта: ${itemId} для UID ${uid}`, 'info');
            logToTerminal(`📊 Уровень: ${level}, Основная стат: ${mainPropId}`, 'info');
            logToTerminal(`📊 Второстепенные: ${appendPropIdList.join(', ') || 'нет'}`, 'info');
            logToTerminal(`📋 Параметры: ${JSON.stringify(params, null, 2)}`, 'info');

            sendMuipRequest('1127', params);
        }


        // ============================================
        // ФУНКЦИИ ДЛЯ ОТПРАВКИ ПОЧТЫ (MAIL)
        // ============================================
        let mailItems = {}; // { "item_id": count }
        let filteredMailHandbook = [];

        function initMailTab() {
            // Устанавливаем текущее время для expire
            updateMailCurrentTime();
            setInterval(updateMailCurrentTime, 10000);
            
            // Заполняем handbook для поиска предметов
            filteredMailHandbook = fullHandbookList;
        }

        function updateMailCurrentTime() {
            const now = Math.floor(Date.now() / 1000);
            document.getElementById('mail-current-time').textContent = now;
        }

        function setExpireTime(days) {
            const now = Math.floor(Date.now() / 1000);
            document.getElementById('mail-expire').value = now + days;
        }

        function filterMailItems() {
            const query = document.getElementById('mail-item-search').value.toLowerCase().trim();
            const container = document.getElementById('mail-handbook-results');
            
            if (!query) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Начните ввод для поиска...</div>';
                return;
            }

            const results = fullHandbookList.filter(item => 
                item.id.toString().includes(query) || 
                item.name.toLowerCase().includes(query)
            ).slice(0, 30);

            if (results.length === 0) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Ничего не найдено</div>';
                return;
            }

            container.innerHTML = results.map(item => `
                <div style="padding: 6px 10px; cursor: pointer; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center; hover:background:#222;"
                     onclick="selectMailItem('${item.id}', '${item.name.replace(/'/g, "\\'")}')"
                     onmouseover="this.style.background='#222'" onmouseout="this.style.background='transparent'">
                    <span><strong style="color: #00bfff;">${item.id}</strong> — ${item.name}</span>
                    <span style="color: #666; font-size: 12px;">+</span>
                </div>
            `).join('');
        }

        function selectMailItem(itemId, itemName) {
            document.getElementById('selected-mail-item-id').textContent = itemId;
            document.getElementById('selected-mail-item-name').textContent = itemName;
            document.getElementById('mail-item-search').value = itemName;
            document.getElementById('mail-handbook-results').innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Предмет выбран, нажмите "+ Добавить вложение"</div>';
        }

        function addMailItem() {
            const itemId = document.getElementById('selected-mail-item-id').textContent;
            if (itemId === '--') {
                alert(' Сначала выберите предмет из справочника.');
                return;
            }
            const count = parseInt(document.getElementById('mail-item-count').value) || 1;
            
            if (mailItems[itemId]) {
                mailItems[itemId] += count;
            } else {
                mailItems[itemId] = count;
            }
            renderMailItems();
        }

        function clearMailItems() {
            mailItems = {};
            renderMailItems();
        }

        function renderMailItems() {
            const container = document.getElementById('mail-item-list');
            const keys = Object.keys(mailItems);
            
            if (keys.length === 0) {
                container.innerHTML = '<div style="color: #555; font-size: 13px;">Нет добавленных вложений</div>';
                return;
            }

            container.innerHTML = keys.map(itemId => {
                const name = fullHandbookList.find(i => i.id.toString() === itemId)?.name || itemId;
                return `
                    <div style="background: #252525; border-radius: 4px; padding: 6px 12px; display: flex; align-items: center; gap: 8px; border: 1px solid #3d3d3d;">
                        <span style="font-weight: bold; color: #00bfff;">${itemId}</span>
                        <span style="color: #aaa;">${name}</span>
                        <span style="color: #888;">x${mailItems[itemId]}</span>
                        <button onclick="removeMailItem('${itemId}')" style="background: none; border: none; color: #ff5555; cursor: pointer; font-size: 16px;">×</button>
                    </div>
                `;
            }).join('');
        }

        function removeMailItem(itemId) {
            delete mailItems[itemId];
            renderMailItems();
        }

        function buildItemListString() {
            const parts = [];
            for (const [id, count] of Object.entries(mailItems)) {
                parts.push(`${id}:${count}`);
            }
            return parts.join(',');
        }

        function sendMail() {
            const uid = document.getElementById('mail-uid').value.trim() || '1';
            const title = document.getElementById('mail-title').value.trim() || 'Без заголовка';
            const content = document.getElementById('mail-content').value.trim() || 'Пустое письмо';
            const sender = document.getElementById('mail-sender').value.trim() || 'Паймон';
            const expire = document.getElementById('mail-expire').value.trim();
            const importance = parseInt(document.getElementById('mail-importance').value) || 1;
            const config_id = parseInt(document.getElementById('mail-config-id').value) || 0;
            const item_limit_type = parseInt(document.getElementById('mail-item-limit-type').value) || 0;
            const tag = parseInt(document.getElementById('mail-tag').value) || 0;
            const source_type = parseInt(document.getElementById('mail-source-type').value) || 0;
            const item_list = buildItemListString();

            if (!expire) {
                alert(' Введите время истечения письма (expire_time).');
                return;
            }

            const params = {
                uid: uid,
                title: title,
                content: content,
                sender: sender,
                expire_time: expire,
                importance: importance,
                config_id: config_id,
                item_limit_type: item_limit_type,
                tag: tag,
                source_type: source_type,
                item_list: item_list
            };

            logToTerminal(`📧 Отправка письма: "${title}" для UID ${uid}`, 'info');
            logToTerminal(`📦 Вложения: ${item_list || 'нет'}`, 'info');

            // Выполняем MUIP команду 1005 с параметрами
            sendMuipRequest('1005', params);

            // Сбрасываем выбор предмета
            document.getElementById('selected-mail-item-id').textContent = '--';
            document.getElementById('selected-mail-item-name').textContent = '--';
        }

        // Инициализация при загрузке
        // Добавляем вызов initMailTab() в функцию loadSchema() после загрузки handbook
        const originalInit = loadSchema;
        loadSchema = async function() {
            await originalInit();
            initMailTab();
        };

        // ============================================
        // ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ МОНСТРАМИ
        // ============================================

        function spawnMonster() {
            const monsterId = document.getElementById('monster-id-input').value.trim();
            const count = document.getElementById('monster-count-input').value || 1;
            const level = document.getElementById('monster-level-input').value || 0;
            
            if (!monsterId) {
                alert(' Введите ID монстра.');
                return;
            }
            
            // Формируем команду: monster <id> <count> <level>
            const cmd = `monster ${monsterId} ${count} ${level}`;
            logToTerminal(`🐉 Спавн монстра: ID=${monsterId}, Кол-во=${count}, Уровень=${level}`, 'info');
            quickGm(cmd);
        }

        function killMonster() {
            const monsterId = document.getElementById('monster-id-input').value.trim();
            if (!monsterId) {
                alert(' Введите ID монстра для убийства.');
                return;
            }
            const cmd = `kill monster ${monsterId}`;
            logToTerminal(`💀 Убить монстра: ID=${monsterId}`, 'info');
            quickGm(cmd);
        }

        function killAllMonsters() {
            const cmd = `kill monster all`;
            logToTerminal(`☠️ Убить ВСЕХ монстров в сцене!`, 'err');
            quickGm(cmd);
        }

        function filterMonsterHandbook() {
            const query = document.getElementById('monster-search-input').value.toLowerCase().trim();
            const container = document.getElementById('monster-search-results');
            
            if (!query) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Начните ввод для поиска монстров...</div>';
                return;
            }

            // Фильтруем только монстров (их ID обычно начинаются с 2 или 3, но ищем все по ключевым словам)
            const results = fullHandbookList.filter(item => {
                const id = item.id.toString();
                const name = item.name.toLowerCase();
                return (id.startsWith('2') || id.startsWith('3') || name.includes('монстр') || name.includes('slime') || name.includes('хиличурл') || name.includes('митачурл') || name.includes('ла') || name.includes('Фатуи')) &&
                    (id.includes(query) || name.includes(query));
            }).slice(0, 40);

            if (results.length === 0) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Монстров не найдено</div>';
                return;
            }

            container.innerHTML = results.map(item => `
                <div style="padding: 6px 10px; cursor: pointer; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center;"
                    onclick="selectMonster('${item.id}')"
                    onmouseover="this.style.background='#222'" onmouseout="this.style.background='transparent'">
                    <span><strong style="color: #00bfff;">${item.id}</strong> — ${item.name}</span>
                    <span style="color: #666; font-size: 12px;">🐉</span>
                </div>
            `).join('');
        }

        function selectMonster(id) {
            document.getElementById('monster-id-input').value = id;
            document.getElementById('monster-search-input').value = '';
            document.getElementById('monster-search-results').innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Монстр выбран, ID подставлен в поле выше</div>';
        }
        // Player Level
        function setPlayerLevel() {
            const level = document.getElementById('player-level-input').value;
            quickGm(`player level ${level}`);
        }

        // Add Experience
        function addPlayerExp() {
            const exp = document.getElementById('player-exp-input').value;
            quickGm(`item add 102 ${exp}`);
        }

        // Currency functions
        function addPrimogems() {
            const amount = document.getElementById('player-primogems-input').value;
            quickGm(`item add 201 ${amount}`);
        }

        function addMora() {
            const amount = document.getElementById('player-mora-input').value;
            quickGm(`item add 202 ${amount}`);
        }

        function addGenesis() {
            const amount = document.getElementById('player-genesis-input').value;
            quickGm(`item add 203 ${amount}`);
        }

        function addFate() {
            const amount = document.getElementById('player-fate-input').value;
            quickGm(`item add 223 ${amount}`);
        }

        function addAcquaint() {
            const amount = document.getElementById('player-acquaint-input').value;
            quickGm(`item add 224 ${amount}`);
        }

        // Teleport to dungeon
        function teleportToDungeon() {
            const dungeonId = document.getElementById('teleport-dungeon-input').value.trim();
            if (!dungeonId) {
                alert(' Введите ID подземелья.');
                return;
            }
            quickGm(`dungeon ${dungeonId}`);
        }

         // Teleport to scene
        function teleportToScene() {
            const sceneId = document.getElementById('teleport-scene-input').value.trim();
            if (!sceneId) {
                alert(' Введите ID сцены.');
                return;
            }
            quickGm(`jump ${sceneId}`);
        }

        // Teleport to coordinates
        function teleportToCoords() {
            const x = document.getElementById('teleport-x').value.trim() || '0';
            const y = document.getElementById('teleport-y').value.trim() || '0';
            const z = document.getElementById('teleport-z').value.trim() || '0';
            
            let cmd = `goto ${x} ${y} ${z}`;
        }

        let weaponCache = [];

        // Filter weapons from handbook (IDs 11101-15509)
        function filterWeaponItems() {
            const query = document.getElementById('weapon-search').value.toLowerCase().trim();
            const container = document.getElementById('weapon-search-results');
            
            if (!query) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Начните ввод для поиска...</div>';
                return;
            }

            // Cache weapons on first search
            if (weaponCache.length === 0) {
                weaponCache = fullHandbookList.filter(item => {
                    const id = parseInt(item.id);
                    return id >= 11101 && id <= 15509;
                });
            }

            const results = weaponCache.filter(item => 
                item.id.toString().includes(query) || 
                item.name.toLowerCase().includes(query)
            ).slice(0, 50);

            if (results.length === 0) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Оружие не найдено</div>';
                return;
            }

            container.innerHTML = results.map(item => `
                <div style="padding: 6px 10px; cursor: pointer; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center;"
                    onclick="selectWeapon('${item.id}')"
                    onmouseover="this.style.background='#222'" onmouseout="this.style.background='transparent'">
                    <span><strong style="color: #00bfff;">${item.id}</strong> — ${item.name}</span>
                    <span style="color: #666; font-size: 12px;">⚔️</span>
                </div>
            `).join('');
        }

        function selectWeapon(weaponId) {
            document.getElementById('weapon-id').value = weaponId;
            document.getElementById('weapon-search').value = '';
            document.getElementById('weapon-search-results').innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Оружие выбрано, ID подставлен в поле выше</div>';
        }

        function sendWeapon() {
            const uid = document.getElementById('weapon-uid').value.trim() || '1';
            const itemId = document.getElementById('weapon-id').value.trim();
            const level = parseInt(document.getElementById('weapon-level').value) || 90;
            const promote = parseInt(document.getElementById('weapon-promote').value) || 5;

            if (!itemId) {
                alert(' Введите ID оружия.');
                return;
            }

            logToTerminal(`⚔️ Выдача оружия: ${itemId} для UID ${uid}`, 'info');
            logToTerminal(`📊 Уровень: ${level}, Пробуждение: ${promote}`, 'info');

            // Using equip add command format: equip add <item_id> <level> <promote>
            const cmd = `equip add ${itemId} ${level} ${promote}`;
            quickGm(cmd);
        }

        let characterCache = [];
        let questsCache = [];




        function filterQuestsItems() {
            const query = document.getElementById('quests-search').value.toLowerCase().trim();
            const container = document.getElementById('quests-search-results');
            
            if (!query) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Начните ввод для поиска...</div>';
                return;
            }

            // Cache quests on first search
            if (questsCache.length === 0) {
                questsCache = fullHandbookList.filter(item => {
                    const id = parseInt(item.id);
                    return id >= 30302 && id <= 9000101;
                });
            }

            const results = questsCache.filter(item => 
                item.id.toString().includes(query) || 
                item.name.toLowerCase().includes(query)
            ).slice(0, 50);

            if (results.length === 0) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Квест не найден</div>';
                return;
            }

            container.innerHTML = results.map(item => `
                <div style="padding: 6px 10px; cursor: pointer; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center;"
                    onclick="selectQuest('${item.id}')"
                    onmouseover="this.style.background='#222'" onmouseout="this.style.background='transparent'">
                    <span><strong style="color: #00bfff;">${item.id}</strong> — ${item.name}</span>
                    <span style="color: #666; font-size: 12px;"> </span>
                </div>
            `).join('');
        }

        function selectQuest(questId) {
            document.getElementById('quest-id-input').value = questId;
            document.getElementById('quests-search').value = '';
            document.getElementById('quests-search-results').innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Квест выбран, ID подставлен в поле выше</div>';
        }







        // Filter characters from handbook (IDs 10000002+)
        function filterCharacterItems() {
            const query = document.getElementById('char-search').value.toLowerCase().trim();
            const container = document.getElementById('char-search-results');
            
            if (!query) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Начните ввод для поиска...</div>';
                return;
            }

            // Cache characters on first search
            if (characterCache.length === 0) {
                characterCache = fullHandbookList.filter(item => {
                    const id = parseInt(item.id);
                    return id >= 10000001 && id <= 11000042;
                });
            }

            const results = characterCache.filter(item => 
                item.id.toString().includes(query) || 
                item.name.toLowerCase().includes(query)
            ).slice(0, 50);

            if (results.length === 0) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Персонажи не найдены</div>';
                return;
            }

            container.innerHTML = results.map(item => `
                <div style="padding: 6px 10px; cursor: pointer; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center;"
                    onclick="selectCharacter('${item.id}')"
                    onmouseover="this.style.background='#222'" onmouseout="this.style.background='transparent'">
                    <span><strong style="color: #00bfff;">${item.id}</strong> — ${item.name}</span>
                    <span style="color: #666; font-size: 12px;"> </span>
                </div>
            `).join('');
        }

        function selectCharacter(charId) {
            document.getElementById('char-id').value = charId;
            document.getElementById('char-search').value = '';
            document.getElementById('char-search-results').innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Персонаж выбран, ID подставлен в поле выше</div>';
        }

        function addCharacter() {
            const uid = document.getElementById('char-uid').value.trim() || '1';
            const charId = document.getElementById('char-id').value.trim();
            
            if (!charId) {
                alert(' Введите ID персонажа.');
                return;
            }

            logToTerminal(`👤 Добавление персонажа: ${charId} для UID ${uid}`, 'info');
            quickGm(`avatar add ${charId}`);
        }

        function changeCharacter() {
            const uid = document.getElementById('char-uid').value.trim() || '1';
            const charId = document.getElementById('char-id').value.trim();
            
            if (!charId) {
                alert(' Введите ID персонажа.');
                return;
            }

            logToTerminal(`🔄 Смена персонажа на: ${charId} для UID ${uid}`, 'info');
            quickGm(`avatar change ${charId}`);
        }

        // ============================================
        // ФУНКЦИИ ДЛЯ ВЫДАЧИ ПРЕДМЕТОВ (ITEMS)
        // ============================================

        function setItemCount(value) {
            document.getElementById('items-count').value = value;
        }

        function filterItemsList() {
            const query = document.getElementById('items-search').value.toLowerCase().trim();
            const container = document.getElementById('items-search-results');
            
            if (!query) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Начните ввод для поиска...</div>';
                return;
            }

            const results = fullHandbookList.filter(item => 
                item.id.toString().includes(query) || 
                item.name.toLowerCase().includes(query)
            ).slice(0, 50);

            if (results.length === 0) {
                container.innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Предметы не найдены</div>';
                return;
            }

            container.innerHTML = results.map(item => {
                let icon = '📦';
                const id = parseInt(item.id);
                if (id >= 11101 && id <= 15509) icon = '⚔️';
                else if (id >= 70000 && id <= 79999) icon = '🏺';
                else if (id >= 10000001 && id <= 11000042) icon = '👤';
                else if (id >= 20010101) icon = '🐉';
                
                return `
                    <div style="padding: 6px 10px; cursor: pointer; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center;"
                        onclick="selectItem('${item.id}')"
                        onmouseover="this.style.background='#222'" onmouseout="this.style.background='transparent'">
                        <span><strong style="color: #00bfff;">${item.id}</strong> — ${item.name}</span>
                        <span style="color: #666; font-size: 12px;">${icon}</span>
                    </div>
                `;
            }).join('');
        }

        function selectItem(itemId) {
            document.getElementById('items-id').value = itemId;
            document.getElementById('items-search').value = '';
            document.getElementById('items-search-results').innerHTML = '<div style="color: #666; padding: 8px; text-align: center;">Предмет выбран, ID подставлен в поле выше</div>';
        }

        function sendItems() {
            const uid = document.getElementById('items-uid').value.trim() || '1';
            const itemId = document.getElementById('items-id').value.trim();
            const count = parseInt(document.getElementById('items-count').value) || 1;
            
            if (!itemId) {
                alert(' Введите ID предмета.');
                return;
            }

            const idNum = parseInt(itemId);
            let cmd = '';
            
            // Автоматическое определение типа предмета
            if (idNum >= 10000001 && idNum <= 11000042) {
                // Персонажи
                cmd = `avatar add ${itemId}`;
                logToTerminal(`👤 Выдача персонажа: ${itemId} для UID ${uid}`, 'info');
            } else if (idNum >= 11101 && idNum <= 15509) {
                // Оружие (используем equip add с уровнем и пробуждением по умолчанию)
                cmd = `equip add ${itemId} 90 5`;
                logToTerminal(`⚔️ Выдача оружия: ${itemId} для UID ${uid} (ур.90, проб.5)`, 'info');
            } else {
                // Обычные предметы
                cmd = `item add ${itemId} ${count}`;
                logToTerminal(`📦 Выдача предметов: ${itemId} x${count} для UID ${uid}`, 'info');
            }
            
            quickGm(cmd);
        }


    // ============================================
    // ПЕРЕКЛЮЧЕНИЕ КОМПАКТНОГО РЕЖИМА САЙДБАРА
    // ============================================

    let sidebarCompact = false;

    function toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        const title = document.getElementById('sidebar-title');
        
        sidebarCompact = !sidebarCompact;
        
        if (sidebarCompact) {
            sidebar.classList.add('compact');
            toggleBtn.innerHTML = '<i class="icon-chevron-right"></i>';
            title.textContent = '☰';
            // Сохраняем состояние
            localStorage.setItem('sidebarCompact', 'true');
        } else {
            sidebar.classList.remove('compact');
            toggleBtn.innerHTML = '<i class="icon-chevron-left"></i>';
            title.textContent = 'Панель Управления';
            localStorage.setItem('sidebarCompact', 'false');
        }
    }

    // Восстанавливаем состояние при загрузке
    window.addEventListener('DOMContentLoaded', () => {
        const saved = localStorage.getItem('sidebarCompact');
        if (saved === 'true') {
            toggleSidebar();
        }
    });

    // Добавляем атрибуты data-tooltip для всех кнопок в сайдбаре
    function addTooltipsToSidebar() {
        const buttons = document.querySelectorAll('.sidebar button');
        const tooltips = {
            'tab-gm': 'GM команды',
            'tab-player': 'Игрок',
            'tab-quests': 'Квесты',
            'tab-teleport': 'Телепорт',
            'tab-weapons': 'Оружие',
            'tab-characters': 'Персонажи',
            'tab-spawn': 'Спавн',
            'tab-artifact': 'Артефакт',
            'tab-mail': 'Почта',
            'tab-muip': 'MUIP',
            'tab-handbook': 'Справочник',
            'tab-settings': 'Настройки',
            'tab-items': 'Предметы'
        };
        
        buttons.forEach(btn => {
            const id = btn.id.replace('btn-', '');
            if (tooltips[id]) {
                btn.setAttribute('data-tooltip', tooltips[id]);
            }
        });
    }

    // Вызываем после загрузки
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(addTooltipsToSidebar, 100);
    });