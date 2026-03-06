const fs = require('fs');
const path = require('path');
const os = require('os');

function setupChatHandlers(ipcMain) {
    ipcMain.handle('save-chat', async (event, chatData) => {
        try {
            const chatsDir = path.join(os.homedir(), '.openchat', 'chats');

            if (!fs.existsSync(chatsDir)) {
                fs.mkdirSync(chatsDir, { recursive: true });
            }

            const chatFile = path.join(chatsDir, `${chatData.id}.json`);
            fs.writeFileSync(chatFile, JSON.stringify(chatData, null, 2));

            return { success: true };
        } catch (error) {
            console.error('Erro ao salvar chat:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('load-chat', async (event, chatId) => {
        try {
            const chatFile = path.join(os.homedir(), '.openchat', 'chats', `${chatId}.json`);

            if (fs.existsSync(chatFile)) {
                const chatData = JSON.parse(fs.readFileSync(chatFile, 'utf8'));
                return { success: true, chat: chatData };
            } else {
                return { success: false, error: 'Chat não encontrado' };
            }
        } catch (error) {
            console.error('Erro ao carregar chat:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-chat-list', async () => {
        try {
            const chatsDir = path.join(os.homedir(), '.openchat', 'chats');

            if (!fs.existsSync(chatsDir)) {
                return { success: true, chats: [] };
            }

            const files = fs.readdirSync(chatsDir);
            const chats = [];

            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const chatData = JSON.parse(fs.readFileSync(path.join(chatsDir, file), 'utf8'));
                        chats.push({
                            id: chatData.id,
                            title: chatData.title,
                            lastMessage: chatData.lastMessage,
                            updatedAt: chatData.updatedAt,
                            createdAt: chatData.createdAt
                        });
                    } catch (error) {
                        console.error(`Erro ao ler chat ${file}:`, error);
                    }
                }
            }

            chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            return { success: true, chats };
        } catch (error) {
            console.error('Erro ao listar chats:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-chat', async (event, chatId) => {
        try {
            const chatFile = path.join(os.homedir(), '.openchat', 'chats', `${chatId}.json`);

            if (fs.existsSync(chatFile)) {
                fs.unlinkSync(chatFile);
                return { success: true };
            } else {
                return { success: false, error: 'Chat não encontrado' };
            }
        } catch (error) {
            console.error('Erro ao deletar chat:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = setupChatHandlers;
