const { shell } = require('electron');

function setupWindowHandlers(ipcMain, getMainWindow) {
    ipcMain.handle('window-minimize', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.minimize();
        }
    });

    ipcMain.handle('window-maximize', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.handle('window-close', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.close();
        }
    });

    ipcMain.handle('window-is-maximized', () => {
        const mainWindow = getMainWindow();
        return mainWindow ? mainWindow.isMaximized() : false;
    });

    // Open external links
    ipcMain.handle('open-external', async (event, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            console.error('Erro ao abrir link externo:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = setupWindowHandlers;
