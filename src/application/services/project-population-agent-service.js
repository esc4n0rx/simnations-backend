const GovernmentProjectPrompts = require('../../infrastructure/ai/government-project-prompts');
const { AGENT_TYPES, AGENT_SETTINGS } = require('../../shared/constants/government-project-constants');

class ProjectPopulationAgentService {
    constructor(llmProvider) {
        this.llmProvider = llmProvider;
    }

    /**
     * Gerar reação da população ao projeto aprovado
     * @param {Object} projectData - Dados completos do projeto
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<Object>} - Reação da população
     */
    async generatePopulationReaction(projectData, stateData) {
        try {
            console.log('👥 Agente População: Simulando reação popular...');
            
            // Gerar prompt para reação
            const prompt = GovernmentProjectPrompts.generatePopulationPrompt(projectData, stateData);
            const schema = GovernmentProjectPrompts.getResponseSchemas().population;
            
            const startTime = Date.now();
            const response = await this.llmProvider.generateStructuredResponse(
                prompt, 
                schema, 
                {
                    max_tokens: AGENT_SETTINGS.POPULATION.MAX_TOKENS,
                    temperature: AGENT_SETTINGS.POPULATION.TEMPERATURE
                }
            );
            const processingTime = Date.now() - startTime;

            // Validar e ajustar reação
            const validatedReaction = this.validatePopulationReaction(response, stateData);
            
            console.log(`✅ Reação popular gerada: ${validatedReaction.approval_impact > 0 ? '+' : ''}${validatedReaction.approval_impact} aprovação em ${processingTime}ms`);
            
            return {
                ...validatedReaction,
                agent_type: AGENT_TYPES.POPULATION,
                processing_time_ms: processingTime,
                context: {
                    current_approval: stateData.governance.approval_rating,
                    population_size: stateData.state_info.population,
                    economic_situation: this.assessEconomicSituation(stateData.economy)
                }
            };

        } catch (error) {
            console.error('❌ Erro no Agente de População:', error);
            throw new Error(`Falha na geração de reação popular: ${error.message}`);
        }
    }

    /**
     * Validar reação da população
     * @param {Object} reaction - Reação bruta do LLM
     * @param {Object} stateData - Dados do estado
     * @returns {Object} - Reação validada
     */
    validatePopulationReaction(reaction, stateData) {
        // Validar opinião pública
        const publicOpinion = reaction.public_opinion && reaction.public_opinion.trim().length > 0 ?
            reaction.public_opinion.trim() : 
            'A população aguarda os resultados deste projeto.';

        // Validar reações setoriais
        const sectorReactions = this.validateSectorReactions(reaction.sector_reactions);

        // Validar impacto na aprovação (-10 a +10)
        let approvalImpact = reaction.approval_impact || 0;
        approvalImpact = Math.max(-10, Math.min(10, approvalImpact));
        
        // Ajustar baseado no contexto econômico
        approvalImpact = this.adjustApprovalBasedOnContext(approvalImpact, stateData);

        // Validar nível de protesto (0 a 10)
        let protestLevel = reaction.protest_level || 0;
        protestLevel = Math.max(0, Math.min(10, protestLevel));

        // Validar cobertura da mídia
        const mediaCoverage = ['positive', 'neutral', 'negative'].includes(reaction.media_coverage) ?
            reaction.media_coverage : 'neutral';

        return {
            public_opinion: publicOpinion,
            sector_reactions: sectorReactions,
            approval_impact: parseFloat(approvalImpact.toFixed(1)),
            protest_level: protestLevel,
            media_coverage: mediaCoverage
        };
    }

    /**
     * Validar reações setoriais
     * @param {Array} sectorReactions - Reações propostas
     * @returns {Array} - Reações validadas
     */
    validateSectorReactions(sectorReactions) {
        const defaultSectors = [
            { sector: 'Empresários locais', reaction: 'Aguardando impactos econômicos.' },
            { sector: 'Trabalhadores', reaction: 'Esperando geração de empregos.' },
            { sector: 'Estudantes', reaction: 'Acompanhando desenvolvimento.' }
        ];

        if (!Array.isArray(sectorReactions) || sectorReactions.length === 0) {
            return defaultSectors;
        }

        return sectorReactions.map(reaction => ({
            sector: reaction.sector || 'Setor não especificado',
            reaction: reaction.reaction && reaction.reaction.trim().length > 0 ?
                reaction.reaction.trim() : 'Sem comentários.'
        }));
    }

