const cron = require('node-cron');
const ConstructionService = require('../../application/services/construction-service');
const ConstructionAIService = require('../../application/services/construction-ai-service');
const StateService = require('../../application/services/state-service');
const { supabase } = require('../database/supabase-client');
const { CONSTRUCTION_CONSTANTS } = require('../../shared/constants/construction-constants');

class ConstructionJob {
    constructor() {
        this.constructionService = new ConstructionService();
        this.aiService = new ConstructionAIService();
        this.stateService = new StateService();
        this.isRunning = false;
        this.isActive = true;
        this.lastExecution = null;
        this.lastResult = null;
    }

    /**
     * Inicializar job automatizada
     */
    start() {
        console.log('🏗️ Inicializando job de construções...');
        console.log(`📅 Agendamento: ${CONSTRUCTION_CONSTANTS.JOB_SCHEDULE} (${CONSTRUCTION_CONSTANTS.JOB_TIMEZONE})`);

        // Agendar execução diária
        cron.schedule(CONSTRUCTION_CONSTANTS.JOB_SCHEDULE, async () => {
            if (this.isActive) {
                await this.executeConstructionUpdates();
            }
        }, {
            scheduled: true,
            timezone: CONSTRUCTION_CONSTANTS.JOB_TIMEZONE
        });

        console.log('✅ Job de construções ativada!');
    }

