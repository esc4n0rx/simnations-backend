const fs = require('fs').promises;
const path = require('path');
const QuizRepository = require('../../domain/repositories/quiz-repository');
const StateService = require('./state-service');
const FileValidator = require('../../shared/utils/file-validator');
const { QUIZ_QUESTIONS, QUIZ_CATEGORIES, SCORE_MAPPING, MAX_RELOAD_COUNT } = require('../../shared/constants/quiz-constants');

class QuizService {
    constructor() {
        this.quizRepository = new QuizRepository();
        this.stateService = new StateService();
        this.statesData = null;
        this.dataLoadTime = null;
    }

    /**
     * Carrega dados dos estados do arquivo JSON com validação completa
     * @returns {Promise<Object>} - Dados dos estados
     */
    async loadStatesData() {
        // Forçar recarregamento se dados são antigos (cache por 1 hora)
        const now = Date.now();
        if (this.statesData && this.dataLoadTime && (now - this.dataLoadTime) < 3600000) {
            console.log('📋 Usando dados em cache');
            return this.statesData;
        }

        try {
            console.log('🔄 Carregando dados dos estados...');
            const dataPath = path.join(process.cwd(), 'data', 'states-data.json');
            
            // Usar validador para carregamento seguro
            this.statesData = await FileValidator.validateAndLoadStatesFile(dataPath);
            this.dataLoadTime = now;
            
            // Debug: mostrar amostra de países disponíveis
            const countries = Object.keys(this.statesData);
            console.log(`🌍 Países disponíveis (amostra): ${countries.slice(0, 10).join(', ')}...`);
            
            return this.statesData;
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados dos estados:', error.message);
            
            // Em caso de erro, usar dados de fallback mínimos
            this.statesData = await this.createFallbackData();
            return this.statesData;
        }
    }

