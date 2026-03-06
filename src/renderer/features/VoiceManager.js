// VoiceManager.js — Módulo de reconhecimento de voz
// Extraído de renderer.js para reduzir a complexidade do arquivo principal.

const VoiceMethods = {

    handleVoiceInput() {
        const voiceBtn = document.getElementById('voiceBtn');
        const messageInput = document.getElementById('messageInput');

        if (this.isRecording) {
            this.recognition.stop();
            return;
        }

        if (!('webkitSpeechRecognition' in window)) {
            this.showNotification('Seu navegador não suporta reconhecimento de voz.');
            return;
        }

        if (!this.recognition) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.lang = 'pt-BR';
            this.recognition.continuous = false;
            this.recognition.interimResults = true;

            this.recognition.onstart = () => {
                this.isRecording = true;
                voiceBtn.classList.add('recording');
                voiceBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" stroke="red" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>`;
            };

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
                }
                if (finalTranscript) {
                    if (messageInput.value && !messageInput.value.endsWith(' ')) messageInput.value += ' ';
                    messageInput.value += finalTranscript;
                    this.autoResizeTextarea(messageInput);
                    this.updateSendButton();
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Erro de reconhecimento de voz:', event.error);
                this.isRecording = false;
                this.resetVoiceButton(voiceBtn);
                this.showNotification('Erro no reconhecimento de voz: ' + event.error);
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                this.resetVoiceButton(voiceBtn);
            };
        }

        try {
            this.recognition.start();
        } catch (e) {
            console.error('Erro ao iniciar gravação', e);
        }
    },

    resetVoiceButton(voiceBtn) {
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
            </svg>`;
    }
};
