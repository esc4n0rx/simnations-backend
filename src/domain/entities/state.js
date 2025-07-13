class StateEconomy {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.state_id = data.state_id;
        this.population = data.population;
        this.population_growth_rate = data.population_growth_rate;
        this.treasury_balance = data.treasury_balance;
        this.gdp = data.gdp;
        this.gdp_growth_rate = data.gdp_growth_rate;
        this.total_debt = data.total_debt;
        this.debt_to_gdp_ratio = data.debt_to_gdp_ratio;
        this.unemployment_rate = data.unemployment_rate;
        this.inflation_rate = data.inflation_rate;
        this.monthly_revenue = data.monthly_revenue;
        this.monthly_expenses = data.monthly_expenses;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    /**
     * Converte para objeto simples
     * @returns {Object} - Objeto da economia
     */
    toObject() {
        return {
            id: this.id,
            user_id: this.user_id,
            state_id: this.state_id,
            population: this.population,
            population_growth_rate: this.population_growth_rate,
            treasury_balance: this.treasury_balance,
            gdp: this.gdp,
            gdp_growth_rate: this.gdp_growth_rate,
            total_debt: this.total_debt,
            debt_to_gdp_ratio: this.debt_to_gdp_ratio,
            unemployment_rate: this.unemployment_rate,
            inflation_rate: this.inflation_rate,
            monthly_revenue: this.monthly_revenue,
            monthly_expenses: this.monthly_expenses,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }

    /**
     * Calcula saldo mensal
     * @returns {number} - Saldo mensal (receita - despesa)
     */
    getMonthlyBalance() {
        return this.monthly_revenue - this.monthly_expenses;
    }

    /**
     * Calcula PIB per capita
     * @returns {number} - PIB per capita em milhares
     */
    getGdpPerCapita() {
        return (this.gdp * 1000000) / this.population;
    }

    /**
     * Calcula razão dívida/PIB
     * @returns {number} - Percentual da dívida em relação ao PIB
     */
    calculateDebtToGdpRatio() {
        return (this.total_debt / this.gdp) * 100;
    }
}

class StateGovernance {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.state_id = data.state_id;
        this.economy_id = data.economy_id;
        this.approval_rating = data.approval_rating;
        this.approval_trend = data.approval_trend;
        this.political_stability = data.political_stability;
        this.corruption_index = data.corruption_index;
        this.coup_risk_level = data.coup_risk_level;
        this.protest_level = data.protest_level;
        this.international_relations = data.international_relations;
        this.decision_count = data.decision_count;
        this.positive_decisions = data.positive_decisions;
        this.negative_decisions = data.negative_decisions;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    /**
     * Converte para objeto simples
     * @returns {Object} - Objeto da governança
     */
    toObject() {
        return {
            id: this.id,
            user_id: this.user_id,
            state_id: this.state_id,
            economy_id: this.economy_id,
            approval_rating: this.approval_rating,
            approval_trend: this.approval_trend,
            political_stability: this.political_stability,
            corruption_index: this.corruption_index,
            coup_risk_level: this.coup_risk_level,
            protest_level: this.protest_level,
            international_relations: this.international_relations,
            decision_count: this.decision_count,
            positive_decisions: this.positive_decisions,
            negative_decisions: this.negative_decisions,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }

    /**
     * Calcula taxa de sucesso das decisões
     * @returns {number} - Percentual de decisões positivas
     */
    getSuccessRate() {
        if (this.decision_count === 0) return 0;
        return (this.positive_decisions / this.decision_count) * 100;
    }

    /**
     * Determina nível de aprovação
     * @returns {string} - Nível de aprovação (crítica, baixa, etc.)
     */
    getApprovalLevel() {
        const { APPROVAL_LEVELS } = require('../../shared/constants/state-constants');
        
        for (const [level, range] of Object.entries(APPROVAL_LEVELS)) {
            if (this.approval_rating >= range.min && this.approval_rating < range.max) {
                return level.toLowerCase();
            }
        }
        return 'moderate';
    }

    /**
     * Verifica se está em risco de golpe
     * @returns {boolean} - True se há risco alto de golpe
     */
    isAtRiskOfCoup() {
        return ['high', 'critical'].includes(this.coup_risk_level);
    }
}

module.exports = {
    StateEconomy,
    StateGovernance
};