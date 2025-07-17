const express = require('express');
const GovernmentProjectController = require('../controllers/government-project-controller');
const authMiddleware = require('../middlewares/auth-middleware');
const validationMiddleware = require('../middlewares/validation-middleware');
const { body, param, query } = require('express-validator');

const router = express.Router();
const controller = new GovernmentProjectController();

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

// Validações
const createProjectValidation = [
    body('original_idea')
        .isString()
        .trim()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Ideia deve ter entre 10 e 1000 caracteres'),
    validationMiddleware
];

const projectIdValidation = [
    param('projectId')
        .isInt({ min: 1 })
        .withMessage('ID do projeto deve ser um número inteiro positivo'),
    validationMiddleware
];

const rejectProjectValidation = [
    ...projectIdValidation,
    body('reason')
        .isString()
        .trim()
        .isLength({ min: 5, max: 500 })
        .withMessage('Motivo deve ter entre 5 e 500 caracteres'),
    validationMiddleware
];

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
    validationMiddleware
];

// Rotas principais dos projetos

/**
 * @route POST /api/government-projects
 * @desc Criar nova ideia de projeto
 * @access Private
 */
router.post('/', createProjectValidation, controller.createProjectIdea);

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
    validationMiddleware
], controller.searchProjects);

module.exports = router;