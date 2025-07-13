const { z } = require('zod');

const registerSchema = z.object({
    username: z.string()
        .min(3, 'Nome de usuário deve ter pelo menos 3 caracteres')
        .max(50, 'Nome de usuário deve ter no máximo 50 caracteres')
        .regex(/^[a-zA-Z0-9_]+$/, 'Nome de usuário deve conter apenas letras, números e underscore'),
    
    name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres'),
    
    email: z.string()
        .email('Email inválido')
        .max(255, 'Email deve ter no máximo 255 caracteres'),
    
    password: z.string()
        .min(8, 'Senha deve ter pelo menos 8 caracteres')
        .max(128, 'Senha deve ter no máximo 128 caracteres'),
    
    birth_date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento deve estar no formato YYYY-MM-DD')
        .refine(date => {
            const birthDate = new Date(date);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();
            return age >= 13 && age <= 120;
        }, 'Idade deve estar entre 13 e 120 anos')
});

const loginSchema = z.object({
    username: z.string()
        .min(1, 'Nome de usuário é obrigatório'),
    
    password: z.string()
        .min(1, 'Senha é obrigatória')
});

module.exports = {
    registerSchema,
    loginSchema
};