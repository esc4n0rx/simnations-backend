const { INSTITUTIONAL_PERSONAS } = require('../../shared/constants/political-event-constants');

class PromptTemplates {
    /**
     * Gerar prompt para o Agente 1 (Gerador de Cenário)
     * @param {Object} stateData - Dados completos do estado
     * @param {Array} recentEvents - Eventos recentes para evitar repetição
     * @returns {string} - Prompt contextualizado
     */
    static generateScenarioPrompt(stateData, recentEvents = []) {
        const { economy, governance, state_info } = stateData;
        
        // Identificar principais problemas
        const economicIssues = this.identifyEconomicIssues(economy);
        const politicalIssues = this.identifyPoliticalIssues(governance);
        
        // Contexto de eventos recentes
        const recentContext = recentEvents.length > 0 
            ? `Eventos recentes que devem ser evitados: ${recentEvents.map(e => e.event_type).join(', ')}`
            : 'Nenhum evento recente para evitar.';

        return `Você é um especialista em política e administração pública. Analise a situação atual do estado ${state_info.state}, ${state_info.country}, e gere um evento político-administrativo realista que o governador deve enfrentar.

SITUAÇÃO ECONÔMICA ATUAL:
- PIB: R$ ${economy.gdp.toFixed(2)} milhões
- Crescimento do PIB: ${economy.gdp_growth_rate}% ao ano
- Taxa de Desemprego: ${economy.unemployment_rate}%
- Taxa de Inflação: ${economy.inflation_rate}%
- Saldo do Tesouro: R$ ${economy.treasury_balance.toFixed(2)} milhões
- Receita Mensal: R$ ${economy.monthly_revenue.toFixed(2)} milhões
- Despesa Mensal: R$ ${economy.monthly_expenses.toFixed(2)} milhões
- Saldo Mensal: R$ ${(economy.monthly_revenue - economy.monthly_expenses).toFixed(2)} milhões
- Razão Dívida/PIB: ${economy.debt_to_gdp_ratio.toFixed(1)}%

SITUAÇÃO POLÍTICA ATUAL:
- Aprovação Popular: ${governance.approval_rating.toFixed(1)}%
- Estabilidade Política: ${governance.political_stability.toFixed(1)}%
- Índice de Corrupção: ${governance.corruption_index.toFixed(1)}%
- Nível de Protestos: ${governance.protest_level}
- Risco de Golpe: ${governance.coup_risk_level}
- Relações Internacionais: ${governance.international_relations.toFixed(1)}%

PRINCIPAIS DESAFIOS IDENTIFICADOS:
Econômicos: ${economicIssues.join(', ') || 'Nenhum problema crítico'}
Políticos: ${politicalIssues.join(', ') || 'Situação estável'}

${recentContext}

INSTRUÇÕES:
1. Crie um evento político-administrativo que seja:
   - Realista para o contexto do estado atual
   - Diretamente relacionado aos indicadores atuais
   - Urgente e que exija decisão imediata
   - Que tenha consequências econômicas e sociais claras
   - Respostas sempre em portugues

2. O evento deve incluir:
   - Título impactante (máximo 60 caracteres)
   - Descrição narrativa envolvente (150-300 palavras)
   - Classificação de tipo e severidade
   - 3-4 opções de decisão realistas

3. Cada opção deve ter:
   - Título claro da ação (máximo 80 caracteres)
   - Descrição detalhada (100-200 palavras)
   - Consequências implícitas óbvias

RESPONDA APENAS COM O JSON:`;
    }

    /**
     * Gerar prompt para o Agente 2 (População)
     * @param {Object} eventData - Dados do evento
     * @param {Object} chosenOption - Opção escolhida pelo jogador
     * @param {Object} stateData - Estado atual
     * @returns {string} - Prompt para reação popular
     */
    static generatePopulationPrompt(eventData, chosenOption, stateData) {
        const { economy, governance } = stateData;
        
        return `Você é a voz do povo do estado ${stateData.state_info.state}. Reaja emocionalmente à decisão do governador com linguagem popular autêntica.

EVENTO: ${eventData.title}
SITUAÇÃO: ${eventData.description}

DECISÃO DO GOVERNADOR: ${chosenOption.title}
DETALHES DA DECISÃO: ${chosenOption.description}

CONTEXTO POPULACIONAL:
- Aprovação atual do governo: ${governance.approval_rating.toFixed(1)}%
- Taxa de desemprego: ${economy.unemployment_rate}%
- Inflação (percepção de custo): ${economy.inflation_rate}%
- Situação do tesouro: ${economy.treasury_balance > 0 ? 'positiva' : 'crítica'}

INSTRUÇÕES:
1. Reaja como cidadão comum, usando:
   - Linguagem coloquial e emocional
   - Referências ao impacto no dia a dia
   - Tom que varia entre gratidão, indignação, ceticismo ou apoio
   - Máximo 200 palavras
   - Respostas sempre em portugues

2. Atribua impactos numéricos realistas (-10 a +10):
   - approval_rating: como a decisão afeta a popularidade
   - protest_level: intensidade de manifestações
   - unemployment_perception: como afeta a percepção de emprego
   - inflation_perception: como afeta a percepção de custo de vida

RESPONDA APENAS COM O JSON:`;
    }

