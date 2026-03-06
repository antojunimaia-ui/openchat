const { ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function callHuggingFaceImageAPI(prompt, hfToken) {
    console.log('Chamando Hugging Face API para prompt:', prompt);

    // Using FLUX.1-schnell or stable-diffusion-xl-base-1.0
    // FLUX.1-schnell is extremely fast and high quality for free tiers
    const model = 'black-forest-labs/FLUX.1-schnell';
    // O endpoint api-inference foi migrado para router.huggingface.co/hf-inference/v1 para acesso compatível
    const generateUrl = `https://router.huggingface.co/hf-inference/models/${model}`;

    const response = await fetch(generateUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                guidance_scale: 7.5,
                num_inference_steps: 4,
            }
        })
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Token do Hugging Face inválido. Verifique se copiou corretamente.');
        } else if (response.status === 503) {
            throw new Error('O modelo está carregando na API gratuita do Hugging Face. Tente novamente em 20 segundos.');
        }
        const errorText = await response.text();
        throw new Error(`Erro na API do Hugging Face (${response.status}): ${errorText.substring(0, 100)}`);
    }

    // A Hugging Face retorna os bytes da imagem (blob) diretamente
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    // As imagens podem ser jpeg ou png dependendo do modelo, Flux costuma ser jpeg
    return `data:image/jpeg;base64,${base64Image}`;
}

function setupImageHandlers() {
    ipcMain.handle('generate-image', async (event, prompt, apiKey) => {
        try {
            if (!apiKey) {
                return { success: false, error: 'Token do Hugging Face não configurado nas Configurações -> APIs.' };
            }

            const imageBase64 = await callHuggingFaceImageAPI(prompt, apiKey);
            return { success: true, imageData: imageBase64 };
        } catch (error) {
            console.error('Erro na geração de imagem com HF:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { setupImageHandlers };
