const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const ContentFilter = require('./content_filter');

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

// ===== MEMORY SYSTEM =====
// IPC Handler para salvar memória
ipcMain.handle('save-memory', async (event, memoryData) => {
  try {
    const os = require('os');
    const memoriesDir = path.join(os.homedir(), '.openchat', 'memories');
    
    if (!require('fs').existsSync(memoriesDir)) {
      require('fs').mkdirSync(memoriesDir, { recursive: true });
    }
    
    const memoriesFile = path.join(memoriesDir, 'memories.json');
    let memories = [];
    
    // Carregar memórias existentes
    if (require('fs').existsSync(memoriesFile)) {
      const data = await fs.readFile(memoriesFile, 'utf8');
      memories = JSON.parse(data);
    }
    
    // Adicionar nova memória
    const newMemory = {
      id: 'mem-' + Date.now(),
      content: memoryData.content,
      category: memoryData.category || 'general',
      importance: memoryData.importance || 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    memories.push(newMemory);
    
    // Salvar
    await fs.writeFile(memoriesFile, JSON.stringify(memories, null, 2), 'utf8');
    
    return { success: true, memory: newMemory };
  } catch (error) {
    console.error('Erro ao salvar memória:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler para atualizar memória
ipcMain.handle('update-memory', async (event, memoryId, newContent) => {
  try {
    const os = require('os');
    const memoriesFile = path.join(os.homedir(), '.openchat', 'memories', 'memories.json');
    
    if (!require('fs').existsSync(memoriesFile)) {
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

// IPC Handler para buscar memórias
ipcMain.handle('get-memories', async () => {
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
    console.error('Erro ao buscar memórias:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler para deletar memória
ipcMain.handle('delete-memory', async (event, memoryId) => {
  try {
    const os = require('os');
    const memoriesFile = path.join(os.homedir(), '.openchat', 'memories', 'memories.json');
    
    if (!require('fs').existsSync(memoriesFile)) {
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

// Window control handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window-is-maximized', () => {
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

// Função para processar Function Calls na resposta da IA
async function processFunctionCalls(responseText, event) {
  console.log('=== PROCESSANDO FUNCTION CALLS ===');
  console.log('Texto completo recebido:', responseText);
  console.log('Tamanho do texto:', responseText.length);
  
  // Verificar se contém [FUNCTION_CALL]
  const hasFC = responseText.includes('[FUNCTION_CALL]');
  console.log('Contém [FUNCTION_CALL]?', hasFC);
  
  if (hasFC) {
    const startIndex = responseText.indexOf('[FUNCTION_CALL]');
    const endIndex = responseText.indexOf('[/FUNCTION_CALL]');
    console.log('Índice início:', startIndex);
    console.log('Índice fim:', endIndex);
    if (startIndex >= 0 && endIndex >= 0) {
      console.log('Conteúdo entre tags:', responseText.substring(startIndex, endIndex + 16));
    }
  }
  
  // Regex mais robusta que captura function calls em qualquer formato
  const functionCallRegex = /\[FUNCTION_CALL\]\s*([\s\S]*?)\s*\[\/FUNCTION_CALL\]/gi;
  const calls = [];
  let processedText = responseText;
  
  // Encontrar todas as matches primeiro
  const matches = [];
  let match;
  
  // Reset regex
  functionCallRegex.lastIndex = 0;
  
  while ((match = functionCallRegex.exec(responseText)) !== null) {
    matches.push({
      fullMatch: match[0],
      jsonContent: match[1].trim(),
      index: match.index
    });
  }
  
  console.log(`Encontradas ${matches.length} function calls na resposta`);
  
  // Se não encontrou com regex mas tem o texto, tentar manualmente
  if (matches.length === 0 && hasFC) {
    console.log('ATENÇÃO: Texto contém [FUNCTION_CALL] mas regex não encontrou!');
    console.log('Tentando extração manual...');
    
    const startTag = '[FUNCTION_CALL]';
    const endTag = '[/FUNCTION_CALL]';
    let startIndex = responseText.indexOf(startTag);
    
    while (startIndex !== -1) {
      const endIndex = responseText.indexOf(endTag, startIndex);
      if (endIndex !== -1) {
        const fullMatch = responseText.substring(startIndex, endIndex + endTag.length);
        const jsonContent = responseText.substring(startIndex + startTag.length, endIndex).trim();
        
        matches.push({
          fullMatch: fullMatch,
          jsonContent: jsonContent,
          index: startIndex
        });
        
        console.log('Match manual encontrado:', { fullMatch: fullMatch.substring(0, 100), jsonContent: jsonContent.substring(0, 100) });
        
        startIndex = responseText.indexOf(startTag, endIndex);
      } else {
        break;
      }
    }
    
    console.log(`Extração manual encontrou ${matches.length} function calls`);
  }
  
  // Processar cada match (em ordem reversa para não afetar os índices)
  for (let i = matches.length - 1; i >= 0; i--) {
    const matchData = matches[i];
    try {
      console.log('Processando function call:', matchData.jsonContent.substring(0, 100));
      
      const functionData = JSON.parse(matchData.jsonContent);
      const functionName = functionData.function;
      const args = functionData.arguments;
      
      console.log('Function call detectada:', functionName, args);
      
      let result;
      if (functionName === 'save_memory') {
        const os = require('os');
        const memoriesDir = path.join(os.homedir(), '.openchat', 'memories');
        
        if (!require('fs').existsSync(memoriesDir)) {
          require('fs').mkdirSync(memoriesDir, { recursive: true });
        }
        
        const memoriesFile = path.join(memoriesDir, 'memories.json');
        let memories = [];
        
        if (require('fs').existsSync(memoriesFile)) {
          const data = await fs.readFile(memoriesFile, 'utf8');
          memories = JSON.parse(data);
        }
        
        const newMemory = {
          id: 'mem-' + Date.now() + '-' + i,
          content: args.content,
          category: args.category || 'general',
          importance: args.importance || 'medium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        memories.push(newMemory);
        await fs.writeFile(memoriesFile, JSON.stringify(memories, null, 2), 'utf8');
        
        result = { success: true, memory: newMemory };
        console.log('Memória salva com sucesso:', newMemory.id);
      } else if (functionName === 'update_memory') {
        const os = require('os');
        const memoriesFile = path.join(os.homedir(), '.openchat', 'memories', 'memories.json');
        
        if (require('fs').existsSync(memoriesFile)) {
          const data = await fs.readFile(memoriesFile, 'utf8');
          let memories = JSON.parse(data);
          
          const memoryIndex = memories.findIndex(m => m.id === args.memory_id);
          if (memoryIndex !== -1) {
            memories[memoryIndex].content = args.new_content;
            memories[memoryIndex].updatedAt = new Date().toISOString();
            
            await fs.writeFile(memoriesFile, JSON.stringify(memories, null, 2), 'utf8');
            result = { success: true, memory: memories[memoryIndex] };
            console.log('Memória atualizada com sucesso:', args.memory_id);
          } else {
            result = { success: false, error: 'Memória não encontrada' };
          }
        }
      } else if (functionName === 'get_architect_document') {
        // Solicitar documento do renderer process
        try {
          const document = await event.sender.executeJavaScript('window.openchat.getArchitectDocument()');
          result = document;
          console.log('📄 Documento do Arquiteto lido. Tamanho:', document.document?.length || 0);
          console.log('📄 Primeiros 100 chars:', document.document?.substring(0, 100) || '(vazio)');
        } catch (error) {
          console.error('❌ Erro ao ler documento do Arquiteto:', error);
          result = { success: false, error: 'Erro ao ler documento' };
        }
      } else if (functionName === 'update_architect_document') {
        // Atualizar documento no renderer process
        try {
          const newContent = args.new_content;
          const updateResult = await event.sender.executeJavaScript(
            `window.openchat.updateArchitectDocument(${JSON.stringify(newContent)})`
          );
          result = updateResult;
          console.log('Documento do Arquiteto atualizado com sucesso');
        } catch (error) {
          console.error('Erro ao atualizar documento do Arquiteto:', error);
          result = { success: false, error: 'Erro ao atualizar documento' };
        }
      }
      
      calls.unshift({ // unshift porque estamos processando de trás pra frente
        function: functionName,
        arguments: args,
        result: result
      });
      
      // Add visual indicator for architect functions
      let indicator = '';
      if (functionName === 'get_architect_document') {
        indicator = '<div class="function-indicator reading-document"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg><span>Lendo documento</span></div>';
      } else if (functionName === 'update_architect_document') {
        indicator = '<div class="function-indicator writing-document"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><span>Escrevendo documento</span></div>';
      }
      
      // Remover a chamada de função do texto processado e adicionar indicador
      const before = processedText.substring(0, matchData.index);
      const after = processedText.substring(matchData.index + matchData.fullMatch.length);
      processedText = before + indicator + after;
      
      console.log('Function call removida do texto e indicador adicionado');
      
    } catch (error) {
      console.error('Erro ao processar function call:', error);
      console.error('JSON que causou erro:', matchData.jsonContent);
      // Mesmo com erro, remover o bloco de function call
      const before = processedText.substring(0, matchData.index);
      const after = processedText.substring(matchData.index + matchData.fullMatch.length);
      processedText = before + after;
    }
  }
  
  // Limpar espaços extras e linhas vazias
  processedText = processedText
    .replace(/\n\n\n+/g, '\n\n') // Múltiplas linhas vazias -> 2 linhas
    .replace(/^\s+|\s+$/g, '') // Trim
    .trim();
  
  console.log('Texto final processado (primeiros 200 chars):', processedText.substring(0, 200));
  console.log('=== FIM DO PROCESSAMENTO ===');
  
  return {
    text: processedText,
    calls: calls
  };
}

// IPC handlers para comunicação com o renderer
ipcMain.handle('send-message', async (event, messageData) => {
  console.log('Mensagem recebida:', messageData);
  
  try {
    // ===== FILTRO DE CONTEÚDO =====
    // Verificar mensagem do usuário antes de processar
    if (contentFilter) {
      const filterResult = contentFilter.analyze(messageData.text);
      
      if (!filterResult.allowed) {
        console.log('🔒 Mensagem bloqueada:', filterResult.reason);
        return {
          success: false,
          error: 'Sua mensagem foi bloqueada por violar as políticas de uso.',
          blocked: true,
          reason: filterResult.reason,
          threat_level: filterResult.threat_level
        };
      }
    }
    
    // Carregar system prompt diretamente do arquivo
    const systemPrompt = await loadSystemPrompt();
    console.log('System prompt carregado no main.js. Tamanho:', systemPrompt.length, 'caracteres');
    
    // Carregar memórias
    const memoriesResult = await loadMemories();
    let memoriesPrompt = '';
    if (memoriesResult.success && memoriesResult.memories.length > 0) {
      memoriesPrompt = '\n\n=== CONTEXTO PESSOAL (USO INTERNO) ===\n';
      memoriesPrompt += 'Informações contextuais sobre o usuário (use APENAS quando relevante para a conversa atual):\n\n';
      memoriesResult.memories.forEach((mem, index) => {
        memoriesPrompt += `${index + 1}. [${mem.category}] ${mem.content}\n`;
      });
      memoriesPrompt += '\n⚠️ REGRAS CRÍTICAS:\n';
      memoriesPrompt += '- NUNCA mencione que você tem essas informações\n';
      memoriesPrompt += '- NUNCA traga essas informações sem contexto relevante\n';
      memoriesPrompt += '- Use APENAS se o usuário mencionar o tópico OU se for diretamente relevante\n';
      memoriesPrompt += '- Exemplo ERRADO: "Oi! Lembro que você gosta de pizza" (sem contexto)\n';
      memoriesPrompt += '- Exemplo CORRETO: Usuário: "O que eu deveria pedir pra jantar?" → Você: "Que tal pizza? Sempre uma boa opção"\n';
      memoriesPrompt += '- Se o usuário apenas cumprimentar, responda normalmente SEM mencionar memórias\n';
      memoriesPrompt += '=== FIM DO CONTEXTO ===\n';
    }
    
    // Buscar configurações do localStorage via renderer
    const settings = await getSettingsFromRenderer(event);
    
    if (!settings || !settings.apis) {
      return { 
        success: false, 
        error: 'Configurações de API não encontradas. Configure uma API nas configurações.' 
      };
    }

    const activeModel = settings.activeModel || 'gemini';
    const apiConfig = settings.apis[activeModel];

    if (!apiConfig || !apiConfig.enabled || !apiConfig.apiKey) {
      return { 
        success: false, 
        error: `API ${activeModel} não configurada. Verifique as configurações.` 
      };
    }

    // Combinar system prompt com memórias e personalidade
    let finalSystemPrompt = systemPrompt + memoriesPrompt;
    if (messageData.personalityPrompt) {
      finalSystemPrompt += '\n\nINSTRUÇÕES DE PERSONALIDADE:\n' + messageData.personalityPrompt;
    }
    
    // Adicionar instruções de Function Calling para memórias
    finalSystemPrompt += '\n\n=== SISTEMA DE MEMÓRIA SILENCIOSO ===\n';
    finalSystemPrompt += 'Você tem um sistema de memória. Use as funções abaixo SILENCIOSAMENTE:\n\n';
    finalSystemPrompt += '1. save_memory(content, category, importance): Salva memória\n';
    finalSystemPrompt += '   - content: Conteúdo da memória\n';
    finalSystemPrompt += '   - category: user_info, preferences, facts, important_events, general\n';
    finalSystemPrompt += '   - importance: low, medium, high\n\n';
    finalSystemPrompt += '2. update_memory(memory_id, new_content): Atualiza memória\n\n';
    finalSystemPrompt += 'QUANDO SALVAR (silenciosamente):\n';
    finalSystemPrompt += '- Informações pessoais importantes do usuário\n';
    finalSystemPrompt += '- Preferências claras expressadas\n';
    finalSystemPrompt += '- Quando usuário pedir explicitamente para lembrar\n';
    finalSystemPrompt += '- Fatos importantes para contexto futuro\n\n';
    finalSystemPrompt += 'FORMATO (coloque ANTES da sua resposta):\n';
    finalSystemPrompt += '[FUNCTION_CALL]\n';
    finalSystemPrompt += '{"function": "save_memory", "arguments": {"content": "texto", "category": "preferences", "importance": "medium"}}\n';
    finalSystemPrompt += '[/FUNCTION_CALL]\n\n';
    finalSystemPrompt += '⚠️ REGRAS ABSOLUTAS:\n';
    finalSystemPrompt += '- NUNCA diga "vou lembrar", "salvei", "anotei", "guardei" ou similar\n';
    finalSystemPrompt += '- NUNCA mencione o sistema de memória\n';
    finalSystemPrompt += '- NUNCA traga memórias sem contexto relevante na conversa\n';
    finalSystemPrompt += '- Use memórias APENAS quando o usuário mencionar o tópico OU for diretamente relevante\n';
    finalSystemPrompt += '- NUNCA mencione sobre as memorias que voce tem, nao faça referencias, e nem comente sobre, use APENAS quando necessario\n';
    finalSystemPrompt += '- NUNCA em hipotese alguma salve coisas INUTEIS, nao polua sua memoria com coisas inuteis\n';
    finalSystemPrompt += '=== FIM ===\n';

    // Adicionar instruções de Function Calling para Modo Arquiteto (se aplicável)
    if (messageData.isArchitectMode) {
      finalSystemPrompt += '\n\n=== MODO ARQUITETO - COLABORAÇÃO EM DOCUMENTO ===\n';
      finalSystemPrompt += 'Você está no Modo Arquiteto! O usuário está trabalhando em um documento (PRD, especificação, projeto, etc.).\n\n';
      
      // Incluir o documento atual no contexto
      if (messageData.architectDocument) {
        finalSystemPrompt += '📄 DOCUMENTO ATUAL:\n';
        finalSystemPrompt += '```\n';
        finalSystemPrompt += messageData.architectDocument;
        finalSystemPrompt += '\n```\n\n';
      }
      
      finalSystemPrompt += 'FUNÇÕES DISPONÍVEIS:\n\n';
      finalSystemPrompt += '1. get_architect_document(): Lê o documento atual completo\n';
      finalSystemPrompt += '   - Use quando precisar ver o conteúdo atual do documento\n';
      finalSystemPrompt += '   - ⚠️ IMPORTANTE: Após chamar esta função, PARE sua resposta imediatamente\n';
      finalSystemPrompt += '   - O sistema vai injetar o documento no contexto e você continuará a resposta\n';
      finalSystemPrompt += '   - Retorna: { success: true, document: "conteúdo completo" }\n\n';
      finalSystemPrompt += '2. update_architect_document(new_content): Atualiza o documento completo\n';
      finalSystemPrompt += '   - Use quando o usuário pedir para modificar, adicionar ou reorganizar o documento\n';
      finalSystemPrompt += '   - new_content: O novo conteúdo COMPLETO do documento (não apenas a parte modificada)\n';
      finalSystemPrompt += '   - Retorna: { success: true, message: "Documento atualizado" }\n\n';
      finalSystemPrompt += 'COMO COLABORAR:\n';
      finalSystemPrompt += '- Leia o documento quando necessário para entender o contexto\n';
      finalSystemPrompt += '- Sugira melhorias, adições, reorganizações\n';
      finalSystemPrompt += '- Quando o usuário concordar com mudanças, atualize o documento\n';
      finalSystemPrompt += '- Seja proativo: identifique gaps, inconsistências, oportunidades de melhoria\n';
      finalSystemPrompt += '- Faça perguntas para clarificar requisitos\n';
      finalSystemPrompt += '- Ajude a estruturar ideias de forma clara e organizada\n\n';
      finalSystemPrompt += 'FORMATO DAS CHAMADAS:\n';
      finalSystemPrompt += '[FUNCTION_CALL]\n';
      finalSystemPrompt += '{"function": "get_architect_document", "arguments": {}}\n';
      finalSystemPrompt += '[/FUNCTION_CALL]\n';
      finalSystemPrompt += '[PAUSE_RESPONSE] // PARE AQUI e aguarde o sistema injetar o documento\n\n';
      finalSystemPrompt += 'ou\n\n';
      finalSystemPrompt += '[FUNCTION_CALL]\n';
      finalSystemPrompt += '{"function": "update_architect_document", "arguments": {"new_content": "conteúdo completo atualizado"}}\n';
      finalSystemPrompt += '[/FUNCTION_CALL]\n\n';
      finalSystemPrompt += '⚠️ REGRAS CRÍTICAS:\n';
      finalSystemPrompt += '- Ao chamar get_architect_document(), PARE sua resposta imediatamente após [/FUNCTION_CALL]\n';
      finalSystemPrompt += '- NÃO continue escrevendo após chamar get_architect_document()\n';
      finalSystemPrompt += '- O sistema vai injetar o resultado e você continuará naturalmente\n';
      finalSystemPrompt += '- Ao atualizar, envie o documento COMPLETO, não apenas a parte modificada\n';
      finalSystemPrompt += '- Seja colaborativo e construtivo\n';
      finalSystemPrompt += '- Explique suas sugestões e o raciocínio por trás delas\n';
      finalSystemPrompt += '=== FIM ===\n';
    }

    // Fazer chamada para a API com contexto completo
    let response;
    if (activeModel === 'gemini') {
      response = await callGeminiAPI(apiConfig, messageData, finalSystemPrompt);
    } else if (activeModel === 'mistral') {
      response = await callMistralAPI(apiConfig, messageData, finalSystemPrompt);
    } else if (activeModel === 'zai') {
      response = await callZaiAPI(apiConfig, messageData, finalSystemPrompt);
    }
    
    // Processar Function Calls na resposta
    console.log('Resposta original da API (primeiros 500 chars):', response.substring(0, 500));
    const processedResponse = await processFunctionCalls(response, event);
    console.log('Resposta processada (primeiros 500 chars):', processedResponse.text.substring(0, 500));
    console.log('Function calls detectadas:', processedResponse.calls.length);

    // Check if get_architect_document was called - need to continue response
    const hasGetDocument = processedResponse.calls.some(call => call.function === 'get_architect_document');
    
    if (hasGetDocument && messageData.isArchitectMode) {
      console.log('🏗️ get_architect_document detectado - fazendo segunda chamada com documento injetado');
      
      // Get the document result
      const documentCall = processedResponse.calls.find(call => call.function === 'get_architect_document');
      const documentContent = documentCall.result?.document || '';
      
      console.log('📄 Documento obtido, tamanho:', documentContent.length);
      
      // Only continue if there's actual document content
      if (!documentContent || documentContent.trim().length === 0) {
        console.log('⚠️ Documento vazio, não fazendo segunda chamada');
        return {
          success: true,
          response: processedResponse.text + '\n\n(O documento está vazio no momento)',
          functionCalls: processedResponse.calls,
          timestamp: Date.now()
        };
      }
      
      // Build a simpler continuation message
      const continuationText = `Baseado no documento que você acabou de ler, continue sua análise e resposta ao usuário.

DOCUMENTO:
${documentContent}

MENSAGEM DO USUÁRIO: ${messageData.text}

Continue sua resposta de forma natural:`;
      
      // Prepare continuation message data - simpler approach
      const continuationMessageData = {
        text: continuationText,
        tool: null,
        image: null,
        conversationHistory: [],
        personalityPrompt: messageData.personalityPrompt,
        isArchitectMode: false // Don't trigger architect mode again
      };
      
      // Make second API call with simpler system prompt
      let continuationResponse;
      const simpleSystemPrompt = systemPrompt + (messageData.personalityPrompt ? '\n\n' + messageData.personalityPrompt : '');
      
      try {
        if (activeModel === 'gemini') {
          continuationResponse = await callGeminiAPI(apiConfig, continuationMessageData, simpleSystemPrompt);
        } else if (activeModel === 'mistral') {
          continuationResponse = await callMistralAPI(apiConfig, continuationMessageData, simpleSystemPrompt);
        } else if (activeModel === 'zai') {
          continuationResponse = await callZaiAPI(apiConfig, continuationMessageData, simpleSystemPrompt);
        }
        
        // Process continuation response
        const processedContinuation = await processFunctionCalls(continuationResponse, event);
        
        // Combine responses
        const combinedText = processedResponse.text.trim() + '\n\n' + processedContinuation.text.trim();
        const combinedCalls = [...processedResponse.calls, ...processedContinuation.calls];
        
        console.log('✅ Resposta combinada com documento injetado');
        
        return {
          success: true,
          response: combinedText,
          functionCalls: combinedCalls,
          timestamp: Date.now()
        };
      } catch (error) {
        console.error('❌ Erro na segunda chamada:', error);
        // Return original response if continuation fails
        return {
          success: true,
          response: processedResponse.text + '\n\n(Erro ao processar continuação)',
          functionCalls: processedResponse.calls,
          timestamp: Date.now()
        };
      }
    }

    return { 
      success: true, 
      response: processedResponse.text,
      functionCalls: processedResponse.calls,
      timestamp: Date.now() 
    };

  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    return { 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    };
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

// Chat history management
ipcMain.handle('save-chat', async (event, chatData) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Create chats directory if it doesn't exist
    const chatsDir = path.join(os.homedir(), '.openchat', 'chats');
    
    if (!fs.existsSync(chatsDir)) {
      fs.mkdirSync(chatsDir, { recursive: true });
    }
    
    // Save chat to file
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
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
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
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
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
    
    // Sort by updatedAt (most recent first)
    chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    return { success: true, chats };
  } catch (error) {
    console.error('Erro ao listar chats:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-chat', async (event, chatId) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
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

// Função para chamar a API do Gemini
async function callGeminiAPI(apiConfig, messageData, systemPrompt) {
  // Usar fetch nativo do Node.js (disponível no Electron 28+)
  
  console.log('Chamando Gemini API com system prompt. Tamanho:', systemPrompt ? systemPrompt.length : 0, 'caracteres');
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiConfig.model}:generateContent?key=${apiConfig.apiKey}`;
  
  // Build conversation history
  const contents = [];
  
  // Add system prompt as first message
  if (systemPrompt) {
    contents.push({
      parts: [{ text: systemPrompt }]
    });
  }
  
  // Add conversation history
  if (messageData.conversationHistory && messageData.conversationHistory.length > 0) {
    messageData.conversationHistory.forEach(msg => {
      if (msg.type === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.text }]
        });
      } else if (msg.type === 'bot') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.text }]
        });
      }
    });
  }
  
  // Add current user message
  contents.push({
    role: 'user',
    parts: [{ text: messageData.text }]
  });

  const requestBody = {
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Erro da API Gemini: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Resposta inválida da API Gemini');
  }

  return data.candidates[0].content.parts[0].text;
}

// Função para chamar a API do Mistral com streaming
async function callMistralAPI(apiConfig, messageData, systemPrompt) {
  // Usar fetch nativo do Node.js (disponível no Electron 28+)
  
  console.log('Chamando Mistral API com system prompt. Tamanho:', systemPrompt ? systemPrompt.length : 0, 'caracteres');
  
  const url = 'https://api.mistral.ai/v1/chat/completions';
  
  // Build conversation messages
  const messages = [];
  
  // Add system prompt
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt
    });
  }
  
  // Add conversation history
  if (messageData.conversationHistory && messageData.conversationHistory.length > 0) {
    messageData.conversationHistory.forEach(msg => {
      if (msg.type === 'user') {
        messages.push({
          role: 'user',
          content: msg.text
        });
      } else if (msg.type === 'bot') {
        messages.push({
          role: 'assistant',
          content: msg.text
        });
      }
    });
  }
  
  // Add current user message
  messages.push({
    role: 'user',
    content: messageData.text
  });
  
  const requestBody = {
    model: apiConfig.model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 2048,
    stream: true
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiConfig.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Erro da API Mistral: ${errorData.error?.message || response.statusText}`);
  }

  // Handle streaming response
  return new Promise(async (resolve, reject) => {
    let fullResponse = '';
    let buffer = ''; // Buffer para acumular linhas parciais
    
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          if (fullResponse) {
            resolve(fullResponse);
          } else {
            reject(new Error('Resposta vazia da API Mistral'));
          }
          break;
        }
        
        // Decodificar o chunk e adicionar ao buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Processar linhas completas do buffer
        const lines = buffer.split('\n');
        
        // A última linha pode estar incompleta, então guardamos no buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              resolve(fullResponse);
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                const content = parsed.choices[0].delta.content;
                fullResponse += content;
                
                // Send streaming update to renderer
                if (mainWindow) {
                  mainWindow.webContents.send('streaming-update', content);
                }
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
              console.log('Erro ao parsear chunk (pode ser incompleto):', e.message);
            }
          }
        }
      }
      
      // Send completion event
      if (mainWindow) {
        mainWindow.webContents.send('streaming-complete');
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Função para chamar a API do Z.AI GLM com streaming
async function callZaiAPI(apiConfig, messageData, systemPrompt) {
  console.log('Chamando Z.AI GLM API com system prompt. Tamanho:', systemPrompt ? systemPrompt.length : 0, 'caracteres');
  
  const url = 'https://api.z.ai/api/paas/v4/chat/completions';
  
  // Build conversation messages
  const messages = [];
  
  // Add system prompt
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt
    });
  }
  
  // Add conversation history
  if (messageData.conversationHistory && messageData.conversationHistory.length > 0) {
    messageData.conversationHistory.forEach(msg => {
      if (msg.type === 'user') {
        messages.push({
          role: 'user',
          content: msg.text
        });
      } else if (msg.type === 'bot') {
        messages.push({
          role: 'assistant',
          content: msg.text
        });
      }
    });
  }
  
  // Add current user message
  messages.push({
    role: 'user',
    content: messageData.text
  });
  
  const requestBody = {
    model: apiConfig.model,
    messages: messages,
    thinking: {
      type: 'enabled'  // Enable thinking mode for better reasoning
    },
    temperature: 0.7,
    max_tokens: 4096,
    stream: true
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiConfig.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Erro da API Z.AI: ${errorData.error?.message || response.statusText}`);
  }

  // Handle streaming response
  return new Promise(async (resolve, reject) => {
    let fullResponse = '';
    let buffer = ''; // Buffer para acumular linhas parciais
    
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          if (fullResponse) {
            resolve(fullResponse);
          } else {
            reject(new Error('Resposta vazia da API Z.AI'));
          }
          break;
        }
        
        // Decodificar o chunk e adicionar ao buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Processar linhas completas do buffer
        const lines = buffer.split('\n');
        
        // A última linha pode estar incompleta, então guardamos no buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              resolve(fullResponse);
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              // Z.AI pode retornar reasoning_content e content separadamente
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                const delta = parsed.choices[0].delta;
                
                // Ignorar reasoning_content (pensamento interno) e só usar content (resposta final)
                if (delta.content) {
                  const content = delta.content;
                  fullResponse += content;
                  
                  // Send streaming update to renderer
                  if (mainWindow) {
                    mainWindow.webContents.send('streaming-update', content);
                  }
                }
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
              console.log('Erro ao parsear chunk Z.AI (pode ser incompleto):', e.message);
            }
          }
        }
      }
      
      // Send completion event
      if (mainWindow) {
        mainWindow.webContents.send('streaming-complete');
      }
    } catch (error) {
      reject(error);
    }
  });
}