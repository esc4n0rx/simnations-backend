class PoliticalEvent {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.state_id = data.state_id;
        this.title = data.title;
        this.description = data.description;
        this.event_type = data.event_type;
        this.severity = data.severity;
        this.status = data.status || 'pending';
        this.expires_at = data.expires_at;
        this.created_at = data.created_at;
        this.completed_at = data.completed_at;
        this.context_snapshot = data.context_snapshot || {};
        this.options = data.options || [];
    }

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
            options: this.options.map(option => 
                option.toObject ? option.toObject() : option)
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
        this.chosen_option_index = data.chosen_option_index;
        this.decision_rationale = data.decision_rationale;
        this.decided_at = data.decided_at;
        this.processing_time_ms = data.processing_time_ms;
        this.agent_reactions = data.agent_reactions || [];
        this.chosen_option = data.chosen_option || null;
    }

    toObject() {
        return {
            id: this.id,
            event_id: this.event_id,
            user_id: this.user_id,
            option_id: this.option_id,
            chosen_option_index: this.chosen_option_index,
            decision_rationale: this.decision_rationale,
            decided_at: this.decided_at,
            processing_time_ms: this.processing_time_ms,
            agent_reactions: this.agent_reactions.map(reaction => 
                reaction.toObject ? reaction.toObject() : reaction),
            chosen_option: this.chosen_option ? 
                (this.chosen_option.toObject ? this.chosen_option.toObject() : this.chosen_option) : null
        };
    }
}

class AgentReaction {
    constructor(data) {
        this.id = data.id;
        this.decision_id = data.decision_id;
        this.agent_type = data.agent_type;
        this.reaction_content = data.reaction_content;
        this.impact_data = data.impact_data || {};
        this.created_at = data.created_at;
    }

    toObject() {
        return {
            id: this.id,
            decision_id: this.decision_id,
            agent_type: this.agent_type,
            reaction_content: this.reaction_content,
            impact_data: this.impact_data,
            created_at: this.created_at
        };
    }
}

module.exports = {
    PoliticalEvent,
    EventDecisionOption,
    PlayerDecision,
    AgentReaction
};