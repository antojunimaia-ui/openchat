// ChatUI.js — Módulo responsável pela renderização de mensagens e gerenciamento do chat
// Extraído de renderer.js para reduzir a complexidade do arquivo principal.

const ChatUIMethods = {

    // ─── Adicionar mensagem ao estado + DOM ──────────────────────────────────

    addMessage(text, type = 'user', image = null, memoryAction = null) {
        console.log('📝 addMessage called:', { type, text: text.substring(0, 50), isThinking: this.isThinking, hasThinkingWrapper: !!this.currentThinkingWrapper });

        const message = {
            id: Date.now(),
            text,
            type,
            image,
            timestamp: new Date(),
            memoryAction,
            alreadyRendered: false
        };

        this.messages.push(message);

        if (this.currentThinkingWrapper) {
            console.log('🧠 In thinking mode, handling message type:', type);
            if (type === 'user') {
                console.log('👤 Adding user message during thinking');
                this.renderSingleMessage(message);
                message.alreadyRendered = true;
            }
        } else {
            console.log('💬 Normal mode - calling renderMessages');
            this.renderMessages();
        }

        if (type !== 'system') {
            if (!this.currentChatId && type === 'user') {
                this.currentChatId = 'chat-' + Date.now();
            }
            this.hasNewContent = true;
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => { this.saveCurrentChat(); }, 1000);
        }
    },

    // ─── Renderizar UMA mensagem (usada durante "thinking") ──────────────────

    renderSingleMessage(message) {
        let container = document.querySelector('.messages-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'messages-container';
            document.querySelector('.main-content').appendChild(container);
        }

        const welcome = document.querySelector('.welcome-message');
        if (welcome) welcome.style.display = 'none';

        const content = message.type === 'bot'
            ? this.formatBotMessage(message.text)
            : `<p>${message.text}</p>`;

        let memoryIndicator = '';
        if (message.memoryAction === 'saved') memoryIndicator = '<div class="memory-indicator">Memória salva</div>';
        else if (message.memoryAction === 'updated') memoryIndicator = '<div class="memory-indicator">Memória atualizada</div>';

        const el = document.createElement('div');
        el.className = `message ${message.type}`;
        el.setAttribute('data-message-id', message.id);
        el.innerHTML = `
            ${memoryIndicator}
            <div class="message-content">
                ${message.image ? `<img src="${message.image}" alt="Sent image" class="message-image">` : ''}
                ${content}
            </div>`;

        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
    },

    // ─── Renderizar todas as mensagens pendentes ──────────────────────────────

    renderMessages() {
        const welcome = document.querySelector('.welcome-message');

        if (this.messages.length === 0) {
            if (welcome) welcome.style.display = 'block';
            document.querySelector('.messages-container')?.remove();
            return;
        }

        if (welcome) welcome.style.display = 'none';

        let container = document.querySelector('.messages-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'messages-container';
            document.querySelector('.main-content').appendChild(container);
        }

        // Coletar IDs já renderizados para não duplicar
        const existingIds = new Set();
        container.querySelectorAll('.message:not(.thinking-message)').forEach(el => {
            const id = el.getAttribute('data-message-id');
            if (id) existingIds.add(id);
        });

        const toRender = this.messages.filter(m => !m.isPartOfThinking && !existingIds.has(String(m.id)));

        console.log('📊 Total messages:', this.messages.length, '| New to render:', toRender.length);

        const html = toRender.map(msg => {
            let content = msg.type === 'bot'
                ? this.formatBotMessage(msg.text) + (msg.streaming ? '<span class="streaming-cursor"></span>' : '')
                : `<p>${msg.text}</p>`;

            const streamAttr = (msg.type === 'bot' && msg.streaming) ? ' data-streaming="true"' : '';

            let memoryIndicator = '';
            if (msg.memoryAction === 'saved') memoryIndicator = '<div class="memory-indicator">Memória salva</div>';
            else if (msg.memoryAction === 'updated') memoryIndicator = '<div class="memory-indicator">Memória atualizada</div>';

            return `
                <div class="message ${msg.type}" data-message-id="${msg.id}"${streamAttr}>
                    ${memoryIndicator}
                    <div class="message-content">
                        ${msg.image ? `<img src="${msg.image}" alt="Sent image" class="message-image">` : ''}
                        ${content}
                    </div>
                </div>`;
        }).join('');

        if (html) {
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            Array.from(tmp.children).forEach(child => container.appendChild(child));
        }

        container.scrollTop = container.scrollHeight;
    },

    // ─── Streaming Update ────────────────────────────────────────────────────

    updateStreamingMessageElement() {
        if (!this.currentStreamingMessage) return;

        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;

        const streamingElements = messagesContainer.querySelectorAll('.message.bot[data-streaming="true"]');
        const streamingElement = streamingElements[streamingElements.length - 1];

        if (streamingElement) {
            const messageContent = streamingElement.querySelector('.message-content');
            if (messageContent) {
                const text = this.currentStreamingMessage.text;
                const formattedContent = this.formatBotMessageStreaming(text);
                messageContent.innerHTML = formattedContent;
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
    },

    formatBotMessageStreaming(text) {
        if (!text) return '';
        text = text.replace(/\[FUNCTION_CALL\]\s*[\s\S]*?\s*\[\/FUNCTION_CALL\]/gi, '');
        text = text.replace(/\[FUNCTION_CALL\][\s\S]*$/gi, '');
        text = text.trim();

        try {
            const renderer = new marked.Renderer();
            renderer.code = (token) => {
                const code = typeof token === 'string' ? token : token.text;
                const language = (typeof token === 'object' && token.lang) ? token.lang : 'text';
                const lang = language || 'text';
                const codeId = 'ace-editor-' + Math.random().toString(36).substr(2, 9);
                const cleanCode = this.escapeHtml(code.trim());

                setTimeout(() => this.initializeAceEditor(codeId, lang, code.trim()), 10);

                return `<div class="ace-code-block-container">
                    <div class="code-block-header">
                        <div class="code-block-controls">
                            <span class="control-dot red"></span>
                            <span class="control-dot yellow"></span>
                            <span class="control-dot green"></span>
                        </div>
                        <span class="code-block-lang">${lang}</span>
                        <button class="copy-code-btn" onclick="window.openchat.copyCode(this)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Copiar</span>
                        </button>
                    </div>
                    <div class="ace-editor-wrapper">
                        <div id="${codeId}" class="ace-editor-instance">${cleanCode}</div>
                    </div>
                </div>`;
            };

            return marked.parse(text, { renderer, breaks: true, gfm: true });
        } catch (error) {
            console.error('Error parsing markdown during streaming:', error);
            return `<p>${text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
        }
    },

    formatBotMessage(text) {
        if (!text) return '';

        const indicators = [];
        text = text.replace(/<div class="function-indicator (reading-document|writing-document|web-search|web-scrape)">[\s\S]*?<\/div>/g, (match) => {
            const placeholder = `__INDICATOR_${indicators.length}__`;
            indicators.push(match);
            return placeholder;
        });

        text = text.replace(/\[FUNCTION_CALL\]\s*[\s\S]*?\s*\[\/FUNCTION_CALL\]/gi, '');
        text = text.replace(/\[FUNCTION_CALL\][\s\S]*$/gi, '');
        text = text.trim();

        try {
            const renderer = new marked.Renderer();
            renderer.code = (token) => {
                const code = typeof token === 'string' ? token : token.text;
                const language = (typeof token === 'object' && token.lang) ? token.lang : 'text';
                const lang = language || 'text';
                const codeId = 'ace-editor-' + Math.random().toString(36).substr(2, 9);
                const cleanCode = this.escapeHtml(code.trim());

                setTimeout(() => this.initializeAceEditor(codeId, lang, code.trim()), 10);

                return `<div class="ace-code-block-container">
                    <div class="code-block-header">
                        <div class="code-block-controls">
                            <span class="control-dot red"></span>
                            <span class="control-dot yellow"></span>
                            <span class="control-dot green"></span>
                        </div>
                        <span class="code-block-lang">${lang}</span>
                        <button class="copy-code-btn" onclick="window.openchat.copyCode(this)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Copiar</span>
                        </button>
                    </div>
                    <div class="ace-editor-wrapper">
                        <div id="${codeId}" class="ace-editor-instance">${cleanCode}</div>
                    </div>
                </div>`;
            };

            let formatted = marked.parse(text, { renderer, breaks: true, gfm: true });
            indicators.forEach((indicator, i) => {
                formatted = formatted.replace(`__INDICATOR_${i}__`, indicator);
            });
            return formatted;
        } catch (error) {
            console.error('Error parsing markdown:', error);
            return `<p>${text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
        }
    },

    copyCode(btn) {
        const container = btn.closest('.ace-code-block-container');
        const editorInstance = container.querySelector('.ace-editor-instance');
        const editorId = editorInstance.id;
        const editor = ace.edit(editorId);
        const code = editor.getValue();

        navigator.clipboard.writeText(code).then(() => {
            const originalContent = btn.innerHTML;
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Copiado!</span>
            `;
            btn.classList.add('copied');

            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Erro ao copiar código:', err);
        });
    },

    initializeAceEditor(editorId, language, code) {
        const editorElement = document.getElementById(editorId);
        if (!editorElement || editorElement.aceEditor) return;

        try {
            const lineCount = (code.match(/\n/g) || []).length + 1;
            const lineHeight = 20;
            const minHeight = 60;
            const maxHeight = 400;
            const calculatedHeight = Math.min(Math.max(lineCount * lineHeight + 20, minHeight), maxHeight);

            editorElement.style.height = calculatedHeight + 'px';
            editorElement.style.width = '100%';

            const editor = ace.edit(editorId);
            editor.setTheme("ace/theme/github_dark");
            editor.setReadOnly(true);
            editor.setHighlightActiveLine(false);
            editor.setShowPrintMargin(false);
            editor.renderer.setShowGutter(true);
            editor.renderer.setScrollMargin(8, 8, 0, 0);

            const modeMap = {
                'javascript': 'ace/mode/javascript', 'js': 'ace/mode/javascript',
                'python': 'ace/mode/python', 'py': 'ace/mode/python',
                'html': 'ace/mode/html', 'css': 'ace/mode/css',
                'json': 'ace/mode/json', 'sql': 'ace/mode/sql',
                'xml': 'ace/mode/xml', 'markdown': 'ace/mode/markdown',
                'md': 'ace/mode/markdown', 'typescript': 'ace/mode/typescript',
                'ts': 'ace/mode/typescript'
            };
            editor.session.setMode(modeMap[language.toLowerCase()] || 'ace/mode/text');
            editorElement.aceEditor = editor;
        } catch (e) {
            console.error('Ace Editor init error:', e);
        }
    },

    // ─── Chat Management ─────────────────────────────────────────────────────

    startNewChat(isArchitectMode = false) {
        if (this.messages.length > 0 && this.currentChatId) {
            this.saveCurrentChat();
        }

        this.messages = [];
        this.currentChatId = null;
        this.hasNewContent = false;
        this.currentChatIsArchitect = !!isArchitectMode;

        this.renderMessages();
        this.clearSelectedTool();
        this.removeImage();

        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
            this.updateSendButton();
        }

        this.resetInputToCenter();

        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });

        this.showNotification(isArchitectMode ? 'Novo chat Arquiteto iniciado' : 'Novo chat iniciado');
    },

    async loadChat(chatId) {
        try {
            if (this.messages.length > 0 && this.currentChatId && this.currentChatId !== chatId) {
                await this.saveCurrentChat();
            }

            if (window.electronAPI && window.electronAPI.loadChat) {
                const result = await window.electronAPI.loadChat(chatId);

                if (result.success) {
                    this.currentChatId = chatId;
                    this.messages = result.chat.messages || [];
                    this.hasNewContent = false;

                    if (result.chat.isArchitect) {
                        this.currentChatIsArchitect = true;
                        this.architectDocument = result.chat.architectDocument || '';
                        if (!this.architectMode) this.startArchitectMode(this.architectDocument);
                    } else {
                        this.currentChatIsArchitect = false;
                        if (this.architectMode) this.exitArchitectMode();
                    }

                    this.renderMessages();

                    document.querySelectorAll('.chat-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    document.querySelector(`[data-chat-id="${chatId}"]`)?.classList.add('active');
                } else {
                    this.showNotification(`Erro ao carregar chat: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar chat:', error);
            this.showNotification('Erro ao carregar chat');
        }
    },

    async saveCurrentChat() {
        if (!this.messages.length || !window.electronAPI?.saveChat) return;

        try {
            if (!this.currentChatId) {
                this.currentChatId = 'chat-' + Date.now();
            }

            const firstUserMessage = this.messages.find(msg => msg.type === 'user');
            let title = 'Novo Chat';

            if (firstUserMessage) {
                let messageText = firstUserMessage.text.trim();
                messageText = messageText.replace(/^(olá|oi|hello|hi)[,\s]*/i, '');
                messageText = messageText.replace(/^(me ajude|ajuda|help)[,\s]*/i, '');
                if (messageText.length > 0) {
                    messageText = messageText.charAt(0).toUpperCase() + messageText.slice(1);
                }
                title = messageText.length > 50 ? messageText.substring(0, 47) + '...' : messageText;
                if (title.length < 3) title = 'Conversa ' + new Date().toLocaleDateString('pt-BR');
            }

            const existingChat = this.chatList.find(chat => chat.id === this.currentChatId);
            const isNewChat = !existingChat;

            const cleanMessages = this.messages.map(msg => {
                const { element, ...cleanMsg } = msg;
                return cleanMsg;
            });

            const chatData = {
                id: this.currentChatId,
                title: title,
                messages: cleanMessages,
                isArchitect: this.currentChatIsArchitect || false,
                architectDocument: this.currentChatIsArchitect ? this.architectDocument : undefined,
                createdAt: existingChat?.createdAt || this.messages[0]?.timestamp || new Date().toISOString(),
                updatedAt: (this.hasNewContent || isNewChat) ? new Date().toISOString() : (existingChat?.updatedAt || new Date().toISOString())
            };

            const result = await window.electronAPI.saveChat(chatData);

            if (result.success && isNewChat) {
                await this.loadChatList();
            }

            this.hasNewContent = false;
        } catch (error) {
            console.error('Erro ao salvar chat:', error);
        }
    },

    // ─── Outros ──────────────────────────────────────────────────────────────

    finishStreamingResponse(memoryAction = null) {
        this.isThinking = false;

        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.streaming = false;
            if (memoryAction) {
                this.currentStreamingMessage.memoryAction = memoryAction;
            }

            if (this.currentStreamingMessage.element && memoryAction) {
                const memoryIndicator = document.createElement('div');
                memoryIndicator.className = 'memory-indicator';
                memoryIndicator.textContent = memoryAction === 'saved' ? 'Memória salva' : 'Memória atualizada';
                this.currentStreamingMessage.element.insertBefore(memoryIndicator, this.currentStreamingMessage.element.firstChild);
            }

            if (this.currentStreamingMessage.element) {
                this.currentStreamingMessage.element.removeAttribute('data-streaming');
            } else {
                const messagesContainer = document.querySelector('.messages-container');
                if (messagesContainer) {
                    const streamingElements = messagesContainer.querySelectorAll('.message.bot[data-streaming="true"]');
                    streamingElements.forEach(el => el.removeAttribute('data-streaming'));

                    if (memoryAction && streamingElements.length > 0) {
                        const lastElement = streamingElements[streamingElements.length - 1];
                        const memoryIndicator = document.createElement('div');
                        memoryIndicator.className = 'memory-indicator';
                        memoryIndicator.textContent = memoryAction === 'saved' ? 'Memória salva' : 'Memória atualizada';
                        lastElement.insertBefore(memoryIndicator, lastElement.firstChild);
                    }
                }
            }

            if (!this.currentStreamingMessage.isPartOfThinking) {
                this.currentStreamingMessage = null;
            }

            if (!this.currentStreamingMessage || !this.currentStreamingMessage.isPartOfThinking) {
                this.currentThinkingWrapper = null;
                this.currentThinkingId = null;
            }
        }
    },

    cancelStreamingResponse() {
        if (this.currentStreamingMessage) {
            const index = this.messages.indexOf(this.currentStreamingMessage);
            if (index > -1) this.messages.splice(index, 1);
            this.currentStreamingMessage = null;
            if (!this.currentThinkingWrapper) this.renderMessages();
        }
    },

    showTypingIndicator() {
        this.hideTypingIndicator();
        let container = document.querySelector('.messages-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'messages-container';
            document.querySelector('.main-content').appendChild(container);
        }

        const typing = document.createElement('div');
        typing.className = 'message bot typing-message';
        typing.id = 'typingIndicator';
        typing.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>`;

        container.appendChild(typing);
        container.scrollTop = container.scrollHeight;
    },

    hideTypingIndicator() {
        document.getElementById('typingIndicator')?.remove();
    },

    escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    // ─── Lógica de Streaming ─────────────────────────────────────────────────

    setupStreamingListener() {
        if (window.electronAPI && window.electronAPI.onStreamingUpdate) {
            window.electronAPI.onStreamingUpdate((event, content) => {
                this.updateStreamingMessage(content);
            });
        }

        if (window.electronAPI && window.electronAPI.onStreamingComplete) {
            window.electronAPI.onStreamingComplete((event, memoryAction) => {
                this.finishStreamingResponse(memoryAction);
            });
        }
    },

    startStreamingResponse() {
        const message = {
            id: Date.now(),
            text: '',
            type: 'bot',
            timestamp: new Date(),
            streaming: true
        };

        this.currentStreamingMessage = message;
        this.messages.push(message);

        if (!this.currentThinkingWrapper) {
            this.renderMessages();
        }
    },

    updateStreamingMessage(content) {
        if (this.isThinking) return;

        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.text += content;

            if (this.currentStreamingMessage.element) {
                const text = this.currentStreamingMessage.text;
                const formatted = this.formatBotMessageStreaming(text);
                this.currentStreamingMessage.element.innerHTML = formatted;

                const container = document.querySelector('.messages-container');
                if (container) container.scrollTop = container.scrollHeight;
            } else {
                this.updateStreamingMessageElement();
            }
        }
    },

    finishStreamingResponse(memoryAction = null) {
        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.streaming = false;
            if (memoryAction) this.currentStreamingMessage.memoryAction = memoryAction;
            this.currentStreamingMessage = null;
            this.renderMessages();
        }
    }
};
