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

            // Obter dados completos do estado do usuário
            const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
            if (!stateData) {
                throw new Error('Estado do usuário não encontrado');
            }

            debugLogger.logStep('DATA_LOADED', {
                stateExists: !!stateData,
                economyExists: !!stateData.economy,
                governanceExists: !!stateData.governance,
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

            // Verificar se o projeto pertence ao usuário
            if (project.user_id !== userId) {
                throw new Error('Acesso negado. Este projeto não pertence ao usuário');
            }

            // Verificar se o projeto está em status que pode ser aprovado
            if (project.status !== PROJECT_STATUS.PENDING_APPROVAL) {
                throw new Error('O projeto não está em status para aprovação');
            }

            // Obter dados do estado para processos
            const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
            if (!stateData) {
                throw new Error('Estado do usuário não encontrado');
            }

            // Atualizar status para aprovado
            project.status = PROJECT_STATUS.APPROVED;
            project.approved_at = new Date();
            
            const approvedProject = await this.projectRepository.update(projectId, project);

            // Gerar reação da população em background
            this.generatePopulationReactionSafely(approvedProject, stateData)
                .catch(error => {
                    console.error(`❌ [BACKGROUND] Erro ao gerar reação da população para projeto ${projectId}:`, error);
                });

            // Agendar execuções em background
            this.scheduleProjectExecutions(approvedProject)
                .catch(error => {
                    console.error(`❌ [BACKGROUND] Erro ao agendar execuções para projeto ${projectId}:`, error);
                });

            console.log(`✅ Projeto ${projectId} aprovado com sucesso`);

            return {
                success: true,
                project: approvedProject.toObject(),
                message: 'Projeto aprovado e agendado para execução'
            };

        } catch (error) {
            console.error('❌ Erro ao aprovar projeto:', error);
            throw new Error(`Falha ao aprovar projeto: ${error.message}`);
        }
    }

    /**
     * Gerar reação da população (em background)
     * @param {GovernmentProjectEntity} project - Projeto aprovado
     * @param {Object} stateData - Dados completos do estado
     */
    async generatePopulationReactionSafely(project, stateData) {
        try {
            console.log(`👥 Gerando reação da população para projeto ${project.id}...`);

            // Gerar reação da população usando o serviço
            const populationReaction = await this.populationService.generatePopulationReaction(
                project.toObject(),
                stateData
            );
            
            // Adicionar reação ao projeto
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
        const debugLogger = new DebugLogger('REFINEMENT_SAFE');
        
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
                () => this.refinementService.refineProjectIdea(project.original_idea, stateData), // <- CORRIGIDO: era refineProject
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
                throw new Error('Acesso negado. Este projeto não pertence ao usuário');
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
     * @param {string} userId - ID do usuário
     * @param {string} reason - Motivo da rejeição
     * @returns {Promise<Object>}
     */
    async rejectProject(projectId, userId, reason) {
        try {
            console.log(`❌ Rejeitando projeto ${projectId}...`);

            // Buscar projeto
            const project = await this.projectRepository.findById(projectId);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Verificar se o projeto pertence ao usuário
            if (project.user_id !== userId) {
                throw new Error('Acesso negado. Este projeto não pertence ao usuário');
            }

            // Verificar se o projeto está em status que pode ser rejeitado
            if (![PROJECT_STATUS.PENDING_APPROVAL, PROJECT_STATUS.DRAFT].includes(project.status)) {
                throw new Error('O projeto não está em status para rejeição');
            }

            // Atualizar status para rejeitado
            project.status = PROJECT_STATUS.REJECTED;
            project.rejection_reason = reason;
            project.rejected_at = new Date();
            
            const rejectedProject = await this.projectRepository.update(projectId, project);

            console.log(`✅ Projeto ${projectId} rejeitado com sucesso`);

            return {
                success: true,
                project: rejectedProject.toObject(),
                message: 'Projeto rejeitado'
            };

        } catch (error) {
            console.error('❌ Erro ao rejeitar projeto:', error);
            throw new Error(`Falha ao rejeitar projeto: ${error.message}`);
        }
    }
}

module.exports = GovernmentProjectService;