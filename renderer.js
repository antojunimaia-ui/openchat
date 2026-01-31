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
            pinnedChats: [] // Array de IDs de chats fixados
        };
        this.init();
        this.setupTitlebarControls();
    }

    init() {
        this.loadSystemPrompt().then(() => {
            this.loadSettings();
            this.setupEventListeners();
            this.setupStreamingListener();
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

    handleVoiceInput() {
        // Placeholder for voice input functionality
        console.log('Voice input clicked');
        this.showNotification('Funcionalidade de voz em desenvolvimento');
    }

    addMessage(text, type = 'user', image = null, memoryAction = null) {
        console.log('📝 addMessage called:', { type, text: text.substring(0, 50), isThinking: this.isThinking, hasThinkingWrapper: !!this.currentThinkingWrapper });

        const message = {
            id: Date.now(),
            text,
            type,
            image,
            timestamp: new Date(), // Sempre criar um novo objeto Date
            memoryAction: memoryAction, // 'saved' or 'updated'
            alreadyRendered: false // Track if message is already in DOM
        };

        this.messages.push(message);

        // Handle rendering based on current state
        if (this.currentThinkingWrapper) {
            console.log('🧠 In thinking mode, handling message type:', type);
            // We're in thinking mode - be very careful about rendering
            if (type === 'user') {
                // Add user message manually during thinking without affecting thinking window
                console.log('👤 Adding user message during thinking');
                this.renderSingleMessage(message);
                message.alreadyRendered = true; // Mark as already rendered
            }
            // Bot messages during thinking are handled by the thinking system
            // Don't call renderMessages() during thinking to avoid DOM interference
        } else {
            console.log('💬 Normal mode - calling renderMessages');
            // Normal mode - render all messages
            this.renderMessages();
        }

        // Auto-save chat after adding message (but not system messages)
        if (type !== 'system') {
            // Create chat ID if this is the first user message
            if (!this.currentChatId && type === 'user') {
                this.currentChatId = 'chat-' + Date.now();
            }

            // Save after a short delay to batch multiple rapid messages
            // Mark that we have new content that needs timestamp update
            this.hasNewContent = true;
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                this.saveCurrentChat();
            }, 1000);
        }
    }

    addBotResponse(userMessageData) {
        // Enhanced responses based on conversation context and user message
        const personality = this.settings.personality;
        let response = 'Obrigado pela sua mensagem! Como posso ajudar você hoje?';

        const userText = userMessageData.text ? userMessageData.text.toLowerCase() : '';
        const hasHistory = userMessageData.conversationHistory && userMessageData.conversationHistory.length > 0;

        // Apply personal o base response
        if (personality.type === 'casual') {
            response = 'E aí, cara! Valeu pela mensagem! Em que posso te ajudar?';
        } else if (personality.type === 'spicy') {
            response = 'Opa, que delícia receber sua mensagem... 😏 Como posso te satisfazer hoje? 😉';
        } else if (personality.type === 'enthusiastic') {
            response = 'Opa! Que massa receber sua mensagem! 🔥 Tô aqui prontinho pra te ajudar! Como posso fazer sua vida melhor hoje?!';
        }

        // Context-aware responses
        if (hasHistory) {
            const lastBotMessage = userMessageData.conversationHistory
                .filter(msg => msg.type === 'bot')
                .slice(-1)[0];

            if (lastBotMessage) {
                if (personality.type === 'casual') {
                    response = 'E aí de novo, mano! Continuando nosso papo... ';
                } else if (personality.type === 'spicy') {
                    response = 'Mmm, voltou pra mais... que bom! 😈 ';
                } else {
                    response = 'Continuando nossa conversa... ';
                }
            }
        }

        // Tool-specific responses
        if (userMessageData.tool) {
            const toolInfo = this.getToolInfo(userMessageData.tool);
            response = `Usando a ferramenta ${toolInfo.shortName}: ${response}`;
        }

        // Image responses
        if (userMessageData.image) {
            if (personality.type === 'spicy') {
                response = 'Opa, que foto interessante você me mandou... 😏 ' + response;
            } else if (personality.type === 'casual') {
                response = 'Véi, vi a imagem que cê mandou! ' + response;
            } else {
                response = 'Vejo que você enviou uma imagem! ' + response;
            }
        }

        // Apply profanity if enabled
        if (personality.allowProfanity && userText.includes('teste')) {
            if (personality.type === 'casual') {
                response = 'Porra, que teste foda! ' + response;
            } else {
                response = 'Caralho, que teste maneiro! ' + response;
            }
        }

        // Apply emojis if enabled
        if (personality.useEmojis) {
            if (personality.type === 'spicy') {
                response += ' 😘';
            } else if (personality.type === 'enthusiastic') {
                response += ' 🚀✨';
            } else {
                response += ' 😊';
            }
        }

        // Content-based responses with personality
        if (userText.includes('olá') || userText.includes('oi')) {
            if (personality.type === 'casual') {
                response = hasHistory ? 'E aí de novo, cara! Beleza?' : 'Salve, mano! Bem-vindo ao OpenChat. Tá precisando de que?';
            } else if (personality.type === 'spicy') {
                response = hasHistory ? 'Oi de novo, gostoso... 😏' : 'Oi, lindeza! Bem-vindo ao OpenChat... que prazer te ter aqui 😉';
            } else {
                response = hasHistory ? 'Olá novamente! Como posso continuar ajudando você?' : 'Olá! Bem-vindo ao OpenChat. Como posso ajudar você?';
            }
        } else if (userText.includes('ajuda')) {
            if (personality.type === 'casual') {
                response = 'Tô aqui pra isso mesmo, cara! Manda ver com as ferramentas ou me pergunta qualquer coisa!';
            } else if (personality.type === 'spicy') {
                response = 'Claro que vou te ajudar, amor... posso fazer muito por você 😈 Me diz o que você quer...';
            } else {
                response = 'Estou aqui para ajudar! Você pode usar as ferramentas disponíveis ou me fazer qualquer pergunta.';
            }
        }

        this.addMessage(response, 'bot');
    }

    renderSingleMessage(message) {
        let messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) {
            messagesContainer = document.createElement('div');
            messagesContainer.className = 'messages-container';
            document.querySelector('.main-content').appendChild(messagesContainer);
        }

        // Hide welcome message if it exists
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) welcomeMessage.style.display = 'none';

        let messageContent = '';
        if (message.type === 'bot') {
            messageContent = this.formatBotMessage(message.text);
        } else {
            messageContent = `<p>${message.text}</p>`;
        }

        // Add memory indicator if present
        let memoryIndicator = '';
        if (message.memoryAction === 'saved') {
            memoryIndicator = '<div class="memory-indicator">Memória salva</div>';
        } else if (message.memoryAction === 'updated') {
            memoryIndicator = '<div class="memory-indicator">Memória atualizada</div>';
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.type}`;
        messageElement.setAttribute('data-message-id', message.id); // Add message ID
        messageElement.innerHTML = `
            ${memoryIndicator}
            <div class="message-content">
                ${message.image ? `<img src="${message.image}" alt="Sent image" class="message-image">` : ''}
                ${messageContent}
            </div>
        `;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    renderMessages() {
        // Control welcome message visibility
        const welcomeMessage = document.querySelector('.welcome-message');

        if (this.messages.length === 0) {
            // Show welcome content when no messages
            if (welcomeMessage) welcomeMessage.style.display = 'block';

            // Clear any existing messages container
            const existingContainer = document.querySelector('.messages-container');
            if (existingContainer) {
                existingContainer.remove();
            }
            return;
        }

        // Hide welcome content when there are messages
        if (welcomeMessage) welcomeMessage.style.display = 'none';

        let messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) {
            messagesContainer = document.createElement('div');
            messagesContainer.className = 'messages-container';
            document.querySelector('.main-content').appendChild(messagesContainer);
        }

        // Preserve existing thinking windows
        const existingThinkingWindows = messagesContainer.querySelectorAll('.thinking-message');
        const thinkingElements = Array.from(existingThinkingWindows);

        // Get IDs of messages already rendered (both in thinking windows and regular messages)
        const existingMessageIds = new Set();

        // Collect IDs from regular messages already in DOM
        messagesContainer.querySelectorAll('.message:not(.thinking-message)').forEach(msgElement => {
            const msgId = msgElement.getAttribute('data-message-id');
            if (msgId) existingMessageIds.add(msgId);
        });

        // Filter out messages that are already rendered (either in thinking windows or as regular messages)
        const messagesToRender = this.messages.filter(msg => {
            // Skip if part of thinking window
            if (msg.isPartOfThinking) return false;

            // Skip if already rendered as regular message
            if (existingMessageIds.has(String(msg.id))) return false;

            return true;
        });

        console.log('📊 Total messages:', this.messages.length);
        console.log('🧠 Messages in thinking:', this.messages.filter(m => m.isPartOfThinking).length);
        console.log('✅ Already rendered:', existingMessageIds.size);
        console.log('🆕 New messages to render:', messagesToRender.length);

        const regularMessagesHTML = messagesToRender.map(msg => {
            let messageContent = '';
            if (msg.type === 'bot') {
                // Use rich formatting for bot messages
                messageContent = this.formatBotMessage(msg.text);
                if (msg.streaming) {
                    messageContent += '<span class="streaming-cursor"></span>';
                }
            } else {
                // Plain text for user and system messages
                messageContent = `<p>${msg.text}</p>`;
            }

            // Add streaming attribute for bot messages that are streaming
            const streamingAttr = (msg.type === 'bot' && msg.streaming) ? ' data-streaming="true"' : '';

            // Add memory indicator if present
            let memoryIndicator = '';
            if (msg.memoryAction === 'saved') {
                memoryIndicator = '<div class="memory-indicator">Memória salva</div>';
            } else if (msg.memoryAction === 'updated') {
                memoryIndicator = '<div class="memory-indicator">Memória atualizada</div>';
            }

            return `
                <div class="message ${msg.type}" data-message-id="${msg.id}"${streamingAttr}>
                    ${memoryIndicator}
                    <div class="message-content">
                        ${msg.image ? `<img src="${msg.image}" alt="Sent image" class="message-image">` : ''}
                        ${messageContent}
                    </div>
                </div>
            `;
        }).join('');

        // Only add new messages, don't remove existing ones
        if (regularMessagesHTML) {
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = regularMessagesHTML;

            // Add new messages
            Array.from(tempContainer.children).forEach(child => {
                messagesContainer.appendChild(child);
            });
        }

        console.log('📊 Messages after render:', messagesContainer.children.length);
        console.log('🧠 Thinking windows preserved:', messagesContainer.querySelectorAll('.thinking-message').length);

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    formatTime(date) {
        // Garantir que temos um objeto Date válido
        const dateObj = date instanceof Date ? date : new Date(date);

        // Verificar se a data é válida
        if (isNaN(dateObj.getTime())) {
            return new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        return dateObj.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async loadMessages() {
        // Load welcome message if no current chat
        if (!this.currentChatId) {
            this.messages = [];
            this.renderMessages();
        }
    }

    showError(message) {
        console.error(message);
    }

    showNotification(message) {
        // Simple notification - you can enhance this
        console.log('Notification:', message);
    }

    showTypingIndicator() {
        // Remove existing typing indicator
        this.hideTypingIndicator();

        let messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) {
            messagesContainer = document.createElement('div');
            messagesContainer.className = 'messages-container';
            document.querySelector('.main-content').appendChild(messagesContainer);
        }

        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message bot typing-message';
        typingIndicator.id = 'typingIndicator';
        typingIndicator.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>
        `;

        messagesContainer.appendChild(typingIndicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // Thinking Process Methods
    async startThinkingProcess(messageData) {
        console.log('🧠 Iniciando processo de pensamento...');
        console.log('📊 Messages container children before thinking:', document.querySelector('.messages-container')?.children.length);
        console.log('🧠 Existing thinking windows:', document.querySelectorAll('.thinking-message').length);

        // CRITICAL: If there's an existing thinking process, just clear the references
        // DON'T remove the previous thinking window from DOM
        if (this.currentThinkingWrapper) {
            console.log('⚠️ Clearing thinking references (keeping previous window in DOM)');
            this.currentThinkingWrapper = null;
            this.currentThinkingId = null;
            this.isThinking = false;
        }

        // Create thinking window FIRST and wait for it to be ready
        this.createThinkingWindow();

        console.log('📊 Messages container children after creating thinking window:', document.querySelector('.messages-container')?.children.length);

        // Verify the window was created properly
        if (!this.currentThinkingId || !this.currentThinkingWrapper) {
            console.error('❌ Failed to create thinking window');
            return;
        }

        console.log('✅ Thinking window created successfully with ID:', this.currentThinkingId);

        // Wait longer to ensure DOM is fully updated
        await new Promise(resolve => setTimeout(resolve, 200));

        // Triple-check the element exists and is in the right place
        const testElement = document.getElementById(`${this.currentThinkingId}-text`);
        const isInWrapper = this.currentThinkingWrapper.contains(testElement);

        console.log('🔍 Element verification:');
        console.log('  - Element exists:', !!testElement);
        console.log('  - Element in wrapper:', isInWrapper);
        console.log('  - Wrapper class:', this.currentThinkingWrapper.className);

        if (!testElement || !isInWrapper) {
            console.error('❌ Element verification failed, aborting thinking process');
            this.cancelThinking();
            return;
        }

        // Generate thinking prompt
        const thinkingPrompt = this.generateThinkingPrompt(messageData.text);

        // Start thinking phase
        await this.performThinking(thinkingPrompt, messageData);
    }

    createThinkingWindow() {
        console.log('🏗️ Creating thinking window...');

        // Record start time for duration calculation
        this.thinkingStartTime = Date.now();

        // Generate EXTREMELY unique ID
        const thinkingId = 'thinking-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        console.log('🆔 Generated unique ID:', thinkingId);

        // Get messages container
        let messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) {
            messagesContainer = document.createElement('div');
            messagesContainer.className = 'messages-container';
            document.querySelector('.main-content').appendChild(messagesContainer);
        }

        console.log('📦 Messages container found/created');

        // Create a completely new wrapper div
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message bot thinking-message';
        messageWrapper.style.alignItems = 'flex-start';
        messageWrapper.style.width = '100%';
        messageWrapper.style.maxWidth = '700px';
        messageWrapper.style.margin = '0 auto';
        messageWrapper.setAttribute('data-thinking-id', thinkingId);
        messageWrapper.setAttribute('data-created-at', Date.now());

        // Create the thinking window HTML as a string first
        const thinkingWindowHTML = `
            <div class="thinking-window">
                <div class="thinking-header" id="${thinkingId}-header">
                    <div class="thinking-status" id="${thinkingId}-status">Thinking</div>
                    <div class="thinking-toggle" id="${thinkingId}-toggle">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6,9 12,15 18,9"></polyline>
                        </svg>
                    </div>
                </div>
                <div class="thinking-content" id="${thinkingId}-content">
                    <div class="thinking-text" id="${thinkingId}-text"></div>
                </div>
            </div>
        `;

        // Set the HTML
        messageWrapper.innerHTML = thinkingWindowHTML;

        // Append to container
        messagesContainer.appendChild(messageWrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        console.log('✅ Wrapper added to DOM');

        // Store references
        this.currentThinkingWrapper = messageWrapper;
        this.currentThinkingId = thinkingId;

        // Force DOM update and verify
        messageWrapper.offsetHeight;

        // Verify all elements were created correctly
        const textElement = document.getElementById(`${thinkingId}-text`);
        const statusElement = document.getElementById(`${thinkingId}-status`);
        const headerElement = document.getElementById(`${thinkingId}-header`);

        console.log('🔍 Element verification:');
        console.log('  - Text element:', !!textElement);
        console.log('  - Status element:', !!statusElement);
        console.log('  - Header element:', !!headerElement);
        console.log('  - Text in wrapper:', messageWrapper.contains(textElement));
        console.log('  - Wrapper in DOM:', document.body.contains(messageWrapper));

        if (!textElement || !statusElement || !messageWrapper.contains(textElement)) {
            console.error('❌ CRITICAL: Elements not properly created!');
            return false;
        }

        // Setup toggle functionality
        if (headerElement) {
            const toggle = document.getElementById(`${thinkingId}-toggle`);
            const content = document.getElementById(`${thinkingId}-content`);

            if (toggle && content) {
                headerElement.addEventListener('click', () => {
                    const isCollapsed = content.classList.contains('collapsed');
                    if (isCollapsed) {
                        content.classList.remove('collapsed');
                        toggle.classList.remove('collapsed');
                    } else {
                        content.classList.add('collapsed');
                        toggle.classList.add('collapsed');
                    }
                });
            }
        }

        console.log('✅ Thinking window created successfully');
        return true;
    }

    generateThinkingPrompt(userMessage) {
        return `Você precisa analisar profundamente a mensagem do usuário antes de responder. Faça um Chain of Thought (CoT) detalhado pensando em primeira pessoa.

MENSAGEM DO USUÁRIO: "${userMessage}"

PROCESSO DE PENSAMENTO (pense em voz alta, seja específico):

1. ANÁLISE INICIAL:
- "Hmm, deixe-me entender o que o usuário realmente está perguntando..."
- "A pergunta parece ser sobre X, mas talvez haja uma intenção mais profunda..."
- "Preciso considerar se há contexto implícito aqui..."

2. DECOMPOSIÇÃO DO PROBLEMA:
- "Posso quebrar essa questão em várias partes..."
- "Na verdade, isso envolve conceitos como A, B e C..."
- "Há diferentes ângulos para abordar isso..."

3. CONHECIMENTO E CONEXÕES:
- "Isso me lembra de conceitos relacionados como..."
- "É importante mencionar que..."
- "Uma coisa que muitas pessoas não consideram é..."

4. POSSÍVEIS INTERPRETAÇÕES:
- "O usuário pode estar se referindo a..."
- "Alternativamente, talvez ele queira saber sobre..."
- "Preciso esclarecer se ele está falando de X ou Y..."

5. ESTRUTURA DA RESPOSTA:
- "Vou organizar minha resposta começando com..."
- "Seria útil dar um exemplo de..."
- "Preciso explicar primeiro A, depois B, e finalmente C..."

6. VERIFICAÇÃO FINAL:
- "Isso realmente responde à pergunta?"
- "Estou sendo claro o suficiente?"
- "Há algo crucial que estou esquecendo?"

EXEMPLO DE PENSAMENTO NATURAL:
"Hmm, essa pergunta é interessante porque... Na verdade, preciso considerar que... Isso me faz pensar em... Deixe-me estruturar isso de forma que faça sentido... Primeiro vou explicar... depois vou dar um exemplo... e finalmente vou mencionar..."

INSTRUÇÕES:
- Seja específico sobre o que está analisando
- Use linguagem natural e conversacional
- Identifique ambiguidades e como resolvê-las
- Planeje exemplos concretos se necessário
- Considere o nível de conhecimento do usuário
- Pense em possíveis perguntas de follow-up

IMPORTANTE: Responda APENAS com seu processo de pensamento detalhado e natural, não com a resposta final.`;
    }

    async performThinking(thinkingPrompt, originalMessageData) {
        try {
            console.log('performThinking started, currentThinkingId:', this.currentThinkingId);

            // CRITICAL: Disable streaming listeners during thinking to prevent interference
            this.isThinking = true;

            // Create thinking message data with optimized settings for reasoning
            const thinkingMessageData = {
                text: thinkingPrompt,
                tool: null,
                image: null,
                conversationHistory: originalMessageData.conversationHistory, // Include context for better thinking
                personalityPrompt: `Você é um assistente que faz análises profundas e reflexivas. Pense de forma estruturada e metódica, mas mantenha um tom natural e conversacional em seu monólogo interno. Use expressões como "hmm", "deixe-me pensar", "na verdade", "isso é interessante porque", "preciso considerar", etc. Seja minucioso e considere múltiplas perspectivas.`
            };

            // Send thinking request
            if (window.electronAPI && window.electronAPI.sendMessage) {
                const result = await window.electronAPI.sendMessage(thinkingMessageData);

                if (result.success) {
                    console.log('Thinking response received, about to stream to ID:', this.currentThinkingId);

                    // Stream the thinking process
                    await this.streamThinkingText(result.response);

                    // Finish thinking and start actual response
                    console.log('About to call finishThinking');
                    this.finishThinking();
                    console.log('finishThinking called');

                    // Re-enable streaming listeners
                    this.isThinking = false;

                    // Add a small delay to make the transition feel more natural
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // Now send the actual message with thinking context
                    await this.sendActualResponse(originalMessageData, result.response);
                } else {
                    this.isThinking = false; // Re-enable on error
                    this.cancelThinking();
                    this.addMessage(`❌ Erro no processo de pensamento: ${result.error}`, 'system');
                }
            }
        } catch (error) {
            console.error('Erro no processo de pensamento:', error);
            this.isThinking = false; // Re-enable on error
            this.cancelThinking();
            this.addMessage(`❌ Erro no processo de pensamento: ${error.message}`, 'system');
        }
    }

    async streamThinkingText(thinkingText) {
        console.log('🎬 Starting thinking text stream...');

        if (!this.currentThinkingId || !this.currentThinkingWrapper) {
            console.error('❌ No thinking context available');
            return;
        }

        // Store a direct reference to the text element to avoid DOM queries
        const thinkingTextElement = this.currentThinkingWrapper.querySelector('.thinking-text');

        if (!thinkingTextElement) {
            console.error('❌ Text element not found in wrapper');
            console.log('Wrapper contents:', this.currentThinkingWrapper.innerHTML);
            return;
        }

        console.log('✅ Found text element in wrapper');
        console.log('Element tag:', thinkingTextElement.tagName);
        console.log('Element class:', thinkingTextElement.className);

        // Clear any existing content
        thinkingTextElement.innerHTML = '';
        thinkingTextElement.textContent = '';

        console.log('🚀 Starting text streaming...');

        // Stream text word by word
        const words = thinkingText.split(' ');
        let currentText = '';

        for (let i = 0; i < words.length; i++) {
            // Use the stored element reference instead of querying DOM
            if (!thinkingTextElement.isConnected) {
                console.error('❌ Element disconnected from DOM at word', i);
                break;
            }

            currentText += (i > 0 ? ' ' : '') + words[i];
            thinkingTextElement.textContent = currentText;

            // Add cursor
            thinkingTextElement.innerHTML = currentText + '<span class="thinking-cursor"></span>';

            // Scroll to bottom
            const thinkingContent = this.currentThinkingWrapper.querySelector('.thinking-content');
            if (thinkingContent) {
                thinkingContent.scrollTop = thinkingContent.scrollHeight;
            }

            // Delay
            await new Promise(resolve => setTimeout(resolve, 30));
        }

        // Remove cursor after streaming
        if (thinkingTextElement.isConnected) {
            thinkingTextElement.innerHTML = currentText;
            console.log('✅ Thinking text streaming completed');
        }
    }

    finishThinking() {
        console.log('finishThinking called');

        if (!this.currentThinkingWrapper) {
            console.error('❌ No thinking wrapper available');
            return;
        }

        // Update status using wrapper reference instead of document query
        const thinkingStatus = this.currentThinkingWrapper.querySelector('.thinking-status');

        if (thinkingStatus) {
            const elapsed = Math.floor((Date.now() - this.thinkingStartTime) / 1000);
            const newText = `Thought for ${elapsed}s`;

            console.log('Updating thinking status to:', newText);

            // Clear any existing styles that might interfere
            thinkingStatus.style.background = '';
            thinkingStatus.style.backgroundClip = '';
            thinkingStatus.style.webkitBackgroundClip = '';
            thinkingStatus.style.webkitTextFillColor = '';
            thinkingStatus.style.animation = '';

            // Update text and add completed class
            thinkingStatus.textContent = newText;
            thinkingStatus.classList.add('completed');

            console.log('Thinking status updated, current text:', thinkingStatus.textContent);
        } else {
            console.error('thinkingStatus element not found in wrapper');
        }

        // Keep the thinking window visible and expanded for the user to review
        // Don't auto-collapse anymore

        // DON'T clear the thinking references yet - we need them for the response
        // They will be cleared when a new thinking process starts or when explicitly cancelled
    }

    cancelThinking(removeFromDOM = true) {
        // Re-enable streaming
        this.isThinking = false;

        // Only remove from DOM if explicitly requested
        if (removeFromDOM) {
            const thinkingWindow = document.querySelector('.thinking-window');
            if (thinkingWindow) {
                const wrapper = thinkingWindow.closest('.message.bot');
                if (wrapper) {
                    wrapper.remove();
                } else {
                    thinkingWindow.remove();
                }
            }
        }

        // Always clear references
        this.currentThinkingWrapper = null;
        this.currentThinkingId = null;
    }

    async sendActualResponse(originalMessageData, thinkingContext) {
        // Create a more sophisticated prompt that uses the thinking context
        const enhancedSystemPrompt = `Você acabou de fazer uma análise detalhada da pergunta do usuário. Use os insights dessa análise para dar uma resposta excepcional.

ANÁLISE PRÉVIA (use internamente, não mencione que você pensou):
${thinkingContext}

INSTRUÇÕES PARA A RESPOSTA:
1. Use os insights da sua análise para estruturar uma resposta completa e bem organizada
2. Aborde todos os pontos importantes identificados na análise
3. Seja claro, direto e útil
4. Se identificou ambiguidades na análise, esclareça-as na resposta
5. Use a estrutura que planejou durante o pensamento
6. Inclua exemplos ou analogias se identificou que seriam úteis
7. NUNCA mencione que você fez uma análise prévia ou pensou sobre a pergunta

Responda de forma natural, como se fosse sua primeira interação com a pergunta, mas usando toda a profundidade da sua análise prévia.`;

        // Add enhanced system prompt to the message
        const enhancedMessageData = {
            ...originalMessageData,
            thinkingContext: thinkingContext,
            personalityPrompt: originalMessageData.personalityPrompt + '\n\n' + enhancedSystemPrompt
        };

        // Check if using streaming
        const isStreaming = this.settings.activeModel === 'mistral' || this.settings.activeModel === 'zai';

        if (isStreaming) {
            this.startStreamingResponseWithThinking();
        } else {
            this.showTypingIndicatorWithThinking();
        }

        // Send enhanced message
        if (window.electronAPI && window.electronAPI.sendMessage) {
            const result = await window.electronAPI.sendMessage(enhancedMessageData);

            if (!isStreaming) {
                this.hideTypingIndicator();
            }

            if (result.success) {
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
                    this.addResponseToThinkingMessage(result.response, memoryAction);
                } else {
                    if (memoryAction && this.currentStreamingMessage) {
                        this.currentStreamingMessage.memoryAction = memoryAction;
                    }
                }
            } else {
                this.addMessage(`❌ Erro: ${result.error}`, 'system');
                if (isStreaming) {
                    this.cancelStreamingResponse();
                }
            }
        }
    }

    addResponseToThinkingMessage(responseText, memoryAction = null) {
        if (!this.currentThinkingWrapper) return;

        // Re-enable streaming now that thinking is complete
        this.isThinking = false;

        // Create the bot message and add to messages array
        const botMessage = {
            id: Date.now(),
            text: responseText,
            type: 'bot',
            timestamp: new Date(),
            memoryAction: memoryAction,
            isPartOfThinking: true // Mark this message as part of thinking window
        };

        this.messages.push(botMessage);

        // Create response content div
        const responseDiv = document.createElement('div');
        responseDiv.className = 'message-content';
        responseDiv.style.marginTop = '16px';

        // Add memory indicator if present
        if (memoryAction) {
            const memoryIndicator = document.createElement('div');
            memoryIndicator.className = 'memory-indicator';
            memoryIndicator.textContent = memoryAction === 'saved' ? 'Memória salva' : 'Memória atualizada';
            responseDiv.appendChild(memoryIndicator);
        }

        // Format and add the response
        const formattedResponse = this.formatBotMessage(responseText);
        responseDiv.innerHTML += formattedResponse;

        // Add to the thinking message wrapper
        this.currentThinkingWrapper.appendChild(responseDiv);

        // Scroll to bottom
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Clear the references - thinking is complete
        this.currentThinkingWrapper = null;
        this.currentThinkingId = null;
        this.currentStreamingMessage = null;
    }

    showTypingIndicatorWithThinking() {
        if (!this.currentThinkingWrapper) return;

        // Add typing indicator to the thinking message
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.id = 'typingIndicator';
        typingIndicator.style.marginTop = '16px';
        typingIndicator.innerHTML = `
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

        this.currentThinkingWrapper.appendChild(typingIndicator);

        // Scroll to bottom
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    startStreamingResponseWithThinking() {
        if (!this.currentThinkingWrapper) return;

        // Create streaming message content in the thinking wrapper
        const responseDiv = document.createElement('div');
        responseDiv.className = 'message-content';
        responseDiv.style.marginTop = '16px';
        responseDiv.setAttribute('data-streaming', 'true');

        this.currentThinkingWrapper.appendChild(responseDiv);

        // Create streaming message object
        const message = {
            id: Date.now(),
            text: '',
            type: 'bot',
            timestamp: new Date(),
            streaming: true,
            isPartOfThinking: true, // Mark as part of thinking
            element: responseDiv // Store reference to the element
        };

        this.currentStreamingMessage = message;
        this.messages.push(message); // Add to messages array

        // Scroll to bottom
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Streaming methods
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
    }

    startStreamingResponse() {
        // Create streaming message
        const message = {
            id: Date.now(),
            text: '',
            type: 'bot',
            timestamp: new Date(),
            streaming: true
        };

        this.currentStreamingMessage = message;
        this.messages.push(message);

        // Only render messages if we're not in a thinking process
        if (!this.currentThinkingWrapper) {
            this.renderMessages();
        }
    }

    updateStreamingMessage(content) {
        // CRITICAL: Ignore streaming updates during thinking process
        if (this.isThinking) {
            console.log('🚫 Ignoring streaming update during thinking process');
            return;
        }

        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.text += content;

            // Update the streaming element directly if it exists
            if (this.currentStreamingMessage.element) {
                const text = this.currentStreamingMessage.text;
                const formattedContent = this.formatBotMessageStreaming(text);
                this.currentStreamingMessage.element.innerHTML = formattedContent;

                // Auto-scroll to bottom
                const messagesContainer = document.querySelector('.messages-container');
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            } else {
                // Fallback to the original method
                this.updateStreamingMessageElement();
            }
        }
    }

    updateStreamingMessageElement() {
        if (!this.currentStreamingMessage) return;

        // Find the streaming message element
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;

        const streamingElements = messagesContainer.querySelectorAll('.message.bot[data-streaming="true"]');
        const streamingElement = streamingElements[streamingElements.length - 1]; // Get the last one

        if (streamingElement) {
            const messageContent = streamingElement.querySelector('.message-content');
            if (messageContent) {
                // Apply rich formatting in real-time during streaming
                const text = this.currentStreamingMessage.text;
                const formattedContent = this.formatBotMessageStreaming(text);

                // No cursor, just the content with fade-in effect
                messageContent.innerHTML = formattedContent;

                // Auto-scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
    }

    // Optimized formatting for streaming - handles partial content gracefully
    formatBotMessageStreaming(text) {
        if (!text) return '';

        // Remove function calls completas (com tag de fechamento)
        text = text.replace(/\[FUNCTION_CALL\]\s*[\s\S]*?\s*\[\/FUNCTION_CALL\]/gi, '');

        // Remove function calls incompletas (ainda sendo escritas durante streaming)
        // Isso esconde o conteúdo desde o momento que [FUNCTION_CALL] aparece
        text = text.replace(/\[FUNCTION_CALL\][\s\S]*$/gi, '');

        text = text.trim();

        // Apply formatting but handle incomplete markdown gracefully
        let formatted = text
            // Complete code blocks only (avoid breaking incomplete ones)
            .replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
                const lang = language || 'text';
                const codeId = 'ace-editor-' + Math.random().toString(36).substr(2, 9);
                const cleanCode = this.escapeHtml(code.trim());

                // Queue Ace Editor initialization for after DOM update
                setTimeout(() => this.initializeAceEditor(codeId, lang, code.trim()), 10);

                return `<div class="ace-code-block-container">
                    <div class="ace-editor-wrapper">
                        <div id="${codeId}" class="ace-editor-instance">${cleanCode}</div>
                    </div>
                </div>`;
            })
            // Inline code (only complete backticks)
            .replace(/`([^`\n]+)`/g, '<code>$1</code>')
            // Bold text (only complete pairs)
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
            // Italic text (only complete pairs)
            .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        // Handle lists (only complete lines)
        formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>');

        formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ol>$1</ol>');

        // Clean up multiple consecutive ul/ol tags
        formatted = formatted.replace(/<\/ul>\s*<ul>/g, '');
        formatted = formatted.replace(/<\/ol>\s*<ol>/g, '');

        // Wrap in paragraphs if not already wrapped
        if (!formatted.startsWith('<')) {
            formatted = '<p>' + formatted + '</p>';
        }

        // Clean up empty paragraphs
        formatted = formatted.replace(/<p><\/p>/g, '');
        formatted = formatted.replace(/<p>\s*<\/p>/g, '');

        return formatted;
    }

    // Initialize Ace Editor for code blocks
    initializeAceEditor(editorId, language, code) {
        const editorElement = document.getElementById(editorId);
        if (!editorElement || editorElement.aceEditor) return; // Already initialized

        try {
            // Calculate appropriate height based on content
            const lineCount = (code.match(/\n/g) || []).length + 1;
            const lineHeight = 20; // Approximate line height in pixels
            const minHeight = 60;
            const maxHeight = 400;
            const calculatedHeight = Math.min(Math.max(lineCount * lineHeight + 20, minHeight), maxHeight);

            // Ensure the element has proper dimensions before initializing
            editorElement.style.height = calculatedHeight + 'px';
            editorElement.style.width = '100%';

            const editor = ace.edit(editorId);

            // Configure editor
            editor.setTheme("ace/theme/github_dark");
            editor.setReadOnly(true);
            editor.setHighlightActiveLine(false);
            editor.setShowPrintMargin(false);
            editor.renderer.setShowGutter(true);
            editor.renderer.setScrollMargin(8, 8, 0, 0);

            // Set language mode
            const modeMap = {
                'javascript': 'ace/mode/javascript',
                'js': 'ace/mode/javascript',
                'python': 'ace/mode/python',
                'py': 'ace/mode/python',
                'html': 'ace/mode/html',
                'css': 'ace/mode/css',
                'json': 'ace/mode/json',
                'sql': 'ace/mode/sql',
                'xml': 'ace/mode/xml',
                'markdown': 'ace/mode/markdown',
                'md': 'ace/mode/markdown',
                'bash': 'ace/mode/sh',
                'shell': 'ace/mode/sh',
                'text': 'ace/mode/text'
            };

            const mode = modeMap[language.toLowerCase()] || 'ace/mode/text';
            editor.session.setMode(mode);

            // Set content
            editor.setValue(code, -1);

            // Configure auto-resize based on content
            const actualLineCount = editor.session.getLength();
            const maxLines = Math.min(actualLineCount, 25); // Max 25 lines visible
            const minLines = Math.max(actualLineCount, 2);  // Min 2 lines

            editor.setOptions({
                maxLines: maxLines,
                minLines: minLines,
                fontSize: 14,
                fontFamily: 'Fira Code, Monaco, Menlo, monospace',
                wrap: false,
                showFoldWidgets: false,
                fadeFoldWidgets: false
            });

            // Force resize after initialization
            setTimeout(() => {
                editor.resize(true);
                editor.renderer.updateFull();
            }, 50);

            // Store reference for later use
            editorElement.aceEditor = editor;

        } catch (error) {
            console.error('Error initializing Ace Editor:', error);
            // Fallback to simple pre/code if Ace fails
            editorElement.innerHTML = `<pre><code>${this.escapeHtml(code)}</code></pre>`;
        }
    }

    // Copy code from Ace Editor
    finishStreamingResponse(memoryAction = null) {
        // Re-enable streaming for future messages
        this.isThinking = false;

        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.streaming = false;
            if (memoryAction) {
                this.currentStreamingMessage.memoryAction = memoryAction;
            }

            // If using thinking system, add memory indicator to the element
            if (this.currentStreamingMessage.element && memoryAction) {
                const memoryIndicator = document.createElement('div');
                memoryIndicator.className = 'memory-indicator';
                memoryIndicator.textContent = memoryAction === 'saved' ? 'Memória salva' : 'Memória atualizada';
                this.currentStreamingMessage.element.insertBefore(memoryIndicator, this.currentStreamingMessage.element.firstChild);
            }

            // Remove streaming attribute from element if it exists
            if (this.currentStreamingMessage.element) {
                this.currentStreamingMessage.element.removeAttribute('data-streaming');
            } else {
                // Fallback to original method for regular messages
                const messagesContainer = document.querySelector('.messages-container');
                if (messagesContainer) {
                    const streamingElements = messagesContainer.querySelectorAll('.message.bot[data-streaming="true"]');

                    streamingElements.forEach(streamingElement => {
                        streamingElement.removeAttribute('data-streaming');
                    });

                    if (memoryAction && streamingElements.length > 0) {
                        const lastElement = streamingElements[streamingElements.length - 1];
                        const memoryText = memoryAction === 'saved' ? 'Memória salva' : 'Memória atualizada';
                        const memoryIndicator = document.createElement('div');
                        memoryIndicator.className = 'memory-indicator';
                        memoryIndicator.textContent = memoryText;
                        lastElement.insertBefore(memoryIndicator, lastElement.firstChild);
                    }
                }
            }

            // Don't clear currentStreamingMessage here if it's part of thinking
            // It will be cleared when thinking process completes
            if (!this.currentStreamingMessage.isPartOfThinking) {
                this.currentStreamingMessage = null;
            }

            // Only clear thinking references if not part of thinking
            if (!this.currentStreamingMessage || !this.currentStreamingMessage.isPartOfThinking) {
                this.currentThinkingWrapper = null;
                this.currentThinkingId = null;
            }
        }
    }

    cancelStreamingResponse() {
        if (this.currentStreamingMessage) {
            // Remove the streaming message
            const index = this.messages.indexOf(this.currentStreamingMessage);
            if (index > -1) {
                this.messages.splice(index, 1);
            }
            this.currentStreamingMessage = null;

            // Only render messages if we're not in a thinking process
            if (!this.currentThinkingWrapper) {
                this.renderMessages();
            }
        }
    }

    // Rich text formatting
    formatBotMessage(text) {
        if (!text) return '';

        // Extract and preserve function indicators
        const indicators = [];
        text = text.replace(/<div class="function-indicator (reading-document|writing-document)">[\s\S]*?<\/div>/g, (match) => {
            const placeholder = `__INDICATOR_${indicators.length}__`;
            indicators.push(match);
            return placeholder;
        });

        // Remove function calls completas (com tag de fechamento)
        text = text.replace(/\[FUNCTION_CALL\]\s*[\s\S]*?\s*\[\/FUNCTION_CALL\]/gi, '');

        // Remove function calls incompletas (ainda sendo escritas durante streaming)
        text = text.replace(/\[FUNCTION_CALL\][\s\S]*$/gi, '');

        text = text.trim();

        // Convert markdown-like formatting to HTML
        let formatted = text
            // Code blocks with language support (```language\ncode```)
            .replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
                const lang = language || 'text';
                const codeId = 'ace-editor-' + Math.random().toString(36).substr(2, 9);
                const cleanCode = this.escapeHtml(code.trim());

                // Queue Ace Editor initialization for after DOM update
                setTimeout(() => this.initializeAceEditor(codeId, lang, code.trim()), 10);

                return `<div class="ace-code-block-container">
                    <div class="ace-editor-wrapper">
                        <div id="${codeId}" class="ace-editor-instance">${cleanCode}</div>
                    </div>
                </div>`;
            })
            // Inline code
            .replace(/`([^`\n]+)`/g, '<code>$1</code>')
            // Bold text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic text
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Blockquotes
            .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
            // Line breaks (preserve double line breaks as paragraph breaks)
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        // Handle unordered lists
        formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>');

        // Handle ordered lists
        formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ol>$1</ol>');

        // Clean up multiple consecutive ul/ol tags
        formatted = formatted.replace(/<\/ul>\s*<ul>/g, '');
        formatted = formatted.replace(/<\/ol>\s*<ol>/g, '');

        // Wrap in paragraphs if not already wrapped
        if (!formatted.startsWith('<')) {
            formatted = '<p>' + formatted + '</p>';
        }

        // Clean up empty paragraphs
        formatted = formatted.replace(/<p><\/p>/g, '');
        formatted = formatted.replace(/<p>\s*<\/p>/g, '');

        // Restore function indicators
        indicators.forEach((indicator, index) => {
            formatted = formatted.replace(`__INDICATOR_${index}__`, indicator);
        });

        return formatted;
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Removed sidebar toggle methods - sidebar is now always open

    startNewChat(isArchitectMode = false) {
        // Save current chat if it has messages
        if (this.messages.length > 0 && this.currentChatId) {
            this.saveCurrentChat();
        }

        // Clear current chat
        this.messages = [];
        this.currentChatId = null;
        this.hasNewContent = false; // Reset flag for new chat

        // Set architect mode flag if specified
        if (isArchitectMode) {
            this.currentChatIsArchitect = true;
        } else {
            this.currentChatIsArchitect = false;
        }

        this.renderMessages();

        // Clear input states
        this.clearSelectedTool();
        this.removeImage();

        // Clear input
        const messageInput = document.getElementById('messageInput');
        messageInput.value = '';
        messageInput.style.height = 'auto';
        this.updateSendButton();

        // Reset input to center position
        this.resetInputToCenter();

        // Update active chat in sidebar
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });

        this.showNotification(isArchitectMode ? 'Novo chat Arquiteto iniciado' : 'Novo chat iniciado');
    }

    async loadChat(chatId) {
        try {
            // Save current chat if it has messages
            if (this.messages.length > 0 && this.currentChatId && this.currentChatId !== chatId) {
                await this.saveCurrentChat();
            }

            if (window.electronAPI && window.electronAPI.loadChat) {
                const result = await window.electronAPI.loadChat(chatId);

                if (result.success) {
                    this.currentChatId = chatId;
                    this.messages = result.chat.messages || [];
                    this.hasNewContent = false; // Reset flag when loading existing chat

                    // Check if it's an architect chat
                    if (result.chat.isArchitect) {
                        this.currentChatIsArchitect = true;
                        this.architectDocument = result.chat.architectDocument || '';

                        // Restore architect mode UI if not already active
                        if (!this.architectMode) {
                            this.architectMode = true;

                            // Show architect sidebar
                            const architectSidebar = document.getElementById('architectSidebar');
                            architectSidebar.classList.add('show');

                            // Update document content
                            const documentContent = document.getElementById('architectDocumentContent');
                            documentContent.textContent = this.architectDocument;

                            // Hide main sidebar
                            const mainSidebar = document.getElementById('chatgptSidebar');
                            mainSidebar.classList.add('hidden');

                            // Adjust main content
                            const mainContent = document.querySelector('.main-content');
                            const inputContainer = document.querySelector('.chat-input-container');
                            mainContent.classList.add('architect-mode');
                            inputContainer.classList.add('architect-mode');

                            // Update placeholder
                            const messageInput = document.getElementById('messageInput');
                            messageInput.placeholder = 'Construa sua próxima grande ideia!';

                            // Update sidebar width
                            this.updateArchitectSidebarWidth();
                        }
                    } else {
                        this.currentChatIsArchitect = false;

                        // Exit architect mode if currently active
                        if (this.architectMode) {
                            this.architectMode = false;

                            // Hide architect sidebar
                            const architectSidebar = document.getElementById('architectSidebar');
                            architectSidebar.classList.remove('show');

                            // Show main sidebar
                            const mainSidebar = document.getElementById('chatgptSidebar');
                            mainSidebar.classList.remove('hidden');

                            // Reset main content
                            const mainContent = document.querySelector('.main-content');
                            const inputContainer = document.querySelector('.chat-input-container');
                            mainContent.classList.remove('architect-mode');
                            inputContainer.classList.remove('architect-mode');

                            // IMPORTANT: Reset inline styles
                            mainContent.style.marginRight = '';
                            inputContainer.style.right = '';

                            // Reset placeholder
                            const messageInput = document.getElementById('messageInput');
                            messageInput.placeholder = 'No que você está pensando?';
                        }
                    }

                    this.renderMessages();

                    // Update active chat in sidebar
                    document.querySelectorAll('.chat-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    document.querySelector(`[data-chat-id="${chatId}"]`)?.classList.add('active');

                    // Don't show notification for loading existing chats to avoid noise
                    // this.showNotification(`Chat "${result.chat.title}" carregado`);
                } else {
                    this.showNotification(`Erro ao carregar chat: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar chat:', error);
            this.showNotification('Erro ao carregar chat');
        }
    }

    async saveCurrentChat() {
        if (!this.messages.length || !window.electronAPI?.saveChat) return;

        try {
            // Generate chat ID if new
            if (!this.currentChatId) {
                this.currentChatId = 'chat-' + Date.now();
            }

            // Generate title from first user message with better logic
            const firstUserMessage = this.messages.find(msg => msg.type === 'user');
            let title = 'Novo Chat';

            if (firstUserMessage) {
                let messageText = firstUserMessage.text.trim();

                // Remove common prefixes
                messageText = messageText.replace(/^(olá|oi|hello|hi)[,\s]*/i, '');
                messageText = messageText.replace(/^(me ajude|ajuda|help)[,\s]*/i, '');

                // Capitalize first letter
                if (messageText.length > 0) {
                    messageText = messageText.charAt(0).toUpperCase() + messageText.slice(1);
                }

                // Truncate and clean
                title = messageText.length > 50 ?
                    messageText.substring(0, 47) + '...' :
                    messageText;

                // Fallback if title is too short or empty
                if (title.length < 3) {
                    title = 'Conversa ' + new Date().toLocaleDateString('pt-BR');
                }
            }

            // Check if this is an existing chat to avoid unnecessary updatedAt changes
            const existingChat = this.chatList.find(chat => chat.id === this.currentChatId);
            const isNewChat = !existingChat;

            // Clean messages before saving - remove DOM references and non-serializable properties
            const cleanMessages = this.messages.map(msg => {
                const { element, ...cleanMsg } = msg; // Remove 'element' property
                return cleanMsg;
            });

            const chatData = {
                id: this.currentChatId,
                title: title,
                messages: cleanMessages, // Use cleaned messages
                isArchitect: this.currentChatIsArchitect || false, // Mark if it's an architect chat
                architectDocument: this.currentChatIsArchitect ? this.architectDocument : undefined, // Save document if architect mode
                createdAt: existingChat?.createdAt || this.messages[0]?.timestamp || new Date().toISOString(),
                // Only update timestamp if we have new content or it's a new chat
                updatedAt: (this.hasNewContent || isNewChat) ? new Date().toISOString() : (existingChat?.updatedAt || new Date().toISOString())
            };

            const result = await window.electronAPI.saveChat(chatData);

            if (result.success && isNewChat) {
                // Only reload chat list if it's a new chat to avoid reordering
                await this.loadChatList();
            }

            // Reset the new content flag after saving
            this.hasNewContent = false;
        } catch (error) {
            console.error('Erro ao salvar chat:', error);
        }
    }

    async loadChatList() {
        try {
            if (window.electronAPI && window.electronAPI.getChatList) {
                const result = await window.electronAPI.getChatList();

                if (result.success) {
                    this.chatList = result.chats;
                    this.renderChatList();
                }
            }
        } catch (error) {
            console.error('Erro ao carregar lista de chats:', error);
        }
    }

    renderChatList() {
        const chatHistory = document.querySelector('.chat-history');
        if (!chatHistory) return;

        // Show empty state if no chats
        if (this.chatList.length === 0) {
            chatHistory.innerHTML = `
                <div class="chat-history-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <p>Nenhum chat ainda</p>
                    <p>Comece uma conversa para ver o histórico aqui</p>
                </div>
            `;
            return;
        }

        // Separate architect and normal chats
        const architectChats = this.chatList.filter(chat => chat.isArchitect);
        const normalChats = this.chatList.filter(chat => !chat.isArchitect);

        // Separate pinned and unpinned for normal chats
        const pinnedChats = normalChats.filter(chat => this.settings.pinnedChats.includes(chat.id));
        const unpinnedChats = normalChats.filter(chat => !this.settings.pinnedChats.includes(chat.id));

        let html = '';

        // Show architect chats first
        if (architectChats.length > 0) {
            html += '<div class="history-section"><h4>🏗️ Arquiteto</h4>';
            architectChats.forEach(chat => {
                html += this.renderChatItem(chat, false, true);
            });
            html += '</div>';
        }

        // Show pinned chats
        if (pinnedChats.length > 0) {
            html += '<div class="history-section"><h4>Fixados</h4>';
            pinnedChats.forEach(chat => {
                html += this.renderChatItem(chat, true);
            });
            html += '</div>';
        }

        // Group unpinned chats by date
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const groups = {
            today: [],
            yesterday: [],
            lastWeek: [],
            older: []
        };

        unpinnedChats.forEach(chat => {
            const chatDate = new Date(chat.updatedAt);
            const chatDay = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());

            if (chatDay.getTime() === today.getTime()) {
                groups.today.push(chat);
            } else if (chatDay.getTime() === yesterday.getTime()) {
                groups.yesterday.push(chat);
            } else if (chatDate >= lastWeek) {
                groups.lastWeek.push(chat);
            } else {
                groups.older.push(chat);
            }
        });

        if (groups.today.length > 0) {
            html += '<div class="history-section"><h4>Hoje</h4>';
            groups.today.forEach(chat => {
                html += this.renderChatItem(chat, false);
            });
            html += '</div>';
        }

        if (groups.yesterday.length > 0) {
            html += '<div class="history-section"><h4>Ontem</h4>';
            groups.yesterday.forEach(chat => {
                html += this.renderChatItem(chat, false);
            });
            html += '</div>';
        }

        if (groups.lastWeek.length > 0) {
            html += '<div class="history-section"><h4>Última semana</h4>';
            groups.lastWeek.forEach(chat => {
                html += this.renderChatItem(chat, false);
            });
            html += '</div>';
        }

        if (groups.older.length > 0) {
            html += '<div class="history-section"><h4>Mais antigo</h4>';
            groups.older.forEach(chat => {
                html += this.renderChatItem(chat, false);
            });
            html += '</div>';
        }

        chatHistory.innerHTML = html;
    }

    renderChatItem(chat, isPinned = false, isArchitect = false) {
        const isActive = chat.id === this.currentChatId ? 'active' : '';
        const pinIcon = isPinned ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pin-icon"><path d="M12 17v5"></path><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 7.89 17H16.1a2 2 0 0 0 1.78-2.55l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1Z"></path></svg>' : '';
        const architectClass = isArchitect || chat.isArchitect ? 'architect-chat' : '';

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
                        <circle cx="5" cy="12" r="1"></circle>
                    </svg>
                </button>
            </div>
        `;
    }

    async deleteChat(chatId) {
        try {
            if (window.electronAPI && window.electronAPI.deleteChat) {
                const result = await window.electronAPI.deleteChat(chatId);

                if (result.success) {
                    // If deleting current chat, start new one
                    if (chatId === this.currentChatId) {
                        this.startNewChat();
                    }

                    // Reload chat list
                    await this.loadChatList();
                    this.showNotification('Chat deletado');
                } else {
                    this.showNotification(`Erro ao deletar chat: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Erro ao deletar chat:', error);
            this.showNotification('Erro ao deletar chat');
        }
    }

    openSettings() {
        this.showSettingsModal();
    }

    // Settings Modal Methods
    setupSettingsModal() {
        const settingsModalOverlay = document.getElementById('settingsModalOverlay');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');
        const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');

        // Store original settings for change detection
        this.originalSettings = null;

        // Close modal events
        closeSettingsBtn.addEventListener('click', () => this.closeSettingsModal());
        cancelSettingsBtn.addEventListener('click', () => this.cancelSettings());
        settingsModalOverlay.addEventListener('click', (e) => {
            if (e.target === settingsModalOverlay) {
                this.closeSettingsModal();
            }
        });

        // Save settings
        saveSettingsBtn.addEventListener('click', () => this.saveSettings());

        // Settings navigation
        document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.showSettingsSection(section);

                // Update active nav item
                document.querySelectorAll('.settings-nav-item').forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // API toggles
        document.getElementById('geminiEnabled').addEventListener('change', (e) => {
            this.toggleApiForm('gemini', e.target.checked);
            this.checkSettingsChanges();
        });

        document.getElementById('mistralEnabled').addEventListener('change', (e) => {
            this.toggleApiForm('mistral', e.target.checked);
            this.checkSettingsChanges();
        });

        document.getElementById('zaiEnabled').addEventListener('change', (e) => {
            this.toggleApiForm('zai', e.target.checked);
            this.checkSettingsChanges();
        });

        document.getElementById('openrouterEnabled').addEventListener('change', (e) => {
            this.toggleApiForm('openrouter', e.target.checked);
            this.checkSettingsChanges();
        });

        // Refresh Open Router models
        const refreshOpenRouterModelsBtn = document.getElementById('refreshOpenRouterModelsBtn');
        if (refreshOpenRouterModelsBtn) {
            refreshOpenRouterModelsBtn.addEventListener('click', () => {
                this.fetchOpenRouterModels();
            });
        }

        // Model selection
        document.getElementById('selectGemini').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.updateModelFeatures('gemini');
                this.checkSettingsChanges();
            }
        });

        document.getElementById('selectMistral').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.updateModelFeatures('mistral');
                this.checkSettingsChanges();
            }
        });

        document.getElementById('selectZai').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.updateModelFeatures('zai');
                this.checkSettingsChanges();
            }
        });

        document.getElementById('selectOpenrouter').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.updateModelFeatures('openrouter');
                this.checkSettingsChanges();
            }
        });

        // Add change listeners to all form inputs
        const formInputs = [
            'geminiApiKey', 'geminiModel',
            'mistralApiKey', 'mistralModel',
            'zaiApiKey', 'zaiModel',
            'openrouterApiKey', 'openrouterModel',
            'personalityType', 'formalityLevel',
            'allowProfanity', 'useSlang', 'useEmojis',
            'userNickname', 'userBio'
        ];

        formInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => this.checkSettingsChanges());
                input.addEventListener('change', () => this.checkSettingsChanges());
            }
        });

        // Response style radio buttons
        document.querySelectorAll('input[name="responseStyle"]').forEach(radio => {
            radio.addEventListener('change', () => this.checkSettingsChanges());
        });

        // Theme radio buttons
        document.querySelectorAll('input[name="appTheme"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.checkSettingsChanges();
                // Preview theme immediately
                this.applyTheme(e.target.value);
            });
        });

        // Password toggle buttons
        document.querySelectorAll('.toggle-password-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                const isPassword = input.type === 'password';

                input.type = isPassword ? 'text' : 'password';
                btn.innerHTML = isPassword ?
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>' :
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            });
        });

        // Test API buttons
        document.getElementById('testGeminiBtn').addEventListener('click', () => {
            this.testApiConnection('gemini');
        });

        document.getElementById('testMistralBtn').addEventListener('click', () => {
            this.testApiConnection('mistral');
        });

        document.getElementById('testZaiBtn').addEventListener('click', () => {
            this.testApiConnection('zai');
        });

        document.getElementById('testOpenrouterBtn').addEventListener('click', () => {
            this.testApiConnection('openrouter');
        });

        // Identity bio character counter
        const bioInput = document.getElementById('userBio');
        if (bioInput) {
            bioInput.addEventListener('input', () => {
                this.updateBioCharCount();
            });
        }

        // Refresh memories button
        const refreshMemoriesBtn = document.getElementById('refreshMemoriesBtn');
        if (refreshMemoriesBtn) {
            refreshMemoriesBtn.addEventListener('click', () => {
                this.loadMemoriesSection();
            });
        }

        // Setup Voice Settings
        this.setupVoiceSettings();

        // Load saved settings
        this.loadSettings();
    }

    showSettingsSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.settings-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show selected section
        const targetSection = document.getElementById(`section-${sectionId}`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Load memories if memories section is selected
        if (sectionId === 'memories') {
            this.loadMemoriesSection();
        }
    }

    showSettingsModal() {
        const settingsModalOverlay = document.getElementById('settingsModalOverlay');
        settingsModalOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';

        // Show first section by default
        this.showSettingsSection('apis');

        // Load current settings into form
        this.populateSettingsForm();

        // Store original settings for change detection
        this.originalSettings = JSON.stringify(this.getCurrentFormSettings());

        console.log('Original settings stored:', this.originalSettings);

        // Hide floating buttons initially
        this.hideFloatingButtons();
    }

    closeSettingsModal() {
        const settingsModalOverlay = document.getElementById('settingsModalOverlay');
        settingsModalOverlay.classList.remove('show');
        document.body.style.overflow = '';
        this.hideFloatingButtons();
    }

    checkSettingsChanges() {
        if (!this.originalSettings) {
            console.log('No original settings stored');
            return;
        }

        const currentSettings = JSON.stringify(this.getCurrentFormSettings());
        const hasChanges = currentSettings !== this.originalSettings;

        console.log('Checking settings changes:', {
            hasChanges,
            original: this.originalSettings.substring(0, 100),
            current: currentSettings.substring(0, 100)
        });

        if (hasChanges) {
            this.showFloatingButtons();
        } else {
            this.hideFloatingButtons();
        }
    }

    getCurrentFormSettings() {
        return {
            apis: {
                gemini: {
                    enabled: document.getElementById('geminiEnabled')?.checked || false,
                    apiKey: document.getElementById('geminiApiKey')?.value || '',
                    model: document.getElementById('geminiModel')?.value || ''
                },
                mistral: {
                    enabled: document.getElementById('mistralEnabled')?.checked || false,
                    apiKey: document.getElementById('mistralApiKey')?.value || '',
                    model: document.getElementById('mistralModel')?.value || ''
                },
                zai: {
                    enabled: document.getElementById('zaiEnabled')?.checked || false,
                    apiKey: document.getElementById('zaiApiKey')?.value || '',
                    model: document.getElementById('zaiModel')?.value || ''
                },
                openrouter: {
                    enabled: document.getElementById('openrouterEnabled')?.checked || false,
                    apiKey: document.getElementById('openrouterApiKey')?.value || '',
                    model: document.getElementById('openrouterModel')?.value || ''
                }
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
                elevenLabs: {
                    apiKey: document.getElementById('elevenLabsApiKey')?.value || '',
                    voiceId: document.getElementById('elevenLabsVoiceId')?.value || ''
                }
            },
            theme: document.querySelector('input[name="appTheme"]:checked')?.value || 'default'
        };
    }

    showFloatingButtons() {
        const floatingActions = document.getElementById('settingsFloatingActions');
        console.log('Showing floating buttons, element found:', !!floatingActions);
        if (floatingActions) {
            floatingActions.style.display = 'flex';
            floatingActions.style.visibility = 'visible';
            floatingActions.style.opacity = '1';
            console.log('Floating buttons display set to flex, computed style:', window.getComputedStyle(floatingActions).display);
        }
    }

    hideFloatingButtons() {
        const floatingActions = document.getElementById('settingsFloatingActions');
        if (floatingActions) {
            floatingActions.style.display = 'none';
        }
    }

    cancelSettings() {
        // Reload original settings
        this.populateSettingsForm();
        this.hideFloatingButtons();
    }

    populateSettingsForm() {
        // Ensure all API configs exist (for backward compatibility)
        if (!this.settings.apis.zai) {
            this.settings.apis.zai = {
                enabled: false,
                apiKey: '',
                model: 'glm-4.6'
            };
        }

        // Populate API settings
        document.getElementById('geminiEnabled').checked = this.settings.apis.gemini.enabled;
        document.getElementById('geminiApiKey').value = this.settings.apis.gemini.apiKey;
        document.getElementById('geminiModel').value = this.settings.apis.gemini.model;
        this.toggleApiForm('gemini', this.settings.apis.gemini.enabled);

        document.getElementById('mistralEnabled').checked = this.settings.apis.mistral.enabled;
        document.getElementById('mistralApiKey').value = this.settings.apis.mistral.apiKey;
        document.getElementById('mistralModel').value = this.settings.apis.mistral.model;
        this.toggleApiForm('mistral', this.settings.apis.mistral.enabled);

        document.getElementById('zaiEnabled').checked = this.settings.apis.zai.enabled;
        document.getElementById('zaiApiKey').value = this.settings.apis.zai.apiKey;
        document.getElementById('zaiModel').value = this.settings.apis.zai.model;
        this.toggleApiForm('zai', this.settings.apis.zai.enabled);

        // Populate Open Router settings
        if (!this.settings.apis.openrouter) {
            this.settings.apis.openrouter = {
                enabled: false,
                apiKey: '',
                model: 'google/gemini-2.0-flash-001'
            };
        }

        document.getElementById('openrouterEnabled').checked = this.settings.apis.openrouter.enabled;
        document.getElementById('openrouterApiKey').value = this.settings.apis.openrouter.apiKey;
        // We don't populate model until it's loaded, but we set the value
        const openrouterModelSelect = document.getElementById('openrouterModel');
        if (openrouterModelSelect) {
            openrouterModelSelect.value = this.settings.apis.openrouter.model;
        }
        this.toggleApiForm('openrouter', this.settings.apis.openrouter.enabled);

        // Populate active model
        document.getElementById('selectGemini').checked = this.settings.activeModel === 'gemini';
        document.getElementById('selectMistral').checked = this.settings.activeModel === 'mistral';
        document.getElementById('selectZai').checked = this.settings.activeModel === 'zai';
        document.getElementById('selectOpenrouter').checked = this.settings.activeModel === 'openrouter';

        // Populate personality settings
        document.getElementById('personalityType').value = this.settings.personality.type;
        document.getElementById('formalityLevel').value = this.settings.personality.formalityLevel;
        document.getElementById('allowProfanity').checked = this.settings.personality.allowProfanity;
        document.getElementById('useSlang').checked = this.settings.personality.useSlang;
        document.getElementById('useEmojis').checked = this.settings.personality.useEmojis;
        document.querySelector(`input[name="responseStyle"][value="${this.settings.personality.responseStyle}"]`).checked = true;

        // Populate identity settings
        if (this.settings.identity) {
            const nicknameInput = document.getElementById('userNickname');
            const bioInput = document.getElementById('userBio');

            if (nicknameInput) nicknameInput.value = this.settings.identity.nickname || '';
            if (bioInput) {
                bioInput.value = this.settings.identity.bio || '';
                this.updateBioCharCount();
            }
        }

        // Populate voice settings
        if (this.settings.voice) {
            const voiceType = this.settings.voice.type || 'robotic';
            const voiceTypeRadio = document.querySelector(`input[name="voiceType"][value="${voiceType}"]`);
            if (voiceTypeRadio) voiceTypeRadio.checked = true;

            const apiKeyInput = document.getElementById('elevenLabsApiKey');
            if (apiKeyInput) apiKeyInput.value = this.settings.voice.elevenLabs?.apiKey || '';

            // Store saved voice ID to select it after fetching
            this.savedVoiceId = this.settings.voice.elevenLabs?.voiceId || '';

            // Toggle ElevenLabs config visibility
            this.toggleVoiceConfig(voiceType);

            // If we have an API key and using ElevenLabs, fetch voices
            if (voiceType === 'elevenlabs' && this.settings.voice.elevenLabs?.apiKey) {
                this.fetchElevenLabsVoices();
            }
        }

        // Update status indicators
        this.updateApiStatus('gemini');
        this.updateApiStatus('mistral');
        this.updateApiStatus('zai');
        this.updateApiStatus('openrouter');

        // Update model features for the selected model
        this.updateModelFeatures(this.settings.activeModel);

        // Fetch Open Router models if configured
        if (this.settings.apis.openrouter.enabled && this.settings.apis.openrouter.apiKey) {
            this.fetchOpenRouterModels();
        }

        // Populate theme
        if (this.settings.theme) {
            const themeRadio = document.querySelector(`input[name="appTheme"][value="${this.settings.theme}"]`);
            if (themeRadio) themeRadio.checked = true;
        }
    }

    toggleApiForm(provider, enabled) {
        const form = document.getElementById(`${provider}Form`);
        if (enabled) {
            form.classList.add('show');
        } else {
            form.classList.remove('show');
        }
    }

    updateApiStatus(provider) {
        const statusElement = document.getElementById(`${provider}Status`);
        const indicatorElement = document.getElementById(`${provider}Indicator`);
        const apiKey = this.settings.apis[provider].apiKey;
        const enabled = this.settings.apis[provider].enabled;

        if (!enabled || !apiKey) {
            statusElement.textContent = 'Não configurado';
            statusElement.className = 'api-status';
            if (indicatorElement) {
                indicatorElement.className = 'status-indicator';
            }
        } else {
            statusElement.textContent = 'Configurado';
            statusElement.className = 'api-status connected';
            if (indicatorElement) {
                indicatorElement.className = 'status-indicator connected';
            }
        }
    }

    updateModelFeatures(provider) {
        const featuresContainer = document.getElementById('modelFeatures');
        if (!featuresContainer) return;

        const features = {
            gemini: [
                'Processamento de texto avançado',
                'Suporte a imagens e multimodal',
                'Respostas rápidas e precisas',
                'Integração com Google AI'
            ],
            mistral: [
                'Streaming de respostas em tempo real',
                'Modelo europeu de código aberto',
                'Excelente para programação',
                'Respostas fluidas e naturais'
            ],
            zai: [
                'Modelos GLM com reasoning avançado',
                'Otimizado para coding e agents',
                'Suporte a contexto longo (128k tokens)',
                'Modo de pensamento profundo (thinking mode)',
                'Arquitetura MoE (Mixture of Experts)'
            ],
            openrouter: [
                'Acesso a centenas de modelos',
                'API unificada para múltiplos provedores',
                'Ótimo custo-benefício',
                'Claude 3, GPT-4, Llama 3 e muitos outros'
            ]
        };

        const modelFeatures = features[provider] || [];

        featuresContainer.innerHTML = modelFeatures.map(feature => `
            <div class="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
                <span>${feature}</span>
            </div>
        `).join('');
    }

    setupVoiceSettings() {
        // Voice type toggle
        document.querySelectorAll('input[name="voiceType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleVoiceConfig(e.target.value);
                this.checkSettingsChanges();
            });
        });

        // ElevenLabs API Key change
        const apiKeyInput = document.getElementById('elevenLabsApiKey');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('change', () => {
                this.checkSettingsChanges();
                // If key added/changed, try to fetch voices
                if (apiKeyInput.value) {
                    this.fetchElevenLabsVoices();
                }
            });
        }

        // Refresh voices button
        const refreshBtn = document.getElementById('refreshVoicesBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.fetchElevenLabsVoices();
            });
        }

        // Play preview button
        const playBtn = document.getElementById('playVoicePreviewBtn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                this.playVoicePreview();
            });
        }

        // Voice selection change
        const voiceSelect = document.getElementById('elevenLabsVoiceId');
        if (voiceSelect) {
            voiceSelect.addEventListener('change', () => {
                this.checkSettingsChanges();
            });
        }
    }

    toggleVoiceConfig(type) {
        const configDiv = document.getElementById('elevenLabsConfig');
        const roboticCard = document.getElementById('roboticVoiceCard');
        const elevenLabsCard = document.getElementById('elevenLabsVoiceCard');

        if (type === 'elevenlabs') {
            if (configDiv) configDiv.style.display = 'block';
            if (elevenLabsCard) elevenLabsCard.classList.add('selected');
            if (roboticCard) roboticCard.classList.remove('selected');
        } else {
            if (configDiv) configDiv.style.display = 'none';
            if (elevenLabsCard) elevenLabsCard.classList.remove('selected');
            if (roboticCard) roboticCard.classList.add('selected');
        }
    }

    async fetchElevenLabsVoices() {
        const apiKey = document.getElementById('elevenLabsApiKey').value;
        const voiceSelect = document.getElementById('elevenLabsVoiceId');
        const refreshBtn = document.getElementById('refreshVoicesBtn');

        if (!apiKey) return;

        if (refreshBtn) refreshBtn.classList.add('loading');
        if (voiceSelect) {
            voiceSelect.innerHTML = '<option value="">Carregando vozes...</option>';
            voiceSelect.disabled = true;
        }

        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': apiKey
                }
            });

            if (!response.ok) throw new Error('Falha ao buscar vozes');

            const data = await response.json();
            const voices = data.voices;

            if (voiceSelect) {
                voiceSelect.innerHTML = '';
                voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.voice_id;
                    option.textContent = voice.name;
                    if (voice.preview_url) {
                        option.dataset.previewUrl = voice.preview_url;
                    }
                    voiceSelect.appendChild(option);
                });

                // Select saved voice if available
                const savedId = this.savedVoiceId || this.settings.voice?.elevenLabs?.voiceId;
                if (savedId) {
                    voiceSelect.value = savedId;
                }

                voiceSelect.disabled = false;
            }
        } catch (error) {
            console.error('Erro ao buscar vozes:', error);
            if (voiceSelect) voiceSelect.innerHTML = '<option value="">Erro ao carregar vozes</option>';
            this.showNotification('Erro ao carregar vozes do ElevenLabs: ' + error.message);
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('loading');
        }
    }

    playVoicePreview() {
        const voiceSelect = document.getElementById('elevenLabsVoiceId');
        if (!voiceSelect) return;

        const selectedOption = voiceSelect.options[voiceSelect.selectedIndex];

        if (!selectedOption) return;

        const previewUrl = selectedOption.dataset.previewUrl;

        if (previewUrl) {
            const audio = new Audio(previewUrl);
            audio.play().catch(e => console.error('Erro ao reproduzir áudio:', e));
        } else {
            this.showNotification('Prévia não disponível para esta voz');
        }
    }

    updateBioCharCount() {
        const bioInput = document.getElementById('userBio');
        const charCount = document.getElementById('bioCharCount');

        if (bioInput && charCount) {
            const currentLength = bioInput.value.length;
            charCount.textContent = currentLength;

            // Change color if approaching limit
            if (currentLength > 900) {
                charCount.style.color = '#ff6b6b';
            } else if (currentLength > 800) {
                charCount.style.color = '#ffa500';
            } else {
                charCount.style.color = '#999999';
            }
        }
    }

    async fetchOpenRouterModels() {
        const apiKeyInput = document.getElementById('openrouterApiKey');
        const refreshBtn = document.getElementById('refreshOpenRouterModelsBtn');
        const apiKey = apiKeyInput ? apiKeyInput.value : this.settings.apis.openrouter.apiKey;

        if (!apiKey) {
            this.showNotification('Por favor, insira a chave da API do Open Router primeiro');
            return;
        }

        if (refreshBtn) refreshBtn.classList.add('loading');

        try {
            if (window.electronAPI && window.electronAPI.fetchOpenRouterModels) {
                const result = await window.electronAPI.fetchOpenRouterModels(apiKey);
                if (result.success) {
                    this.populateOpenRouterModels(result.models);
                } else {
                    this.showNotification(`Erro ao carregar modelos: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Erro ao buscar modelos do Open Router:', error);
            this.showNotification('Erro ao buscar modelos do Open Router');
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('loading');
        }
    }

    populateOpenRouterModels(models) {
        const select = document.getElementById('openrouterModel');
        if (!select) return;

        const currentValue = select.value || this.settings.apis.openrouter.model;
        select.innerHTML = '';

        // Add a default option if no models
        if (!models || models.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Nenhum modelo encontrado';
            select.appendChild(option);
            return;
        }

        // Sort models by name
        models.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            // Show price if available
            const price = model.pricing ? ` ($${(parseFloat(model.pricing.prompt) * 1000000).toFixed(2)}/M tokens)` : '';
            option.textContent = (model.name || model.id) + price;
            select.appendChild(option);
        });

        // Restore current value if it exists in the new list
        if (currentValue && models.some(m => m.id === currentValue)) {
            select.value = currentValue;
        } else if (models.length > 0) {
            // Default to first model if current not found
            // select.selectedIndex = 0;
        }
    }

    async testApiConnection(provider) {
        const testBtn = document.getElementById(`test${provider.charAt(0).toUpperCase() + provider.slice(1)}Btn`);
        const apiKey = document.getElementById(`${provider}ApiKey`).value;
        const model = document.getElementById(`${provider}Model`).value;

        if (!apiKey) {
            this.showNotification('Por favor, insira a chave da API primeiro');
            return;
        }

        // Update button state
        testBtn.classList.add('testing');
        testBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"></path></svg>Testando...';

        try {
            // Simulate API test (in real app, make actual API call)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Simulate success (you would implement real API testing here)
            const success = Math.random() > 0.3; // 70% success rate for demo

            if (success) {
                testBtn.classList.remove('testing');
                testBtn.classList.add('success');
                testBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,11 12,14 22,4"></polyline><path d="M21,12v7a2,2 0 0,1 -2,2H5a2,2 0 0,1 -2,-2V5a2,2 0 0,1 2,-2h11"></path></svg>Conexão OK';

                setTimeout(() => {
                    testBtn.classList.remove('success');
                    testBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,11 12,14 22,4"></polyline><path d="M21,12v7a2,2 0 0,1 -2,2H5a2,2 0 0,1 -2,-2V5a2,2 0 0,1 2,-2h11"></path></svg>Testar Conexão';
                }, 3000);
            } else {
                throw new Error('API key inválida');
            }
        } catch (error) {
            testBtn.classList.remove('testing');
            testBtn.classList.add('error');
            testBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>Erro na conexão';

            setTimeout(() => {
                testBtn.classList.remove('error');
                testBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,11 12,14 22,4"></polyline><path d="M21,12v7a2,2 0 0,1 -2,2H5a2,2 0 0,1 -2,-2V5a2,2 0 0,1 2,-2h11"></path></svg>Testar Conexão';
            }, 3000);
        }
    }

    async saveSettings() {
        // Collect form data
        const newSettings = {
            apis: {
                gemini: {
                    enabled: document.getElementById('geminiEnabled').checked,
                    apiKey: document.getElementById('geminiApiKey').value,
                    model: document.getElementById('geminiModel').value
                },
                mistral: {
                    enabled: document.getElementById('mistralEnabled').checked,
                    apiKey: document.getElementById('mistralApiKey').value,
                    model: document.getElementById('mistralModel').value
                },
                zai: {
                    enabled: document.getElementById('zaiEnabled').checked,
                    apiKey: document.getElementById('zaiApiKey').value,
                    model: document.getElementById('zaiModel').value
                },
                openrouter: {
                    enabled: document.getElementById('openrouterEnabled').checked,
                    apiKey: document.getElementById('openrouterApiKey').value,
                    model: document.getElementById('openrouterModel').value
                }
            },
            activeModel: document.querySelector('input[name="activeModel"]:checked')?.value || 'gemini',
            systemPrompt: this.settings.systemPrompt, // Include system prompt
            personality: {
                type: document.getElementById('personalityType').value,
                formalityLevel: parseInt(document.getElementById('formalityLevel').value),
                allowProfanity: document.getElementById('allowProfanity').checked,
                useSlang: document.getElementById('useSlang').checked,
                useEmojis: document.getElementById('useEmojis').checked,
                responseStyle: document.querySelector('input[name="responseStyle"]:checked')?.value || 'detailed'
            },
            identity: {
                nickname: document.getElementById('userNickname')?.value || '',
                bio: document.getElementById('userBio')?.value || ''
            },
            voice: {
                type: document.querySelector('input[name="voiceType"]:checked')?.value || 'robotic',
                elevenLabs: {
                    apiKey: document.getElementById('elevenLabsApiKey')?.value || '',
                    voiceId: document.getElementById('elevenLabsVoiceId')?.value || ''
                }
            },
            theme: document.querySelector('input[name="appTheme"]:checked')?.value || 'default'
        };

        // Save to settings
        this.settings = newSettings;

        // Save to localStorage
        localStorage.setItem('openchat-settings', JSON.stringify(this.settings));

        // Save via IPC if available
        if (window.electronAPI && window.electronAPI.saveSettings) {
            try {
                await window.electronAPI.saveSettings(this.settings);
            } catch (error) {
                console.error('Erro ao salvar configurações via IPC:', error);
            }
        }

        // Update status indicators
        this.updateApiStatus('gemini');
        this.updateApiStatus('mistral');
        this.updateApiStatus('zai');
        this.updateApiStatus('openrouter');

        // Hide floating buttons and update original settings
        this.hideFloatingButtons();
        this.originalSettings = JSON.stringify(this.getCurrentFormSettings());

        this.showNotification('Configurações salvas com sucesso!');

        // Apply the saved theme to ensure it persists visually
        this.applyTheme(this.settings.theme);
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('openchat-settings');
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                // Preserve systemPrompt if it exists in current settings but not in saved settings
                if (!parsedSettings.systemPrompt && this.settings.systemPrompt) {
                    parsedSettings.systemPrompt = this.settings.systemPrompt;
                }
                // Ensure personality settings exist
                if (!parsedSettings.personality) {
                    parsedSettings.personality = this.settings.personality;
                }
                // Ensure identity settings exist
                if (!parsedSettings.identity) {
                    parsedSettings.identity = this.settings.identity;
                }
                // Ensure voice settings exist
                if (!parsedSettings.voice) {
                    parsedSettings.voice = this.settings.voice;
                }
                // Ensure Z.AI API settings exist (backward compatibility)
                if (!parsedSettings.apis) {
                    parsedSettings.apis = this.settings.apis;
                } else if (!parsedSettings.apis.zai) {
                    parsedSettings.apis.zai = this.settings.apis.zai;
                }
                if (parsedSettings.apis && !parsedSettings.apis.openrouter) {
                    parsedSettings.apis.openrouter = this.settings.apis.openrouter;
                }
                // Ensure theme settings exist
                if (!parsedSettings.theme) {
                    parsedSettings.theme = this.settings.theme || 'default';
                }
                this.settings = { ...this.settings, ...parsedSettings };

                // Apply loaded theme
                this.applyTheme(this.settings.theme);
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    }

    // Snow Effect - Only during Christmas season (December only)
    initSnowEffect() {
        console.log('initSnowEffect: Função chamada');

        // Check if it's Christmas season (December only)
        const now = new Date();
        const month = now.getMonth(); // 0 = January, 11 = December
        const day = now.getDate();

        console.log(`Verificando época natalina: Mês=${month} (${month === 11 ? 'Dezembro' : 'Outro mês'}), Dia=${day}`);

        const isChristmasSeason = (month === 11); // Only December

        console.log(`É época natalina? ${isChristmasSeason}`);

        const snowContainer = document.getElementById('snowContainer');

        if (!isChristmasSeason) {
            console.log('Fora da época natalina - neve desabilitada');

            // Hide the snow container completely
            if (snowContainer) {
                snowContainer.style.display = 'none';
                snowContainer.innerHTML = ''; // Clear any existing snow
            }
            return; // Don't show snow outside Christmas season
        }

        console.log('Época natalina detectada - ativando neve');

        // Show the snow container
        if (snowContainer) {
            snowContainer.style.display = 'block';
        }

        this.createSnowflakes();

        // Create new snowflakes less frequently
        this.snowInterval = setInterval(() => {
            this.createSnowflake();
        }, 1200);

        // Check every hour if we should stop the snow (in case date changes)
        this.snowCheckInterval = setInterval(() => {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth();
            const stillChristmas = (currentMonth === 11); // Only December

            if (!stillChristmas) {
                console.log('Época natalina terminou - desabilitando neve');
                this.stopSnowEffect();
            }
        }, 3600000); // Check every hour (3600000ms)
    }

    stopSnowEffect() {
        console.log('stopSnowEffect: Parando efeito de neve');

        if (this.snowInterval) {
            clearInterval(this.snowInterval);
            this.snowInterval = null;
        }
        if (this.snowCheckInterval) {
            clearInterval(this.snowCheckInterval);
            this.snowCheckInterval = null;
        }

        // Hide and clear snow container
        const snowContainer = document.getElementById('snowContainer');
        if (snowContainer) {
            snowContainer.style.display = 'none';
            snowContainer.innerHTML = '';
        }
    }

    clearSnow() {
        console.log('clearSnow: Limpando neve');
        const container = document.getElementById('snowContainer');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = ''; // Remove all existing snowflakes
        }
    }

    createSnowflakes() {
        const container = document.getElementById('snowContainer');
        if (!container) return;

        // Double-check Christmas season before creating initial snowflakes (December only)
        const now = new Date();
        const month = now.getMonth();
        const isChristmasSeason = (month === 11); // Only December

        if (!isChristmasSeason) {
            console.log('createSnowflakes: Não é época natalina, cancelando criação inicial');
            return;
        }

        console.log('createSnowflakes: Criando flocos de neve iniciais');
        // Create fewer initial snowflakes
        for (let i = 0; i < 10; i++) { // Reduced from 30 to 10
            setTimeout(() => {
                this.createSnowflake();
            }, i * 300); // Increased interval from 150ms to 300ms
        }
    }

    createSnowflake() {
        const container = document.getElementById('snowContainer');
        if (!container) return;

        // Double-check if it's still Christmas season (December only)
        const now = new Date();
        const month = now.getMonth();
        const isChristmasSeason = (month === 11); // Only December

        if (!isChristmasSeason) {
            return; // Stop creating snowflakes if no longer Christmas season
        }

        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';

        // Much smaller particles between 1px and 3px
        const size = Math.random() * 2 + 1;
        snowflake.style.width = size + 'px';
        snowflake.style.height = size + 'px';

        // Random horizontal position
        const startX = Math.random() * 100;
        snowflake.style.left = startX + '%';

        // Simple animation - just fall down
        const fallDuration = Math.random() * 5 + 10; // 10-15 seconds
        snowflake.style.animation = `fallWithWind ${fallDuration}s linear infinite, pulse 2s ease-in-out infinite`;

        container.appendChild(snowflake);
    }

    // New Year Message - Only on January 1st (simple text replacement)
    initNewYearMessage() {
        console.log('initNewYearMessage: Função chamada');

        const now = new Date();
        const month = now.getMonth(); // 0 = January
        const day = now.getDate();
        const year = now.getFullYear();

        console.log(`Verificando Ano Novo: Mês=${month} (${month === 0 ? 'Janeiro' : 'Outro mês'}), Dia=${day}, Ano=${year}`);

        const isNewYearsDay = (month === 0 && day === 1); // January 1st

        console.log(`É dia de Ano Novo? ${isNewYearsDay}`);

        const welcomeText = document.getElementById('welcomeText');

        if (isNewYearsDay && welcomeText) {
            console.log('Dia de Ano Novo detectado - alterando texto');
            welcomeText.textContent = `OpenChat te deseja um Feliz ${year}! 🎉`;
        } else if (welcomeText) {
            console.log('Não é dia de Ano Novo - texto padrão');
            welcomeText.textContent = 'No que você está pensando hoje?';
        }

        // Check every hour if we should change the text (in case date changes)
        setInterval(() => {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth();
            const currentDay = currentDate.getDate();
            const currentYear = currentDate.getFullYear();
            const stillNewYear = (currentMonth === 0 && currentDay === 1);

            if (welcomeText) {
                if (stillNewYear) {
                    welcomeText.textContent = `OpenChat te deseja um Feliz ${currentYear}! 🎉`;
                } else {
                    welcomeText.textContent = 'No que você está pensando hoje?';
                }
            }
        }, 3600000); // Check every hour
    }

    setupTitlebarControls() {
        const minimizeBtn = document.getElementById('minimizeBtn');
        const maximizeBtn = document.getElementById('maximizeBtn');
        const closeBtn = document.getElementById('closeBtn');
        const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                if (window.electronAPI && window.electronAPI.windowMinimize) {
                    window.electronAPI.windowMinimize();
                }
            });
        }

        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', async () => {
                if (window.electronAPI && window.electronAPI.windowMaximize) {
                    await window.electronAPI.windowMaximize();
                    this.updateMaximizeButton();
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (window.electronAPI && window.electronAPI.windowClose) {
                    window.electronAPI.windowClose();
                }
            });
        }

        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Update maximize button icon on load
        this.updateMaximizeButton();
    }

    async updateMaximizeButton() {
        const maximizeBtn = document.getElementById('maximizeBtn');
        if (!maximizeBtn || !window.electronAPI?.windowIsMaximized) return;

        const isMaximized = await window.electronAPI.windowIsMaximized();
        const svg = maximizeBtn.querySelector('svg');

        if (isMaximized) {
            svg.innerHTML = '<rect x="3" y="3" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="5" y="1" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none"/>';
        } else {
            svg.innerHTML = '<rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="1.5" fill="none"/>';
        }
    }

    // Terms of Use Management
    checkTermsOfUse() {
        // TEMPORÁRIO: Sempre mostrar o modal para testes
        this.showTermsModal();

        /* const termsAccepted = localStorage.getItem('openchat-terms-accepted');
        
        if (!termsAccepted) {
            this.showTermsModal();
        } */
    }

    showTermsModal() {
        const termsModalOverlay = document.getElementById('termsModalOverlay');
        const termsCheckbox = document.getElementById('termsCheckbox');
        const acceptBtn = document.getElementById('acceptTermsBtn');
        const rejectBtn = document.getElementById('rejectTermsBtn');

        // Show modal
        termsModalOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';

        // Setup checkbox listener
        const checkboxHandler = () => {
            acceptBtn.disabled = !termsCheckbox.checked;
        };
        termsCheckbox.addEventListener('change', checkboxHandler);

        // Setup accept button
        const acceptHandler = () => {
            if (termsCheckbox.checked) {
                this.acceptTerms();
            }
        };
        acceptBtn.addEventListener('click', acceptHandler);

        // Setup reject button
        const rejectHandler = () => {
            this.rejectTerms();
        };
        rejectBtn.addEventListener('click', rejectHandler);
    }

    acceptTerms() {
        // Save acceptance to localStorage
        localStorage.setItem('openchat-terms-accepted', 'true');
        localStorage.setItem('openchat-terms-accepted-date', new Date().toISOString());

        // Hide modal
        const termsModalOverlay = document.getElementById('termsModalOverlay');
        termsModalOverlay.classList.remove('show');
        document.body.style.overflow = '';

        console.log('Termos de uso aceitos');
    }

    rejectTerms() {
        // Close the application
        if (window.electronAPI && window.electronAPI.windowClose) {
            window.electronAPI.windowClose();
        } else {
            // Fallback for non-Electron environment
            window.close();
        }
    }

    // Chat Options Menu
    showChatOptions(chatId, event) {
        // Remove any existing menu
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
            </button>
        `;

        // Position menu relative to the button, not the chat item
        const buttonRect = event.target.getBoundingClientRect();
        const chatHistoryArea = document.querySelector('.chat-history-area');

        menu.style.position = 'fixed';
        menu.style.top = `${buttonRect.bottom + 5}px`;
        menu.style.right = `${window.innerWidth - buttonRect.right}px`;
        menu.style.zIndex = '1001';

        // Add to body instead of chat item
        document.body.appendChild(menu);

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.hideChatOptions.bind(this), { once: true });
        }, 10);
    }

    hideChatOptions() {
        const existingMenu = document.querySelector('.chat-options-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    async renameChatPrompt(chatId) {
        this.hideChatOptions();

        const chat = this.chatList.find(c => c.id === chatId);
        if (!chat) return;

        const newTitle = prompt('Novo nome para o chat:', chat.title);
        if (newTitle && newTitle.trim() && newTitle.trim() !== chat.title) {
            await this.renameChat(chatId, newTitle.trim());
        }
    }

    async renameChat(chatId, newTitle) {
        try {
            // Update local chat list
            const chat = this.chatList.find(c => c.id === chatId);
            if (chat) {
                chat.title = newTitle;
                chat.updatedAt = new Date().toISOString();
            }

            // Save to storage if it's the current chat
            if (chatId === this.currentChatId) {
                await this.saveCurrentChat();
            } else {
                // Load, update and save the chat
                if (window.electronAPI && window.electronAPI.loadChat) {
                    const result = await window.electronAPI.loadChat(chatId);
                    if (result.success) {
                        const chatData = {
                            ...result.chat,
                            title: newTitle,
                            updatedAt: new Date().toISOString()
                        };
                        await window.electronAPI.saveChat(chatData);
                    }
                }
            }

            // Refresh chat list
            await this.loadChatList();
            this.showNotification('Chat renomeado com sucesso');
        } catch (error) {
            console.error('Erro ao renomear chat:', error);
            this.showNotification('Erro ao renomear chat');
        }
    }

    deleteChatConfirm(chatId) {
        this.hideChatOptions();

        const chat = this.chatList.find(c => c.id === chatId);
        if (!chat) return;

        if (confirm(`Tem certeza que deseja excluir o chat "${chat.title}"?`)) {
            this.deleteChat(chatId);
        }
    }

    togglePinChat(chatId) {
        this.hideChatOptions();

        const pinnedIndex = this.settings.pinnedChats.indexOf(chatId);

        if (pinnedIndex === -1) {
            // Fixar chat
            this.settings.pinnedChats.push(chatId);
            this.showNotification('Chat fixado');
        } else {
            // Desfixar chat
            this.settings.pinnedChats.splice(pinnedIndex, 1);
            this.showNotification('Chat desfixado');
        }

        // Salvar configurações
        localStorage.setItem('openchat-settings', JSON.stringify(this.settings));

        // Recarregar lista de chats para mostrar nova ordem
        this.loadChatList();
    }

    // Auto-save functionality
    setupAutoSave() {
        // Auto-save every 30 seconds if there are unsaved changes
        setInterval(() => {
            if (this.messages.length > 0 && this.currentChatId) {
                this.saveCurrentChat();
            }
        }, 30000);

        // Save when window is about to close
        window.addEventListener('beforeunload', () => {
            if (this.messages.length > 0) {
                this.saveCurrentChat();
            }
        });
    }

    // Memory Management Functions
    async loadMemoriesSection() {
        try {
            const result = await window.electronAPI.getMemories();

            if (result.success) {
                this.renderMemories(result.memories);
            } else {
                console.error('Erro ao carregar memórias:', result.error);
            }
        } catch (error) {
            console.error('Erro ao carregar memórias:', error);
        }
    }

    renderMemories(memories) {
        const memoriesList = document.getElementById('memoriesList');
        if (!memoriesList) return;

        if (!memories || memories.length === 0) {
            memoriesList.innerHTML = `
                <div class="memories-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                    <p>Nenhuma memória salva ainda</p>
                    <p class="memories-empty-hint">A IA salvará memórias automaticamente quando você compartilhar informações importantes ou quando você pedir para ela lembrar de algo.</p>
                </div>
            `;
            return;
        }

        // Sort by importance and date
        const sortedMemories = memories.sort((a, b) => {
            const importanceOrder = { high: 3, medium: 2, low: 1 };
            const importanceA = importanceOrder[a.importance] || 0;
            const importanceB = importanceOrder[b.importance] || 0;

            if (importanceA !== importanceB) {
                return importanceB - importanceA;
            }

            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        memoriesList.innerHTML = sortedMemories.map(memory => {
            const date = new Date(memory.createdAt);
            const formattedDate = date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });

            const categoryIcons = {
                user_info: '👤',
                preferences: '⚙️',
                facts: '📌',
                important_events: '⭐',
                general: '💭'
            };

            const categoryIcon = categoryIcons[memory.category] || '💭';

            return `
                <div class="memory-item" data-memory-id="${memory.id}">
                    <div class="memory-header">
                        <div class="memory-category">
                            <span>${categoryIcon}</span>
                            <span>${this.formatCategoryName(memory.category)}</span>
                        </div>
                        <div class="memory-importance ${memory.importance}">
                            ${memory.importance === 'high' ? '🔴' : memory.importance === 'medium' ? '🟡' : '⚪'}
                            ${memory.importance}
                        </div>
                    </div>
                    <div class="memory-content">${this.escapeHtml(memory.content)}</div>
                    <div class="memory-footer">
                        <div class="memory-date">${formattedDate}</div>
                        <div class="memory-actions">
                            <button class="memory-action-btn delete" onclick="window.openchat.deleteMemory('${memory.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                </svg>
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    formatCategoryName(category) {
        const names = {
            user_info: 'Informações do Usuário',
            preferences: 'Preferências',
            facts: 'Fatos',
            important_events: 'Eventos Importantes',
            general: 'Geral'
        };
        return names[category] || category;
    }

    async deleteMemory(memoryId) {
        if (!confirm('Tem certeza que deseja excluir esta memória?')) {
            return;
        }

        try {
            const result = await window.electronAPI.deleteMemory(memoryId);

            if (result.success) {
                this.showNotification('Memória excluída com sucesso');
                this.loadMemoriesSection();
            } else {
                this.showNotification('Erro ao excluir memória: ' + result.error);
            }
        } catch (error) {
            console.error('Erro ao excluir memória:', error);
            this.showNotification('Erro ao excluir memória');
        }
    }

    // ========== ARCHITECT MODE METHODS ==========

    setupArchitectModals() {
        // Architect intro modal
        const architectIntroOverlay = document.getElementById('architectIntroModalOverlay');
        const architectIntroUnderstoodBtn = document.getElementById('architectIntroUnderstoodBtn');

        architectIntroUnderstoodBtn.addEventListener('click', () => {
            this.closeArchitectIntro();
            this.openArchitectPrdModal();
        });

        // Architect PRD modal
        const architectPrdOverlay = document.getElementById('architectPrdModalOverlay');
        const architectPrdCancelBtn = document.getElementById('architectPrdCancelBtn');
        const architectPrdContinueBtn = document.getElementById('architectPrdContinueBtn');
        const architectPrdInput = document.getElementById('architectPrdInput');

        architectPrdCancelBtn.addEventListener('click', () => {
            this.closeArchitectPrdModal();
        });

        architectPrdContinueBtn.addEventListener('click', () => {
            const prdContent = architectPrdInput.value.trim();
            if (prdContent) {
                this.startArchitectMode(prdContent);
            } else {
                this.showNotification('Por favor, insira um documento inicial');
            }
        });

        // Close on overlay click
        architectIntroOverlay.addEventListener('click', (e) => {
            if (e.target === architectIntroOverlay) {
                this.closeArchitectIntro();
            }
        });

        architectPrdOverlay.addEventListener('click', (e) => {
            if (e.target === architectPrdOverlay) {
                this.closeArchitectPrdModal();
            }
        });

        // Architect sidebar
        const architectSidebarClose = document.getElementById('architectSidebarClose');
        architectSidebarClose.addEventListener('click', () => {
            this.exitArchitectMode();
        });

        // Architect copy button
        const architectCopyBtn = document.getElementById('architectCopyBtn');
        architectCopyBtn.addEventListener('click', () => {
            this.copyArchitectDocument();
        });

        // Architect word count button
        const architectWordCountBtn = document.getElementById('architectWordCountBtn');
        architectWordCountBtn.addEventListener('click', () => {
            this.showArchitectStats();
        });

        // Architect sidebar resize
        const resizeHandle = document.getElementById('architectSidebarResizeHandle');
        resizeHandle.addEventListener('mousedown', (e) => {
            this.isResizingArchitectSidebar = true;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isResizingArchitectSidebar) {
                // Calculate width from right edge
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
        const documentContent = document.getElementById('architectDocumentContent');
        documentContent.addEventListener('input', () => {
            this.architectDocument = documentContent.textContent;
            this.updateArchitectStats();
        });
    }

    openArchitectIntro() {
        const overlay = document.getElementById('architectIntroModalOverlay');
        overlay.classList.add('show');
    }

    closeArchitectIntro() {
        const overlay = document.getElementById('architectIntroModalOverlay');
        overlay.classList.remove('show');
    }

    openArchitectPrdModal() {
        const overlay = document.getElementById('architectPrdModalOverlay');
        const input = document.getElementById('architectPrdInput');
        input.value = '';
        overlay.classList.add('show');
        setTimeout(() => input.focus(), 300);
    }

    closeArchitectPrdModal() {
        const overlay = document.getElementById('architectPrdModalOverlay');
        overlay.classList.remove('show');
    }

    startArchitectMode(initialDocument) {
        console.log('Starting Architect Mode with document:', initialDocument.substring(0, 100));

        // Close PRD modal
        this.closeArchitectPrdModal();

        // Set architect mode
        this.architectMode = true;
        this.architectDocument = initialDocument;

        // Start new chat for architect mode
        this.startNewChat(true); // Pass true to indicate architect mode

        // Show architect sidebar
        const architectSidebar = document.getElementById('architectSidebar');
        architectSidebar.classList.add('show');

        // Update document content
        const documentContent = document.getElementById('architectDocumentContent');
        documentContent.textContent = initialDocument;

        // Initialize stats
        this.updateArchitectStats();

        // Hide main sidebar
        const mainSidebar = document.getElementById('chatgptSidebar');
        mainSidebar.classList.add('hidden');

        // Adjust main content
        const mainContent = document.querySelector('.main-content');
        const inputContainer = document.querySelector('.chat-input-container');
        mainContent.classList.add('architect-mode');
        inputContainer.classList.add('architect-mode');

        // Update placeholder
        const messageInput = document.getElementById('messageInput');
        messageInput.placeholder = 'Construa sua próxima grande ideia!';

        // Update sidebar width
        this.updateArchitectSidebarWidth();

        this.showNotification('Modo Arquiteto ativado');
    }

    exitArchitectMode() {
        if (!confirm('Deseja sair do Modo Arquiteto? O documento será salvo no chat.')) {
            return;
        }

        console.log('Exiting Architect Mode');

        // Reset architect mode
        this.architectMode = false;

        // Hide architect sidebar
        const architectSidebar = document.getElementById('architectSidebar');
        architectSidebar.classList.remove('show');

        // Show main sidebar
        const mainSidebar = document.getElementById('chatgptSidebar');
        mainSidebar.classList.remove('hidden');

        // Reset main content
        const mainContent = document.querySelector('.main-content');
        const inputContainer = document.querySelector('.chat-input-container');
        mainContent.classList.remove('architect-mode');
        inputContainer.classList.remove('architect-mode');

        // IMPORTANT: Reset inline styles that were set by updateArchitectSidebarWidth
        mainContent.style.marginRight = '';
        inputContainer.style.right = '';

        // Reset placeholder
        const messageInput = document.getElementById('messageInput');
        messageInput.placeholder = 'No que você está pensando?';

        this.showNotification('Modo Arquiteto desativado');
    }

    updateArchitectSidebarWidth() {
        const architectSidebar = document.getElementById('architectSidebar');
        const mainContent = document.querySelector('.main-content');
        const inputContainer = document.querySelector('.chat-input-container');

        architectSidebar.style.width = `${this.architectSidebarWidth}px`;

        if (this.architectMode) {
            // Sidebar is on the right, so adjust margin-right
            mainContent.style.marginRight = `${this.architectSidebarWidth}px`;
            inputContainer.style.right = `${this.architectSidebarWidth}px`;
        }
    }

    getArchitectDocument() {
        // Function to be called by AI via Function Calling
        // Get the most up-to-date content from the DOM
        const documentContent = document.getElementById('architectDocumentContent');
        const currentContent = documentContent ? documentContent.textContent : this.architectDocument;

        // Update internal state
        this.architectDocument = currentContent;

        return {
            success: true,
            document: currentContent || ''
        };
    }

    updateArchitectDocument(newContent) {
        // Function to be called by AI via Function Calling
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
    }

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
    }

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
    }

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

    applyTheme(themeName) {
        const starryContainer = document.getElementById('starrySkyContainer');
        if (!starryContainer) return;

        if (themeName === 'starry-sky') {
            starryContainer.style.display = 'block';
            this.initStarrySky();
        } else {
            starryContainer.style.display = 'none';
        }
    }

    initStarrySky() {
        const starryContainer = document.getElementById('starrySkyContainer');
        const starsContainer = starryContainer.querySelector('.stars');
        const shootingStarsContainer = starryContainer.querySelector('.shooting-stars');

        // Prevent recreating if already exists
        if (starsContainer.children.length > 0) return;

        // Create stars
        const starCount = 100;
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const size = Math.random() * 2 + 1; // 1 to 3px
            const duration = Math.random() * 3 + 2; // 2 to 5s
            const delay = Math.random() * 5;

            star.style.left = `${x}%`;
            star.style.top = `${y}%`;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.setProperty('--duration', `${duration}s`);
            star.style.animationDelay = `${delay}s`;

            starsContainer.appendChild(star);
        }

        // Create shooting stars
        const shootingStarCount = 3;
        for (let i = 0; i < shootingStarCount; i++) {
            const shootingStar = document.createElement('div');
            shootingStar.className = 'shooting-star';

            // Randomize start position to be outside the screen (Right or Bottom)
            // Since they move Top-Left (315deg), starting at Right or Bottom ensures they cross the screen
            if (Math.random() > 0.5) {
                // Start from Right edge
                shootingStar.style.left = '100%';
                shootingStar.style.top = `${Math.random() * 80}%`;
            } else {
                // Start from Bottom edge
                shootingStar.style.top = '100%';
                shootingStar.style.left = `${Math.random() * 80 + 20}%`;
            }

            // Longer duration for the whole cycle (mostly waiting)
            const duration = Math.random() * 10 + 10; // 10s to 20s cycle
            shootingStar.style.animationDuration = `${duration}s`;

            // Random delay to desync
            const delay = Math.random() * 10;
            shootingStar.style.animationDelay = `${delay}s`;

            shootingStarsContainer.appendChild(shootingStar);
        }
    }

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

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, inicializando OpenChat');
    window.openchat = new OpenChat();
});