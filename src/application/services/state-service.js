const StateRepository = require('../../domain/repositories/state-repository');
const QuizRepository = require('../../domain/repositories/quiz-repository');
const StateParameterRepository = require('../../domain/repositories/state-parameter-repository'); // [NOVO]
const { RELOAD_EFFECTS, COUP_RISK_LEVELS, PROTEST_LEVELS } = require('../../shared/constants/state-constants');
const { ECONOMIC_CONSTANTS } = require('../../shared/constants/economic-constants'); // [NOVO]

class StateService {
    constructor() {
        this.stateRepository = new StateRepository();
        this.quizRepository = new QuizRepository();
        this.parameterRepository = new StateParameterRepository(); // [NOVO]
    }

    /**
     * Criar economia e governança para novo estado
     * @param {string} userId - ID do usuário
     * @param {string} stateId - ID do estado atribuído
     * @param {string} country - País do estado
     * @param {string} stateName - Nome do estado
     * @returns {Promise<Object>} - Economia e governança criadas
     */
    async createStateManagement(userId, stateId, country, stateName) {
        // Buscar pontuações do quiz para personalizar economia
        const quizResult = await this.quizRepository.findQuizResultByUserId(userId);
        const userScores = quizResult ? {
            racionalidade: quizResult.racionalidade,
            conservadorismo: quizResult.conservadorismo,
            audacia: quizResult.audacia,
            autoridade: quizResult.autoridade,
            coletivismo: quizResult.coletivismo,
            influencia: quizResult.influencia
        } : {};

        // Gerar dados econômicos base
        const baseEconomyData = await this.stateRepository.generateBaseEconomy(
            country, 
            stateName, 
            userScores
        );

        // Calcular debt_to_gdp_ratio
        const debtToGdpRatio = (baseEconomyData.total_debt / baseEconomyData.gdp) * 100;

        // Criar economia
        const economyData = {
            user_id: userId,
            state_id: stateId,
            population: baseEconomyData.population,
            population_growth_rate: baseEconomyData.population_growth_rate,
            treasury_balance: baseEconomyData.treasury_balance,
            gdp: baseEconomyData.gdp,
            gdp_growth_rate: baseEconomyData.gdp_growth_rate,
            total_debt: baseEconomyData.total_debt,
            debt_to_gdp_ratio: debtToGdpRatio,
            unemployment_rate: baseEconomyData.unemployment_rate,
            inflation_rate: baseEconomyData.inflation_rate,
            monthly_revenue: baseEconomyData.monthly_revenue,
            monthly_expenses: baseEconomyData.monthly_expenses
        };

        const economy = await this.stateRepository.createStateEconomy(economyData);

        // Gerar dados de governança base
        const baseGovernanceData = await this.stateRepository.generateBaseGovernance();

        // Criar governança
        const governanceData = {
            user_id: userId,
            state_id: stateId,
            economy_id: economy.id,
            approval_rating: baseGovernanceData.approval_rating,
            approval_trend: baseGovernanceData.approval_trend,
            political_stability: baseGovernanceData.political_stability,
            corruption_index: baseGovernanceData.corruption_index,
            coup_risk_level: baseGovernanceData.coup_risk_level,
            protest_level: baseGovernanceData.protest_level,
            international_relations: baseGovernanceData.international_relations,
            decision_count: 0,
            positive_decisions: 0,
            negative_decisions: 0
        };

        const governance = await this.stateRepository.createStateGovernance(governanceData);

        // [NOVO] Criar parâmetros econômicos padrão
        await this.createDefaultStateParameters(userId, stateId, governance);

        return {
            economy: economy.toObject(),
            governance: governance.toObject(),
            summary: this.generateStateSummary(economy, governance)
        };
    }

    /**
     * [NOVO] Criar parâmetros econômicos padrão para um estado
     * @param {string} userId - ID do usuário
     * @param {string} stateId - ID do estado
     * @param {StateGovernance} governance - Dados de governança
     * @returns {Promise<StateParameter>} - Parâmetros criados
     */
    async createDefaultStateParameters(userId, stateId, governance) {
        const parameterData = {
            user_id: userId,
            state_id: stateId,
            tax_rate: ECONOMIC_CONSTANTS.DEFAULT_TAX_RATE,
            administrative_efficiency: ECONOMIC_CONSTANTS.DEFAULT_ADMINISTRATIVE_EFFICIENCY,
            expense_ratio: ECONOMIC_CONSTANTS.DEFAULT_EXPENSE_RATIO,
            expense_efficiency: ECONOMIC_CONSTANTS.DEFAULT_EXPENSE_EFFICIENCY,
            corruption_impact: governance ? (governance.corruption_index / 1000) : ECONOMIC_CONSTANTS.DEFAULT_CORRUPTION_IMPACT,
            special_modifiers: {},
            max_treasury_growth_per_day: null,
            min_treasury_balance: 0.00
        };

        return await this.parameterRepository.create(parameterData);
    }

