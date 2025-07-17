const express = require('express');
const GovernmentProjectController = require('../controllers/government-project-controller');
const authMiddleware = require('../middleware/auth-middleware');
const validationMiddleware = require('../middleware/validation-middleware');
const projectDebugMiddleware = require('../middleware/project-debug-middleware');
const superDebugMiddleware = require('../middleware/super-debug-middleware');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();
const controller = new GovernmentProjectController();

// DEBUG: Middleware ultra-verboso PRIMEIRO
router.use(superDebugMiddleware);

// Log antes da autenticação
router.use((req, res, next) => {
    if (req.method === 'POST' && req.path === '/') {
        console.log(`\n🔐 [AUTH DEBUG] BEFORE AUTH MIDDLEWARE`);
        console.log(`📍 Headers: ${JSON.stringify(req.headers, null, 2)}`);
        console.log(`${'='.repeat(80)}`);
    }
    next();
});

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

// Log depois da autenticação
router.use((req, res, next) => {
    if (req.method === 'POST' && req.path === '/') {
        console.log(`\n✅ [AUTH DEBUG] AFTER AUTH MIDDLEWARE`);
        console.log(`📍 User: ${JSON.stringify(req.user, null, 2)}`);
        console.log(`${'='.repeat(80)}`);
    }
    next();
});

// Aplicar middleware de debug específico para criação de projetos
router.use(projectDebugMiddleware);

// Log antes da validação
router.use((req, res, next) => {
    if (req.method === 'POST' && req.path === '/') {
        console.log(`\n🔍 [VALIDATION DEBUG] BEFORE VALIDATION`);
        console.log(`📍 Body: ${JSON.stringify(req.body, null, 2)}`);
        console.log(`${'='.repeat(80)}`);
    }
    next();
});

// Middleware personalizado para debug do express-validator
const debugExpressValidator = (req, res, next) => {
    if (req.method === 'POST' && req.path === '/') {
        console.log(`\n🔍 [EXPRESS-VALIDATOR DEBUG] CHECKING VALIDATION RESULT`);
        
        const errors = validationResult(req);
        console.log(`📍 Has errors: ${!errors.isEmpty()}`);
        
        if (!errors.isEmpty()) {
            console.log(`❌ Validation errors:`, JSON.stringify(errors.array(), null, 2));
            
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos',
                errors: errors.array(),
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`✅ Validation passed`);
        console.log(`${'='.repeat(80)}`);
    }
    next();
};

// Validações

// Validação para criação de projeto
const createProjectValidation = [
    body('original_idea')
        .notEmpty()
        .withMessage('Ideia original é obrigatória')
        .isLength({ min: 10, max: 2000 })
        .withMessage('Ideia deve ter entre 10 e 2000 caracteres')
        .trim(),
    debugExpressValidator
];

// Validação para parâmetros de projeto
const projectIdValidation = [
    param('projectId')
        .isUUID()
        .withMessage('ID do projeto deve ser um UUID válido'),
    debugExpressValidator
];

// Validação para rejeição de projeto
const rejectProjectValidation = [
    param('projectId')
        .isUUID()
        .withMessage('ID do projeto deve ser um UUID válido'),
    body('reason')
        .notEmpty()
        .withMessage('Motivo da rejeição é obrigatório')
        .isLength({ min: 10, max: 500 })
        .withMessage('Motivo deve ter entre 10 e 500 caracteres')
        .trim(),
    debugExpressValidator
];