    /**
     * Gerar prompt para o Agente 3 (Institucional)
     * @param {Object} eventData - Dados do evento
     * @param {Object} chosenOption - Opção escolhida
     * @param {Object} stateData - Estado atual
     * @param {string} persona - Persona institucional
     * @returns {string} - Prompt para análise institucional
     */
    static generateInstitutionalPrompt(eventData, chosenOption, stateData, persona) {
        const { economy, governance } = stateData;
        const personaConfig = this.getPersonaConfig(persona);
        
        return `Você é ${personaConfig.description}. Analise tecnicamente a decisão do governador sob a perspectiva ${personaConfig.perspective}.

EVENTO: ${eventData.title}
CONTEXTO: ${eventData.description}

DECISÃO ANALISADA: ${chosenOption.title}
DETALHES: ${chosenOption.description}

DADOS TÉCNICOS ATUAIS:
Economia:
- PIB: R$ ${economy.gdp.toFixed(2)} milhões (crescimento: ${economy.gdp_growth_rate}%)
- Receita mensal: R$ ${economy.monthly_revenue.toFixed(2)} milhões
- Despesa mensal: R$ ${economy.monthly_expenses.toFixed(2)} milhões
- Tesouro: R$ ${economy.treasury_balance.toFixed(2)} milhões
- Dívida/PIB: ${economy.debt_to_gdp_ratio.toFixed(1)}%

Governança:
- Estabilidade política: ${governance.political_stability.toFixed(1)}%
- Índice de corrupção: ${governance.corruption_index.toFixed(1)}%
- Relações internacionais: ${governance.international_relations.toFixed(1)}%

INSTRUÇÕES:
1. Forneça uma análise técnica (150-250 palavras) com:
   - Tom ${personaConfig.tone}
   - Foco em ${personaConfig.focus}
   - Linguagem ${personaConfig.language}
   - Respostas sempre em portugues

2. Atribua impactos precisos nos indicadores (-15 a +15):
   ${personaConfig.impactCategories.map(cat => `- ${cat}: justifique o valor`).join('\n   ')}

3. Explique brevemente cada impacto atribuído.

RESPONDA APENAS COM O JSON:`;
    }

    /**
     * Identificar problemas econômicos críticos
     * @param {Object} economy - Dados econômicos
     * @returns {Array} - Lista de problemas
     */
    static identifyEconomicIssues(economy) {
        const issues = [];
        
        if (economy.unemployment_rate > 8) issues.push('alto desemprego');
        if (economy.inflation_rate > 6) issues.push('inflação elevada');
        if (economy.gdp_growth_rate < 0) issues.push('recessão econômica');
        if (economy.debt_to_gdp_ratio > 80) issues.push('alta dívida pública');
        if ((economy.monthly_revenue - economy.monthly_expenses) < 0) issues.push('déficit orçamentário');
        if (economy.treasury_balance < economy.monthly_expenses) issues.push('crise de liquidez');
        
        return issues;
    }

    /**
     * Identificar problemas políticos críticos
     * @param {Object} governance - Dados de governança
     * @returns {Array} - Lista de problemas
     */
    static identifyPoliticalIssues(governance) {
        const issues = [];
        
        if (governance.approval_rating < 30) issues.push('baixa aprovação popular');
        if (governance.political_stability < 50) issues.push('instabilidade política');
        if (governance.corruption_index > 70) issues.push('alta percepção de corrupção');
        if (['major', 'widespread'].includes(governance.protest_level)) issues.push('protestos intensos');
        if (['high', 'critical'].includes(governance.coup_risk_level)) issues.push('risco de golpe');
        if (governance.international_relations < 50) issues.push('tensões diplomáticas');
        
        return issues;
    }

