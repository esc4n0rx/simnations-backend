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

            // *** VERIFICAÇÃO MODIFICADA - USAR NOVO SISTEMA DE LIMITE DIÁRIO ***
            const canGenerate = await this.checkDailyEventLimit(userId);
            if (!canGenerate.allowed) {
                console.log(`⏰ Limite diário atingido: ${canGenerate.reason}`);
                return {
                    daily_limit_reached: true,
                    reason: canGenerate.reason,
                    events_generated_today: canGenerate.events_generated_today,
                    max_events_per_day: canGenerate.max_events_per_day,
                    next_reset_time: canGenerate.next_reset_time
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
                        recent_events_count: recentEvents.length,
                        daily_event_count: canGenerate.events_generated_today + 1
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

            console.log(`✅ Evento criado com sucesso! ID: ${createdEvent.id}`);
            console.log(`📊 Eventos gerados hoje: ${canGenerate.events_generated_today + 1}/${EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY}`);

            return {
                event: {
                    ...createdEvent.toObject(),
                    options: createdOptions.map(opt => opt.toObject())
                },
                generation_info: {
                    events_generated_today: canGenerate.events_generated_today + 1,
                    max_events_per_day: EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY,
                    remaining_events_today: EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY - (canGenerate.events_generated_today + 1)
                }
            };

        } catch (error) {
            console.error('❌ Erro ao gerar evento:', error);
            throw error;
        }
    }

    // *** NOVA LÓGICA DE VERIFICAÇÃO - SUBSTITUINDO checkEventGenerationCooldowns ***
    /**
     * Verificar limite diário de eventos do usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Resultado da verificação
     */
    async checkDailyEventLimit(userId) {
        try {
            console.log(`🔍 Verificando limite diário de eventos para usuário: ${userId}`);

            // Contar eventos gerados hoje
            const eventsToday = await this.eventRepository.countEventsGeneratedToday(userId);
            
            console.log(`📊 Eventos gerados hoje: ${eventsToday}/${EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY}`);

            // Verificar se atingiu o limite
            if (eventsToday >= EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY) {
                // Calcular quando o limite será resetado (próximo dia às 00:00)
                const nextReset = new Date();
                nextReset.setDate(nextReset.getDate() + 1);
                nextReset.setHours(EVENT_COOLDOWNS.DAILY_RESET_HOUR, 0, 0, 0);

                return {
                    allowed: false,
                    reason: `Limite diário de ${EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY} eventos atingido`,
                    events_generated_today: eventsToday,
                    max_events_per_day: EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY,
                    next_reset_time: nextReset.toISOString()
                };
            }

            return {
                allowed: true,
                reason: `Limite diário OK (${eventsToday}/${EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY})`,
                events_generated_today: eventsToday,
                max_events_per_day: EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY,
                remaining_today: EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY - eventsToday
            };

        } catch (error) {
            console.error('❌ Erro na verificação de limite diário:', error);
            // Em caso de erro, permitir geração para não travar o sistema
            return {
                allowed: true,
                reason: 'Erro na verificação, permitindo geração',
                events_generated_today: 0,
                max_events_per_day: EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY,
                error: error.message
            };
        }
    }

    /**
     * Tomar decisão em um evento
     * @param {string} userId - ID do usuário
     * @param {string} eventId - ID do evento
     * @param {Object} decisionData - Dados da decisão
     * @returns {Promise<Object>} - Resultado da decisão
     */
    async makeDecisionOnEvent(userId, eventId, decisionData) {
        try {
            console.log(`🎯 Processando decisão do usuário ${userId} no evento ${eventId}`);

            // Buscar evento e validar
            const event = await this.eventRepository.findEventById(eventId);
            if (!event || event.user_id !== userId) {
                throw new Error('Evento não encontrado ou não pertence ao usuário');
            }

            if (event.status !== DECISION_STATUS.PENDING) {
                throw new Error(`Evento não está ativo (status: ${event.status})`);
            }

            // Buscar dados do estado
            const stateData = await this.stateRepository.findCompleteStateDataByUserId(userId);
            
            // Encontrar opção escolhida
            const chosenOption = event.options.find(opt => opt.option_index === decisionData.chosen_option_index);
            if (!chosenOption) {
                throw new Error('Opção de decisão inválida');
            }

            // Gerar reações dos agentes
            const [populationReaction, institutionalReaction] = await Promise.all([
                this.populationAgent.generateReaction(event.toObject(), chosenOption.toObject(), stateData),
                this.institutionalAgent.generateReaction(event.toObject(), chosenOption.toObject(), stateData)
            ]);

            // Criar decisão do jogador
            const playerDecisionData = {
                event_id: eventId,
                user_id: userId,
                chosen_option_index: decisionData.chosen_option_index,
                decision_rationale: decisionData.rationale || null,
                processing_time_ms: Date.now()
            };

            const playerDecision = await this.eventRepository.createPlayerDecision(playerDecisionData);

            // Salvar reações dos agentes
            const agentReactionsData = [
                {
                    decision_id: playerDecision.id,
                    agent_type: 'population',
                    reaction_content: populationReaction.reaction,
                    impact_data: populationReaction.impacts
                },
                {
                    decision_id: playerDecision.id,
                    agent_type: 'institutional',
                    reaction_content: institutionalReaction.analysis,
                    impact_data: institutionalReaction.impacts
                }
            ];

            const agentReactions = await this.eventRepository.createAgentReactions(agentReactionsData);

            // Aplicar impactos no estado
            const combinedImpacts = this.combineAgentImpacts(populationReaction.impacts, institutionalReaction.impacts);
            await this.stateRepository.applyImpactsToState(userId, combinedImpacts);

            // Atualizar status do evento
            await this.eventRepository.updateEventStatus(eventId, DECISION_STATUS.COMPLETED);

            console.log(`✅ Decisão processada com sucesso para evento ${eventId}`);

            return {
                decision: playerDecision.toObject(),
                reactions: {
                    population: populationReaction,
                    institutional: institutionalReaction
                },
                impacts_applied: combinedImpacts,
                event_status: DECISION_STATUS.COMPLETED
            };

        } catch (error) {
            console.error('❌ Erro ao processar decisão:', error);
            throw error;
        }
    }

    /**
     * Combinar impactos dos agentes
     * @param {Object} populationImpacts - Impactos da população
     * @param {Object} institutionalImpacts - Impactos institucionais
     * @returns {Object} - Impactos combinados
     */
    combineAgentImpacts(populationImpacts, institutionalImpacts) {
        const combined = { governance: {}, economy: {} };

        // Combinar impactos de governança
        ['approval_rating', 'political_stability', 'corruption_index', 'protest_level', 'international_relations'].forEach(key => {
            const popImpact = populationImpacts[key] || 0;
            const instImpact = institutionalImpacts[key] || 0;
            combined.governance[key] = (popImpact + instImpact) / 2; // Média ponderada
        });

        // Combinar impactos econômicos
        ['monthly_revenue', 'monthly_expenses', 'gdp_growth_rate', 'treasury_balance', 'unemployment_rate', 'inflation_rate'].forEach(key => {
            const popImpact = populationImpacts[key] || 0;
            const instImpact = institutionalImpacts[key] || 0;
            combined.economy[key] = (popImpact + instImpact) / 2; // Média ponderada
        });

        return combined;
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
     * Verificar status do sistema de IA (CORRIGIDO)
     * @returns {Promise<Object>} - Status dos provedores
     */
    async checkAISystemStatus() {
        try {
            console.log('🔍 Verificando status do sistema de IA...');
            
            // Verificar disponibilidade do LLM sem retornar objetos circulares
            let isLLMAvailable = false;
            let llmError = null;
            
            try {
                isLLMAvailable = await this.llmProvider.isAvailable();
            } catch (error) {
                llmError = error.message;
                isLLMAvailable = false;
            }

            // Obter informações seguras do modelo
            const modelInfo = this.llmProvider.getModelInfo();

            // Status dos agentes (verificação simples)
            const agentsStatus = {
                scenario_agent: !!this.scenarioAgent,
                population_agent: !!this.populationAgent,
                institutional_agent: !!this.institutionalAgent
            };

            const systemReady = isLLMAvailable && 
                                agentsStatus.scenario_agent && 
                                agentsStatus.population_agent && 
                                agentsStatus.institutional_agent;

            console.log(`✅ Status do sistema: ${systemReady ? 'Pronto' : 'Não disponível'}`);

            return {
                llm_provider_available: isLLMAvailable,
                model_info: modelInfo, // Já filtrado no provider
                agents_status: agentsStatus,
                system_ready: systemReady,
                error: llmError,
                last_check: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Erro ao verificar status do sistema:', error);
            return {
                llm_provider_available: false,
                model_info: null,
                agents_status: {
                    scenario_agent: false,
                    population_agent: false,
                    institutional_agent: false
                },
                system_ready: false,
                error: error.message,
                last_check: new Date().toISOString()
            };
        }
    }
}

module.exports = PoliticalEventService;