const GovernmentProjectService = require('../../application/services/government-project-service');
const ProjectExecutionService = require('../../application/services/project-execution-service');
const ResponseHelper = require('../../shared/helpers/response-helper');
const { PROJECT_STATUS } = require('../../shared/constants/government-project-constants');

class GovernmentProjectController {
    constructor() {
        this.projectService = new GovernmentProjectService();
        this.executionService = new ProjectExecutionService();
    }

    /**
     * Criar nova ideia de projeto
     */
    createProjectIdea = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { original_idea } = req.body;

            // Validar entrada
            if (!original_idea || original_idea.trim().length === 0) {
                return ResponseHelper.badRequest(res, 'Ideia do projeto é obrigatória');
            }

            if (original_idea.length < 10) {
                return ResponseHelper.badRequest(res, 'Ideia muito curta. Forneça mais detalhes sobre sua proposta');
            }

            if (original_idea.length > 1000) {
                return ResponseHelper.badRequest(res, 'Ideia muito longa. Seja mais conciso em sua proposta');
            }

            const result = await this.projectService.createProjectIdea(userId, original_idea);

            if (!result.success) {
                return ResponseHelper.badRequest(res, result.error, result.details);
            }

            ResponseHelper.created(res, result.project, result.message);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Listar projetos do usuário
     */
    getUserProjects = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const {
                status = null,
                limit = 20,
                offset = 0,
                order_by = 'created_at',
                order_direction = 'DESC'
            } = req.query;

            const options = {
                status,
                limit: parseInt(limit),
                offset: parseInt(offset),
                orderBy: order_by,
                orderDirection: order_direction.toUpperCase()
            };

            const result = await this.projectService.getUserProjects(userId, options);

            ResponseHelper.success(res, result, 'Projetos obtidos com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Obter projeto específico
     */
    getProjectById = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { projectId } = req.params;

            if (!projectId || isNaN(projectId)) {
                return ResponseHelper.badRequest(res, 'ID do projeto inválido');
            }

            const result = await this.projectService.getProjectById(userId, parseInt(projectId));
            
            ResponseHelper.success(res, result.project, 'Projeto obtido com sucesso');
        } catch (error) {
            if (error.message.includes('não encontrado') || error.message.includes('não autorizado')) {
                return ResponseHelper.notFound(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Obter projetos pendentes de aprovação
     */
    getPendingProjects = async (req, res, next) => {
        try {
            const userId = req.user.id;
            
            const pendingProjects = await this.projectService.getPendingProjects(userId);
            
            ResponseHelper.success(res, { 
                projects: pendingProjects,
                total: pendingProjects.length 
            }, 'Projetos pendentes obtidos com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Aprovar projeto
     */
    approveProject = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { projectId } = req.params;

            if (!projectId || isNaN(projectId)) {
                return ResponseHelper.badRequest(res, 'ID do projeto inválido');
            }

            const result = await this.projectService.approveProject(userId, parseInt(projectId));

            if (!result.success) {
                return ResponseHelper.badRequest(res, result.error, result);
            }

            ResponseHelper.success(res, result.project, result.message);
        } catch (error) {
            if (error.message.includes('não encontrado') || error.message.includes('não autorizado')) {
                return ResponseHelper.notFound(res, error.message);
            }
            if (error.message.includes('não está pendente')) {
                return ResponseHelper.badRequest(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Rejeitar projeto
     */
    rejectProject = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { projectId } = req.params;
            const { reason } = req.body;

            if (!projectId || isNaN(projectId)) {
                return ResponseHelper.badRequest(res, 'ID do projeto inválido');
            }

            if (!reason || reason.trim().length === 0) {
                return ResponseHelper.badRequest(res, 'Motivo da rejeição é obrigatório');
            }

            const result = await this.projectService.rejectProject(userId, parseInt(projectId), reason);

            ResponseHelper.success(res, result.project, result.message);
        } catch (error) {
            if (error.message.includes('não encontrado') || error.message.includes('não autorizado')) {
                return ResponseHelper.notFound(res, error.message);
            }
            if (error.message.includes('não está pendente')) {
                return ResponseHelper.badRequest(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Cancelar projeto
     */
    cancelProject = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { projectId } = req.params;
            const { reason } = req.body;

            if (!projectId || isNaN(projectId)) {
                return ResponseHelper.badRequest(res, 'ID do projeto inválido');
            }

            if (!reason || reason.trim().length === 0) {
                return ResponseHelper.badRequest(res, 'Motivo do cancelamento é obrigatório');
            }

            const result = await this.projectService.cancelProject(userId, parseInt(projectId), reason);

            ResponseHelper.success(res, result.project, result.message);
        } catch (error) {
            if (error.message.includes('não encontrado') || error.message.includes('não autorizado')) {
                return ResponseHelper.notFound(res, error.message);
            }
            if (error.message.includes('não pode ser cancelado')) {
                return ResponseHelper.badRequest(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Verificar status do sistema de IA
     */
    getSystemStatus = async (req, res, next) => {
        try {
            const status = await this.projectService.checkSystemStatus();
            
            ResponseHelper.success(res, status, 'Status do sistema obtido');
        } catch (error) {
            next(error);
        }
    };

    // Endpoints administrativos

    /**
     * Executar job de projetos manualmente (desenvolvimento)
     */
    executeProjectJob = async (req, res, next) => {
        try {
            const result = await this.executionService.executeJobManually();
            
            if (result.success) {
                ResponseHelper.success(res, result, 'Job executada com sucesso');
            } else {
                ResponseHelper.serverError(res, result.error);
            }
        } catch (error) {
            next(error);
        }
    };

    /**
     * Obter estatísticas de execução
     */
    getExecutionStats = async (req, res, next) => {
        try {
            const stats = await this.executionService.getExecutionStats();
            
            ResponseHelper.success(res, stats, 'Estatísticas obtidas com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Obter execuções pendentes
     */
    getPendingExecutions = async (req, res, next) => {
        try {
            const { limit = 50 } = req.query;
            
            const executions = await this.executionService.getPendingExecutions(parseInt(limit));
            
            ResponseHelper.success(res, { 
                executions,
                total: executions.length 
            }, 'Execuções pendentes obtidas');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Buscar projetos com filtros avançados (admin)
     */
    searchProjects = async (req, res, next) => {
        try {
            const filters = {
                userId: req.query.user_id,
                stateId: req.query.state_id,
                status: req.query.status,
                projectType: req.query.project_type,
                startDate: req.query.start_date,
                endDate: req.query.end_date,
                search: req.query.search,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                orderBy: req.query.order_by || 'created_at',
                orderDirection: req.query.order_direction || 'DESC'
            };

            const result = await this.projectService.projectRepository.findWithFilters(filters);
            
            ResponseHelper.success(res, {
                projects: result.projects.map(project => project.toObject()),
                pagination: result.pagination
            }, 'Busca realizada com sucesso');
        } catch (error) {
            next(error);
        }
    };
}

module.exports = GovernmentProjectController;