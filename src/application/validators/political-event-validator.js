const { z } = require('zod');
const { EVENT_TYPES, EVENT_SEVERITY } = require('../../shared/constants/political-event-constants');

const playerDecisionSchema = z.object({
    option_id: z.string()
        .uuid('ID da opção deve ser um UUID válido'),
    
    reasoning: z.string()
        .max(500, 'Raciocínio deve ter no máximo 500 caracteres')
        .optional()
});

const eventGenerationRequestSchema = z.object({
    force_generation: z.boolean()
        .optional()
        .default(false),
    
    preferred_type: z.enum(Object.values(EVENT_TYPES))
        .optional(),
    
    preferred_severity: z.enum(Object.values(EVENT_SEVERITY))
        .optional()
});

const eventHistoryQuerySchema = z.object({
    limit: z.number()
        .int()
        .min(1, 'Limite deve ser pelo menos 1')
        .max(50, 'Limite deve ser no máximo 50')
        .optional()
        .default(10),
    
    include_reactions: z.boolean()
        .optional()
        .default(true),
    
    event_type: z.enum(Object.values(EVENT_TYPES))
        .optional()
});

module.exports = {
    playerDecisionSchema,
    eventGenerationRequestSchema,
    eventHistoryQuerySchema
};