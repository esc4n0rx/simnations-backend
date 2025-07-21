const express = require('express');
const ConstructionController = require('../controllers/construction-controller');
const authMiddleware = require('../middleware/auth-middleware');
const validationMiddleware = require('../middleware/validation-middleware');
const constructionValidators = require('../../application/validators/construction-validators');
const { param } = require('express-validator');

const router = express.Router();
const controller = new ConstructionController();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validação de parâmetros UUID
const constructionIdValidation = [
    param('constructionId').isUUID().withMessage('ID da construção deve ser um UUID válido')
];

const constructionTypeIdValidation = [
    param('constructionTypeId').isUUID().withMessage('ID do tipo de construção deve ser um UUID válido')
];

/**
 * @route GET /api/constructions/available
 * @desc Listar construções disponíveis
 * @access Private
 */
router.get('/available', controller.getAvailableConstructions.bind(controller));

/**
 * @route GET /api/constructions/my-constructions
 * @desc Listar construções do usuário
 * @access Private
 */
router.get('/my-constructions', controller.getUserConstructions.bind(controller));

/**
 * @route GET /api/constructions/history
 * @desc Obter histórico de construções completadas
 * @access Private
 */
router.get('/history', controller.getConstructionHistory.bind(controller));

/**
 * @route GET /api/constructions/:constructionId
 * @desc Obter detalhes de uma construção específica
 * @access Private
 */
router.get('/:constructionId', 
    constructionIdValidation, 
    controller.getConstructionById.bind(controller)
);

/**
 * @route GET /api/constructions/check/:constructionTypeId
 * @desc Verificar se pode iniciar uma construção
 * @access Private
 */
router.get('/check/:constructionTypeId', 
    constructionTypeIdValidation, 
    controller.canStartConstruction.bind(controller)
);

/**
 * @route POST /api/constructions/start
 * @desc Iniciar nova construção
 * @access Private
 */
router.post('/start', 
    validationMiddleware(constructionValidators.startConstruction),
    controller.startConstruction.bind(controller)
);

/**
 * @route PUT /api/constructions/:constructionId/select-winner
 * @desc Selecionar empresa vencedora da licitação
 * @access Private
 */
router.put('/:constructionId/select-winner', 
    constructionIdValidation,
    validationMiddleware(constructionValidators.selectWinner),
    controller.selectBiddingWinner.bind(controller)
);

/**
 * @route PUT /api/constructions/:constructionId/cancel
 * @desc Cancelar construção (apenas se em licitação)
 * @access Private
 */
router.put('/:constructionId/cancel', 
    constructionIdValidation,
    validationMiddleware(constructionValidators.cancelConstruction),
    controller.cancelConstruction.bind(controller)
);

/**
 * @route POST /api/constructions/admin/force-update
 * @desc Forçar atualização de construções (Admin)
 * @access Private
 */
router.post('/admin/force-update', controller.forceConstructionUpdate.bind(controller));

module.exports = router;