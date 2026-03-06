// ThemeUI.js — Módulo responsável por temas e efeitos visuais
// Extraído de renderer.js para reduzir a complexidade do arquivo principal.

const ThemeMethods = {

    applyTheme(themeName) {
        const starryContainer = document.getElementById('starrySkyContainer');
        const auroraContainer = document.getElementById('auroraContainer');
        const crimsonContainer = document.getElementById('crimsonContainer');

        const debug = this.settings?.debug || {};

        // Reset all specific theme containers
        if (starryContainer) starryContainer.style.display = 'none';
        if (auroraContainer) auroraContainer.style.display = 'none';
        if (crimsonContainer) crimsonContainer.style.display = 'none';

        if (themeName === 'starry-sky' || debug.forceStarry) {
            if (starryContainer) {
                starryContainer.style.display = 'block';
                this.initStarrySky();
            }
        }

        if (themeName === 'aurora' || debug.forceAurora) {
            if (auroraContainer) {
                auroraContainer.style.display = 'block';
            }
        }

        if (themeName === 'crimson') {
            if (crimsonContainer) {
                crimsonContainer.style.display = 'block';
            }
        }
    },

    initStarrySky() {
        const starryContainer = document.getElementById('starrySkyContainer');
        if (!starryContainer) return;

        const starsContainer = starryContainer.querySelector('.stars');
        const shootingStarsContainer = starryContainer.querySelector('.shooting-stars');

        if (!starsContainer || !shootingStarsContainer) return;

        // Prevent recreating if already exists
        if (starsContainer.children.length > 0) return;

        // Create stars
        const starCount = 100;
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const size = Math.random() * 2 + 1;
            const duration = Math.random() * 3 + 2;
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

            if (Math.random() > 0.5) {
                shootingStar.style.left = '100%';
                shootingStar.style.top = `${Math.random() * 80}%`;
            } else {
                shootingStar.style.top = '100%';
                shootingStar.style.left = `${Math.random() * 80 + 20}%`;
            }

            const duration = Math.random() * 10 + 10;
            shootingStar.style.animationDuration = `${duration}s`;
            const delay = Math.random() * 10;
            shootingStar.style.animationDelay = `${delay}s`;

            shootingStarsContainer.appendChild(shootingStar);
        }
    },

    initSnowEffect() {
        const now = new Date();
        const month = now.getMonth();
        const debug = this.settings?.debug || {};
        const isChristmasSeason = (month === 11) || (month === 0 && now.getDate() <= 6) || debug.forceSnow;

        // Garantir que o container esteja visível ou oculto conforme a configuração
        const snowContainer = document.getElementById('snowContainer');
        if (snowContainer) {
            snowContainer.style.display = isChristmasSeason ? 'block' : 'none';
        }

        if (isChristmasSeason) {
            console.log('❄️ Iniciando efeito de neve. Force:', debug.forceSnow);
            if (this.snowInterval) clearInterval(this.snowInterval);
            this.createSnow();
            this.snowInterval = setInterval(() => this.createSnow(), 300);
        } else {
            if (this.snowInterval) {
                clearInterval(this.snowInterval);
                this.snowInterval = null;
            }
            // Limpar flocos existentes se houver
            if (snowContainer) snowContainer.innerHTML = '';
        }
    },

    createSnow() {
        const snowContainer = document.getElementById('snowContainer') || this.createSnowContainer();
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.innerHTML = '❄';

        // Estilos aleatórios
        const startX = Math.random() * 100;
        snowflake.style.left = `${startX}vw`;
        snowflake.style.opacity = Math.random();
        snowflake.style.fontSize = (Math.random() * 10 + 10) + 'px';

        // Aplicar a animação definida no CSS
        const duration = Math.random() * 3 + 2;
        snowflake.style.animation = `fallWithWind ${duration}s linear infinite`;

        snowContainer.appendChild(snowflake);

        setTimeout(() => {
            snowflake.remove();
        }, duration * 1000);
    },

    createSnowContainer() {
        const container = document.createElement('div');
        container.className = 'snow-container';
        document.body.appendChild(container);
        return container;
    },

    initNewYearMessage() {
        const now = new Date();
        const year = now.getFullYear();
        const debug = this.settings?.debug || {};
        const isNewYear = (now.getMonth() === 0 && now.getDate() === 1) || debug.forceNewYear;
        const welcomeText = document.getElementById('welcomeText');

        if (isNewYear) {
            if (welcomeText) {
                welcomeText.textContent = `OpenChat te deseja um Feliz ${year}! 🎉`;
            }

            if (!localStorage.getItem('new-year-greeted-' + year) || debug.forceNewYear) {
                this.showNotification(`🎆 Feliz Ano Novo! Que ${year} seja repleto de conquistas!`, 'info', 10000);
                if (!debug.forceNewYear) {
                    localStorage.setItem('new-year-greeted-' + year, 'true');
                }
            }
        } else {
            if (welcomeText) {
                welcomeText.textContent = 'No que você está pensando hoje?';
            }
        }
    }
};
