const fs = require('fs').promises;
const path = require('path');
const QuizRepository = require('../../domain/repositories/quiz-repository');
const StateService = require('./state-service');
const { QUIZ_QUESTIONS, QUIZ_CATEGORIES, SCORE_MAPPING, MAX_RELOAD_COUNT } = require('../../shared/constants/quiz-constants');

class QuizService {
    constructor() {
        this.quizRepository = new QuizRepository();
        this.stateService = new StateService();
        this.statesData = null;
    }

    /**
     * Carrega dados dos estados do arquivo JSON
     * @returns {Promise<Object>} - Dados dos estados
     */
    async loadStatesData() {
        if (!this.statesData) {
            try {
                const dataPath = path.join(process.cwd(), 'data', 'states-data.json');
                const fileContent = await fs.readFile(dataPath, 'utf8');
                this.statesData = JSON.parse(fileContent);
            } catch (error) {
                throw new Error('Erro ao carregar dados dos estados');
            }
        }
        return this.statesData;
    }

    /**
     * Obter perguntas do quiz
     * @returns {Array} - Perguntas do quiz
     */
    getQuizQuestions() {
        return QUIZ_QUESTIONS.map(q => ({
            id: q.id,
            category: q.category,
            question: q.question,
            options: q.options
        }));
    }

    /**
     * Calcular pontuações do quiz
     * @param {Array} answers - Respostas do usuário
     * @returns {Object} - Pontuações por categoria
     */
    calculateScores(answers) {
        const scores = {
            racionalidade: 0,
            conservadorismo: 0,
            audacia: 0,
            autoridade: 0,
            coletivismo: 0,
            influencia: 0
        };

        const categoryCount = {
            racionalidade: 0,
            conservadorismo: 0,
            audacia: 0,
            autoridade: 0,
            coletivismo: 0,
            influencia: 0
        };

        answers.forEach(answer => {
            const question = QUIZ_QUESTIONS.find(q => q.id === answer.question_id);
            if (question) {
                const category = question.category;
                const scoreMapping = SCORE_MAPPING[category];
                const score = scoreMapping[answer.answer_index];
                
                scores[category] += score;
                categoryCount[category]++;
            }
        });

        // Calcular média por categoria
        Object.keys(scores).forEach(category => {
            if (categoryCount[category] > 0) {
                scores[category] = parseFloat((scores[category] / categoryCount[category]).toFixed(1));
            }
        });

        return scores;
    }

    /**
     * Submeter quiz e calcular resultado
     * @param {string} userId - ID do usuário
     * @param {Array} answers - Respostas do usuário
     * @returns {Promise<Object>} - Resultado do quiz e estado atribuído
     */
    async submitQuiz(userId, answers) {
        // Verificar se usuário já completou o quiz
        const hasCompleted = await this.quizRepository.hasUserCompletedQuiz(userId);
        if (hasCompleted) {
            throw new Error('Usuário já completou o quiz');
        }

        // Validar se todas as perguntas foram respondidas
        const questionIds = answers.map(a => a.question_id);
        const expectedQuestions = QUIZ_QUESTIONS.map(q => q.id);
        const missingQuestions = expectedQuestions.filter(id => !questionIds.includes(id));
        
        if (missingQuestions.length > 0) {
            throw new Error(`Perguntas não respondidas: ${missingQuestions.join(', ')}`);
        }

        // Calcular pontuações
        const scores = this.calculateScores(answers);

        // Salvar resultado do quiz
        const quizResult = await this.quizRepository.saveQuizResult({
            user_id: userId,
            ...scores
        });

        // Preparar dados das respostas para salvar
        const answersData = answers.map(answer => {
            const question = QUIZ_QUESTIONS.find(q => q.id === answer.question_id);
            return {
                user_id: userId,
                question_id: answer.question_id,
                category: question.category,
                answer_index: answer.answer_index
            };
        });

        // Salvar respostas
        await this.quizRepository.saveQuizAnswers(answersData);

        // Sortear estado baseado nas pontuações
        const assignedState = await this.assignStateToUser(userId, scores);

        // Criar economia e governança para o estado atribuído
        const stateManagement = await this.stateService.createStateManagement(
            userId,
            assignedState.id,
            assignedState.country,
            assignedState.state
        );

        return {
            quiz_result: quizResult.toObject(),
            assigned_state: assignedState,
            state_management: stateManagement,
            scores
        };
    }

    /**
     * Sortear e atribuir estado ao usuário
     * @param {string} userId - ID do usuário
     * @param {Object} userScores - Pontuações do usuário
     * @returns {Promise<Object>} - Estado atribuído
     */
    async assignStateToUser(userId, userScores) {
        const statesData = await this.loadStatesData();
        
        // Calcular compatibilidade com todos os estados
        const compatibilityScores = [];
        
        Object.entries(statesData).forEach(([country, states]) => {
            Object.entries(states).forEach(([stateName, stateScores]) => {
                const compatibility = this.calculateCompatibility(userScores, stateScores);
                compatibilityScores.push({
                    country,
                    state: stateName,
                    compatibility,
                    scores: stateScores
                });
            });
        });

        // Ordenar por compatibilidade (maior para menor)
        compatibilityScores.sort((a, b) => b.compatibility - a.compatibility);

        // Selecionar um dos top 10 estados mais compatíveis
        const topStates = compatibilityScores.slice(0, 10);
        const randomIndex = Math.floor(Math.random() * topStates.length);
        const selectedState = topStates[randomIndex];

        // Salvar estado atribuído
        const userState = await this.quizRepository.saveUserState({
            user_id: userId,
            country: selectedState.country,
            state: selectedState.state,
            reload_count: 0
        });

        return {
            ...userState,
            compatibility: selectedState.compatibility,
            state_scores: selectedState.scores
        };
    }

