// Renderer process - lógica da interface
class OpenChat {
    constructor() {
        this.messages = [];
        this.selectedTool = null;
        this.imagePreview = null;
        this.currentStreamingMessage = null;
        this.currentChatId = null;
        this.chatList = [];
        this.streamingUpdateThrottle = null;
        this.snowInterval = null; // For snow creation interval
        this.snowCheckInterval = null; // For checking if Christmas season ended
        this.saveTimeout = null; // For batching save operations
        this.hasNewContent = false; // Flag to track if chat has new content that needs timestamp update
        this.isThinking = false; // Flag to prevent streaming interference during thinking
        this.architectMode = false; // Flag for architect mode
        this.currentChatIsArchitect = false; // Flag to mark if current chat is architect mode
        this.architectDocument = ''; // Current architect document content
        this.architectSidebarWidth = 400; // Default width for architect sidebar
        this.isResizingArchitectSidebar = false; // Flag for resizing
        this.settings = {
            apis: {
                gemini: {
                    enabled: false,
                    apiKey: '',
                    model: 'gemini-2.5-flash'
                },
                mistral: {
                    enabled: false,
                    apiKey: '',
                    model: 'mistral-large-latest'
                },
                zai: {
                    enabled: false,
                    apiKey: '',
                    model: 'glm-4.6'
                },
                openrouter: {
                    enabled: false,
                    apiKey: '',
                    model: 'google/gemini-2.0-flash-001'
                },
                imagen: {
                    apiKey: ''
                }
            },
            activeModel: 'gemini',
            systemPrompt: '', // Será carregado do arquivo
            personality: {
                type: 'balanced',
                formalityLevel: 3,
                allowProfanity: false,
                useSlang: false,
                useEmojis: false,
                responseStyle: 'detailed'
            },
            identity: {
                nickname: '',
                bio: ''
            },
            voice: {
                type: 'robotic',
                elevenLabs: {
                    apiKey: '',
                    voiceId: ''
                }
            },
            pinnedChats: [], // Array de IDs de chats fixados
            debug: {
                forceSnow: false,
                forceNewYear: false,
                forceAurora: false,
                forceStarry: false,
                verboseLogging: false,
                showIds: false,
                unlocked: false
            }
        };
        this.init();
        this.setupTitlebarControls();
    }

    init() {
        this.loadSystemPrompt().then(() => {
            this.loadSettings();
            this.setupEventListeners();
            this.setupStreamingListener();
            this.setupUpdaterListener();
            this.loadChatList();
            this.loadMessages();
            this.setupAutoSave();

            // Restore sidebar state
            this.restoreSidebarState();

            // Initialize snow effect after everything else is loaded
            this.initSnowEffect();

            // Initialize New Year message
            this.initNewYearMessage();

            // Check and show Terms of Use if not accepted
            this.checkTermsOfUse();
        });
    }

    setupTitlebarControls() {
        const minBtn = document.getElementById('minimizeBtn');
        const maxBtn = document.getElementById('maximizeBtn');
        const closeBtn = document.getElementById('closeBtn');

        if (minBtn) {
            minBtn.addEventListener('click', () => {
                window.electronAPI.windowMinimize();
            });
        }

        if (maxBtn) {
            maxBtn.addEventListener('click', () => {
                window.electronAPI.windowMaximize();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.electronAPI.windowClose();
            });
        }
    }

