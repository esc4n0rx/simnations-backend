const GovernmentProjectEntity = require('../../domain/entities/government-project-entity');
const GovernmentProjectRepository = require('../../domain/repositories/government-project-repository');
const StateRepository = require('../../domain/repositories/state-repository');
const ProjectRefinementService = require('./project-refinement-agent-service');
const ProjectAnalysisService = require('./project-analysis-agent-service');
const ProjectPopulationAgentService = require('./project-population-agent-service');
const ProjectExecutionService = require('./project-execution-service');
const GroqProvider= require('../../infrastructure/ai/groq-provider');
const { PROJECT_STATUS } = require('../../shared/constants/government-project-constants');
const { DebugLogger, TimeoutHelper } = require('../../shared/utils/project-debug-logger');

class GovernmentProjectService {
    constructor() {
        this.projectRepository = new GovernmentProjectRepository();
        this.stateRepository = new StateRepository();
        this.llmProvider = new GroqProvider();
        this.refinementService = new ProjectRefinementService(this.llmProvider);
        this.analysisService = new ProjectAnalysisService(this.llmProvider);
        this.populationService = new ProjectPopulationAgentService(this.llmProvider);
        this.executionService = new ProjectExecutionService();
        
        this.debugLogger = new DebugLogger('GOVERNMENT_PROJECT_SERVICE');
    }

