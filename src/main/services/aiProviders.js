// Função para chamar a API do Gemini
async function callGeminiAPI(apiConfig, messageData, systemPrompt, mainWindow) {
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
async function callMistralAPI(apiConfig, messageData, systemPrompt, mainWindow) {
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

// Função para chamar a API do Open Router com streaming
async function callOpenRouterAPI(apiConfig, messageData, systemPrompt, mainWindow) {
    console.log('Chamando Open Router API com system prompt. Tamanho:', systemPrompt ? systemPrompt.length : 0, 'caracteres');

    const url = 'https://openrouter.ai/api/v1/chat/completions';

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
        model: apiConfig.model || 'google/gemini-2.0-flash-001',
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: true
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`,
            'HTTP-Referer': 'https://openchat.ai', // Optional
            'X-Title': 'OpenChat', // Optional
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erro da API Open Router: ${errorData.error?.message || response.statusText}`);
    }

    // Handle streaming response
    return new Promise(async (resolve, reject) => {
        let fullResponse = '';
        let buffer = '';

        try {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    if (fullResponse) {
                        resolve(fullResponse);
                    } else {
                        reject(new Error('Resposta vazia da API Open Router'));
                    }
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const lines = buffer.split('\n');
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

                                if (mainWindow) {
                                    mainWindow.webContents.send('streaming-update', content);
                                }
                            }
                        } catch (e) {
                            // Ignore parsing errors for incomplete chunks
                            // console.log('Erro ao parsear chunk Open Router:', e.message);
                        }
                    }
                }
            }

            if (mainWindow) {
                mainWindow.webContents.send('streaming-complete');
            }
        } catch (error) {
            reject(error);
        }
    });
}

// Função para chamar a API do Z.AI GLM com streaming
async function callZaiAPI(apiConfig, messageData, systemPrompt, mainWindow) {
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

                                    // Debug: Ver se a tag está sendo formada
                                    if (fullResponse.includes('[FUNCTION_CALL]') && !fullResponse.includes('[/FUNCTION_CALL]')) {
                                        // console.log('Function call em formação...');
                                    }

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

module.exports = {
    callGeminiAPI,
    callMistralAPI,
    callZaiAPI,
    callOpenRouterAPI
};