    /**
     * Ajustar aprovação baseado no contexto econômico
     * @param {number} baseApproval - Aprovação base
     * @param {Object} stateData - Dados do estado
     * @returns {number} - Aprovação ajustada
     */
    adjustApprovalBasedOnContext(baseApproval, stateData) {
        const { economy, governance } = stateData;
        
        // Fator baseado na situação econômica
        let economicFactor = 1;
        if (economy.treasury_balance < 0) {
            economicFactor = 0.7; // População mais crítica se tesouro negativo
        } else if (economy.unemployment_rate > 15) {
            economicFactor = 0.8; // População mais crítica com alto desemprego
        } else if (economy.inflation_rate > 10) {
            economicFactor = 0.9; // População mais crítica com alta inflação
        }

        // Fator baseado na aprovação atual
        let approvalFactor = 1;
        if (governance.approval_rating < 30) {
            approvalFactor = 0.6; // Governo impopular tem reações mais negativas
        } else if (governance.approval_rating > 70) {
            approvalFactor = 1.3; // Governo popular tem reações mais positivas
        }

        const adjustedApproval = baseApproval * economicFactor * approvalFactor;
        return Math.max(-10, Math.min(10, adjustedApproval));
    }

    /**
     * Avaliar situação econômica
     * @param {Object} economy - Dados econômicos
     * @returns {string} - Situação (good/fair/poor/critical)
     */
    assessEconomicSituation(economy) {
        let score = 0;
        
        // Tesouro
        if (economy.treasury_balance > economy.gdp * 0.1) score += 2;
        else if (economy.treasury_balance > 0) score += 1;
        else score -= 1;
        
        // Desemprego
        if (economy.unemployment_rate < 5) score += 2;
        else if (economy.unemployment_rate < 10) score += 1;
        else if (economy.unemployment_rate > 15) score -= 1;
        
        // Inflação
        if (economy.inflation_rate < 3) score += 1;
        else if (economy.inflation_rate > 10) score -= 1;
        
        // Dívida
        if (economy.public_debt < economy.gdp * 0.5) score += 1;
        else if (economy.public_debt > economy.gdp) score -= 1;

        if (score >= 4) return 'good';
        if (score >= 2) return 'fair';
        if (score >= 0) return 'poor';
        return 'critical';
    }

    /**
     * Gerar reação para cancelamento de projeto
     * @param {Object} projectData - Dados do projeto cancelado
     * @param {string} cancellationReason - Motivo do cancelamento
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<Object>} - Reação ao cancelamento
     */
    async generateCancellationReaction(projectData, cancellationReason, stateData) {
        try {
            console.log('👥 Agente População: Reagindo ao cancelamento...');
            
            const publicOpinion = this.generateCancellationOpinion(projectData, cancellationReason, stateData);
            const approvalImpact = this.calculateCancellationImpact(projectData, stateData);
            
            return {
                public_opinion: publicOpinion,
                sector_reactions: [
                    {
                        sector: 'População geral',
                        reaction: 'Decepcionada com o cancelamento do projeto.'
                    }
                ],
                approval_impact: approvalImpact,
                protest_level: Math.abs(approvalImpact) > 3 ? Math.ceil(Math.abs(approvalImpact) / 2) : 0,
                media_coverage: 'negative',
                agent_type: AGENT_TYPES.POPULATION,
                is_cancellation_reaction: true
            };

        } catch (error) {
            console.error('❌ Erro na reação de cancelamento:', error);
            throw error;
        }
    }

    /**
     * Gerar opinião sobre cancelamento
     * @param {Object} projectData - Dados do projeto
     * @param {string} reason - Motivo do cancelamento
     * @param {Object} stateData - Dados do estado
     * @returns {string} - Opinião pública
     */
    generateCancellationOpinion(projectData, reason, stateData) {
        const projectName = projectData.refined_project?.name || 'projeto';
        return `A população demonstra descontentamento com o cancelamento do ${projectName}. ${reason} Muitos cidadãos esperavam os benefícios prometidos e questionam a gestão dos recursos públicos.`;
    }

    /**
     * Calcular impacto do cancelamento na aprovação
     * @param {Object} projectData - Dados do projeto
     * @param {Object} stateData - Dados do estado
     * @returns {number} - Impacto na aprovação
     */
    calculateCancellationImpact(projectData, stateData) {
        let impact = -2; // Base negativa para cancelamentos
        
        // Impacto maior se o projeto tinha alto custo (mais expectativa)
        if (projectData.analysis_data?.implementation_cost > stateData.economy.gdp * 0.05) {
            impact -= 2;
        }
        
        // Impacto maior se aprovação já está baixa
        if (stateData.governance.approval_rating < 40) {
            impact -= 1;
        }
        
        return Math.max(-8, impact); // Máximo -8 pontos
    }

    /**
     * Verificar disponibilidade do agente
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            return await this.llmProvider.isAvailable();
        } catch (error) {
            console.error('❌ Agente de População indisponível:', error);
            return false;
        }
    }

    /**
     * Obter estatísticas do agente
     * @returns {Object}
     */
    getAgentStats() {
        return {
            agent_type: AGENT_TYPES.POPULATION,
            max_tokens: AGENT_SETTINGS.POPULATION.MAX_TOKENS,
            temperature: AGENT_SETTINGS.POPULATION.TEMPERATURE,
            timeout: AGENT_SETTINGS.POPULATION.TIMEOUT,
            context_aware: true
        };
    }
}

module.exports = ProjectPopulationAgentService;