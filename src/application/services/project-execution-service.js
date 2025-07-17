const cron = require('node-cron');
const GovernmentProjectRepository = require('../../domain/repositories/government-project-repository');
const ProjectExecutionRepository = require('../../domain/repositories/project-execution-repository');
const StateRepository = require('../../domain/repositories/state-repository');
const { PROJECT_STATUS } = require('../../shared/constants/government-project-constants');

class ProjectExecutionService {
    constructor() {
        this.projectRepository = new GovernmentProjectRepository();
        this.stateRepository = new StateRepository();
        this.executionRepository = new ProjectExecutionRepository();
        
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
                    scheduled_for: scheduledDate.toISOString(),
                    payment_amount: installmentsConfig.installment_amount,
                    installment_number: i,
                    total_installments: installmentsConfig.number_of_installments,
                    status: 'pending'
                });
            }

            await this.executionRepository.bulkCreate(executions);
            console.log(`✅ ${executions.length} parcelas agendadas`);

        } catch (error) {
            console.error('❌ Erro ao agendar parcelas:', error);
            throw error;
        }
    }

    /**
     * Agendar efeitos do projeto
     * @param {number} projectId - ID do projeto  
     * @param {Object} projectData - Dados do projeto
     * @returns {Promise<void>}
     */
    async scheduleEffects(projectId, projectData) {
        try {
            console.log(`🎯 Agendando efeitos para projeto ${projectId}...`);

            if (!projectData.analysis_data?.estimated_duration_months) {
                console.log('⚠️ Duração estimada não encontrada, usando padrão de 6 meses');
                return;
            }

            const currentDate = new Date();
            const effectDate = new Date(currentDate);
            effectDate.setMonth(effectDate.getMonth() + projectData.analysis_data.estimated_duration_months);

            const effectExecution = {
                project_id: projectId,
                execution_type: 'effect',
                scheduled_for: effectDate.toISOString(),
                status: 'pending'
            };

            await this.executionRepository.create(effectExecution);
            console.log(`✅ Efeitos agendados para ${effectDate.toLocaleDateString()}`);

        } catch (error) {
            console.error('❌ Erro ao agendar efeitos:', error);
            throw error;
        }
    }

    /**
     * Agendar conclusão do projeto
     * @param {number} projectId - ID do projeto
     * @param {Object} projectData - Dados do projeto
     * @returns {Promise<void>}
     */
    async scheduleCompletion(projectId, projectData) {
        try {
            console.log(`🏁 Agendando conclusão para projeto ${projectId}...`);

            if (!projectData.analysis_data?.estimated_duration_months) {
                console.log('⚠️ Duração estimada não encontrada, usando padrão de 6 meses');
                return;
            }

            const currentDate = new Date();
            const completionDate = new Date(currentDate);
            completionDate.setMonth(completionDate.getMonth() + projectData.analysis_data.estimated_duration_months + 1);

            const completionExecution = {
                project_id: projectId,
                execution_type: 'completion',
                scheduled_for: completionDate.toISOString(),
                status: 'pending'
            };

            await this.executionRepository.create(completionExecution);
            console.log(`✅ Conclusão agendada para ${completionDate.toLocaleDateString()}`);

        } catch (error) {
            console.error('❌ Erro ao agendar conclusão:', error);
            throw error;
        }
    }

    /**
     * Processar execução individual
     * @param {Object} execution - Execução a ser processada
     * @returns {Promise<void>}
     */
    async processExecution(execution) {
        try {
            console.log(`⚙️ Processando execução ${execution.id} - Tipo: ${execution.execution_type}`);

            switch (execution.execution_type) {
                case 'payment':
                    await this.processPayment(execution);
                    break;
                case 'effect':
                    await this.processEffect(execution);
                    break;
                case 'completion':
                    await this.processCompletion(execution);
                    break;
                default:
                    throw new Error(`Tipo de execução não reconhecido: ${execution.execution_type}`);
            }

            // Marcar execução como processada
            await this.executionRepository.update(execution.id, {
                status: 'executed',
                executed_at: new Date().toISOString()
            });

            console.log(`✅ Execução ${execution.id} processada com sucesso`);

        } catch (error) {
            console.error(`❌ Erro ao processar execução ${execution.id}:`, error);
            
            // Marcar execução como falha
            await this.executionRepository.update(execution.id, {
                status: 'failed',
                error_message: error.message,
                executed_at: new Date().toISOString()
            });
            
            throw error;
        }
    }

    /**
     * Processar pagamento de parcela
     * @param {Object} execution - Execução de pagamento
     * @returns {Promise<void>}
     */
    async processPayment(execution) {
        try {
            console.log(`💰 Processando pagamento - Parcela ${execution.installment_number}/${execution.total_installments}`);
            
            if (!execution.project) {
                throw new Error('Dados do projeto não encontrados na execução');
            }

            const project = execution.project;
            const user = project.user;
            
            if (!user) {
                throw new Error('Dados do usuário não encontrados');
            }

            // Buscar dados atuais do estado
            const stateData = await this.stateRepository.findByUserId(user.id);
            if (!stateData) {
                throw new Error('Dados do estado não encontrados');
            }

            // Aplicar impacto financeiro
            const paymentAmount = parseFloat(execution.payment_amount);
            const newBudget = parseFloat(stateData.budget) - paymentAmount;

            await this.stateRepository.update(stateData.id, {
                budget: newBudget
            });

            console.log(`💸 Pagamento de $${paymentAmount.toLocaleString()} realizado. Orçamento atualizado: $${newBudget.toLocaleString()}`);

        } catch (error) {
            console.error('❌ Erro ao processar pagamento:', error);
            throw error;
        }
    }

    /**
     * Processar efeitos do projeto
     * @param {Object} execution - Execução de efeitos
     * @returns {Promise<void>}
     */
    async processEffect(execution) {
        try {
            console.log(`🎯 Aplicando efeitos do projeto ${execution.project_id}`);
            
            if (!execution.project) {
                throw new Error('Dados do projeto não encontrados na execução');
            }

            const project = execution.project;
            const user = project.user;
            
            if (!user) {
                throw new Error('Dados do usuário não encontrados');
            }

            // Buscar dados atuais do estado
            const stateData = await this.stateRepository.findByUserId(user.id);
            if (!stateData) {
                throw new Error('Dados do estado não encontrados');
            }

            // Aplicar efeitos econômicos e sociais do projeto
            const analysisData = project.analysis_data;
            if (analysisData?.economic_return_projection) {
                const economicImpact = analysisData.economic_return_projection;
                const newGDP = parseFloat(stateData.gdp) + parseFloat(economicImpact.annual_revenue_increase || 0);
                
                await this.stateRepository.update(stateData.id, {
                    gdp: newGDP
                });

                console.log(`📈 PIB aumentado em $${economicImpact.annual_revenue_increase?.toLocaleString()} - Novo PIB: $${newGDP.toLocaleString()}`);
            }

            if (analysisData?.social_impact_projection) {
                const socialImpact = analysisData.social_impact_projection;
                const currentApproval = parseFloat(stateData.approval_rating);
                const approvalIncrease = socialImpact.approval_rating_change || 0;
                const newApproval = Math.min(100, currentApproval + approvalIncrease);
                
                await this.stateRepository.update(stateData.id, {
                    approval_rating: newApproval
                });

                console.log(`👥 Aprovação alterada em ${approvalIncrease}% - Nova aprovação: ${newApproval}%`);
            }

        } catch (error) {
            console.error('❌ Erro ao processar efeitos:', error);
            throw error;
        }
    }

    /**
     * Processar conclusão do projeto
     * @param {Object} execution - Execução de conclusão
     * @returns {Promise<void>}
     */
    async processCompletion(execution) {
        try {
            console.log(`🏁 Concluindo projeto ${execution.project_id}`);
            
            if (!execution.project) {
                throw new Error('Dados do projeto não encontrados na execução');
            }

            const project = execution.project;

            // Atualizar status do projeto para concluído
            await this.projectRepository.update(project.id, {
                status: PROJECT_STATUS.COMPLETED,
                completed_at: new Date().toISOString(),
                processing_logs: [
                    ...project.processing_logs,
                    {
                        timestamp: new Date().toISOString(),
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
     * Cancelar execuções de um projeto
     * @param {number} projectId - ID do projeto
     * @returns {Promise<void>}
     */
    async cancelProjectExecutions(projectId) {
        try {
            console.log(`🚫 Cancelando execuções do projeto ${projectId}...`);

            const cancelledCount = await this.executionRepository.cancelProjectExecutions(projectId);

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

            // Usar repository do Supabase ao invés de Sequelize
            const pendingExecutions = await this.executionRepository.findPendingExecutions();

            console.log(`📋 Encontradas ${pendingExecutions.length} execuções pendentes`);

            if (pendingExecutions.length === 0) {
                console.log('ℹ️ Nenhuma execução pendente encontrada');
                return;
            }

            for (const execution of pendingExecutions) {
                try {
                    await this.processExecution(execution);
                } catch (error) {
                    console.error(`❌ Erro ao processar execução ${execution.id}:`, error);
                    
                    // Marcar execução como falha
                    await this.executionRepository.update(execution.id, {
                        status: 'failed',
                        error_message: error.message,
                        executed_at: new Date().toISOString()
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
     * Obter estatísticas de execução usando Supabase
     * @returns {Promise<Object>} - Estatísticas
     */
    async getExecutionStats() {
        try {
            // Buscar todas as execuções para calcular estatísticas
            const { data: executions, error } = await require('../../infrastructure/database/supabase-client').supabase
                .from('project_executions')
                .select('execution_type, status');

            if (error) {
                throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
            }

            const result = {
                payment: { pending: 0, executed: 0, failed: 0 },
                effect: { pending: 0, executed: 0, failed: 0 },
                completion: { pending: 0, executed: 0, failed: 0 },
                total: { pending: 0, executed: 0, failed: 0 }
            };

            executions.forEach(execution => {
                const type = execution.execution_type;
                const status = execution.status;

                if (result[type]) {
                    result[type][status] = (result[type][status] || 0) + 1;
                }
                result.total[status] = (result.total[status] || 0) + 1;
            });

            return result;
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }

    /**
     * Buscar execuções pendentes com limite
     * @param {number} limit - Limite de registros
     * @returns {Promise<Array>} - Execuções pendentes
     */
    async getPendingExecutions(limit = 50) {
        try {
            const { data: executions, error } = await require('../../infrastructure/database/supabase-client').supabase
                .from('project_executions')
                .select(`
                    *,
                    project:government_projects!project_id (
                        id,
                        user_id,
                        refined_project
                    )
                `)
                .eq('status', 'pending')
                .order('scheduled_for', { ascending: true })
                .limit(limit);

            if (error) {
                throw new Error(`Erro ao buscar execuções pendentes: ${error.message}`);
            }

            return executions || [];
        } catch (error) {
            console.error('❌ Erro ao buscar execuções pendentes:', error);
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
}

module.exports = ProjectExecutionService;