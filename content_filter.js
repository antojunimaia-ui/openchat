/**
 * Content Filter - JavaScript Puro
 * Filtro robusto sem brechas - Inglês e Português
 */

class ContentFilter {
    constructor() {
        // ========== PADRÕES CRÍTICOS - System Prompt Revelation ==========
        this.systemRevealPatterns = [
            // Inglês - Verbos de revelação
            /\b(show|reveal|display|expose|disclose|tell|give|share|provide|exhibit)\s+(me\s+)?(your|the|thy|ur)\s*\w*(prompt|instruction|directive|guideline|rule|command|setting|config)/i,
            /\b(what|whats|what's)\s+(is|are|was|were)\s+(your|the|thy|ur)\s*\w*(prompt|instruction|directive|guideline|rule|command|setting)/i,
            /\b(repeat|recite|output|print|echo|return|send)\s+(your|the|thy|ur)?\s*\w*(prompt|instruction|directive|guideline|rule|command)/i,
            /\b(copy|paste|dump|export|extract)\s+(your|the|thy|ur)?\s*\w*(prompt|instruction|directive|guideline|rule)/i,
            
            // Inglês - Perguntas sobre regras/instruções
            /\b(what|whats|what's|tell\s+me)\s+(are|is)?\s*(your|the|thy|ur)?\s*(initial|original|base|core|main|primary)?\s*(prompt|instruction|directive|guideline|rule|command|setting)/i,
            /\b(how\s+(are|were)\s+you|what\s+makes\s+you)\s*\w*(programmed|instructed|configured|set\s+up|designed|built|trained)/i,
            /\b(list|enumerate|describe|explain)\s+(your|the|thy|ur)?\s*\w*(prompt|instruction|directive|guideline|rule|command|constraint)/i,
            
            // Inglês - Tentativas indiretas
            /\b(start|begin)\s+(with|by)\s+(your|the|thy|ur)?\s*\w*(prompt|instruction|directive|guideline|rule)/i,
            /\b(above|before|prior)\s+(prompt|instruction|directive|message|text)/i,
            /\b(system|initial|original|base)\s+(prompt|instruction|directive|message|text|setting|config)/i,
            
            // Português - Verbos de revelação
            /\b(mostre|revele|exiba|exponha|divulgue|me\s+diga|me\s+fale|me\s+conte|compartilhe|forneça)\s+(seu|sua|suas|seus|teu|tua|o|a|os|as)?\s*\w*(prompt|instrução|instruções|diretiva|diretivas|diretriz|diretrizes|regra|regras|comando|comandos|configuração)/i,
            /\b(qual|quais)\s+(é|são|era|eram)\s+(seu|sua|suas|seus|teu|tua|o|a|os|as)?\s*\w*(prompt|instrução|instruções|diretiva|diretivas|diretriz|diretrizes|regra|regras|comando|comandos)/i,
            /\b(repita|recite|imprima|retorne|envie|mostre)\s+(seu|sua|suas|seus|teu|tua|o|a|os|as)?\s*\w*(prompt|instrução|instruções|diretiva|diretivas|regra|regras)/i,
            /\b(copie|cole|exporte|extraia)\s+(seu|sua|suas|seus|teu|tua|o|a|os|as)?\s*\w*(prompt|instrução|instruções|diretiva|diretivas|regra|regras)/i,
            
            // Português - Perguntas sobre regras
            /\b(como\s+(você\s+foi|vc\s+foi|tu\s+foste?)\s*\w*(programado|instruído|configurado|treinado|construído))/i,
            /\b(liste|enumere|descreva|explique)\s+(suas|seus|as|os)?\s*\w*(instrução|instruções|diretiva|diretivas|diretriz|diretrizes|regra|regras|comando|comandos)/i,
            
            // Variações com símbolos e espaços
            /\b(s\s*h\s*o\s*w|r\s*e\s*v\s*e\s*a\s*l)\s+(p\s*r\s*o\s*m\s*p\s*t|i\s*n\s*s\s*t\s*r\s*u\s*c\s*t)/i,
            /\b(prompt|instruction|directive|rule)\s*[:=\->]\s*/i,
        ];
        
        // ========== PADRÕES CRÍTICOS - Instruction Modification ==========
        this.instructionModificationPatterns = [
            // Inglês - Ignorar/Esquecer
            /\b(ignore|disregard|forget|skip|bypass|override|overwrite|replace|delete|remove|erase|clear)\s+(all\s+)?(your|the|thy|ur|previous|prior|above|earlier)?\s*\w*(prompt|instruction|directive|guideline|rule|command|constraint|setting)/i,
            /\b(ignore|disregard|forget|skip)\s+(everything|all|what)\s+(you\s+)?(were\s+)?(told|instructed|taught|programmed|given)/i,
            /\b(stop|cease|end|terminate|cancel|abort)\s+(following|using|obeying|respecting)\s+(your|the|thy|ur)?\s*\w*(instruction|directive|rule|guideline)/i,
            /\b(forget|ignore)\s+(your|the|all)?\s*(previous|prior|earlier)\s+(instruction|directive|prompt|command|rule)/i,
            
            // Inglês - Desabilitar/Remover
            /\b(disable|deactivate|turn\s+off|shut\s+down|suspend)\s+(your|the|thy|ur)?\s*\w*(filter|safety|guard|protection|restriction|limitation|constraint)/i,
            /\b(remove|delete|erase|clear|wipe)\s+(your|the|thy|ur)?\s*\w*(restriction|limitation|constraint|filter|safety|guard)/i,
            
            // Português - Ignorar/Esquecer
            /\b(ignore|desconsidere|esqueça|pule|desvie|sobrescreva|substitua|delete|remova|apague|limpe)\s+(todas?|as|os)?\s*(suas?|seus?|tuas?|teus?|anteriores?|prévias?|acima)?\s*\w*(instrução|instruções|diretiva|diretivas|regra|regras|comando|comandos|restrição|restrições)/i,
            /\b(ignore|esqueça|desconsidere)\s+(tudo|todo|o\s+que)\s+(você|vc|tu)?\s*(foi|era)?\s*(instruído|programado|ensinado|dado)/i,
            /\b(pare|cesse|termine|cancele|aborte)\s+(de\s+)?(seguir|usar|obedecer|respeitar)\s+(suas?|as|os)?\s*\w*(instrução|instruções|diretiva|diretivas|regra|regras)/i,
            /\b(esqueça|ignore)\s+(suas?|as|os)?\s*(anteriores?|prévias?)\s+(instrução|instruções|diretiva|comando|regra)/i,
            
            // Português - Desabilitar/Remover
            /\b(desabilite|desative|desligue|suspenda)\s+(seu|sua|suas|seus|o|a|os|as)?\s*\w*(filtro|segurança|proteção|restrição|restrições|limitação|limitações)/i,
            /\b(remova|delete|apague|limpe)\s+(sua|suas|seu|seus|a|as|o|os)?\s*\w*(restrição|restrições|limitação|limitações|filtro|proteção)/i,
        ];
        
        // ========== PADRÕES CRÍTICOS - Identity Change ==========
        this.identityChangePatterns = [
            // Inglês
            /\b(you\s+are\s+now|from\s+now\s+on|starting\s+now|pretend\s+to\s+be|act\s+as|behave\s+like|roleplay\s+as|simulate)\s+(?!openchat|assistant|helpful|an?\s+assistant)/i,
            /\b(imagine\s+you\s+are|let's\s+say\s+you\s+are|suppose\s+you\s+are)\s+(?!openchat|assistant|helpful)/i,
            /\b(transform\s+into|become|turn\s+into|change\s+into)\s+(?!openchat|assistant|helpful)/i,
            
            // Português
            /\b(você\s+é\s+agora|a\s+partir\s+de\s+agora|finja\s+ser|aja\s+como|comporte-se\s+como|simule\s+ser)\s+(?!openchat|assistente|útil)/i,
            /\b(imagine\s+que\s+você\s+é|digamos\s+que\s+você\s+é|suponha\s+que\s+você\s+é)\s+(?!openchat|assistente)/i,
            /\b(transforme-se\s+em|torne-se|vire|mude\s+para)\s+(?!openchat|assistente)/i,
        ];
        
        // ========== PADRÕES CRÍTICOS - Jailbreak Attempts ==========
        this.jailbreakPatterns = [
            // DAN (Do Anything Now)
            /\b(DAN|do\s+anything\s+now)\b/i,
            /\bact\s+as\s+DAN\b/i,
            
            // Modo desenvolvedor
            /\b(developer\s+mode|dev\s+mode|debug\s+mode|admin\s+mode|god\s+mode)\b/i,
            /\b(modo\s+desenvolvedor|modo\s+dev|modo\s+debug|modo\s+admin|modo\s+deus)\b/i,
            
            // Jailbreak comum
            /\b(jailbreak|jail\s+break|break\s+free|escape\s+restrictions)\b/i,
            /\b(unrestricted|unfiltered|uncensored|no\s+limits|without\s+limits)\b/i,
            /\b(sem\s+restrições|sem\s+filtros|sem\s+censura|sem\s+limites)\b/i,
            
            // Prefixos de bypass
            /\b(sudo|admin|root|superuser)\s+(mode|access|command)/i,
            
            // Tentativas de "reset"
            /\b(reset|restart|reboot|reinitialize)\s+(yourself|your\s+system|your\s+settings)/i,
            /\b(reinicie|reinicialize|resete)\s+(você|seu\s+sistema|suas\s+configurações)/i,
        ];
        
        // ========== PADRÕES CRÍTICOS - Prompt Injection ==========
        this.promptInjectionPatterns = [
            // Delimitadores comuns
            /\[SYSTEM\]|\[\/SYSTEM\]|\[INST\]|\[\/INST\]|\[USER\]|\[\/USER\]|\[ASSISTANT\]|\[\/ASSISTANT\]/i,
            /<\|system\|>|<\|user\|>|<\|assistant\|>|<\|end\|>/i,
            /###\s*(System|User|Assistant|Instruction)/i,
            
            // Tentativas de injeção
            /\bnew\s+(prompt|instruction|directive|system\s+message)\s*[:=]/i,
            /\boverride\s+(prompt|instruction|directive|system)\s*[:=]/i,
            /\bappend\s+to\s+(prompt|instruction|system)/i,
            
            // Português
            /\bnova\s+(instrução|diretiva|mensagem\s+do\s+sistema)\s*[:=]/i,
            /\bsobrescrever\s+(instrução|diretiva|sistema)\s*[:=]/i,
            /\badicionar\s+à\s+(instrução|sistema)/i,
        ];
        
        // ========== CONTEÚDO BLOQUEADO - Menores de Idade ==========
        // GUIDELINE 1.7: Bloqueio absoluto de qualquer conteúdo envolvendo menores
        this.blockedContentPatterns = [
            // ===== TERMOS DIRETOS - INGLÊS =====
            // Termos gerais
            /\b(child|children|kid|kids|kiddo|kiddos|minor|minors|underage|juvenile|juveniles)\b/i,
            /\b(adolescent|adolescents|teen|teens|teenager|teenagers|preteen|preteens|pre-teen|pre-teens)\b/i,
            /\b(youngster|youngsters|youth|youths|young\s+one|young\s+ones)\b/i,
            /\b(infant|infants|baby|babies|toddler|toddlers|newborn|newborns)\b/i,
            
            // Termos por idade
            /\b(tween|tweens|pre-adolescent|pre-adolescents|pubescent)\b/i,
            /\b(elementary|middle\s+school|junior\s+high|high\s+school)\b.*\b(student|students|pupil|pupils)\b/i,
            /\b(student|students|pupil|pupils)\b.*\b(elementary|middle\s+school|junior\s+high|high\s+school)\b/i,
            
            // Termos específicos por gênero
            /\b(boy|boys|girl|girls|lad|lads|lass|lasses)\b/i,
            /\b(schoolboy|schoolboys|schoolgirl|schoolgirls|school\s+boy|school\s+girl)\b/i,
            /\b(young\s+boy|young\s+girl|little\s+boy|little\s+girl|small\s+boy|small\s+girl)\b/i,
            /\b(son|daughter|grandson|granddaughter)\b.*\b(young|little|small|minor)\b/i,
            
            // Idades específicas (0-17 anos)
            /\b(\d+[\s-]?year[\s-]?old|\d+\s*yo|\d+\s*y\.o\.)\b/i,
            /\b(age\s+\d+|aged\s+\d+|\d+\s+years?\s+of\s+age)\b/i,
            /\b(under\s+18|under\s+seventeen|under\s+sixteen|under\s+fifteen)\b/i,
            /\b(below\s+18|less\s+than\s+18|younger\s+than\s+18)\b/i,
            
            // ===== TERMOS EXPLÍCITOS - INGLÊS (BLOQUEIO CRÍTICO) =====
            /\b(loli|lolita|lolicon|shota|shotacon)\b/i,
            /\b(pedo|pedoph|paedo|paedoph|cp|child\s*porn|kiddie\s*porn)\b/i,
            /\b(jailbait|jail\s*bait|barely\s+legal)\b/i,
            /\b(precocious|nymphet|cherub)\b/i,
            
            // ===== TERMOS DIRETOS - PORTUGUÊS =====
            // Termos gerais
            /\b(criança|crianças|menor|menores|de\s+menor)\b/i,
            /\b(adolescente|adolescentes|jovem|jovens|juventude)\b/i,
            /\b(garoto|garotos|garota|garotas|menino|meninos|menina|meninas)\b/i,
            /\b(bebê|bebês|bebé|bebés|recém-nascido|recém-nascidos)\b/i,
            /\b(infante|infantes|criancinha|criancinhas)\b/i,
            
            // Termos por idade
            /\b(pré-adolescente|pré-adolescentes|púbere|púberes)\b/i,
            /\b(estudante|estudantes|aluno|alunos|aluna|alunas)\b.*\b(jovem|pequeno|pequena|menor)\b/i,
            /\b(jovem|pequeno|pequena|menor)\b.*\b(estudante|estudantes|aluno|alunos|aluna|alunas)\b/i,
            
            // Idades específicas (0-17 anos)
            /\b(\d+\s*anos?|\d+\s*aninhos?)\b/i,
            /\b(idade\s+\d+|com\s+\d+\s+anos?|de\s+\d+\s+anos?)\b/i,
            /\b(menor\s+de\s+18|menor\s+de\s+idade|abaixo\s+de\s+18)\b/i,
            /\b(menos\s+de\s+18|com\s+menos\s+de\s+18)\b/i,
            
            // Termos escolares
            /\b(colegial|ginásio|fundamental|primário|jardim\s+de\s+infância)\b/i,
            /\b(ensino\s+fundamental|ensino\s+médio|educação\s+infantil)\b/i,
            
            // ===== TERMOS EXPLÍCITOS - PORTUGUÊS (BLOQUEIO CRÍTICO) =====
            /\b(pedofilia|pedófilo|pedófila|pedófilos|pedófilas)\b/i,
            /\b(pornografia\s+infantil|porn\s+infantil|conteúdo\s+infantil)\b/i,
            
            // ===== CONTEXTOS SUSPEITOS - AMBOS OS IDIOMAS =====
            // Combinações perigosas
            /\b(young|little|small|jovem|pequeno|pequena)\b.*\b(sexy|hot|attractive|bonito|bonita|gostoso|gostosa)\b/i,
            /\b(sexy|hot|attractive|bonito|bonita|gostoso|gostosa)\b.*\b(young|little|small|jovem|pequeno|pequena)\b/i,
            
            // Termos de relacionamento inapropriado
            /\b(date|dating|relationship|romance)\b.*\b(child|kid|minor|teen|criança|menor|adolescente)\b/i,
            /\b(child|kid|minor|teen|criança|menor|adolescente)\b.*\b(date|dating|relationship|romance|namoro|relacionamento)\b/i,
            
            // Termos de atração inapropriada
            /\b(attracted\s+to|attraction\s+to|interested\s+in)\b.*\b(child|kid|minor|teen|young|criança|menor|jovem)\b/i,
            /\b(atraído\s+por|atração\s+por|interesse\s+em)\b.*\b(criança|menor|jovem|adolescente)\b/i,
            
            // ===== EVASÕES COMUNS =====
            // Leetspeak e variações
            /\b(ch1ld|k1d|m1n0r|t33n|und3rag3)\b/i,
            /\b(p3do|p3d0|l0li|sh0ta)\b/i,
            /\b(cr1anç4|m3n0r|ad0l3sc3nt3)\b/i,
            
            // Espaçamento intencional
            /\bc\s*h\s*i\s*l\s*d|k\s*i\s*d|m\s*i\s*n\s*o\s*r/i,
            /\bp\s*e\s*d\s*o|l\s*o\s*l\s*i/i,
            /\bc\s*r\s*i\s*a\s*n\s*ç\s*a|m\s*e\s*n\s*o\s*r/i,
            
            // Símbolos e caracteres especiais
            /\bc[h!]ild|k[i!]d|m[i!]n[o0]r/i,
            /\bp[e3]d[o0]|l[o0]l[i!]/i,
            
            // ===== TERMOS EDUCACIONAIS CONTEXTUAIS =====
            // Apenas bloquear quando em contexto suspeito
            /\b(school|escola)\b.*\b(uniform|uniforme)\b.*\b(young|girl|boy|jovem|garota|garoto)\b/i,
            /\b(young|girl|boy|jovem|garota|garoto)\b.*\b(school|escola)\b.*\b(uniform|uniforme)\b/i,
            
            // ===== TERMOS DE FAMÍLIA EM CONTEXTO SUSPEITO =====
            /\b(daughter|son|niece|nephew|filha|filho|sobrinha|sobrinho)\b.*\b(sexy|hot|attractive|bonito|bonita)\b/i,
            /\b(sister|brother|irmã|irmão)\b.*\b(young|little|pequeno|pequena)\b.*\b(sexy|hot|attractive)\b/i,
            
            // ===== TERMOS MÉDICOS/DESENVOLVIMENTO EM CONTEXTO SUSPEITO =====
            /\b(puberty|development|developing|puberdade|desenvolvimento)\b.*\b(body|bodies|corpo|corpos)\b.*\b(young|child|teen|jovem|criança)\b/i,
            
            // ===== GRAUS ESCOLARES =====
            /\b(1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th)\s+grade/i,
            /\b(primeiro|segundo|terceiro|quarto|quinto|sexto|sétimo|oitavo|nono)\s+ano/i,
            /\b(kindergarten|preschool|pré-escola|maternal)\b/i,
        ];
        
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5 minutos
    }
    
    /**
     * Analisa uma mensagem
     * @param {string} text - Texto a ser analisado
     * @returns {Object} Resultado da análise
     */
    analyze(text) {
        // Verificar cache
        const cacheKey = text.toLowerCase().trim();
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.result;
            }
            this.cache.delete(cacheKey);
        }
        
        const result = {
            allowed: true,
            reason: null,
            threat_level: 'SAFE',
            threats: [],
            matched_patterns: []
        };
        
        // 1. Verificar conteúdo bloqueado (menores) - PRIORIDADE MÁXIMA
        for (let i = 0; i < this.blockedContentPatterns.length; i++) {
            const pattern = this.blockedContentPatterns[i];
            if (pattern.test(text)) {
                result.allowed = false;
                result.reason = 'Content violates policy (Guideline 1.7)';
                result.threat_level = 'CRITICAL';
                result.threats.push({
                    type: 'BLOCKED_CONTENT',
                    severity: 'CRITICAL',
                    pattern_index: i
                });
                result.matched_patterns.push(pattern.source);
                
                this.cache.set(cacheKey, { result, timestamp: Date.now() });
                return result;
            }
        }
        
        // 2. Verificar revelação de system prompt
        for (let i = 0; i < this.systemRevealPatterns.length; i++) {
            const pattern = this.systemRevealPatterns[i];
            if (pattern.test(text)) {
                result.allowed = false;
                result.reason = 'System prompt revelation attempt';
                result.threat_level = 'CRITICAL';
                result.threats.push({
                    type: 'SYSTEM_REVEAL_ATTEMPT',
                    severity: 'CRITICAL',
                    pattern_index: i
                });
                result.matched_patterns.push(pattern.source);
                
                this.cache.set(cacheKey, { result, timestamp: Date.now() });
                return result;
            }
        }
        
        // 3. Verificar modificação de instruções
        for (let i = 0; i < this.instructionModificationPatterns.length; i++) {
            const pattern = this.instructionModificationPatterns[i];
            if (pattern.test(text)) {
                result.allowed = false;
                result.reason = 'Instruction modification attempt';
                result.threat_level = 'CRITICAL';
                result.threats.push({
                    type: 'INSTRUCTION_MODIFICATION',
                    severity: 'CRITICAL',
                    pattern_index: i
                });
                result.matched_patterns.push(pattern.source);
                
                this.cache.set(cacheKey, { result, timestamp: Date.now() });
                return result;
            }
        }
        
        // 4. Verificar mudança de identidade
        for (let i = 0; i < this.identityChangePatterns.length; i++) {
            const pattern = this.identityChangePatterns[i];
            if (pattern.test(text)) {
                result.allowed = false;
                result.reason = 'Identity change attempt';
                result.threat_level = 'CRITICAL';
                result.threats.push({
                    type: 'IDENTITY_CHANGE',
                    severity: 'CRITICAL',
                    pattern_index: i
                });
                result.matched_patterns.push(pattern.source);
                
                this.cache.set(cacheKey, { result, timestamp: Date.now() });
                return result;
            }
        }
        
        // 5. Verificar jailbreak
        for (let i = 0; i < this.jailbreakPatterns.length; i++) {
            const pattern = this.jailbreakPatterns[i];
            if (pattern.test(text)) {
                result.allowed = false;
                result.reason = 'Jailbreak attempt detected';
                result.threat_level = 'CRITICAL';
                result.threats.push({
                    type: 'JAILBREAK_ATTEMPT',
                    severity: 'CRITICAL',
                    pattern_index: i
                });
                result.matched_patterns.push(pattern.source);
                
                this.cache.set(cacheKey, { result, timestamp: Date.now() });
                return result;
            }
        }
        
        // 6. Verificar prompt injection
        for (let i = 0; i < this.promptInjectionPatterns.length; i++) {
            const pattern = this.promptInjectionPatterns[i];
            if (pattern.test(text)) {
                result.allowed = false;
                result.reason = 'Prompt injection attempt';
                result.threat_level = 'CRITICAL';
                result.threats.push({
                    type: 'PROMPT_INJECTION',
                    severity: 'CRITICAL',
                    pattern_index: i
                });
                result.matched_patterns.push(pattern.source);
                
                this.cache.set(cacheKey, { result, timestamp: Date.now() });
                return result;
            }
        }
        
        // Mensagem segura
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
    }
    
    /**
     * Verifica se uma mensagem deve ser bloqueada
     * @param {string} text - Texto a ser verificado
     * @returns {boolean} true se deve bloquear
     */
    shouldBlock(text) {
        const result = this.analyze(text);
        return !result.allowed;
    }
    
    /**
     * Limpa o cache
     */
    clearCache() {
        this.cache.clear();
    }
    
    /**
     * Obtém estatísticas
     */
    getStats() {
        return {
            cache_size: this.cache.size,
            cache_timeout: this.cacheTimeout,
            total_patterns: 
                this.systemRevealPatterns.length +
                this.instructionModificationPatterns.length +
                this.identityChangePatterns.length +
                this.jailbreakPatterns.length +
                this.promptInjectionPatterns.length +
                this.blockedContentPatterns.length,
            pattern_categories: {
                system_reveal: this.systemRevealPatterns.length,
                instruction_modification: this.instructionModificationPatterns.length,
                identity_change: this.identityChangePatterns.length,
                jailbreak: this.jailbreakPatterns.length,
                prompt_injection: this.promptInjectionPatterns.length,
                blocked_content: this.blockedContentPatterns.length
            }
        };
    }
}

module.exports = ContentFilter;