    /**
     * Criar novo projeto
     * @param {string} userId - ID do usuário
     * @param {string} originalIdea - Ideia original do projeto
     * @returns {Promise<Object>}
     */
    async createProject(userId, originalIdea) {
        const debugLogger = new DebugLogger('CREATE_PROJECT');
        
        try {
            debugLogger.logStep('START', { userId, ideaLength: originalIdea.length }, 'START');

            // Validar entrada
            if (!originalIdea || originalIdea.trim().length < 10) {
                throw new Error('A ideia do projeto deve ter pelo menos 10 caracteres');
            }

            // Obter dados do usuário e estado
            const userData = await this.stateRepository.getUserById(userId);
            if (!userData) {
                throw new Error('Usuário não encontrado');
            }

            const stateData = await this.stateRepository.getStateByUserId(userId);
            if (!stateData) {
                throw new Error('Estado do usuário não encontrado');
            }

            debugLogger.logStep('DATA_LOADED', {
                userExists: !!userData,
                stateExists: !!stateData,
                stateId: stateData.state_info?.id
            });

            // Criar entidade do projeto
            const projectData = {
                user_id: userId,
                state_id: stateData.state_info.id,
                original_idea: originalIdea.trim(),
                status: PROJECT_STATUS.DRAFT
            };

            const project = new GovernmentProjectEntity(projectData);
            debugLogger.logStep('ENTITY_CREATED', { projectId: 'pending' });

            // Salvar projeto no banco
            const savedProject = await this.projectRepository.create(project);
            debugLogger.logStep('PROJECT_SAVED', { projectId: savedProject.id });

            // Processar em background (sem await para não bloquear response)
            this.processProjectRefinementSafely(savedProject.id, stateData)
                .catch(error => {
                    console.error(`❌ [BACKGROUND] Erro no processamento assíncrono do projeto ${savedProject.id}:`, error);
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
     * Aprovar projeto
     * @param {string} projectId - ID do projeto
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>}
     */
    async approveProject(projectId, userId) {
        try {
            console.log(`📋 Aprovando projeto ${projectId}...`);

            // Buscar projeto
            const project = await this.projectRepository.findById(projectId);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Verificar se pode ser aprovado
            if (!project.canBeApproved()) {
                throw new Error('Projeto não pode ser aprovado no estado atual');
            }

            // Obter dados do estado para processos
            const stateData = await this.stateRepository.getStateByUserId(userId);
            if (!stateData) {
                throw new Error('Estado do usuário não encontrado');
            }

            // Aprovar projeto
            project.approve();
            
            // [CORRIGIDO] Iniciar execução do projeto
            project.start();
            
            // Salvar mudanças
            const updatedProject = await this.projectRepository.update(projectId, project);
            
            // [CORRIGIDO] Gerar reação da população em background
            this.generatePopulationReactionSafely(updatedProject, stateData)
                .catch(error => {
                    console.error(`❌ [BACKGROUND] Erro ao gerar reação da população para projeto ${projectId}:`, error);
                });

            // [CORRIGIDO] Agendar execuções do projeto
            await this.scheduleProjectExecutions(updatedProject);

            console.log(`✅ Projeto ${projectId} aprovado com sucesso`);

            return {
                success: true,
                project: updatedProject.toObject(),
                message: 'Projeto aprovado e execução iniciada'
            };

        } catch (error) {
            console.error('❌ Erro ao aprovar projeto:', error);
            throw new Error(`Falha ao aprovar projeto: ${error.message}`);
        }
    }

    /**
     * [NOVO] Gerar reação da população de forma segura
     * @param {GovernmentProjectEntity} project - Projeto aprovado
     * @param {Object} stateData - Dados do estado
     */
    async generatePopulationReactionSafely(project, stateData) {
        try {
            console.log(`👥 Gerando reação da população para projeto ${project.id}...`);

            const populationReaction = await this.populationService.generatePopulationReaction(
                project.toObject(),
                stateData
            );

            // Atualizar projeto com a reação
            project.setPopulationReaction(populationReaction);
            
            // Salvar no banco
            await this.projectRepository.update(project.id, project);
            
            console.log(`✅ Reação da população gerada para projeto ${project.id}`);

        } catch (error) {
            console.error(`❌ Erro ao gerar reação da população para projeto ${project.id}:`, error);
            // Não interromper o fluxo principal, apenas logar o erro
        }
    }

    /**
     * [NOVO] Agendar execuções do projeto
     * @param {GovernmentProjectEntity} project - Projeto aprovado
     */
    async scheduleProjectExecutions(project) {
        try {
            console.log(`📅 Agendando execuções para projeto ${project.id}...`);

            const projectData = project.toObject();

            // Agendar parcelas se configurado
            if (projectData.analysis_data?.execution_method === 'installments' && 
                projectData.analysis_data?.installments_config) {
                
                await this.executionService.scheduleInstallments(
                    project.id,
                    projectData.analysis_data.installments_config
                );
            }

            // Agendar efeitos do projeto
            await this.executionService.scheduleEffects(project.id, projectData);

            // Agendar conclusão do projeto
            await this.executionService.scheduleCompletion(project.id, projectData);

            console.log(`✅ Execuções agendadas para projeto ${project.id}`);

        } catch (error) {
            console.error(`❌ Erro ao agendar execuções para projeto ${project.id}:`, error);
            // Não interromper o fluxo principal
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

            // Marcar projeto como rejeitado por falha técnica
            try {
                await this.projectRepository.update(projectId, {
                    status: PROJECT_STATUS.REJECTED,
                    rejection_reason: `Falha técnica no processamento: ${error.message}`,
                    processing_logs: [{
                        timestamp: new Date(),
                        message: `Erro crítico no refinamento: ${error.message}`
                    }]
                });
            } catch (updateError) {
                console.error(`❌ [SERVICE] Falha ao atualizar status do projeto ${projectId}:`, updateError);
            }
        }
    }

    /**
     * Processar refinamento e análise do projeto
     */
    async processProjectRefinement(projectId, stateData) {
        const debugLogger = new DebugLogger('PROCESS_REFINEMENT');
        
        try {
            debugLogger.logStep('START', { projectId }, 'START');

            // Buscar projeto
            const project = await this.projectRepository.findById(projectId);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            debugLogger.logStep('PROJECT_LOADED', { 
                projectId, 
                status: project.status,
                originalIdeaLength: project.original_idea?.length 
            });

            // Executar refinamento (Agente 1)
            debugLogger.logStep('REFINEMENT_START', { projectId });
            const refinedProject = await TimeoutHelper.withTimeout(
                () => this.refinementService.refineProject(project.original_idea, stateData),
                30000 // 30 segundos
            );

            // Atualizar projeto com dados refinados
            project.setRefinedProject(refinedProject);
            await this.projectRepository.update(projectId, project);
            
            debugLogger.logStep('REFINEMENT_COMPLETE', { 
                projectId,
                refinedName: refinedProject.name
            });

            // Executar análise (Agente 2)
            debugLogger.logStep('ANALYSIS_START', { projectId });
            const analysisData = await TimeoutHelper.withTimeout(
                () => this.analysisService.analyzeProject(project.toObject(), stateData),
                30000 // 30 segundos
            );

            // Atualizar projeto com dados de análise
            project.setAnalysisData(analysisData);
            project.status = PROJECT_STATUS.PENDING_APPROVAL;
            
            const finalProject = await this.projectRepository.update(projectId, project);
            
            debugLogger.logStep('ANALYSIS_COMPLETE', { 
                projectId,
                implementationCost: analysisData.implementation_cost,
                technicalFeasibility: analysisData.technical_feasibility
            });

            debugLogger.logSuccess('PROCESS_COMPLETE', { 
                projectId,
                status: finalProject.status
            });

            return finalProject;

        } catch (error) {
            debugLogger.logError('PROCESS_ERROR', error, { projectId });
            throw error;
        }
    }

    /**
     * Listar projetos do usuário
     * @param {string} userId - ID do usuário
     * @param {Object} filters - Filtros opcionais
     * @returns {Promise<Object>}
     */
    async getUserProjects(userId, filters = {}) {
        try {
            const projects = await this.projectRepository.findByUserId(userId, filters);
            
            return {
                success: true,
                data: {
                    projects: projects.map(project => project.toObject()),
                    total: projects.length
                }
            };

        } catch (error) {
            console.error('❌ Erro ao buscar projetos do usuário:', error);
            throw new Error(`Falha ao buscar projetos: ${error.message}`);
        }
    }

    /**
     * Buscar projeto por ID
     * @param {string} projectId - ID do projeto
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>}
     */
    async getProjectById(projectId, userId) {
        try {
            const project = await this.projectRepository.findById(projectId);
            
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Verificar se o projeto pertence ao usuário
            if (project.user_id !== userId) {
                throw new Error('Acesso negado ao projeto');
            }

            return {
                success: true,
                data: {
                    project: project.toObject()
                }
            };

        } catch (error) {
            console.error('❌ Erro ao buscar projeto:', error);
            throw new Error(`Falha ao buscar projeto: ${error.message}`);
        }
    }

    /**
     * Rejeitar projeto
     * @param {string} projectId - ID do projeto
     * @param {string} reason - Motivo da rejeição
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>}
     */
    async rejectProject(projectId, reason, userId) {
        try {
            console.log(`❌ Rejeitando projeto ${projectId}...`);

            const project = await this.projectRepository.findById(projectId);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            if (project.user_id !== userId) {
                throw new Error('Acesso negado ao projeto');
            }

            project.reject(reason);
            const updatedProject = await this.projectRepository.update(projectId, project);

            console.log(`✅ Projeto ${projectId} rejeitado`);

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

    /**
     * Cancelar projeto
     * @param {string} projectId - ID do projeto
     * @param {string} reason - Motivo do cancelamento
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>}
     */
    async cancelProject(projectId, reason, userId) {
        try {
            console.log(`🚫 Cancelando projeto ${projectId}...`);

            const project = await this.projectRepository.findById(projectId);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            if (project.user_id !== userId) {
                throw new Error('Acesso negado ao projeto');
            }

            project.cancel(reason);
            const updatedProject = await this.projectRepository.update(projectId, project);

            console.log(`✅ Projeto ${projectId} cancelado`);

            return {
                success: true,
                project: updatedProject.toObject(),
                message: 'Projeto cancelado'
            };

        } catch (error) {
            console.error('❌ Erro ao cancelar projeto:', error);
            throw new Error(`Falha ao cancelar projeto: ${error.message}`);
        }
    }

    /**
     * Obter estatísticas de execução (admin)
     * @returns {Promise<Object>}
     */
    async getExecutionStats() {
        try {
            return await this.executionService.getExecutionStats();
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw new Error(`Falha ao obter estatísticas: ${error.message}`);
        }
    }

    /**
     * Executar job manualmente (admin)
     * @returns {Promise<Object>}
     */
    async executeJobManually() {
        try {
            return await this.executionService.executeJobManually();
        } catch (error) {
            console.error('❌ Erro ao executar job:', error);
            throw new Error(`Falha ao executar job: ${error.message}`);
        }
    }

    /**
     * Obter execuções pendentes (admin)
     * @param {number} limit - Limite de resultados
     * @returns {Promise<Object>}
     */
    async getPendingExecutions(limit = 50) {
        try {
            const executions = await this.executionService.getPendingExecutions(limit);
            return {
                success: true,
                data: {
                    executions,
                    total: executions.length
                }
            };
        } catch (error) {
            console.error('❌ Erro ao buscar execuções pendentes:', error);
            throw new Error(`Falha ao buscar execuções: ${error.message}`);
        }
    }
}

module.exports = GovernmentProjectService;