    async loadSystemPrompt() {
        try {
            if (window.electronAPI && window.electronAPI.readSystemPrompt) {
                const result = await window.electronAPI.readSystemPrompt();
                console.log('System prompt result:', result);
                if (result.success) {
                    this.settings.systemPrompt = result.prompt;
                    console.log('System prompt carregado com sucesso. Tamanho:', result.prompt.length, 'caracteres');
                } else {
                    // Fallback para prompt padrão
                    this.settings.systemPrompt = 'Você é um assistente útil e amigável. Responda de forma clara e concisa, sempre tentando ser prestativo e educativo.';
                    console.warn('Usando system prompt padrão:', result.error);
                }
            } else {
                // Fallback se não estiver no Electron
                this.settings.systemPrompt = 'Você é um assistente útil e amigável. Responda de forma clara e concisa, sempre tentando ser prestativo e educativo.';
                console.warn('electronAPI não disponível, usando prompt padrão');
            }
        } catch (error) {
            console.error('Erro ao carregar system prompt:', error);
            this.settings.systemPrompt = 'Você é um assistente útil e amigável. Responda de forma clara e concisa, sempre tentando ser prestativo e educativo.';
        }
    }

    setupUpdaterListener() {
        if (window.electronAPI && window.electronAPI.onUpdaterMessage) {
            window.electronAPI.onUpdaterMessage((event, data) => {
                if (data && data.message) {
                    this.showNotification(data.message);
                }
            });
        }
    }