    /**
     * Calcular compatibilidade entre pontuações do usuário e do estado
     * @param {Object} userScores - Pontuações do usuário
     * @param {Object} stateScores - Pontuações do estado
     * @returns {number} - Pontuação de compatibilidade
     */
    calculateCompatibility(userScores, stateScores) {
        const categories = Object.keys(userScores);
        let totalDifference = 0;

        categories.forEach(category => {
            const difference = Math.abs(userScores[category] - stateScores[category]);
            totalDifference += difference;
        });

        // Quanto menor a diferença, maior a compatibilidade
        // Convertemos para um valor de 0-100 onde 100 é perfeita compatibilidade
        const maxPossibleDifference = categories.length * 10; // 6 categorias * 10 pontos max
        const compatibility = 100 - (totalDifference / maxPossibleDifference * 100);
        
        return Math.max(0, compatibility);
    }

    /**
     * Recarregar estado do usuário - ATUALIZADO COM ECONOMIA
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Novo estado atribuído com economia
     */
    async reloadUserState(userId) {
        // Buscar estado atual
        const currentState = await this.quizRepository.findActiveUserState(userId);
        if (!currentState) {
            throw new Error('Usuário não possui estado atribuído');
        }

        // Verificar se ainda tem reloads disponíveis
        if (currentState.reload_count >= MAX_RELOAD_COUNT) {
            throw new Error('Número máximo de reloads atingido');
        }

        // Buscar resultado do quiz
        const quizResult = await this.quizRepository.findQuizResultByUserId(userId);
        if (!quizResult) {
            throw new Error('Resultado do quiz não encontrado');
        }

        // Incrementar contador de reload ANTES de atribuir novo estado
        const updatedState = await this.quizRepository.incrementReloadCount(userId);

        // Atribuir novo estado (mas não incrementar reload novamente)
        const userScores = {
            racionalidade: quizResult.racionalidade,
            conservadorismo: quizResult.conservadorismo,
            audacia: quizResult.audacia,
            autoridade: quizResult.autoridade,
            coletivismo: quizResult.coletivismo,
            influencia: quizResult.influencia
        };

        // Chamar método específico que não incrementa reload
        const newStateData = await this.assignNewStateWithoutIncrement(userId, userScores, updatedState.reload_count);

        // Recriar economia e governança para o novo estado
        const stateManagement = await this.stateService.recreateStateAfterReload(
            userId,
            newStateData.id,
            newStateData.country,
            newStateData.state
        );

        return {
            ...newStateData,
            state_management: stateManagement,
            reload_count: updatedState.reload_count
        };
    }

    /**
     * Atribuir novo estado sem incrementar reload_count
     * @param {string} userId - ID do usuário
     * @param {Object} userScores - Pontuações do usuário
     * @param {number} currentReloadCount - Contador atual de reloads
     * @returns {Promise<Object>} - Estado atribuído
     */
    async assignNewStateWithoutIncrement(userId, userScores, currentReloadCount) {
        const statesData = await this.loadStatesData();
        
        // Calcular compatibilidade com todos os estados
        const compatibilityScores = [];
        
        Object.entries(statesData).forEach(([country, states]) => {
            Object.entries(states).forEach(([stateName, stateScores]) => {
                const compatibility = this.calculateCompatibility(userScores, stateScores);
                compatibilityScores.push({
                    country,
                    state: stateName,
                    compatibility,
                    scores: stateScores
                });
            });
        });

        // Ordenar por compatibilidade (maior para menor)
        compatibilityScores.sort((a, b) => b.compatibility - a.compatibility);

        // Selecionar um dos top 10 estados mais compatíveis
        const topStates = compatibilityScores.slice(0, 10);
        const randomIndex = Math.floor(Math.random() * topStates.length);
        const selectedState = topStates[randomIndex];

        // Salvar novo estado (substituindo o anterior) mantendo o reload_count
        const userState = await this.quizRepository.saveUserState({
            user_id: userId,
            country: selectedState.country,
            state: selectedState.state,
            reload_count: currentReloadCount // Manter o contador atual
        });

        return {
            ...userState,
            compatibility: selectedState.compatibility,
            state_scores: selectedState.scores
        };
    }

    /**
     * Obter estado atual do usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object|null>} - Estado atual ou null
     */
    async getUserState(userId) {
        return await this.quizRepository.findActiveUserState(userId);
    }

    /**
     * Obter resultado do quiz do usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object|null>} - Resultado do quiz ou null
     */
    async getUserQuizResult(userId) {
        const result = await this.quizRepository.findQuizResultByUserId(userId);
        return result ? result.toObject() : null;
    }

    /**
     * Verificar se usuário completou o quiz
     * @param {string} userId - ID do usuário
     * @returns {Promise<boolean>} - True se completou
     */
    async hasUserCompletedQuiz(userId) {
        return await this.quizRepository.hasUserCompletedQuiz(userId);
    }
}

module.exports = QuizService;