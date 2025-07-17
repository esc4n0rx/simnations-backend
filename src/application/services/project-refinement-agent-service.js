const GovernmentProjectPrompts = require('../../infrastructure/ai/government-project-prompts');
const { AGENT_TYPES, SECURITY_SETTINGS, AGENT_SETTINGS } = require('../../shared/constants/government-project-constants');

class ProjectRefinementAgentService {
    constructor(llmProvider) {
        this.llmProvider = llmProvider;
    }

    /**
     * Refinar ideia do jogador em projeto técnico
     * @param {string} originalIdea - Ideia original do jogador
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<Object>} - Projeto refinado ou rejeição
     */
    async refineProjectIdea(originalIdea, stateData) {
        try {
            console.log('🔧 Agente Refinamento: Processando ideia do jogador...');
            
            // Validação de segurança
            const securityCheck = this.performSecurityCheck(originalIdea);
            if (!securityCheck.isValid) {
                return {
                    status: 'rejected',
                    rejection_reason: securityCheck.reason,
                    security_violation: true
                };
            }

            // Gerar prompt para refinamento
            const prompt = GovernmentProjectPrompts.generateRefinementPrompt(originalIdea, stateData);
            const schema = GovernmentProjectPrompts.getResponseSchemas().refinement;
            
            const startTime = Date.now();
            const response = await this.llmProvider.generateStructuredResponse(
                prompt, 
                schema, 
                {
                    max_tokens: AGENT_SETTINGS.REFINEMENT.MAX_TOKENS,
                    temperature: AGENT_SETTINGS.REFINEMENT.TEMPERATURE
                }
            );
            const processingTime = Date.now() - startTime;

            // Validar resposta
            const validatedResponse = this.validateRefinementResponse(response);
            
            console.log(`✅ Refinamento ${validatedResponse.status}: ${processingTime}ms`);
            
            return {
                ...validatedResponse,
                agent_type: AGENT_TYPES.REFINEMENT,
                processing_time_ms: processingTime,
                original_idea: originalIdea
            };

        } catch (error) {
            console.error('❌ Erro no Agente de Refinamento:', error);
            throw new Error(`Falha no refinamento: ${error.message}`);
        }
    }

    /**
     * Verificações de segurança na ideia original
     * @param {string} idea - Ideia do jogador
     * @returns {Object} - Resultado da verificação
     */
    performSecurityCheck(idea) {
        // Verificar tamanho
        if (idea.length < SECURITY_SETTINGS.MIN_IDEA_LENGTH) {
            return {
                isValid: false,
                reason: 'Ideia muito curta. Forneça mais detalhes sobre sua proposta.'
            };
        }

        if (idea.length > SECURITY_SETTINGS.MAX_IDEA_LENGTH) {
            return {
                isValid: false,
                reason: 'Ideia muito longa. Seja mais conciso em sua proposta.'
            };
        }

        // Verificar palavras blacklistadas
        const lowerIdea = idea.toLowerCase();
        const foundBlacklistedWord = SECURITY_SETTINGS.BLACKLISTED_WORDS.find(word => 
            lowerIdea.includes(word.toLowerCase())
        );
        
        if (foundBlacklistedWord) {
            return {
                isValid: false,
                reason: 'Conteúdo inadequado detectado. Propostas devem ser éticas e legais.'
            };
        }

        // Verificar padrões de prompt injection
        const hasPromptInjection = SECURITY_SETTINGS.PROMPT_INJECTION_PATTERNS.some(pattern => 
            pattern.test(idea)
        );
        
        if (hasPromptInjection) {
            return {
                isValid: false,
                reason: 'Formato de entrada inválido. Descreva sua ideia de forma natural.'
            };
        }

        return {
            isValid: true,
            reason: null
        };
    }

    /**
     * Validar resposta do agente de refinamento
     * @param {Object} response - Resposta do LLM
     * @returns {Object} - Resposta validada
     */
    validateRefinementResponse(response) {
        // Verificar campos obrigatórios
        if (!response.status) {
            throw new Error('Resposta sem status definido');
        }

        if (response.status === 'rejected') {
            return {
                status: 'rejected',
                rejection_reason: response.rejection_reason || 'Projeto rejeitado pela análise técnica',
                name: null,
                objective: null,
                description: null,
                justification: null,
                target_population: null,
                expected_impacts: null,
                project_type: null
            };
        }

        if (response.status === 'approved') {
            // Validar campos obrigatórios para projetos aprovados
            const requiredFields = ['name', 'objective', 'description', 'justification', 'target_population', 'project_type'];
            
            for (const field of requiredFields) {
                if (!response[field] || response[field].trim().length === 0) {
                    throw new Error(`Campo obrigatório ausente: ${field}`);
                }
            }

            // Validar impactos esperados
            if (!response.expected_impacts || 
                !Array.isArray(response.expected_impacts.economic) || 
                !Array.isArray(response.expected_impacts.social)) {
                throw new Error('Impactos esperados inválidos');
            }

            return {
                status: 'approved',
                rejection_reason: null,
                name: response.name.trim(),
                objective: response.objective.trim(),
                description: response.description.trim(),
                justification: response.justification.trim(),
                target_population: response.target_population.trim(),
                expected_impacts: response.expected_impacts,
                project_type: response.project_type
            };
        }

        throw new Error(`Status de resposta inválido: ${response.status}`);
    }

    /**
     * Verificar disponibilidade do agente
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            return await this.llmProvider.isAvailable();
        } catch (error) {
            console.error('❌ Agente de Refinamento indisponível:', error);
            return false;
        }
    }

    /**
     * Obter estatísticas do agente
     * @returns {Object}
     */
    getAgentStats() {
        return {
            agent_type: AGENT_TYPES.REFINEMENT,
            max_tokens: AGENT_SETTINGS.REFINEMENT.MAX_TOKENS,
            temperature: AGENT_SETTINGS.REFINEMENT.TEMPERATURE,
            timeout: AGENT_SETTINGS.REFINEMENT.TIMEOUT,
            security_enabled: true
        };
    }
}

module.exports = ProjectRefinementAgentService;