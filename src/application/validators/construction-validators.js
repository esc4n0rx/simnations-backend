const { z } = require('zod');

const constructionValidators = {
    // Validação para iniciar construção
    startConstruction: z.object({
        construction_type_id: z.string().uuid('ID do tipo de construção deve ser um UUID válido')
    }),

    // Validação para selecionar empresa vencedora
    selectWinner: z.object({
        company_index: z.number()
            .int('Índice deve ser um número inteiro')
            .min(0, 'Índice deve ser maior ou igual a 0')
            .max(10, 'Índice deve ser menor que 10'),
        reason: z.string()
            .min(10, 'Motivo deve ter pelo menos 10 caracteres')
            .max(500, 'Motivo deve ter no máximo 500 caracteres')
    }),

    // Validação para cancelar construção
    cancelConstruction: z.object({
        reason: z.string()
            .min(10, 'Motivo do cancelamento deve ter pelo menos 10 caracteres')
            .max(500, 'Motivo do cancelamento deve ter no máximo 500 caracteres')
    }),

    // Validação para filtros de listagem
    listFilters: z.object({
        category: z.enum(['saude', 'educacao', 'infraestrutura', 'seguranca', 'social']).optional(),
        status: z.enum(['planning', 'bidding', 'in_progress', 'completed', 'cancelled']).optional(),
        max_cost: z.number().positive('Custo máximo deve ser positivo').optional(),
        min_gdp: z.number().positive('PIB mínimo deve ser positivo').optional()
    }).optional(),

    // Validação de parâmetros de URL
    constructionId: z.object({
        constructionId: z.string().uuid('ID da construção deve ser um UUID válido')
    })
};

module.exports = constructionValidators;