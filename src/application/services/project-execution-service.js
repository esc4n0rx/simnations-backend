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
        
        // [CORRIGIDO] Iniciar job de execução automaticamente
        this.startExecutionJob();
        
        console.log('🎯 ProjectExecutionService inicializado com job automática');
    }

    /**
     * Processar execuções pendentes
     * @returns {Promise<void>}
     */
    async processPendingExecutions() {
        try {
            console.log('🔍 Verificando execuções pendentes...');

            const pendingExecutions = await this.getPendingExecutions(100);
            
            if (pendingExecutions.length === 0) {
                console.log('✅ Nenhuma execução pendente encontrada');
                return;
            }

            console.log(`📋 Processando ${pendingExecutions.length} execuções pendentes...`);

            for (const execution of pendingExecutions) {
                try {
                    await this.processExecution(execution);
                } catch (error) {
                    console.error(`❌ Erro ao processar execução ${execution.id}:`, error);
                    // Marcar execução como com erro
                    await this.executionRepository.update(execution.id, {
                        status: 'failed',
                        error_message: error.message,
                        processed_at: new Date().toISOString()
                    });
                }
            }

            console.log(`✅ Processamento de execuções concluído`);

        } catch (error) {
            console.error('❌ Erro ao processar execuções pendentes:', error);
            throw error;
        }
    }

    /**
     * Agendar parcelas do projeto
     * @param {string} projectId - ID do projeto
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
     * @param {string} projectId - ID do projeto  
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
     * @param {string} projectId - ID do projeto
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
                status: 'completed',
                processed_at: new Date().toISOString()
            });

            console.log(`✅ Execução ${execution.id} processada com sucesso`);

        } catch (error) {
            console.error(`❌ Erro ao processar execução ${execution.id}:`, error);
            throw error;
        }
    }

    /**
     * Processar pagamento de parcela
     * @param {Object} execution - Dados da execução
     * @returns {Promise<void>}
     */
    async processPayment(execution) {
        try {
            console.log(`💰 Processando pagamento - Projeto ${execution.project_id} - Parcela ${execution.installment_number}`);

            // Buscar projeto
            const project = await this.projectRepository.findById(execution.project_id);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Buscar dados do estado
            const stateData = await this.stateRepository.getStateById(project.state_id);
            if (!stateData) {
                throw new Error('Estado não encontrado');
            }

            // Atualizar economia do estado (reduzir treasury_balance)
            const newBalance = stateData.economy.treasury_balance - execution.payment_amount;
            
            await this.stateRepository.updateEconomicData(project.state_id, {
                treasury_balance: Math.max(0, newBalance) // Não deixar negativo
            });

            console.log(`✅ Pagamento processado: -R$ ${execution.payment_amount}`);

        } catch (error) {
            console.error('❌ Erro ao processar pagamento:', error);
            throw error;
        }
    }

    /**
     * Processar efeitos do projeto
     * @param {Object} execution - Dados da execução
     * @returns {Promise<void>}
     */
    async processEffect(execution) {
        try {
            console.log(`🎯 Aplicando efeitos - Projeto ${execution.project_id}`);

            // Buscar projeto
            const project = await this.projectRepository.findById(execution.project_id);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Aplicar efeitos econômicos e políticos baseados na análise
            if (project.analysis_data?.economic_return_projection) {
                const economicImpacts = project.analysis_data.economic_return_projection;
                
                // Aplicar aumento de receita mensal
                if (economicImpacts.revenue_increase_monthly) {
                    await this.stateRepository.updateEconomicData(project.state_id, {
                        monthly_revenue: (await this.stateRepository.getStateById(project.state_id)).economy.monthly_revenue + economicImpacts.revenue_increase_monthly
                    });
                }
            }

            // Aplicar impactos sociais se houver
            if (project.analysis_data?.social_impact_projection?.quality_of_life_improvement) {
                const improvement = project.analysis_data.social_impact_projection.quality_of_life_improvement;
                
                let approvalIncrease = 0;
                switch (improvement) {
                    case 'high': approvalIncrease = 5; break;
                    case 'medium': approvalIncrease = 3; break;
                    case 'low': approvalIncrease = 1; break;
                }

                if (approvalIncrease > 0) {
                    const currentState = await this.stateRepository.getStateById(project.state_id);
                    const newApproval = Math.min(100, currentState.governance.approval_rating + approvalIncrease);
                    
                    await this.stateRepository.updateGovernanceData(project.state_id, {
                        approval_rating: newApproval
                    });
                }
            }

            console.log(`✅ Efeitos aplicados para projeto ${execution.project_id}`);

        } catch (error) {
            console.error('❌ Erro ao aplicar efeitos:', error);
            throw error;
        }
    }

    /**
     * Processar conclusão do projeto
     * @param {Object} execution - Dados da execução
     * @returns {Promise<void>}
     */
    async processCompletion(execution) {
        try {
            console.log(`🏁 Finalizando projeto ${execution.project_id}`);

            // Buscar e atualizar projeto
            const project = await this.projectRepository.findById(execution.project_id);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Marcar projeto como concluído
            project.complete();
            
            await this.projectRepository.update(execution.project_id, project);

            console.log(`✅ Projeto ${execution.project_id} concluído`);

        } catch (error) {
            console.error('❌ Erro ao finalizar projeto:', error);
            throw error;
        }
    }

    /**
     * Obter execuções pendentes
     * @param {number} limit - Limite de resultados
     * @returns {Promise<Array>}
     */
    async getPendingExecutions(limit = 50) {
        try {
            const { data: executions, error } = await this.executionRepository.supabase
                .from('project_executions')
                .select(`
                    *,
                    government_projects!inner(
                        id,
                        user_id,
                        state_id,
                        status
                    )
                `)
                .eq('status', 'pending')
                .lte('scheduled_for', new Date().toISOString()) // Só execuções que já deveriam ter acontecido
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
     * [CORRIGIDO] Iniciar job automática de execução
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
     * @returns {Promise<Object>}
     */
    async getExecutionStats() {
        try {
            const { data: stats, error } = await this.executionRepository.supabase
                .from('project_executions')
                .select('status, execution_type, created_at')
                .order('created_at', { ascending: false });

            if (error) {
                throw new Error(`Erro ao obter estatísticas: ${error.message}`);
            }

            const now = new Date();
            const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const summary = {
                total_executions: stats.length,
                pending: stats.filter(s => s.status === 'pending').length,
                completed: stats.filter(s => s.status === 'completed').length,
                failed: stats.filter(s => s.status === 'failed').length,
                last_24h: stats.filter(s => new Date(s.created_at) >= last24h).length,
                by_type: {
                    payment: stats.filter(s => s.execution_type === 'payment').length,
                    effect: stats.filter(s => s.execution_type === 'effect').length,
                    completion: stats.filter(s => s.execution_type === 'completion').length
                }
            };

            return {
                success: true,
                data: summary,
                generated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }
}

module.exports = ProjectExecutionService;