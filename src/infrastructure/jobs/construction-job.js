const cron = require('node-cron');
const ConstructionService = require('../../application/services/construction-service');
const ConstructionAIService = require('../../application/services/construction-ai-service');
const StateService = require('../../application/services/state-service');
const GroqProvider = require('../ai/groq-provider');
const { supabase } = require('../database/supabase-client');
const CONSTRUCTION_CONSTANTS = require('../../shared/constants/construction-constants');

class ConstructionJob {
    constructor() {
        this.constructionService = new ConstructionService();
        const groqProvider = new GroqProvider();
        this.aiService = new ConstructionAIService(groqProvider);
        this.stateService = new StateService();
        this.isRunning = false;
        this.isActive = true;
        this.lastExecution = null;
        this.lastResult = null;
        this.jobTask = null; // Para armazenar a referência do cron job
    }

    /**
     * Inicializar job automatizada
     */
    start() {
        try {
            console.log('🏗️ Inicializando job de construções...');
            
            // Verificar se as constantes estão disponíveis
            if (!CONSTRUCTION_CONSTANTS.JOB_SCHEDULE) {
                console.error('❌ CONSTRUCTION_CONSTANTS.JOB_SCHEDULE não encontrado');
                console.log('📋 Constantes disponíveis:', Object.keys(CONSTRUCTION_CONSTANTS));
                throw new Error('Configuração de agendamento não encontrada');
            }

            console.log(`📅 Agendamento: ${CONSTRUCTION_CONSTANTS.JOB_SCHEDULE} (${CONSTRUCTION_CONSTANTS.JOB_TIMEZONE})`);

            // Agendar execução diária
            this.jobTask = cron.schedule(CONSTRUCTION_CONSTANTS.JOB_SCHEDULE, async () => {
                if (this.isActive) {
                    await this.executeConstructionUpdates();
                }
            }, {
                scheduled: true,
                timezone: CONSTRUCTION_CONSTANTS.JOB_TIMEZONE
            });

            console.log('✅ Job de construções ativada!');

        } catch (error) {
            console.error('❌ Erro ao inicializar job de construções:', error);
            throw error;
        }
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
        const progress = this.constructionService.calculateConstructionProgress(construction);

        // Completar se:
        // 1. Chegou no prazo estimado
        // 2. Progresso chegou a 100%
        // 3. Passou do prazo com pelo menos 95%
        return now >= estimatedEnd || 
               progress.percentage >= 100 || 
               (now > estimatedEnd && progress.percentage >= 95);
    }

    /**
     * Completar uma construção
     * @param {Object} construction - Dados da construção
     */
    async completeConstruction(construction) {
        try {
            console.log(`🏁 Completando construção: ${construction.name}`);

            // Calcular qualidade final
            const finalQuality = this.calculateFinalQuality(construction);
            
            // Gerar narrativa da conclusão usando IA
            const completionNarrative = await this.generateCompletionNarrative(construction, finalQuality);
            
            // Aplicar impactos de conclusão
            await this.applyCompletionImpacts(construction, finalQuality);

            // Aplicar penalidades de corrupção se descoberta
            if (construction.corruption_discovered) {
                await this.applyCorruptionPenalties(construction);
            }

            // Atualizar status para completado
            const { error } = await supabase
                .from('active_constructions')
                .update({
                    status: CONSTRUCTION_CONSTANTS.STATUS.COMPLETED,
                    completed_at: new Date().toISOString(),
                    final_quality: finalQuality,
                    completion_narrative: completionNarrative,
                    progress_percentage: 100
                })
                .eq('id', construction.id);

            if (error) {
                throw new Error(`Erro ao atualizar status: ${error.message}`);
            }

            console.log(`✅ Construção ${construction.name} completada com qualidade ${finalQuality}`);

        } catch (error) {
            console.error(`❌ Erro ao completar construção ${construction.id}:`, error);
            throw error;
        }
    }

    /**
     * Gerar narrativa de conclusão usando IA
     * @param {Object} construction - Dados da construção
     * @param {string} finalQuality - Qualidade final
     * @returns {Promise<string>} - Narrativa de conclusão
     */
    async generateCompletionNarrative(construction, finalQuality) {
        try {
            const stateData = await this.stateService.getCompleteStateData(construction.user_id);
            const progress = this.constructionService.calculateConstructionProgress(construction);

            const prompt = CONSTRUCTION_CONSTANTS.AI_PROMPTS.COMPLETION_NARRATIVE
                .replace('{constructionName}', construction.name)
                .replace('{stateName}', stateData.state_info?.state || 'Estado')
                .replace('{companyName}', construction.winning_company?.name || 'Empresa Vencedora')
                .replace('{finalCost}', construction.final_cost?.toFixed(2) || construction.construction_types?.base_cost)
                .replace('{actualDays}', Math.ceil((new Date() - new Date(construction.started_at)) / (1000 * 60 * 60 * 24)))
                .replace('{plannedDays}', construction.estimated_days || 'N/A')
                .replace('{hadCorruption}', construction.has_corruption ? 'Sim' : 'Não')
                .replace('{corruptionDiscovered}', construction.corruption_discovered ? 'Sim' : 'Não');

            const narrative = await this.aiService.generateCompletionNarrative(prompt);
            return narrative || this.generateQualityNarrative(construction);

        } catch (error) {
            console.error('❌ Erro ao gerar narrativa com IA, usando fallback:', error);
            return this.generateQualityNarrative(construction);
        }
    }

