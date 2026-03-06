// ThinkingManager.js — Módulo responsável pelo sistema de pensamento (Chain of Thought)
// Extraído de renderer.js para modularização.

const ThinkingMethods = {

    // ─── Processo Principal ──────────────────────────────────────────────────

    async startThinkingProcess(messageData) {
        console.log('🧠 Iniciando processo de pensamento...');

        if (this.currentThinkingWrapper) {
            console.log('⚠️ Limpando referências de pensamento anteriores');
            this.currentThinkingWrapper = null;
            this.currentThinkingId = null;
            this.isThinking = false;
        }

        if (!this.createThinkingWindow()) {
            console.error('❌ Falha ao criar janela de pensamento');
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        const thinkingPrompt = this.generateThinkingPrompt(messageData.text);
        await this.performThinking(thinkingPrompt, messageData);
    },

    // ─── Criação da UI de Pensamento ─────────────────────────────────────────

    createThinkingWindow() {
        console.log('🏗️ Criando janela de pensamento...');
        this.thinkingStartTime = Date.now();
        const thinkingId = 'thinking-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        let container = document.querySelector('.messages-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'messages-container';
            document.querySelector('.main-content').appendChild(container);
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'message bot thinking-message';
        wrapper.style.alignItems = 'flex-start';
        wrapper.style.width = '100%';
        wrapper.style.maxWidth = '700px';
        wrapper.style.margin = '0 auto';
        wrapper.setAttribute('data-thinking-id', thinkingId);

        wrapper.innerHTML = `
            <div class="thinking-window">
                <div class="thinking-header" id="${thinkingId}-header">
                    <div class="thinking-status" id="${thinkingId}-status">Pensando...</div>
                </div>
                <div class="thinking-content" id="${thinkingId}-content">
                    <div class="thinking-text" id="${thinkingId}-text"></div>
                </div>
            </div>`;

        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;

        this.currentThinkingWrapper = wrapper;
        this.currentThinkingId = thinkingId;

        return !!document.getElementById(`${thinkingId}-text`);
    },

    // ─── Lógica de Pensamento ────────────────────────────────────────────────

    generateThinkingPrompt(userMessage) {
        return `Você precisa analisar a mensagem do usuário antes de responder. Faça um Chain of Thought (CoT) pensando em primeira pessoa.

MENSAGEM DO USUÁRIO: "${userMessage}"

⚠️ REGRA: Se a mensagem for SIMPLES (oi, tudo bem, etc.), seja BREVE. Reserve análises profundas para questões complexas.

PROCESSO (seja conciso):
1. ANÁLISE INICIAL: O que foi pedido?
2. DECOMPOSIÇÃO: Partes do problema?
3. CONHECIMENTO: O que sei sobre isso?
4. ESTRUTURA: Como vou responder?

Responda APENAS com seu pensamento interno.`;
    },

    async performThinking(thinkingPrompt, originalMessageData) {
        try {
            this.isThinking = true;

            const thinkingData = {
                text: thinkingPrompt,
                tool: null,
                image: null,
                conversationHistory: originalMessageData.conversationHistory,
                personalityPrompt: `Você é um assistente que faz análises reflexivas. Use um tom natural (hmm, deixe-me ver...).`
            };

            if (window.electronAPI?.sendMessage) {
                const result = await window.electronAPI.sendMessage(thinkingData);

                if (result.success) {
                    await this.streamThinkingText(result.response);
                    this.finishThinking();
                    this.isThinking = false;

                    await new Promise(r => setTimeout(r, 500));
                    await this.sendActualResponse(originalMessageData, result.response);
                } else {
                    this.isThinking = false;
                    this.cancelThinking();
                    this.addMessage(`❌ Erro no pensamento: ${result.error}`, 'system');
                }
            }
        } catch (error) {
            console.error('Erro no Thinking:', error);
            this.isThinking = false;
            this.cancelThinking();
        }
    },

    // ─── Streaming do Texto de Pensamento ────────────────────────────────────

    async streamThinkingText(thinkingText) {
        if (!this.currentThinkingWrapper) return;

        const textEl = this.currentThinkingWrapper.querySelector('.thinking-text');
        if (!textEl) return;

        textEl.textContent = '';
        const words = thinkingText.split(' ');
        let current = '';

        for (let i = 0; i < words.length; i++) {
            if (!textEl.isConnected) break;
            current += (i > 0 ? ' ' : '') + words[i];
            textEl.innerHTML = current + '<span class="thinking-cursor"></span>';

            const content = this.currentThinkingWrapper.querySelector('.thinking-content');
            if (content) content.scrollTop = content.scrollHeight;

            await new Promise(r => setTimeout(r, 25));
        }

        if (textEl.isConnected) textEl.innerHTML = current;
    },

    // ─── Finalização e Resposta Real ─────────────────────────────────────────

    finishThinking() {
        if (!this.currentThinkingWrapper) return;

        const status = this.currentThinkingWrapper.querySelector('.thinking-status');
        if (status) {
            const elapsed = Math.floor((Date.now() - this.thinkingStartTime) / 1000);
            status.textContent = `Pensou por ${elapsed}s`;
            status.classList.add('completed');
        }
    },

    async sendActualResponse(originalData, thinkingContext) {
        const enhancedPrompt = `Use sua análise prévia para responder (não a mencione explicitamente):
        
        ANÁLISE: ${thinkingContext}`;

        const data = {
            ...originalData,
            thinkingContext,
            personalityPrompt: originalData.personalityPrompt + '\n\n' + enhancedPrompt
        };

        const isStreaming = this.settings.activeModel === 'mistral' || this.settings.activeModel === 'zai';

        if (isStreaming) this.startStreamingResponseWithThinking();
        else this.showTypingIndicatorWithThinking();

        if (window.electronAPI?.sendMessage) {
            const result = await window.electronAPI.sendMessage(data);
            if (!isStreaming) this.hideTypingIndicator();

            if (result.success) {
                // Lógica de memória resumida
                const memoryAction = result.functionCalls?.some(c => c.function.includes('memory') && c.result?.success) ? 'saved' : null;
                if (!isStreaming) this.addResponseToThinkingMessage(result.response, memoryAction);
            } else {
                this.addMessage(`❌ Erro: ${result.error}`, 'system');
            }
        }
    },

    addResponseToThinkingMessage(responseText, memoryAction = null) {
        if (!this.currentThinkingWrapper) return;
        this.isThinking = false;

        const botMessage = {
            id: Date.now(),
            text: responseText,
            type: 'bot',
            timestamp: new Date(),
            memoryAction,
            isPartOfThinking: true
        };
        this.messages.push(botMessage);

        const responseDiv = document.createElement('div');
        responseDiv.className = 'message-content';
        responseDiv.style.marginTop = '0px';

        if (memoryAction) {
            const indicator = document.createElement('div');
            indicator.className = 'memory-indicator';
            indicator.textContent = memoryAction === 'saved' ? 'Memória salva' : 'Memória atualizada';
            responseDiv.appendChild(indicator);
        }

        responseDiv.innerHTML += this.formatBotMessage(responseText);
        this.currentThinkingWrapper.appendChild(responseDiv);

        const container = document.querySelector('.messages-container');
        if (container) container.scrollTop = container.scrollHeight;

        this.currentThinkingWrapper = null;
        this.currentThinkingId = null;
    },

    // ─── Utilitários ─────────────────────────────────────────────────────────

    showTypingIndicatorWithThinking() {
        if (!this.currentThinkingWrapper) return;
        const typing = document.createElement('div');
        typing.className = 'typing-indicator';
        typing.id = 'typingIndicator';
        typing.style.marginTop = '16px';
        typing.innerHTML = `<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
        this.currentThinkingWrapper.appendChild(typing);
        const container = document.querySelector('.messages-container');
        if (container) container.scrollTop = container.scrollHeight;
    },

    startStreamingResponseWithThinking() {
        if (!this.currentThinkingWrapper) return;
        const div = document.createElement('div');
        div.className = 'message-content';
        div.style.marginTop = '16px';
        div.setAttribute('data-streaming', 'true');
        this.currentThinkingWrapper.appendChild(div);

        const message = {
            id: Date.now(),
            text: '',
            type: 'bot',
            timestamp: new Date(),
            streaming: true,
            isPartOfThinking: true,
            element: div
        };
        this.currentStreamingMessage = message;
        this.messages.push(message);
        const container = document.querySelector('.messages-container');
        if (container) container.scrollTop = container.scrollHeight;
    },

    cancelThinking() {
        this.isThinking = false;
        document.querySelector('.thinking-window')?.closest('.message.bot')?.remove();
        this.currentThinkingWrapper = null;
        this.currentThinkingId = null;
    }
};
