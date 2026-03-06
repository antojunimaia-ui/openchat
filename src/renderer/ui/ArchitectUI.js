// ArchitectUI.js — Módulo responsável pelo Modo Arquiteto
// Extraído de renderer.js para reduzir a complexidade do arquivo principal.

const ArchitectMethods = {

    setupArchitectModals() {
        const architectIntroOverlay = document.getElementById('architectIntroModalOverlay');
        const architectIntroUnderstoodBtn = document.getElementById('architectIntroUnderstoodBtn');
        const architectPrdOverlay = document.getElementById('architectPrdModalOverlay');
        const architectPrdCancelBtn = document.getElementById('architectPrdCancelBtn');
        const architectPrdContinueBtn = document.getElementById('architectPrdContinueBtn');
        const architectPrdInput = document.getElementById('architectPrdInput');
        const architectSidebarClose = document.getElementById('architectSidebarClose');
        const architectCopyBtn = document.getElementById('architectCopyBtn');
        const architectWordCountBtn = document.getElementById('architectWordCountBtn');
        const resizeHandle = document.getElementById('architectSidebarResizeHandle');
        const documentContent = document.getElementById('architectDocumentContent');

        if (architectIntroUnderstoodBtn) {
            architectIntroUnderstoodBtn.addEventListener('click', () => {
                this.closeArchitectIntro();
                this.openArchitectPrdModal();
            });
        }

        if (architectPrdCancelBtn) {
            architectPrdCancelBtn.addEventListener('click', () => {
                this.closeArchitectPrdModal();
            });
        }

        if (architectPrdContinueBtn) {
            architectPrdContinueBtn.addEventListener('click', () => {
                const prdContent = architectPrdInput.value.trim();
                if (prdContent) {
                    this.startArchitectMode(prdContent);
                } else {
                    this.showNotification('Por favor, insira um documento inicial');
                }
            });
        }

        // Close on overlay click
        if (architectIntroOverlay) {
            architectIntroOverlay.addEventListener('click', (e) => {
                if (e.target === architectIntroOverlay) {
                    this.closeArchitectIntro();
                }
            });
        }

        if (architectPrdOverlay) {
            architectPrdOverlay.addEventListener('click', (e) => {
                if (e.target === architectPrdOverlay) {
                    this.closeArchitectPrdModal();
                }
            });
        }

        // Architect sidebar
        if (architectSidebarClose) {
            architectSidebarClose.addEventListener('click', () => {
                this.exitArchitectMode();
            });
        }

        // Architect copy button
        if (architectCopyBtn) {
            architectCopyBtn.addEventListener('click', () => {
                this.copyArchitectDocument();
            });
        }

        // Architect word count button
        if (architectWordCountBtn) {
            architectWordCountBtn.addEventListener('click', () => {
                this.showArchitectStats();
            });
        }

        // Architect sidebar resize
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                this.isResizingArchitectSidebar = true;
                e.preventDefault();
            });
        }

        document.addEventListener('mousemove', (e) => {
            if (this.isResizingArchitectSidebar) {
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth >= 300 && newWidth <= 800) {
                    this.architectSidebarWidth = newWidth;
                    this.updateArchitectSidebarWidth();
                }
            }
        });

        document.addEventListener('mouseup', () => {
            this.isResizingArchitectSidebar = false;
        });

        // Document content changes
        if (documentContent) {
            documentContent.addEventListener('input', () => {
                this.architectDocument = documentContent.textContent;
                this.updateArchitectStats();
            });
        }
    },

    openArchitectIntro() {
        const overlay = document.getElementById('architectIntroModalOverlay');
        if (overlay) overlay.classList.add('show');
    },

    closeArchitectIntro() {
        const overlay = document.getElementById('architectIntroModalOverlay');
        if (overlay) overlay.classList.remove('show');
    },

    openArchitectPrdModal() {
        const overlay = document.getElementById('architectPrdModalOverlay');
        const input = document.getElementById('architectPrdInput');
        if (overlay && input) {
            input.value = '';
            overlay.classList.add('show');
            setTimeout(() => input.focus(), 300);
        }
    },

    closeArchitectPrdModal() {
        const overlay = document.getElementById('architectPrdModalOverlay');
        if (overlay) overlay.classList.remove('show');
    },

    startArchitectMode(initialDocument) {
        console.log('Starting Architect Mode with document:', initialDocument.substring(0, 100));

        this.closeArchitectPrdModal();

        this.architectMode = true;
        this.architectDocument = initialDocument;

        // Start new chat for architect mode
        this.startNewChat(true);

        const architectSidebar = document.getElementById('architectSidebar');
        if (architectSidebar) architectSidebar.classList.add('show');

        const documentContent = document.getElementById('architectDocumentContent');
        if (documentContent) documentContent.textContent = initialDocument;

        this.updateArchitectStats();

        const mainSidebar = document.getElementById('chatgptSidebar');
        if (mainSidebar) mainSidebar.classList.add('hidden');

        const mainContent = document.querySelector('.main-content');
        const inputContainer = document.querySelector('.chat-input-container');
        if (mainContent) mainContent.classList.add('architect-mode');
        if (inputContainer) inputContainer.classList.add('architect-mode');

        const messageInput = document.getElementById('messageInput');
        if (messageInput) messageInput.placeholder = 'Construa sua próxima grande ideia!';

        this.updateArchitectSidebarWidth();
        this.showNotification('Modo Arquiteto ativado');
    },

    exitArchitectMode() {
        if (!confirm('Deseja sair do Modo Arquiteto? O documento será salvo no chat.')) {
            return;
        }

        console.log('Exiting Architect Mode');
        this.architectMode = false;

        const architectSidebar = document.getElementById('architectSidebar');
        if (architectSidebar) architectSidebar.classList.remove('show');

        const mainSidebar = document.getElementById('chatgptSidebar');
        if (mainSidebar) mainSidebar.classList.remove('hidden');

        const mainContent = document.querySelector('.main-content');
        const inputContainer = document.querySelector('.chat-input-container');
        if (mainContent) {
            mainContent.classList.remove('architect-mode');
            mainContent.style.marginRight = '';
        }
        if (inputContainer) {
            inputContainer.classList.remove('architect-mode');
            inputContainer.style.right = '';
        }

        const messageInput = document.getElementById('messageInput');
        if (messageInput) messageInput.placeholder = 'No que você está pensando?';

        this.showNotification('Modo Arquiteto desativado');
    },

    updateArchitectSidebarWidth() {
        const architectSidebar = document.getElementById('architectSidebar');
        const mainContent = document.querySelector('.main-content');
        const inputContainer = document.querySelector('.chat-input-container');

        if (architectSidebar) architectSidebar.style.width = `${this.architectSidebarWidth}px`;

        if (this.architectMode) {
            if (mainContent) mainContent.style.marginRight = `${this.architectSidebarWidth}px`;
            if (inputContainer) inputContainer.style.right = `${this.architectSidebarWidth}px`;
        }
    },

    getArchitectDocument() {
        const documentContent = document.getElementById('architectDocumentContent');
        const currentContent = documentContent ? documentContent.textContent : this.architectDocument;
        this.architectDocument = currentContent;

        return {
            success: true,
            document: currentContent || ''
        };
    },

    updateArchitectDocument(newContent) {
        this.architectDocument = newContent;
        const documentContent = document.getElementById('architectDocumentContent');

        if (documentContent) {
            documentContent.textContent = newContent;
            this.updateArchitectStats();
            console.log('✅ Documento atualizado na sidebar. Tamanho:', newContent.length);
        } else {
            console.warn('⚠️ Elemento architectDocumentContent não encontrado');
        }

        return {
            success: true,
            message: 'Documento atualizado com sucesso'
        };
    },

    updateArchitectStats() {
        const text = this.architectDocument || '';
        const charCount = text.length;
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

        const charCountEl = document.getElementById('architectCharCount');
        const wordCountEl = document.getElementById('architectWordCount');

        if (charCountEl) {
            charCountEl.textContent = `${charCount.toLocaleString('pt-BR')} caracteres`;
        }
        if (wordCountEl) {
            wordCountEl.textContent = `${wordCount.toLocaleString('pt-BR')} palavras`;
        }
    },

    copyArchitectDocument() {
        if (!this.architectDocument) {
            this.showNotification('Documento vazio');
            return;
        }

        navigator.clipboard.writeText(this.architectDocument).then(() => {
            this.showNotification('Documento copiado!');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            this.showNotification('Erro ao copiar documento');
        });
    },

    showArchitectStats() {
        const text = this.architectDocument || '';
        const charCount = text.length;
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        const lineCount = text.split('\n').length;
        const charNoSpaces = text.replace(/\s/g, '').length;

        const stats = `
📊 Estatísticas do Documento

Caracteres: ${charCount.toLocaleString('pt-BR')}
Caracteres (sem espaços): ${charNoSpaces.toLocaleString('pt-BR')}
Palavras: ${wordCount.toLocaleString('pt-BR')}
Linhas: ${lineCount.toLocaleString('pt-BR')}
        `.trim();

        alert(stats);
    }
};