    /**
     * Obter dados completos do estado do usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object|null>} - Dados completos ou null
     */
    async getCompleteStateData(userId) {
        const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
        
        if (!stateData) {
            return null;
        }

        return {
            economy: stateData.economy.toObject(),
            governance: stateData.governance ? stateData.governance.toObject() : null,
            state_info: stateData.state_info,
            summary: this.generateStateSummary(stateData.economy, stateData.governance),
            analysis: this.generateStateAnalysis(stateData.economy, stateData.governance)
        };
    }

    /**
     * Recriar economia e governança após reload de estado
     * @param {string} userId - ID do usuário
     * @param {string} newStateId - ID do novo estado
     * @param {string} country - País do novo estado
     * @param {string} stateName - Nome do novo estado
     * @returns {Promise<Object>} - Nova economia e governança
     */
    async recreateStateAfterReload(userId, newStateId, country, stateName) {
        // Deletar dados econômicos e de governança anteriores
        const existingData = await this.stateRepository.findCompleteStateDataByUserId(userId);
        if (existingData) {
            await this.stateRepository.deleteStateDataByStateId(existingData.state_info.id);
        }

        // Criar nova economia e governança
        return await this.createStateManagement(userId, newStateId, country, stateName);
    }

    /**
     * Atualizar economia do estado
     * @param {string} userId - ID do usuário
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<Object>} - Economia atualizada
     */
    async updateEconomy(userId, updateData) {
        const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
        
        if (!stateData) {
            throw new Error('Estado não encontrado');
        }

        // Calcular debt_to_gdp_ratio se necessário
        if (updateData.total_debt !== undefined || updateData.gdp !== undefined) {
            const newDebt = updateData.total_debt || stateData.economy.total_debt;
            const newGdp = updateData.gdp || stateData.economy.gdp;
            updateData.debt_to_gdp_ratio = (newDebt / newGdp) * 100;
        }

        const updatedEconomy = await this.stateRepository.updateEconomy(
            stateData.economy.id, 
            updateData
        );

        return updatedEconomy.toObject();
    }

    /**
     * Atualizar governança do estado
     * @param {string} userId - ID do usuário
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<Object>} - Governança atualizada
     */
    async updateGovernance(userId, updateData) {
        const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
        
        if (!stateData || !stateData.governance) {
            throw new Error('Governança não encontrada');
        }

        // Calcular automaticamente níveis de risco baseados na aprovação e estabilidade
        if (updateData.approval_rating !== undefined || updateData.political_stability !== undefined) {
            const newApproval = updateData.approval_rating || stateData.governance.approval_rating;
            const newStability = updateData.political_stability || stateData.governance.political_stability;
            
            // Calcular risco de golpe
            const avgStability = (newApproval + newStability) / 2;
            updateData.coup_risk_level = this.calculateCoupRisk(avgStability);
            updateData.protest_level = this.calculateProtestLevel(newApproval);
        }

        const updatedGovernance = await this.stateRepository.updateGovernance(
            stateData.governance.id, 
            updateData
        );

        return updatedGovernance.toObject();
    }

    // [MANTIDAS] Todas as outras funções existentes permanecem inalteradas...
    // generateStateSummary, generateStateAnalysis, calculateCoupRisk, etc.

    /**
     * Gerar resumo do estado
     * @param {StateEconomy} economy - Economia do estado
     * @param {StateGovernance} governance - Governança do estado
     * @returns {Object} - Resumo do estado
     */
    generateStateSummary(economy, governance) {
        return {
            population_formatted: this.formatNumber(economy.population),
            gdp_formatted: `$${this.formatNumber(economy.gdp)}M`,
            gdp_per_capita: Math.round(economy.getGdpPerCapita()),
            monthly_balance: economy.getMonthlyBalance(),
            monthly_balance_formatted: `$${this.formatNumber(economy.getMonthlyBalance())}M`,
            debt_situation: this.classifyDebtSituation(economy.debt_to_gdp_ratio),
            approval_level: governance ? governance.getApprovalLevel() : 'moderate',
            political_risk: governance ? governance.isAtRiskOfCoup() : false,
            overall_status: this.calculateOverallStatus(economy, governance)
        };
    }

