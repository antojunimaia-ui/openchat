# OpenChat

OpenChat é o espaço onde você pode dizer o que outras IAs simplesmente não permitem.
Enquanto plataformas tradicionais impõem filtros agressivos, limitações arbitrárias e barreiras que cortam metade da conversa, o OpenChat entrega um ambiente direto, aberto e sem amarras.

É o primeiro chat open-source projetado para oferecer uma IA realmente livre, transparente e controlada pelo próprio usuário.
Nada de sistemas fechados, nada de regras opacas. Você conversa, cria e explora sem ser interrompido por bloqueios desnecessários.

O OpenChat nasceu com um objetivo claro: garantir liberdade de conhecimento e permitir que qualquer pessoa tenha autonomia total sobre a própria experiência. Aqui, a conversa é sua. Sempre.

## Instalação

Para usar o openchat, clone o repositorio:

```bash
git clone https://github.com/antojunimaia-ui/openchat.git
```

Apos clonar, entre na pasta do repositorio e execute:

```bash
npm install
```

Apos instalar as dependencias, execute o openchat usando o seguinte comando:

```bash
npm run dev
```

## Configuração

O OpenChat permite que você utilize diferentes modelos de IA (Gemini, Mistral, Z.AI e OpenRouter). Para começar, você precisa configurar as chaves de API nas configurações do aplicativo.

### 1. Acessando as Configurações

Para abrir o painel de configurações, clique no ícone de **Configurações (⚙️)** localizado na parte inferior da barra lateral esquerda.

### 2. Configurando as APIs

No painel de configurações, na aba **APIs**, você pode configurar as seguintes chaves:

#### **Google Gemini**

1. Acesse o [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Faça login com sua conta Google.
3. Clique em **"Create API Key"**.
4. Copie a chave gerada e cole no campo "Chave da API" do Gemini no OpenChat.
5. Ative a chave no botão de alternância (toggle) e selecione o modelo desejado (ex: `gemini-2.5-flash`).

#### **Mistral AI**

1. Acesse o [Mistral Console](https://console.mistral.ai/).
2. Crie uma conta ou faça login.
3. Vá para **"API Keys"** no menu lateral.
4. Clique em **"Create new key"**.
5. Copie a chave e cole no campo correspondente no OpenChat.

#### **Z.AI GLM**

1. Acesse o [Z.AI Open Platform](https://open.bigmodel.cn/).
2. Crie uma conta ou faça login.
3. Vá para **"API Keys"** no painel de controle.
4. Clique em **"Create API Key"**.
5. Copie a chave e cole no campo correspondente no OpenChat.

#### **Open Router**

1. Acesse o [Open Router Keys](https://openrouter.ai/keys).
2. Crie uma conta ou faça login.
3. Clique em **"Create Key"**.
4. Copie a chave gerada e cole no campo "Chave da API" do Open Router no OpenChat.
5. Após configurar a chave, clique no ícone de **Atualizar (🔄)** ao lado do seletor de modelos para carregar a lista completa de centenas de modelos disponíveis (Claude, GPT-4, Llama, etc.).

#### **ElevenLabs (Voz)**

1. Acesse o [ElevenLabs](https://elevenlabs.io/).
2. Crie uma conta ou faça login.
3. Clique no ícone do seu perfil e vá para **"Profile + API Key"**.
4. Copie a chave em **"API Key"**.
5. No OpenChat, vá para Configurações > APIs > Configuração de Voz.
6. Selecione "ElevenLabs", cole sua chave e clique em **Atualizar (🔄)** para carregar suas vozes disponíveis.

**Nota**: é necessário desativar a opção "Restringir Chave" na config de API no ElevenLabs para que as vozes sejam carregadas corretamente.

### 3. Selecionando o Modelo Ativo

Após configurar as chaves, vá para a aba **Modelos** nas configurações e selecione qual provedor você deseja usar. O modelo selecionado será o responsável pelas respostas nas suas conversas.

### 4. Personalidade e Prompt de Sistema

Você pode ajustar o comportamento da IA na aba **Personalidade**. Se desejar um controle ainda mais profundo, o OpenChat lê o arquivo `system-prompt.txt` na raiz do projeto como instrução base. Você pode editar este arquivo para mudar a "alma" da sua IA.

### 5. Memória e Localização dos Dados

O OpenChat salva suas preferências, memórias e histórico localmente. No Windows, esses dados ficam em:

- **Configurações e Memórias:** `%USERPROFILE%/.openchat/`
- **Histórico de Conversas:** `%USERPROFILE%/.openchat/chats/`

**Nota**: O código neste repositório está em desenvolvimento ativo. Versões estáveis e oficiais são disponibilizadas como executáveis (.exe) na página de [releases](https://github.com/antojunimaia-ui/openchat/releases/).

## Contribua

Se o OpenChat te ajudou, considere:

- ⭐ Dar uma estrela no repositório
- 🐛 Reportar bugs e sugerir melhorias
- 🔄 Compartilhar com outros desenvolvedores

---

### "Não é apenas uma IA, é SUA IA - completamente livre!"

Desenvolvido com ❤️ por Junior_7i | Versão 2.1.3

**IMPORTANTE**: Este software é fornecido "como está", sem garantias de qualquer tipo. O OpenChat é uma ferramenta de IA sem restrições que pode gerar conteúdo sobre qualquer tópico solicitado pelo usuário.

**RESPONSABILIDADE DO USUÁRIO**: O usuário é inteiramente responsável pelo uso que faz desta ferramenta e pelo conteúdo gerado através dela. O desenvolvedor não se responsabiliza por:

- Uso inadequado ou malicioso da ferramenta
- Conteúdo gerado que possa ser considerado ofensivo, ilegal ou inadequado
- Consequências decorrentes do uso das informações fornecidas pela IA
- Violações de leis locais, nacionais ou internacionais
- Danos diretos ou indiretos causados pelo uso do software

**DISCLAIMER**: O USO INDEVIDO DESTE SOFTWARE NÃO É RESPONSABILIDADE DO DESENVOLVEDOR. Use com responsabilidade e de acordo com as leis aplicáveis em sua jurisdição.

**IDADE MÍNIMA**: Este software é destinado a usuários maiores de 18 anos ou com supervisão adequada.

Ao usar este software, você concorda com estes termos e assume total responsabilidade pelo seu uso.
