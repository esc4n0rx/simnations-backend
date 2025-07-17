const cron = require('node-cron');
const GovernmentProjectRepository = require('../../domain/repositories/government-project-repository');
const StateRepository = require('../../domain/repositories/state-repository');
const { PROJECT_STATUS } = require('../../shared/constants/government-project-constants');

class ProjectExecutionService {
    constructor() {
        this.projectRepository = new GovernmentProjectRepository();
        this.stateRepository = new StateRepository();
        this.ProjectExecution = require('../../infrastructure/database/models').ProjectExecution;
        
        // Iniciar job de execução (executa a cada hora)
        this.startExecutionJob();
    }

    /**
     * Agendar parcelas do projeto
     * @param {number} projectId - ID do projeto
     * @param {Object} installmentsConfig - Configuração das parcelas
     * @returns {Promise<void>}
     */
    async scheduleInstallments(projectId, installmentsConfig) {
        try {
            console.log(`📅 Agendando ${installmentsConfig.number_of_installments} parcelas para projeto ${projectId}...`);

            const executions = [];
            const currentDate = new Date();

            for (let i = 1; i <= installmentsConfig.number_of_installments; i++) {
                const scheduledDate = new Date(currentDate);
                scheduledDate.setMonth(scheduledDate.getMonth() + i);

                executions.push({
                    project_id: projectId,
                    execution_type: 'payment',
                    scheduled_for: scheduledDate,
                    payment_amount: installmentsConfig.installment_amount,
                    installment_number: i,
                    total_installments: installmentsConfig.number_of_installments,
                    status: 'pending'
                });
            }

            await this.ProjectExecution.bulkCreate(executions);
            console.log(`✅ ${executions.length} parcelas agendadas`);

        } catch (error) {
            console.error('❌ Erro ao agendar parcelas:', error);
            throw error;
        }
    }

    /**
     * Agendar efeitos do projeto
     * @param {number} projectId - ID do projeto
     * @param {Date} completionDate - Data de conclusão
     * @returns {Promise<void>}
     */
    async scheduleProjectEffects(projectId, completionDate) {
        try {
            console.log(`📅 Agendando efeitos para projeto ${projectId} em ${completionDate.toDateString()}...`);

            // Buscar dados do projeto
            const project = await this.projectRepository.findById(projectId);
            if (!project || !project.analysis_data) {
                throw new Error('Dados do projeto não encontrados');
            }

            const economicEffects = {
                revenue_increase_monthly: project.analysis_data.economic_return_projection.revenue_increase_monthly,
                cost_savings_monthly: project.analysis_data.economic_return_projection.cost_savings_monthly
            };

            const socialEffects = {
                employment_generation: project.analysis_data.social_impact_projection.employment_generation,
                quality_improvement: project.analysis_data.social_impact_projection.quality_of_life_improvement
            };

            // Agendar aplicação dos efeitos
            await this.ProjectExecution.create({
                project_id: projectId,
                execution_type: 'effect',
                scheduled_for: completionDate,
                economic_effects: economicEffects,
                social_effects: socialEffects,
                status: 'pending'
            });

            // Agendar finalização do projeto
            await this.ProjectExecution.create({
                project_id: projectId,
                execution_type: 'completion',
                scheduled_for: completionDate,
                status: 'pending'
            });

            console.log(`✅ Efeitos agendados para ${completionDate.toDateString()}`);

        } catch (error) {
            console.error('❌ Erro ao agendar efeitos:', error);
            throw error;
        }
    }

    /**
     * Cancelar execuções pendentes de um projeto
     * @param {number} projectId - ID do projeto
     * @returns {Promise<void>}
     */
    async cancelProjectExecutions(projectId) {
        try {
            console.log(`🚫 Cancelando execuções do projeto ${projectId}...`);

            const cancelledCount = await this.ProjectExecution.destroy({
                where: {
                    project_id: projectId,
                    status: 'pending'
                }
            });

            console.log(`✅ ${cancelledCount} execuções canceladas`);

        } catch (error) {
            console.error('❌ Erro ao cancelar execuções:', error);
            throw error;
        }
    }

