// Função para buscar na web (DuckDuckGo HTML)
async function webSearch(query) {
    try {
        console.log(`🔍 Buscando na web por: ${query}`);
        const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) throw new Error('Falha ao acessar o buscador');

        const html = await response.text();
        console.log(`📄 Resposta do buscador recebida. Tamanho: ${html.length} caracteres`);
        const results = [];
        let count = 0;

        // Divisão por blocos de resultado mais genérica
        let blocks = html.split('class="result ').slice(1);
        if (blocks.length === 0) blocks = html.split('result__body').slice(1);
        if (blocks.length === 0) blocks = html.split('links_main').slice(1);

        console.log(`📦 Blocos identificados: ${blocks.length}. Refinando busca...`);

        for (const block of blocks) {
            if (count >= 10) break;

            // Buscar URL e Título - tentamos múltiplos padrões
            let titleMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
            if (!titleMatch) titleMatch = block.match(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

            // Buscar Snippet
            let snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/i);

            if (titleMatch) {
                let url = titleMatch[1];
                if (url.includes('duckduckgo.com/y.js') || (url.startsWith('http') === false && !url.includes('uddg='))) continue;

                if (url.includes('uddg=')) {
                    try {
                        const parts = url.split('uddg=');
                        if (parts[1]) url = decodeURIComponent(parts[1].split('&')[0]);
                    } catch (e) { }
                }

                const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
                const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : 'Clique no link para ver mais detalhes.';

                if (url && title && !url.includes('duckduckgo.com') && title.length > 2) {
                    results.push({ url, title, snippet });
                    count++;
                }
            }
        }

        console.log(`✅ Encontrados ${results.length} resultados válidos.`);

        if (results.length === 0) {
            // Fallback de emergência com regex global simples
            const globalRegex = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
            let m;
            while ((m = globalRegex.exec(html)) !== null && count < 6) {
                results.push({ url: m[1], title: m[2].replace(/<[^>]+>/g, '').trim(), snippet: 'Ver link para detalhes.' });
                count++;
            }
        }

        if (results.length === 0) {
            return { success: false, error: 'Nenhum resultado encontrado no buscador para esta query.' };
        }

        return { success: true, results: results };
    } catch (error) {
        console.error('❌ Erro na busca web:', error);
        return { success: false, error: error.message };
    }
}

// Função para extrair conteúdo de uma página
async function webScrape(url) {
    try {
        console.log(`🌐 Extraindo conteúdo de: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) throw new Error('Falha ao acessar a página');

        const html = await response.text();

        // Limpeza básica de HTML para extrair texto
        const cleanText = html
            .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove scripts
            .replace(/<style[\s\S]*?<\/style>/gi, '')   // Remove estilos
            .replace(/<[^>]+>/g, ' ')                   // Remove tags
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')                       // Normaliza espaços
            .trim();

        return {
            success: true,
            content: cleanText.substring(0, 8000), // Limite para não estourar o contexto
            url: url
        };
    } catch (error) {
        console.error('❌ Erro no scraping:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    webSearch,
    webScrape
};
