const GovernmentProjectRepository = require('../../domain/repositories/government-project-repository');
const StateRepository = require('../../domain/repositories/state-repository');
const GovernmentProjectEntity = require('../../domain/entities/government-project-entity');
const ProjectRefinementAgentService = require('./project-refinement-agent-service');
const ProjectAnalysisAgentService = require('./project-analysis-agent-service');
const ProjectPopulationAgentService = require('./project-population-agent-service');
const ProjectExecutionService = require('./project-execution-service');
const GroqProvider = require('../../infrastructure/ai/groq-provider');
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
    }

    /**
     * Criar nova ideia de projeto (Etapa 1)
     * @param {string} userId - ID do usuário
     * @param {string} originalIdea - Ideia original do jogador
     * @returns {Promise<Object>} - Projeto criado ou erro
     */
    async createProjectIdea(userId, originalIdea) {
        try {
            console.log(`🚀 Criando projeto para usuário ${userId}...`);

            // Verificar se usuário pode criar projeto
            const canCreate = await this.projectRepository.canUserCreateProject(userId);
            if (!canCreate.canCreate) {
                return {
                    success: false,
                    error: canCreate.reason,
                    details: canCreate
                };
            }

            // Buscar dados do estado
            const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
            if (!stateData) {
                throw new Error('Dados do estado não encontrados');
            }

            // Criar entidade do projeto
            const projectEntity = new GovernmentProjectEntity({
                user_id: userId,
                state_id: stateData.state_info.id,
                original_idea: originalIdea.trim(),
                status: PROJECT_STATUS.DRAFT
            });

            // Salvar projeto inicial
            const savedProject = await this.projectRepository.create(projectEntity);
            console.log(`✅ Projeto criado com ID: ${savedProject.id}`);

            // Iniciar refinamento (processo assíncrono)
            this.processProjectRefinement(savedProject.id, stateData)
                .catch(error => {
                    console.error(`❌ Erro no refinamento do projeto ${savedProject.id}:`, error);
                });

            return {
                success: true,
                project: savedProject.toObject(),
                message: 'Projeto criado e sendo processado pelos agentes de IA'
            };

        } catch (error) {
            console.error('❌ Erro ao criar projeto:', error);
            throw new Error(`Falha ao criar projeto: ${error.message}`);
        }
    }

    /**
     * Processar refinamento do projeto (Etapa 2 - Agente 1)
     * @param {number} projectId - ID do projeto
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<void>}
     */
    async processProjectRefinement(projectId, stateData) {
        try {
            console.log(`🔧 Iniciando refinamento do projeto ${projectId}...`);

            // Buscar projeto
            const project = await this.projectRepository.findById(projectId);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Executar refinamento
            const refinementResult = await this.refinementAgent.refineProjectIdea(
                project.original_idea,
                stateData
            );

            // Atualizar projeto com resultado
            if (refinementResult.status === 'rejected') {
                await this.projectRepository.update(projectId, {
                    status: PROJECT_STATUS.REJECTED,
                    rejection_reason: refinementResult.rejection_reason,
                    refinement_attempts: project.refinement_attempts + 1,
                    processing_logs: [
                        ...project.processing_logs,
                        {
                            timestamp: new Date(),
                            message: `Projeto rejeitado: ${refinementResult.rejection_reason}`
                        }
                    ]
                });

                console.log(`❌ Projeto ${projectId} rejeitado: ${refinementResult.rejection_reason}`);
                return;
            }

            // Projeto aprovado no refinamento
            const updatedProject = await this.projectRepository.update(projectId, {
                refined_project: {
                    name: refinementResult.name,
                    objective: refinementResult.objective,
                    description: refinementResult.description,
                    justification: refinementResult.justification,
                    target_population: refinementResult.target_population,
                    expected_impacts: refinementResult.expected_impacts,
                    project_type: refinementResult.project_type,
                    refined_at: new Date()
                },
                refinement_attempts: project.refinement_attempts + 1,
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: 'Projeto refinado com sucesso pelo Agente 1'
                    }
                ]
            });

            console.log(`✅ Projeto ${projectId} refinado com sucesso`);

            // Iniciar análise (Etapa 3 - Agente 2)
            this.processProjectAnalysis(projectId, stateData)
                .catch(error => {
                    console.error(`❌ Erro na análise do projeto ${projectId}:`, error);
                });

        } catch (error) {
            console.error(`❌ Erro no refinamento do projeto ${projectId}:`, error);
            
            // Marcar projeto como erro
            await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.REJECTED,
                rejection_reason: `Erro no processamento: ${error.message}`,
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: `Erro no refinamento: ${error.message}`
                    }
                ]
            });
        }
    }

    /**
     * Processar análise do projeto (Etapa 3 - Agente 2)
     * @param {number} projectId - ID do projeto
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<void>}
     */
    async processProjectAnalysis(projectId, stateData) {
        try {
            console.log(`📊 Iniciando análise do projeto ${projectId}...`);

            // Buscar projeto atualizado
            const project = await this.projectRepository.findById(projectId);
            if (!project || !project.refined_project) {
                throw new Error('Projeto ou dados refinados não encontrados');
            }

            // Executar análise
            const analysisResult = await this.analysisAgent.analyzeProject(
                project.refined_project,
                stateData
            );

            // Atualizar projeto com análise
            const updatedProject = await this.projectRepository.update(projectId, {
                analysis_data: {
                    implementation_cost: analysisResult.implementation_cost,
                    execution_method: analysisResult.execution_method,
                    installments_config: analysisResult.installments_config,
                    estimated_duration_months: analysisResult.estimated_duration_months,
                    technical_feasibility: analysisResult.technical_feasibility,
                    required_resources: analysisResult.required_resources,
                    potential_risks: analysisResult.potential_risks,
                    economic_return_projection: analysisResult.economic_return_projection,
                    social_impact_projection: analysisResult.social_impact_projection,
                    analyzed_at: new Date()
                },
                status: PROJECT_STATUS.PENDING_APPROVAL,
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: 'Análise técnica concluída pelo Agente 2'
                    }
                ]
            });

            console.log(`✅ Projeto ${projectId} analisado e pronto para aprovação`);

        } catch (error) {
            console.error(`❌ Erro na análise do projeto ${projectId}:`, error);
            
            await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.REJECTED,
                rejection_reason: `Erro na análise: ${error.message}`,
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: `Erro na análise: ${error.message}`
                    }
                ]
            });
        }
    }

    /**
     * Aprovar projeto (Etapa 4 - Decisão do Governador)
     * @param {string} userId - ID do usuário
     * @param {number} projectId - ID do projeto
     * @returns {Promise<Object>} - Resultado da aprovação
     */
    async approveProject(userId, projectId) {
        try {
            console.log(`✅ Aprovando projeto ${projectId} pelo usuário ${userId}...`);

            // Buscar projeto
            const project = await this.projectRepository.findById(projectId);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Verificar permissão
            if (project.user_id !== userId) {
                throw new Error('Usuário não autorizado a aprovar este projeto');
            }

            // Verificar status
            if (project.status !== PROJECT_STATUS.PENDING_APPROVAL) {
                throw new Error('Projeto não está pendente de aprovação');
            }

            // Verificar se tem dados necessários
            if (!project.refined_project || !project.analysis_data) {
                throw new Error('Projeto não possui dados completos para aprovação');
            }

            // Buscar dados atuais do estado
            const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
            if (!stateData) {
                throw new Error('Dados do estado não encontrados');
            }

            // Verificar se o estado tem recursos suficientes
            const cost = project.analysis_data.implementation_cost;
            if (project.analysis_data.execution_method === EXECUTION_METHODS.IMMEDIATE) {
                if (stateData.economy.treasury_balance < cost) {
                    return {
                        success: false,
                        error: 'Recursos insuficientes no tesouro',
                        required: cost,
                        available: stateData.economy.treasury_balance
                    };
                }
            }

            // Aprovar projeto
            const updatedProject = await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.APPROVED,
                approved_at: new Date(),
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: 'Projeto aprovado pelo governador'
                    }
                ]
            });

            console.log(`✅ Projeto ${projectId} aprovado com sucesso`);

            // Iniciar execução (processo assíncrono)
            this.startProjectExecution(projectId, stateData)
                .catch(error => {
                    console.error(`❌ Erro ao iniciar execução do projeto ${projectId}:`, error);
                });

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
     * Rejeitar projeto
     * @param {string} userId - ID do usuário
     * @param {number} projectId - ID do projeto
     * @param {string} reason - Motivo da rejeição
     * @returns {Promise<Object>} - Resultado da rejeição
     */
    async rejectProject(userId, projectId, reason) {
        try {
            console.log(`❌ Rejeitando projeto ${projectId}...`);

            // Buscar projeto
            const project = await this.projectRepository.findById(projectId);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Verificar permissão
            if (project.user_id !== userId) {
                throw new Error('Usuário não autorizado a rejeitar este projeto');
            }

            // Verificar status
            if (project.status !== PROJECT_STATUS.PENDING_APPROVAL) {
                throw new Error('Projeto não está pendente de aprovação');
            }

            // Rejeitar projeto
            const updatedProject = await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.REJECTED,
                rejection_reason: reason || 'Rejeitado pelo governador',
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: `Projeto rejeitado pelo governador: ${reason}`
                    }
                ]
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

    /**
     * Iniciar execução do projeto (Etapa 5)
     * @param {number} projectId - ID do projeto
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<void>}
     */
    async startProjectExecution(projectId, stateData) {
        try {
            console.log(`🚀 Iniciando execução do projeto ${projectId}...`);

            // Buscar projeto aprovado
            const project = await this.projectRepository.findById(projectId);
            if (!project || project.status !== PROJECT_STATUS.APPROVED) {
                throw new Error('Projeto não está aprovado');
            }

            // Debitar custo inicial ou configurar parcelamento
            const cost = project.analysis_data.implementation_cost;
            const executionMethod = project.analysis_data.execution_method;

            if (executionMethod === EXECUTION_METHODS.IMMEDIATE) {
                // Pagamento à vista
                await this.stateRepository.updateEconomicData(project.user_id, {
                    treasury_balance_change: -cost
                });

                console.log(`💰 Debitado R$ ${cost.toLocaleString()} do tesouro`);
            } else {
                // Configurar parcelamento
                await this.executionService.scheduleInstallments(projectId, project.analysis_data.installments_config);
                console.log(`📅 Parcelamento configurado para ${project.analysis_data.installments_config.number_of_installments} parcelas`);
            }

            // Calcular data de conclusão
            const estimatedCompletion = new Date();
            estimatedCompletion.setMonth(
                estimatedCompletion.getMonth() + project.analysis_data.estimated_duration_months
            );

            // Agendar efeitos do projeto
            await this.executionService.scheduleProjectEffects(projectId, estimatedCompletion);

            // Atualizar projeto para execução
            const updatedProject = await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.IN_EXECUTION,
                started_at: new Date(),
                estimated_completion: estimatedCompletion,
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: 'Execução do projeto iniciada'
                    }
                ]
            });

            console.log(`✅ Execução do projeto ${projectId} iniciada`);

            // Gerar reação da população (Etapa 6 - Agente 3)
            this.generatePopulationReaction(projectId, stateData)
                .catch(error => {
                    console.error(`❌ Erro na reação popular do projeto ${projectId}:`, error);
                });

        } catch (error) {
            console.error(`❌ Erro ao iniciar execução do projeto ${projectId}:`, error);
            
            // Marcar projeto como erro
            await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.REJECTED,
                rejection_reason: `Erro na execução: ${error.message}`,
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: `Erro na execução: ${error.message}`
                    }
                ]
            });
        }
    }

    /**
     * Gerar reação da população (Etapa 6 - Agente 3)
     * @param {number} projectId - ID do projeto
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<void>}
     */
    async generatePopulationReaction(projectId, stateData) {
        try {
            console.log(`👥 Gerando reação popular para projeto ${projectId}...`);

            // Buscar projeto em execução
            const project = await this.projectRepository.findById(projectId);
            if (!project || project.status !== PROJECT_STATUS.IN_EXECUTION) {
                throw new Error('Projeto não está em execução');
            }

            // Gerar reação
            const reactionResult = await this.populationAgent.generatePopulationReaction(
                project,
                stateData
            );

            // Aplicar impacto na aprovação
            if (reactionResult.approval_impact !== 0) {
                await this.stateRepository.updateGovernanceData(project.user_id, {
                    approval_rating_change: reactionResult.approval_impact
                });

                console.log(`📊 Aprovação alterada em ${reactionResult.approval_impact > 0 ? '+' : ''}${reactionResult.approval_impact} pontos`);
            }

            // Salvar reação no projeto
            await this.projectRepository.update(projectId, {
                population_reaction: {
                    public_opinion: reactionResult.public_opinion,
                    sector_reactions: reactionResult.sector_reactions,
                    approval_impact: reactionResult.approval_impact,
                    protest_level: reactionResult.protest_level,
                    media_coverage: reactionResult.media_coverage,
                    generated_at: new Date()
                },
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: `Reação popular gerada: ${reactionResult.approval_impact > 0 ? 'positiva' : 'negativa'} (${reactionResult.approval_impact} pontos)`
                    }
                ]
            });

            console.log(`✅ Reação popular registrada para projeto ${projectId}`);

        } catch (error) {
            console.error(`❌ Erro na reação popular do projeto ${projectId}:`, error);
        }
    }

    /**
     * Cancelar projeto
     * @param {string} userId - ID do usuário
     * @param {number} projectId - ID do projeto
     * @param {string} reason - Motivo do cancelamento
     * @returns {Promise<Object>} - Resultado do cancelamento
     */
    async cancelProject(userId, projectId, reason) {
        try {
            console.log(`🚫 Cancelando projeto ${projectId}...`);

            // Buscar projeto
            const project = await this.projectRepository.findById(projectId);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Verificar permissão
            if (project.user_id !== userId) {
                throw new Error('Usuário não autorizado a cancelar este projeto');
            }

            // Verificar se pode ser cancelado
            if ([PROJECT_STATUS.COMPLETED, PROJECT_STATUS.CANCELLED].includes(project.status)) {
                throw new Error('Projeto não pode ser cancelado');
            }

            // Cancelar execuções agendadas
            if (project.status === PROJECT_STATUS.IN_EXECUTION) {
                await this.executionService.cancelProjectExecutions(projectId);
            }

            // Atualizar projeto
            const updatedProject = await this.projectRepository.update(projectId, {
                status: PROJECT_STATUS.CANCELLED,
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: `Projeto cancelado: ${reason}`
                    }
                ]
            });

            // Gerar reação negativa da população se estava em execução
            if (project.status === PROJECT_STATUS.IN_EXECUTION) {
                const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
                if (stateData) {
                    const cancellationReaction = await this.populationAgent.generateCancellationReaction(
                        project,
                        reason,
                        stateData
                    );

                    // Aplicar impacto negativo
                    if (cancellationReaction.approval_impact !== 0) {
                        await this.stateRepository.updateGovernanceData(userId, {
                            approval_rating_change: cancellationReaction.approval_impact
                        });
                    }

                    // Salvar reação
                    await this.projectRepository.update(projectId, {
                        population_reaction: cancellationReaction
                    });
                }
            }

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
     * Listar projetos do usuário
     * @param {string} userId - ID do usuário
     * @param {Object} options - Opções de listagem
     * @returns {Promise<Object>} - Lista de projetos
     */
    async getUserProjects(userId, options = {}) {
        try {
            const projects = await this.projectRepository.findByUserId(userId, options);
            const stats = await this.projectRepository.getUserProjectStats(userId);

            return {
                projects: projects.map(project => project.toObject()),
                stats,
                total: projects.length
            };
        } catch (error) {
            console.error('❌ Erro ao listar projetos:', error);
            throw new Error(`Falha ao listar projetos: ${error.message}`);
        }
    }

    /**
     * Obter projeto específico
     * @param {string} userId - ID do usuário
     * @param {number} projectId - ID do projeto
     * @returns {Promise<Object>} - Dados do projeto
     */
    async getProjectById(userId, projectId) {
        try {
            const project = await this.projectRepository.findById(projectId);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Verificar permissão
            if (project.user_id !== userId) {
                throw new Error('Usuário não autorizado a visualizar este projeto');
            }

            return {
                success: true,
                project: project.toObject()
            };
        } catch (error) {
            console.error('❌ Erro ao buscar projeto:', error);
            throw new Error(`Falha ao buscar projeto: ${error.message}`);
        }
    }

    /**
     * Obter projetos pendentes de aprovação
     * @param {string} userId - ID do usuário
     * @returns {Promise<Array>} - Projetos pendentes
     */
    async getPendingProjects(userId) {
        try {
            const pendingProjects = await this.projectRepository.findPendingApprovalByUserId(userId);
            return pendingProjects.map(project => project.toObject());
        } catch (error) {
            console.error('❌ Erro ao buscar projetos pendentes:', error);
            throw new Error(`Falha ao buscar projetos pendentes: ${error.message}`);
        }
    }

    /**
     * Verificar status do sistema de IA
     * @returns {Promise<Object>} - Status dos agentes
     */
    async checkSystemStatus() {
        try {
            const isLLMAvailable = await this.llmProvider.isAvailable();
            
            return {
                llm_provider_available: isLLMAvailable,
                model_info: this.llmProvider.getModelInfo(),
                agents_status: {
                    refinement_agent: await this.refinementAgent.isAvailable(),
                    analysis_agent: await this.analysisAgent.isAvailable(),
                    population_agent: await this.populationAgent.isAvailable()
                },
                system_ready: isLLMAvailable,
                last_check: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Erro ao verificar status do sistema:', error);
            return {
                llm_provider_available: false,
                model_info: null,
                agents_status: {
                    refinement_agent: false,
                    analysis_agent: false,
                    population_agent: false
                },
                system_ready: false,
                error: error.message,
                last_check: new Date().toISOString()
            };
        }
    }
}

module.exports = GovernmentProjectService;