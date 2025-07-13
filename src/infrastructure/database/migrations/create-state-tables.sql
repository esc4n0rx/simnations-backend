-- Tabela de economias dos estados
CREATE TABLE state_economies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state_id UUID NOT NULL REFERENCES user_states(id) ON DELETE CASCADE,
    
    -- Dados populacionais
    population BIGINT NOT NULL CHECK (population > 0),
    population_growth_rate DECIMAL(5,2) DEFAULT 0.00, -- % anual
    
    -- Dados econômicos
    treasury_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00, -- Em milhões
    gdp DECIMAL(15,2) NOT NULL CHECK (gdp > 0), -- PIB em milhões
    gdp_growth_rate DECIMAL(5,2) DEFAULT 0.00, -- % anual
    
    -- Dívidas e obrigações
    total_debt DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    debt_to_gdp_ratio DECIMAL(5,2) DEFAULT 0.00, -- %
    
    -- Indicadores sociais
    unemployment_rate DECIMAL(5,2) DEFAULT 5.00, -- %
    inflation_rate DECIMAL(5,2) DEFAULT 2.00, -- %
    
    -- Receitas e gastos mensais
    monthly_revenue DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    monthly_expenses DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Garantir um registro por estado ativo
    UNIQUE(user_id, state_id)
);

-- Tabela de governança dos estados
CREATE TABLE state_governance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state_id UUID NOT NULL REFERENCES user_states(id) ON DELETE CASCADE,
    economy_id UUID NOT NULL REFERENCES state_economies(id) ON DELETE CASCADE,
    
    -- Aprovação popular
    approval_rating DECIMAL(5,2) NOT NULL DEFAULT 50.00 CHECK (approval_rating >= 0 AND approval_rating <= 100),
    approval_trend VARCHAR(20) DEFAULT 'stable', -- 'rising', 'falling', 'stable'
    
    -- Estabilidade política
    political_stability DECIMAL(5,2) NOT NULL DEFAULT 75.00 CHECK (political_stability >= 0 AND political_stability <= 100),
    corruption_index DECIMAL(5,2) DEFAULT 30.00 CHECK (corruption_index >= 0 AND corruption_index <= 100),
    
    -- Riscos e eventos
    coup_risk_level VARCHAR(20) DEFAULT 'very_low', -- 'very_low', 'low', 'medium', 'high', 'critical'
    protest_level VARCHAR(20) DEFAULT 'none', -- 'none', 'minor', 'moderate', 'major', 'widespread'
    
    -- Relações internacionais
    international_relations DECIMAL(5,2) DEFAULT 70.00 CHECK (international_relations >= 0 AND international_relations <= 100),
    
    -- Histórico de decisões (para IA futura)
    decision_count INTEGER DEFAULT 0,
    positive_decisions INTEGER DEFAULT 0,
    negative_decisions INTEGER DEFAULT 0,
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Garantir um registro por estado ativo
    UNIQUE(user_id, state_id)
);

-- Índices para otimização
CREATE INDEX idx_state_economies_user_id ON state_economies(user_id);
CREATE INDEX idx_state_economies_state_id ON state_economies(state_id);
CREATE INDEX idx_state_governance_user_id ON state_governance(user_id);
CREATE INDEX idx_state_governance_state_id ON state_governance(state_id);
CREATE INDEX idx_state_governance_economy_id ON state_governance(economy_id);

-- Triggers para atualizar updated_at
CREATE TRIGGER update_state_economies_updated_at 
    BEFORE UPDATE ON state_economies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_state_governance_updated_at 
    BEFORE UPDATE ON state_governance 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar economia base realística
CREATE OR REPLACE FUNCTION generate_base_economy(
    p_country VARCHAR,
    p_state_name VARCHAR,
    p_user_scores JSONB
) RETURNS JSONB AS $$
DECLARE
    base_population BIGINT;
    base_gdp DECIMAL(15,2);
    result JSONB;
BEGIN
    -- Definir população base por país/estado (valores realísticos)
    CASE 
        WHEN p_country = 'Brasil' THEN
            CASE p_state_name
                WHEN 'São Paulo' THEN base_population := 45000000;
                WHEN 'Rio de Janeiro' THEN base_population := 17000000;
                WHEN 'Minas Gerais' THEN base_population := 21000000;
                ELSE base_population := 8000000;
            END CASE;
        WHEN p_country = 'Estados Unidos' THEN
            CASE p_state_name
                WHEN 'California' THEN base_population := 39000000;
                WHEN 'Texas' THEN base_population := 29000000;
                WHEN 'Florida' THEN base_population := 21000000;
                ELSE base_population := 6000000;
            END CASE;
        ELSE 
            base_population := 5000000;
    END CASE;
    
    -- Ajustar população baseado nas características do usuário (+/- 20%)
    base_population := base_population * (0.8 + (random() * 0.4));
    
    -- Calcular PIB base (aproximadamente $20k-60k per capita)
    base_gdp := base_population * (20000 + (random() * 40000)) / 1000000; -- Converter para milhões
    
    -- Construir resultado
    result := jsonb_build_object(
        'population', base_population,
        'population_growth_rate', 0.5 + (random() * 2.0), -- 0.5% a 2.5%
        'gdp', base_gdp,
        'gdp_growth_rate', -1.0 + (random() * 6.0), -- -1% a 5%
        'treasury_balance', base_gdp * (0.05 + (random() * 0.15)), -- 5-20% do PIB
        'total_debt', base_gdp * (0.20 + (random() * 0.40)), -- 20-60% do PIB
        'unemployment_rate', 3.0 + (random() * 8.0), -- 3-11%
        'inflation_rate', 0.5 + (random() * 4.0), -- 0.5-4.5%
        'monthly_revenue', base_gdp * 12 * (0.15 + (random() * 0.10)), -- 15-25% do PIB anual
        'monthly_expenses', base_gdp * 12 * (0.18 + (random() * 0.12)) -- 18-30% do PIB anual
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar governança base
CREATE OR REPLACE FUNCTION generate_base_governance() RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'approval_rating', 45.0 + (random() * 20.0), -- 45-65% (início neutro)
        'approval_trend', 'stable',
        'political_stability', 65.0 + (random() * 20.0), -- 65-85%
        'corruption_index', 20.0 + (random() * 30.0), -- 20-50%
        'coup_risk_level', 'very_low',
        'protest_level', 'none',
        'international_relations', 60.0 + (random() * 25.0) -- 60-85%
    );
END;
$$ LANGUAGE plpgsql;



-- Adicionar ao final do arquivo create-state-tables.sql

-- Função RPC para incrementar reload_count de forma atômica
CREATE OR REPLACE FUNCTION increment_reload_count(user_id_param UUID)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    country VARCHAR,
    state VARCHAR,
    assigned_at TIMESTAMP WITH TIME ZONE,
    reload_count INTEGER,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    UPDATE user_states 
    SET reload_count = reload_count + 1
    WHERE user_states.user_id = user_id_param 
    AND user_states.is_active = true
    RETURNING 
        user_states.id,
        user_states.user_id,
        user_states.country,
        user_states.state,
        user_states.assigned_at,
        user_states.reload_count,
        user_states.is_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;