    /**
     * Aplicar impactos da conclusão da obra
     * @param {Object} construction - Dados da construção
     * @param {string} finalQuality - Qualidade final
     */
    async applyCompletionImpacts(construction, finalQuality) {
        try {
            const stateData = await this.stateService.getCompleteStateData(construction.user_id);
            const category = construction.construction_types?.category;
            const baseCost = construction.construction_types?.base_cost || 10;

            // Calcular impactos baseados na qualidade
            let qualityMultiplier = 1.0;
            let approvalBonus = 0;

            switch (finalQuality) {
                case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.EXCELLENT:
                    qualityMultiplier = 1.3;
                    approvalBonus = 3 + Math.random() * 2; // +3-5%
                    break;
                case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.GOOD:
                    qualityMultiplier = 1.1;
                    approvalBonus = 1 + Math.random() * 2; // +1-3%
                    break;
                case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.REGULAR:
                    qualityMultiplier = 0.9;
                    approvalBonus = 0.5 + Math.random() * 1; // +0.5-1.5%
                    break;
                case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.POOR:
                    qualityMultiplier = 0.7;
                    approvalBonus = -1 - Math.random() * 2; // -1 a -3%
                    break;
            }

            // Aplicar impactos por categoria
            let economicUpdates = {};
            let governanceUpdates = {};

            switch (category) {
                case CONSTRUCTION_CONSTANTS.CATEGORIES.HEALTH:
                    economicUpdates.healthcare_quality_index = 
                        Math.min(100, (stateData.economy?.healthcare_quality_index || 60) + (5 * qualityMultiplier));
                    break;
                
                case CONSTRUCTION_CONSTANTS.CATEGORIES.EDUCATION:
                    economicUpdates.education_index = 
                        Math.min(100, (stateData.economy?.education_index || 65) + (4 * qualityMultiplier));
                    break;
                
                case CONSTRUCTION_CONSTANTS.CATEGORIES.INFRASTRUCTURE:
                    economicUpdates.infrastructure_quality = 
                        Math.min(100, (stateData.economy?.infrastructure_quality || 70) + (6 * qualityMultiplier));
                    economicUpdates.gdp_growth_rate = 
                        Math.min(15, (stateData.economy?.gdp_growth_rate || 2) + (0.3 * qualityMultiplier));
                    break;
                
                case CONSTRUCTION_CONSTANTS.CATEGORIES.SECURITY:
                    governanceUpdates.security_index = 
                        Math.min(100, (stateData.governance?.security_index || 75) + (4 * qualityMultiplier));
                    break;
                
                case CONSTRUCTION_CONSTANTS.CATEGORIES.SOCIAL:
                    economicUpdates.social_programs_coverage = 
                        Math.min(100, (stateData.economy?.social_programs_coverage || 50) + (3 * qualityMultiplier));
                    break;
            }

            // Aplicar bonus de aprovação
            governanceUpdates.approval_rating = Math.min(100, 
                Math.max(0, (stateData.governance?.approval_rating || 50) + approvalBonus)
            );

            // Determinar tendência
            if (approvalBonus > 1) {
                governanceUpdates.approval_trend = 'rising';
            } else if (approvalBonus < 0) {
                governanceUpdates.approval_trend = 'falling';
            }

            // Aplicar atualizações
            if (Object.keys(economicUpdates).length > 0) {
                await this.stateService.updateEconomy(construction.user_id, economicUpdates);
            }

            if (Object.keys(governanceUpdates).length > 0) {
                await this.stateService.updateGovernance(construction.user_id, governanceUpdates);
            }

            console.log(`📈 Impactos aplicados: ${category} (Qualidade: ${finalQuality}, Aprovação: ${approvalBonus.toFixed(1)}%)`);

        } catch (error) {
            console.error('❌ Erro ao aplicar impactos de conclusão:', error);
            throw error;
        }
    }

    /**
     * Aplicar penalidades por corrupção descoberta
     * @param {Object} construction - Dados da construção
     */
    async applyCorruptionPenalties(construction) {
        try {
            console.log(`⚖️ Aplicando penalidades por corrupção na construção ${construction.id}`);

            const stateData = await this.stateService.getCompleteStateData(construction.user_id);
            
            // Penalidade de aprovação severa
            const approvalPenalty = 8 + Math.random() * 7; // 8-15% de perda
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
        try {
            console.log('🛑 Parando job de construções...');
            
            if (this.jobTask) {
                this.jobTask.stop();
                this.jobTask = null;
            }
            
            this.isActive = false;
            console.log('⏹️ Job de construções desativada');
        } catch (error) {
            console.error('❌ Erro ao parar job de construções:', error);
            throw error;
        }
    }
}

module.exports = ConstructionJob;