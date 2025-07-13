const StateRepository = require('../../domain/repositories/state-repository');
const StateParameterRepository = require('../../domain/repositories/state-parameter-repository');
const { supabase } = require('../../infrastructure/database/supabase-client');
const { ECONOMIC_CONSTANTS, CALCULATION_MODES } = require('../../shared/constants/economic-constants');


class EconomicEngineService {
    constructor() {
        this.stateRepository = new StateRepository();
        this.parameterRepository = new StateParameterRepository();
    }

    /**
     * Processar atualização econômica para todos os estados ativos
     * @returns {Promise<Object>} - Resultado do processamento
     */
    async processAllStatesEconomicUpdate() {
        console.log('🏛️ Iniciando atualização econômica automática...');
        
        const startTime = Date.now();
        let processedStates = 0;
        let errorStates = 0;
        const errors = [];

        try {
            // Buscar todos os parâmetros de estados ativos
            const activeParameters = await this.parameterRepository.findAllActive();
            
            console.log(`📊 Processando ${activeParameters.length} estados ativos...`);

            // Processar cada estado individualmente
            for (const parameter of activeParameters) {
                try {
                    await this.processStateEconomicUpdate(parameter.user_id, CALCULATION_MODES.NORMAL);
                    processedStates++;
                    
                    // Log de progresso a cada 10 estados
                    if (processedStates % 10 === 0) {
                        console.log(`⚡ Processados ${processedStates}/${activeParameters.length} estados...`);
                    }
                } catch (error) {
                    console.error(`❌ Erro ao processar estado do usuário ${parameter.user_id}:`, error.message);
                    errorStates++;
                    errors.push({
                        user_id: parameter.user_id,
                        error: error.message
                    });
                }
            }

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            const result = {
                success: true,
                processed_states: processedStates,
                error_states: errorStates,
                total_states: activeParameters.length,
                duration_seconds: duration,
                errors: errors.length > 0 ? errors : null,
                timestamp: new Date().toISOString()
            };

            console.log(`✅ Atualização econômica concluída em ${duration}s`);
            console.log(`📈 Sucesso: ${processedStates} | Erros: ${errorStates}`);

            return result;

        } catch (error) {
            console.error('❌ Erro crítico na atualização econômica:', error);
            throw error;
        }
    }