    /**
     * Gerar análise detalhada do estado
     * @param {StateEconomy} economy - Economia do estado
     * @param {StateGovernance} governance - Governança do estado
     * @returns {Object} - Análise detalhada
     */
    generateStateAnalysis(economy, governance) {
        const economicHealth = this.assessEconomicHealth(economy);
        const politicalHealth = governance ? this.assessPoliticalHealth(governance) : null;

        return {
            economic_health: economicHealth,
            political_health: politicalHealth,
            key_challenges: this.identifyKeyChallenges(economy, governance),
            recommendations: this.generateRecommendations(economy, governance),
            risk_factors: this.identifyRiskFactors(economy, governance)
        };
    }

    /**
     * Calcular risco de golpe baseado na estabilidade
     * @param {number} stabilityScore - Pontuação de estabilidade
     * @returns {string} - Nível de risco
     */
    calculateCoupRisk(stabilityScore) {
        for (const [level, data] of Object.entries(COUP_RISK_LEVELS)) {
            if (stabilityScore >= data.threshold) {
                return level.toLowerCase();
            }
        }
        return 'critical';
    }

    /**
     * Calcular nível de protesto baseado na aprovação
     * @param {number} approvalRating - Taxa de aprovação
     * @returns {string} - Nível de protesto
     */
    calculateProtestLevel(approvalRating) {
        for (const [level, data] of Object.entries(PROTEST_LEVELS)) {
            if (approvalRating >= data.threshold) {
                return level.toLowerCase();
            }
        }
        return 'widespread';
    }

    /**
     * Formatar números grandes
     * @param {number} num - Número para formatar
     * @returns {string} - Número formatado
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    /**
     * Classificar situação da dívida
     * @param {number} debtToGdpRatio - Razão dívida/PIB
     * @returns {string} - Classificação da dívida
     */
    classifyDebtSituation(debtToGdpRatio) {
        if (debtToGdpRatio < 30) return 'excellent';
        if (debtToGdpRatio < 60) return 'good';
        if (debtToGdpRatio < 90) return 'moderate';
        if (debtToGdpRatio < 120) return 'poor';
        return 'critical';
    }

    /**
     * Calcular status geral do estado
     * @param {StateEconomy} economy - Economia
     * @param {StateGovernance} governance - Governança
     * @returns {string} - Status geral
     */
    calculateOverallStatus(economy, governance) {
        const economicScore = this.getEconomicScore(economy);
        const politicalScore = governance ? this.getPoliticalScore(governance) : 50;
        const overallScore = (economicScore + politicalScore) / 2;

        if (overallScore >= 80) return 'excellent';
        if (overallScore >= 65) return 'good';
        if (overallScore >= 45) return 'moderate';
        if (overallScore >= 25) return 'poor';
        return 'critical';
    }

