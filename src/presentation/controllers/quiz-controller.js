const QuizService = require('../../application/services/quiz-service');
const ResponseHelper = require('../../shared/utils/response-helper');

class QuizController {
    constructor() {
        this.quizService = new QuizService();
    }

    /**
     * Obter perguntas do quiz
     */
    getQuestions = async (req, res, next) => {
        try {
            const questions = this.quizService.getQuizQuestions();
            
            ResponseHelper.success(res, { questions }, 'Perguntas obtidas com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Submeter respostas do quiz
     */
    submitQuiz = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { answers } = req.body;
            
            const result = await this.quizService.submitQuiz(userId, answers);
            
            ResponseHelper.success(res, result, 'Quiz submetido com sucesso', 201);
        } catch (error) {
            if (error.message === 'Usuário já completou o quiz') {
                return ResponseHelper.conflict(res, error.message);
            }
            if (error.message.includes('Perguntas não respondidas')) {
                return ResponseHelper.error(res, error.message, 400);
            }
            next(error);
        }
    };

    /**
     * Obter resultado do quiz do usuário
     */
    getQuizResult = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const result = await this.quizService.getUserQuizResult(userId);
            
            if (!result) {
                return ResponseHelper.notFound(res, 'Resultado do quiz não encontrado');
            }
            
            ResponseHelper.success(res, { quiz_result: result }, 'Resultado obtido com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Obter estado atual do usuário
     */
    getUserState = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const state = await this.quizService.getUserState(userId);
            
            if (!state) {
                return ResponseHelper.notFound(res, 'Estado não encontrado');
            }
            
            ResponseHelper.success(res, { state }, 'Estado obtido com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Recarregar estado do usuário
     */
    reloadState = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const newState = await this.quizService.reloadUserState(userId);
            
            ResponseHelper.success(res, { state: newState }, 'Estado recarregado com sucesso');
        } catch (error) {
            if (error.message === 'Número máximo de reloads atingido') {
                return ResponseHelper.error(res, error.message, 400);
            }
            if (error.message === 'Usuário não possui estado atribuído') {
                return ResponseHelper.notFound(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Verificar status do quiz do usuário
     */
    getQuizStatus = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const hasCompleted = await this.quizService.hasUserCompletedQuiz(userId);
            
            let state = null;
            if (hasCompleted) {
                state = await this.quizService.getUserState(userId);
            }
            
            ResponseHelper.success(res, { 
                quiz_completed: hasCompleted,
                state 
            }, 'Status obtido com sucesso');
        } catch (error) {
            next(error);
        }
    };
}

module.exports = QuizController;