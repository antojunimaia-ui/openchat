const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require('path');
const fs = require('fs').promises;

class MCPManager {
    constructor() {
        this.clients = new Map(); // name -> { client, tools }
        this.toolsConfig = []; // Para injetar no prompt
    }

    async reloadServers() {
        console.log('[MCP] Recarregando servidores...');
        // Fechar clientes existentes
        for (const [name, serverData] of this.clients.entries()) {
            try {
                if (serverData.client) {
                    await serverData.client.close();
                }
            } catch (e) {
                console.error(`[MCP] Erro ao fechar servidor ${name}:`, e);
            }
        }
        this.clients.clear();
        this.toolsConfig = [];
        await this.loadServers();
    }

    async loadServers() {
        try {
            const os = require('os');
            const serversPath = path.join(os.homedir(), '.openchat', 'mcp_servers.json');

            if (!require('fs').existsSync(serversPath)) {
                await fs.writeFile(serversPath, JSON.stringify({
                    servers: {
                    }
                }, null, 2), 'utf8');
                return;
            }

            const data = await fs.readFile(serversPath, 'utf8');
            const config = JSON.parse(data);

            if (config.servers) {
                for (const [name, serverConfig] of Object.entries(config.servers)) {
                    await this.startServer(name, serverConfig);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar servidores MCP:', error);
        }
    }

    async startServer(name, config) {
        console.log(`[MCP] Iniciando servidor: ${name}...`);
        try {
            const transport = new StdioClientTransport({
                command: config.command,
                args: config.args || []
            });

            const client = new Client({
                name: `openchat-client`,
                version: "1.0.0"
            }, {
                capabilities: {
                    tools: {}
                }
            });

            await client.connect(transport);

            const toolsResult = await client.listTools();
            if (toolsResult && toolsResult.tools) {
                this.clients.set(name, { client, transport, tools: toolsResult.tools });
                console.log(`[MCP] Servidor ${name} conectado. Ferramentas carregadas: ${toolsResult.tools.length}`);
                this.updateToolsConfig();
            }
        } catch (error) {
            console.error(`[MCP] Erro ao iniciar servidor ${name}:`, error);
        }
    }

    updateToolsConfig() {
        this.toolsConfig = [];
        for (const [serverName, serverData] of this.clients.entries()) {
            for (const tool of serverData.tools) {
                this.toolsConfig.push({
                    serverName,
                    toolName: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema
                });
            }
        }
    }

    getSystemPromptExtension() {
        if (this.toolsConfig.length === 0) return '';

        let prompt = '\n\n=== FERRAMENTAS MCP EXTERNAS DISPONÍVEIS ===\n';
        prompt += 'Você tem acesso a ferramentas de servidores locais instalados pelo usuário.\n';
        prompt += 'Para usá-las, retorne no mesmo formato [FUNCTION_CALL] visto anteriormente:\n\n';

        this.toolsConfig.forEach(tool => {
            prompt += `- ${tool.toolName}: ${tool.description || 'Sem descrição'}\n`;
            prompt += `  Argumentos necessários: ${JSON.stringify(tool.inputSchema.properties || {})}\n`;
            prompt += '  Exemplo de uso:\n';
            prompt += `  [FUNCTION_CALL]\n  {"function": "${tool.toolName}", "arguments": { "argumento1": "valor" }}\n  [/FUNCTION_CALL]\n\n`;
        });

        prompt += '⚠️ IMPORTANTE: Você DEVE PARAR sua resposta IMEDIATAMENTE após usar uma dessas ferramentas para que o sistema possa executá-la e retornar o resultado!\n';
        prompt += '=== FIM DAS FERRAMENTAS MCP ===\n';
        return prompt;
    }

    async handleToolCall(functionName, args) {
        for (const [serverName, serverData] of this.clients.entries()) {
            const tool = serverData.tools.find(t => t.name === functionName);
            if (tool) {
                console.log(`[MCP] Executando ferramenta ${functionName} do servidor ${serverName}...`);
                try {
                    const result = await serverData.client.callTool({
                        name: functionName,
                        arguments: args
                    });
                    return { success: true, result: result };
                } catch (error) {
                    console.error(`[MCP] Erro na ferramenta ${functionName}:`, error);
                    return { success: false, error: error.message };
                }
            }
        }
        return null; // Ferramenta não pertence ao MCP
    }
}

module.exports = new MCPManager();
