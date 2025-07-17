const cron = require('node-cron');
const ProjectExecutionRepository = require('../../domain/repositories/project-execution-repository');
const GovernmentProjectRepository = require('../../domain/repositories/government-project-repository');
const StateRepository = require('../../domain/repositories/state-repository');

class ProjectExecutionService {
    constructor() {
        this.executionRepository = new ProjectExecutionRepository();
        this.projectRepository = new GovernmentProjectRepository();
        this.stateRepository = new StateRepository();
    }

    /**
     * Processar execuções pendentes
     * @returns {Promise<Object>} - Resultado da execução
     */
    async processPendingExecutions() {
        try {
            console.log('🔄 Iniciando processamento de execuções pendentes...');

            const pendingExecutions = await this.getPendingExecutions();
            
            if (pendingExecutions.length === 0) {
                console.log('ℹ️ Nenhuma execução pendente encontrada');
                return { processed: 0, errors: 0 };
            }

            console.log(`📋 ${pendingExecutions.length} execuções pendentes encontradas`);

            let processed = 0;
            let errors = 0;

            for (const execution of pendingExecutions) {
                try {
                    await this.processExecution(execution);
                    await this.markExecutionAsExecuted(execution.id);
                    processed++;
                } catch (error) {
                    console.error(`❌ Erro ao processar execução ${execution.id}:`, error);
                    await this.markExecutionAsFailed(execution.id, error.message);
                    errors++;
                }
            }

            console.log(`✅ Processamento concluído: ${processed} sucessos, ${errors} erros`);

            return { processed, errors };

        } catch (error) {
            console.error('❌ Erro no processamento de execuções:', error);
            throw error;
        }
    }

    /**
     * Marcar execução como executada
     * @param {number} executionId - ID da execução
     * @returns {Promise<void>}
     */
    async markExecutionAsExecuted(executionId) {
        try {
            const { error } = await this.executionRepository.supabase
                .from('project_executions')
                .update({
                    status: 'executed',
                    executed_at: new Date().toISOString()
                })
                .eq('id', executionId);

            if (error) {
                throw new Error(`Erro ao atualizar execução: ${error.message}`);
            }

        } catch (error) {
            console.error('❌ Erro ao marcar execução como executada:', error);
            throw error;
        }
    }

    /**
     * Marcar execução como falhada
     * @param {number} executionId - ID da execução
     * @param {string} errorMessage - Mensagem de erro
     * @returns {Promise<void>}
     */
    async markExecutionAsFailed(executionId, errorMessage) {
        try {
            const { error } = await this.executionRepository.supabase
                .from('project_executions')
                .update({
                    status: 'failed',
                    error_message: errorMessage,
                    executed_at: new Date().toISOString()
                })
                .eq('id', executionId);

            if (error) {
                throw new Error(`Erro ao atualizar execução: ${error.message}`);
            }

        } catch (error) {
            console.error('❌ Erro ao marcar execução como falhada:', error);
            throw error;
        }
    }

    /**
     * Agendar parcelas de pagamento
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
     * [CORRIGIDO] Validar e normalizar duração do projeto
     * @param {number|undefined} estimatedDurationMonths - Duração estimada em meses
     * @returns {number} - Duração validada em meses (máximo 0.5 mês = 2 semanas)
     */
    validateProjectDuration(estimatedDurationMonths) {
        // Se não há duração estimada, usar padrão de 2 semanas (0.5 mês)
        if (!estimatedDurationMonths || estimatedDurationMonths <= 0) {
            return 0.5;
        }

        // Limitar a duração máxima a 0.5 mês (2 semanas)
        const maxDurationMonths = 0.5;
        
        if (estimatedDurationMonths > maxDurationMonths) {
            console.log(`⚠️ Duração de ${estimatedDurationMonths} meses é muito longa. Limitando a ${maxDurationMonths} mês (2 semanas)`);
            return maxDurationMonths;
        }

        return estimatedDurationMonths;
    }

    /**
     * [CORRIGIDO] Agendar efeitos do projeto
     * @param {string} projectId - ID do projeto  
     * @param {Object} projectData - Dados do projeto
     * @returns {Promise<void>}
     */
    async scheduleEffects(projectId, projectData) {
        try {
            console.log(`🎯 Agendando efeitos para projeto ${projectId}...`);

            // Validar e normalizar duração
            const validatedDuration = this.validateProjectDuration(
                projectData.analysis_data?.estimated_duration_months
            );

            const currentDate = new Date();
            const effectDate = new Date(currentDate);
            
            // Converter meses em dias (1 mês = 30 dias)
            const daysToAdd = Math.floor(validatedDuration * 30);
            effectDate.setDate(effectDate.getDate() + daysToAdd);

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
     * [CORRIGIDO] Agendar conclusão do projeto
     * @param {string} projectId - ID do projeto
     * @param {Object} projectData - Dados do projeto
     * @returns {Promise<void>}
     */
    async scheduleCompletion(projectId, projectData) {
        try {
            console.log(`🏁 Agendando conclusão para projeto ${projectId}...`);

            // Validar e normalizar duração
            const validatedDuration = this.validateProjectDuration(
                projectData.analysis_data?.estimated_duration_months
            );

            const currentDate = new Date();
            const completionDate = new Date(currentDate);
            
            // Converter meses em dias e adicionar 1 semana extra para conclusão
            const daysToAdd = Math.floor(validatedDuration * 30) + 7; // +7 dias para finalização
            completionDate.setDate(completionDate.getDate() + daysToAdd);

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

            console.log(`✅ Execução ${execution.id} processada com sucesso`);

        } catch (error) {
            console.error(`❌ Erro ao processar execução ${execution.id}:`, error);
            throw error;
        }
    }

    /**
     * Processar pagamento/parcela
     * @param {Object} execution - Dados da execução
     * @returns {Promise<void>}
     */
    async processPayment(execution) {
        try {
            console.log(`💰 Processando pagamento de ${execution.payment_amount} para projeto ${execution.project_id}`);

            // Buscar estado do projeto
            const project = await this.projectRepository.findById(execution.project_id);
            if (!project) {
                throw new Error('Projeto não encontrado');
            }

            // Debitar valor do orçamento do estado
            const state = await this.stateRepository.getStateById(project.state_id);
            if (!state) {
                throw new Error('Estado não encontrado');
            }

            const newBudget = state.economy.budget - execution.payment_amount;
            
            if (newBudget < 0) {
                throw new Error(`Orçamento insuficiente. Disponível: ${state.economy.budget}, Necessário: ${execution.payment_amount}`);
            }

            await this.stateRepository.updateEconomicData(project.state_id, {
                budget: newBudget
            });

            console.log(`✅ Pagamento processado: ${execution.payment_amount} debitado do orçamento`);

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
            console.log(`🎯 Aplicando efeitos para projeto ${execution.project_id}`);

            // Buscar projeto com dados completos
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
            console.log('🔧 Executando job manualmente...');
            return await this.processPendingExecutions();
        } catch (error) {
            console.error('❌ Erro na execução manual da job:', error);
            throw error;
        }
    }
}

module.exports = ProjectExecutionService;