    /**
     * Criar dados de fallback em caso de erro
     * @returns {Promise<Object>} - Dados mínimos
     */
    async createFallbackData() {
        console.warn('⚠️ Usando dados de fallback');
        return {
            "Brasil": {
                "São Paulo": {
                    "racionalidade": 7.0,
                    "conservadorismo": 5.0,
                    "audacia": 6.0,
                    "autoridade": 6.0,
                    "coletivismo": 5.5,
                    "influencia": 7.0
                },
                "Rio de Janeiro": {
                    "racionalidade": 6.5,
                    "conservadorismo": 5.5,
                    "audacia": 7.0,
                    "autoridade": 5.5,
                    "coletivismo": 6.0,
                    "influencia": 7.5
                }
            },
            "Estados Unidos": {
                "California": {
                    "racionalidade": 8.0,
                    "conservadorismo": 3.0,
                    "audacia": 8.0,
                    "autoridade": 5.0,
                    "coletivismo": 4.0,
                    "influencia": 8.5
                },
                "Texas": {
                    "racionalidade": 6.0,
                    "conservadorismo": 8.0,
                    "audacia": 7.0,
                    "autoridade": 7.0,
                    "coletivismo": 5.0,
                    "influencia": 6.5
                }
            }
        };
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
                const points = SCORE_MAPPING[answer.answer_index];
                
                scores[category] += points;
                categoryCount[category]++;
            }
        });

        // Calcular médias (0-10)
        Object.keys(scores).forEach(category => {
            if (categoryCount[category] > 0) {
                scores[category] = Number((scores[category] / categoryCount[category]).toFixed(1));
            }
        });

        return scores;
    }

    /**
     * Submeter quiz e calcular resultado
     * @param {string} userId - ID do usuário
     * @param {Array} answers - Respostas do usuário
     * @returns {Promise<Object>} - Resultado do quiz
     */
    async submitQuiz(userId, answers) {
        // Verificar se usuário já completou o quiz
        const hasCompleted = await this.quizRepository.hasUserCompletedQuiz(userId);
        if (hasCompleted) {
            throw new Error('Quiz já foi completado por este usuário');
        }

        // Calcular pontuações
        const scores = this.calculateScores(answers);

        // Salvar resultado do quiz
        const quizResult = await this.quizRepository.saveQuizResult({
            user_id: userId,
            ...scores
        });

        // Preparar dados das respostas
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
     * Sortear e atribuir estado ao usuário com distribuição melhorada
     * @param {string} userId - ID do usuário
     * @param {Object} userScores - Pontuações do usuário
     * @returns {Promise<Object>} - Estado atribuído
     */
    async assignStateToUser(userId, userScores) {
        const statesData = await this.loadStatesData();
        
        console.log('🎲 Iniciando processo de atribuição de estado...');
        
        // Calcular compatibilidade com todos os estados
        const compatibilityScores = [];
        
        // Iterar por todos os países e estados
        for (const [country, states] of Object.entries(statesData)) {
            for (const [stateName, stateScores] of Object.entries(states)) {
                try {
                    const compatibility = this.calculateCompatibility(userScores, stateScores);
                    compatibilityScores.push({
                        country,
                        state: stateName,
                        compatibility,
                        scores: stateScores
                    });
                } catch (error) {
                    console.warn(`⚠️ Erro ao processar estado ${country}.${stateName}:`, error.message);
                }
            }
        }

        console.log(`📊 Total de estados processados: ${compatibilityScores.length}`);
        
        if (compatibilityScores.length === 0) {
            throw new Error('Nenhum estado válido encontrado para atribuição');
        }

        // Verificar distribuição por país
        const countryDistribution = {};
        compatibilityScores.forEach(state => {
            countryDistribution[state.country] = (countryDistribution[state.country] || 0) + 1;
        });
        
        console.log('🌍 Distribuição por país:', countryDistribution);

        // Ordenar por compatibilidade (maior para menor)
        compatibilityScores.sort((a, b) => b.compatibility - a.compatibility);

        // Selecionar um dos top 20 estados mais compatíveis para mais variedade
        const topCount = Math.min(20, compatibilityScores.length);
        const topStates = compatibilityScores.slice(0, topCount);
        
        console.log(`🎯 Top ${topCount} estados mais compatíveis:`);
        topStates.slice(0, 5).forEach((state, index) => {
            console.log(`  ${index + 1}. ${state.country} - ${state.state} (${state.compatibility.toFixed(2)}%)`);
        });

        // Selecionar aleatoriamente entre os top estados
        const randomIndex = Math.floor(Math.random() * topStates.length);
        const selectedState = topStates[randomIndex];
        
        console.log(`✅ Estado selecionado: ${selectedState.country} - ${selectedState.state} (${selectedState.compatibility.toFixed(2)}% compatibilidade)`);

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
        const userCategories = Object.keys(userScores);
        const stateCategories = Object.keys(stateScores);
        
        // Encontrar categorias em comum (lidar com diferenças como influencia vs influência)
        const commonCategories = [];
        userCategories.forEach(userCat => {
            // Verificar correspondência exata primeiro
            if (stateCategories.includes(userCat)) {
                commonCategories.push({ user: userCat, state: userCat });
            } else {
                // Verificar correspondência por similaridade (influencia/influência)
                const similar = stateCategories.find(stateCat => 
                    stateCat.toLowerCase().replace(/[^\w]/g, '') === userCat.toLowerCase().replace(/[^\w]/g, '')
                );
                if (similar) {
                    commonCategories.push({ user: userCat, state: similar });
                }
            }
        });

        if (commonCategories.length === 0) {
            console.warn('⚠️ Nenhuma categoria em comum encontrada:', { userCategories, stateCategories });
            return 0;
        }

        let totalDifference = 0;
        commonCategories.forEach(({ user, state }) => {
            const userScore = userScores[user] || 0;
            const stateScore = stateScores[state] || 0;
            const difference = Math.abs(userScore - stateScore);
            totalDifference += difference;
        });

        // Quanto menor a diferença, maior a compatibilidade
        const maxPossibleDifference = commonCategories.length * 10; // Cada categoria vai de 0-10
        const compatibility = 100 - (totalDifference / maxPossibleDifference * 100);
        
        return Math.max(0, compatibility);
    }

    /**
     * Recarregar estado do usuário - VERSÃO CORRIGIDA
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Novo estado atribuído
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
        
        // Forçar limpeza do cache para garantir dados atualizados
        this.statesData = null;
        const freshData = await this.loadStatesData();
        
        // Calcular compatibilidade com todos os estados (versão otimizada para reload)
        const compatibilityScores = [];
        
        Object.entries(freshData).forEach(([country, states]) => {
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

        // Para reloads, usar um range mais amplo para aumentar a variedade
        const rangeSize = Math.min(50, compatibilityScores.length);
        const topStates = compatibilityScores.slice(0, rangeSize);
        const randomIndex = Math.floor(Math.random() * topStates.length);
        const selectedState = topStates[randomIndex];

        console.log(`🔄 Reload: Estado selecionado: ${selectedState.country} - ${selectedState.state}`);

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