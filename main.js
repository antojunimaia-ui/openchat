const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const ContentFilter = require('./content_filter');
const { autoUpdater } = require('electron-updater');
const mcpManager = require('./mcp_manager');

const setupWindowHandlers = require('./src/main/ipc/windowHandlers');
const setupChatHandlers = require('./src/main/ipc/chatHandlers');
const setupMemoryHandlers = require('./src/main/ipc/memoryHandlers');
const { setupFileHandlers } = require('./src/main/ipc/fileHandlers');
const { setupImageHandlers } = require('./src/main/ipc/imageHandlers');

const { webSearch, webScrape } = require('./src/main/services/webScraper');
const { callGeminiAPI, callMistralAPI, callZaiAPI, callOpenRouterAPI } = require('./src/main/services/aiProviders');

let mainWindow;
let contentFilter;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    frame: false,
    show: false
  });

  mainWindow.loadFile('index.html');

  // Mostrar janela quando estiver pronta
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abrir DevTools em modo de desenvolvimento
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // Inicializar filtro de conteúdo (JavaScript puro - sem dependências)
  contentFilter = new ContentFilter();
  console.log('✅ Content filter inicializado (JavaScript)');

  createWindow();

  // Set up modular IPC handlers
  // Initialize handlers extracted to separate files
  setupWindowHandlers(ipcMain, () => mainWindow);
  setupChatHandlers(ipcMain);
  setupMemoryHandlers(ipcMain);
  setupFileHandlers();
  setupImageHandlers();

  // Inicializar auto-updater
  autoUpdater.checkForUpdatesAndNotify().catch(err => console.error('Erro no auto-updater:', err));

  // Inicializar MCP Servers
  mcpManager.loadServers();

  autoUpdater.on('update-available', () => {
    if (mainWindow) {
      mainWindow.webContents.send('updater-message', { type: 'available', message: 'Nova atualização disponível! Baixando em background...' });
    }
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) {
      mainWindow.webContents.send('updater-message', { type: 'downloaded', message: 'Atualização baixada. O app será atualizado ao reiniciar.' });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handler para ler o system prompt
ipcMain.handle('read-system-prompt', async () => {
  try {
    const promptPath = path.join(__dirname, 'system-prompt.txt');
    console.log('Tentando ler system prompt de:', promptPath);
    const promptContent = await fs.readFile(promptPath, 'utf8');
    console.log('System prompt lido com sucesso. Tamanho:', promptContent.length, 'caracteres');
    console.log('Primeiros 100 caracteres:', promptContent.substring(0, 100));
    return { success: true, prompt: promptContent.trim() };
  } catch (error) {
    console.error('Erro ao ler system prompt:', error);
    // Retorna prompt padrão se não conseguir ler o arquivo
    return {
      success: false,
      prompt: 'Você é um assistente útil e amigável. Responda de forma clara e concisa, sempre tentando ser prestativo e educativo.',
      error: error.message
    };
  }
});

// IPC Handler para salvar o system prompt
ipcMain.handle('save-system-prompt', async (event, promptText) => {
  try {
    const promptPath = path.join(__dirname, 'system-prompt.txt');
    await fs.writeFile(promptPath, promptText, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar system prompt:', error);
    return { success: false, error: error.message };
  }
});


// IPC Handler for fetching Open Router models
ipcMain.handle('fetch-openrouter-models', async (event, apiKey) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://openchat.ai', // Optional
        'X-Title': 'OpenChat', // Optional
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || response.statusText);
    }

    const data = await response.json();
    return { success: true, models: data.data };
  } catch (error) {
    console.error('Error fetching Open Router models:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler para servidores MCP
ipcMain.handle('get-mcp-servers', async () => {
  try {
    const os = require('os');
    const serversPath = path.join(os.homedir(), '.openchat', 'mcp_servers.json');
    if (!require('fs').existsSync(serversPath)) {
      return { success: true, servers: {} };
    }
    const data = await fs.readFile(serversPath, 'utf8');
    const config = JSON.parse(data);
    return { success: true, servers: config.servers || {} };
  } catch (error) {
    console.error('Erro ao ler servidores MCP:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-mcp-servers', async (event, servers) => {
  try {
    const os = require('os');
    const serversPath = path.join(os.homedir(), '.openchat', 'mcp_servers.json');
    await fs.writeFile(serversPath, JSON.stringify({ servers }, null, 2), 'utf8');

    // Recarregar os servidores no main process
    mcpManager.reloadServers();

    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar servidores MCP:', error);
    return { success: false, error: error.message };
  }
});

// Função para carregar o system prompt
async function loadSystemPrompt() {
  try {
    const promptPath = path.join(__dirname, 'system-prompt.txt');
    const promptContent = await fs.readFile(promptPath, 'utf8');
    return promptContent.trim();
  } catch (error) {
    console.error('Erro ao carregar system prompt no main.js:', error);
    return 'Você é um assistente útil e amigável. Responda de forma clara e concisa, sempre tentando ser prestativo e educativo.';
  }
}

// Função para carregar memórias
async function loadMemories() {
  try {
    const os = require('os');
    const memoriesFile = path.join(os.homedir(), '.openchat', 'memories', 'memories.json');

    if (!require('fs').existsSync(memoriesFile)) {
      return { success: true, memories: [] };
    }

    const data = await fs.readFile(memoriesFile, 'utf8');
    const memories = JSON.parse(data);

    return { success: true, memories };
  } catch (error) {
    console.error('Erro ao carregar memórias:', error);
    return { success: true, memories: [] };
  }
}



// ─── Executar uma tool call individual ──────────────────────────────────────
async function executeTool(toolCall, event) {
  const { name, arguments: args } = toolCall;
  console.log(`[Tool] Executando: ${name}`, args);

  if (name === 'save_memory') {
    const os = require('os');
    const memoriesDir = path.join(os.homedir(), '.openchat', 'memories');
    if (!require('fs').existsSync(memoriesDir)) require('fs').mkdirSync(memoriesDir, { recursive: true });
    const memoriesFile = path.join(memoriesDir, 'memories.json');
    let memories = [];
    if (require('fs').existsSync(memoriesFile)) {
      memories = JSON.parse(await fs.readFile(memoriesFile, 'utf8'));
    }
    const newMemory = {
      id: 'mem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      content: args.content,
      category: args.category || 'general',
      importance: args.importance || 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memories.push(newMemory);
    await fs.writeFile(memoriesFile, JSON.stringify(memories, null, 2), 'utf8');
    console.log('[Tool] Memória salva:', newMemory.id);
    return { success: true, memory: newMemory };
  }

  if (name === 'update_memory') {
    const os = require('os');
    const memoriesFile = path.join(os.homedir(), '.openchat', 'memories', 'memories.json');
    if (require('fs').existsSync(memoriesFile)) {
      const memories = JSON.parse(await fs.readFile(memoriesFile, 'utf8'));
      const idx = memories.findIndex(m => m.id === args.memory_id);
      if (idx !== -1) {
        memories[idx].content = args.new_content;
        memories[idx].updatedAt = new Date().toISOString();
        await fs.writeFile(memoriesFile, JSON.stringify(memories, null, 2), 'utf8');
        return { success: true, memory: memories[idx] };
      }
      return { success: false, error: 'Memória não encontrada' };
    }
    return { success: false, error: 'Arquivo de memórias não encontrado' };
  }

  if (name === 'get_architect_document') {
    try {
      const doc = await event.sender.executeJavaScript('window.openchat.getArchitectDocument()');
      console.log('[Tool] Documento lido. Tamanho:', doc?.document?.length ?? 0);
      return doc;
    } catch (err) {
      return { success: false, error: 'Erro ao ler documento: ' + err.message };
    }
  }

  if (name === 'update_architect_document') {
    try {
      const result = await event.sender.executeJavaScript(
        `window.openchat.updateArchitectDocument(${JSON.stringify(args.new_content)})`
      );
      return result;
    } catch (err) {
      return { success: false, error: 'Erro ao atualizar documento: ' + err.message };
    }
  }

  if (name === 'web_search') return await webSearch(args.query);
  if (name === 'web_scrape') return await webScrape(args.url);

  // MCP fallback
  const mcpResult = await mcpManager.handleToolCall(name, args);
  if (mcpResult) return mcpResult;

  return { success: false, error: 'Ferramenta desconhecida: ' + name };
}

// ─── Indicador visual de tool call ───────────────────────────────────────────
function buildToolIndicator(name) {
  const icons = {
    get_architect_document: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
    update_architect_document: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    web_search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    web_scrape: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7"></path><path d="M3 9h18"></path></svg>'
  };
  const labels = {
    get_architect_document: 'Lendo documento',
    update_architect_document: 'Escrevendo documento',
    web_search: 'Buscando na web...',
    web_scrape: 'Lendo página...'
  };
  const icon = icons[name] || '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
  const label = labels[name] || ('Executando ' + name.replace(/_/g, ' ') + '...');
  const cls = name === 'get_architect_document' ? 'reading-document'
    : name === 'update_architect_document' ? 'writing-document'
      : name;
  return `<div class="function-indicator ${cls}">${icon}<span>${label}</span></div>`;
}

// IPC handlers para comunicação com o renderer
ipcMain.handle('send-message', async (event, messageData) => {
  console.log('Mensagem recebida:', messageData?.text?.substring(0, 80));

  try {
    // ===== FILTRO DE CONTEÚDO =====
    if (contentFilter) {
      const filterResult = contentFilter.analyze(messageData.text);
      if (!filterResult.allowed) {
        console.log('🔒 Mensagem bloqueada:', filterResult.reason);
        return { success: false, error: 'Sua mensagem foi bloqueada por violar as políticas de uso.', blocked: true, reason: filterResult.reason, threat_level: filterResult.threat_level };
      }
    }

    const systemPrompt = await loadSystemPrompt();

    // ─── Memórias ──────────────────────────────────────────────────────
    const memoriesResult = await loadMemories();
    let memoriesPrompt = '';
    if (memoriesResult.success && memoriesResult.memories.length > 0) {
      memoriesPrompt = '\n\n=== CONTEXTO PESSOAL (USO INTERNO) ===\n';
      memoriesPrompt += 'Informações contextuais sobre o usuário (use APENAS quando relevante):\n\n';
      memoriesResult.memories.forEach((mem, i) => {
        memoriesPrompt += `${i + 1}. [${mem.category}] ${mem.content}\n`;
      });
      memoriesPrompt += '\n⚠️ Use memórias SOMENTE quando o tópico surgir naturalmente na conversa.\n';
      memoriesPrompt += '=== FIM DO CONTEXTO ===\n';
    }

    const settings = await getSettingsFromRenderer(event);
    if (!settings?.apis) return { success: false, error: 'Configurações de API não encontradas. Configure uma API nas configurações.' };

    const activeModel = settings.activeModel || 'gemini';
    const apiConfig = settings.apis[activeModel];
    if (!apiConfig?.enabled || !apiConfig?.apiKey) {
      return { success: false, error: `API ${activeModel} não configurada. Verifique as configurações.` };
    }

    // ─── System Prompt final ────────────────────────────────────────────
    let finalSystemPrompt = systemPrompt + memoriesPrompt;
    if (messageData.personalityPrompt) {
      finalSystemPrompt += '\n\nINSTRUÇÕES DE PERSONALIDADE:\n' + messageData.personalityPrompt;
    }

    // Instruções compactas — o Tool Calling é nativo, não precisa de formato de texto
    finalSystemPrompt += '\n\n=== SISTEMA DE MEMÓRIA ===\n';
    finalSystemPrompt += 'Use save_memory/update_memory SILENCIOSAMENTE quando o usuário revelar informações importantes.\n';
    finalSystemPrompt += 'NUNCA mencione que salvou algo. Use memórias SOMENTE quando o tópico for relevante.\n';
    finalSystemPrompt += '=== FIM ===\n';

    if (messageData.isArchitectMode) {
      finalSystemPrompt += '\n\n=== MODO ARQUITETO ===\n';
      finalSystemPrompt += 'Você está colaborando em um documento com o usuário.\n';
      if (messageData.architectDocument) {
        finalSystemPrompt += '📄 Documento atual:\n```\n' + messageData.architectDocument + '\n```\n\n';
      }
      finalSystemPrompt += 'Use get_architect_document() para ler o documento e update_architect_document() para atualizá-lo.\n';
      finalSystemPrompt += 'Ao chamar get_architect_document(), PARE imediatamente e aguarde o resultado.\n';
      finalSystemPrompt += '=== FIM ===\n';
    }

    finalSystemPrompt += '\n\n=== FERRAMENTAS DE PESQUISA WEB ===\n';
    finalSystemPrompt += 'Use web_search() para buscar informações atuais e web_scrape() para ler páginas específicas.\n';
    finalSystemPrompt += 'Após chamar qualquer uma dessas ferramentas, PARE e aguarde o resultado do sistema.\n';
    if (messageData.tool === 'searchWeb') {
      finalSystemPrompt += '⚠️ O usuário ATIVOU a busca na web — realize uma pesquisa AGORA MESMO antes de responder.\n';
    }
    finalSystemPrompt += mcpManager.getSystemPromptExtension();
    finalSystemPrompt += '=== FIM ===\n';

    // ─── Função interna para chamar o provider correto ──────────────────
    const callProvider = (msgData) => {
      if (activeModel === 'gemini') return callGeminiAPI(apiConfig, msgData, finalSystemPrompt, mainWindow);
      if (activeModel === 'mistral') return callMistralAPI(apiConfig, msgData, finalSystemPrompt, mainWindow);
      if (activeModel === 'zai') return callZaiAPI(apiConfig, msgData, finalSystemPrompt, mainWindow);
      if (activeModel === 'openrouter') return callOpenRouterAPI(apiConfig, msgData, finalSystemPrompt, mainWindow);
      throw new Error('Provider desconhecido: ' + activeModel);
    };

    // ─── Primeira chamada ────────────────────────────────────────────────
    let { text: responseText, toolCalls } = await callProvider(messageData);
    const allFunctionCalls = [];
    let finalResponseText = '';

    // Histórico da sessão de tool-calling (multi-turn)
    // Mantém o contexto entre iterações para que o modelo saiba o que aconteceu
    const toolTurnHistory = [
      ...(messageData.conversationHistory || []),
      { type: 'user', text: messageData.text }
    ];

    const SILENT_TOOLS = new Set(['save_memory', 'update_memory', 'update_architect_document']);
    const MAX_ITERATIONS = 6;

    for (let iter = 0; iter <= MAX_ITERATIONS; iter++) {
      const hasTools = toolCalls?.length > 0;

      // Acumular texto visível
      if (responseText?.trim()) {
        finalResponseText = finalResponseText
          ? (finalResponseText.trim() + '\n\n' + responseText.trim())
          : responseText.trim();
      }

      // Adicionar indicadores visuais das tools que precisam de feedback
      if (hasTools) {
        const visibleIndicators = toolCalls
          .filter(tc => !SILENT_TOOLS.has(tc.name))
          .map(tc => buildToolIndicator(tc.name))
          .join('');
        if (visibleIndicators) {
          finalResponseText = (finalResponseText + visibleIndicators).trim();
        }
      }

      // Sem tool calls? Encerra o loop
      if (!hasTools) break;
      if (iter === MAX_ITERATIONS) {
        console.warn('[Tool Loop] Limite de iterações atingido.');
        break;
      }

      // ─── Executar todas as tool calls ───────────────────────────────
      const toolResults = await Promise.all(
        toolCalls.map(async tc => ({
          toolCall: tc,
          result: await executeTool(tc, event)
        }))
      );

      // Registrar no histórico das tool calls
      toolResults.forEach(({ toolCall, result }) => {
        allFunctionCalls.push({ function: toolCall.name, arguments: toolCall.arguments, result });
      });

      // Tools que não precisam de continuação da IA
      const needsContinuation = toolCalls.some(tc => !SILENT_TOOLS.has(tc.name));
      if (!needsContinuation) break;

      // ─── Preparar mensagem de continuação ───────────────────────────
      // Monta o histórico completo incluindo os resultados das tools
      const historyWithTools = [
        ...toolTurnHistory,
        // Resposta da IA com as tool calls
        { type: 'bot', text: responseText || '' },
        // Resultados das tools como mensagem do sistema
        ...toolResults
          .filter(({ toolCall }) => !SILENT_TOOLS.has(toolCall.name))
          .map(({ toolCall, result }) => ({
            role: 'tool',
            name: toolCall.name,
            tool_call_id: toolCall.id,
            content: typeof result === 'string' ? result : JSON.stringify(result)
          }))
      ];

      console.log(`[Tool Loop] Continuação ${iter + 1}, ${toolResults.length} resultado(s) enviado(s) para a IA`);

      const continuationMsg = {
        ...messageData,
        text: '[SISTEMA] Resultados das ferramentas recebidos. Analise e responda ao usuário.',
        conversationHistory: historyWithTools,
        tool: null,
        image: null,
        isArchitectMode: false
      };

      const nextResponse = await callProvider(continuationMsg);
      responseText = nextResponse.text;
      toolCalls = nextResponse.toolCalls;
    }

    return {
      success: true,
      response: finalResponseText.trim(),
      functionCalls: allFunctionCalls,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    return { success: false, error: error.message || 'Erro interno do servidor' };
  }
});

// Função auxiliar para obter configurações
async function getSettingsFromRenderer(event) {
  // Solicita as configurações do renderer process
  return new Promise((resolve) => {
    event.sender.executeJavaScript('localStorage.getItem("openchat-settings")')
      .then(settingsString => {
        if (settingsString) {
          resolve(JSON.parse(settingsString));
        } else {
          resolve(null);
        }
      })
      .catch(() => resolve(null));
  });
}

ipcMain.handle('get-messages', async () => {
  return [
    { id: 1, text: 'Bem-vindo ao OpenChat!', timestamp: Date.now(), type: 'system' }
  ];
});

ipcMain.handle('get-settings', async () => {
  // Em uma aplicação real, você carregaria de um arquivo de configuração
  // Por agora, retornamos null para que o renderer use localStorage
  return null;
});

ipcMain.handle('save-settings', async (event, settings) => {
  // Em uma aplicação real, você salvaria em um arquivo de configuração
  console.log('Configurações salvas:', settings);
  return { success: true };
});



