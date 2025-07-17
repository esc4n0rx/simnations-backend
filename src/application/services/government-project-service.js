const GovernmentProjectRepository = require('../../domain/repositories/government-project-repository');
const StateRepository = require('../../domain/repositories/state-repository');
const GovernmentProjectEntity = require('../../domain/entities/government-project-entity');
const ProjectRefinementAgentService = require('./project-refinement-agent-service');
const ProjectAnalysisAgentService = require('./project-analysis-agent-service');
const ProjectPopulationAgentService = require('./project-population-agent-service');
const ProjectExecutionService = require('./project-execution-service');
const GroqProvider = require('../../infrastructure/ai/groq-provider');
const TimeoutHelper = require('../../shared/utils/timeout-helper');
const debugLogger = require('../../shared/utils/project-debug-logger');
const { PROJECT_STATUS, EXECUTION_METHODS } = require('../../shared/constants/government-project-constants');

class GovernmentProjectService {
    constructor() {
        this.projectRepository = new GovernmentProjectRepository();
        this.stateRepository = new StateRepository();
        this.executionService = new ProjectExecutionService();
        
        // Inicializar provedor de IA
        this.llmProvider = new GroqProvider();
        
        // Inicializar agentes
        this.refinementAgent = new ProjectRefinementAgentService(this.llmProvider);
        this.analysisAgent = new ProjectAnalysisAgentService(this.llmProvider);
        this.populationAgent = new ProjectPopulationAgentService(this.llmProvider);

        debugLogger.log('SERVICE_INITIALIZED', {
            hasLLMProvider: !!this.llmProvider,
            hasAgents: !!(this.refinementAgent && this.analysisAgent && this.populationAgent)
        });
    }

    /**
     * Criar nova ideia de projeto (Etapa 1) - VERSÃO DEBUG
     */
    async createProjectIdea(userId, originalIdea) {
        try {
            debugLogger.logStep('SERVICE_START', {
                userId,
                ideaLength: originalIdea.length
            }, 'START');

            // Verificar se usuário pode criar projeto
            debugLogger.logStep('USER_VALIDATION_START', {}, 'START');
            
            const canCreate = await TimeoutHelper.withTimeout(
                this.projectRepository.canUserCreateProject(userId),
                5000,
                'verificação de permissão do usuário'
            );

            if (!canCreate.canCreate) {
                debugLogger.logStep('USER_VALIDATION_FAILED', {
                    reason: canCreate.reason,
                    details: canCreate
                }, 'ERROR');
                
                return {
                    success: false,
                    error: canCreate.reason,
                    details: canCreate
                };
            }

            debugLogger.logSuccess('USER_VALIDATION_COMPLETE', { canCreate: true });

            // Buscar dados do estado
            debugLogger.logStep('STATE_DATA_FETCH_START', {}, 'START');
            
            const stateData = await TimeoutHelper.withTimeout(
                this.stateRepository.findCompleteStateDataByUserId(userId),
                10000,
                'busca de dados do estado'
            );

            if (!stateData) {
                debugLogger.logStep('STATE_DATA_FETCH_FAILED', { reason: 'Dados não encontrados' }, 'ERROR');
                throw new Error('Dados do estado não encontrados');
            }

            debugLogger.logSuccess('STATE_DATA_FETCH_COMPLETE', {
                stateId: stateData.state_info?.id,
                stateName: stateData.state_info?.state,
                hasEconomyData: !!stateData.economy,
                hasGovernanceData: !!stateData.governance
            });

            // Criar entidade do projeto
            debugLogger.logStep('PROJECT_ENTITY_CREATE_START', {}, 'START');
            
            const projectEntity = new GovernmentProjectEntity({
                user_id: userId,
                state_id: stateData.state_info.id,
                original_idea: originalIdea.trim(),
                status: PROJECT_STATUS.DRAFT
            });

            debugLogger.logSuccess('PROJECT_ENTITY_CREATE_COMPLETE', {
                entityCreated: true,
                status: projectEntity.status
            });

            // Salvar projeto inicial
            debugLogger.logStep('PROJECT_SAVE_START', {}, 'START');
            
            const savedProject = await TimeoutHelper.withTimeout(
                this.projectRepository.create(projectEntity),
                5000,
                'criação do projeto no banco'
            );

            debugLogger.logSuccess('PROJECT_SAVE_COMPLETE', {
                projectId: savedProject.id,
                status: savedProject.status
            });

            // Iniciar processamento assíncrono (VERSÃO CORRIGIDA)
            debugLogger.logStep('ASYNC_PROCESSING_START', {
                projectId: savedProject.id
            }, 'START');

            // NÃO AGUARDAR - processar em background
            setImmediate(() => {
                this.processProjectRefinementSafely(savedProject.id, stateData)
                    .catch(error => {
                        console.error(`❌ [SERVICE] Erro no processamento assíncrono do projeto ${savedProject.id}:`, error);
                        debugLogger.logError('ASYNC_PROCESSING_ERROR', error, {
                            projectId: savedProject.id
                        });
                    });
            });

            debugLogger.logSuccess('ASYNC_PROCESSING_SCHEDULED', {
                projectId: savedProject.id,
                message: 'Processamento agendado para execução em background'
            });

            debugLogger.logStep('SERVICE_COMPLETE', {
                success: true,
                projectId: savedProject.id
            }, 'SUCCESS');

            return {
                success: true,
                project: savedProject.toObject(),
                message: 'Projeto criado e sendo processado pelos agentes de IA'
            };

        } catch (error) {
            debugLogger.logError('SERVICE_ERROR', error, {
                userId,
                originalIdea: originalIdea.substring(0, 100)
            });
            throw new Error(`Falha ao criar projeto: ${error.message}`);
        }
    }