    /**
     * Processar execuções pendentes
     * @returns {Promise<void>}
     */
    async processPendingExecutions() {
        try {
            console.log('🔄 Processando execuções pendentes...');

            const pendingExecutions = await this.ProjectExecution.findAll({
                where: {
                    status: 'pending',
                    scheduled_for: {
                        [require('sequelize').Op.lte]: new Date()
                    }
                },
                include: [
                    {
                        model: require('../../infrastructure/database/models').GovernmentProject,
                        as: 'project',
                        include: [
                            {
                                model: require('../../infrastructure/database/models').User,
                                as: 'user'
                            }
                        ]
                    }
                ]
            });

            console.log(`📋 Encontradas ${pendingExecutions.length} execuções pendentes`);

            for (const execution of pendingExecutions) {
                try {
                    await this.processExecution(execution);
                } catch (error) {
                    console.error(`❌ Erro ao processar execução ${execution.id}:`, error);
                    
                    // Marcar execução como falha
                    await execution.update({
                        status: 'failed',
                        error_message: error.message,
                        executed_at: new Date()
                    });
                }
            }

            console.log('✅ Processamento de execuções concluído');

        } catch (error) {
            console.error('❌ Erro no processamento de execuções:', error);
            throw error;
        }
    }

    /**
     * Processar uma execução específica
     * @param {Object} execution - Execução a ser processada
     * @returns {Promise<void>}
     */
    async processExecution(execution) {
        try {
            const { project } = execution;
            const userId = project.user_id;

            console.log(`⚡ Processando execução ${execution.execution_type} do projeto ${project.id}...`);

            switch (execution.execution_type) {
                case 'payment':
                    await this.processPayment(execution, userId);
                    break;

                case 'effect':
                    await this.processEffects(execution, userId);
                    break;

                case 'completion':
                    await this.processCompletion(execution, project);
                    break;

                default:
                    throw new Error(`Tipo de execução desconhecido: ${execution.execution_type}`);
            }

            // Marcar execução como concluída
            await execution.update({
                status: 'executed',
                executed_at: new Date()
            });

            console.log(`✅ Execução ${execution.id} processada com sucesso`);

        } catch (error) {
            console.error(`❌ Erro ao processar execução ${execution.id}:`, error);
            throw error;
        }
    }

    /**
     * Processar pagamento de parcela
     * @param {Object} execution - Execução de pagamento
     * @param {string} userId - ID do usuário
     * @returns {Promise<void>}
     */
    async processPayment(execution, userId) {
        try {
            const paymentAmount = parseFloat(execution.payment_amount);
            
            // Debitar do tesouro
            await this.stateRepository.updateEconomicData(userId, {
                treasury_balance_change: -paymentAmount
            });

            console.log(`💰 Parcela ${execution.installment_number}/${execution.total_installments} paga: R$ ${paymentAmount.toLocaleString()}`);

            // Atualizar log do projeto
            const project = await this.projectRepository.findById(execution.project_id);
            if (project) {
                await this.projectRepository.update(execution.project_id, {
                    processing_logs: [
                        ...project.processing_logs,
                        {
                            timestamp: new Date(),
                            message: `Parcela ${execution.installment_number}/${execution.total_installments} paga: R$ ${paymentAmount.toLocaleString()}`
                        }
                    ]
                });
            }

        } catch (error) {
            console.error('❌ Erro ao processar pagamento:', error);
            throw error;
        }
    }

    /**
     * Processar efeitos do projeto
     * @param {Object} execution - Execução de efeitos
     * @param {string} userId - ID do usuário
     * @returns {Promise<void>}
     */
    async processEffects(execution, userId) {
        try {
            const { economic_effects, social_effects } = execution;

            // Aplicar efeitos econômicos
            if (economic_effects) {
                const economicChanges = {};

                if (economic_effects.revenue_increase_monthly > 0) {
                    // Aumentar receita (ajustar taxa de impostos efetiva)
                    economicChanges.monthly_revenue_bonus = economic_effects.revenue_increase_monthly;
                }

                if (economic_effects.cost_savings_monthly > 0) {
                    // Reduzir gastos (melhoria na eficiência)
                    economicChanges.monthly_cost_reduction = economic_effects.cost_savings_monthly;
                }

                if (Object.keys(economicChanges).length > 0) {
                    await this.stateRepository.updateEconomicData(userId, economicChanges);
                }
            }

            // Aplicar efeitos sociais
            if (social_effects) {
                const socialChanges = {};

                if (social_effects.employment_generation > 0) {
                    // Reduzir desemprego
                    const currentState = await this.stateRepository.findCompleteStateDataByUserId(userId);
                    if (currentState) {
                        const employmentImpact = (social_effects.employment_generation / currentState.state_info.population) * 100;
                        socialChanges.unemployment_rate_change = -Math.min(employmentImpact, 2); // Máximo 2% de redução
                    }
                }

                if (social_effects.quality_improvement) {
                    // Melhorar aprovação baseada na qualidade
                    const qualityBonus = {
                        'low': 1,
                        'medium': 2,
                        'high': 3
                    };
                    socialChanges.approval_rating_change = qualityBonus[social_effects.quality_improvement] || 1;
                }

                if (Object.keys(socialChanges).length > 0) {
                    // Aplicar mudanças econômicas (desemprego)
                    if (socialChanges.unemployment_rate_change) {
                        await this.stateRepository.updateEconomicData(userId, {
                            unemployment_rate_change: socialChanges.unemployment_rate_change
                        });
                    }

                    // Aplicar mudanças de governança (aprovação)
                    if (socialChanges.approval_rating_change) {
                        await this.stateRepository.updateGovernanceData(userId, {
                            approval_rating_change: socialChanges.approval_rating_change
                        });
                    }
                }
            }

            console.log(`🎯 Efeitos aplicados: economia=${JSON.stringify(economic_effects)}, social=${JSON.stringify(social_effects)}`);

            // Atualizar log do projeto
            const project = await this.projectRepository.findById(execution.project_id);
            if (project) {
                await this.projectRepository.update(execution.project_id, {
                    processing_logs: [
                        ...project.processing_logs,
                        {
                            timestamp: new Date(),
                            message: 'Efeitos do projeto aplicados com sucesso'
                        }
                    ]
                });
            }

        } catch (error) {
            console.error('❌ Erro ao processar efeitos:', error);
            throw error;
        }
    }

