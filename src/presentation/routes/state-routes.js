const express = require('express');
const StateController = require('../controllers/state-controller');
const validationMiddleware = require('../middleware/validation-middleware');
const authMiddleware = require('../middleware/auth-middleware');
const { economyUpdateSchema, governanceUpdateSchema } = require('../../application/validators/state-validator');

// [NOVO] Importar serviços para rotas administrativas
const EconomicEngineService = require('../../application/services/economic-engine-service');
const StateParameterRepository = require('../../domain/repositories/state-parameter-repository');

const router = express.Router();
const stateController = new StateController();

// [NOVO] Instâncias para rotas administrativas
const economicEngine = new EconomicEngineService();
const parameterRepository = new StateParameterRepository();

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

// [NOVAS ROTAS] Sistema Econômico

/**
 * @route GET /api/state/economic-logs
 * @desc Obter logs de atualizações econômicas do usuário
 * @access Private
 */
router.get('/economic-logs', authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 10;
        
        const logs = await parameterRepository.findLogsByUserId(userId, limit);
        
        res.json({
            success: true,
            data: logs.map(log => log.toObject()),
            message: 'Logs obtidos com sucesso'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/state/parameters
 * @desc Obter parâmetros econômicos do estado
 * @access Private
 */
router.get('/parameters', authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const parameters = await parameterRepository.findByUserId(userId);
        
        if (!parameters) {
            return res.status(404).json({
                success: false,
                message: 'Parâmetros econômicos não encontrados'
            });
        }
        
        res.json({
            success: true,
            data: parameters.toObject(),
            message: 'Parâmetros obtidos com sucesso'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/state/force-economic-update
 * @desc Forçar atualização econômica manual para o usuário
 * @access Private
 */
router.post('/force-economic-update', authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const result = await economicEngine.forceUpdateForUser(userId);
        
        res.json({
            success: true,
            data: result,
            message: 'Atualização econômica forçada executada com sucesso'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/state/economic-stats
 * @desc Obter estatísticas do sistema econômico
 * @access Private
 */
router.get('/economic-stats', authMiddleware, async (req, res, next) => {
    try {
        const stats = await economicEngine.getEconomicEngineStats();
        
        res.json({
            success: true,
            data: stats,
            message: 'Estatísticas obtidas com sucesso'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;