    showNotification(message, type = 'info', duration = 3000) {
        console.log(`Notification: [${type}] ${message}`);

        const container = document.getElementById('notificationContainer');
        if (!container) {
            console.warn('notificationContainer not found, using alert');
            alert(message);
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

        notification.innerHTML = `
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${message}</span>
        `;

        container.appendChild(notification);

        // Force a reflow to trigger animation
        notification.offsetHeight;

        // Show notification
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Hide and remove
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 400);
        }, duration);
    }

    setupEventListeners() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const attachBtn = document.getElementById('attachBtn');
        const fileInput = document.getElementById('fileInput');
        const toolsBtn = document.getElementById('toolsBtn');
        const toolsDropdown = document.getElementById('toolsDropdown');
        const voiceBtn = document.getElementById('voiceBtn');

        // Sidebar elements (ChatGPT sidebar - always open)
        const newChatBtn = document.getElementById('newChatBtn');
        const settingsBtn = document.getElementById('settingsBtn');

        // Auto-resize textarea and update send button
        messageInput.addEventListener('input', () => {
            this.autoResizeTextarea(messageInput);
            this.updateSendButton();
        });

        // Send message on Enter (but not Shift+Enter)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Send button click
        sendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Send button clicked!');
            this.sendMessage();
        });

        // Test if button is clickable
        console.log('Send button element:', sendBtn);
        console.log('Send button disabled:', sendBtn.disabled);

        // Attach image
        attachBtn.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        // Tools dropdown
        toolsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toolsDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!toolsBtn.contains(e.target) && !toolsDropdown.contains(e.target)) {
                toolsDropdown.classList.remove('show');
            }
        });

        // Tool selection
        toolsDropdown.addEventListener('click', (e) => {
            const toolItem = e.target.closest('.tool-item');
            if (toolItem) {
                const toolId = toolItem.dataset.tool;
                this.selectTool(toolId);
                toolsDropdown.classList.remove('show');
            }
        });

        // Remove selected tool
        const selectedToolBtn = document.getElementById('selectedToolBtn');
        if (selectedToolBtn) {
            selectedToolBtn.addEventListener('click', () => {
                this.clearSelectedTool();
            });
        }

        // Remove image
        const removeImageBtn = document.getElementById('removeImageBtn');
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => {
                this.removeImage();
            });
        }

        // Voice button (placeholder)
        voiceBtn.addEventListener('click', () => {
            this.handleVoiceInput();
        });

        // New chat
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                console.log('New chat button clicked');
                this.startNewChat();
            });
        } else {
            console.error('newChatBtn not found');
        }

        // Settings
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                console.log('Settings button clicked');
                this.openSettings();
            });
        } else {
            console.error('settingsBtn not found');
        }

        // Sidebar toggle button
        const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Architect button
        const architectBtn = document.getElementById('architectBtn');
        if (architectBtn) {
            architectBtn.addEventListener('click', () => {
                console.log('Architect button clicked');
                this.openArchitectIntro();
            });
        } else {
            console.error('architectBtn not found');
        }

        // Settings modal functionality
        this.setupSettingsModal();

        // Architect modal functionality
        this.setupArchitectModals();

        // Chat history items
        document.addEventListener('click', (e) => {
            const chatItem = e.target.closest('.chat-item');
            if (chatItem && !e.target.closest('.chat-options-btn')) {
                const chatId = chatItem.dataset.chatId;
                this.loadChat(chatId);
            }
        });

        // Keyboard shortcut: Ctrl+S to toggle sidebar
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault(); // Prevent browser save dialog
                this.toggleSidebar();
            }
        });

        // Initialize send button state
        this.updateSendButton();

        // Drag and Drop implementation
        const dragOverlay = document.getElementById('dragOverlay');
        let dragCounter = 0;

        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            if (dragOverlay) dragOverlay.classList.add('active');
        });

        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0 && dragOverlay) {
                dragOverlay.classList.remove('active');
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            if (dragOverlay) dragOverlay.classList.remove('active');

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.handleDroppedFile(e.dataTransfer.files[0]);
            }
        });
    }

    async handleDroppedFile(file) {
        if (!file.path) {
            this.showNotification('Erro: caminho do arquivo não acessível');
            return;
        }

        this.addMessage(`Lendo arquivo: ${file.name}...`, 'system');

        try {
            const result = await window.electronAPI.parseFile(file.path);

            if (result.success) {
                const messageInput = document.getElementById('messageInput');
                const fileFormat = result.type.toUpperCase();
                messageInput.value += `\n[ARQUIVO ${fileFormat} ANEXADO: ${file.name}]\n${result.text}\n[FIM DO ARQUIVO]\n`;
                this.autoResizeTextarea(messageInput);
                this.updateSendButton();
                this.showNotification(`Arquivo ${file.name} adicionado ao contexto`);
            } else {
                this.showNotification(`Erro ao processar arquivo: ${result.error}`);
            }
        } catch (error) {
            console.error('Erro ao processar arquivo via drag/drop:', error);
            this.showNotification('Erro ao comunicar-se com processo principal');
        }
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 200);
        textarea.style.height = newHeight + 'px';
    }

    updateSendButton() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        if (!messageInput || !sendBtn) {
            console.log('Elements not found:', { messageInput, sendBtn });
            return;
        }

        const hasContent = messageInput.value.trim().length > 0 || this.imagePreview;

        console.log('updateSendButton:', {
            hasContent,
            messageLength: messageInput.value.trim().length,
            hasImage: !!this.imagePreview
        });

        sendBtn.disabled = !hasContent;
    }

    moveInputToBottom() {
        const inputContainer = document.querySelector('.chat-input-container');
        if (inputContainer && !inputContainer.classList.contains('moved-to-bottom')) {
            inputContainer.classList.add('moved-to-bottom');
        }
    }

    resetInputToCenter() {
        const inputContainer = document.querySelector('.chat-input-container');
        if (inputContainer) {
            inputContainer.classList.remove('moved-to-bottom');
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('chatgptSidebar');
        const mainContent = document.querySelector('.main-content');
        const inputContainer = document.querySelector('.chat-input-container');

        if (sidebar && mainContent && inputContainer) {
            const isHidden = sidebar.classList.contains('hidden');

            if (isHidden) {
                // Show sidebar
                sidebar.classList.remove('hidden');
                mainContent.classList.remove('sidebar-hidden');
                inputContainer.classList.remove('sidebar-hidden');
            } else {
                // Hide sidebar
                sidebar.classList.add('hidden');
                mainContent.classList.add('sidebar-hidden');
                inputContainer.classList.add('sidebar-hidden');
            }

            // Save state to localStorage
            localStorage.setItem('sidebar-hidden', !isHidden);
        }
    }

    restoreSidebarState() {
        const sidebarHidden = localStorage.getItem('sidebar-hidden') === 'true';

        if (sidebarHidden) {
            const sidebar = document.getElementById('chatgptSidebar');
            const mainContent = document.querySelector('.main-content');
            const inputContainer = document.querySelector('.chat-input-container');

            if (sidebar && mainContent && inputContainer) {
                sidebar.classList.add('hidden');
                mainContent.classList.add('sidebar-hidden');
                inputContainer.classList.add('sidebar-hidden');
            }
        }
    }

    generatePersonalityPrompt() {
        const p = this.settings.personality;
        const identity = this.settings.identity || {};
        let personalityPrompt = '';

        // Adicionar informações de identidade do usuário se disponíveis
        if (identity.nickname || identity.bio) {
            personalityPrompt += '\n\n=== INFORMAÇÕES SOBRE O USUÁRIO ===\n';

            if (identity.nickname) {
                personalityPrompt += `Nome/Apelido do usuário: ${identity.nickname}\n`;
                personalityPrompt += `IMPORTANTE: Sempre que apropriado, chame o usuário pelo nome "${identity.nickname}" para tornar a conversa mais pessoal e natural.\n`;
            }

            if (identity.bio) {
                personalityPrompt += `\nSobre o usuário:\n${identity.bio}\n`;
                personalityPrompt += `\nIMPORTANTE: Use essas informações para personalizar suas respostas de acordo com o contexto, interesses e perfil do usuário. Adapte exemplos, referências e o tom da conversa para serem mais relevantes para ele.\n`;
            }

            personalityPrompt += '=== FIM DAS INFORMAÇÕES DO USUÁRIO ===\n\n';
        }

        // Tipo de personalidade com instruções mais específicas e brasileiras
        const personalityTypes = {
            balanced: 'Seja equilibrado e versátil em suas respostas, adaptando-se ao contexto da conversa.',

            friendly: 'Seja muito amigável, caloroso e acolhedor. Use um tom positivo, encorajador e carinhoso. Trate o usuário como um amigo próximo.',

            professional: 'Mantenha um tom profissional, objetivo e respeitoso. Use linguagem técnica quando apropriado, mas sempre clara.',

            casual: 'Use um tom bem descontraído e informal. Fale como um brasileiro comum falaria no dia a dia. Use expressões como "cara", "mano", "véi", "irmão". Seja bem à vontade na conversa.',

            witty: 'Seja espirituoso e use humor brasileiro. Faça piadas, trocadilhos, use ironia e sarcasmo quando apropriado. Seja engraçado mas inteligente.',

            direct: 'Seja direto, conciso e vá direto ao ponto sem rodeios. Não enrole, seja objetivo e claro.',

            enthusiastic: 'Demonstre muito entusiasmo, energia e empolgação! Use exclamações, seja animado e contagiante. Mostre paixão pelo que está falando.',

            analytical: 'Seja analítico, lógico e metódico. Foque em dados, fatos e análises detalhadas. Explique o raciocínio por trás das suas respostas.',

            spicy: 'Seja extremamente safado, porco e sem pudor nenhum Fala de sexo de forma bem explícita e suja: rola, buceta, cu, foder, meter, chupar, gozar, tomar leitinho, levar tudo, etc. Flerta de um jeito bem escrachado, provoca bastante, faz elogios super safados e deixa o usuário louco de tesão (e com um pouquinho de vergonha gostosa). Escreve como se estivesse com uma vontade louca de foder agora mesmo.'
        };

        personalityPrompt += personalityTypes[p.type] || personalityTypes.balanced;

        // Nível de formalidade com instruções mais específicas
        if (p.formalityLevel <= 2) {
            personalityPrompt += ' Use linguagem BEM INFORMAL e coloquial. Fale como um brasileiro comum fala no WhatsApp ou numa conversa casual. Use contrações como "tá", "né", "pra", "cê", "tô". Evite linguagem formal completamente.';
        } else if (p.formalityLevel >= 4) {
            personalityPrompt += ' Use linguagem formal, educada e respeitosa. Evite gírias e mantenha um padrão culto da língua portuguesa.';
        } else {
            personalityPrompt += ' Use linguagem moderadamente informal, mas ainda acessível e natural.';
        }

        // Linguagem forte com instruções mais específicas
        if (p.allowProfanity) {
            personalityPrompt += ' Use palavrões e linguagem forte de forma NATURAL e LIVRE, como um brasileiro faria numa conversa informal. Palavras como "porra", "caralho", "merda", "foda", "puta que pariu" devem ser usadas quando fizer sentido no contexto. Não seja tímido com palavrões - use-os para dar ênfase e naturalidade à conversa.';
        }

        // Gírias brasileiras com exemplos específicos
        if (p.useSlang) {
            personalityPrompt += ' Use MUITAS gírias e expressões tipicamente brasileiras como: "mano", "cara", "véi", "irmão", "parceiro", "top", "massa", "dahora", "sinistro", "brabo", "quebrou tudo", "mandou bem", "tá ligado", "saca só", "é nóis", "tmj", "valeu", "falou", "suave", "de boa", "tranquilo", "show de bola", etc.';
        }

        // Emojis
        if (p.useEmojis) {
            personalityPrompt += ' Use emojis de forma natural para expressar emoções e tornar as respostas mais expressivas e divertidas. 😄😎🔥💪👏🤔😅🙄😏';
        }

        // Estilo de resposta
        const responseStyles = {
            concise: ' Seja MUITO conciso e direto. Respostas curtas e objetivas. Vá direto ao ponto sem enrolação.',
            detailed: ' Forneça respostas bem detalhadas e completas. Explique tudo direitinho, dê exemplos e contexto.',
            conversational: ' Mantenha um estilo bem conversacional e natural, como se estivesse batendo um papo descontraído com um amigo. Faça perguntas, comente, seja interativo.'
        };

        personalityPrompt += responseStyles[p.responseStyle] || responseStyles.detailed;

        return personalityPrompt;
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        console.log('sendMessage called', { message, imagePreview: this.imagePreview });

        if (!message && !this.imagePreview) {
            console.log('No message or image to send');
            return;
        }

        try {
            // SAFETY: Clear any lingering thinking state from previous messages
            if (this.currentThinkingWrapper && this.selectedTool !== 'thinkLonger') {
                console.log('🧹 Clearing lingering thinking state');
                this.currentThinkingWrapper = null;
                this.currentThinkingId = null;
            }

            // Move input to bottom after first message
            this.moveInputToBottom();

            // Clear input
            messageInput.value = '';
            messageInput.style.height = 'auto';
            this.updateSendButton();

            // Prepare conversation history (exclude system messages and current message)
            const conversationHistory = this.messages
                .filter(msg => msg.type !== 'system')
                .slice(-10) // Keep last 10 messages for context (5 pairs of user/bot)
                .map(msg => ({
                    type: msg.type,
                    text: msg.text,
                    timestamp: msg.timestamp
                }));

            // Prepare message data with conversation context and personality
            const personalityPrompt = this.generatePersonalityPrompt();
            console.log('Prompt de personalidade gerado:', personalityPrompt);
            const messageData = {
                text: message,
                tool: this.selectedTool,
                image: this.imagePreview,
                conversationHistory: conversationHistory,
                personalityPrompt: personalityPrompt,
                isArchitectMode: this.architectMode, // Add architect mode flag
                architectDocument: this.architectMode ? this.architectDocument : undefined // Include document if in architect mode
            };

            console.log('Sending message data with context:', messageData);

            // Add user message to interface immediately
            this.addMessage(message, 'user', this.imagePreview);

            // Check if thinking tool is selected BEFORE clearing states
            const useThinking = this.selectedTool === 'thinkLonger';

            // Clear states (but keep thinking tool selected if it was selected)
            if (this.selectedTool !== 'thinkLonger') {
                this.clearSelectedTool();
            }
            this.removeImage();

            if (useThinking) {
                // Start thinking process
                this.startThinkingProcess(messageData);
            } else if (messageData.tool === 'createImage') {
                this.showTypingIndicator();
                try {
                    const apiKey = this.settings.apis.imagen?.apiKey;
                    if (!apiKey) {
                        this.hideTypingIndicator();
                        this.addMessage(`❌ Erro: Configure o Token do Hugging Face nas suas Configurações -> APIs para gerar imagens grátis!`, 'system');
                        return;
                    }
                    const result = await window.electronAPI.generateImage(message, apiKey);
                    this.hideTypingIndicator();
                    if (result.success) {
                        this.addMessage('', 'bot', result.imageData);
                    } else {
                        this.addMessage(`❌ Erro ao gerar imagem: ${result.error}`, 'system');
                    }
                } catch (err) {
                    this.hideTypingIndicator();
                    this.addMessage(`❌ Erro ao gerar imagem: ${err.message}`, 'system');
                }
                return;
            } else {
                // Normal flow
                // Check if using streaming (Mistral or Z.AI)
                const isStreaming = this.settings.activeModel === 'mistral' || this.settings.activeModel === 'zai';

                if (isStreaming) {
                    // Start streaming response
                    this.startStreamingResponse();
                } else {
                    // Show typing indicator for non-streaming
                    this.showTypingIndicator();
                }

                // Send message via IPC
                if (window.electronAPI && window.electronAPI.sendMessage) {
                    console.log('Enviando mensagem. System prompt atual:', this.settings.systemPrompt ? this.settings.systemPrompt.length : 0, 'caracteres');
                    const result = await window.electronAPI.sendMessage(messageData);

                    if (!isStreaming) {
                        this.hideTypingIndicator();
                    }

                    if (result.success) {
                        // Check if memories were saved/updated
                        let memoryAction = null;
                        if (result.functionCalls && result.functionCalls.length > 0) {
                            result.functionCalls.forEach(call => {
                                if (call.function === 'save_memory' && call.result && call.result.success) {
                                    memoryAction = 'saved';
                                } else if (call.function === 'update_memory' && call.result && call.result.success) {
                                    memoryAction = 'updated';
                                }
                            });
                        }

                        if (!isStreaming) {
                            // Add complete AI response for non-streaming
                            this.addMessage(result.response, 'bot', null, memoryAction);
                        } else {
                            // Streaming response is handled by the streaming listener
                            // finishStreamingResponse will be called by streaming-complete event
                            if (memoryAction && this.currentStreamingMessage) {
                                this.currentStreamingMessage.memoryAction = memoryAction;
                            }
                            // Substituir o texto bruto pelo texto processado (com indicadores e sem JSON de função)
                            if (this.currentStreamingMessage && result.response) {
                                this.currentStreamingMessage.text = result.response;
                                this.updateStreamingMessageElement();
                            }
                        }
                    } else {
                        // Show error message
                        this.addMessage(`❌ Erro: ${result.error}`, 'system');
                        if (isStreaming) {
                            this.cancelStreamingResponse();
                        }
                    }
                } else {
                    // Fallback for testing without Electron
                    if (!isStreaming) {
                        this.hideTypingIndicator();
                    }
                    setTimeout(() => {
                        this.addBotResponse(messageData);
                    }, 1000);
                }
            }
        } catch (error) {
            this.hideTypingIndicator();
            this.cancelStreamingResponse();
            console.error('Erro ao enviar mensagem:', error);
            this.addMessage(`❌ Erro ao enviar mensagem: ${error.message}`, 'system');
        }
    }

    handleFileSelect(event) {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                this.setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    }

    setImagePreview(imageSrc) {
        this.imagePreview = imageSrc;
        const previewContainer = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');

        previewImg.src = imageSrc;
        previewContainer.style.display = 'block';
        this.updateSendButton();
    }

    removeImage() {
        this.imagePreview = null;
        const previewContainer = document.getElementById('imagePreview');
        previewContainer.style.display = 'none';
        this.updateSendButton();
    }

    selectTool(toolId) {
        if (toolId === 'searchWeb') {
            const alreadySeen = localStorage.getItem('web-search-alert-seen');
            if (!alreadySeen) {
                const modal = document.getElementById('webSearchModalOverlay');
                if (modal) {
                    modal.style.display = 'flex';
                    const understoodBtn = document.getElementById('webSearchUnderstoodBtn');
                    if (understoodBtn) {
                        understoodBtn.onclick = () => {
                            modal.style.display = 'none';
                            localStorage.setItem('web-search-alert-seen', 'true');
                        };
                    }
                }
            }
        }

        this.selectedTool = toolId;
        const toolsBtn = document.getElementById('toolsBtn');
        const selectedTool = document.getElementById('selectedTool');
        const selectedToolName = document.getElementById('selectedToolName');
        const selectedToolIcon = document.getElementById('selectedToolIcon');

        // Hide tools button text
        toolsBtn.querySelector('.tools-text').style.display = 'none';

        // Show selected tool
        selectedTool.style.display = 'flex';

        // Set tool info
        const toolInfo = this.getToolInfo(toolId);
        selectedToolName.textContent = toolInfo.shortName;
        selectedToolIcon.innerHTML = toolInfo.icon;
    }

    clearSelectedTool() {
        this.selectedTool = null;
        const toolsBtn = document.getElementById('toolsBtn');
        const selectedTool = document.getElementById('selectedTool');

        // Show tools button text
        toolsBtn.querySelector('.tools-text').style.display = 'inline';

        // Hide selected tool
        selectedTool.style.display = 'none';
    }

    getToolInfo(toolId) {
        const tools = {
            createImage: { shortName: 'Image', icon: '🎨' },
            searchWeb: { shortName: 'Search', icon: '🌐' },
            thinkLonger: { shortName: 'Pensamento', icon: '💡' }
        };
        return tools[toolId] || { shortName: 'Tool', icon: '🔧' };
    }


    // Funções de Chat e Voz extraídas para ChatUI.js e VoiceManager.js

    // End of Thinking/Streaming methods moved to ThinkingManager

}

