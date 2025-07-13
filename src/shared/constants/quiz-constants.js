const QUIZ_CATEGORIES = {
    RACIONALIDADE: 'racionalidade',
    CONSERVADORISMO: 'conservadorismo',
    AUDACIA: 'audacia',
    AUTORIDADE: 'autoridade',
    COLETIVISMO: 'coletivismo',
    INFLUENCIA: 'influencia'
};

const QUIZ_QUESTIONS = [
    // Racionalidade
    {
        id: 1,
        category: QUIZ_CATEGORIES.RACIONALIDADE,
        question: "Ao tomar decisões importantes, você prefere:",
        options: [
            "Analisar dados e estatísticas",
            "Seguir sua intuição",
            "Consultar especialistas",
            "Considerar experiências passadas",
            "Buscar opiniões de outros"
        ]
    },
    {
        id: 2,
        category: QUIZ_CATEGORIES.RACIONALIDADE,
        question: "Diante de um problema complexo, sua primeira reação é:",
        options: [
            "Dividir em partes menores",
            "Buscar soluções criativas",
            "Procurar exemplos similares",
            "Pedir ajuda",
            "Tentar várias abordagens"
        ]
    },
    {
        id: 3,
        category: QUIZ_CATEGORIES.RACIONALIDADE,
        question: "Você acredita que as melhores decisões são baseadas em:",
        options: [
            "Lógica e razão",
            "Emoções e sentimentos",
            "Experiência prática",
            "Consenso do grupo",
            "Tradição e costume"
        ]
    },
    
    // Conservadorismo
    {
        id: 4,
        category: QUIZ_CATEGORIES.CONSERVADORISMO,
        question: "Sua atitude em relação a mudanças é:",
        options: [
            "Muito cautelosa",
            "Moderadamente cautelosa",
            "Neutra",
            "Moderadamente aberta",
            "Muito aberta"
        ]
    },
    {
        id: 5,
        category: QUIZ_CATEGORIES.CONSERVADORISMO,
        question: "Você valoriza mais:",
        options: [
            "Tradições estabelecidas",
            "Inovação e progresso",
            "Equilíbrio entre ambos",
            "Adaptação às circunstâncias",
            "Experimentação constante"
        ]
    },
    {
        id: 6,
        category: QUIZ_CATEGORIES.CONSERVADORISMO,
        question: "Ao formar sua opinião sobre questões sociais, você considera:",
        options: [
            "Valores tradicionais",
            "Tendências modernas",
            "Evidências científicas",
            "Opinião popular",
            "Experiência pessoal"
        ]
    },
    
    // Audácia
    {
        id: 7,
        category: QUIZ_CATEGORIES.AUDACIA,
        question: "Diante de uma oportunidade arriscada mas promissora, você:",
        options: [
            "Aceita imediatamente",
            "Aceita após análise",
            "Hesita bastante",
            "Geralmente recusa",
            "Sempre recusa"
        ]
    },
    {
        id: 8,
        category: QUIZ_CATEGORIES.AUDACIA,
        question: "Sua tolerância a riscos é:",
        options: [
            "Muito alta",
            "Alta",
            "Moderada",
            "Baixa",
            "Muito baixa"
        ]
    },
    {
        id: 9,
        category: QUIZ_CATEGORIES.AUDACIA,
        question: "Você prefere:",
        options: [
            "Grandes apostas, grandes ganhos",
            "Riscos calculados",
            "Segurança moderada",
            "Máxima segurança",
            "Evitar qualquer risco"
        ]
    },
    
    // Autoridade
    {
        id: 10,
        category: QUIZ_CATEGORIES.AUTORIDADE,
        question: "Em um grupo, você naturalmente:",
        options: [
            "Assume a liderança",
            "Oferece sugestões",
            "Participa ativamente",
            "Segue as diretrizes",
            "Observa silenciosamente"
        ]
    },
    {
        id: 11,
        category: QUIZ_CATEGORIES.AUTORIDADE,
        question: "Sua atitude em relação a hierarquias é:",
        options: [
            "Muito respeitosa",
            "Respeitosa",
            "Neutra",
            "Questionadora",
            "Desafiadora"
        ]
    },
    {
        id: 12,
        category: QUIZ_CATEGORIES.AUTORIDADE,
        question: "Você acredita que a autoridade deve ser:",
        options: [
            "Absoluta",
            "Forte mas questionável",
            "Equilibrada",
            "Limitada",
            "Mínima"
        ]
    },
    
    // Coletivismo
    {
        id: 13,
        category: QUIZ_CATEGORIES.COLETIVISMO,
        question: "Ao tomar decisões, você prioriza:",
        options: [
            "Bem-estar do grupo",
            "Equilíbrio grupo-individual",
            "Suas próprias necessidades",
            "Eficiência",
            "Tradições"
        ]
    },
    {
        id: 14,
        category: QUIZ_CATEGORIES.COLETIVISMO,
        question: "Você acredita que o sucesso individual:",
        options: [
            "Deve servir ao coletivo",
            "Deve ser equilibrado",
            "É mais importante",
            "Depende da situação",
            "É irrelevante"
        ]
    },
    {
        id: 15,
        category: QUIZ_CATEGORIES.COLETIVISMO,
        question: "Sua preferência de trabalho é:",
        options: [
            "Sempre em equipe",
            "Preferencialmente em equipe",
            "Tanto faz",
            "Preferencialmente individual",
            "Sempre individual"
        ]
    },
    
    // Influência
    {
        id: 16,
        category: QUIZ_CATEGORIES.INFLUENCIA,
        question: "Você gosta de:",
        options: [
            "Liderar e influenciar",
            "Persuadir ocasionalmente",
            "Participar ativamente",
            "Seguir e apoiar",
            "Observar discretamente"
        ]
    },
    {
        id: 17,
        category: QUIZ_CATEGORIES.INFLUENCIA,
        question: "Sua habilidade de convencer outros é:",
        options: [
            "Muito alta",
            "Alta",
            "Moderada",
            "Baixa",
            "Muito baixa"
        ]
    },
    {
        id: 18,
        category: QUIZ_CATEGORIES.INFLUENCIA,
        question: "Você prefere:",
        options: [
            "Ser o centro das atenções",
            "Ter visibilidade moderada",
            "Manter perfil neutro",
            "Ser discreto",
            "Passar despercebido"
        ]
    }
];

const SCORE_MAPPING = {
    // Racionalidade: primeira opção = 10, segunda = 7.5, terceira = 5, quarta = 2.5, quinta = 0
    racionalidade: [10, 7.5, 5, 2.5, 0],
    // Conservadorismo: primeira opção = 10, última = 0
    conservadorismo: [10, 7.5, 5, 2.5, 0],
    // Audácia: primeira opção = 10, última = 0
    audacia: [10, 7.5, 5, 2.5, 0],
    // Autoridade: primeira opção = 10, última = 0
    autoridade: [10, 7.5, 5, 2.5, 0],
    // Coletivismo: primeira opção = 10, última = 0
    coletivismo: [10, 7.5, 5, 2.5, 0],
    // Influência: primeira opção = 10, última = 0
    influencia: [10, 7.5, 5, 2.5, 0]
};

const MAX_RELOAD_COUNT = 3;

module.exports = {
    QUIZ_CATEGORIES,
    QUIZ_QUESTIONS,
    SCORE_MAPPING,
    MAX_RELOAD_COUNT
};