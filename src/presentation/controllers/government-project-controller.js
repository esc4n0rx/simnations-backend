const GovernmentProjectService = require('../../application/services/government-project-service');
const ProjectExecutionService = require('../../application/services/project-execution-service');
const ResponseHelper = require('../../shared/helpers/response-helper');
const TimeoutHelper = require('../../shared/utils/timeout-helper');
const debugLogger = require('../../shared/utils/project-debug-logger');
const { PROJECT_STATUS } = require('../../shared/constants/government-project-constants');

class GovernmentProjectController {
    constructor() {
        this.projectService = new GovernmentProjectService();
        this.executionService = new ProjectExecutionService();
        console.log(`🏗️ [CONTROLLER DEBUG] GovernmentProjectController constructed`);
    }

    /**
     * Criar nova ideia de projeto - VERSÃO ULTRA DEBUG
     */
    createProjectIdea = async (req, res, next) => {
        console.log(`\n🚀 [CONTROLLER] createProjectIdea METHOD STARTED`);
        console.log(`📍 Timestamp: ${new Date().toISOString()}`);
        console.log(`📍 Request received`);
        console.log(`${'='.repeat(80)}`);
        
        let sessionId = null;
        
        try {
            console.log(`\n🔍 [CONTROLLER] EXTRACTING DATA FROM REQUEST`);
            
            const userId = req.user?.id;
            const { original_idea } = req.body || {};

            console.log(`📍 User ID: ${userId}`);
            console.log(`📍 Original Idea: ${original_idea}`);
            console.log(`📍 Request User Object: ${JSON.stringify(req.user, null, 2)}`);
            console.log(`📍 Request Body: ${JSON.stringify(req.body, null, 2)}`);
            console.log(`${'='.repeat(80)}`);

            if (!userId) {
                console.log(`❌ [CONTROLLER] USER ID NOT FOUND`);
                return ResponseHelper.unauthorized(res, 'Usuário não autenticado');
            }

            if (!original_idea) {
                console.log(`❌ [CONTROLLER] ORIGINAL IDEA NOT FOUND`);
                return ResponseHelper.badRequest(res, 'Ideia do projeto é obrigatória');
            }

            console.log(`\n✅ [CONTROLLER] BASIC VALIDATION PASSED`);
            console.log(`${'='.repeat(80)}`);

            // Iniciar sessão de debug
            sessionId = debugLogger.startSession(userId, original_idea);
            debugLogger.logStep('CONTROLLER_START', {
                userId,
                ideaLength: original_idea?.length,
                userAgent: req.headers['user-agent']
            }, 'START');

            console.log(`\n🔍 [CONTROLLER] DETAILED VALIDATION START`);

            // Validações básicas
            debugLogger.logStep('VALIDATION_START', {}, 'START');
            
            if (!original_idea || original_idea.trim().length === 0) {
                console.log(`❌ [CONTROLLER] VALIDATION FAILED - Empty idea`);
                debugLogger.logStep('VALIDATION_FAILED', { reason: 'Ideia vazia' }, 'ERROR');
                debugLogger.endSession('VALIDATION_ERROR');
                return ResponseHelper.badRequest(res, 'Ideia do projeto é obrigatória');
            }

            if (original_idea.length < 10) {
                console.log(`❌ [CONTROLLER] VALIDATION FAILED - Idea too short: ${original_idea.length}`);
                debugLogger.logStep('VALIDATION_FAILED', { reason: 'Ideia muito curta', length: original_idea.length }, 'ERROR');
                debugLogger.endSession('VALIDATION_ERROR');
                return ResponseHelper.badRequest(res, 'Ideia muito curta. Forneça mais detalhes sobre sua proposta');
            }

            if (original_idea.length > 1000) {
                console.log(`❌ [CONTROLLER] VALIDATION FAILED - Idea too long: ${original_idea.length}`);
                debugLogger.logStep('VALIDATION_FAILED', { reason: 'Ideia muito longa', length: original_idea.length }, 'ERROR');
                debugLogger.endSession('VALIDATION_ERROR');
                return ResponseHelper.badRequest(res, 'Ideia muito longa. Seja mais conciso em sua proposta');
            }

            console.log(`✅ [CONTROLLER] DETAILED VALIDATION PASSED`);
            debugLogger.logSuccess('VALIDATION_COMPLETE', { ideaLength: original_idea.length });

            console.log(`\n🔧 [CONTROLLER] CALLING SERVICE`);
            console.log(`📍 About to call this.callServiceWithDebug`);
            console.log(`${'='.repeat(80)}`);

            // Chamar service com timeout e debug
            debugLogger.logStep('SERVICE_CALL_START', {}, 'START');
            
            const result = await TimeoutHelper.withTimeout(
                this.callServiceWithDebug(userId, original_idea, sessionId),
                45000,
                'criação de projeto'
            );

            console.log(`✅ [CONTROLLER] SERVICE CALL COMPLETED`);
            console.log(`📍 Result: ${JSON.stringify(result, null, 2)}`);
            console.log(`${'='.repeat(80)}`);

            debugLogger.logSuccess('SERVICE_CALL_COMPLETE', { 
                success: result.success,
                projectId: result.project?.id 
            });

            if (!result.success) {
                console.log(`❌ [CONTROLLER] SERVICE FAILED`);
                debugLogger.logStep('SERVICE_FAILED', { error: result.error }, 'ERROR');
                debugLogger.endSession('SERVICE_ERROR');
                return ResponseHelper.badRequest(res, result.error, result.details);
            }

            console.log(`\n📤 [CONTROLLER] PREPARING RESPONSE`);
            debugLogger.logStep('RESPONSE_PREPARE', {
                projectId: result.project.id,
                message: result.message
            }, 'START');

            debugLogger.endSession('SUCCESS');
            
            console.log(`✅ [CONTROLLER] SENDING RESPONSE`);
            console.log(`${'='.repeat(80)}`);
            
            ResponseHelper.created(res, result.project, result.message);

        } catch (error) {
            console.log(`\n❌ [CONTROLLER] ERROR CAUGHT`);
            console.log(`📍 Error: ${error.message}`);
            console.log(`📍 Stack: ${error.stack}`);
            console.log(`${'='.repeat(80)}`);
            
            debugLogger.logError('CONTROLLER_ERROR', error, {
                userId: req.user?.id,
                sessionId
            });
            debugLogger.endSession('CONTROLLER_ERROR');

            if (error.message.includes('Timeout')) {
                return ResponseHelper.error(res, 'O processamento está demorando mais que o esperado. Tente novamente em alguns minutos.', 408);
            }

            next(error);
        }
    };

