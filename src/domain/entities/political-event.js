class PoliticalEvent {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.state_id = data.state_id;
        this.title = data.title;
        this.description = data.description;
        this.event_type = data.event_type;
        this.severity = data.severity;
        this.status = data.status;
        this.expires_at = data.expires_at;
        this.created_at = data.created_at;
        this.completed_at = data.completed_at;
        this.context_snapshot = data.context_snapshot;
        this.options = data.options || [];
    }

    /**
     * Converte para objeto simples
     * @returns {Object} - Objeto do evento político
     */
    toObject() {
        return {
            id: this.id,
            user_id: this.user_id,
            state_id: this.state_id,
            title: this.title,
            description: this.description,
            event_type: this.event_type,
            severity: this.severity,
            status: this.status,
            expires_at: this.expires_at,
            created_at: this.created_at,
            completed_at: this.completed_at,
            context_snapshot: this.context_snapshot,
            options: this.options.map(option => option.toObject ? option.toObject() : option)
        };
    }

    /**
     * Verifica se o evento está expirado
     * @returns {boolean} - True se expirado
     */
    isExpired() {
        return this.expires_at && new Date() > new Date(this.expires_at);
    }

    /**
     * Calcula tempo restante em horas
     * @returns {number} - Horas restantes (0 se expirado)
     */
    getTimeRemainingHours() {
        if (!this.expires_at) return null;
        const diff = new Date(this.expires_at) - new Date();
        return Math.max(0, diff / (1000 * 60 * 60));
    }
}

class EventDecisionOption {
    constructor(data) {
        this.id = data.id;
        this.event_id = data.event_id;
        this.option_index = data.option_index;
        this.title = data.title;
        this.description = data.description;
        this.predicted_impacts = data.predicted_impacts || {};
        this.created_at = data.created_at;
    }

    toObject() {
        return {
            id: this.id,
            event_id: this.event_id,
            option_index: this.option_index,
            title: this.title,
            description: this.description,
            predicted_impacts: this.predicted_impacts,
            created_at: this.created_at
        };
    }
}

class PlayerDecision {
    constructor(data) {
        this.id = data.id;
        this.event_id = data.event_id;
        this.user_id = data.user_id;
        this.option_id = data.option_id;
        this.decision_reasoning = data.decision_reasoning;
        this.decided_at = data.decided_at;
        this.agent_reactions = data.agent_reactions || [];
    }

    toObject() {
        return {
            id: this.id,
            event_id: this.event_id,
            user_id: this.user_id,
            option_id: this.option_id,
            decision_reasoning: this.decision_reasoning,
            decided_at: this.decided_at,
            agent_reactions: this.agent_reactions.map(reaction => 
                reaction.toObject ? reaction.toObject() : reaction
            )
        };
    }
}

class AgentReaction {
    constructor(data) {
        this.id = data.id;
        this.decision_id = data.decision_id;
        this.agent_type = data.agent_type;
        this.narrative_response = data.narrative_response;
        this.institutional_persona = data.institutional_persona;
        this.governance_impacts = data.governance_impacts || {};
        this.economic_impacts = data.economic_impacts || {};
        this.processing_time_ms = data.processing_time_ms;
        this.created_at = data.created_at;
    }

    toObject() {
        return {
            id: this.id,
            decision_id: this.decision_id,
            agent_type: this.agent_type,
            narrative_response: this.narrative_response,
            institutional_persona: this.institutional_persona,
            governance_impacts: this.governance_impacts,
            economic_impacts: this.economic_impacts,
            processing_time_ms: this.processing_time_ms,
            created_at: this.created_at
        };
    }

    /**
     * Calcula impacto total somando governança e economia
     * @returns {Object} - Objeto com todos os impactos
     */
    getTotalImpacts() {
        return {
            ...this.governance_impacts,
            ...this.economic_impacts
        };
    }
}

module.exports = {
    PoliticalEvent,
    EventDecisionOption,
    PlayerDecision,
    AgentReaction
};