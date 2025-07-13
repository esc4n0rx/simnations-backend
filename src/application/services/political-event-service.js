const PoliticalEventRepository = require('../../domain/repositories/political-event-repository');
const StateRepository = require('../../domain/repositories/state-repository');
const ScenarioAgentService = require('./scenario-agent-service');
const PopulationAgentService = require('./population-agent-service');
const InstitutionalAgentService = require('./institutional-agent-service');
const GroqProvider = require('../../infrastructure/ai/groq-provider');
const { EVENT_COOLDOWNS, DECISION_STATUS } = require('../../shared/constants/political-event-constants');

class PoliticalEventService {
    constructor() {
        this.eventRepository = new PoliticalEventRepository();
        this.stateRepository = new StateRepository();
        
        // Inicializar provedor de LLM
        this.llmProvider = new GroqProvider();
        
        // Inicializar agentes
        this.scenarioAgent = new ScenarioAgentService(this.llmProvider);
        this.populationAgent = new PopulationAgentService(this.llmProvider);
        this.institutionalAgent = new InstitutionalAgentService(this.llmProvider);
    }

    /**
     * Gerar novo evento político para um usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Evento gerado ou null se em cooldown
     */
    async generateEventForUser(userId) {
        try {
            console.log(`🎯 Gerando evento político para usuário: ${userId}`);

            // Verificar se usuário tem evento ativo
            const activeEvent = await this.eventRepository.findActiveEventByUserId(userId);
            if (activeEvent) {
                console.log('⚠️ Usuário já possui evento ativo');
                return {
                    has_active_event: true,
                    active_event: activeEvent.toObject()
                };
            }

            // Buscar dados completos do estado
            const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
            if (!stateData) {
                throw new Error('Dados do estado não encontrados');
            }

            // Verificar cooldowns de eventos recentes
            const canGenerate = await this.checkEventGenerationCooldowns(userId);
            if (!canGenerate.allowed) {
                console.log(`⏰ Em cooldown: ${canGenerate.reason}`);
                return {
                    in_cooldown: true,
                    reason: canGenerate.reason,
                    next_available: canGenerate.next_available
                };
            }

            // Buscar eventos recentes para contexto
            const recentEvents = await this.eventRepository.findRecentEventsByUserId(
                userId, 
                EVENT_COOLDOWNS.SAME_TYPE
            );

            // Gerar cenário usando Agente 1
            const scenarioData = await this.scenarioAgent.generateScenario(stateData, recentEvents);

            // Criar evento no banco
            const eventData = {
                user_id: userId,
                state_id: stateData.state_info.id,
                title: scenarioData.title,
                description: scenarioData.description,
                event_type: scenarioData.event_type,
                severity: scenarioData.severity,
                expires_at: scenarioData.expires_at,
                context_snapshot: {
                    economy: stateData.economy,
                    governance: stateData.governance,
                    generation_metadata: {
                        processing_time_ms: scenarioData.processing_time_ms,
                        generated_at: scenarioData.generated_at,
                        recent_events_count: recentEvents.length
                    }
                }
            };

            const createdEvent = await this.eventRepository.createEvent(eventData);

            // Criar opções de decisão
            const optionsData = scenarioData.options.map(option => ({
                event_id: createdEvent.id,
                option_index: option.option_index,
                title: option.title,
                description: option.description,
                predicted_impacts: option.predicted_impacts
            }));

            const createdOptions = await this.eventRepository.createEventOptions(optionsData);

            console.log(`✅ Evento criado: ${createdEvent.title}`);

            return {
                event: createdEvent.toObject(),
                options: createdOptions.map(opt => opt.toObject()),
                generation_metadata: scenarioData
            };

        } catch (error) {
            console.error('❌ Erro na geração de evento:', error);
            throw error;
        }
    }