    /**
     * Processar atualização econômica para um estado específico
     * @param {string} userId - ID do usuário
     * @param {string} mode - Modo de cálculo
     * @returns {Promise<Object>} - Resultado da atualização
     */
    async processStateEconomicUpdate(userId, mode = CALCULATION_MODES.NORMAL) {
        // Buscar dados completos do estado
        const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
        if (!stateData) {
            throw new Error('Estado não encontrado');
        }

        // Buscar parâmetros econômicos
        const parameters = await this.parameterRepository.findByUserId(userId);
        if (!parameters) {
            throw new Error('Parâmetros econômicos não encontrados');
        }

        const economy = stateData.economy;
        const governance = stateData.governance;

        // Calcular dias desde última atualização
        const lastUpdate = new Date(economy.updated_at);
        const now = new Date();
        const daysPassed = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));

        // Se não há dias para processar, retornar sem alterações
        if (daysPassed === 0) {
            return {
                updated: false,
                reason: 'Nenhum dia para processar',
                days_passed: daysPassed
            };
        }

        // Limitar dias processados para segurança
        const daysToProcess = Math.min(daysPassed, ECONOMIC_CONSTANTS.MAX_DAYS_TO_PROCESS);
        
        if (daysToProcess !== daysPassed) {
            console.warn(`⚠️ Limitando processamento de ${daysPassed} para ${daysToProcess} dias (usuário: ${userId})`);
        }

        // Calcular novos valores
        const calculations = this.calculateEconomicUpdates(economy, governance, parameters, daysToProcess);

        // Salvar log antes da atualização
        await this.parameterRepository.saveUpdateLog({
            user_id: userId,
            state_id: stateData.state_info.id,
            previous_gdp: economy.gdp,
            previous_treasury: economy.treasury_balance,
            previous_monthly_revenue: economy.monthly_revenue,
            previous_monthly_expenses: economy.monthly_expenses,
            new_gdp: calculations.new_gdp,
            new_treasury: calculations.new_treasury,
            new_monthly_revenue: calculations.new_monthly_revenue,
            new_monthly_expenses: calculations.new_monthly_expenses,
            days_processed: daysToProcess,
            gdp_growth_applied: calculations.gdp_growth_applied,
            daily_cash_flow: calculations.daily_cash_flow
        });

        // Atualizar economia no banco
        const updatedEconomy = await this.stateRepository.updateEconomy(economy.id, {
            gdp: calculations.new_gdp,
            treasury_balance: calculations.new_treasury,
            monthly_revenue: calculations.new_monthly_revenue,
            monthly_expenses: calculations.new_monthly_expenses
        });

        return {
            updated: true,
            days_processed: daysToProcess,
            calculations: calculations,
            previous_values: {
                gdp: economy.gdp,
                treasury: economy.treasury_balance,
                revenue: economy.monthly_revenue,
                expenses: economy.monthly_expenses
            },
            new_values: {
                gdp: calculations.new_gdp,
                treasury: calculations.new_treasury,
                revenue: calculations.new_monthly_revenue,
                expenses: calculations.new_monthly_expenses
            }
        };
    }

    /**
     * Calcular atualizações econômicas
     * @param {StateEconomy} economy - Dados econômicos atuais
     * @param {StateGovernance} governance - Dados de governança
     * @param {StateParameter} parameters - Parâmetros econômicos
     * @param {number} daysToProcess - Dias para processar
     * @returns {Object} - Novos valores calculados
     */
    calculateEconomicUpdates(economy, governance, parameters, daysToProcess) {
        // 1. Calcular crescimento do PIB
        const dailyGrowthRate = economy.gdp_growth_rate / 100 / ECONOMIC_CONSTANTS.DAYS_IN_YEAR;
        const totalGrowthRate = dailyGrowthRate * daysToProcess;
        const new_gdp = Math.max(
            economy.gdp * (1 + totalGrowthRate),
            ECONOMIC_CONSTANTS.MIN_GDP_VALUE
        );

        // 2. Calcular nova receita mensal baseada no PIB atualizado
        const effectiveTaxRate = parameters.getEffectiveTaxRate();
        
        // Aplicar modificadores de governança se existir
        let governanceMultiplier = 1.0;
        if (governance) {
            // Estabilidade política afeta a arrecadação (50-100% = 0.8-1.2)
            const stabilityFactor = 0.8 + (governance.political_stability / 100) * 0.4;
            
            // Aprovação popular afeta a cooperação fiscal (0-100% = 0.9-1.1)
            const approvalFactor = 0.9 + (governance.approval_rating / 100) * 0.2;
            
            governanceMultiplier = (stabilityFactor + approvalFactor) / 2;
        }

        const new_monthly_revenue = new_gdp * effectiveTaxRate * governanceMultiplier;

        // 3. Calcular novas despesas mensais
        const effectiveExpenseRate = parameters.getEffectiveExpenseRate();
        
        // Aplicar modificadores de corrupção e eficiência
        let expenseMultiplier = 1.0;
        if (governance) {
            // Corrupção aumenta gastos (0-100% = 1.0-1.3)
            const corruptionFactor = 1.0 + (governance.corruption_index / 100) * 0.3;
            expenseMultiplier = corruptionFactor;
        }

        const new_monthly_expenses = new_gdp * effectiveExpenseRate * expenseMultiplier;

        // 4. Calcular atualização do tesouro
        const daily_cash_flow = (new_monthly_revenue - new_monthly_expenses) / ECONOMIC_CONSTANTS.DAYS_IN_MONTH;
        const treasury_change = daily_cash_flow * daysToProcess;
        
        // Aplicar limite mínimo do tesouro
        const new_treasury = Math.max(
            economy.treasury_balance + treasury_change,
            parameters.min_treasury_balance || 0
        );

        // Aplicar limite máximo de crescimento diário se definido
        if (parameters.max_treasury_growth_per_day && daily_cash_flow > 0) {
            const max_allowed_change = parameters.max_treasury_growth_per_day * daysToProcess;
            if (treasury_change > max_allowed_change) {
                const limited_treasury = economy.treasury_balance + max_allowed_change;
                console.warn(`⚠️ Limitando crescimento do tesouro: ${treasury_change} -> ${max_allowed_change}`);
                return {
                    new_gdp: parseFloat(new_gdp.toFixed(ECONOMIC_CONSTANTS.GDP_CALCULATION_PRECISION)),
                    new_treasury: parseFloat(limited_treasury.toFixed(ECONOMIC_CONSTANTS.TREASURY_CALCULATION_PRECISION)),
                    new_monthly_revenue: parseFloat(new_monthly_revenue.toFixed(ECONOMIC_CONSTANTS.REVENUE_CALCULATION_PRECISION)),
                    new_monthly_expenses: parseFloat(new_monthly_expenses.toFixed(ECONOMIC_CONSTANTS.REVENUE_CALCULATION_PRECISION)),
                    gdp_growth_applied: totalGrowthRate,
                    daily_cash_flow: daily_cash_flow,
                    limited_by_max_growth: true
                };
            }
        }

        return {
            new_gdp: parseFloat(new_gdp.toFixed(ECONOMIC_CONSTANTS.GDP_CALCULATION_PRECISION)),
            new_treasury: parseFloat(new_treasury.toFixed(ECONOMIC_CONSTANTS.TREASURY_CALCULATION_PRECISION)),
            new_monthly_revenue: parseFloat(new_monthly_revenue.toFixed(ECONOMIC_CONSTANTS.REVENUE_CALCULATION_PRECISION)),
            new_monthly_expenses: parseFloat(new_monthly_expenses.toFixed(ECONOMIC_CONSTANTS.REVENUE_CALCULATION_PRECISION)),
            gdp_growth_applied: totalGrowthRate,
            daily_cash_flow: daily_cash_flow,
            limited_by_max_growth: false
        };
    }

    /**
     * Forçar atualização manual para um usuário específico
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Resultado da atualização
     */
    async forceUpdateForUser(userId) {
        console.log(`🔧 Forçando atualização manual para usuário: ${userId}`);
        return await this.processStateEconomicUpdate(userId, CALCULATION_MODES.MANUAL);
    }

    /**
     * Obter estatísticas da última execução
     * @returns {Promise<Object>} - Estatísticas do sistema
     */
    async getEconomicEngineStats() {
        try {
            // Buscar logs recentes (últimas 24h)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const { data: recentLogs, error } = await supabase
                .from('economic_update_logs')
                .select('*')
                .gte('processed_at', yesterday.toISOString())
                .order('processed_at', { ascending: false });

            if (error) {
                throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
            }

            // Calcular estatísticas
            const totalUpdates = recentLogs.length;
            const avgDaysProcessed = totalUpdates > 0 
                ? recentLogs.reduce((sum, log) => sum + log.days_processed, 0) / totalUpdates 
                : 0;

            const avgGdpGrowth = totalUpdates > 0
                ? recentLogs.reduce((sum, log) => sum + log.gdp_growth_applied, 0) / totalUpdates
                : 0;

            const totalTreasuryChange = recentLogs.reduce((sum, log) => 
                sum + (log.new_treasury - log.previous_treasury), 0);

            // Buscar total de estados ativos
            const activeParameters = await this.parameterRepository.findAllActive();

            return {
                last_24h_stats: {
                    total_updates: totalUpdates,
                    avg_days_processed: parseFloat(avgDaysProcessed.toFixed(2)),
                    avg_gdp_growth_applied: parseFloat(avgGdpGrowth.toFixed(6)),
                    total_treasury_change: parseFloat(totalTreasuryChange.toFixed(2))
                },
                system_stats: {
                    active_states: activeParameters.length,
                    last_update_check: new Date().toISOString()
                },
                recent_logs: recentLogs.slice(0, 5) // Últimos 5 logs
            };

        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }

    /**
     * Validar integridade dos dados econômicos
     * @param {string} userId - ID do usuário (opcional)
     * @returns {Promise<Object>} - Resultado da validação
     */
    async validateEconomicIntegrity(userId = null) {
        const issues = [];
        let checkedStates = 0;

        try {
            let parameters;
            
            if (userId) {
                const singleParam = await this.parameterRepository.findByUserId(userId);
                parameters = singleParam ? [singleParam] : [];
            } else {
                parameters = await this.parameterRepository.findAllActive();
            }

            for (const parameter of parameters) {
                checkedStates++;
                
                const stateData = await this.stateRepository.findCompleteStateDataByUserId(parameter.user_id);
                if (!stateData) {
                    issues.push({
                        user_id: parameter.user_id,
                        type: 'missing_state_data',
                        description: 'Estado não encontrado para parâmetros existentes'
                    });
                    continue;
                }

                const economy = stateData.economy;

                // Verificar valores negativos inválidos
                if (economy.gdp < ECONOMIC_CONSTANTS.MIN_GDP_VALUE) {
                    issues.push({
                        user_id: parameter.user_id,
                        type: 'invalid_gdp',
                        description: `PIB muito baixo: ${economy.gdp}`,
                        current_value: economy.gdp,
                        min_expected: ECONOMIC_CONSTANTS.MIN_GDP_VALUE
                    });
                }

                if (economy.treasury_balance < (parameter.min_treasury_balance || 0)) {
                    issues.push({
                        user_id: parameter.user_id,
                        type: 'treasury_below_minimum',
                        description: `Tesouro abaixo do mínimo: ${economy.treasury_balance}`,
                        current_value: economy.treasury_balance,
                        min_expected: parameter.min_treasury_balance
                    });
                }

                // Verificar consistência de receitas/despesas
                const expectedRevenue = economy.gdp * parameter.getEffectiveTaxRate();
                const revenueDifference = Math.abs(economy.monthly_revenue - expectedRevenue) / expectedRevenue;
                
                if (revenueDifference > 0.10) { // Mais de 10% de diferença
                    issues.push({
                        user_id: parameter.user_id,
                        type: 'revenue_inconsistency',
                        description: 'Receita inconsistente com PIB e parâmetros',
                        current_revenue: economy.monthly_revenue,
                        expected_revenue: expectedRevenue,
                        difference_percentage: (revenueDifference * 100).toFixed(2)
                    });
                }
            }

            return {
                validation_completed: true,
                checked_states: checkedStates,
                issues_found: issues.length,
                issues: issues,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Erro na validação de integridade:', error);
            throw error;
        }
    }
}

module.exports = EconomicEngineService;