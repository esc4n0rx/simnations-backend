const ECONOMIC_CONSTANTS = {
    // Configurações de Tempo
    DAYS_IN_MONTH: 30,
    DAYS_IN_YEAR: 365,
    
    // Limites de Segurança
    MAX_DAYS_TO_PROCESS: 30, // Máximo 30 dias de uma vez
    MIN_GDP_VALUE: 1000000, // PIB mínimo de 1 milhão
    MAX_GDP_GROWTH_RATE: 15, // Crescimento máximo de 15% ao ano
    MIN_GDP_GROWTH_RATE: -10, // Decrescimento máximo de 10% ao ano
    
    // Parâmetros Padrão
    DEFAULT_TAX_RATE: 0.015, // 1,5% do PIB
    DEFAULT_ADMINISTRATIVE_EFFICIENCY: 0.90, // 90%
    DEFAULT_EXPENSE_RATIO: 0.012, // 1,2% do PIB
    DEFAULT_EXPENSE_EFFICIENCY: 1.00, // 100%
    DEFAULT_CORRUPTION_IMPACT: 0.05, // 5%
    
    // Configurações de Job
    JOB_SCHEDULE: '0 6 * * *', // Diariamente às 6h
    JOB_TIMEZONE: 'America/Sao_Paulo',
    
    // Logs e Auditoria
    LOG_RETENTION_DAYS: 90, // Manter logs por 90 dias
    
    // Cálculos Econômicos
    TREASURY_CALCULATION_PRECISION: 2, // 2 casas decimais
    GDP_CALCULATION_PRECISION: 2, // 2 casas decimais
    REVENUE_CALCULATION_PRECISION: 2, // 2 casas decimais
};

const ECONOMIC_EVENTS = {
    GDP_GROWTH: 'gdp_growth',
    REVENUE_UPDATE: 'revenue_update', 
    EXPENSE_UPDATE: 'expense_update',
    TREASURY_UPDATE: 'treasury_update',
    DAILY_PROCESSING: 'daily_processing'
};

const CALCULATION_MODES = {
    NORMAL: 'normal',
    CATCH_UP: 'catch_up', // Para usuários inativos
    MANUAL: 'manual' // Atualização manual
};

module.exports = {
    ECONOMIC_CONSTANTS,
    ECONOMIC_EVENTS,
    CALCULATION_MODES
};