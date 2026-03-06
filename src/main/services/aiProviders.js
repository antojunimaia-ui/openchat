// aiProviders.js — Chamadas para APIs de IA com suporte a Tool Calling nativo
// Usa a API oficial de function calling de cada provider em vez de parsing por regex/texto.

// ─── Definição das Tools disponíveis ─────────────────────────────────────────

/**
 * Gera a lista de tools no formato esperado por cada provider.
 * @param {'gemini'|'openai'} format
 * @param {object[]} extraTools - Tools extras (MCP servers)
 */
function buildTools(format, extraTools = []) {
    const coreDefs = [
        {
            name: 'save_memory',
            description: 'Salva uma informação importante sobre o usuário na memória persistente. Use silenciosamente quando o usuário revelar informações pessoais relevantes.',
            parameters: {
                type: 'object',
                properties: {
                    content: { type: 'string', description: 'Conteúdo da memória a salvar' },
                    category: { type: 'string', enum: ['user_info', 'preferences', 'facts', 'important_events', 'general'], description: 'Categoria da memória' },
                    importance: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Importância da memória' }
                },
                required: ['content', 'category', 'importance']
            }
        },
        {
            name: 'update_memory',
            description: 'Atualiza o conteúdo de uma memória existente pelo seu ID.',
            parameters: {
                type: 'object',
                properties: {
                    memory_id: { type: 'string', description: 'ID da memória a atualizar' },
                    new_content: { type: 'string', description: 'Novo conteúdo da memória' }
                },
                required: ['memory_id', 'new_content']
            }
        },
        {
            name: 'web_search',
            description: 'Pesquisa informações na internet. Use quando precisar de dados atuais, notícias ou links sobre um tema. PARE sua resposta após chamar esta função.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Termos de busca' }
                },
                required: ['query']
            }
        },
        {
            name: 'web_scrape',
            description: 'Lê o conteúdo de texto de uma página web específica. PARE sua resposta após chamar esta função.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'URL da página a ser lida' }
                },
                required: ['url']
            }
        },
        {
            name: 'get_architect_document',
            description: 'Lê o documento atual do Modo Arquiteto. PARE sua resposta imediatamente após chamar esta função.',
            parameters: { type: 'object', properties: {} }
        },
        {
            name: 'update_architect_document',
            description: 'Atualiza o conteúdo completo do documento do Modo Arquiteto com o novo texto fornecido.',
            parameters: {
                type: 'object',
                properties: {
                    new_content: { type: 'string', description: 'Conteúdo completo e atualizado do documento' }
                },
                required: ['new_content']
            }
        }
    ];

    // Combinar tools nativas com extras vindas do MCP
    const allDefs = [...coreDefs, ...extraTools];

    if (format === 'gemini') {
        return [{
            functionDeclarations: allDefs.map(t => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }))
        }];
    }

    // Formato OpenAI-compatible (Mistral, OpenRouter, ZAI)
    return allDefs.map(t => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters
        }
    }));
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGeminiAPI(apiConfig, messageData, systemPrompt, mainWindow, extraTools = []) {
    console.log('Chamando Gemini API com system prompt. Tamanho:', systemPrompt?.length ?? 0, 'caracteres');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiConfig.model}:generateContent?key=${apiConfig.apiKey}`;

    const contents = [];

    if (messageData.conversationHistory?.length > 0) {
        messageData.conversationHistory.forEach(msg => {
            if (msg.type === 'user') {
                contents.push({ role: 'user', parts: [{ text: msg.text }] });
            } else if (msg.type === 'bot') {
                contents.push({ role: 'model', parts: [{ text: msg.text }] });
            } else if (msg.role === 'tool') {
                // Tool result message (used during multi-turn tool calling)
                contents.push({
                    role: 'user',
                    parts: [{ functionResponse: { name: msg.name, response: { result: msg.content } } }]
                });
            }
        });
    }

    contents.push({ role: 'user', parts: [{ text: messageData.text }] });

    const requestBody = {
        system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents,
        tools: buildTools('gemini', extraTools),
        generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 4096 },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ]
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Erro da API Gemini: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate?.content) throw new Error('Resposta inválida da API Gemini');

    const parts = candidate.content.parts || [];
    const text = parts.filter(p => p.text).map(p => p.text).join('');
    const toolCalls = parts
        .filter(p => p.functionCall)
        .map(p => ({
            id: `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: p.functionCall.name,
            arguments: p.functionCall.args || {}
        }));

    return { text, toolCalls };
}

// ─── Helpers para Streaming (OpenAI-compatible) ───────────────────────────────

/**
 * Lê um streaming SSE e retorna { text, toolCalls }.
 * toolCalls são montados a partir dos deltas acumulados.
 */
