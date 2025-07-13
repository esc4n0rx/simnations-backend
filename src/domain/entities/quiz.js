class QuizResult {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.racionalidade = data.racionalidade;
        this.conservadorismo = data.conservadorismo;
        this.audacia = data.audacia;
        this.autoridade = data.autoridade;
        this.coletivismo = data.coletivismo;
        this.influencia = data.influencia;
        this.completed_at = data.completed_at;
    }

    /**
     * Converte para objeto simples
     * @returns {Object} - Objeto do resultado do quiz
     */
    toObject() {
        return {
            id: this.id,
            user_id: this.user_id,
            racionalidade: this.racionalidade,
            conservadorismo: this.conservadorismo,
            audacia: this.audacia,
            autoridade: this.autoridade,
            coletivismo: this.coletivismo,
            influencia: this.influencia,
            completed_at: this.completed_at
        };
    }

    /**
     * Retorna as pontuações como vetor
     * @returns {Array} - Array com as pontuações
     */
    getScoresArray() {
        return [
            this.racionalidade,
            this.conservadorismo,
            this.audacia,
            this.autoridade,
            this.coletivismo,
            this.influencia
        ];
    }

    /**
     * Calcula a pontuação total
     * @returns {number} - Pontuação total
     */
    getTotalScore() {
        return this.racionalidade + this.conservadorismo + this.audacia + 
               this.autoridade + this.coletivismo + this.influencia;
    }
}

class QuizAnswer {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.question_id = data.question_id;
        this.category = data.category;
        this.answer_index = data.answer_index;
        this.answered_at = data.answered_at;
    }

    /**
     * Converte para objeto simples
     * @returns {Object} - Objeto da resposta do quiz
     */
    toObject() {
        return {
            id: this.id,
            user_id: this.user_id,
            question_id: this.question_id,
            category: this.category,
            answer_index: this.answer_index,
            answered_at: this.answered_at
        };
    }
}

module.exports = {
    QuizResult,
    QuizAnswer
};