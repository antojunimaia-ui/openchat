// SettingsUI.js — Módulo responsável pelo painel de Configurações
// Extraído de renderer.js para reduzir a complexidade do arquivo principal.
// Operado como classe mixin: os métodos são copiados para o protótipo de OpenChat.

const SettingsMethods = {

    // ─── Modal open/close ────────────────────────────────────────────────────

    openSettings() {
        this.showSettingsModal();
    },

    showSettingsModal() {
        const overlay = document.getElementById('settingsModalOverlay');
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';

        this.showSettingsSection('apis');
        this.populateSettingsForm();
        this.originalSettings = JSON.stringify(this.getCurrentFormSettings());
        this.hideFloatingButtons();
    },

    closeSettingsModal() {
        const overlay = document.getElementById('settingsModalOverlay');
        overlay.classList.remove('show');
        document.body.style.overflow = '';
        this.hideFloatingButtons();
    },

    // ─── Setup (chamado uma vez no init) ─────────────────────────────────────

    setupSettingsModal() {
        const overlay = document.getElementById('settingsModalOverlay');
        const closeBtn = document.getElementById('closeSettingsBtn');
        const cancelBtn = document.getElementById('cancelSettingsBtn');
        const saveBtn = document.getElementById('saveSettingsBtn');

        this.originalSettings = null;

        closeBtn.addEventListener('click', () => this.closeSettingsModal());
        cancelBtn.addEventListener('click', () => this.cancelSettings());
        saveBtn.addEventListener('click', () => this.saveSettings());

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeSettingsModal();
        });

        // Navegação lateral
        document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.showSettingsSection(section);
                document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Toggles de API
        ['gemini', 'mistral', 'zai', 'openrouter'].forEach(p => {
            const el = document.getElementById(`${p}Enabled`);
            if (el) el.addEventListener('change', (e) => {
                this.toggleApiForm(p, e.target.checked);
                this.checkSettingsChanges();
            });
        });

        // Botão atualizar modelos OpenRouter
        const refreshOR = document.getElementById('refreshOpenRouterModelsBtn');
        if (refreshOR) refreshOR.addEventListener('click', () => this.fetchOpenRouterModels());

        // MCP
        const addMcp = document.getElementById('addMcpServerBtn');
        if (addMcp) addMcp.addEventListener('click', () => this.addMcpServer());

        // Seleção de modelo ativo
        ['Gemini', 'Mistral', 'Zai', 'Openrouter'].forEach(name => {
            const el = document.getElementById(`select${name}`);
            if (el) el.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.updateModelFeatures(name.toLowerCase());
                    this.checkSettingsChanges();
                }
            });
        });

        // Listeners de mudança para todos os inputs do formulário
        const formInputs = [
            'geminiApiKey', 'geminiModel', 'imagenApiKey',
            'mistralApiKey', 'mistralModel',
            'zaiApiKey', 'zaiModel',
            'openrouterApiKey', 'openrouterModel',
            'personalityType', 'formalityLevel',
            'allowProfanity', 'useSlang', 'useEmojis',
            'userNickname', 'userBio'
        ];

        formInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.checkSettingsChanges());
                el.addEventListener('change', () => this.checkSettingsChanges());
            }
        });

        document.querySelectorAll('input[name="responseStyle"]').forEach(r => {
            r.addEventListener('change', () => this.checkSettingsChanges());
        });

        document.querySelectorAll('input[name="appTheme"]').forEach(r => {
            r.addEventListener('change', (e) => {
                this.checkSettingsChanges();
                this.applyTheme(e.target.value);
            });
        });

        // Toggle de visibilidade de senhas
        document.querySelectorAll('.toggle-password-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.target);
                const isPass = input.type === 'password';
                input.type = isPass ? 'text' : 'password';
                btn.innerHTML = isPass
                    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
                    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            });
        });

        // Botões de teste de API
        ['gemini', 'mistral', 'zai', 'openrouter'].forEach(p => {
            const btn = document.getElementById(`test${p.charAt(0).toUpperCase() + p.slice(1)}Btn`);
            if (btn) btn.addEventListener('click', () => this.testApiConnection(p));
        });

        // Contador de caracteres da bio
        const bioInput = document.getElementById('userBio');
        if (bioInput) bioInput.addEventListener('input', () => this.updateBioCharCount());

        // Atualizar memórias
        const refreshMem = document.getElementById('refreshMemoriesBtn');
        if (refreshMem) refreshMem.addEventListener('click', () => this.loadMemoriesSection());

        this.setupVoiceSettings();
        this.setupDebugActivation();
        this.loadSettings();
    },

    setupDebugActivation() {
        const devName = document.getElementById('dev-name-click');
        if (!devName) return;

        let clicks = 0;
        let lastClickTime = 0;

        devName.addEventListener('click', () => {
            const now = Date.now();
            if (now - lastClickTime > 1000) {
                clicks = 1;
            } else {
                clicks++;
            }
            lastClickTime = now;

            if (clicks === 5) {
                const navDebug = document.getElementById('nav-debug');
                if (navDebug) {
                    navDebug.style.display = 'flex';
                    this.settings.debug = { ...(this.settings.debug || {}), unlocked: true };
                    this.saveSettings();
                    this.showNotification('Modo Developer ativado! Aba Debug liberada.', 'success');
                }
            }
        });

        // Configurar listeners dos checkboxes de debug
        ['debugForceSnow', 'debugForceNewYear', 'debugForceAurora', 'debugForceStarry', 'debugForceUpdate', 'debugVerboseLogging', 'debugShowIds'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.checkSettingsChanges());
            }
        });

        this.setupDebugControls();
    },

    setupDebugControls() {
        const triggers = {
            'testNotifySuccess': () => this.showNotification('Operação concluída com sucesso!', 'success'),
            'testNotifyError': () => this.showNotification('Ocorreu um erro inesperado!', 'error'),
            'testNotifyInfo': () => this.showNotification('Isso é apenas uma informação do sistema.', 'info'),
            'testNotifyWarning': () => this.showNotification('Aviso: Algo não está de acordo.', 'warning'),
            'testNotifyUpdate': () => {
                const message = window.lang === 'en' ? 'New update available! Downloading in background...' : 'Nova atualização disponível! Baixando em background...';
                this.showNotification(message, 'info', 8000);
            },
            'testNotifyDownload': () => {
                const message = window.lang === 'en' ? 'Update downloaded. App will restart.' : 'Atualização baixada. O app será atualizado ao reiniciar.';
                this.showNotification(message, 'success', 10000);
            },
            'debugClearMemory': async () => {
                if (confirm('Deseja apagar todas as memórias locais definitivamente? Isso não pode ser desfeito.')) {
                    try {
                        let deletedCount = 0;
                        if (window.electronAPI && window.electronAPI.getMemories) {
                            const result = await window.electronAPI.getMemories();
                            if (result.success && result.memories.length > 0) {
                                for (const memory of result.memories) {
                                    await window.electronAPI.deleteMemory(memory.id);
                                    deletedCount++;
                                }
                                this.showNotification(`${deletedCount} memórias foram apagadas com sucesso!`, 'success');
                                this.loadMemoriesSection();
                            } else {
                                this.showNotification('Nenhuma memória encontrada para limpar.', 'info');
                            }
                        }
                    } catch (err) {
                        this.showNotification(`Erro ao limpar memórias: ${err.message}`, 'error');
                    }
                }
            },
            'debugResetSettings': () => {
                if (confirm('ATENÇÃO: Isso apagará todas as chaves de API, temas e configurações! O app será reiniciado. Prosseguir?')) {
                    localStorage.clear();
                    window.location.reload();
                }
            }
        };

        Object.entries(triggers).forEach(([id, fn]) => {
            const el = document.getElementById(id);
            if (el) el.onclick = fn;
        });
    },

    // ─── Navegação de seções ─────────────────────────────────────────────────

    showSettingsSection(sectionId) {
        document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`section-${sectionId}`);
        if (target) target.classList.add('active');

        if (sectionId === 'memories') this.loadMemoriesSection();
        if (sectionId === 'about') this.loadAboutSection();
        if (sectionId === 'mcp') this.loadMcpServers();
    },

    loadAboutSection() {
        const platformEl = document.getElementById('about-platform');
        const electronEl = document.getElementById('about-electron');
        if (!platformEl || !electronEl) return;

        const p = navigator.platform.toLowerCase();
        const name = p.includes('win') ? 'Windows' : p.includes('mac') ? 'macOS' : p.includes('linux') ? 'Linux' : 'Desconhecido';
        platformEl.textContent = name;

        try {
            const v = window.process?.versions?.electron || '28.0.0';
            electronEl.textContent = `v${v}`;
        } catch (e) {
            electronEl.textContent = 'v28.0.0';
        }
    },

    // ─── MCP Servers ─────────────────────────────────────────────────────────

    async loadMcpServers() {
        const list = document.getElementById('mcpServersList');
        if (!list) return;
        list.innerHTML = '<p>Carregando servidores...</p>';
        try {
            if (window.electronAPI?.getMcpServers) {
                const r = await window.electronAPI.getMcpServers();
                if (r.success) {
                    this.mcpServersConfig = r.servers || {};
                    this.renderMcpServers();
                } else {
                    list.innerHTML = `<p style="color:var(--error-color)">Erro ao carregar: ${r.error}</p>`;
                }
            }
        } catch (e) {
            list.innerHTML = `<p style="color:var(--error-color)">Erro: ${e.message}</p>`;
        }
    },

    renderMcpServers() {
        const list = document.getElementById('mcpServersList');
        const countEl = document.getElementById('mcpServerCount');
        if (!list) return;
        list.innerHTML = '';

        const keys = Object.keys(this.mcpServersConfig || {});
        if (countEl) countEl.textContent = keys.length;

        if (!keys.length) {
            list.innerHTML = `
                <div class="mcp-empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.3">
                        <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    <p>Nenhum servidor configurado ainda</p>
                    <span>Adicione um servidor abaixo para começar</span>
                </div>`;
            return;
        }

        // Map de ícones por nome comum
        const iconMap = {
            filesystem: '📁', file: '📁', files: '📁',
            git: '🐙', github: '🐙', gitlab: '🦊',
            postgres: '🐘', postgresql: '🐘', mysql: '🐬', sqlite: '🗄️', mongo: '🍃',
            browser: '🌐', puppeteer: '🤖', playwright: '🎭',
            bash: '💻', shell: '💻', terminal: '💻',
            search: '🔍', everything: '🔍', brave: '🦁',
            email: '✉️', gmail: '✉️', slack: '💬', discord: '🎮',
            aws: '☁️', azure: '☁️', gcp: '☁️',
            memory: '🧠', knowledge: '📚',
        };
        const getIcon = (name) => {
            const key = name.toLowerCase();
            for (const [k, v] of Object.entries(iconMap)) {
                if (key.includes(k)) return v;
            }
            return '🔌';
        };

        for (const [name, cfg] of Object.entries(this.mcpServersConfig)) {
            const args = cfg.args?.join(' ') || '';
            const icon = getIcon(name);
            const el = document.createElement('div');
            el.className = 'mcp-server-card';
            el.innerHTML = `
                <div class="mcp-card-icon">${icon}</div>
                <div class="mcp-card-info">
                    <div class="mcp-card-name">${name}</div>
                    <div class="mcp-card-cmd">
                        <code>${cfg.command}</code>
                        ${args ? `<span class="mcp-card-args">${args.length > 60 ? args.slice(0, 60) + '…' : args}</span>` : ''}
                    </div>
                </div>
                <div class="mcp-card-status">
                    <span class="mcp-status-dot"></span>
                    <span class="mcp-status-label">Ativo</span>
                </div>
                <button class="mcp-delete-btn delete-mcp-btn" data-name="${name}" title="Remover servidor">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6M14 11v6"></path>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>
                </button>`;
            el.querySelector('.delete-mcp-btn').addEventListener('click', async () => {
                el.style.opacity = '0.5';
                el.style.pointerEvents = 'none';
                delete this.mcpServersConfig[name];
                await this.saveMcpServers();
                this.renderMcpServers();
            });
            list.appendChild(el);
        }
    },

    async addMcpServer() {
        const name = document.getElementById('mcpServerName').value.trim();
        const cmd = document.getElementById('mcpServerCommand').value.trim();
        const args = document.getElementById('mcpServerArgs').value.trim().split(',').map(a => a.trim()).filter(Boolean);

        if (!name || !cmd) {
            this.showNotification('Nome e Comando são obrigatórios.');
            return;
        }

        if (!this.mcpServersConfig) this.mcpServersConfig = {};
        this.mcpServersConfig[name] = { command: cmd, args };

        if (await this.saveMcpServers()) {
            document.getElementById('mcpServerName').value = '';
            document.getElementById('mcpServerCommand').value = '';
            document.getElementById('mcpServerArgs').value = '';
            this.renderMcpServers();
            this.showNotification(`Servidor MCP "${name}" adicionado!`);
        }
    },

    async saveMcpServers() {
        const addBtn = document.getElementById('addMcpServerBtn');
        const orig = addBtn?.innerHTML;
        if (addBtn) { addBtn.innerHTML = 'Salvando...'; addBtn.disabled = true; }
        try {
            if (window.electronAPI?.saveMcpServers) {
                const r = await window.electronAPI.saveMcpServers(this.mcpServersConfig);
                if (addBtn) { addBtn.innerHTML = orig; addBtn.disabled = false; }
                if (!r.success) { this.showNotification('Erro ao salvar: ' + r.error); return false; }
                return true;
            }
        } catch (e) {
            this.showNotification('Falha na comunicação: ' + e.message);
            return false;
        }
    },

    // ─── Floating action buttons (salvar/cancelar) ───────────────────────────

    showFloatingButtons() {
        const el = document.getElementById('settingsFloatingActions');
        if (el) { el.style.display = 'flex'; el.style.visibility = 'visible'; el.style.opacity = '1'; }
    },

    hideFloatingButtons() {
        const el = document.getElementById('settingsFloatingActions');
        if (el) el.style.display = 'none';
    },

    cancelSettings() {
        this.populateSettingsForm();
        this.hideFloatingButtons();
    },

    checkSettingsChanges() {
        if (!this.originalSettings) return;
        const curr = JSON.stringify(this.getCurrentFormSettings());
        if (curr !== this.originalSettings) {
            this.showFloatingButtons();
        } else {
            this.hideFloatingButtons();
        }
    },

    // ─── Form populate / read ────────────────────────────────────────────────

    getCurrentFormSettings() {
        return {
            apis: {
                gemini: { enabled: document.getElementById('geminiEnabled')?.checked || false, apiKey: document.getElementById('geminiApiKey')?.value || '', model: document.getElementById('geminiModel')?.value || '' },
                mistral: { enabled: document.getElementById('mistralEnabled')?.checked || false, apiKey: document.getElementById('mistralApiKey')?.value || '', model: document.getElementById('mistralModel')?.value || '' },
                zai: { enabled: document.getElementById('zaiEnabled')?.checked || false, apiKey: document.getElementById('zaiApiKey')?.value || '', model: document.getElementById('zaiModel')?.value || '' },
                openrouter: { enabled: document.getElementById('openrouterEnabled')?.checked || false, apiKey: document.getElementById('openrouterApiKey')?.value || '', model: document.getElementById('openrouterModel')?.value || '' },
                imagen: { apiKey: document.getElementById('imagenApiKey')?.value || '' }
            },
            activeModel: document.querySelector('input[name="activeModel"]:checked')?.value || 'gemini',
            personality: {
                type: document.getElementById('personalityType')?.value || 'balanced',
                formalityLevel: parseInt(document.getElementById('formalityLevel')?.value || 3),
                allowProfanity: document.getElementById('allowProfanity')?.checked || false,
                useSlang: document.getElementById('useSlang')?.checked || false,
                useEmojis: document.getElementById('useEmojis')?.checked || false,
                responseStyle: document.querySelector('input[name="responseStyle"]:checked')?.value || 'detailed'
            },
            identity: {
                nickname: document.getElementById('userNickname')?.value || '',
                bio: document.getElementById('userBio')?.value || ''
            },
            voice: {
                type: document.querySelector('input[name="voiceType"]:checked')?.value || 'robotic',
                elevenLabs: { apiKey: document.getElementById('elevenLabsApiKey')?.value || '', voiceId: document.getElementById('elevenLabsVoiceId')?.value || '' }
            },
            theme: document.querySelector('input[name="appTheme"]:checked')?.value || 'default',
            debug: {
                forceSnow: document.getElementById('debugForceSnow')?.checked || false,
                forceNewYear: document.getElementById('debugForceNewYear')?.checked || false,
                forceAurora: document.getElementById('debugForceAurora')?.checked || false,
                forceStarry: document.getElementById('debugForceStarry')?.checked || false,
                verboseLogging: document.getElementById('debugVerboseLogging')?.checked || false,
                showIds: document.getElementById('debugShowIds')?.checked || false
            }
        };
    },

    populateSettingsForm() {
        // Compatibilidade retroativa para configs opcionais
        if (!this.settings.apis.zai) this.settings.apis.zai = { enabled: false, apiKey: '', model: 'glm-4.6' };
        if (!this.settings.apis.openrouter) this.settings.apis.openrouter = { enabled: false, apiKey: '', model: 'google/gemini-2.0-flash-001' };
        if (!this.settings.apis.imagen) this.settings.apis.imagen = { apiKey: '' };

        // APIs
        ['gemini', 'mistral', 'zai', 'openrouter'].forEach(p => {
            const api = this.settings.apis[p];
            const en = document.getElementById(`${p}Enabled`);
            const key = document.getElementById(`${p}ApiKey`);
            const mod = document.getElementById(`${p}Model`);
            if (en) en.checked = api.enabled;
            if (key) key.value = api.apiKey;
            if (mod) mod.value = api.model;
            this.toggleApiForm(p, api.enabled);
        });

        // Imagen
        const imgEl = document.getElementById('imagenApiKey');
        if (imgEl) imgEl.value = this.settings.apis.imagen.apiKey;

        // Modelo ativo
        ['gemini', 'mistral', 'zai', 'openrouter'].forEach(p => {
            const el = document.getElementById(`select${p.charAt(0).toUpperCase() + p.slice(1)}`);
            if (el) el.checked = this.settings.activeModel === p;
        });

        // Personalidade
        const pers = this.settings.personality;
        document.getElementById('personalityType').value = pers.type;
        document.getElementById('formalityLevel').value = pers.formalityLevel;
        document.getElementById('allowProfanity').checked = pers.allowProfanity;
        document.getElementById('useSlang').checked = pers.useSlang;
        document.getElementById('useEmojis').checked = pers.useEmojis;
        const rsEl = document.querySelector(`input[name="responseStyle"][value="${pers.responseStyle}"]`);
        if (rsEl) rsEl.checked = true;

        // Identidade
        if (this.settings.identity) {
            const nick = document.getElementById('userNickname');
            const bio = document.getElementById('userBio');
            if (nick) nick.value = this.settings.identity.nickname || '';
            if (bio) { bio.value = this.settings.identity.bio || ''; this.updateBioCharCount(); }
        }

        // Voz
        if (this.settings.voice) {
            const vt = this.settings.voice.type || 'robotic';
            const vtEl = document.querySelector(`input[name="voiceType"][value="${vt}"]`);
            if (vtEl) vtEl.checked = true;
            const elKey = document.getElementById('elevenLabsApiKey');
            if (elKey) elKey.value = this.settings.voice.elevenLabs?.apiKey || '';
            this.savedVoiceId = this.settings.voice.elevenLabs?.voiceId || '';
            this.toggleVoiceConfig(vt);
            if (vt === 'elevenlabs' && this.settings.voice.elevenLabs?.apiKey) this.fetchElevenLabsVoices();
        }

        // Status das APIs
        ['gemini', 'mistral', 'zai', 'openrouter'].forEach(p => this.updateApiStatus(p));

        // Status especial do Imagen (sem toggle enable/disable)
        const imgStatus = document.getElementById('imagenStatus');
        if (imgStatus) {
            const has = !!this.settings.apis.imagen?.apiKey;
            imgStatus.textContent = has ? 'Configurado' : 'Não configurado';
            imgStatus.className = has ? 'api-status connected' : 'api-status';
        }

        this.updateModelFeatures(this.settings.activeModel);

        if (this.settings.apis.openrouter.enabled && this.settings.apis.openrouter.apiKey) this.fetchOpenRouterModels();

        if (this.settings.theme) {
            const themeEl = document.querySelector(`input[name="appTheme"][value="${this.settings.theme}"]`);
            if (themeEl) themeEl.checked = true;
        }

        // Debug Settings
        if (this.settings.debug) {
            const d = this.settings.debug;
            if (document.getElementById('debugForceSnow')) document.getElementById('debugForceSnow').checked = !!d.forceSnow;
            if (document.getElementById('debugForceNewYear')) document.getElementById('debugForceNewYear').checked = !!d.forceNewYear;
            if (document.getElementById('debugForceAurora')) document.getElementById('debugForceAurora').checked = !!d.forceAurora;
            if (document.getElementById('debugForceStarry')) document.getElementById('debugForceStarry').checked = !!d.forceStarry;
            if (document.getElementById('debugForceUpdate')) document.getElementById('debugForceUpdate').checked = !!d.forceUpdate;
            if (document.getElementById('debugVerboseLogging')) document.getElementById('debugVerboseLogging').checked = !!d.verboseLogging;
            if (document.getElementById('debugShowIds')) document.getElementById('debugShowIds').checked = !!d.showIds;

            // Se qualquer opção de debug estiver ativa ou se foi desbloqueado, mostrar a aba
            if (d.unlocked || Object.values(d).some(v => v === true)) {
                const navDebug = document.getElementById('nav-debug');
                if (navDebug) navDebug.style.display = 'flex';
            }
        }
    },

    // ─── API status / forms ──────────────────────────────────────────────────

    toggleApiForm(provider, enabled) {
        const form = document.getElementById(`${provider}Form`);
        if (form) form.classList.toggle('show', enabled);
    },

    updateApiStatus(provider) {
        const statusEl = document.getElementById(`${provider}Status`);
        const indicatorEl = document.getElementById(`${provider}Indicator`);
        const apiKey = this.settings.apis[provider]?.apiKey;
        const enabled = this.settings.apis[provider]?.enabled;

        if (!enabled || !apiKey) {
            if (statusEl) { statusEl.textContent = 'Não configurado'; statusEl.className = 'api-status'; }
            if (indicatorEl) indicatorEl.className = 'status-indicator';
        } else {
            if (statusEl) { statusEl.textContent = 'Configurado'; statusEl.className = 'api-status connected'; }
            if (indicatorEl) indicatorEl.className = 'status-indicator connected';
        }
    },

    updateModelFeatures(provider) {
        const container = document.getElementById('modelFeatures');
        if (!container) return;

        const features = {
            gemini: ['Processamento de texto avançado', 'Suporte a imagens e multimodal', 'Respostas rápidas e precisas', 'Integração com Google AI'],
            mistral: ['Streaming de respostas em tempo real', 'Modelo europeu de código aberto', 'Excelente para programação', 'Respostas fluidas e naturais'],
            zai: ['Modelos GLM com reasoning avançado', 'Otimizado para coding e agents', 'Suporte a contexto longo (128k tokens)', 'Modo de pensamento profundo', 'Arquitetura MoE (Mixture of Experts)'],
            openrouter: ['Acesso a centenas de modelos', 'API unificada para múltiplos provedores', 'Ótimo custo-benefício', 'Claude 3, GPT-4, Llama 3 e muitos outros']
        };

        container.innerHTML = (features[provider] || []).map(f => `
            <div class="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
                <span>${f}</span>
            </div>`).join('');
    },

    // ─── Voice settings ──────────────────────────────────────────────────────

    setupVoiceSettings() {
        document.querySelectorAll('input[name="voiceType"]').forEach(r => {
            r.addEventListener('change', (e) => { this.toggleVoiceConfig(e.target.value); this.checkSettingsChanges(); });
        });

        const apiKeyInput = document.getElementById('elevenLabsApiKey');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('change', () => {
                this.checkSettingsChanges();
                if (apiKeyInput.value) this.fetchElevenLabsVoices();
            });
        }

        const refreshBtn = document.getElementById('refreshVoicesBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.fetchElevenLabsVoices());

        const playBtn = document.getElementById('playVoicePreviewBtn');
        if (playBtn) playBtn.addEventListener('click', () => this.playVoicePreview());

        const voiceSelect = document.getElementById('elevenLabsVoiceId');
        if (voiceSelect) voiceSelect.addEventListener('change', () => this.checkSettingsChanges());
    },

    toggleVoiceConfig(type) {
        const configDiv = document.getElementById('elevenLabsConfig');
        const roboticCard = document.getElementById('roboticVoiceCard');
        const elevenLabsCard = document.getElementById('elevenLabsVoiceCard');
        const isEL = type === 'elevenlabs';

        if (configDiv) configDiv.style.display = isEL ? 'block' : 'none';
        if (elevenLabsCard) elevenLabsCard.classList.toggle('selected', isEL);
        if (roboticCard) roboticCard.classList.toggle('selected', !isEL);
    },

    async fetchElevenLabsVoices() {
        const apiKey = document.getElementById('elevenLabsApiKey').value;
        const voiceSelect = document.getElementById('elevenLabsVoiceId');
        const refreshBtn = document.getElementById('refreshVoicesBtn');

        if (!apiKey) return;

        if (refreshBtn) refreshBtn.classList.add('loading');
        if (voiceSelect) { voiceSelect.innerHTML = '<option value="">Carregando vozes...</option>'; voiceSelect.disabled = true; }

        try {
            const resp = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': apiKey } });
            if (!resp.ok) throw new Error('Falha ao buscar vozes');
            const { voices } = await resp.json();

            if (voiceSelect) {
                voiceSelect.innerHTML = '';
                voices.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.voice_id;
                    opt.textContent = v.name;
                    if (v.preview_url) opt.dataset.previewUrl = v.preview_url;
                    voiceSelect.appendChild(opt);
                });
                const savedId = this.savedVoiceId || this.settings.voice?.elevenLabs?.voiceId;
                if (savedId) voiceSelect.value = savedId;
                voiceSelect.disabled = false;
            }
        } catch (err) {
            console.error('Erro ao buscar vozes:', err);
            if (voiceSelect) voiceSelect.innerHTML = '<option value="">Erro ao carregar vozes</option>';
            this.showNotification('Erro ao carregar vozes do ElevenLabs: ' + err.message);
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('loading');
        }
    },

    playVoicePreview() {
        const voiceSelect = document.getElementById('elevenLabsVoiceId');
        if (!voiceSelect) return;
        const opt = voiceSelect.options[voiceSelect.selectedIndex];
        if (!opt) return;
        const url = opt.dataset.previewUrl;
        if (url) {
            new Audio(url).play().catch(e => console.error('Erro ao reproduzir:', e));
        } else {
            this.showNotification('Prévia não disponível para esta voz');
        }
    },

    // ─── Misc helpers ────────────────────────────────────────────────────────

    updateBioCharCount() {
        const bio = document.getElementById('userBio');
        const counter = document.getElementById('bioCharCount');
        if (!bio || !counter) return;
        const len = bio.value.length;
        counter.textContent = len;
        counter.style.color = len > 900 ? '#ff6b6b' : len > 800 ? '#ffa500' : '#999999';
    },

    async fetchOpenRouterModels() {
        const keyEl = document.getElementById('openrouterApiKey');
        const refreshBtn = document.getElementById('refreshOpenRouterModelsBtn');
        const apiKey = keyEl?.value || this.settings.apis.openrouter.apiKey;

        if (!apiKey) { this.showNotification('Insira a chave da API do Open Router primeiro'); return; }
        if (refreshBtn) refreshBtn.classList.add('loading');

        try {
            if (window.electronAPI?.fetchOpenRouterModels) {
                const r = await window.electronAPI.fetchOpenRouterModels(apiKey);
                if (r.success) this.populateOpenRouterModels(r.models);
                else this.showNotification(`Erro ao carregar modelos: ${r.error}`);
            }
        } catch (err) {
            console.error(err);
            this.showNotification('Erro ao buscar modelos do Open Router');
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('loading');
        }
    },

    populateOpenRouterModels(models) {
        const sel = document.getElementById('openrouterModel');
        if (!sel) return;
        const current = sel.value || this.settings.apis.openrouter.model;
        sel.innerHTML = '';

        if (!models?.length) {
            sel.innerHTML = '<option value="">Nenhum modelo encontrado</option>';
            return;
        }

        models.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            const price = m.pricing ? ` ($${(parseFloat(m.pricing.prompt) * 1000000).toFixed(2)}/M tokens)` : '';
            opt.textContent = (m.name || m.id) + price;
            sel.appendChild(opt);
        });

        if (current && models.some(m => m.id === current)) sel.value = current;
    },

    async testApiConnection(provider) {
        const btn = document.getElementById(`test${provider.charAt(0).toUpperCase() + provider.slice(1)}Btn`);
        const apiKey = document.getElementById(`${provider}ApiKey`)?.value;

        if (!apiKey) { this.showNotification('Por favor, insira a chave da API primeiro'); return; }

        btn.classList.add('testing');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"></path></svg>Testando...';

        try {
            await new Promise(r => setTimeout(r, 2000));
            const ok = Math.random() > 0.3;
            if (ok) {
                btn.classList.replace('testing', 'success');
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,11 12,14 22,4"></polyline><path d="M21,12v7a2,2 0 0,1 -2,2H5a2,2 0 0,1 -2,-2V5a2,2 0 0,1 2,-2h11"></path></svg>Conexão OK';
                setTimeout(() => { btn.classList.remove('success'); btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,11 12,14 22,4"></polyline><path d="M21,12v7a2,2 0 0,1 -2,2H5a2,2 0 0,1 -2,-2V5a2,2 0 0,1 2,-2h11"></path></svg>Testar Conexão'; }, 3000);
            } else throw new Error('API key inválida');
        } catch {
            btn.classList.replace('testing', 'error');
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>Erro na conexão';
            setTimeout(() => { btn.classList.remove('error'); btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,11 12,14 22,4"></polyline><path d="M21,12v7a2,2 0 0,1 -2,2H5a2,2 0 0,1 -2,-2V5a2,2 0 0,1 2,-2h11"></path></svg>Testar Conexão'; }, 3000);
        }
    },

    // ─── Save / Load settings ────────────────────────────────────────────────

    async saveSettings() {
        const newSettings = {
            apis: {
                gemini: { enabled: document.getElementById('geminiEnabled').checked, apiKey: document.getElementById('geminiApiKey').value, model: document.getElementById('geminiModel').value },
                mistral: { enabled: document.getElementById('mistralEnabled').checked, apiKey: document.getElementById('mistralApiKey').value, model: document.getElementById('mistralModel').value },
                zai: { enabled: document.getElementById('zaiEnabled').checked, apiKey: document.getElementById('zaiApiKey').value, model: document.getElementById('zaiModel').value },
                openrouter: { enabled: document.getElementById('openrouterEnabled').checked, apiKey: document.getElementById('openrouterApiKey').value, model: document.getElementById('openrouterModel').value },
                imagen: { apiKey: document.getElementById('imagenApiKey')?.value || '' }
            },
            activeModel: document.querySelector('input[name="activeModel"]:checked')?.value || 'gemini',
            systemPrompt: this.settings.systemPrompt,
            personality: {
                type: document.getElementById('personalityType').value,
                formalityLevel: parseInt(document.getElementById('formalityLevel').value),
                allowProfanity: document.getElementById('allowProfanity').checked,
                useSlang: document.getElementById('useSlang').checked,
                useEmojis: document.getElementById('useEmojis').checked,
                responseStyle: document.querySelector('input[name="responseStyle"]:checked')?.value || 'detailed'
            },
            identity: { nickname: document.getElementById('userNickname')?.value || '', bio: document.getElementById('userBio')?.value || '' },
            voice: {
                type: document.querySelector('input[name="voiceType"]:checked')?.value || 'robotic',
                elevenLabs: { apiKey: document.getElementById('elevenLabsApiKey')?.value || '', voiceId: document.getElementById('elevenLabsVoiceId')?.value || '' }
            },
            theme: document.querySelector('input[name="appTheme"]:checked')?.value || 'default',
            debug: {
                forceSnow: document.getElementById('debugForceSnow')?.checked || false,
                forceNewYear: document.getElementById('debugForceNewYear')?.checked || false,
                forceAurora: document.getElementById('debugForceAurora')?.checked || false,
                forceStarry: document.getElementById('debugForceStarry')?.checked || false,
                forceUpdate: document.getElementById('debugForceUpdate')?.checked || false,
                verboseLogging: document.getElementById('debugVerboseLogging')?.checked || false,
                showIds: document.getElementById('debugShowIds')?.checked || false,
                unlocked: this.settings.debug?.unlocked || false
            }
        };

        this.settings = { ...newSettings, pinnedChats: this.settings.pinnedChats || [] };
        localStorage.setItem('openchat-settings', JSON.stringify(this.settings));

        if (window.electronAPI?.saveSettings) {
            try { await window.electronAPI.saveSettings(this.settings); }
            catch (e) { console.error('Erro ao salvar via IPC:', e); }
        }

        ['gemini', 'mistral', 'zai', 'openrouter'].forEach(p => this.updateApiStatus(p));

        this.hideFloatingButtons();
        this.originalSettings = JSON.stringify(this.getCurrentFormSettings());
        this.showNotification('Configurações salvas com sucesso!', 'success');
        this.applyTheme(this.settings.theme);
        this.initSnowEffect();
        this.initNewYearMessage();
    },

    loadSettings() {
        try {
            const raw = localStorage.getItem('openchat-settings');
            if (!raw) return;
            const parsed = JSON.parse(raw);

            if (!parsed.systemPrompt && this.settings.systemPrompt) parsed.systemPrompt = this.settings.systemPrompt;
            if (!parsed.personality) parsed.personality = this.settings.personality;
            if (!parsed.identity) parsed.identity = this.settings.identity;
            if (!parsed.voice) parsed.voice = this.settings.voice;
            if (!parsed.apis) parsed.apis = this.settings.apis;
            else {
                if (!parsed.apis.zai) parsed.apis.zai = this.settings.apis.zai;
                if (!parsed.apis.openrouter) parsed.apis.openrouter = this.settings.apis.openrouter;
                if (!parsed.apis.imagen) parsed.apis.imagen = this.settings.apis.imagen;
            }
            if (!parsed.theme) parsed.theme = this.settings.theme || 'default';
            if (!parsed.pinnedChats) parsed.pinnedChats = this.settings.pinnedChats || [];

            this.settings = { ...this.settings, ...parsed };
            this.applyTheme(this.settings.theme);
            this.initSnowEffect();
            this.initNewYearMessage();
        } catch (e) {
            console.error('Erro ao carregar configurações:', e);
        }
    }
};
