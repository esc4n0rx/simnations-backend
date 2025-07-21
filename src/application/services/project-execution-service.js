const cron = require('node-cron');
const ProjectExecutionRepository = require('../../domain/repositories/project-execution-repository');
const GovernmentProjectRepository = require('../../domain/repositories/government-project-repository');
const StateRepository = require('../../domain/repositories/state-repository');

class ProjectExecutionService {
    constructor() {
        this.executionRepository = new ProjectExecutionRepository();
        this.projectRepository = new GovernmentProjectRepository();
        this.stateRepository = new StateRepository();
        this.jobTask = null; // Para armazenar a referência da task do cron
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
 * Obter execuções pendentes
 * @param {number} limit - Limite de execuções a buscar
 * @returns {Promise<Array>} - Lista de execuções pendentes
 */
async getPendingExecutions(limit = 50) {
    try {
        // CORREÇÃO: Usar this.executionRepository.supabase corretamente
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
        
        // CORREÇÃO: Verificar se o erro é relacionado ao supabase client
        if (error.message.includes("Cannot read properties of undefined (reading 'from')")) {
            console.error('❌ Erro crítico: Supabase client não inicializado corretamente');
            
            // Tentar reimportar o supabase client
            const { supabase } = require('../../infrastructure/database/supabase-client');
            
            if (!supabase) {
                throw new Error('Supabase client não está disponível');
            }
            
            // Tentar novamente com o client reimportado
            const { data: executions, error: retryError } = await supabase
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
                .lte('scheduled_for', new Date().toISOString())
                .order('scheduled_for', { ascending: true })
                .limit(limit);
            
            if (retryError) {
                throw new Error(`Erro na segunda tentativa: ${retryError.message}`);
            }
            
            return executions || [];
        }
        
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
                case 'installment':
                    await this.processInstallmentPayment(execution);
                    break;
                case 'effect':
                    await this.processProjectEffect(execution);
                    break;
                case 'completion':
                    await this.processProjectCompletion(execution);
                    break;
                default:
                    throw new Error(`Tipo de execução desconhecido: ${execution.execution_type}`);
            }

            console.log(`✅ Execução ${execution.id} processada com sucesso`);

        } catch (error) {
            console.error(`❌ Erro ao processar execução ${execution.id}:`, error);
            throw error;
        }
    }

    /**
     * Processar pagamento de parcela
     * @param {Object} execution - Execução de parcela
     * @returns {Promise<void>}
     */
    async processInstallmentPayment(execution) {
        try {
            console.log(`💰 Processando pagamento de parcela para projeto ${execution.project_id}`);

            const project = await this.projectRepository.findById(execution.project_id);
            if (!project) {
                throw new Error(`Projeto ${execution.project_id} não encontrado`);
            }

            // Aplicar impacto financeiro da parcela
            const installmentAmount = execution.execution_data?.amount || 0;
            
            if (installmentAmount > 0) {
                await this.stateRepository.updateEconomicIndicator(
                    project.user_id,
                    'budget_balance',
                    -installmentAmount
                );

                console.log(`💸 Parcela de R$ ${installmentAmount.toLocaleString('pt-BR')} debitada`);
            }

        } catch (error) {
            console.error('❌ Erro ao processar pagamento de parcela:', error);
            throw error;
        }
    }

    /**
     * Processar efeito do projeto
     * @param {Object} execution - Execução de efeito
     * @returns {Promise<void>}
     */
    async processProjectEffect(execution) {
        try {
            console.log(`🎯 Aplicando efeitos do projeto ${execution.project_id}`);

            const project = await this.projectRepository.findById(execution.project_id);
            if (!project) {
                throw new Error(`Projeto ${execution.project_id} não encontrado`);
            }

            const effects = execution.execution_data?.effects || {};

            // Aplicar efeitos econômicos
            if (effects.economic) {
                for (const [indicator, value] of Object.entries(effects.economic)) {
                    await this.stateRepository.updateEconomicIndicator(
                        project.user_id,
                        indicator,
                        value
                    );
                }
            }

            // Aplicar efeitos de governança
            if (effects.governance) {
                for (const [indicator, value] of Object.entries(effects.governance)) {
                    await this.stateRepository.updateGovernanceIndicator(
                        project.user_id,
                        indicator,
                        value
                    );
                }
            }

            console.log(`✅ Efeitos do projeto ${execution.project_id} aplicados`);

        } catch (error) {
            console.error('❌ Erro ao processar efeitos do projeto:', error);
            throw error;
        }
    }