    /**
     * Processar refinamento com tratamento de erro seguro - VERSÃO CORRIGIDA
     */
    async processProjectRefinementSafely(projectId, stateData) {
        try {
            debugLogger.logStep('REFINEMENT_SAFE_START', {
                projectId,
                stateId: stateData.state_info?.id
            }, 'START');
            
            // Usar retry para o refinamento
            await TimeoutHelper.withRetry(
                () => this.processProjectRefinement(projectId, stateData),
                2, // máximo 2 tentativas
                5000 // 5 segundos entre tentativas
            );
            
            debugLogger.logSuccess('REFINEMENT_SAFE_COMPLETE', { projectId });
            
        } catch (error) {
            console.error(`❌ [SERVICE] Erro crítico no refinamento do projeto ${projectId}:`, {
                message: error.message,
                stack: error.stack
            });
            
            debugLogger.logError('REFINEMENT_SAFE_ERROR', error, { projectId });

            // Marcar projeto como com erro
            try {
                await this.projectRepository.update(projectId, {
                    status: PROJECT_STATUS.DRAFT,
                    processing_logs: [{
                        timestamp: new Date(),
                        message: `Erro no processamento: ${error.message}`,
                        type: 'error'
                    }]
                });
                
                debugLogger.logSuccess('ERROR_STATE_UPDATED', { projectId });
            } catch (updateError) {
                console.error(`❌ [SERVICE] Erro ao atualizar estado de erro do projeto ${projectId}:`, updateError);
                debugLogger.logError('ERROR_STATE_UPDATE_FAILED', updateError, { projectId });
            }
        }
    }

