// Constantes para o sistema de construções

const CONSTRUCTION_STATUS = {
    PLANNING: 'planning',
    BIDDING: 'bidding', 
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

const BIDDING_STATUS = {
    OPEN: 'open',
    CLOSED: 'closed',
    CANCELLED: 'cancelled'
};

const CONSTRUCTION_CATEGORIES = {
    HEALTH: 'saude',
    EDUCATION: 'educacao',
    INFRASTRUCTURE: 'infraestrutura',
    SECURITY: 'seguranca',
    SOCIAL: 'social'
};

const QUALITY_LEVELS = {
    POOR: 'ruim',
    REGULAR: 'regular', 
    GOOD: 'boa',
    EXCELLENT: 'excelente'
};

// ADIÇÃO: Configuração dos tipos de construção para IA
const CONSTRUCTION_TYPES = {
    saude: {
        specialization: 'construção civil hospitalar',
        context_tags: 'saúde, equipamentos médicos, infraestrutura hospitalar',
        typical_companies: ['construtoras especializadas em saúde', 'empresas de equipamentos médicos']
    },
    educacao: {
        specialization: 'construção civil educacional',
        context_tags: 'educação, salas de aula, laboratórios, biblioteca',
        typical_companies: ['construtoras de obras públicas', 'empresas especializadas em educação']
    },
    infraestrutura: {
        specialization: 'construção civil e engenharia pesada',
        context_tags: 'infraestrutura, estradas, pontes, saneamento',
        typical_companies: ['construtoras de grande porte', 'empresas de engenharia civil']
    },
    seguranca: {
        specialization: 'construção civil de segurança',
        context_tags: 'segurança pública, sistemas de monitoramento, instalações especiais',
        typical_companies: ['construtoras especializadas', 'empresas de segurança e tecnologia']
    },
    social: {
        specialization: 'construção civil e paisagismo',
        context_tags: 'cultura, esporte, lazer, meio ambiente',
        typical_companies: ['construtoras gerais', 'empresas de paisagismo']
    }
};

// Configurações da job
const JOB_CONFIG = {
    SCHEDULE: process.env.CONSTRUCTION_JOB_SCHEDULE || '0 7 * * *', // Diariamente às 7h
    TIMEZONE: process.env.CONSTRUCTION_JOB_TIMEZONE || 'America/Sao_Paulo'
};

// Limites e configurações
const SYSTEM_LIMITS = {
    MAX_CONCURRENT_CONSTRUCTIONS: 10, // Máximo de obras simultâneas
    MIN_COMPANIES_PER_BIDDING: 3,
    MAX_COMPANIES_PER_BIDDING: 5
};

// Probabilidades de corrupção (usadas pela IA)
const CORRUPTION_CONFIG = {
    BASE_CHANCE: 0.30, // 30% chance base
    DISCOVERY_CHANCE: 0.25 // 25% chance de descoberta
};

// Prompts para IA
const AI_PROMPTS = {
    GENERATE_COMPANIES: `Você é um especialista em licitações públicas. Gere {numCompanies} empresas FICTÍCIAS para uma licitação de construção de {constructionName} sempre responda em portugues.

CONTEXTO DO ESTADO:
- Estado: {stateName}
- PIB: R$ {gdp} milhões
- População: {population} habitantes
- Índice de Corrupção: {corruptionIndex}%
- Aprovação do Governo: {approvalRating}%

ESPECIFICAÇÕES DA OBRA:
- Tipo: {constructionType}
- Valor Base: R$ {baseCost} milhões
- Especialização: {specialization}
- Tags: {contextTags}

Gere empresas realistas com:
1. Nome fictício
2. Proposta de preço (variação de -20% a +30% do valor base)
3. Prazo estimado (variação de -10% a +25% dos dias padrão)
4. Nível de experiência
5. Histórico resumido
6. Incentivo oculto (propina) - apenas algumas empresas, baseado no índice de corrupção

Responda em JSON válido com array de empresas.`,

    COMPLETION_NARRATIVE: `Você é um jornalista especializado em obras públicas. Crie uma narrativa realista sobre a conclusão de uma obra pública,sempre responda em portugues.

DADOS DA OBRA:
- Construção: {constructionName}
- Estado: {stateName}
- Empresa: {companyName}
- Custo Final: R$ {finalCost} milhões
- Prazo: {actualDays} dias (previsto: {plannedDays} dias)
- Houve Corrupção: {hadCorruption}
- Corrupção Descoberta: {corruptionDiscovered}

Crie uma narrativa de 2-3 parágrafos sobre:
1. Como foi a execução da obra
2. Problemas encontrados (se houver)
3. Resultado final para a população
4. Impacto político (se relevante)

Use tom jornalístico neutro e realista.`
};

// Exportação das constantes individuais
const CONSTRUCTION_CONSTANTS = {
    // Status
    STATUS: CONSTRUCTION_STATUS,
    BIDDING_STATUS,
    
    // Categorias
    CATEGORIES: CONSTRUCTION_CATEGORIES,
    
    // ADIÇÃO: Tipos de construção
    TYPES: CONSTRUCTION_TYPES,
    
    // Qualidade
    QUALITY_LEVELS,
    
    // Configurações de Job
    JOB_SCHEDULE: JOB_CONFIG.SCHEDULE,
    JOB_TIMEZONE: JOB_CONFIG.TIMEZONE,
    
    // Limites
    MAX_CONCURRENT_CONSTRUCTIONS: SYSTEM_LIMITS.MAX_CONCURRENT_CONSTRUCTIONS,
    MIN_COMPANIES_PER_BIDDING: SYSTEM_LIMITS.MIN_COMPANIES_PER_BIDDING,
    MAX_COMPANIES_PER_BIDDING: SYSTEM_LIMITS.MAX_COMPANIES_PER_BIDDING,
    
    // Corrupção
    CORRUPTION_BASE_CHANCE: CORRUPTION_CONFIG.BASE_CHANCE,
    CORRUPTION_DISCOVERY_CHANCE: CORRUPTION_CONFIG.DISCOVERY_CHANCE,
    
    // Prompts para IA
    AI_PROMPTS
};

module.exports = CONSTRUCTION_CONSTANTS;