async function readStreamingResponse(response, mainWindow) {
    return new Promise(async (resolve, reject) => {
        let fullText = '';
        let buffer = '';

        // Acumula tool calls por índice
        const toolCallAccumulator = {};

        try {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') {
                        const toolCalls = Object.values(toolCallAccumulator).map(tc => ({
                            id: tc.id,
                            name: tc.function.name,
                            arguments: (() => {
                                try { return JSON.parse(tc.function.arguments); }
                                catch { return {}; }
                            })()
                        }));
                        resolve({ text: fullText, toolCalls });
                        return;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        if (!delta) continue;

                        // Texto normal
                        if (delta.content) {
                            fullText += delta.content;
                            if (mainWindow) mainWindow.webContents.send('streaming-update', delta.content);
                        }

                        // Tool calls via delta
                        if (delta.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                const idx = tc.index ?? 0;
                                if (!toolCallAccumulator[idx]) {
                                    toolCallAccumulator[idx] = {
                                        id: tc.id || `tc-${idx}`,
                                        function: { name: tc.function?.name || '', arguments: '' }
                                    };
                                }
                                if (tc.id) toolCallAccumulator[idx].id = tc.id;
                                if (tc.function?.name) toolCallAccumulator[idx].function.name = tc.function.name;
                                if (tc.function?.arguments) toolCallAccumulator[idx].function.arguments += tc.function.arguments;
                            }
                        }
                    } catch {
                        // chunk parcial, ignorar
                    }
                }
            }

            // Stream terminou sem [DONE]
            const toolCalls = Object.values(toolCallAccumulator).map(tc => ({
                id: tc.id,
                name: tc.function.name,
                arguments: (() => { try { return JSON.parse(tc.function.arguments); } catch { return {}; } })()
            }));
            resolve({ text: fullText, toolCalls });
        } catch (error) {
            reject(error);
        } finally {
            if (mainWindow) mainWindow.webContents.send('streaming-complete');
        }
    });
}

// ─── Mistral ──────────────────────────────────────────────────────────────────

async function callMistralAPI(apiConfig, messageData, systemPrompt, mainWindow, extraTools = []) {
    console.log('Chamando Mistral API com system prompt. Tamanho:', systemPrompt?.length ?? 0, 'caracteres');

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

    if (messageData.conversationHistory?.length > 0) {
        messageData.conversationHistory.forEach(msg => {
            if (msg.type === 'user') messages.push({ role: 'user', content: msg.text });
            else if (msg.type === 'bot') messages.push({ role: 'assistant', content: msg.text });
            else if (msg.role === 'tool') messages.push({ role: 'tool', tool_call_id: msg.tool_call_id, content: JSON.stringify(msg.content) });
        });
    }

    messages.push({ role: 'user', content: messageData.text });

    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
            model: apiConfig.model,
            messages,
            tools: buildTools('openai', extraTools),
            tool_choice: 'auto',
            temperature: 0.7,
            max_tokens: 4096,
            stream: true
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Erro da API Mistral: ${err.error?.message || res.statusText}`);
    }

    return readStreamingResponse(res, mainWindow);
}

// ─── OpenRouter ───────────────────────────────────────────────────────────────

async function callOpenRouterAPI(apiConfig, messageData, systemPrompt, mainWindow, extraTools = []) {
    console.log('Chamando Open Router API com system prompt. Tamanho:', systemPrompt?.length ?? 0, 'caracteres');

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

    if (messageData.conversationHistory?.length > 0) {
        messageData.conversationHistory.forEach(msg => {
            if (msg.type === 'user') messages.push({ role: 'user', content: msg.text });
            else if (msg.type === 'bot') messages.push({ role: 'assistant', content: msg.text });
            else if (msg.role === 'tool') messages.push({ role: 'tool', tool_call_id: msg.tool_call_id, content: JSON.stringify(msg.content) });
        });
    }

    messages.push({ role: 'user', content: messageData.text });

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`,
            'HTTP-Referer': 'https://openchat.ai',
            'X-Title': 'OpenChat'
        },
        body: JSON.stringify({
            model: apiConfig.model || 'google/gemini-2.0-flash-001',
            messages,
            tools: buildTools('openai', extraTools),
            tool_choice: 'auto',
            temperature: 0.7,
            max_tokens: 4096,
            stream: true
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Erro da API Open Router: ${err.error?.message || res.statusText}`);
    }

    return readStreamingResponse(res, mainWindow);
}

// ─── Z.AI (GLM) ───────────────────────────────────────────────────────────────

async function callZaiAPI(apiConfig, messageData, systemPrompt, mainWindow, extraTools = []) {
    console.log('Chamando Z.AI GLM API com system prompt. Tamanho:', systemPrompt?.length ?? 0, 'caracteres');

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

    if (messageData.conversationHistory?.length > 0) {
        messageData.conversationHistory.forEach(msg => {
            if (msg.type === 'user') messages.push({ role: 'user', content: msg.text });
            else if (msg.type === 'bot') messages.push({ role: 'assistant', content: msg.text });
            else if (msg.role === 'tool') messages.push({ role: 'tool', tool_call_id: msg.tool_call_id, content: JSON.stringify(msg.content) });
        });
    }

    messages.push({ role: 'user', content: messageData.text });

    const res = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
            model: apiConfig.model,
            messages,
            tools: buildTools('openai', extraTools),
            tool_choice: 'auto',
            thinking: { type: 'enabled' },
            temperature: 0.7,
            max_tokens: 4096,
            stream: true
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Erro da API Z.AI: ${err.error?.message || res.statusText}`);
    }

    return readStreamingResponse(res, mainWindow);
}

module.exports = {
    callGeminiAPI,
    callMistralAPI,
    callZaiAPI,
    callOpenRouterAPI,
    buildTools
};