    /**
     * Processar conclusão do projeto
     * @param {Object} execution - Execução de conclusão
     * @param {Object} project - Dados do projeto
     * @returns {Promise<void>}
     */
    async processCompletion(execution, project) {
        try {
            // Atualizar status do projeto para concluído
            await this.projectRepository.update(project.id, {
                status: PROJECT_STATUS.COMPLETED,
                completed_at: new Date(),
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date(),
                        message: 'Projeto concluído com sucesso'
                    }
                ]
            });

            console.log(`🎉 Projeto ${project.id} concluído: ${project.refined_project?.name}`);

        } catch (error) {
            console.error('❌ Erro ao processar conclusão:', error);
            throw error;
        }
    }

    /**
     * Iniciar job automática de execução
     * @returns {void}
     */
    startExecutionJob() {
        // Executar a cada hora
        cron.schedule('0 * * * *', async () => {
            try {
                console.log('⏰ Executando job de projetos...');
                await this.processPendingExecutions();
            } catch (error) {
                console.error('❌ Erro na job de execução:', error);
            }
        });

        console.log('✅ Job de execução de projetos iniciada (execução a cada hora)');
    }

    /**
     * Executar job manualmente (para desenvolvimento)
     * @returns {Promise<Object>} - Resultado da execução
     */
    async executeJobManually() {
        try {
            console.log('🔧 Execução manual da job de projetos...');
            const startTime = Date.now();
            
            await this.processPendingExecutions();
            
            const executionTime = Date.now() - startTime;
            
            return {
                success: true,
                execution_time_ms: executionTime,
                executed_at: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Erro na execução manual:', error);
            return {
                success: false,
                error: error.message,
                executed_at: new Date().toISOString()
            };
        }
    }

    /**
     * Obter estatísticas de execução
     * @returns {Promise<Object>} - Estatísticas
     */
    async getExecutionStats() {
        try {
            const stats = await this.ProjectExecution.findAll({
                attributes: [
                    'execution_type',
                    'status',
                    [this.ProjectExecution.sequelize.fn('COUNT', '*'), 'count']
                ],
                group: ['execution_type', 'status'],
                raw: true
            });

            const result = {
                payment: { pending: 0, executed: 0, failed: 0 },
                effect: { pending: 0, executed: 0, failed: 0 },
                completion: { pending: 0, executed: 0, failed: 0 },
                total: { pending: 0, executed: 0, failed: 0 }
            };

            stats.forEach(stat => {
                const type = stat.execution_type;
                const status = stat.status;
                const count = parseInt(stat.count);

                if (result[type]) {
                    result[type][status] = count;
                }
                result.total[status] += count;
            });

            return result;
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }

    /**
     * Buscar execuções pendentes
     * @param {number} limit - Limite de registros
     * @returns {Promise<Array>} - Execuções pendentes
     */
    async getPendingExecutions(limit = 50) {
        try {
            const executions = await this.ProjectExecution.findAll({
                where: { status: 'pending' },
                include: [
                    {
                        model: require('../../infrastructure/database/models').GovernmentProject,
                        as: 'project',
                        attributes: ['id', 'user_id', 'refined_project']
                    }
                ],
                order: [['scheduled_for', 'ASC']],
                limit
            });

            return executions.map(execution => execution.toJSON());
        } catch (error) {
            console.error('❌ Erro ao buscar execuções pendentes:', error);
            throw error;
        }
    }
}

module.exports = ProjectExecutionService;