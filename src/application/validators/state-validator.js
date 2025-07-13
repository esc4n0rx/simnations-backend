const { z } = require('zod');

const economyUpdateSchema = z.object({
    treasury_balance: z.number()
        .min(0, 'Saldo do tesouro não pode ser negativo')
        .optional(),
    
    monthly_revenue: z.number()
        .min(0, 'Receita mensal não pode ser negativa')
        .optional(),
    
    monthly_expenses: z.number()
        .min(0, 'Despesas mensais não podem ser negativas')
        .optional(),
    
    population_growth_rate: z.number()
        .min(-10, 'Taxa de crescimento populacional não pode ser menor que -10%')
        .max(10, 'Taxa de crescimento populacional não pode ser maior que 10%')
        .optional(),
    
    gdp_growth_rate: z.number()
        .min(-20, 'Taxa de crescimento do PIB não pode ser menor que -20%')
        .max(20, 'Taxa de crescimento do PIB não pode ser maior que 20%')
        .optional(),
    
    unemployment_rate: z.number()
        .min(0, 'Taxa de desemprego não pode ser negativa')
        .max(100, 'Taxa de desemprego não pode ser maior que 100%')
        .optional(),
    
    inflation_rate: z.number()
        .min(-10, 'Taxa de inflação não pode ser menor que -10%')
        .max(50, 'Taxa de inflação não pode ser maior que 50%')
        .optional()
});

const governanceUpdateSchema = z.object({
    approval_rating: z.number()
        .min(0, 'Taxa de aprovação deve estar entre 0 e 100')
        .max(100, 'Taxa de aprovação deve estar entre 0 e 100')
        .optional(),
    
    political_stability: z.number()
        .min(0, 'Estabilidade política deve estar entre 0 e 100')
        .max(100, 'Estabilidade política deve estar entre 0 e 100')
        .optional(),
    
    corruption_index: z.number()
        .min(0, 'Índice de corrupção deve estar entre 0 e 100')
        .max(100, 'Índice de corrupção deve estar entre 0 e 100')
        .optional(),
    
    international_relations: z.number()
        .min(0, 'Relações internacionais devem estar entre 0 e 100')
        .max(100, 'Relações internacionais devem estar entre 0 e 100')
        .optional(),
    
    approval_trend: z.enum(['rising', 'falling', 'stable'], {
        errorMap: () => ({ message: 'Tendência deve ser: rising, falling ou stable' })
    }).optional(),
    
    coup_risk_level: z.enum(['very_low', 'low', 'medium', 'high', 'critical'], {
        errorMap: () => ({ message: 'Nível de risco de golpe inválido' })
    }).optional(),
    
    protest_level: z.enum(['none', 'minor', 'moderate', 'major', 'widespread'], {
        errorMap: () => ({ message: 'Nível de protesto inválido' })
    }).optional()
});

module.exports = {
    economyUpdateSchema,
    governanceUpdateSchema
};