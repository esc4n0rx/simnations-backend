const APPROVAL_LEVELS = {
    CRITICAL: { min: 0, max: 20, label: 'Crítica', description: 'Risco iminente de deposição' },
    VERY_LOW: { min: 20, max: 35, label: 'Muito Baixa', description: 'Situação muito instável' },
    LOW: { min: 35, max: 45, label: 'Baixa', description: 'Governo impopular' },
    MODERATE: { min: 45, max: 65, label: 'Moderada', description: 'Situação equilibrada' },
    HIGH: { min: 65, max: 80, label: 'Alta', description: 'Governo popular' },
    VERY_HIGH: { min: 80, max: 100, label: 'Muito Alta', description: 'Apoio massivo da população' }
};

const STABILITY_LEVELS = {
    CRITICAL: { min: 0, max: 25, label: 'Crítica', risk: 'Altíssimo risco de golpe' },
    LOW: { min: 25, max: 50, label: 'Baixa', risk: 'Alto risco político' },
    MODERATE: { min: 50, max: 75, label: 'Moderada', risk: 'Risco controlado' },
    HIGH: { min: 75, max: 90, label: 'Alta', risk: 'Situação estável' },
    VERY_HIGH: { min: 90, max: 100, label: 'Muito Alta', risk: 'Extremamente estável' }
};

const COUP_RISK_LEVELS = {
    VERY_LOW: { threshold: 80, label: 'Muito Baixo' },
    LOW: { threshold: 65, label: 'Baixo' },
    MEDIUM: { threshold: 45, label: 'Médio' },
    HIGH: { threshold: 25, label: 'Alto' },
    CRITICAL: { threshold: 0, label: 'Crítico' }
};

const PROTEST_LEVELS = {
    NONE: { threshold: 60, label: 'Nenhum' },
    MINOR: { threshold: 45, label: 'Pequenos Protestos' },
    MODERATE: { threshold: 30, label: 'Protestos Moderados' },
    MAJOR: { threshold: 15, label: 'Grandes Protestos' },
    WIDESPREAD: { threshold: 0, label: 'Protestos Generalizados' }
};

const ECONOMIC_INDICATORS = {
    GDP_GROWTH: {
        EXCELLENT: { min: 4, label: 'Excelente' },
        GOOD: { min: 2, label: 'Bom' },
        MODERATE: { min: 0, label: 'Moderado' },
        POOR: { min: -2, label: 'Ruim' },
        TERRIBLE: { min: -Infinity, label: 'Terrível' }
    },
    UNEMPLOYMENT: {
        EXCELLENT: { max: 4, label: 'Excelente' },
        GOOD: { max: 6, label: 'Bom' },
        MODERATE: { max: 8, label: 'Moderado' },
        POOR: { max: 12, label: 'Ruim' },
        TERRIBLE: { max: Infinity, label: 'Terrível' }
    },
    DEBT_TO_GDP: {
        EXCELLENT: { max: 30, label: 'Excelente' },
        GOOD: { max: 60, label: 'Bom' },
        MODERATE: { max: 90, label: 'Moderado' },
        POOR: { max: 120, label: 'Ruim' },
        TERRIBLE: { max: Infinity, label: 'Terrível' }
    }
};

const RELOAD_EFFECTS = {
    ECONOMY_RESET: true,
    GOVERNANCE_RESET: true,
    APPROVAL_BASE: 50, // Volta para aprovação neutra
    STABILITY_BASE: 75 // Volta para estabilidade base
};

module.exports = {
    APPROVAL_LEVELS,
    STABILITY_LEVELS,
    COUP_RISK_LEVELS,
    PROTEST_LEVELS,
    ECONOMIC_INDICATORS,
    RELOAD_EFFECTS
};