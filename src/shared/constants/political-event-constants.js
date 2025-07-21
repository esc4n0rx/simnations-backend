const EVENT_TYPES = {
    ECONOMIC: 'economic',
    SOCIAL: 'social', 
    POLITICAL: 'political',
    ADMINISTRATIVE: 'administrative',
    INFRASTRUCTURE: 'infrastructure'
};

const EVENT_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

const DECISION_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    EXPIRED: 'expired'
};

const AGENT_TYPES = {
    SCENARIO_GENERATOR: 'scenario_generator',
    POPULATION: 'population',
    INSTITUTIONAL: 'institutional'
};

const INSTITUTIONAL_PERSONAS = {
    MINISTRY_OF_ECONOMY: 'ministry_of_economy',
    INVESTORS: 'investors',
    UNIONS: 'unions',
    BUSINESS_SECTOR: 'business_sector',
    PRESS: 'press',
    ACADEMIA: 'academia',
    JUDICIARY: 'judiciary',
    TRANSPORT_COMPANIES: 'transport_companies',
    HEALTH_SECTOR: 'health_sector'
};

const IMPACT_CATEGORIES = {
    GOVERNANCE: {
        APPROVAL_RATING: 'approval_rating',
        POLITICAL_STABILITY: 'political_stability', 
        CORRUPTION_INDEX: 'corruption_index',
        PROTEST_LEVEL: 'protest_level',
        INTERNATIONAL_RELATIONS: 'international_relations'
    },
    ECONOMY: {
        MONTHLY_REVENUE: 'monthly_revenue',
        MONTHLY_EXPENSES: 'monthly_expenses',
        GDP_GROWTH_RATE: 'gdp_growth_rate',
        TREASURY_BALANCE: 'treasury_balance',
        UNEMPLOYMENT_RATE: 'unemployment_rate',
        INFLATION_RATE: 'inflation_rate'
    }
};

// *** COOLDOWNS MODIFICADOS - EXPANDINDO PARA 10 EVENTOS POR DIA ***
const EVENT_COOLDOWNS = {
    SAME_TYPE: 7, // dias antes de repetir tipo de evento
    SAME_SEVERITY: 3, // dias antes de repetir severidade
    GENERAL: 0, // removido o cooldown geral diário (era 1 dia)
    MAX_EVENTS_PER_DAY: 10, // máximo de 10 eventos por dia
    DAILY_RESET_HOUR: 0 // hora em que o contador diário é resetado (00:00)
};

const LLM_SETTINGS = {
    DEFAULT_MODEL: 'llama3-70b-8192',
    MAX_TOKENS: 2048,
    TEMPERATURE: 0.7,
    TOP_P: 0.9
};

module.exports = {
    EVENT_TYPES,
    EVENT_SEVERITY,
    DECISION_STATUS,
    AGENT_TYPES,
    INSTITUTIONAL_PERSONAS,
    IMPACT_CATEGORIES,
    EVENT_COOLDOWNS,
    LLM_SETTINGS
};