    /**
     * Configurações das personas institucionais
     * @param {string} persona - Tipo de persona
     * @returns {Object} - Configuração da persona
     */
    static getPersonaConfig(persona) {
        const configs = {
            [INSTITUTIONAL_PERSONAS.MINISTRY_OF_ECONOMY]: {
                description: 'representante do Ministério da Economia',
                perspective: 'macroeconômica e fiscal',
                tone: 'técnico e cauteloso',
                focus: 'impactos fiscais e macroeconômicos',
                language: 'formal e técnica',
                impactCategories: [
                    'political_stability',
                    'monthly_revenue', 
                    'monthly_expenses',
                    'gdp_growth_rate',
                    'inflation_rate'
                ]
            },
            
            [INSTITUTIONAL_PERSONAS.INVESTORS]: {
                description: 'analista representando investidores e mercado financeiro',
                perspective: 'de confiança no mercado e ambiente de negócios',
                tone: 'pragmático e orientado a resultados',
                focus: 'clima de investimento e estabilidade econômica',
                language: 'empresarial e direta',
                impactCategories: [
                    'political_stability',
                    'international_relations',
                    'gdp_growth_rate',
                    'monthly_revenue',
                    'corruption_index'
                ]
            },

            [INSTITUTIONAL_PERSONAS.UNIONS]: {
                description: 'líder sindical representando trabalhadores',
                perspective: 'dos direitos trabalhistas e bem-estar social',
                tone: 'combativo mas responsável',
                focus: 'emprego, salários e condições de trabalho',
                language: 'popular mas organizada',
                impactCategories: [
                    'approval_rating',
                    'unemployment_rate',
                    'monthly_expenses',
                    'protest_level',
                    'political_stability'
                ]
            },

            [INSTITUTIONAL_PERSONAS.BUSINESS_SECTOR]: {
                description: 'representante do setor empresarial',
                perspective: 'competitividade e ambiente de negócios',
                tone: 'assertivo e focado em eficiência',
                focus: 'redução de custos e melhoria do ambiente empresarial',
                language: 'empresarial e objetiva',
                impactCategories: [
                    'monthly_revenue',
                    'gdp_growth_rate',
                    'unemployment_rate',
                    'political_stability',
                    'corruption_index'
                ]
            },

            [INSTITUTIONAL_PERSONAS.PRESS]: {
                description: 'jornalista especializado em política e economia',
                perspective: 'transparência e impacto na opinião pública',
                tone: 'investigativo e questionador',
                focus: 'transparência, accountability e impacto social',
                language: 'jornalística e incisiva',
                impactCategories: [
                    'approval_rating',
                    'corruption_index',
                    'political_stability',
                    'international_relations',
                    'protest_level'
                ]
            },

            [INSTITUTIONAL_PERSONAS.ACADEMIA]: {
                description: 'professor de ciências políticas/economia',
                perspective: 'acadêmica e baseada em evidências',
                tone: 'analítico e imparcial',
                focus: 'consequências sistêmicas de longo prazo',
                language: 'acadêmica e fundamentada',
                impactCategories: [
                    'political_stability',
                    'gdp_growth_rate',
                    'international_relations',
                    'corruption_index',
                    'inflation_rate'
                ]
            }
        };

        return configs[persona] || configs[INSTITUTIONAL_PERSONAS.MINISTRY_OF_ECONOMY];
    }

    /**
     * Schemas JSON para validação de respostas
     */
    static getResponseSchemas() {
        return {
            scenario: {
                title: "string",
                description: "string", 
                event_type: "string",
                severity: "string",
                options: [
                    {
                        title: "string",
                        description: "string"
                    }
                ]
            },

            population: {
                narrative_response: "string",
                impacts: {
                    approval_rating: "number",
                    protest_level: "number", 
                    unemployment_perception: "number",
                    inflation_perception: "number"
                }
            },

            institutional: {
                narrative_response: "string",
                impacts: {
                    political_stability: "number",
                    monthly_revenue: "number",
                    monthly_expenses: "number",
                    gdp_growth_rate: "number",
                    corruption_index: "number",
                    international_relations: "number"
                },
                impact_explanations: {
                    political_stability: "string",
                    monthly_revenue: "string",
                    monthly_expenses: "string",
                    gdp_growth_rate: "string",
                    corruption_index: "string",
                    international_relations: "string"
                }
            }
        };
    }
}

module.exports = PromptTemplates;