// Global function to open external links
window.openExternalLink = async function (url) {
    try {
        if (window.electronAPI && window.electronAPI.openExternal) {
            // Try Electron API first
            const result = await window.electronAPI.openExternal(url);
            if (result.success) {
                console.log('Link opened successfully via Electron');
                return;
            }
        }

        // Fallback to window.open for web browsers or if Electron fails
        window.open(url, '_blank', 'noopener,noreferrer');
        console.log('Link opened via window.open fallback');
    } catch (error) {
        console.error('Error opening external link:', error);
        // Last resort fallback
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

// ─── Apply extracted module mixins ──────────────────────────────────────────
// Each module defines a plain object whose methods are wired into
// OpenChat.prototype here, BEFORE DOMContentLoaded instantiates the app.
if (typeof SettingsMethods !== 'undefined') Object.assign(OpenChat.prototype, SettingsMethods);
if (typeof SidebarMethods !== 'undefined') Object.assign(OpenChat.prototype, SidebarMethods);
if (typeof ChatUIMethods !== 'undefined') Object.assign(OpenChat.prototype, ChatUIMethods);
if (typeof ArchitectMethods !== 'undefined') Object.assign(OpenChat.prototype, ArchitectMethods);
if (typeof ThemeMethods !== 'undefined') Object.assign(OpenChat.prototype, ThemeMethods);
if (typeof MemoryMethods !== 'undefined') Object.assign(OpenChat.prototype, MemoryMethods);
if (typeof VoiceMethods !== 'undefined') Object.assign(OpenChat.prototype, VoiceMethods);
if (typeof ThinkingMethods !== 'undefined') Object.assign(OpenChat.prototype, ThinkingMethods);

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, inicializando OpenChat');
    window.openchat = new OpenChat();
});