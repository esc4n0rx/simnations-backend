const GovernmentProjectPrompts = require('../../infrastructure/ai/government-project-prompts');
const { AGENT_TYPES, PROJECT_RISKS, EXECUTION_METHODS, AGENT_SETTINGS } = require('../../shared/constants/government-project-constants');

class ProjectAnalysisAgentService {
    constructor(llmProvider) {
        this.llmProvider = llmProvider;
    }

    /**
     * Analisar viabilidade técnica e financeira do projeto
     * @param {Object} refinedProject - Projeto refinado
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<Object>} - Análise detalhada
     */
    async analyzeProject(refinedProject, stateData) {
        try {
            console.log('📊 Agente Análise: Avaliando viabilidade do projeto...');
            
            // Gerar prompt para análise
            const prompt = GovernmentProjectPrompts.generateAnalysisPrompt(refinedProject, stateData);
            const schema = GovernmentProjectPrompts.getResponseSchemas().analysis;
            
            const startTime = Date.now();
            const response = await this.llmProvider.generateStructuredResponse(
                prompt, 
                schema, 
                {
                    max_tokens: AGENT_SETTINGS.ANALYSIS.MAX_TOKENS,
                    temperature: AGENT_SETTINGS.ANALYSIS.TEMPERATURE
                }
            );
            const processingTime = Date.now() - startTime;

            // Validar e ajustar análise
            const validatedAnalysis = this.validateAndAdjustAnalysis(response, stateData);
            
            console.log(`✅ Análise concluída: R$ ${validatedAnalysis.implementation_cost.toLocaleString()} em ${processingTime}ms`);
            
            return {
                ...validatedAnalysis,
                agent_type: AGENT_TYPES.ANALYSIS,
                processing_time_ms: processingTime,
                state_context: {
                    treasury_balance: stateData.economy.treasury_balance,
                    monthly_revenue: this.calculateMonthlyRevenue(stateData.economy),
                    affordability_score: this.calculateAffordabilityScore(validatedAnalysis, stateData)
                }
            };

        } catch (error) {
            console.error('❌ Erro no Agente de Análise:', error);
            throw new Error(`Falha na análise: ${error.message}`);
        }
    }

    /**
     * Validar e ajustar dados da análise
     * @param {Object} analysis - Análise bruta do LLM
     * @param {Object} stateData - Dados do estado
     * @returns {Object} - Análise validada
     */
    validateAndAdjustAnalysis(analysis, stateData) {
        const { economy } = stateData;
        
        // Validar custo de implementação
        let implementationCost = this.validateCost(analysis.implementation_cost, economy);
        
        // Determinar método de execução baseado na capacidade financeira
        const monthlyRevenue = this.calculateMonthlyRevenue(economy);
        const executionMethod = implementationCost > economy.treasury_balance ? 
            EXECUTION_METHODS.INSTALLMENTS : 
            (analysis.execution_method || EXECUTION_METHODS.IMMEDIATE);
        
        // Configurar parcelamento se necessário
        let installmentsConfig = null;
        if (executionMethod === EXECUTION_METHODS.INSTALLMENTS) {
            installmentsConfig = this.calculateInstallments(implementationCost, monthlyRevenue);
        }

        // Validar duração estimada
        const estimatedDuration = Math.max(1, Math.min(36, analysis.estimated_duration_months || 12));
        
        // Validar viabilidade técnica
        const technicalFeasibility = Object.values(PROJECT_RISKS).includes(analysis.technical_feasibility) ? 
            analysis.technical_feasibility : PROJECT_RISKS.MEDIUM;

        // Validar recursos necessários
        const requiredResources = Array.isArray(analysis.required_resources) ? 
            analysis.required_resources : ['Recursos não especificados'];

        // Validar riscos
        const potentialRisks = this.validateRisks(analysis.potential_risks);

        // Validar projeções
        const economicProjection = this.validateEconomicProjection(analysis.economic_return_projection, implementationCost);
        const socialProjection = this.validateSocialProjection(analysis.social_impact_projection, stateData);

        return {
            implementation_cost: implementationCost,
            execution_method: executionMethod,
            installments_config: installmentsConfig,
            estimated_duration_months: estimatedDuration,
            technical_feasibility: technicalFeasibility,
            required_resources: requiredResources,
            potential_risks: potentialRisks,
            economic_return_projection: economicProjection,
            social_impact_projection: socialProjection
        };
    }

    /**
     * Validar custo de implementação
     * @param {number} cost - Custo proposto
     * @param {Object} economy - Dados econômicos
     * @returns {number} - Custo validado
     */
    validateCost(cost, economy) {
        const minCost = economy.gdp * 0.001; // 0.1% do PIB
        const maxCost = economy.gdp * 0.1;   // 10% do PIB
        
        if (!cost || cost < minCost) {
            return Math.round(minCost);
        }
        
        if (cost > maxCost) {
            return Math.round(maxCost);
        }
        
        return Math.round(cost);
    }

    /**
     * Calcular receita mensal estimada
     * @param {Object} economy - Dados econômicos
     * @returns {number} - Receita mensal
     */
    calculateMonthlyRevenue(economy) {
        return Math.round((economy.gdp * economy.tax_rate / 100) / 12);
    }

