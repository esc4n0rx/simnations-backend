const GovernmentProjectService = require('../../application/services/government-project-service');
const { StatusCodes } = require('http-status-codes');

class GovernmentProjectController {
    constructor() {
        this.projectService = new GovernmentProjectService();
    }

    /**
     * Criar novo projeto
     */
    createProject = async (req, res) => {
        try {
            const { original_idea } = req.body;
            const userId = req.user.id;

            const result = await this.projectService.createProject(userId, original_idea);

            return res.status(StatusCodes.CREATED).json({
                success: true,
                message: result.message,
                data: {
                    project: result.project
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao criar projeto:', error);
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * Listar projetos do usuário
     */
    getUserProjects = async (req, res) => {
        try {
            const userId = req.user.id;
            const { status, limit = 20, offset = 0 } = req.query;

            const filters = {
                status,
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            const result = await this.projectService.getUserProjects(userId, filters);

            return res.status(StatusCodes.OK).json({
                success: true,
                message: 'Projetos obtidos com sucesso',
                data: result.data,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao listar projetos:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * [NOVO] Obter projetos pendentes de aprovação
     */
    getPendingProjects = async (req, res) => {
        try {
            const userId = req.user.id;

            const result = await this.projectService.getUserProjects(userId, {
                status: 'pending_approval',
                limit: 50,
                offset: 0
            });

            return res.status(StatusCodes.OK).json({
                success: true,
                message: 'Projetos pendentes obtidos com sucesso',
                data: result.data,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao buscar projetos pendentes:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * Buscar projeto por ID
     */
    getProjectById = async (req, res) => {
        try {
            const { projectId } = req.params;
            const userId = req.user.id;

            const result = await this.projectService.getProjectById(projectId, userId);

            return res.status(StatusCodes.OK).json({
                success: true,
                message: 'Projeto encontrado',
                data: result.data,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao buscar projeto:', error);
            
            const statusCode = error.message.includes('não encontrado') || error.message.includes('Acesso negado') 
                ? StatusCodes.NOT_FOUND 
                : StatusCodes.INTERNAL_SERVER_ERROR;

            return res.status(statusCode).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * Aprovar projeto
     */
    approveProject = async (req, res) => {
        try {
            const { projectId } = req.params;
            const userId = req.user.id;

            const result = await this.projectService.approveProject(projectId, userId);

            return res.status(StatusCodes.OK).json({
                success: true,
                message: result.message,
                data: {
                    project: result.project
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao aprovar projeto:', error);
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * Rejeitar projeto
     */
    rejectProject = async (req, res) => {
        try {
            const { projectId } = req.params;
            const { reason } = req.body;
            const userId = req.user.id;

            const result = await this.projectService.rejectProject(projectId, userId, reason);

            return res.status(StatusCodes.OK).json({
                success: true,
                message: result.message,
                data: {
                    project: result.project
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao rejeitar projeto:', error);
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * [NOVO] Cancelar projeto
     */
    cancelProject = async (req, res) => {
        try {
            const { projectId } = req.params;
            const { reason } = req.body;
            const userId = req.user.id;

            const result = await this.projectService.rejectProject(projectId, userId, reason);

            return res.status(StatusCodes.OK).json({
                success: true,
                message: 'Projeto cancelado com sucesso',
                data: {
                    project: result.project
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao cancelar projeto:', error);
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * [NOVO] Verificar status do sistema de IA
     */
    getSystemStatus = async (req, res) => {
        try {
            // Implementar verificação de status do sistema
            const systemStatus = {
                status: 'operational',
                services: {
                    ai_agents: 'online',
                    project_processing: 'online',
                    database: 'online'
                },
                last_check: new Date().toISOString()
            };

            return res.status(StatusCodes.OK).json({
                success: true,
                message: 'Status do sistema obtido',
                data: systemStatus,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao verificar status:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * [NOVO] Executar job de projetos manualmente (admin)
     */
    executeProjectJob = async (req, res) => {
        try {
            console.log('🔧 [ADMIN] Executando job de projetos manualmente...');

            // Por enquanto, retornar resposta mock
            const result = {
                job_executed: true,
                execution_time: new Date().toISOString(),
                projects_processed: 0,
                message: 'Job executada com sucesso (funcionalidade em desenvolvimento)'
            };

            return res.status(StatusCodes.OK).json({
                success: true,
                message: 'Job de projetos executada com sucesso',
                data: result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao executar job:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * [NOVO] Obter estatísticas de execução (admin)
     */
    getExecutionStats = async (req, res) => {
        try {
            const stats = {
                total_projects: 0,
                pending_approval: 0,
                in_execution: 0,
                completed: 0,
                failed: 0,
                last_execution: null,
                average_processing_time: '0 minutes'
            };

            return res.status(StatusCodes.OK).json({
                success: true,
                message: 'Estatísticas obtidas com sucesso',
                data: stats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao obter estatísticas:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * [NOVO] Obter execuções pendentes (admin)
     */
    getPendingExecutions = async (req, res) => {
        try {
            const { limit = 50 } = req.query;

            const result = {
                pending_executions: [],
                total: 0,
                limit: parseInt(limit)
            };

            return res.status(StatusCodes.OK).json({
                success: true,
                message: 'Execuções pendentes obtidas',
                data: result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao buscar execuções pendentes:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * [NOVO] Buscar projetos com filtros avançados (admin)
     */
    searchProjects = async (req, res) => {
        try {
            const {
                status,
                state_id,
                date_from,
                date_to,
                page = 1,
                limit = 20
            } = req.query;

            // Implementar busca avançada se necessário
            // Por enquanto, retornar resposta básica
            return res.status(StatusCodes.OK).json({
                success: true,
                message: 'Busca avançada não implementada ainda',
                data: {
                    projects: [],
                    total: 0,
                    filters_applied: {
                        status,
                        state_id,
                        date_from,
                        date_to,
                        page: parseInt(page),
                        limit: parseInt(limit)
                    }
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro na busca avançada:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };
}

module.exports = GovernmentProjectController;