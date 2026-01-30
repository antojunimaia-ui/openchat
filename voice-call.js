// ========================================
// VOICE CALL SYSTEM
// ========================================

class VoiceCallManager {
    constructor() {
        this.isCallActive = false;
        this.isAIMuted = false;
        this.isUserMuted = false;
        this.isKeyboardMode = false;
        this.callStartTime = null;
        this.callDurationInterval = null;

        // Speech Recognition (User voice input)
        this.recognition = null;
        this.initSpeechRecognition();

        // Speech Synthesis (AI voice output)
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.currentAudio = null; // For ElevenLabs/Audio playback

        // Carrega vozes
        this.voices = [];
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = () => {
                this.voices = this.synthesis.getVoices();
                console.log('Vozes carregadas:', this.voices.length);
            };
        }
        // Tenta carregar imediatamente também
        this.voices = this.synthesis.getVoices();

        // DOM Elements
        this.voiceCallOverlay = document.getElementById('voiceCallOverlay');
        this.voiceOrb = document.getElementById('voiceOrb');
        this.voiceStatusText = document.getElementById('voiceStatusText');
        this.voiceDuration = document.getElementById('voiceDuration');
        this.muteAIBtn = document.getElementById('muteAIBtn');
        this.muteMicBtn = document.getElementById('muteMicBtn');
        this.keyboardInputBtn = document.getElementById('keyboardInputBtn');
        this.endCallBtn = document.getElementById('endCallBtn');
        this.voiceKeyboardPanel = document.getElementById('voiceKeyboardPanel');
        this.voiceKeyboardInput = document.getElementById('voiceKeyboardInput');
        this.voiceKeyboardSendBtn = document.getElementById('voiceKeyboardSendBtn');

        // Main elements to hide during call
        this.sidebar = document.querySelector('.chatgpt-sidebar');
        this.chatInputContainer = document.querySelector('.chat-input-container');
        this.mainContent = document.querySelector('.main-content');

