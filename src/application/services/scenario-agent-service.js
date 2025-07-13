const PromptTemplates = require('../../infrastructure/ai/prompt-templates');
const { EVENT_TYPES, EVENT_SEVERITY } = require('../../shared/constants/political-event-constants');

class ScenarioAgentService {
    constructor(llmProvider) {
        this.llmProvider = llmProvider;
    }

    /**
     * Gerar novo cenário político
     * @param {Object} stateData - Dados completos do estado
     * @param {Array} recentEvents - Eventos recentes para evitar repetição
     * @returns {Promise<Object>} - Cenário gerado
     */
    async generateScenario(stateData, recentEvents = []) {
        try {
            console.log('🎭 Agente Cenário: Gerando evento político...');
            
            const prompt = PromptTemplates.generateScenarioPrompt(stateData, recentEvents);
            const schema = PromptTemplates.getResponseSchemas().scenario;
            
            const startTime = Date.now();
            const response = await this.llmProvider.generateStructuredResponse(prompt, schema);
            const processingTime = Date.now() - startTime;

            // Validar e classificar o evento gerado
            const validatedEvent = this.validateAndEnhanceEvent(response, stateData);
            
            console.log(`✅ Cenário gerado em ${processingTime}ms: ${validatedEvent.title}`);
            
            return {
                ...validatedEvent,
                processing_time_ms: processingTime,
                generated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Erro no Agente Cenário:', error);
            throw new Error(`Falha na geração de cenário: ${error.message}`);
        }
    }

    /**
     * Validar e melhorar o evento gerado
     * @param {Object} rawEvent - Evento bruto do LLM
     * @param {Object} stateData - Dados do estado
     * @returns {Object} - Evento validado e melhorado
     */
    validateAndEnhanceEvent(rawEvent, stateData) {
        // Validar campos obrigatórios
        if (!rawEvent.title || !rawEvent.description || !rawEvent.options) {
            throw new Error('Evento inválido: campos obrigatórios ausentes');
        }

        // Validar quantidade de opções
        if (!Array.isArray(rawEvent.options) || rawEvent.options.length < 3 || rawEvent.options.length > 4) {
            throw new Error('Evento deve ter entre 3 e 4 opções de decisão');
        }

        // Classificar tipo do evento automaticamente se não fornecido
        const eventType = this.classifyEventType(rawEvent, stateData);
        
        // Determinar severidade se não fornecida
        const severity = this.determineSeverity(rawEvent, stateData);

        // Calcular tempo de expiração baseado na severidade
        const expiresAt = this.calculateExpirationTime(severity);

        return {
            title: rawEvent.title.substring(0, 200), // Limitar tamanho
            description: rawEvent.description,
            event_type: eventType,
            severity: severity,
            expires_at: expiresAt,
            options: rawEvent.options.map((option, index) => ({
                option_index: index,
                title: option.title.substring(0, 150),
                description: option.description,
                predicted_impacts: this.predictOptionImpacts(option, eventType, severity)
            }))
        };
    }

    /**
     * Classificar tipo do evento baseado no conteúdo
     * @param {Object} event - Evento gerado
     * @param {Object} stateData - Dados do estado
     * @returns {string} - Tipo classificado
     */
    classifyEventType(event, stateData) {
        const content = (event.title + ' ' + event.description).toLowerCase();
        
        // Palavras-chave para classificação
        const keywords = {
            [EVENT_TYPES.ECONOMIC]: ['economia', 'pib', 'tributo', 'imposto', 'receita', 'orçamento', 'fiscal', 'investimento', 'empresa'],
            [EVENT_TYPES.SOCIAL]: ['protesto', 'manifestação', 'população', 'social', 'educação', 'saúde', 'segurança', 'trabalhador'],
            [EVENT_TYPES.POLITICAL]: ['político', 'governo', 'oposição', 'eleição', 'aprovação', 'corrupção', 'escândalo', 'coalização'],
            [EVENT_TYPES.ADMINISTRATIVE]: ['administração', 'servidor', 'funcionalismo', 'órgão', 'secretaria', 'gestão', 'burocracia'],
            [EVENT_TYPES.INFRASTRUCTURE]: ['transporte', 'estrada', 'ponte', 'hospital', 'escola', 'obra', 'infraestrutura', 'construção']
        };

        let maxScore = 0;
        let selectedType = EVENT_TYPES.POLITICAL; // padrão

        Object.entries(keywords).forEach(([type, words]) => {
            const score = words.filter(word => content.includes(word)).length;
            if (score > maxScore) {
                maxScore = score;
                selectedType = type;
            }
        });

        return selectedType;
    }

    /**
     * Determinar severidade do evento
     * @param {Object} event - Evento gerado
     * @param {Object} stateData - Dados do estado
     * @returns {string} - Severidade determinada
     */
    determineSeverity(event, stateData) {
        const { economy, governance } = stateData;
        
        // Fatores que aumentam severidade
        let severityScore = 0;
        
        // Fatores econômicos
        if (economy.treasury_balance < economy.monthly_expenses) severityScore += 2;
        if (economy.unemployment_rate > 10) severityScore += 1;
        if (economy.gdp_growth_rate < -2) severityScore += 2;
        if (economy.debt_to_gdp_ratio > 90) severityScore += 1;
        
        // Fatores políticos
        if (governance.approval_rating < 30) severityScore += 2;
        if (governance.political_stability < 40) severityScore += 1;
        if (['major', 'widespread'].includes(governance.protest_level)) severityScore += 1;
        
        // Palavras-chave de alta severidade no evento
        const content = (event.title + ' ' + event.description).toLowerCase();
        const criticalWords = ['crise', 'emergência', 'urgente', 'crítico', 'greve', 'escândalo', 'colapso'];
        if (criticalWords.some(word => content.includes(word))) severityScore += 2;

        // Classificar baseado na pontuação
        if (severityScore >= 6) return EVENT_SEVERITY.CRITICAL;
        if (severityScore >= 4) return EVENT_SEVERITY.HIGH;
        if (severityScore >= 2) return EVENT_SEVERITY.MEDIUM;
        return EVENT_SEVERITY.LOW;
    }

    /**
     * Calcular tempo de expiração baseado na severidade
     * @param {string} severity - Severidade do evento
     * @returns {string} - Data de expiração ISO
     */
    calculateExpirationTime(severity) {
        const now = new Date();
        let hours;

        switch (severity) {
            case EVENT_SEVERITY.CRITICAL:
                hours = 6; // 6 horas para decisões críticas
                break;
            case EVENT_SEVERITY.HIGH:
                hours = 12; // 12 horas para alta severidade
                break;
            case EVENT_SEVERITY.MEDIUM:
                hours = 24; // 1 dia para média severidade
                break;
            case EVENT_SEVERITY.LOW:
            default:
                hours = 48; // 2 dias para baixa severidade
                break;
        }

        now.setHours(now.getHours() + hours);
        return now.toISOString();
    }

    /**
     * Prever impactos básicos de uma opção
     * @param {Object} option - Opção de decisão
     * @param {string} eventType - Tipo do evento
     * @param {string} severity - Severidade do evento
     * @returns {Object} - Impactos previstos
     */
    predictOptionImpacts(option, eventType, severity) {
        const content = option.description.toLowerCase();
        const impacts = {};
        
        // Intensidade baseada na severidade
        const intensityMultiplier = {
            [EVENT_SEVERITY.LOW]: 1,
            [EVENT_SEVERITY.MEDIUM]: 1.5,
            [EVENT_SEVERITY.HIGH]: 2,
            [EVENT_SEVERITY.CRITICAL]: 3
        }[severity] || 1;

        // Análise básica de sentimento das opções
        const positiveWords = ['melhora', 'investe', 'amplia', 'beneficia', 'apoia', 'fortalece'];
        const negativeWords = ['corta', 'reduz', 'elimina', 'suspende', 'cancela', 'rejeita'];
        
        const isPositive = positiveWords.some(word => content.includes(word));
        const isNegative = negativeWords.some(word => content.includes(word));
        
        // Prever direção geral do impacto
        if (isPositive) {
            impacts.general_sentiment = 'positive';
            impacts.predicted_approval_change = Math.round(2 * intensityMultiplier);
        } else if (isNegative) {
            impacts.general_sentiment = 'negative';
            impacts.predicted_approval_change = Math.round(-2 * intensityMultiplier);
        } else {
            impacts.general_sentiment = 'neutral';
            impacts.predicted_approval_change = 0;
        }

        return impacts;
    }
}

module.exports = ScenarioAgentService;