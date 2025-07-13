class StateParameter {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.state_id = data.state_id;
        this.tax_rate = data.tax_rate;
        this.administrative_efficiency = data.administrative_efficiency;
        this.expense_ratio = data.expense_ratio;
        this.expense_efficiency = data.expense_efficiency;
        this.corruption_impact = data.corruption_impact;
        this.special_modifiers = data.special_modifiers || {};
        this.max_treasury_growth_per_day = data.max_treasury_growth_per_day;
        this.min_treasury_balance = data.min_treasury_balance;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    /**
     * Converte para objeto simples
     * @returns {Object} - Objeto dos parâmetros
     */
    toObject() {
        return {
            id: this.id,
            user_id: this.user_id,
            state_id: this.state_id,
            tax_rate: this.tax_rate,
            administrative_efficiency: this.administrative_efficiency,
            expense_ratio: this.expense_ratio,
            expense_efficiency: this.expense_efficiency,
            corruption_impact: this.corruption_impact,
            special_modifiers: this.special_modifiers,
            max_treasury_growth_per_day: this.max_treasury_growth_per_day,
            min_treasury_balance: this.min_treasury_balance,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }

    /**
     * Calcula taxa de arrecadação efetiva
     * @returns {number} - Taxa efetiva considerando eficiência e corrupção
     */
    getEffectiveTaxRate() {
        const corruptionReduction = this.tax_rate * this.corruption_impact;
        return (this.tax_rate * this.administrative_efficiency) - corruptionReduction;
    }

    /**
     * Calcula taxa de gastos efetiva
     * @returns {number} - Taxa efetiva de gastos
     */
    getEffectiveExpenseRate() {
        const corruptionIncrease = this.expense_ratio * this.corruption_impact;
        return (this.expense_ratio * this.expense_efficiency) + corruptionIncrease;
    }

    /**
     * Aplica modificadores especiais
     * @param {string} type - Tipo de modificador
     * @returns {number} - Valor do modificador
     */
    getSpecialModifier(type) {
        return this.special_modifiers[type] || 0;
    }
}

class EconomicUpdateLog {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.state_id = data.state_id;
        this.previous_gdp = data.previous_gdp;
        this.previous_treasury = data.previous_treasury;
        this.previous_monthly_revenue = data.previous_monthly_revenue;
        this.previous_monthly_expenses = data.previous_monthly_expenses;
        this.new_gdp = data.new_gdp;
        this.new_treasury = data.new_treasury;
        this.new_monthly_revenue = data.new_monthly_revenue;
        this.new_monthly_expenses = data.new_monthly_expenses;
        this.days_processed = data.days_processed;
        this.gdp_growth_applied = data.gdp_growth_applied;
        this.daily_cash_flow = data.daily_cash_flow;
        this.processed_at = data.processed_at;
    }

    /**
     * Converte para objeto simples
     * @returns {Object} - Objeto do log
     */
    toObject() {
        return {
            id: this.id,
            user_id: this.user_id,
            state_id: this.state_id,
            previous_gdp: this.previous_gdp,
            previous_treasury: this.previous_treasury,
            previous_monthly_revenue: this.previous_monthly_revenue,
            previous_monthly_expenses: this.previous_monthly_expenses,
            new_gdp: this.new_gdp,
            new_treasury: this.new_treasury,
            new_monthly_revenue: this.new_monthly_revenue,
            new_monthly_expenses: this.new_monthly_expenses,
            days_processed: this.days_processed,
            gdp_growth_applied: this.gdp_growth_applied,
            daily_cash_flow: this.daily_cash_flow,
            processed_at: this.processed_at
        };
    }
}

module.exports = {
    StateParameter,
    EconomicUpdateLog
};