    /**
     * Processar decisão do jogador
     * @param {string} userId - ID do usuário
     * @param {string} eventId - ID do evento
     * @param {string} optionId - ID da opção escolhida
     * @param {string} reasoning - Raciocínio do jogador (opcional)
     * @returns {Promise<Object>} - Resultado completo da decisão
     */
    async processPlayerDecision(userId, eventId, optionId, reasoning = null) {
        try {
            console.log(`⚖️ Processando decisão do usuário ${userId} para evento ${eventId}`);

            // Verificar se evento existe e está ativo
            const event = await this.eventRepository.findActiveEventByUserId(userId);
            if (!event || event.id !== eventId) {
                throw new Error('Evento não encontrado ou não está ativo');
            }

            // Verificar se opção existe
            const chosenOption = event.options.find(opt => opt.id === optionId);
            if (!chosenOption) {
                throw new Error('Opção de decisão não encontrada');
            }

            // Buscar dados atuais do estado
            const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
            if (!stateData) {
                throw new Error('Dados do estado não encontrados');
            }

            // Registrar decisão
            const decisionData = {
                event_id: eventId,
                user_id: userId,
                option_id: optionId,
                decision_reasoning: reasoning
            };

            const playerDecision = await this.eventRepository.createPlayerDecision(decisionData);

            // Gerar reações dos agentes em paralelo
            console.log('🤖 Gerando reações dos agentes...');
            
            const [populationReaction, institutionalReaction] = await Promise.allSettled([
                this.populationAgent.generatePopulationReaction(event, chosenOption, stateData),
                this.institutionalAgent.generateInstitutionalReaction(event, chosenOption, stateData)
            ]);

            // Processar reações geradas
            const reactions = [];
            
            // Reação da população
            if (populationReaction.status === 'fulfilled') {
                const savedPopulation = await this.eventRepository.saveAgentReaction({
                    decision_id: playerDecision.id,
                    ...populationReaction.value
                });
                reactions.push(savedPopulation);
            } else {
                console.error('❌ Erro na reação popular:', populationReaction.reason);
                // Usar fallback para reação popular
                const fallbackPopulation = this.populationAgent.generateFallbackReaction(event, chosenOption, stateData);
                const savedFallback = await this.eventRepository.saveAgentReaction({
                    decision_id: playerDecision.id,
                    ...fallbackPopulation
                });
                reactions.push(savedFallback);
            }

            // Reação institucional
            if (institutionalReaction.status === 'fulfilled') {
                const savedInstitutional = await this.eventRepository.saveAgentReaction({
                    decision_id: playerDecision.id,
                    ...institutionalReaction.value
                });
                reactions.push(savedInstitutional);
            } else {
                console.error('❌ Erro na reação institucional:', institutionalReaction.reason);
                // Usar fallback para reação institucional
                const fallbackInstitutional = this.institutionalAgent.generateFallbackReaction(event, chosenOption);
                const savedFallback = await this.eventRepository.saveAgentReaction({
                    decision_id: playerDecision.id,
                    ...fallbackInstitutional
                });
                reactions.push(savedFallback);
            }

            // Aplicar impactos no estado
            const appliedImpacts = await this.applyImpactsToState(userId, reactions, stateData);

            // Marcar evento como completo
            await this.eventRepository.updateEventStatus(eventId, DECISION_STATUS.COMPLETED);

            console.log('✅ Decisão processada com sucesso');

            return {
                decision: playerDecision.toObject(),
                chosen_option: chosenOption.toObject(),
                agent_reactions: reactions.map(r => r.toObject()),
                applied_impacts: appliedImpacts,
                new_state_data: await this.stateRepository.findCompleteStateDataByUserId(userId)
            };

        } catch (error) {
            console.error('❌ Erro no processamento da decisão:', error);
            throw error;
        }
    }

    /**
     * Aplicar impactos das reações no estado do usuário
     * @param {string} userId - ID do usuário
     * @param {Array} reactions - Array de reações dos agentes
     * @param {Object} currentStateData - Dados atuais do estado
     * @returns {Promise<Object>} - Impactos aplicados
     */
    async applyImpactsToState(userId, reactions, currentStateData) {
        try {
            console.log('📊 Aplicando impactos no estado...');

            const { economy, governance } = currentStateData;

            // Consolidar impactos de todas as reações
            const totalGovernanceImpacts = {};
            const totalEconomicImpacts = {};

            reactions.forEach(reaction => {
                // Somar impactos de governança
                Object.entries(reaction.governance_impacts).forEach(([field, value]) => {
                    totalGovernanceImpacts[field] = (totalGovernanceImpacts[field] || 0) + value;
                });

                // Somar impactos econômicos
                Object.entries(reaction.economic_impacts).forEach(([field, value]) => {
                    totalEconomicImpacts[field] = (totalEconomicImpacts[field] || 0) + value;
                });
            });

            // Preparar dados anteriores para log
            const previousGovernance = governance ? governance.toObject() : {};
            const previousEconomy = economy.toObject();

            // Aplicar impactos de governança
            const newGovernanceData = {};
            if (governance && Object.keys(totalGovernanceImpacts).length > 0) {
                Object.entries(totalGovernanceImpacts).forEach(([field, change]) => {
                    if (field === 'approval_rating' || field === 'political_stability' || field === 'international_relations') {
                        // Campos percentuais (0-100)
                        const currentValue = governance[field] || 50;
                        const newValue = Math.max(0, Math.min(100, currentValue + change));
                        newGovernanceData[field] = Math.round(newValue * 100) / 100;
                    } else if (field === 'corruption_index') {
                        // Índice de corrupção (0-100, onde 0 é melhor)
                        const currentValue = governance[field] || 30;
                        const newValue = Math.max(0, Math.min(100, currentValue + change));
                        newGovernanceData[field] = Math.round(newValue * 100) / 100;
                    } else if (field === 'protest_level_change') {
                        // Campo especial para mudança de nível de protesto
                        newGovernanceData.protest_level = change;
                    }
                });

                if (Object.keys(newGovernanceData).length > 0) {
                    await this.stateRepository.updateGovernance(governance.id, newGovernanceData);
                }
            }

            // Aplicar impactos econômicos
            const newEconomyData = {};
            if (Object.keys(totalEconomicImpacts).length > 0) {
                Object.entries(totalEconomicImpacts).forEach(([field, change]) => {
                    const currentValue = economy[field] || 0;
                    
                    if (field === 'monthly_revenue' || field === 'monthly_expenses' || field === 'treasury_balance') {
                        // Valores monetários em milhões
                        const newValue = Math.max(0, currentValue + change);
                        newEconomyData[field] = Math.round(newValue * 100) / 100;
                    } else if (field === 'gdp_growth_rate' || field === 'unemployment_rate' || field === 'inflation_rate') {
                        // Taxas percentuais
                        const newValue = currentValue + change;
                        // Aplicar limites razoáveis
                        if (field === 'unemployment_rate') {
                            newEconomyData[field] = Math.max(0, Math.min(50, newValue));
                        } else if (field === 'inflation_rate') {
                            newEconomyData[field] = Math.max(-5, Math.min(100, newValue));
                        } else { // gdp_growth_rate
                            newEconomyData[field] = Math.max(-20, Math.min(20, newValue));
                        }
                        newEconomyData[field] = Math.round(newEconomyData[field] * 100) / 100;
                    }
                });

                if (Object.keys(newEconomyData).length > 0) {
                    await this.stateRepository.updateEconomy(economy.id, newEconomyData);
                }
            }

            // Salvar log dos impactos aplicados
            const impactLogData = {
                decision_id: reactions[0].decision_id, // Todas as reações têm a mesma decision_id
                user_id: userId,
                previous_governance: previousGovernance,
                previous_economy: previousEconomy,
                new_governance: { ...previousGovernance, ...newGovernanceData },
                new_economy: { ...previousEconomy, ...newEconomyData },
                total_governance_changes: totalGovernanceImpacts,
                total_economic_changes: totalEconomicImpacts
            };

            const savedImpact = await this.eventRepository.saveAppliedImpacts(impactLogData);

            console.log('✅ Impactos aplicados com sucesso');

            return {
                governance_changes: newGovernanceData,
                economic_changes: newEconomyData,
                total_governance_impacts: totalGovernanceImpacts,
                total_economic_impacts: totalEconomicImpacts,
                impact_log_id: savedImpact.id
            };

        } catch (error) {
            console.error('❌ Erro ao aplicar impactos:', error);
            throw error;
        }
    }

