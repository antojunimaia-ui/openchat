const { ipcMain } = require('electron');
const fs = require('fs');

// Polyfill for pdf-parse (needs DOMMatrix in newer Node versions)
if (typeof DOMMatrix === 'undefined') {
    global.DOMMatrix = class DOMMatrix { };
}
const pdf = require('pdf-parse');

function setupFileHandlers() {
    ipcMain.handle('parse-file', async (event, filePath) => {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error('Arquivo não encontrado');
            }

            const ext = filePath.split('.').pop().toLowerCase();

            if (ext === 'txt') {
                const text = fs.readFileSync(filePath, 'utf-8');
                return { success: true, text, type: 'txt' };
            } else if (ext === 'pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                try {
                    const data = await pdf(dataBuffer);
                    return { success: true, text: data.text, type: 'pdf' };
                } catch (pdfError) {
                    console.error('Erro ao analisar PDF:', pdfError);
                    return { success: false, error: 'Falha ao ler o PDF: ' + pdfError.message };
                }
            } else {
                return { success: false, error: 'Formato de arquivo não suportado (.txt e .pdf apenas)' };
            }
        } catch (error) {
            console.error('Erro em parse-file:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { setupFileHandlers };
