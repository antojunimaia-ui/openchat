// MemoryManager.js — Módulo responsável por gerenciar as memórias do assistente
// Extraído de renderer.js para reduzir a complexidade do arquivo principal.

const MemoryMethods = {

    async loadMemoriesSection() {
        const memoriesList = document.getElementById('memoriesList');
        if (!memoriesList) return;

        memoriesList.innerHTML = '<p class="loading-memories">Carregando memórias...</p>';

        try {
            if (window.electronAPI && window.electronAPI.getMemories) {
                const result = await window.electronAPI.getMemories();
                if (result.success) {
                    this.renderMemories(result.memories);
                } else {
                    memoriesList.innerHTML = `<p class="error-memories">Erro ao carregar memórias: ${result.error}</p>`;
                }
            } else {
                memoriesList.innerHTML = '<p class="error-memories">API de memórias não disponível</p>';
            }
        } catch (error) {
            console.error('Erro ao buscar memórias:', error);
            memoriesList.innerHTML = `<p class="error-memories">Erro: ${error.message}</p>`;
        }
    },

    renderMemories(memories) {
        const memoriesList = document.getElementById('memoriesList');
        if (!memoriesList) return;

        if (!memories || memories.length === 0) {
            memoriesList.innerHTML = `
                <div class="no-memories">
                    <p>Nenhuma memória encontrada.</p>
                    <p class="small">A IA salvará memórias automaticamente quando você compartilhar informações importantes.</p>
                </div>
            `;
            return;
        }

        // Sort by date (newest first)
        const sortedMemories = [...memories].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        memoriesList.innerHTML = sortedMemories.map(memory => {
            const date = new Date(memory.createdAt);
            const formattedDate = date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const categoryIcons = {
                personal: '👤',
                preference: '⚙️',
                work: '💼',
                fact: '📌',
                important_event: '⭐',
                general: '💭'
            };

            const categoryIcon = categoryIcons[memory.category] || '💭';

            return `
                <div class="memory-item" data-id="${memory.id}">
                    <div class="memory-header">
                        <span class="memory-category" title="${memory.category}">
                            ${categoryIcon} ${this.formatCategoryName(memory.category)}
                        </span>
                        <span class="memory-date">${formattedDate}</span>
                    </div>
                    <div class="memory-content">${memory.content}</div>
                    <div class="memory-actions">
                        <button class="delete-memory-btn" onclick="window.openchat.deleteMemory('${memory.id}')" title="Excluir memória">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    formatCategoryName(category) {
        const names = {
            personal: 'Pessoal',
            preference: 'Preferência',
            work: 'Trabalho',
            fact: 'Fato',
            important_event: 'Evento Importante',
            general: 'Geral'
        };
        return names[category] || category;
    },

    async deleteMemory(memoryId) {
        if (!confirm('Tem certeza que deseja excluir esta memória?')) return;

        try {
            if (window.electronAPI && window.electronAPI.deleteMemory) {
                const result = await window.electronAPI.deleteMemory(memoryId);
                if (result.success) {
                    this.showNotification('Memória excluída com sucesso');
                    this.loadMemoriesSection();
                } else {
                    this.showNotification(`Erro ao excluir memória: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Erro ao excluir memória:', error);
            this.showNotification(`Erro: ${error.message}`);
        }
    }
};
