const supabase = require('../../infrastructure/database/supabase-client');
const { PoliticalEvent, EventDecisionOption, PlayerDecision, AgentReaction } = require('../entities/political-event');

class PoliticalEventRepository {
    /**
     * Criar um novo evento político
     * @param {Object} eventData - Dados do evento
     * @returns {Promise<PoliticalEvent>} - Evento criado
     */
    async createEvent(eventData) {
        const { data, error } = await supabase
            .from('political_events')
            .insert(eventData)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar evento: ${error.message}`);
        }

        return new PoliticalEvent(data);
    }

    /**
     * Criar opções de decisão para um evento
     * @param {Array} optionsData - Array com opções
     * @returns {Promise<Array<EventDecisionOption>>} - Opções criadas
     */
    async createEventOptions(optionsData) {
        const { data, error } = await supabase
            .from('event_decision_options')
            .insert(optionsData)
            .select();

        if (error) {
            throw new Error(`Erro ao criar opções: ${error.message}`);
        }

        return data.map(option => new EventDecisionOption(option));
    }

    /**
     * Buscar evento ativo do usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<PoliticalEvent|null>} - Evento ativo ou null
     */
    async findActiveEventByUserId(userId) {
        const { data, error } = await supabase
            .from('political_events')
            .select(`
                *,
                event_decision_options (*)
            `)
            .eq('user_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar evento ativo: ${error.message}`);
        }

        const event = new PoliticalEvent(data);
        event.options = data.event_decision_options.map(opt => new EventDecisionOption(opt));
        
        return event;
    }

    /**
     * Criar decisão do jogador
     * @param {Object} decisionData - Dados da decisão
     * @returns {Promise<PlayerDecision>} - Decisão criada
     */
    async createPlayerDecision(decisionData) {
        const { data, error } = await supabase
            .from('player_decisions')
            .insert(decisionData)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar decisão: ${error.message}`);
        }

        return new PlayerDecision(data);
    }

    /**
     * Criar reações dos agentes
     * @param {Array} reactionsData - Array com reações
     * @returns {Promise<Array<AgentReaction>>} - Reações criadas
     */
    async createAgentReactions(reactionsData) {
        const { data, error } = await supabase
            .from('agent_reactions')
            .insert(reactionsData)
            .select();

        if (error) {
            throw new Error(`Erro ao criar reações: ${error.message}`);
        }

        return data.map(reaction => new AgentReaction(reaction));
    }

    /**
     * Verificar se usuário pode gerar novo evento
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Status de cooldown
     */
    async checkEventCooldown(userId) {
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Contar eventos gerados hoje
            const { count: eventsToday } = await supabase
                .from('political_events')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', todayStart.toISOString());

            // Buscar último evento
            const { data: lastEvent } = await supabase
                .from('political_events')
                .select('created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            const canGenerate = eventsToday < EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY;
            let nextEventAvailable = null;

            if (!canGenerate && lastEvent) {
                const lastEventTime = new Date(lastEvent.created_at);
                nextEventAvailable = new Date(lastEventTime.getTime() + (EVENT_COOLDOWNS.COOLDOWN_HOURS * 60 * 60 * 1000));
            }

            return {
                can_generate: canGenerate,
                events_generated_today: eventsToday || 0,
                max_events_per_day: EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY,
                next_event_available: nextEventAvailable
            };

        } catch (error) {
            console.error('❌ Erro na verificação de cooldown:', error);
            return {
                can_generate: false,
                events_generated_today: 0,
                max_events_per_day: EVENT_COOLDOWNS.MAX_EVENTS_PER_DAY,
                next_event_available: null
            };
        }
    }

    /**
     * Contar eventos do usuário hoje
     * @param {string} userId - ID do usuário
     * @returns {Promise<number>} - Número de eventos hoje
     */
    async countUserEventsToday(userId) {
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const { count, error } = await supabase
                .from('political_events')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', todayStart.toISOString());

            if (error) throw error;

            console.log(`📊 Usuário ${userId} gerou ${count || 0} eventos hoje`);
            return count || 0;

        } catch (error) {
            console.error('❌ Erro na contagem de eventos diários:', error);
            // Em caso de erro, retornar 0 para não bloquear o sistema
            return 0;
        }
    }

    /**
     * Buscar evento por ID
     * @param {string} eventId - ID do evento
     * @returns {Promise<PoliticalEvent|null>} - Evento ou null
     */
    async findEventById(eventId) {
        const { data, error } = await supabase
            .from('political_events')
            .select(`
                *,
                event_decision_options (*)
            `)
            .eq('id', eventId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar evento: ${error.message}`);
        }

        const event = new PoliticalEvent(data);
        event.options = data.event_decision_options.map(opt => new EventDecisionOption(opt));
        
        return event;
    }

    /**
     * Atualizar status do evento
     * @param {string} eventId - ID do evento
     * @param {string} status - Novo status
     * @returns {Promise<boolean>} - Sucesso da operação
     */
    async updateEventStatus(eventId, status) {
        const { error } = await supabase
            .from('political_events')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', eventId);

        if (error) {
            throw new Error(`Erro ao atualizar status: ${error.message}`);
        }

        return true;
    }

    /**
     * Buscar histórico de eventos do usuário
     * @param {string} userId - ID do usuário
     * @param {number} limit - Limite de registros
     * @returns {Promise<Array<PoliticalEvent>>} - Histórico completo
     */
    async findEventHistoryByUserId(userId, limit = 10) {
        const { data, error } = await supabase
            .from('political_events')
            .select(`
                *,
                player_decisions!inner (
                    *,
                    event_decision_options (*),
                    agent_reactions (*)
                )
            `)
            .eq('user_id', userId)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Erro ao buscar histórico: ${error.message}`);
        }

        return data.map(eventData => {
            const event = new PoliticalEvent(eventData);
            
            // Mapear decisões do jogador
            event.player_decisions = eventData.player_decisions.map(decision => {
                const playerDecision = new PlayerDecision(decision);
                
                // Mapear opção escolhida
                if (decision.event_decision_options) {
                    playerDecision.chosen_option = new EventDecisionOption(decision.event_decision_options);
                }
                
                // Mapear reações dos agentes
                playerDecision.agent_reactions = decision.agent_reactions.map(reaction => 
                    new AgentReaction(reaction)
                );
                
                return playerDecision;
            });
            
            return event;
        });
    }

    /**
     * Buscar eventos recentes do usuário (últimos 7 dias)
     * @param {string} userId - ID do usuário
     * @returns {Promise<Array<PoliticalEvent>>} - Eventos recentes
     */
    async findRecentEventsByUserId(userId) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data, error } = await supabase
            .from('political_events')
            .select(`
                *,
                player_decisions (
                    *,
                    event_decision_options (*),
                    agent_reactions (*)
                )
            `)
            .eq('user_id', userId)
            .gte('created_at', sevenDaysAgo.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Erro ao buscar eventos recentes: ${error.message}`);
        }

        return data.map(eventData => {
            const event = new PoliticalEvent(eventData);
            
            if (eventData.player_decisions && eventData.player_decisions.length > 0) {
                const decision = eventData.player_decisions[0];
                event.player_decision = new PlayerDecision(decision);
                
                if (decision.event_decision_options) {
                    event.player_decision.chosen_option = new EventDecisionOption(decision.event_decision_options);
                }
                
                if (decision.agent_reactions) {
                    event.player_decision.agent_reactions = decision.agent_reactions.map(reaction => 
                        new AgentReaction(reaction)
                    );
                }
            }
            
            return event;
        });
    }
}

module.exports = PoliticalEventRepository;