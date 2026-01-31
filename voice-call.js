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

        // Three.js Context
        this.threeCtx = null;

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

        // Initialize Three.js visualization
        this.initThreeJS();

        // Greet user
        this.speakAI('Olá! Como posso ajudar você hoje?');

        console.log('Voice call started');
    }

    endCall() {
        if (!this.isCallActive) return;

        this.isCallActive = false;

        // Stop voice recognition
        this.stopVoiceRecognition();

        // Stop Three.js visualization
        this.stopThreeJS();

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

    initThreeJS() {
        // Wait for Three.js to be loaded
        if (!window.THREE) {
            console.warn('Three.js not loaded, skipping visualization');
            return;
        }

        const container = document.querySelector('.orb-core');
        if (!container) return;

        // Clean up any existing content
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const h = container.clientHeight;
        const w = container.clientWidth;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(w, h);
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const clock = new THREE.Clock();

        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            precision mediump float;
            uniform vec2 iResolution;
            uniform float iTime;
            varying vec2 vUv;

            #define t iTime
            
            mat2 m(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

            // Mapeamento mais intenso e caótico
            float map(vec3 p){
                p.xz *= m(t * 0.4);
                p.xy *= m(t * 0.3);
                // Multiplicador de 3.5 para aumentar a densidade dos detalhes
                vec3 q = p * 3.5 + t;
                return length(p + vec3(sin(t * 0.7))) * log(length(p) + 1.2)
                       + sin(q.x + sin(q.z + sin(q.y))) * 0.8 - 1.0;
            }

            void main() {
                vec2 uv = vUv * 2.0 - 1.0;
                uv.x *= iResolution.x / iResolution.y;

                vec3 col = vec3(0.0);
                float d = 1.5;

                // Loop de Ray-marching com mais brilho
                for (int i = 0; i <= 8; i++) {
                    vec3 p = vec3(0, 0, 3.5) + normalize(vec3(uv, -1.2)) * d;
                    float rz = map(p);
                    // Aumentamos o contraste do fator 'f'
                    float f = clamp((rz - map(p + 0.05)) * 0.8, 0.0, 1.0);

                    // Branco puro mais forte (multiplicador 1.5)
                    vec3 base = vec3(0.02) + vec3(1.5, 1.5, 1.5) * f;
                    
                    col = col * base + smoothstep(2.5, 0.0, rz) * 0.9 * base;
                    d += min(rz, 0.5);
                }

                // Máscara de círculo
                float dist = length(uv);
                float circleMask = smoothstep(1.0, 0.97, dist);
                
                // Vinheta para focar no centro
                float vignette = smoothstep(1.1, 0.1, dist);

                // Elevando col à potência para aumentar o contraste (efeito líquido denso)
                col = pow(col, vec3(1.2));

                gl_FragColor = vec4(col * vignette, circleMask);
            }
        `;

        const uniforms = {
            iTime: { value: 0 },
            iResolution: { value: new THREE.Vector2(w, h) }
        };

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms,
            transparent: true
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        const onResize = () => {
            if (!container) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            renderer.setSize(w, h);
            uniforms.iResolution.value.set(w, h);
        };

        window.addEventListener('resize', onResize);

        const animate = () => {
            if (!this.threeCtx) return;

            uniforms.iTime.value = clock.getElapsedTime();
            renderer.render(scene, camera);

            this.threeCtx.animationId = requestAnimationFrame(animate);
        };

        this.threeCtx = {
            renderer,
            scene,
            camera,
            clock,
            mesh,
            material,
            uniforms,
            animationId: null,
            resizeHandler: onResize,
            container: container
        };

        animate();
    }

    stopThreeJS() {
        if (this.threeCtx) {
            // Cancel animation loop
            if (this.threeCtx.animationId) {
                cancelAnimationFrame(this.threeCtx.animationId);
            }

            // Remove event listener
            if (this.threeCtx.resizeHandler) {
                window.removeEventListener('resize', this.threeCtx.resizeHandler);
            }

            // Dispose Three.js resources
            if (this.threeCtx.material) {
                this.threeCtx.material.dispose();
            }
            if (this.threeCtx.mesh && this.threeCtx.mesh.geometry) {
                this.threeCtx.mesh.geometry.dispose();
            }
            if (this.threeCtx.renderer) {
                this.threeCtx.renderer.dispose();
                // Remove canvas from DOM
                if (this.threeCtx.renderer.domElement && this.threeCtx.renderer.domElement.parentNode) {
                    this.threeCtx.renderer.domElement.parentNode.removeChild(this.threeCtx.renderer.domElement);
                }
            }

            this.threeCtx = null;
        }
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