    /**
     * Chamar service com debug detalhado
     */
    async callServiceWithDebug(userId, originalIdea, sessionId) {
        console.log(`\n🔧 [CONTROLLER] callServiceWithDebug STARTED`);
        console.log(`📍 User ID: ${userId}`);
        console.log(`📍 Session ID: ${sessionId}`);
        console.log(`${'='.repeat(80)}`);
        
        debugLogger.logStep('SERVICE_METHOD_START', {
            method: 'createProjectIdea',
            sessionId
        }, 'START');

        const result = await this.projectService.createProjectIdea(userId, originalIdea);

        console.log(`✅ [CONTROLLER] callServiceWithDebug COMPLETED`);
        console.log(`${'='.repeat(80)}`);

        debugLogger.logStep('SERVICE_METHOD_COMPLETE', {
            success: result.success,
            hasProject: !!result.project,
            sessionId
        }, 'SUCCESS');

        return result;
    }

    // Outros métodos permanecem iguais...
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

    getSystemStatus = async (req, res, next) => {
        try {
            const status = await this.projectService.checkSystemStatus();
            
            ResponseHelper.success(res, status, 'Status do sistema obtido');
        } catch (error) {
            next(error);
        }
    };

    executeProjectJob = async (req, res, next) => {
        try {
            const result = await this.executionService.executeJobManually();
            
            if (result.success) {
                ResponseHelper.success(res, result, 'Job executada com sucesso');
            } else {
                ResponseHelper.error(res, result.error || 'Falha na execução da job', 500);
            }
        } catch (error) {
            next(error);
        }
    };

    getExecutionStats = async (req, res, next) => {
        try {
            const stats = await this.executionService.getExecutionStatistics();
            
            ResponseHelper.success(res, stats, 'Estatísticas obtidas com sucesso');
        } catch (error) {
            next(error);
        }
    };

    getPendingExecutions = async (req, res, next) => {
        try {
            const pending = await this.executionService.getPendingExecutions();
            
            ResponseHelper.success(res, pending, 'Execuções pendentes obtidas');
        } catch (error) {
            next(error);
        }
    };

    searchProjects = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const searchParams = req.query;
            
            const results = await this.projectService.searchProjects(userId, searchParams);
            
            ResponseHelper.success(res, results, 'Busca realizada com sucesso');
        } catch (error) {
            next(error);
        }
    };
}

module.exports = GovernmentProjectController;