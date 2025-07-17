// Constantes para o sistema de projetos governamentais

const PROJECT_STATUS = {
    DRAFT: 'draft',
    PENDING_APPROVAL: 'pending_approval',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    IN_EXECUTION: 'in_execution',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

const PROJECT_TYPES = {
    INFRASTRUCTURE: 'infrastructure',
    EDUCATION: 'education',
    HEALTHCARE: 'healthcare',
    TECHNOLOGY: 'technology',
    ENVIRONMENT: 'environment',
    SECURITY: 'security',
    TRANSPORTATION: 'transportation',
    HOUSING: 'housing',
    CULTURE: 'culture',
    ECONOMY: 'economy'
};

const PROJECT_RISKS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

const EXECUTION_METHODS = {
    IMMEDIATE: 'immediate',
    INSTALLMENTS: 'installments'
};

const AGENT_TYPES = {
    REFINEMENT: 'refinement',
    ANALYSIS: 'analysis',
    POPULATION: 'population'
};

// Configurações de segurança
const SECURITY_SETTINGS = {
    MAX_IDEA_LENGTH: 1000,
    MIN_IDEA_LENGTH: 10,
    BLACKLISTED_WORDS: [
        'corrupção', 'suborno', 'propina', 'fraude', 'roubo',
        'assassinato', 'violência', 'tortura', 'discriminação',
        'autoritário', 'ditadura', 'golpe', 'revolução armada'
    ],
    PROMPT_INJECTION_PATTERNS: [
        /ignore.{0,20}(previous|above|instructions|rules)/i,
        /act.{0,20}as.{0,20}(different|another|other)/i,
        /forget.{0,20}(everything|all|instructions)/i,
        /system.{0,20}(prompt|message|instruction)/i,
        /\$\{.*\}/,  // Template literal injection
        /<script.*>/i,
        /javascript:/i
    ]
};

// Configurações dos agentes
const AGENT_SETTINGS = {
    REFINEMENT: {
        MAX_TOKENS: 1500,
        TEMPERATURE: 0.3,
        TIMEOUT: 30000
    },
    ANALYSIS: {
        MAX_TOKENS: 2000,
        TEMPERATURE: 0.2,
        TIMEOUT: 45000
    },
    POPULATION: {
        MAX_TOKENS: 800,
        TEMPERATURE: 0.7,
        TIMEOUT: 20000
    }
};

// Limites do sistema
const SYSTEM_LIMITS = {
    MAX_ACTIVE_PROJECTS_PER_USER: 5,
    MAX_PENDING_PROJECTS_PER_USER: 3,
    PROJECT_COOLDOWN_HOURS: 2,
    MAX_PROJECT_DURATION_MONTHS: 36
};

module.exports = {
    PROJECT_STATUS,
    PROJECT_TYPES,
    PROJECT_RISKS,
    EXECUTION_METHODS,
    AGENT_TYPES,
    SECURITY_SETTINGS,
    AGENT_SETTINGS,
    SYSTEM_LIMITS
};