// Validação para listagem de projetos
const listProjectsValidation = [
    query('status')
        .optional()
        .isIn(['draft', 'pending_approval', 'approved', 'rejected', 'in_execution', 'completed', 'cancelled'])
        .withMessage('Status inválido'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit deve estar entre 1 e 100'),
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset deve ser um número não negativo'),
    query('order_by')
        .optional()
        .isIn(['created_at', 'updated_at', 'approved_at', 'started_at', 'completed_at'])
        .withMessage('Campo de ordenação inválido'),
    query('order_direction')
        .optional()
        .isIn(['ASC', 'DESC'])
        .withMessage('Direção de ordenação deve ser ASC ou DESC'),
    debugExpressValidator
];

// Log antes do controller
router.use((req, res, next) => {
    if (req.method === 'POST' && req.path === '/') {
        console.log(`\n🎯 [CONTROLLER DEBUG] ABOUT TO REACH CONTROLLER`);
        console.log(`📍 All middleware passed successfully`);
        console.log(`📍 User: ${req.user?.id}`);
        console.log(`📍 Body: ${JSON.stringify(req.body)}`);
        console.log(`${'='.repeat(80)}`);
    }
    next();
});

/**
 * @route POST /api/government-projects
 * @desc Criar nova ideia de projeto
 * @access Private
 */
// Na seção da rota POST, trocar:
router.post('/', createProjectValidation, (req, res, next) => {
    console.log(`\n🚀 [ROUTE DEBUG] POST ROUTE HANDLER STARTED`);
    console.log(`📍 About to call controller.createProject`); // <- CORRIGIDO
    console.log(`📍 Request user: ${JSON.stringify(req.user)}`);
    console.log(`📍 Request body: ${JSON.stringify(req.body)}`);
    console.log(`${'='.repeat(80)}`);
    
    try {
        controller.createProject(req, res, next); // <- CORRIGIDO
    } catch (error) {
        console.log(`❌ [ROUTE DEBUG] ERROR IN ROUTE HANDLER: ${error.message}`);
        next(error);
    }
});

/**
 * @route GET /api/government-projects
 * @desc Listar projetos do usuário
 * @access Private
 */
router.get('/', listProjectsValidation, controller.getUserProjects);

/**
 * @route GET /api/government-projects/pending
 * @desc Obter projetos pendentes de aprovação
 * @access Private
 */
router.get('/pending', controller.getPendingProjects);

/**
 * @route GET /api/government-projects/:projectId
 * @desc Obter projeto específico
 * @access Private
 */
router.get('/:projectId', projectIdValidation, controller.getProjectById);

/**
 * @route PUT /api/government-projects/:projectId/approve
 * @desc Aprovar projeto
 * @access Private
 */
router.put('/:projectId/approve', projectIdValidation, controller.approveProject);

/**
 * @route PUT /api/government-projects/:projectId/reject
 * @desc Rejeitar projeto
 * @access Private
 */
router.put('/:projectId/reject', rejectProjectValidation, controller.rejectProject);

/**
 * @route PUT /api/government-projects/:projectId/cancel
 * @desc Cancelar projeto
 * @access Private
 */
router.put('/:projectId/cancel', rejectProjectValidation, controller.cancelProject);

// Rotas de sistema e status

/**
 * @route GET /api/government-projects/system/status
 * @desc Verificar status do sistema de IA
 * @access Private
 */
router.get('/system/status', controller.getSystemStatus);

// Rotas administrativas (requerem permissões especiais)

/**
 * @route POST /api/government-projects/admin/execute-job
 * @desc Executar job de projetos manualmente
 * @access Private (Admin)
 */
router.post('/admin/execute-job', controller.executeProjectJob);

/**
 * @route GET /api/government-projects/admin/execution-stats
 * @desc Obter estatísticas de execução
 * @access Private (Admin)
 */
router.get('/admin/execution-stats', controller.getExecutionStats);

/**
 * @route GET /api/government-projects/admin/pending-executions
 * @desc Obter execuções pendentes
 * @access Private (Admin)
 */
router.get('/admin/pending-executions', controller.getPendingExecutions);

/**
 * @route GET /api/government-projects/admin/search
 * @desc Buscar projetos com filtros avançados
 * @access Private (Admin)
 */
router.get('/admin/search', [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Página deve ser um número positivo'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limite deve estar entre 1 e 100'),
    debugExpressValidator
], controller.searchProjects);

module.exports = router;