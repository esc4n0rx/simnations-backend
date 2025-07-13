const express = require('express');
const PoliticalEventController = require('../controllers/political-event-controller');
const validationMiddleware = require('../middleware/validation-middleware');
const authMiddleware = require('../middleware/auth-middleware');
const { 
    playerDecisionSchema, 
    eventGenerationRequestSchema, 
    eventHistoryQuerySchema 
} = require('../../application/validators/political-event-validator');

const router = express.Router();
const eventController = new PoliticalEventController();

/**
 * @route POST /api/events/generate
 * @desc Gerar novo evento político
 * @access Private
 */
router.post('/generate', 
    authMiddleware,
    validationMiddleware(eventGenerationRequestSchema), 
    eventController.generateEvent
);

/**
 * @route GET /api/events/active
 * @desc Obter evento ativo do usuário
 * @access Private
 */
router.get('/active', authMiddleware, eventController.getActiveEvent);

/**
 * @route POST /api/events/:eventId/decide
 * @desc Tomar decisão em um evento
 * @access Private
 */
router.post('/:eventId/decide', 
    authMiddleware,
    validationMiddleware(playerDecisionSchema), 
    eventController.makeDecision
);

/**
 * @route GET /api/events/history
 * @desc Obter histórico de eventos do usuário
 * @access Private
 */
router.get('/history', 
    authMiddleware,
    validationMiddleware(eventHistoryQuerySchema), 
    eventController.getEventHistory
);

/**
 * @route GET /api/events/statistics
 * @desc Obter estatísticas de eventos do usuário
 * @access Private
 */
router.get('/statistics', authMiddleware, eventController.getEventStatistics);

/**
 * @route GET /api/events/system/status
 * @desc Verificar status do sistema de eventos
 * @access Private
 */
router.get('/system/status', authMiddleware, eventController.getSystemStatus);

/**
 * @route POST /api/events/admin/expire
 * @desc Forçar expiração de eventos antigos (admin)
 * @access Private
 */
router.post('/admin/expire', authMiddleware, eventController.expireOldEvents);

module.exports = router;