    /**
     * Executar atualizações de construções
     */
    async executeConstructionUpdates() {
        if (this.isRunning) {
            console.warn('⚠️ Job de construções já está em execução, pulando...');
            return;
        }

        this.isRunning = true;
        this.lastExecution = new Date();

        try {
            console.log('🚀 Iniciando execução da job de construções...');
            
            const result = await this.processAllConstructions();
            this.lastResult = result;

            console.log('✅ Job de construções concluída com sucesso!');
            console.log(`📊 Resultado: ${result.processed_constructions} construções processadas, ${result.completed_constructions} finalizadas`);

        } catch (error) {
            console.error('❌ Erro crítico na job de construções:', error);
            this.lastResult = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Processar todas as construções em andamento
     * @returns {Promise<Object>} - Resultado do processamento
     */
    async processAllConstructions() {
        try {
            console.log('🔄 Processando todas as construções em andamento...');

            // Buscar construções em progresso
            const { data: constructions, error } = await supabase
                .from('active_constructions')
                .select(`
                    *,
                    construction_types (*),
                    user_states (state, country)
                `)
                .eq('status', CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS);

            if (error) {
                throw new Error(`Erro ao buscar construções: ${error.message}`);
            }

            let processedConstructions = 0;
            let completedConstructions = 0;
            const errors = [];

            for (const construction of constructions) {
                try {
                    await this.processConstruction(construction);
                    processedConstructions++;

                    // Verificar se foi completada
                    if (this.shouldCompleteConstruction(construction)) {
                        await this.completeConstruction(construction);
                        completedConstructions++;
                    }

                } catch (error) {
                    console.error(`❌ Erro ao processar construção ${construction.id}:`, error);
                    errors.push({
                        construction_id: construction.id,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                processed_constructions: processedConstructions,
                completed_constructions: completedConstructions,
                total_constructions: constructions.length,
                errors: errors,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Erro no processamento geral:', error);
            throw error;
        }
    }

    /**
     * Processar uma construção individual
     * @param {Object} construction - Dados da construção
     */
    async processConstruction(construction) {
        try {
            // Atualizar progresso baseado no tempo
            const progress = this.constructionService.calculateConstructionProgress(construction);
            
            // Atualizar no banco se houve mudança significativa
            if (Math.abs(progress.percentage - construction.progress_percentage) > 1) {
                await supabase
                    .from('active_constructions')
                    .update({
                        progress_percentage: progress.percentage,
                        delay_days: progress.delayDays
                    })
                    .eq('id', construction.id);
            }

            // Verificar se houve descoberta de corrupção (chance aleatória)
            if (construction.has_corruption && !construction.corruption_discovered) {
                await this.checkCorruptionDiscovery(construction);
            }

        } catch (error) {
            console.error(`❌ Erro ao processar construção ${construction.id}:`, error);
            throw error;
        }
    }

    /**
     * Verificar se construção deve ser completada
     * @param {Object} construction - Dados da construção
     * @returns {boolean} - Se deve completar
     */
    shouldCompleteConstruction(construction) {
        const now = new Date();
        const estimatedEnd = new Date(construction.estimated_completion);
        
        // Completar se passou da data estimada
        return now >= estimatedEnd;
    }

    /**
     * Completar construção
     * @param {Object} construction - Dados da construção
     */
    async completeConstruction(construction) {
        try {
            console.log(`🎉 Completando construção: ${construction.construction_types.name}`);

            // Gerar narrativa de conclusão via IA
            const completionData = {
                construction_name: construction.construction_types.name,
                state_name: `${construction.user_states.state}, ${construction.user_states.country}`,
                company_name: construction.winning_company?.name || 'Empresa Vencedora',
                total_cost: construction.final_cost,
                actual_days: Math.ceil((new Date() - new Date(construction.started_at)) / (1000 * 60 * 60 * 24)),
                planned_days: construction.construction_types.construction_days,
                had_corruption: construction.has_corruption,
                corruption_discovered: construction.corruption_discovered
            };

            const narrative = await this.aiService.generateCompletionNarrative(
                construction.construction_types,
                completionData
            );

            // Aplicar impactos econômicos e sociais
            await this.applyConstructionImpacts(construction);

            // Atualizar status da construção
            await supabase
                .from('active_constructions')
                .update({
                    status: CONSTRUCTION_CONSTANTS.STATUS.COMPLETED,
                    progress_percentage: 100,
                    completed_at: new Date().toISOString()
                })
                .eq('id', construction.id);

            // Salvar no histórico
            await supabase
                .from('construction_history')
                .insert([{
                    user_id: construction.user_id,
                    state_id: construction.state_id,
                    construction_name: construction.construction_types.name,
                    category: construction.construction_types.category,
                    total_cost: construction.final_cost,
                    actual_days: completionData.actual_days,
                    planned_days: completionData.planned_days,
                    executor_company: construction.winning_company,
                    completion_narrative: narrative,
                    had_corruption: construction.has_corruption,
                    corruption_discovered: construction.corruption_discovered,
                    final_quality: this.calculateFinalQuality(construction),
                    quality_narrative: this.generateQualityNarrative(construction),
                    economic_impact_applied: construction.construction_types.economic_impact,
                    governance_impact_applied: construction.construction_types.population_impact,
                    completion_ai_context: {
                        completion_time: new Date().toISOString(),
                        had_delays: completionData.actual_days > completionData.planned_days
                    }
                }]);

            console.log(`✅ Construção ${construction.construction_types.name} completada com sucesso!`);

        } catch (error) {
            console.error(`❌ Erro ao completar construção ${construction.id}:`, error);
            throw error;
        }
    }

    /**
     * Aplicar impactos da construção no estado
     * @param {Object} construction - Dados da construção
     */
    async applyConstructionImpacts(construction) {
        try {
            const constructionType = construction.construction_types;

            // Aplicar impacto econômico (aumento no PIB mensal)
            if (constructionType.economic_impact > 0) {
                const stateData = await this.stateService.getCompleteStateData(construction.user_id);
                const currentGrowthRate = stateData.economy.gdp_growth_rate || 0;
                const newGrowthRate = currentGrowthRate + (constructionType.economic_impact / 12); // Converter para mensal

                await this.stateService.updateEconomy(construction.user_id, {
                    gdp_growth_rate: Math.min(10, newGrowthRate), // Máximo 10% ao ano
                    monthly_expenses: stateData.economy.monthly_expenses + constructionType.monthly_maintenance
                });
            }

            // Aplicar impacto na aprovação popular
            if (constructionType.population_impact !== 0) {
                const stateData = await this.stateService.getCompleteStateData(construction.user_id);
                const currentApproval = stateData.governance?.approval_rating || 50;
                const newApproval = Math.max(0, Math.min(100, currentApproval + constructionType.population_impact));
                // Ajustar tendência baseada no impacto
            let approvalTrend = 'stable';
            if (constructionType.population_impact > 1) {
                approvalTrend = 'rising';
            } else if (constructionType.population_impact < -1) {
                approvalTrend = 'falling';
            }

            await this.stateService.updateGovernance(construction.user_id, {
                approval_rating: newApproval,
                approval_trend: approvalTrend
            });
        }

        // Aplicar penalidades se corrupção foi descoberta
        if (construction.corruption_discovered) {
            await this.applyCorruptionPenalties(construction);
        }

    } catch (error) {
        console.error('❌ Erro ao aplicar impactos da construção:', error);
        throw error;
    }
}

/**
 * Aplicar penalidades por corrupção descoberta
 * @param {Object} construction - Dados da construção
 */
async applyCorruptionPenalties(construction) {
    try {
        console.log('⚖️ Aplicando penalidades por corrupção descoberta...');

        const stateData = await this.stateService.getCompleteStateData(construction.user_id);

        // Penalidades na aprovação
        const approvalPenalty = 8 + Math.random() * 7; // 8-15% de penalidade
        const newApproval = Math.max(0, (stateData.governance?.approval_rating || 50) - approvalPenalty);

        // Aumento do índice de corrupção
        const corruptionIncrease = 10 + Math.random() * 10; // 10-20 pontos
        const newCorruptionIndex = Math.min(100, (stateData.governance?.corruption_index || 30) + corruptionIncrease);

        // Aumento do risco de golpe
        let newCoupRisk = stateData.governance?.coup_risk_level || 'very_low';
        if (newApproval < 30 || newCorruptionIndex > 70) {
            newCoupRisk = 'high';
        } else if (newApproval < 40 || newCorruptionIndex > 60) {
            newCoupRisk = 'medium';
        }

        await this.stateService.updateGovernance(construction.user_id, {
            approval_rating: newApproval,
            approval_trend: 'falling',
            corruption_index: newCorruptionIndex,
            coup_risk_level: newCoupRisk,
            political_stability: Math.max(20, (stateData.governance?.political_stability || 75) - 15)
        });

        // Multa financeira (devolver parte da propina)
        const fine = construction.corruption_amount * 0.5; // 50% da propina como multa
        const newBalance = stateData.economy.treasury_balance - fine;

        await this.stateService.updateEconomy(construction.user_id, {
            treasury_balance: newBalance
        });

        console.log(`⚖️ Penalidades aplicadas: -${approvalPenalty.toFixed(1)}% aprovação, multa de R$ ${fine} milhões`);

    } catch (error) {
        console.error('❌ Erro ao aplicar penalidades de corrupção:', error);
        throw error;
    }
}

/**
 * Verificar descoberta de corrupção
 * @param {Object} construction - Dados da construção
 */
async checkCorruptionDiscovery(construction) {
    try {
        // Calcular chance de descoberta baseada em fatores
        const baseChance = CONSTRUCTION_CONSTANTS.CORRUPTION_DISCOVERY_CHANCE;
        
        // Fatores que aumentam a chance de descoberta
        const progress = this.constructionService.calculateConstructionProgress(construction);
        const progressFactor = progress.percentage / 100; // Mais chance conforme avança
        const delayFactor = progress.isDelayed ? 0.1 : 0; // Atrasos aumentam suspeita
        const costFactor = construction.final_cost > construction.construction_types?.base_cost * 1.2 ? 0.15 : 0;

        const totalChance = baseChance + (progressFactor * 0.2) + delayFactor + costFactor;
        
        if (Math.random() < totalChance) {
            console.log(`🔍 Corrupção descoberta na construção ${construction.id}!`);
            
            await supabase
                .from('active_constructions')
                .update({
                    corruption_discovered: true,
                    discovery_date: new Date().toISOString()
                })
                .eq('id', construction.id);

            // Aplicar impactos imediatos na governança
            const stateData = await this.stateService.getCompleteStateData(construction.user_id);
            const immediateApprovalLoss = 3 + Math.random() * 4; // 3-7% imediato
            
            await this.stateService.updateGovernance(construction.user_id, {
                approval_rating: Math.max(0, (stateData.governance?.approval_rating || 50) - immediateApprovalLoss),
                approval_trend: 'falling'
            });
        }

    } catch (error) {
        console.error('❌ Erro ao verificar descoberta de corrupção:', error);
        throw error;
    }
}

/**
 * Calcular qualidade final da obra
 * @param {Object} construction - Dados da construção
 * @returns {string} - Nível de qualidade
 */
calculateFinalQuality(construction) {
    const company = construction.winning_company;
    const progress = this.constructionService.calculateConstructionProgress(construction);
    
    let qualityScore = 70; // Base neutra
    
    // Fatores que influenciam qualidade
    if (company?.reliability_score) {
        qualityScore += (company.reliability_score - 0.5) * 40; // -20 a +20
    }
    
    if (company?.experience_level === 'excelente') {
        qualityScore += 15;
    } else if (company?.experience_level === 'alta') {
        qualityScore += 8;
    } else if (company?.experience_level === 'baixa') {
        qualityScore -= 10;
    }
    
    // Atrasos afetam qualidade
    if (progress.isDelayed) {
        qualityScore -= Math.min(20, progress.delayDays * 0.5);
    }
    
    // Corrupção pode afetar qualidade
    if (construction.has_corruption) {
        qualityScore -= 10 + Math.random() * 15; // -10 a -25
    }
    
    // Determinar nível final
    if (qualityScore >= 85) return CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.EXCELLENT;
    if (qualityScore >= 70) return CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.GOOD;
    if (qualityScore >= 50) return CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.REGULAR;
    return CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.POOR;
}

/**
 * Gerar narrativa sobre qualidade
 * @param {Object} construction - Dados da construção
 * @returns {string} - Narrativa da qualidade
 */
generateQualityNarrative(construction) {
    const quality = this.calculateFinalQuality(construction);
    const isDelayed = this.constructionService.calculateConstructionProgress(construction).isDelayed;
    const hasCorruption = construction.corruption_discovered;

    let narrative = '';

    switch (quality) {
        case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.EXCELLENT:
            narrative = 'Obra entregue com padrão de excelência, superando expectativas';
            break;
        case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.GOOD:
            narrative = 'Construção finalizada dentro dos padrões técnicos esperados';
            break;
        case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.REGULAR:
            narrative = 'Obra entregue com qualidade adequada, alguns ajustes menores necessários';
            break;
        case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.POOR:
            narrative = 'Qualidade final abaixo do esperado, necessitando correções';
            break;
    }

    if (isDelayed) {
        narrative += ', porém com atraso na entrega';
    }

    if (hasCorruption) {
        narrative += '. Investigação revelou irregularidades no processo licitatório';
    }

    return narrative;
}

/**
 * Executar manualmente (para testes)
 * @returns {Promise<Object>} - Resultado da execução
 */
async executeManual() {
    console.log('🔧 Execução manual da job de construções...');
    await this.executeConstructionUpdates();
    return this.lastResult;
}

/**
 * Obter status da job
 * @returns {Object} - Status atual
 */
getStatus() {
    return {
        is_running: this.isRunning,
        is_active: this.isActive,
        last_execution: this.lastExecution,
        last_result: this.lastResult,
        schedule: CONSTRUCTION_CONSTANTS.JOB_SCHEDULE,
        timezone: CONSTRUCTION_CONSTANTS.JOB_TIMEZONE
    };
}

/**
 * Parar job (para manutenção)
 */
stop() {
    console.log('🛑 Parando job de construções...');
    this.isActive = false;
    console.log('⏹️ Job de construções desativada');
}

}
module.exports = ConstructionJob;