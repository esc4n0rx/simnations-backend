const CONSTRUCTION_CONSTANTS = {
    // Status de construção
    STATUS: {
        PLANNING: 'planning',
        BIDDING: 'bidding', 
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    },

    // Status de licitação
    BIDDING_STATUS: {
        OPEN: 'open',
        CLOSED: 'closed',
        CANCELLED: 'cancelled'
    },

    // Categorias de construção
    CATEGORIES: {
        HEALTH: 'saude',
        EDUCATION: 'educacao',
        INFRASTRUCTURE: 'infraestrutura',
        SECURITY: 'seguranca',
        SOCIAL: 'social'
    },

    // Níveis de qualidade final
    QUALITY_LEVELS: {
        POOR: 'ruim',
        REGULAR: 'regular', 
        GOOD: 'boa',
        EXCELLENT: 'excelente'
    },

    // Configurações da job
    JOB_SCHEDULE: process.env.CONSTRUCTION_JOB_SCHEDULE || '0 7 * * *', // Diariamente às 7h
    JOB_TIMEZONE: process.env.CONSTRUCTION_JOB_TIMEZONE || 'America/Sao_Paulo',

    // Limites e configurações
    MAX_CONCURRENT_CONSTRUCTIONS: 10, // Máximo de obras simultâneas
    MIN_COMPANIES_PER_BIDDING: 3,
    MAX_COMPANIES_PER_BIDDING: 5,
    
    // Probabilidades de corrupção (usadas pela IA)
    CORRUPTION_BASE_CHANCE: 0.30, // 30% chance base
    CORRUPTION_DISCOVERY_CHANCE: 0.25, // 25% chance de descoberta

    // Prompts para IA
    AI_PROMPTS: {
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

        COMPLETION_NARRATIVE: `Você é um jornalista especializado em obras públicas. Crie uma narrativa realista sobre a conclusão de uma obra pública.

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
    }
};

module.exports = CONSTRUCTION_CONSTANTS;