-- Tabela de parâmetros econômicos configuráveis
CREATE TABLE state_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state_id UUID NOT NULL REFERENCES user_states(id) ON DELETE CASCADE,
    
    -- Parâmetros de Arrecadação
    tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0150, -- 1,5% do PIB
    administrative_efficiency DECIMAL(5,4) NOT NULL DEFAULT 0.90, -- 90% de eficiência
    
    -- Parâmetros de Gastos
    expense_ratio DECIMAL(5,4) NOT NULL DEFAULT 0.0120, -- 1,2% do PIB em gastos
    expense_efficiency DECIMAL(5,4) NOT NULL DEFAULT 1.00, -- 100% dos gastos previstos
    
    -- Modificadores Especiais
    corruption_impact DECIMAL(5,4) NOT NULL DEFAULT 0.05, -- 5% de impacto da corrupção
    special_modifiers JSONB DEFAULT '{}', -- Para eventos futuros
    
    -- Limites e Controles
    max_treasury_growth_per_day DECIMAL(15,2) DEFAULT NULL, -- Limite de crescimento diário
    min_treasury_balance DECIMAL(15,2) DEFAULT 0.00, -- Tesouro mínimo
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Garantir um registro por estado ativo
    UNIQUE(user_id, state_id)
);

-- Tabela de logs de atualizações econômicas
CREATE TABLE economic_update_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state_id UUID NOT NULL REFERENCES user_states(id) ON DELETE CASCADE,
    
    -- Dados anteriores
    previous_gdp DECIMAL(15,2) NOT NULL,
    previous_treasury DECIMAL(15,2) NOT NULL,
    previous_monthly_revenue DECIMAL(12,2) NOT NULL,
    previous_monthly_expenses DECIMAL(12,2) NOT NULL,
    
    -- Dados atualizados
    new_gdp DECIMAL(15,2) NOT NULL,
    new_treasury DECIMAL(15,2) NOT NULL,
    new_monthly_revenue DECIMAL(12,2) NOT NULL,
    new_monthly_expenses DECIMAL(12,2) NOT NULL,
    
    -- Metadados do cálculo
    days_processed INTEGER NOT NULL,
    gdp_growth_applied DECIMAL(8,6) NOT NULL,
    daily_cash_flow DECIMAL(12,2) NOT NULL,
    
    -- Timestamp
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para otimização
CREATE INDEX idx_state_parameters_user_id ON state_parameters(user_id);
CREATE INDEX idx_state_parameters_state_id ON state_parameters(state_id);
CREATE INDEX idx_economic_logs_user_id ON economic_update_logs(user_id);
CREATE INDEX idx_economic_logs_state_id ON economic_update_logs(state_id);
CREATE INDEX idx_economic_logs_processed_at ON economic_update_logs(processed_at);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_state_parameters_updated_at 
    BEFORE UPDATE ON state_parameters 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Inserir parâmetros padrão para estados existentes
INSERT INTO state_parameters (user_id, state_id, tax_rate, administrative_efficiency, expense_ratio, expense_efficiency, corruption_impact)
SELECT 
    se.user_id,
    se.state_id,
    0.0150, -- 1,5% de arrecadação
    0.90,   -- 90% de eficiência administrativa
    0.0120, -- 1,2% de gastos
    1.00,   -- 100% de eficiência nos gastos
    CASE 
        WHEN sg.corruption_index IS NOT NULL THEN sg.corruption_index / 1000 -- Converter índice para decimal
        ELSE 0.05 -- 5% padrão
    END
FROM state_economies se
LEFT JOIN state_governance sg ON se.id = sg.economy_id
WHERE NOT EXISTS (
    SELECT 1 FROM state_parameters sp 
    WHERE sp.user_id = se.user_id AND sp.state_id = se.state_id
);