    /**
     * Verificar cooldowns para geração de eventos
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Resultado da verificação
     */
    async checkEventGenerationCooldowns(userId) {
        try {
            // Verificar cooldown geral (mínimo entre qualquer evento)
            const recentEvents = await this.eventRepository.findRecentEventsByUserId(
                userId, 
                EVENT_COOLDOWNS.GENERAL, 
                1
            );

            if (recentEvents.length > 0) {
                const lastEvent = recentEvents[0];
                const nextAvailable = new Date(lastEvent.created_at);
                nextAvailable.setDate(nextAvailable.getDate() + EVENT_COOLDOWNS.GENERAL);
                
                return {
                    allowed: false,
                    reason: 'Cooldown geral ativo',
                    next_available: nextAvailable.toISOString()
                };
            }

            return {
                allowed: true,
                reason: 'Nenhum cooldown ativo'
            };

        } catch (error) {
            console.error('❌ Erro na verificação de cooldown:', error);
            // Em caso de erro, permitir geração
            return {
                allowed: true,
                reason: 'Erro na verificação, permitindo geração'
            };
        }
    }

    /**
     * Obter evento ativo do usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object|null>} - Evento ativo ou null
     */
    async getActiveEventForUser(userId) {
        const event = await this.eventRepository.findActiveEventByUserId(userId);
        return event ? event.toObject() : null;
    }

    /**
    * Obter histórico de eventos do usuário
    * @param {string} userId - ID do usuário
    * @param {number} limit - Limite de registros
    * @returns {Promise<Array>} - Histórico de eventos
    */
   async getEventHistoryForUser(userId, limit = 10) {
    const history = await this.eventRepository.findEventHistoryByUserId(userId, limit);
    return history.map(event => event.toObject());
}

/**
 * Forçar expiração de eventos antigos
 * @returns {Promise<number>} - Número de eventos expirados
 */
async expireOldEvents() {
    return await this.eventRepository.expireOldEvents();
}

/**
 * Verificar status do sistema de IA
 * @returns {Promise<Object>} - Status dos provedores
 */
async checkAISystemStatus() {
    try {
        const isLLMAvailable = await this.llmProvider.isAvailable();
        const modelInfo = this.llmProvider.getModelInfo();

        return {
            llm_provider_available: isLLMAvailable,
            model_info: modelInfo,
            agents_status: {
                scenario_agent: !!this.scenarioAgent,
                population_agent: !!this.populationAgent,
                institutional_agent: !!this.institutionalAgent
            },
            system_ready: isLLMAvailable && this.scenarioAgent && this.populationAgent && this.institutionalAgent
        };
    } catch (error) {
        return {
            llm_provider_available: false,
            error: error.message,
            system_ready: false
        };
    }
}
}

module.exports = PoliticalEventService;