    /**
     * Calcular configuração de parcelamento
     * @param {number} totalCost - Custo total
     * @param {number} monthlyRevenue - Receita mensal
     * @returns {Object} - Configuração de parcelas
     */
    calculateInstallments(totalCost, monthlyRevenue) {
        // Usar no máximo 30% da receita mensal para o projeto
        const maxMonthlyPayment = monthlyRevenue * 0.3;
        const numberOfInstallments = Math.ceil(totalCost / maxMonthlyPayment);
        const installmentAmount = Math.round(totalCost / numberOfInstallments);
        
        return {
            number_of_installments: Math.min(numberOfInstallments, 36), // Máximo 3 anos
            installment_amount: installmentAmount,
            payment_frequency: 'monthly'
        };
    }

    /**
     * Calcular score de acessibilidade financeira
     * @param {Object} analysis - Dados da análise
     * @param {Object} stateData - Dados do estado
     * @returns {string} - Score (low/medium/high)
     */
    calculateAffordabilityScore(analysis, stateData) {
        const { economy } = stateData;
        const costToGdpRatio = analysis.implementation_cost / economy.gdp;
        const costToTreasuryRatio = analysis.implementation_cost / Math.max(economy.treasury_balance, 1);
        
        if (costToGdpRatio < 0.01 && costToTreasuryRatio < 2) {
            return 'high';
        } else if (costToGdpRatio < 0.05 && costToTreasuryRatio < 5) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Validar riscos do projeto
     * @param {Array} risks - Riscos propostos
     * @returns {Array} - Riscos validados
     */
    validateRisks(risks) {
        if (!Array.isArray(risks) || risks.length === 0) {
            return [{
                risk: 'Atrasos na execução devido a burocracias',
                probability: PROJECT_RISKS.MEDIUM,
                impact: PROJECT_RISKS.MEDIUM
            }];
        }

        return risks.map(risk => ({
            risk: risk.risk || 'Risco não especificado',
            probability: Object.values(PROJECT_RISKS).includes(risk.probability) ? 
                risk.probability : PROJECT_RISKS.MEDIUM,
            impact: Object.values(PROJECT_RISKS).includes(risk.impact) ? 
                risk.impact : PROJECT_RISKS.MEDIUM
        }));
    }

    /**
     * Validar projeção econômica
     * @param {Object} projection - Projeção proposta
     * @param {number} totalCost - Custo total do projeto
     * @returns {Object} - Projeção validada
     */
    validateEconomicProjection(projection, totalCost) {
        if (!projection) {
            return {
                revenue_increase_monthly: 0,
                cost_savings_monthly: 0,
                payback_period_months: 60 // 5 anos padrão
            };
        }

        const revenueIncrease = Math.max(0, projection.revenue_increase_monthly || 0);
        const costSavings = Math.max(0, projection.cost_savings_monthly || 0);
        const totalMonthlyReturn = revenueIncrease + costSavings;
        
        const paybackPeriod = totalMonthlyReturn > 0 ? 
            Math.ceil(totalCost / totalMonthlyReturn) : 
            60;

        return {
            revenue_increase_monthly: Math.round(revenueIncrease),
            cost_savings_monthly: Math.round(costSavings),
            payback_period_months: Math.min(paybackPeriod, 120) // Máximo 10 anos
        };
    }

    /**
     * Validar projeção de impacto social
     * @param {Object} projection - Projeção proposta
     * @param {Object} stateData - Dados do estado
     * @returns {Object} - Projeção validada
     */
    validateSocialProjection(projection, stateData) {
        if (!projection) {
            return {
                population_directly_impacted: Math.round(stateData.state_info.population * 0.01),
                quality_of_life_improvement: 'low',
                employment_generation: 0
            };
        }

        const maxPopulationImpact = stateData.state_info.population * 0.5; // Máximo 50% da população
        const populationImpacted = Math.min(
            Math.max(0, projection.population_directly_impacted || 0),
            maxPopulationImpact
        );

        const qualityImprovement = ['low', 'medium', 'high'].includes(projection.quality_of_life_improvement) ?
            projection.quality_of_life_improvement : 'low';

        const employmentGeneration = Math.max(0, projection.employment_generation || 0);

        return {
            population_directly_impacted: Math.round(populationImpacted),
            quality_of_life_improvement: qualityImprovement,
            employment_generation: Math.round(employmentGeneration)
        };
    }

    /**
     * Verificar disponibilidade do agente
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            return await this.llmProvider.isAvailable();
        } catch (error) {
            console.error('❌ Agente de Análise indisponível:', error);
            return false;
        }
    }

    /**
     * Obter estatísticas do agente
     * @returns {Object}
     */
    getAgentStats() {
        return {
            agent_type: AGENT_TYPES.ANALYSIS,
            max_tokens: AGENT_SETTINGS.ANALYSIS.MAX_TOKENS,
            temperature: AGENT_SETTINGS.ANALYSIS.TEMPERATURE,
            timeout: AGENT_SETTINGS.ANALYSIS.TIMEOUT,
            validation_enabled: true
        };
    }
}

module.exports = ProjectAnalysisAgentService;