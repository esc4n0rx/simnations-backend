const PromptTemplates = require('../../infrastructure/ai/prompt-templates');
const { AGENT_TYPES, INSTITUTIONAL_PERSONAS } = require('../../shared/constants/political-event-constants');

class InstitutionalAgentService {
    constructor(llmProvider) {
        this.llmProvider = llmProvider;
    }

    /**
     * Gerar reação institucional à decisão
     * @param {Object} eventData - Dados do evento
     * @param {Object} chosenOption - Opção escolhida pelo jogador
     * @param {Object} stateData - Estado atual
     * @returns {Promise<Object>} - Reação institucional
     */
    async generateInstitutionalReaction(eventData, chosenOption, stateData) {
        try {
            console.log('🏛️ Agente Institucional: Gerando parecer técnico...');
            
            // Selecionar persona mais apropriada para o evento
            const persona = this.selectAppropriatePersona(eventData, chosenOption);
            
            const prompt = PromptTemplates.generateInstitutionalPrompt(
                eventData, 
                chosenOption, 
                stateData, 
                persona
            );
            const schema = PromptTemplates.getResponseSchemas().institutional;
            
            const startTime = Date.now();
            const response = await this.llmProvider.generateStructuredResponse(prompt, schema);
            const processingTime = Date.now() - startTime;

            // Validar e processar a reação
            const validatedReaction = this.validateInstitutionalReaction(response, persona);
            
            console.log(`✅ Parecer institucional (${persona}) gerado em ${processingTime}ms`);
            
            return {
                agent_type: AGENT_TYPES.INSTITUTIONAL,
                institutional_persona: persona,
                narrative_response: validatedReaction.narrative_response,
                governance_impacts: validatedReaction.governance_impacts,
                economic_impacts: validatedReaction.economic_impacts,
                processing_time_ms: processingTime,
                impact_explanations: validatedReaction.impact_explanations
            };

        } catch (error) {
            console.error('❌ Erro no Agente Institucional:', error);
            throw new Error(`Falha na geração de parecer institucional: ${error.message}`);
        }
    }

    /**
     * Selecionar persona mais apropriada baseada no evento
     * @param {Object} eventData - Dados do evento
     * @param {Object} chosenOption - Opção escolhida
     * @returns {string} - Persona selecionada
     */
    selectAppropriatePersona(eventData, chosenOption) {
        const eventContent = (eventData.title + ' ' + eventData.description + ' ' + chosenOption.description).toLowerCase();
        
        // Mapeamento de palavras-chave para personas
        const personaKeywords = {
            [INSTITUTIONAL_PERSONAS.MINISTRY_OF_ECONOMY]: [
                'orçamento', 'fiscal', 'tributo', 'imposto', 'pib', 'dívida', 'receita', 'economia'
            ],
            [INSTITUTIONAL_PERSONAS.INVESTORS]: [
                'investimento', 'mercado', 'empresário', 'negócio', 'setor privado', 'competitividade'
            ],
            [INSTITUTIONAL_PERSONAS.UNIONS]: [
                'trabalhador', 'salário', 'emprego', 'sindicato', 'greve', 'direito trabalhista'
            ],
            [INSTITUTIONAL_PERSONAS.BUSINESS_SECTOR]: [
                'empresa', 'indústria', 'comércio', 'empresarial', 'produção', 'setor produtivo'
            ],
            [INSTITUTIONAL_PERSONAS.PRESS]: [
                'transparência', 'corrupção', 'escândalo', 'denúncia', 'investigação', 'accountability'
            ],
            [INSTITUTIONAL_PERSONAS.ACADEMIA]: [
                'pesquisa', 'estudo', 'universidade', 'científico', 'análise', 'acadêmico'
            ]
        };

        // Calcular score para cada persona
        let bestPersona = INSTITUTIONAL_PERSONAS.MINISTRY_OF_ECONOMY; // padrão
        let bestScore = 0;

        Object.entries(personaKeywords).forEach(([persona, keywords]) => {
            const score = keywords.filter(keyword => eventContent.includes(keyword)).length;
            if (score > bestScore) {
                bestScore = score;
                bestPersona = persona;
            }
        });

        // Se nenhuma palavra-chave correspondeu, usar persona baseada no tipo de evento
        if (bestScore === 0) {
            const eventTypeMapping = {
                'economic': INSTITUTIONAL_PERSONAS.MINISTRY_OF_ECONOMY,
                'social': INSTITUTIONAL_PERSONAS.UNIONS,
                'political': INSTITUTIONAL_PERSONAS.PRESS,
                'administrative': INSTITUTIONAL_PERSONAS.ACADEMIA,
                'infrastructure': INSTITUTIONAL_PERSONAS.BUSINESS_SECTOR
            };
            
            bestPersona = eventTypeMapping[eventData.event_type] || INSTITUTIONAL_PERSONAS.MINISTRY_OF_ECONOMY;
        }

        return bestPersona;
    }

