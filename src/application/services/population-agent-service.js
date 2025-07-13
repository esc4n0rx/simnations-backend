const PromptTemplates = require('../../infrastructure/ai/prompt-templates');
const { AGENT_TYPES } = require('../../shared/constants/political-event-constants');

class PopulationAgentService {
    constructor(llmProvider) {
        this.llmProvider = llmProvider;
    }

    /**
     * Gerar reação da população à decisão
     * @param {Object} eventData - Dados do evento
     * @param {Object} chosenOption - Opção escolhida pelo jogador
     * @param {Object} stateData - Estado atual
     * @returns {Promise<Object>} - Reação da população
     */
    async generatePopulationReaction(eventData, chosenOption, stateData) {
        try {
            console.log('🗣️ Agente População: Gerando reação popular...');
            
            const prompt = PromptTemplates.generatePopulationPrompt(eventData, chosenOption, stateData);
            const schema = PromptTemplates.getResponseSchemas().population;
            
            const startTime = Date.now();
            const response = await this.llmProvider.generateStructuredResponse(prompt, schema);
            const processingTime = Date.now() - startTime;

            // Validar e processar a reação
            const validatedReaction = this.validatePopulationReaction(response, stateData);
            
            console.log(`✅ Reação popular gerada em ${processingTime}ms`);
            
            return {
                agent_type: AGENT_TYPES.POPULATION,
                narrative_response: validatedReaction.narrative_response,
                governance_impacts: this.mapPopulationImpactsToGovernance(validatedReaction.impacts),
                economic_impacts: this.mapPopulationImpactsToEconomy(validatedReaction.impacts),
                processing_time_ms: processingTime,
                raw_impacts: validatedReaction.impacts
            };

        } catch (error) {
            console.error('❌ Erro no Agente População:', error);
            throw new Error(`Falha na geração de reação popular: ${error.message}`);
        }
    }

    /**
     * Validar reação da população
     * @param {Object} rawReaction - Reação bruta do LLM
     * @param {Object} stateData - Dados do estado
     * @returns {Object} - Reação validada
     */
    validatePopulationReaction(rawReaction, stateData) {
        if (!rawReaction.narrative_response) {
            throw new Error('Reação popular deve incluir resposta narrativa');
        }

        if (!rawReaction.impacts || typeof rawReaction.impacts !== 'object') {
            throw new Error('Reação popular deve incluir impactos');
        }

        // Validar e limitar valores dos impactos (-10 a +10)
        const validatedImpacts = {};
        const allowedImpacts = ['approval_rating', 'protest_level', 'unemployment_perception', 'inflation_perception'];
        
        allowedImpacts.forEach(impact => {
            if (rawReaction.impacts[impact] !== undefined) {
                const value = Number(rawReaction.impacts[impact]);
                if (!isNaN(value)) {
                    validatedImpacts[impact] = Math.max(-10, Math.min(10, Math.round(value)));
                }
            }
        });

        return {
            narrative_response: rawReaction.narrative_response.substring(0, 500), // Limitar tamanho
            impacts: validatedImpacts
        };
    }

    /**
     * Mapear impactos populares para campos de governança
     * @param {Object} populationImpacts - Impactos gerados pela população
     * @returns {Object} - Impactos mapeados para governança
     */
    mapPopulationImpactsToGovernance(populationImpacts) {
        const governanceImpacts = {};

        // Mapeamento direto: approval_rating
        if (populationImpacts.approval_rating !== undefined) {
            governanceImpacts.approval_rating = populationImpacts.approval_rating;
        }

        // Mapeamento: protest_level afeta political_stability inversamente
        if (populationImpacts.protest_level !== undefined) {
            // Protestos reduzem estabilidade política
            governanceImpacts.political_stability = -Math.abs(populationImpacts.protest_level) * 0.5;
            
            // Também mapear para o campo protest_level se existir
            const protestLevelMapping = {
                0: 'none',
                1: 'none', 
                2: 'minor',
                3: 'minor',
                4: 'moderate',
                5: 'moderate',
                6: 'major',
                7: 'major',
                8: 'widespread',
                9: 'widespread',
                10: 'widespread'
            };
            
            const currentLevel = Math.abs(populationImpacts.protest_level);
            if (currentLevel > 0) {
                governanceImpacts.protest_level_change = protestLevelMapping[currentLevel] || 'moderate';
            }
        }

        return governanceImpacts;
    }

    /*
    * Mapear impactos populares para campos econômicos
    * @param {Object} populationImpacts - Impactos gerados pela população
    * @returns {Object} - Impactos mapeados para economia
    */
   mapPopulationImpactsToEconomy(populationImpacts) {
       const economicImpacts = {};

       // Mapeamento: unemployment_perception afeta taxa de desemprego percebida
       if (populationImpacts.unemployment_perception !== undefined) {
           // Percepção de desemprego pode afetar levemente a taxa real (confiança do consumidor)
           economicImpacts.unemployment_rate = populationImpacts.unemployment_perception * 0.1;
       }

       // Mapeamento: inflation_perception afeta inflação percebida
       if (populationImpacts.inflation_perception !== undefined) {
           // Percepção de inflação pode afetar levemente a taxa real (expectativas inflacionárias)
           economicImpacts.inflation_rate = populationImpacts.inflation_perception * 0.05;
       }

       // Impactos indiretos baseados na aprovação
       if (populationImpacts.approval_rating !== undefined) {
           // Alta aprovação pode melhorar ligeiramente a arrecadação (cooperação fiscal)
           const approvalEffect = populationImpacts.approval_rating * 0.002; // 0.2% por ponto de aprovação
           economicImpacts.monthly_revenue = approvalEffect;
       }

       return economicImpacts;
   }

   /**
    * Gerar reação popular de emergência (fallback)
    * @param {Object} eventData - Dados do evento
    * @param {Object} chosenOption - Opção escolhida
    * @param {Object} stateData - Estado atual
    * @returns {Object} - Reação padrão
    */
   generateFallbackReaction(eventData, chosenOption, stateData) {
       const { governance } = stateData;
       
       // Reação básica baseada na aprovação atual
       let sentiment, approvalChange;
       
       if (governance.approval_rating < 30) {
           sentiment = 'crítica';
           approvalChange = -2;
       } else if (governance.approval_rating < 50) {
           sentiment = 'cautelosa';
           approvalChange = -1;
       } else {
           sentiment = 'esperançosa';
           approvalChange = 1;
       }

       return {
           agent_type: AGENT_TYPES.POPULATION,
           narrative_response: `A população reage de forma ${sentiment} à decisão do governador. ${chosenOption.title} gera discussões nas redes sociais e nos bairros do estado.`,
           governance_impacts: {
               approval_rating: approvalChange
           },
           economic_impacts: {},
           processing_time_ms: 0,
           raw_impacts: {
               approval_rating: approvalChange,
               protest_level: 0,
               unemployment_perception: 0,
               inflation_perception: 0
           },
           is_fallback: true
       };
   }
}

module.exports = PopulationAgentService;