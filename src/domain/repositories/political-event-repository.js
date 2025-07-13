const { supabase } = require('../../infrastructure/database/supabase-client');
const { 
    PoliticalEvent, 
    EventDecisionOption, 
    PlayerDecision, 
    AgentReaction 
} = require('../entities/political-event');

class PoliticalEventRepository {
    /**
     * Criar novo evento político
     * @param {Object} eventData - Dados do evento
     * @returns {Promise<PoliticalEvent>} - Evento criado
     */
    async createEvent(eventData) {
        const { data, error } = await supabase
            .from('political_events')
            .insert([eventData])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar evento: ${error.message}`);
        }

        return new PoliticalEvent(data);
    }

    /**
     * Criar opções de decisão para um evento
     * @param {Array} optionsData - Array de opções
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
     * Buscar evento ativo por usuário
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

    /**
     * Registrar decisão do jogador
     * @param {Object} decisionData - Dados da decisão
     * @returns {Promise<PlayerDecision>} - Decisão registrada
     */
    async createPlayerDecision(decisionData) {
        const { data, error } = await supabase
            .from('player_decisions')
            .insert([decisionData])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao registrar decisão: ${error.message}`);
        }

        return new PlayerDecision(data);
    }

    /**
     * Salvar reação de agente (CORRIGIDO)
     * @param {Object} reactionData - Dados da reação
     * @returns {Promise<AgentReaction>} - Reação salva
     */
    async saveAgentReaction(reactionData) {
        // Filtrar dados para incluir apenas campos válidos da tabela
        const validData = {
            decision_id: reactionData.decision_id,
            agent_type: reactionData.agent_type,
            narrative_response: reactionData.narrative_response,
            institutional_persona: reactionData.institutional_persona || null,
            governance_impacts: reactionData.governance_impacts || {},
            economic_impacts: reactionData.economic_impacts || {},
            raw_impacts: reactionData.raw_impacts || {},
            processing_time_ms: reactionData.processing_time_ms || 0
        };

        const { data, error } = await supabase
            .from('agent_reactions')
            .insert([validData])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao salvar reação: ${error.message}`);
        }

        return new AgentReaction(data);
    }

    /**
     * Buscar decisão completa com reações
     * @param {string} decisionId - ID da decisão
     * @returns {Promise<PlayerDecision|null>} - Decisão com reações
     */
    async findDecisionWithReactions(decisionId) {
        const { data, error } = await supabase
            .from('player_decisions')
            .select(`
                *,
                agent_reactions (*)
            `)
            .eq('id', decisionId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar decisão: ${error.message}`);
        }

        const decision = new PlayerDecision(data);
        decision.agent_reactions = data.agent_reactions.map(reaction => new AgentReaction(reaction));
        
        return decision;
    }

    /**
     * Atualizar status do evento
     * @param {string} eventId - ID do evento
     * @param {string} status - Novo status
     * @returns {Promise<boolean>} - True se atualizado
     */
    async updateEventStatus(eventId, status) {
        const { error } = await supabase
            .from('political_events')
            .update({ 
                status,
                completed_at: status === 'completed' ? new Date().toISOString() : null
            })
            .eq('id', eventId);

        if (error) {
            throw new Error(`Erro ao atualizar status: ${error.message}`);
        }

        return true;
    }

    /**
     * Salvar histórico de impactos aplicados
     * @param {Object} impactData - Dados dos impactos
     * @returns {Promise<Object>} - Registro de impacto salvo
     */
    async saveAppliedImpacts(impactData) {
        const { data, error } = await supabase
            .from('applied_impacts')
            .insert([impactData])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao salvar impactos: ${error.message}`);
        }

        return data;
    }

    /**
     * Buscar histórico de eventos do usuário
     * @param {string} userId - ID do usuário
     * @param {number} limit - Limite de registros
     * @returns {Promise<Array<Object>>} - Histórico de eventos
     */
    async findEventHistoryByUserId(userId, limit = 10) {
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