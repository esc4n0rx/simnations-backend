-- Tabela de eventos políticos
CREATE TABLE political_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state_id UUID NOT NULL REFERENCES user_states(id) ON DELETE CASCADE,
    
    -- Dados do evento
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    
    -- Status e timing
    status VARCHAR(20) DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Contexto usado na geração
    context_snapshot JSONB NOT NULL
);

-- Tabela de opções de decisão
CREATE TABLE event_decision_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES political_events(id) ON DELETE CASCADE,
    
    -- Dados da opção
    option_index INTEGER NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    
    -- Consequências previstas
    predicted_impacts JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de decisões do jogador
CREATE TABLE player_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES political_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES event_decision_options(id) ON DELETE CASCADE,
    
    -- Dados da decisão
    decision_reasoning TEXT,
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de reações dos agentes
CREATE TABLE agent_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    decision_id UUID NOT NULL REFERENCES player_decisions(id) ON DELETE CASCADE,
    agent_type VARCHAR(50) NOT NULL,
    
    -- Reação narrativa
    narrative_response TEXT NOT NULL,
    
    -- Persona (para agente institucional)
    institutional_persona VARCHAR(50),
    
    -- Impactos gerados
    governance_impacts JSONB DEFAULT '{}',
    economic_impacts JSONB DEFAULT '{}',
    
    -- Metadados
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico de impactos aplicados
CREATE TABLE applied_impacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    decision_id UUID NOT NULL REFERENCES player_decisions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Estado anterior
    previous_governance JSONB NOT NULL,
    previous_economy JSONB NOT NULL,
    
    -- Estado posterior
    new_governance JSONB NOT NULL,
    new_economy JSONB NOT NULL,
    
    -- Detalhes dos impactos
    total_governance_changes JSONB NOT NULL,
    total_economic_changes JSONB NOT NULL,
    
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para otimização
CREATE INDEX idx_political_events_user_status ON political_events(user_id, status);
CREATE INDEX idx_political_events_created_at ON political_events(created_at);
CREATE INDEX idx_event_options_event_id ON event_decision_options(event_id);
CREATE INDEX idx_player_decisions_user_id ON player_decisions(user_id);
CREATE INDEX idx_player_decisions_decided_at ON player_decisions(decided_at);
CREATE INDEX idx_agent_reactions_decision_id ON agent_reactions(decision_id);
CREATE INDEX idx_applied_impacts_user_id ON applied_impacts(user_id);

-- Constraints para garantir integridade
ALTER TABLE event_decision_options ADD CONSTRAINT valid_option_index 
    CHECK (option_index >= 0 AND option_index <= 4);

ALTER TABLE political_events ADD CONSTRAINT valid_event_type 
    CHECK (event_type IN ('economic', 'social', 'political', 'administrative', 'infrastructure'));

ALTER TABLE political_events ADD CONSTRAINT valid_severity 
    CHECK (severity IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE political_events ADD CONSTRAINT valid_status 
    CHECK (status IN ('pending', 'completed', 'expired'));

-- Função para expirar eventos automaticamente
CREATE OR REPLACE FUNCTION expire_old_events()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE political_events 
    SET status = 'expired'
    WHERE status = 'pending' 
    AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger para executar expiração automaticamente
CREATE OR REPLACE FUNCTION trigger_expire_events()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM expire_old_events();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Executar expiração sempre que um novo evento for criado
CREATE TRIGGER auto_expire_events
    AFTER INSERT ON political_events
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_expire_events();