        this.initEventListeners();
    }

    initSpeechRecognition() {
        // Initialize Web Speech API for voice recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'pt-BR';

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                if (finalTranscript) {
                    this.handleUserSpeech(finalTranscript);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'no-speech') {
                    // Restart recognition if it stopped due to no speech
                    if (this.isCallActive && !this.isUserMuted) {
                        this.recognition.start();
                    }
                }
            };

            this.recognition.onend = () => {
                // Restart recognition if call is still active
                if (this.isCallActive && !this.isUserMuted) {
                    this.recognition.start();
                }
            };
        } else {
            console.warn('Speech Recognition not supported in this browser');
        }
    }

    initEventListeners() {
        // Voice button to start call
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => this.startCall());
        }

        // Mute AI button
        if (this.muteAIBtn) {
            this.muteAIBtn.addEventListener('click', () => this.toggleAIMute());
        }

        // Mute Mic button
        if (this.muteMicBtn) {
            this.muteMicBtn.addEventListener('click', () => this.toggleMicMute());
        }

        // Keyboard input button
        if (this.keyboardInputBtn) {
            this.keyboardInputBtn.addEventListener('click', () => this.toggleKeyboard());
        }

        // End call button
        if (this.endCallBtn) {
            this.endCallBtn.addEventListener('click', () => this.endCall());
        }

        // Keyboard send button
        if (this.voiceKeyboardSendBtn) {
            this.voiceKeyboardSendBtn.addEventListener('click', () => this.sendKeyboardMessage());
        }

        // Keyboard input enter key
        if (this.voiceKeyboardInput) {
            this.voiceKeyboardInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendKeyboardMessage();
                }
            });
        }
    }

    startCall() {
        if (this.isCallActive) return;

        this.isCallActive = true;
        this.callStartTime = Date.now();

        // Show call overlay
        this.voiceCallOverlay.style.display = 'flex';

        // Hide main UI elements
        if (this.sidebar) this.sidebar.style.display = 'none';
        if (this.chatInputContainer) this.chatInputContainer.style.display = 'none';
        if (this.mainContent) this.mainContent.style.opacity = '0';

        // Start call duration timer
        this.startCallDurationTimer();

        // Start voice recognition
        if (!this.isUserMuted) {
            this.startVoiceRecognition();
        }

        // Greet user
        this.speakAI('Olá! Como posso ajudar você hoje?');

        console.log('Voice call started');
    }

    endCall() {
        if (!this.isCallActive) return;

        this.isCallActive = false;

        // Stop voice recognition
        this.stopVoiceRecognition();

        // Stop speech
        this.stopAudio();

        // Stop call duration timer
        if (this.callDurationInterval) {
            clearInterval(this.callDurationInterval);
            this.callDurationInterval = null;
        }

        // Hide call overlay
        this.voiceCallOverlay.style.display = 'none';

        // Show main UI elements
        if (this.sidebar) this.sidebar.style.display = '';
        if (this.chatInputContainer) this.chatInputContainer.style.display = '';
        if (this.mainContent) this.mainContent.style.opacity = '1';

        // Hide keyboard panel if open
        if (this.voiceKeyboardPanel) {
            this.voiceKeyboardPanel.style.display = 'none';
            this.isKeyboardMode = false;
        }

        // Reset mute states
        this.isAIMuted = false;
        this.isUserMuted = false;
        this.muteAIBtn.classList.remove('muted');
        this.muteMicBtn.classList.remove('muted');

        console.log('Voice call ended');
    }

    toggleAIMute() {
        this.isAIMuted = !this.isAIMuted;

        if (this.isAIMuted) {
            this.muteAIBtn.classList.add('muted');
            this.stopAudio(); // Stop current speech
            this.voiceStatusText.textContent = 'IA Mutada';
        } else {
            this.muteAIBtn.classList.remove('muted');
            this.voiceStatusText.textContent = 'Conectado';
        }
    }

    toggleMicMute() {
        this.isUserMuted = !this.isUserMuted;

        if (this.isUserMuted) {
            this.muteMicBtn.classList.add('muted');
            this.stopVoiceRecognition();
            this.voiceStatusText.textContent = 'Microfone Mutado';
        } else {
            this.muteMicBtn.classList.remove('muted');
            this.startVoiceRecognition();
            this.voiceStatusText.textContent = 'Conectado';
        }
    }

    toggleKeyboard() {
        this.isKeyboardMode = !this.isKeyboardMode;

        if (this.isKeyboardMode) {
            this.voiceKeyboardPanel.style.display = 'block';
            this.keyboardInputBtn.classList.add('active');
            setTimeout(() => this.voiceKeyboardInput.focus(), 100);
        } else {
            this.voiceKeyboardPanel.style.display = 'none';
            this.keyboardInputBtn.classList.remove('active');
        }
    }

    startVoiceRecognition() {
        if (this.recognition && !this.isUserMuted) {
            try {
                this.recognition.start();
                console.log('Voice recognition started');
            } catch (e) {
                console.warn('Recognition already started or error:', e);
            }
        }
    }

    stopVoiceRecognition() {
        if (this.recognition) {
            try {
                this.recognition.stop();
                console.log('Voice recognition stopped');
            } catch (e) {
                console.warn('Recognition error on stop:', e);
            }
        }
    }

    handleUserSpeech(transcript) {
        console.log('User said:', transcript);

        // Send to AI for processing
        this.sendToAI(transcript);
    }

    sendKeyboardMessage() {
        const message = this.voiceKeyboardInput.value.trim();

        if (message) {
            console.log('User typed:', message);
            this.voiceKeyboardInput.value = '';

            // Send to AI for processing
            this.sendToAI(message);
        }
    }

    async sendToAI(userMessage) {
        try {
            // Check if OpenChat instance exists
            if (window.openchat && typeof window.openchat.sendMessage === 'function') {
                // Use the existing OpenChat send message system
                const messageInput = document.getElementById('messageInput');
                if (messageInput) {
                    // Temporarily set the input value
                    messageInput.value = userMessage;

                    // Trigger the send message
                    await window.openchat.sendMessage();

                    // The bot response will be handled by OpenChat
                    // We need to monitor for bot messages and speak them
                    this.listenForBotResponse();
                }
            } else {
                // Fallback demo response if OpenChat not available
                console.warn('OpenChat not available, using demo response');
                const demoResponse = `Você disse: ${userMessage}. Esta é uma resposta de demonstração do modo de chamada de voz.`;
                this.speakAI(demoResponse);
            }
        } catch (error) {
            console.error('Error sending to AI:', error);
            this.speakAI('Desculpe, ocorreu um erro ao processar sua mensagem.');
        }
    }

    listenForBotResponse() {
        // Watch for new bot messages in the OpenChat system
        // This is a simplified approach - ideally you'd use events/callbacks
        setTimeout(() => {
            if (window.openchat && window.openchat.messages) {
                const lastMessage = window.openchat.messages[window.openchat.messages.length - 1];
                if (lastMessage && lastMessage.type === 'bot' && !lastMessage.voiceSpoken) {
                    // Mark as spoken to avoid speaking it multiple times
                    lastMessage.voiceSpoken = true;
                    this.speakAI(lastMessage.text);
                }
            }
        }, 1000); // Give it a second to process
    }

    stopAudio() {
        // Stop robotic voice
        if (this.synthesis) {
            this.synthesis.cancel();
        }

        // Stop Audio object (ElevenLabs)
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        this.voiceOrb.classList.remove('speaking');
        this.voiceOrb.classList.remove('thinking');
    }

    async speakAI(text) {
        if (this.isAIMuted || !text) return;

        // Stop any ongoing speech
        this.stopAudio();

        // Check for Voice Settings in OpenChat
        let voiceSettings = null;
        if (window.openchat && window.openchat.settings && window.openchat.settings.voice) {
            voiceSettings = window.openchat.settings.voice;
        }

        // Try ElevenLabs if configured
        if (voiceSettings && voiceSettings.type === 'elevenlabs' &&
            voiceSettings.elevenLabs && voiceSettings.elevenLabs.apiKey && voiceSettings.elevenLabs.voiceId) {

            const success = await this.speakElevenLabs(
                text,
                voiceSettings.elevenLabs.apiKey,
                voiceSettings.elevenLabs.voiceId
            );

            if (success) return; // If successful, we're done
            console.warn('Falling back to robotic voice');
        }

        // Fallback to Robotic Voice (Web Speech API)
        this.speakRobotic(text);
    }

    async speakElevenLabs(text, apiKey, voiceId) {
        try {
            console.log('Generating ElevenLabs audio...');
            this.voiceOrb.classList.add('thinking'); // Visual feedback for loading

            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail?.message || 'ElevenLabs API Error');
            }

            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);

            // If user muted while generating, don't play
            if (this.isAIMuted || !this.isCallActive) return true;

            const audio = new Audio(audioUrl);
            this.currentAudio = audio;

            this.voiceOrb.classList.remove('thinking');

            audio.onplay = () => {
                this.voiceOrb.classList.add('speaking');
            };

            audio.onended = () => {
                this.voiceOrb.classList.remove('speaking');
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
            };

            audio.onerror = (e) => {
                console.error('Audio playback error:', e);
                this.voiceOrb.classList.remove('speaking');
                this.voiceOrb.classList.remove('thinking');
            };

            await audio.play();
            return true;

        } catch (error) {
            console.error('ElevenLabs TTS failed:', error);
            this.voiceOrb.classList.remove('thinking');
            return false; // Return false to trigger fallback
        }
    }

    speakRobotic(text) {
        // Create new utterance
        this.currentUtterance = new SpeechSynthesisUtterance(text);

        // --- MELHORIA DE VOZ ---
        // Tenta encontrar a melhor voz possível em pt-BR
        const voices = this.synthesis.getVoices();

        // Prioridade para vozes 'Premium' ou 'Google' que costumam ser menos robóticas
        const preferredVoice = voices.find(voice =>
            voice.lang === 'pt-BR' && (
                voice.name.includes('Google') ||
                voice.name.includes('Microsoft') ||
                voice.name.includes('Natural')
            )
        ) || voices.find(voice => voice.lang === 'pt-BR');

        if (preferredVoice) {
            this.currentUtterance.voice = preferredVoice;
            console.log('Usando voz:', preferredVoice.name);
        } else {
            this.currentUtterance.lang = 'pt-BR';
        }

        // Ajustes finos para suavizar
        // Um pitch ligeiramente variado e velocidade normal ajudam na naturalidade
        this.currentUtterance.rate = 1.0; // Velocidade normal (1.0 a 1.2 é bom para fluidez)
        this.currentUtterance.pitch = 1.0; // Tom natural
        this.currentUtterance.volume = 1.0;
        // -----------------------

        // Add visual feedback
        this.currentUtterance.onstart = () => {
            this.voiceOrb.classList.add('speaking');
        };

        this.currentUtterance.onend = () => {
            this.voiceOrb.classList.remove('speaking');
        };

        this.currentUtterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            this.voiceOrb.classList.remove('speaking');
        };

        // Speak
        this.synthesis.speak(this.currentUtterance);
    }

    startCallDurationTimer() {
        this.updateCallDuration();
        this.callDurationInterval = setInterval(() => {
            this.updateCallDuration();
        }, 1000);
    }

    updateCallDuration() {
        if (!this.callStartTime) return;

        const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;

        const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        this.voiceDuration.textContent = formattedTime;
    }
}

// Initialize Voice Call Manager when DOM is ready
let voiceCallManager;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        voiceCallManager = new VoiceCallManager();
        console.log('Voice Call Manager initialized');
    });
} else {
    voiceCallManager = new VoiceCallManager();
    console.log('Voice Call Manager initialized');
}

// Export for use in renderer.js
window.voiceCallManager = voiceCallManager;
