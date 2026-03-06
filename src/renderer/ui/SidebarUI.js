// SidebarUI.js — Módulo responsável pelo histórico de chats na sidebar
// Extraído de renderer.js para reduzir a complexidade do arquivo principal.

const SidebarMethods = {

    // ─── Chat list ────────────────────────────────────────────────────────────

    async loadChatList() {
        try {
            if (window.electronAPI?.getChatList) {
                const result = await window.electronAPI.getChatList();
                if (result.success) {
                    this.chatList = result.chats;
                    this.renderChatList();
                }
            }
        } catch (error) {
            console.error('Erro ao carregar lista de chats:', error);
        }
    },

    renderChatList() {
        const chatHistory = document.querySelector('.chat-history');
        if (!chatHistory) return;

        if (this.chatList.length === 0) {
            chatHistory.innerHTML = `
                <div class="chat-history-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <p>Nenhum chat ainda</p>
                    <p>Comece uma conversa para ver o histórico aqui</p>
                </div>`;
            return;
        }

        const architectChats = this.chatList.filter(c => c.isArchitect);
        const normalChats = this.chatList.filter(c => !c.isArchitect);
        const pinnedChats = normalChats.filter(c => this.settings.pinnedChats.includes(c.id));
        const unpinnedChats = normalChats.filter(c => !this.settings.pinnedChats.includes(c.id));

        let html = '';

        if (architectChats.length > 0) {
            html += '<div class="history-section"><h4>🏗️ Arquiteto</h4>';
            architectChats.forEach(c => { html += this.renderChatItem(c, false, true); });
            html += '</div>';
        }

        if (pinnedChats.length > 0) {
            html += '<div class="history-section"><h4>Fixados</h4>';
            pinnedChats.forEach(c => { html += this.renderChatItem(c, true); });
            html += '</div>';
        }

        // Agrupar chats não fixados por data
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);
        const lastWeek = new Date(today.getTime() - 7 * 86400000);

        const groups = { today: [], yesterday: [], lastWeek: [], older: [] };

        unpinnedChats.forEach(chat => {
            const d = new Date(chat.updatedAt);
            const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            if (day.getTime() === today.getTime()) groups.today.push(chat);
            else if (day.getTime() === yesterday.getTime()) groups.yesterday.push(chat);
            else if (d >= lastWeek) groups.lastWeek.push(chat);
            else groups.older.push(chat);
        });

        const sections = [
            { key: 'today', label: 'Hoje' },
            { key: 'yesterday', label: 'Ontem' },
            { key: 'lastWeek', label: 'Última semana' },
            { key: 'older', label: 'Mais antigo' }
        ];

        sections.forEach(({ key, label }) => {
            if (groups[key].length > 0) {
                html += `<div class="history-section"><h4>${label}</h4>`;
                groups[key].forEach(c => { html += this.renderChatItem(c, false); });
                html += '</div>';
            }
        });

        chatHistory.innerHTML = html;
    },

    renderChatItem(chat, isPinned = false, isArchitect = false) {
        const isActive = chat.id === this.currentChatId ? 'active' : '';
        const architectClass = (isArchitect || chat.isArchitect) ? 'architect-chat' : '';
        const pinIcon = isPinned
            ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pin-icon"><path d="M12 17v5"></path><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 7.89 17H16.1a2 2 0 0 0 1.78-2.55l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1Z"></path></svg>'
            : '';

        return `
            <div class="chat-item ${isActive} ${isPinned ? 'pinned' : ''} ${architectClass}" data-chat-id="${chat.id}">
                <div class="chat-preview">
                    <div class="chat-title-row">
                        ${pinIcon}
                        <span class="chat-title">${this.escapeHtml(chat.title)}</span>
                    </div>
                </div>
                <button class="chat-options-btn" onclick="event.stopPropagation(); window.openchat.showChatOptions('${chat.id}', event)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="19" cy="12" r="1"></circle>
                        <circle cx="5"  cy="12" r="1"></circle>
                    </svg>
                </button>
            </div>`;
    },

    // ─── Chat CRUD ────────────────────────────────────────────────────────────

    async deleteChat(chatId) {
        try {
            if (window.electronAPI?.deleteChat) {
                const result = await window.electronAPI.deleteChat(chatId);
                if (result.success) {
                    if (chatId === this.currentChatId) this.startNewChat();
                    await this.loadChatList();
                    this.showNotification('Chat deletado', 'success');
                } else {
                    this.showNotification(`Erro ao deletar chat: ${result.error}`, 'error');
                }
            }
        } catch (error) {
            console.error('Erro ao deletar chat:', error);
            this.showNotification('Erro ao deletar chat', 'error');
        }
    },

    // ─── Context menu (opções de chat) ───────────────────────────────────────

    showChatOptions(chatId, event) {
        this.hideChatOptions();

        const chatItem = event.target.closest('.chat-item');
        if (!chatItem) return;

        const isPinned = this.settings.pinnedChats.includes(chatId);
        const pinText = isPinned ? 'Desfixar' : 'Fixar';

        const menu = document.createElement('div');
        menu.className = 'chat-options-menu';
        menu.innerHTML = `
            <button class="chat-option-item" onclick="window.openchat.renameChatPrompt('${chatId}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                    <path d="m15 5 4 4"></path>
                </svg>
                Renomear
            </button>
            <button class="chat-option-item" onclick="window.openchat.togglePinChat('${chatId}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 17v5"></path>
                    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 7.89 17H16.1a2 2 0 0 0 1.78-2.55l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1Z"></path>
                </svg>
                ${pinText}
            </button>
            <button class="chat-option-item danger" onclick="window.openchat.deleteChatConfirm('${chatId}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                </svg>
                Excluir
            </button>`;

        const rect = event.target.getBoundingClientRect();
        menu.style.cssText = `position:fixed;top:${rect.bottom + 5}px;right:${window.innerWidth - rect.right}px;z-index:1001`;
        document.body.appendChild(menu);

        setTimeout(() => {
            document.addEventListener('click', this.hideChatOptions.bind(this), { once: true });
        }, 10);
    },

    hideChatOptions() {
        document.querySelector('.chat-options-menu')?.remove();
    },

    async renameChatPrompt(chatId) {
        this.hideChatOptions();
        const chat = this.chatList.find(c => c.id === chatId);
        if (!chat) return;
        const newTitle = prompt('Novo nome para o chat:', chat.title);
        if (newTitle?.trim() && newTitle.trim() !== chat.title) {
            await this.renameChat(chatId, newTitle.trim());
        }
    },

    async renameChat(chatId, newTitle) {
        try {
            const chat = this.chatList.find(c => c.id === chatId);
            if (chat) { chat.title = newTitle; chat.updatedAt = new Date().toISOString(); }

            if (chatId === this.currentChatId) {
                await this.saveCurrentChat();
            } else if (window.electronAPI?.loadChat) {
                const result = await window.electronAPI.loadChat(chatId);
                if (result.success) {
                    await window.electronAPI.saveChat({ ...result.chat, title: newTitle, updatedAt: new Date().toISOString() });
                }
            }

            await this.loadChatList();
            this.showNotification('Chat renomeado com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao renomear chat:', error);
            this.showNotification('Erro ao renomear chat', 'error');
        }
    },

    deleteChatConfirm(chatId) {
        this.hideChatOptions();
        const chat = this.chatList.find(c => c.id === chatId);
        if (!chat) return;
        if (confirm(`Tem certeza que deseja excluir o chat "${chat.title}"?`)) {
            this.deleteChat(chatId);
        }
    },

    togglePinChat(chatId) {
        this.hideChatOptions();
        const idx = this.settings.pinnedChats.indexOf(chatId);
        if (idx === -1) {
            this.settings.pinnedChats.push(chatId);
            this.showNotification('Chat fixado', 'success');
        } else {
            this.settings.pinnedChats.splice(idx, 1);
            this.showNotification('Chat desfixado', 'info');
        }
        localStorage.setItem('openchat-settings', JSON.stringify(this.settings));
        this.loadChatList();
    },

    // ─── Auto-save ────────────────────────────────────────────────────────────

    setupAutoSave() {
        setInterval(() => {
            if (this.messages.length > 0 && this.currentChatId) this.saveCurrentChat();
        }, 30000);

        window.addEventListener('beforeunload', () => {
            if (this.messages.length > 0) this.saveCurrentChat();
        });
    }
};