    /**
     * Processar refinamento do projeto (Etapa 2 - Agente 1) - VERSÃO CORRIGIDA
     */
    async processProjectRefinement(projectId, stateData) {
        try {
            debugLogger.logStep('REFINEMENT_START', { projectId }, 'START');

            // Buscar projeto (SEM JOIN problemático)
            debugLogger.logStep('PROJECT_FETCH_FOR_REFINEMENT_START', {}, 'START');
            
            const project = await this.projectRepository.findById(projectId);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            debugLogger.logSuccess('PROJECT_FETCH_FOR_REFINEMENT_COMPLETE', {
                projectFound: true,
                originalIdeaLength: project.original_idea?.length
            });

            // Verificar se agentes de IA estão disponíveis
            if (!this.refinementAgent) {
                throw new Error('Agente de refinamento não disponível');
            }

            // Executar refinamento
            debugLogger.logStep('AI_REFINEMENT_START', {
                agentAvailable: !!this.refinementAgent
            }, 'START');

            const refinementResult = await TimeoutHelper.withTimeout(
                this.refinementAgent.refineProjectIdea(project.original_idea, stateData),
                20000,
                'refinamento da IA'
            );

            debugLogger.logSuccess('AI_REFINEMENT_COMPLETE', {
                status: refinementResult.status,
                hasName: !!refinementResult.name,
                hasObjective: !!refinementResult.objective
            });

            // Processar resultado
            if (refinementResult.status === 'rejected') {
                debugLogger.logStep('REFINEMENT_REJECTED', {
                    reason: refinementResult.rejection_reason
                }, 'WARNING');
                
                await this.projectRepository.update(projectId, {
                    status: PROJECT_STATUS.REJECTED,
                    rejection_reason: refinementResult.rejection_reason,
                    refinement_attempts: project.refinement_attempts + 1,
                    processing_logs: [
                        ...project.processing_logs,
                        {
                            timestamp: new Date(),
                            message: `Projeto rejeitado no refinamento: ${refinementResult.rejection_reason}`,
                            type: 'rejection'
                        }
                    ]
                });
                
                debugLogger.logSuccess('REJECTION_SAVED', { projectId });
                return;
            }

            // Atualizar com projeto refinado
            debugLogger.logStep('REFINEMENT_UPDATE_START', {}, 'START');
            
            await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.REFINED,
                refined_project: refinementResult,
                refinement_attempts: project.refinement_attempts + 1,
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: 'Projeto refinado com sucesso pelo Agente 1',
                        type: 'success'
                    }
                ]
            });

            debugLogger.logSuccess('REFINEMENT_UPDATE_COMPLETE', { projectId });

            // Continuar para análise
            debugLogger.logStep('ANALYSIS_CHAIN_START', {}, 'START');
            await this.processProjectAnalysis(projectId, stateData);

        } catch (error) {
            console.error(`❌ [SERVICE] Erro no refinamento do projeto ${projectId}:`, {
                message: error.message,
                stack: error.stack
            });
            debugLogger.logError('REFINEMENT_ERROR', error, { projectId });
            throw error;
        }
    }

    // Manter outros métodos inalterados mas simples...
    async processProjectAnalysis(projectId, stateData) {
        try {
            debugLogger.logStep('ANALYSIS_START', { projectId }, 'START');
            
            const project = await this.projectRepository.findById(projectId);
            if (!project || !project.refined_project) {
                throw new Error('Projeto refinado não encontrado');
            }

            debugLogger.logSuccess('PROJECT_FETCH_FOR_ANALYSIS_COMPLETE', {
                hasRefinedProject: !!project.refined_project,
                projectName: project.refined_project?.name
            });

            const analysisResult = await TimeoutHelper.withTimeout(
                this.analysisAgent.analyzeProject(project.refined_project, stateData),
                25000,
                'análise da IA'
            );

            debugLogger.logSuccess('AI_ANALYSIS_COMPLETE', {
                hasCost: !!analysisResult.implementation_cost,
                hasMethod: !!analysisResult.execution_method,
                hasDuration: !!analysisResult.estimated_duration_months
            });

            await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.PENDING_APPROVAL,
                analysis_data: analysisResult,
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: 'Projeto analisado com sucesso pelo Agente 2',
                        type: 'success'
                    }
                ]
            });

            debugLogger.logSuccess('ANALYSIS_UPDATE_COMPLETE', {
                projectId,
                newStatus: PROJECT_STATUS.PENDING_APPROVAL
            });

        } catch (error) {
            console.error(`❌ [SERVICE] Erro na análise do projeto ${projectId}:`, error);
            debugLogger.logError('ANALYSIS_ERROR', error, { projectId });
            throw error;
        }
    }

    // Outros métodos básicos...
    async getUserProjects(userId, options) {
        try {
            const projects = await this.projectRepository.findByUserId(userId, options);
            return {
                projects: projects.map(project => project.toObject()),
                total: projects.length
            };
        } catch (error) {
            console.error('❌ Erro ao buscar projetos do usuário:', error);
            throw new Error(`Falha ao buscar projetos: ${error.message}`);
        }
    }

    async getProjectById(userId, projectId) {
        try {
            const project = await this.projectRepository.findById(projectId);
            
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            if (project.user_id !== userId) {
                throw new Error('Usuário não autorizado a acessar este projeto');
            }

            return {
                project: project.toObject()
            };
        } catch (error) {
            console.error('❌ Erro ao buscar projeto:', error);
            throw error;
        }
    }

    async getPendingProjects(userId) {
        try {
            const projects = await this.projectRepository.findPendingByUserId(userId);
            return projects.map(project => project.toObject());
        } catch (error) {
            console.error('❌ Erro ao buscar projetos pendentes:', error);
            throw new Error(`Falha ao buscar projetos pendentes: ${error.message}`);
        }
    }

    async checkSystemStatus() {
        try {
            console.log('🔍 Verificando status do sistema de IA...');

            const aiStatus = await TimeoutHelper.withTimeout(
                this.llmProvider.testConnection(),
                5000,
                'teste de conexão com IA'
            );

            const projectStats = await this.projectRepository.getProjectStatistics();

            return {
                ai_provider: {
                    status: aiStatus ? 'online' : 'offline',
                    provider: 'Groq',
                    last_check: new Date()
                },
                project_statistics: projectStats,
                system_health: aiStatus ? 'healthy' : 'degraded'
            };

        } catch (error) {
            console.error('❌ Erro ao verificar status do sistema:', error);
            return {
                ai_provider: {
                    status: 'error',
                    provider: 'Groq',
                    error: error.message,
                    last_check: new Date()
                },
                system_health: 'error'
            };
        }
    }

    // Implementações básicas dos outros métodos...
    async approveProject(userId, projectId) {
        try {
            const project = await this.projectRepository.findById(projectId);
            if (!project) throw new Error('Projeto não encontrado');
            if (project.user_id !== userId) throw new Error('Usuário não autorizado');
            if (project.status !== PROJECT_STATUS.PENDING_APPROVAL) throw new Error('Projeto não está pendente de aprovação');

            const updatedProject = await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.APPROVED,
                approved_at: new Date(),
                processing_logs: [...project.processing_logs, {
                    timestamp: new Date(),
                    message: 'Projeto aprovado pelo governador',
                    type: 'approval'
                }]
            });

            return {
                success: true,
                project: updatedProject.toObject(),
                message: 'Projeto aprovado com sucesso'
            };
        } catch (error) {
            console.error('❌ Erro ao aprovar projeto:', error);
            throw error;
        }
    }

    async rejectProject(userId, projectId, reason) {
        try {
            const project = await this.projectRepository.findById(projectId);
            if (!project) throw new Error('Projeto não encontrado');
            if (project.user_id !== userId) throw new Error('Usuário não autorizado');
            if (project.status !== PROJECT_STATUS.PENDING_APPROVAL) throw new Error('Projeto não está pendente de aprovação');

            const updatedProject = await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.REJECTED,
                rejection_reason: reason,
                processing_logs: [...project.processing_logs, {
                    timestamp: new Date(),
                    message: `Projeto rejeitado pelo governador: ${reason}`,
                    type: 'rejection'
                }]
            });

            return {
                success: true,
                project: updatedProject.toObject(),
                message: 'Projeto rejeitado'
            };
        } catch (error) {
            console.error('❌ Erro ao rejeitar projeto:', error);
            throw new Error(`Falha ao rejeitar projeto: ${error.message}`);
        }
    }

    async cancelProject(userId, projectId, reason) {
        try {
            const project = await this.projectRepository.findById(projectId);
            if (!project) throw new Error('Projeto não encontrado');
            if (project.user_id !== userId) throw new Error('Usuário não autorizado');

            const cancelableStatuses = [PROJECT_STATUS.DRAFT, PROJECT_STATUS.REFINED, PROJECT_STATUS.PENDING_APPROVAL, PROJECT_STATUS.APPROVED];
            if (!cancelableStatuses.includes(project.status)) throw new Error('Projeto não pode ser cancelado no status atual');

            const updatedProject = await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.CANCELLED,
                cancellation_reason: reason,
                cancelled_at: new Date(),
                processing_logs: [...project.processing_logs, {
                    timestamp: new Date(),
                    message: `Projeto cancelado: ${reason}`,
                    type: 'cancellation'
                }]
            });

            return {
                success: true,
                project: updatedProject.toObject(),
                message: 'Projeto cancelado com sucesso'
            };
        } catch (error) {
            console.error('❌ Erro ao cancelar projeto:', error);
            throw error;
        }
    }

    async searchProjects(userId, searchParams) {
        try {
            const results = await this.projectRepository.searchProjects(userId, searchParams);
            return {
                projects: results.projects.map(project => project.toObject()),
                total: results.total,
                page: searchParams.page || 1,
                limit: searchParams.limit || 20
            };
        } catch (error) {
            console.error('❌ Erro na busca de projetos:', error);
            throw new Error(`Falha na busca: ${error.message}`);
        }
    }
}

module.exports = GovernmentProjectService;