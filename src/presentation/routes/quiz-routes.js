const express = require('express');
const QuizController = require('../controllers/quiz-controller');
const validationMiddleware = require('../middleware/validation-middleware');
const authMiddleware = require('../middleware/auth-middleware');
const { quizSubmissionSchema } = require('../../application/validators/quiz-validator');

const router = express.Router();
const quizController = new QuizController();

/**
 * @route GET /api/quiz/questions
 * @desc Obter perguntas do quiz
 * @access Private
 */
router.get('/questions', authMiddleware, quizController.getQuestions);

/**
 * @route POST /api/quiz/submit
 * @desc Submeter respostas do quiz
 * @access Private
 */
router.post('/submit', 
    authMiddleware,
    validationMiddleware(quizSubmissionSchema), 
    quizController.submitQuiz
);

/**
 * @route GET /api/quiz/result
 * @desc Obter resultado do quiz do usuário
 * @access Private
 */
router.get('/result', authMiddleware, quizController.getQuizResult);

/**
 * @route GET /api/quiz/status
 * @desc Verificar status do quiz do usuário
 * @access Private
 */
router.get('/status', authMiddleware, quizController.getQuizStatus);

/**
 * @route GET /api/quiz/state
 * @desc Obter estado atual do usuário
 * @access Private
 */
router.get('/state', authMiddleware, quizController.getUserState);

/**
 * @route POST /api/quiz/reload-state
 * @desc Recarregar estado do usuário
 * @access Private
 */
router.post('/reload-state', authMiddleware, quizController.reloadState);

module.exports = router;