    /**
     * Processar conclusão do projeto
     * @param {Object} execution - Execução de conclusão
     * @returns {Promise<void>}
     */
    async processProjectCompletion(execution) {
        try {
            console.log(`🏁 Concluindo projeto ${execution.project_id}`);

            const project = await this.projectRepository.findById(execution.project_id);
            if (!project) {
                throw new Error(`Projeto ${execution.project_id} não encontrado`);
            }

            // Atualizar status do projeto para concluído
            await this.projectRepository.updateStatus(execution.project_id, 'completed');

            // Aplicar efeitos finais se houver
            const finalEffects = execution.execution_data?.final_effects || {};
            
            if (Object.keys(finalEffects).length > 0) {
                if (finalEffects.economic) {
                    for (const [indicator, value] of Object.entries(finalEffects.economic)) {
                        await this.stateRepository.updateEconomicIndicator(
                            project.user_id,
                            indicator,
                            value
                        );
                    }
                }

                if (finalEffects.governance) {
                    for (const [indicator, value] of Object.entries(finalEffects.governance)) {
                        await this.stateRepository.updateGovernanceIndicator(
                            project.user_id,
                            indicator,
                            value
                        );
                    }
                }
            }

            console.log(`🎉 Projeto ${execution.project_id} concluído com sucesso`);

        } catch (error) {
            console.error('❌ Erro ao processar conclusão do projeto:', error);
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
            console.log(`💰 Agendando parcelas para projeto ${projectId}...`);

            const { number_of_installments, installment_amount, start_date } = installmentsConfig;

            for (let i = 0; i < number_of_installments; i++) {
                const installmentDate = new Date(start_date);
                installmentDate.setMonth(installmentDate.getMonth() + i);

                const installmentExecution = {
                    project_id: projectId,
                    execution_type: 'installment',
                    scheduled_for: installmentDate.toISOString(),
                    execution_data: {
                        amount: installment_amount,
                        installment_number: i + 1,
                        total_installments: number_of_installments
                    },
                    status: 'pending'
                };

                await this.executionRepository.create(installmentExecution);
            }

            console.log(`✅ ${number_of_installments} parcelas agendadas`);

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

            const effects = projectData.analysis_data?.predicted_impacts || {};
            
            // Agendar efeitos intermediários (25%, 50%, 75% do progresso)
            const progressPoints = [0.25, 0.5, 0.75];
            const estimatedDuration = this.validateProjectDuration(
                projectData.analysis_data?.estimated_duration_months
            );

            for (const progress of progressPoints) {
                const effectDate = new Date();
                const daysToAdd = Math.floor(estimatedDuration * 30 * progress);
                effectDate.setDate(effectDate.getDate() + daysToAdd);

                // Calcular efeitos proporcionais ao progresso
                const proportionalEffects = this.calculateProportionalEffects(effects, progress);

                const effectExecution = {
                    project_id: projectId,
                    execution_type: 'effect',
                    scheduled_for: effectDate.toISOString(),
                    execution_data: {
                        effects: proportionalEffects,
                        progress_percentage: progress * 100
                    },
                    status: 'pending'
                };

                await this.executionRepository.create(effectExecution);
            }

            console.log(`✅ Efeitos agendados para 3 marcos do projeto`);

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
     * Validar e normalizar duração do projeto
     * @param {number} duration - Duração em meses
     * @returns {number} - Duração validada
     */
    validateProjectDuration(duration) {
        const numDuration = Number(duration);
        
        if (isNaN(numDuration) || numDuration <= 0) {
            console.warn(`⚠️ Duração inválida (${duration}), usando 3 meses como padrão`);
            return 3;
        }
        
        // Limitar duração entre 1 e 36 meses
        return Math.max(1, Math.min(36, numDuration));
    }

    /**
     * Calcular efeitos proporcionais ao progresso
     * @param {Object} effects - Efeitos totais
     * @param {number} progress - Progresso (0-1)
     * @returns {Object} - Efeitos proporcionais
     */
    calculateProportionalEffects(effects, progress) {
        const proportionalEffects = {};

        for (const [category, categoryEffects] of Object.entries(effects)) {
            proportionalEffects[category] = {};
            
            for (const [indicator, value] of Object.entries(categoryEffects)) {
                // Aplicar uma porção dos efeitos baseada no progresso
                proportionalEffects[category][indicator] = Math.floor(value * progress * 0.3); // 30% dos efeitos distribuídos
            }
        }

        return proportionalEffects;
    }

    /**
     * [PADRONIZADO] Iniciar job automática de execução
     * @returns {Promise<void>}
     */
    async start() {
        try {
            // Executar a cada hora
            this.jobTask = cron.schedule('0 * * * *', async () => {
                try {
                    console.log('⏰ Executando job de projetos...');
                    await this.processPendingExecutions();
                } catch (error) {
                    console.error('❌ Erro na job de execução:', error);
                }
            });

            console.log('✅ Job de execução de projetos iniciada (execução a cada hora)');

        } catch (error) {
            console.error('❌ Erro ao inicializar job de projetos:', error);
            throw error;
        }
    }

    /**
     * [PADRONIZADO] Parar job de execução
     * @returns {Promise<void>}
     */
    async stop() {
        try {
            if (this.jobTask) {
                this.jobTask.stop();
                this.jobTask = null;
                console.log('🛑 Job de execução de projetos parada');
            }
        } catch (error) {
            console.error('❌ Erro ao parar job de projetos:', error);
            throw error;
        }
    }

    /**
     * [MANTIDO] Alias para compatibilidade - Iniciar job automática de execução
     * @returns {void}
     */
    startExecutionJob() {
        return this.start();
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