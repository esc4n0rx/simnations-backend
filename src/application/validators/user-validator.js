const { z } = require('zod');

const updateProfileSchema = z.object({
    name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .optional(),
    
    email: z.string()
        .email('Email inválido')
        .max(255, 'Email deve ter no máximo 255 caracteres')
        .optional(),
    
    birth_date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento deve estar no formato YYYY-MM-DD')
        .refine(date => {
            const birthDate = new Date(date);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();
            return age >= 13 && age <= 120;
        }, 'Idade deve estar entre 13 e 120 anos')
        .optional()
}).refine(data => Object.keys(data).length > 0, {
    message: 'Pelo menos um campo deve ser fornecido para atualização'
});

const changePasswordSchema = z.object({
    current_password: z.string()
        .min(1, 'Senha atual é obrigatória'),
    
    new_password: z.string()
        .min(8, 'Nova senha deve ter pelo menos 8 caracteres')
        .max(128, 'Nova senha deve ter no máximo 128 caracteres'),
    
    confirm_password: z.string()
        .min(1, 'Confirmação de senha é obrigatória')
}).refine(data => data.new_password === data.confirm_password, {
    message: 'Nova senha e confirmação devem ser iguais',
    path: ['confirm_password']
});

module.exports = {
    updateProfileSchema,
    changePasswordSchema
};