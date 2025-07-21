const supabase = require('../../infrastructure/database/supabase-client');
const PoliticalEvent = require('../entities/political-event');
const EventDecisionOption = require('../entities/event-decision-option');
const PlayerDecision = require('../entities/player-decision');
const AgentReaction = require('../entities/agent-reaction');

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
     * Buscar eventos recentes do usuário
     * @param {string} userId - ID do usuário  
     * @param {number} days - Dias atrás para buscar
     * @param {number} limit - Limite de eventos
     * @returns {Promise<Array<PoliticalEvent>>} - Eventos recentes
     */
    async findRecentEventsByUserId(userId, days = 7, limit = 5) {
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - days);

        const { data, error } = await supabase
            .from('political_events')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', dateThreshold.toISOString())
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Erro ao buscar eventos recentes: ${error.message}`);
        }

        return data.map(event => new PoliticalEvent(event));
    }

    // *** NOVO MÉTODO - CONTAR EVENTOS GERADOS HOJE ***
    /**
     * Contar quantos eventos o usuário gerou hoje
     * @param {string} userId - ID do usuário
     * @returns {Promise<number>} - Quantidade de eventos gerados hoje
     */
    async countEventsGeneratedToday(userId) {
        try {
            // Obter início do dia atual (00:00:00)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Obter final do dia atual (23:59:59.999)
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const { count, error } = await supabase
                .from('political_events')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', today.toISOString())
                .lte('created_at', endOfDay.toISOString());

            if (error) {
                console.error('❌ Erro ao contar eventos do dia:', error);
                throw new Error(`Erro ao contar eventos do dia: ${error.message}`);
            }

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
            .in('status', ['completed', 'expired'])
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Erro ao buscar histórico: ${error.message}`);
        }

        return data.map(event => {
            const politicalEvent = new PoliticalEvent(event);
            politicalEvent.decisions = event.player_decisions.map(decision => {
                const playerDecision = new PlayerDecision(decision);
                playerDecision.option = new EventDecisionOption(decision.event_decision_options);
                playerDecision.agent_reactions = decision.agent_reactions.map(reaction => 
                    new AgentReaction(reaction)
                );
                return playerDecision;
            });
            return politicalEvent;
        });
    }

    /**
     * Verificar cooldown de tipos de evento
     * @param {string} userId - ID do usuário
     * @param {string} eventType - Tipo de evento
     * @param {number} hours - Horas de cooldown
     * @returns {Promise<boolean>} - True se pode criar evento deste tipo
     */
    async checkEventTypeCooldown(userId, eventType, hours = 168) { // 7 dias padrão
        const dateThreshold = new Date();
        dateThreshold.setHours(dateThreshold.getHours() - hours);

        const { data, error } = await supabase
            .from('political_events')
            .select('id')
            .eq('user_id', userId)
            .eq('event_type', eventType)
            .gte('created_at', dateThreshold.toISOString())
            .limit(1);

        if (error) {
            throw new Error(`Erro ao verificar cooldown: ${error.message}`);
        }

        return data.length === 0; // True se não há eventos recentes deste tipo
    }

    /**
     * Expirar eventos antigos pendentes
     * @returns {Promise<number>} - Número de eventos expirados
     */
    async expireOldEvents() {
        const { data, error } = await supabase
            .rpc('expire_old_events');

        if (error) {
            throw new Error(`Erro ao expirar eventos: ${error.message}`);
        }

        return data || 0;
    }
}

module.exports = PoliticalEventRepository;