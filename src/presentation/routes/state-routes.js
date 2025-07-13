const express = require('express');
const StateController = require('../controllers/state-controller');
const validationMiddleware = require('../middleware/validation-middleware');
const authMiddleware = require('../middleware/auth-middleware');
const { economyUpdateSchema, governanceUpdateSchema } = require('../../application/validators/state-validator');

const router = express.Router();
const stateController = new StateController();

/**
 * @route GET /api/state/data
 * @desc Obter dados completos do estado do usuário
 * @access Private
 */
router.get('/data', authMiddleware, stateController.getStateData);

/**
 * @route GET /api/state/economy
 * @desc Obter dados econômicos do estado
 * @access Private
 */
router.get('/economy', authMiddleware, stateController.getEconomyData);

/**
 * @route GET /api/state/governance
 * @desc Obter dados de governança do estado
 * @access Private
 */
router.get('/governance', authMiddleware, stateController.getGovernanceData);

/**
 * @route GET /api/state/analysis
 * @desc Obter análise detalhada do estado
 * @access Private
 */
router.get('/analysis', authMiddleware, stateController.getStateAnalysis);

/**
 * @route GET /api/state/summary
 * @desc Obter resumo executivo do estado
 * @access Private
 */
router.get('/summary', authMiddleware, stateController.getExecutiveSummary);

/**
 * @route PUT /api/state/economy
 * @desc Atualizar dados econômicos do estado
 * @access Private
 */
router.put('/economy', 
    authMiddleware,
    validationMiddleware(economyUpdateSchema), 
    stateController.updateEconomy
);

/**
 * @route PUT /api/state/governance
 * @desc Atualizar dados de governança do estado
 * @access Private
 */
router.put('/governance', 
    authMiddleware,
    validationMiddleware(governanceUpdateSchema), 
    stateController.updateGovernance
);

module.exports = router;