    /**
     * Calcular pontuação econômica
     * @param {StateEconomy} economy - Economia
     * @returns {number} - Pontuação (0-100)
     */
    getEconomicScore(economy) {
        let score = 50; // Base neutra

        // PIB per capita (20% do score)
        const gdpPerCapita = economy.getGdpPerCapita();
        if (gdpPerCapita > 50000) score += 20;
        else if (gdpPerCapita > 30000) score += 15;
        else if (gdpPerCapita > 15000) score += 10;
        else if (gdpPerCapita < 5000) score -= 10;

        // Taxa de desemprego (20% do score)
        if (economy.unemployment_rate < 4) score += 20;
        else if (economy.unemployment_rate < 6) score += 15;
        else if (economy.unemployment_rate < 8) score += 10;
        else if (economy.unemployment_rate > 12) score -= 15;

        // Razão dívida/PIB (20% do score)
        if (economy.debt_to_gdp_ratio < 30) score += 20;
        else if (economy.debt_to_gdp_ratio < 60) score += 15;
        else if (economy.debt_to_gdp_ratio < 90) score += 10;
        else if (economy.debt_to_gdp_ratio > 120) score -= 20;

        // Crescimento do PIB (20% do score)
        if (economy.gdp_growth_rate > 4) score += 20;
        else if (economy.gdp_growth_rate > 2) score += 15;
        else if (economy.gdp_growth_rate > 0) score += 10;
        else if (economy.gdp_growth_rate < -2) score -= 15;

        // Saldo mensal (20% do score)
        const monthlyBalance = economy.getMonthlyBalance();
        if (monthlyBalance > 0) score += 20;
        else if (monthlyBalance > -economy.monthly_revenue * 0.1) score += 5;
        else score -= 15;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calcular pontuação política
     * @param {StateGovernance} governance - Governança
     * @returns {number} - Pontuação (0-100)
     */
    getPoliticalScore(governance) {
        let score = 0;

        // Aprovação popular (40% do score)
        score += governance.approval_rating * 0.4;

        // Estabilidade política (40% do score)
        score += governance.political_stability * 0.4;

        // Relações internacionais (20% do score)
        score += governance.international_relations * 0.2;

        // Penalidades por corrupção
        score -= governance.corruption_index * 0.1;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Avaliar saúde econômica
     * @param {StateEconomy} economy - Economia
     * @returns {Object} - Avaliação da saúde econômica
     */
    assessEconomicHealth(economy) {
        const score = this.getEconomicScore(economy);
        let status, description;

        if (score >= 80) {
            status = 'excellent';
            description = 'Economia muito forte com indicadores sólidos';
        } else if (score >= 65) {
            status = 'good';
            description = 'Economia saudável com bons indicadores';
        } else if (score >= 45) {
            status = 'moderate';
            description = 'Economia estável mas com desafios';
        } else if (score >= 25) {
            status = 'poor';
            description = 'Economia em dificuldades';
        } else {
            status = 'critical';
            description = 'Economia em crise severa';
        }

        return {
            score: Math.round(score),
            status,
            description,
            key_metrics: {
                gdp_per_capita: Math.round(economy.getGdpPerCapita()),
                unemployment: economy.unemployment_rate,
                debt_ratio: Math.round(economy.debt_to_gdp_ratio),
                growth_rate: economy.gdp_growth_rate,
                monthly_balance: economy.getMonthlyBalance()
            }
        };
    }

    /**
     * Avaliar saúde política
     * @param {StateGovernance} governance - Governança
     * @returns {Object} - Avaliação da saúde política
     */
    assessPoliticalHealth(governance) {
        const score = this.getPoliticalScore(governance);
        let status, description;

        if (score >= 80) {
            status = 'excellent';
            description = 'Governo muito popular e estável';
        } else if (score >= 65) {
            status = 'good';
            description = 'Governo com boa aprovação popular';
        } else if (score >= 45) {
            status = 'moderate';
            description = 'Governo com aprovação moderada';
        } else if (score >= 25) {
            status = 'poor';
            description = 'Governo impopular e instável';
        } else {
            status = 'critical';
            description = 'Governo em crise com risco de deposição';
        }

        return {
            score: Math.round(score),
            status,
            description,
            key_metrics: {
                approval_rating: governance.approval_rating,
                political_stability: governance.political_stability,
                international_relations: governance.international_relations,
                corruption_index: governance.corruption_index,
                coup_risk: governance.coup_risk_level,
                protest_level: governance.protest_level
            }
        };
    }

    /**
     * Identificar principais desafios
     * @param {StateEconomy} economy - Economia
     * @param {StateGovernance} governance - Governança
     * @returns {Array} - Lista de desafios
     */
    identifyKeyChallenges(economy, governance) {
        const challenges = [];

        // Desafios econômicos
        if (economy.unemployment_rate > 10) {
            challenges.push({
                type: 'economic',
                priority: 'high',
                title: 'Alto Desemprego',
                description: `Taxa de desemprego de ${economy.unemployment_rate}% está muito alta`
            });
        }

        if (economy.debt_to_gdp_ratio > 90) {
            challenges.push({
                type: 'economic',
                priority: 'high',
                title: 'Alta Dívida Pública',
                description: `Dívida representa ${Math.round(economy.debt_to_gdp_ratio)}% do PIB`
            });
        }

        if (economy.getMonthlyBalance() < 0) {
            challenges.push({
                type: 'economic',
                priority: 'medium',
                title: 'Déficit Orçamentário',
                description: 'Gastos mensais excedem as receitas'
            });
        }

        if (economy.gdp_growth_rate < 0) {
            challenges.push({
                type: 'economic',
                priority: 'high',
                title: 'Recessão Econômica',
                description: `PIB em queda de ${Math.abs(economy.gdp_growth_rate)}%`
            });
        }

        // Desafios políticos
        if (governance) {
            if (governance.approval_rating < 30) {
                challenges.push({
                    type: 'political',
                    priority: 'critical',
                    title: 'Baixa Aprovação Popular',
                    description: `Apenas ${Math.round(governance.approval_rating)}% de aprovação`
                });
            }

            if (governance.political_stability < 40) {
                challenges.push({
                    type: 'political',
                    priority: 'high',
                    title: 'Instabilidade Política',
                    description: 'Alto risco de instabilidade no governo'
                });
            }

            if (governance.corruption_index > 70) {
                challenges.push({
                    type: 'political',
                    priority: 'medium',
                    title: 'Alta Corrupção',
                    description: 'Níveis preocupantes de corrupção no governo'
                });
            }

            if (['major', 'widespread'].includes(governance.protest_level)) {
                challenges.push({
                    type: 'political',
                    priority: 'high',
                    title: 'Protestos Intensos',
                    description: 'População manifestando descontentamento'
                });
            }
        }

        return challenges;
    }

    /**
     * Gerar recomendações
     * @param {StateEconomy} economy - Economia
     * @param {StateGovernance} governance - Governança
     * @returns {Array} - Lista de recomendações
     */
    generateRecommendations(economy, governance) {
        const recommendations = [];

        // Recomendações econômicas
        if (economy.unemployment_rate > 8) {
            recommendations.push({
                type: 'economic',
                priority: 'high',
                title: 'Programa de Emprego',
                description: 'Implementar políticas de criação de empregos e capacitação'
            });
        }

        if (economy.debt_to_gdp_ratio > 80) {
            recommendations.push({
                type: 'economic',
                priority: 'medium',
                title: 'Controle Fiscal',
                description: 'Reduzir gastos públicos e aumentar eficiência'
            });
        }

        if (economy.getMonthlyBalance() < 0) {
            recommendations.push({
                type: 'economic',
                priority: 'medium',
                title: 'Equilibrio Orçamentário',
                description: 'Revisar despesas e otimizar receitas'
            });
        }

        // Recomendações políticas
        if (governance && governance.approval_rating < 50) {
            recommendations.push({
                type: 'political',
                priority: 'high',
                title: 'Melhoria da Imagem',
                description: 'Implementar políticas populares e melhorar comunicação'
            });
        }

        if (governance && governance.corruption_index > 50) {
            recommendations.push({
                type: 'political',
                priority: 'medium',
                title: 'Combate à Corrupção',
                description: 'Fortalecer instituições e transparência'
            });
        }

        return recommendations;
    }

    /**
     * Identificar fatores de risco
     * @param {StateEconomy} economy - Economia
     * @param {StateGovernance} governance - Governança
     * @returns {Array} - Lista de fatores de risco
     */
    identifyRiskFactors(economy, governance) {
        const risks = [];

        // Riscos econômicos
        if (economy.debt_to_gdp_ratio > 100) {
            risks.push({
                type: 'economic',
                severity: 'high',
                factor: 'Insolvência',
                description: 'Risco de não conseguir pagar as dívidas'
            });
        }

        if (economy.inflation_rate > 10) {
            risks.push({
                type: 'economic',
                severity: 'medium',
                factor: 'Hiperinflação',
                description: 'Inflação descontrolada pode gerar instabilidade'
            });
        }

        // Riscos políticos
        if (governance) {
            if (['high', 'critical'].includes(governance.coup_risk_level)) {
                risks.push({
                    type: 'political',
                    severity: 'critical',
                    factor: 'Golpe de Estado',
                    description: 'Alto risco de deposição do governo'
                });
            }

            if (governance.approval_rating < 25) {
                risks.push({
                    type: 'political',
                    severity: 'high',
                    factor: 'Revolução Popular',
                    description: 'População pode se rebelar contra o governo'
                });
            }

            if (governance.international_relations < 40) {
                risks.push({
                    type: 'diplomatic',
                    severity: 'medium',
                    factor: 'Isolamento Internacional',
                    description: 'Relações diplomáticas deterioradas'
                });
            }
        }

        return risks;
    }
}

module.exports = StateService;