    /**
     * Validar reação institucional
     * @param {Object} rawReaction - Reação bruta do LLM
     * @param {string} persona - Persona utilizada
     * @returns {Object} - Reação validada
     */
    validateInstitutionalReaction(rawReaction, persona) {
        if (!rawReaction.narrative_response) {
            throw new Error('Reação institucional deve incluir resposta narrativa');
        }

        if (!rawReaction.impacts || typeof rawReaction.impacts !== 'object') {
            throw new Error('Reação institucional deve incluir impactos');
        }

        // Separar impactos por categoria
        const governanceImpacts = {};
        const economicImpacts = {};

        // Categorias de impactos por tipo
        const governanceFields = [
            'political_stability', 
            'corruption_index', 
            'international_relations', 
            'approval_rating'
        ];
        
        const economicFields = [
            'monthly_revenue', 
            'monthly_expenses', 
            'gdp_growth_rate', 
            'treasury_balance', 
            'unemployment_rate', 
            'inflation_rate'
        ];

        // Validar e categorizar impactos (-15 a +15)
        Object.entries(rawReaction.impacts).forEach(([field, value]) => {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                const clampedValue = Math.max(-15, Math.min(15, Math.round(numValue * 100) / 100));
                
                if (governanceFields.includes(field)) {
                    governanceImpacts[field] = clampedValue;
                } else if (economicFields.includes(field)) {
                    economicImpacts[field] = clampedValue;
                }
            }
        });

        // Validar explicações dos impactos
        const impactExplanations = {};
        if (rawReaction.impact_explanations && typeof rawReaction.impact_explanations === 'object') {
            Object.entries(rawReaction.impact_explanations).forEach(([field, explanation]) => {
                if (typeof explanation === 'string' && explanation.length > 0) {
                    impactExplanations[field] = explanation.substring(0, 200); // Limitar tamanho
                }
            });
        }

        return {
            narrative_response: rawReaction.narrative_response.substring(0, 800), // Limitar tamanho
            governance_impacts: governanceImpacts,
            economic_impacts: economicImpacts,
            impact_explanations: impactExplanations
        };
    }

    /**
     * Gerar reação institucional de emergência (fallback)
     * @param {Object} eventData - Dados do evento
     * @param {Object} chosenOption - Opção escolhida
     * @param {string} persona - Persona a usar
     * @returns {Object} - Reação padrão
     */
    generateFallbackReaction(eventData, chosenOption, persona = INSTITUTIONAL_PERSONAS.MINISTRY_OF_ECONOMY) {
        const personaConfig = PromptTemplates.getPersonaConfig(persona);
        
        return {
            agent_type: AGENT_TYPES.INSTITUTIONAL,
            institutional_persona: persona,
            narrative_response: `O ${personaConfig.description} avalia que a decisão "${chosenOption.title}" terá impactos moderados nos indicadores monitorados pela instituição. Será necessário acompanhar os desdobramentos nos próximos períodos.`,
            governance_impacts: {
                political_stability: 0
            },
            economic_impacts: {
                monthly_revenue: 0
            },
            processing_time_ms: 0,
            impact_explanations: {
                political_stability: 'Impacto neutro na estabilidade política',
                monthly_revenue: 'Sem alterações significativas na receita'
            },
            is_fallback: true
        };
    }

    /**
     * Ajustar impactos baseado na credibilidade da persona
     * @param {Object} impacts - Impactos originais
     * @param {string} persona - Persona utilizada
     * @param {Object} stateData - Dados do estado
     * @returns {Object} - Impactos ajustados
     */
    adjustImpactsByPersonaCredibility(impacts, persona, stateData) {
        // Credibilidade varia baseada na situação atual
        const { governance } = stateData;
        
        let credibilityMultiplier = 1.0;
        
        switch (persona) {
            case INSTITUTIONAL_PERSONAS.MINISTRY_OF_ECONOMY:
                // Ministério tem mais credibilidade com governo estável
                credibilityMultiplier = 0.8 + (governance.political_stability / 100) * 0.4;
                break;
                
            case INSTITUTIONAL_PERSONAS.INVESTORS:
                // Investidores têm mais peso com baixa corrupção
                credibilityMultiplier = 0.7 + ((100 - governance.corruption_index) / 100) * 0.5;
                break;
                
            case INSTITUTIONAL_PERSONAS.PRESS:
                // Imprensa tem mais impacto com liberdade de expressão
                credibilityMultiplier = 0.9 + (governance.political_stability / 100) * 0.2;
                break;
                
            case INSTITUTIONAL_PERSONAS.UNIONS:
                // Sindicatos têm mais força com alta aprovação popular
                credibilityMultiplier = 0.6 + (governance.approval_rating / 100) * 0.6;
                break;
                
            default:
                credibilityMultiplier = 1.0;
        }

        // Aplicar multiplicador aos impactos
        const adjustedImpacts = {};
        Object.entries(impacts).forEach(([field, value]) => {
            adjustedImpacts[field] = Math.round((value * credibilityMultiplier) * 100) / 100;
        });

        return adjustedImpacts;
    }
}

module.exports = InstitutionalAgentService;