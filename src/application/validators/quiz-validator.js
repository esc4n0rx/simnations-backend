const { z } = require('zod');

const quizAnswerSchema = z.object({
    question_id: z.number()
        .int('ID da pergunta deve ser um número inteiro')
        .min(1, 'ID da pergunta deve ser maior que 0')
        .max(18, 'ID da pergunta deve ser menor ou igual a 18'),
    
    answer_index: z.number()
        .int('Índice da resposta deve ser um número inteiro')
        .min(0, 'Índice da resposta deve ser maior ou igual a 0')
        .max(4, 'Índice da resposta deve ser menor ou igual a 4')
});

const quizSubmissionSchema = z.object({
    answers: z.array(quizAnswerSchema)
        .min(18, 'Todas as 18 perguntas devem ser respondidas')
        .max(18, 'Não podem haver mais de 18 respostas')
        .refine(answers => {
            const questionIds = answers.map(a => a.question_id);
            const uniqueIds = new Set(questionIds);
            return uniqueIds.size === 18;
        }, 'Todas as perguntas devem ser respondidas uma única vez')
});

module.exports = {
    quizAnswerSchema,
    quizSubmissionSchema
};