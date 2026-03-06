const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const fsSync = require('fs');

function setupMemoryHandlers(ipcMain) {
    ipcMain.handle('save-memory', async (event, memoryData) => {
        try {
            const memoriesDir = path.join(os.homedir(), '.openchat', 'memories');

            if (!fsSync.existsSync(memoriesDir)) {
                fsSync.mkdirSync(memoriesDir, { recursive: true });
            }

            const memoriesFile = path.join(memoriesDir, 'memories.json');
            let memories = [];

            if (fsSync.existsSync(memoriesFile)) {
                const data = await fs.readFile(memoriesFile, 'utf8');
                memories = JSON.parse(data);
            }

            const newMemory = {
                id: 'mem-' + Date.now(),
                content: memoryData.content,
                category: memoryData.category || 'general',
                importance: memoryData.importance || 'medium',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            memories.push(newMemory);
            await fs.writeFile(memoriesFile, JSON.stringify(memories, null, 2), 'utf8');

            return { success: true, memory: newMemory };
        } catch (error) {
            console.error('Erro ao salvar memória:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-memory', async (event, memoryId, newContent) => {
        try {
            const memoriesFile = path.join(os.homedir(), '.openchat', 'memories', 'memories.json');

            if (!fsSync.existsSync(memoriesFile)) {
                return { success: false, error: 'Nenhuma memória encontrada' };
            }

            const data = await fs.readFile(memoriesFile, 'utf8');
            let memories = JSON.parse(data);

            const memoryIndex = memories.findIndex(m => m.id === memoryId);
            if (memoryIndex === -1) {
                return { success: false, error: 'Memória não encontrada' };
            }

            memories[memoryIndex].content = newContent;
            memories[memoryIndex].updatedAt = new Date().toISOString();

            await fs.writeFile(memoriesFile, JSON.stringify(memories, null, 2), 'utf8');

            return { success: true, memory: memories[memoryIndex] };
        } catch (error) {
            console.error('Erro ao atualizar memória:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-memories', async () => {
        try {
            const memoriesFile = path.join(os.homedir(), '.openchat', 'memories', 'memories.json');

            if (!fsSync.existsSync(memoriesFile)) {
                return { success: true, memories: [] };
            }

            const data = await fs.readFile(memoriesFile, 'utf8');
            const memories = JSON.parse(data);

            return { success: true, memories };
        } catch (error) {
            console.error('Erro ao buscar memórias:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-memory', async (event, memoryId) => {
        try {
            const memoriesFile = path.join(os.homedir(), '.openchat', 'memories', 'memories.json');

            if (!fsSync.existsSync(memoriesFile)) {
                return { success: false, error: 'Nenhuma memória encontrada' };
            }

            const data = await fs.readFile(memoriesFile, 'utf8');
            let memories = JSON.parse(data);

            memories = memories.filter(m => m.id !== memoryId);
            await fs.writeFile(memoriesFile, JSON.stringify(memories, null, 2), 'utf8');

            return { success: true };
        } catch (error) {
            console.error('Erro ao deletar memória:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = setupMemoryHandlers;
