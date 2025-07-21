-- Extensões necessárias (se não existirem)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de tipos de construção (pré-definidos e fixos)
CREATE TABLE construction_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'saude', 'educacao', 'infraestrutura', 'seguranca', 'social'
    
    -- Custos e tempo
    base_cost DECIMAL(12,2) NOT NULL CHECK (base_cost > 0), -- Em milhões
    monthly_maintenance DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Custo mensal
    construction_days INTEGER NOT NULL CHECK (construction_days > 0),
    
    -- Impactos
    economic_impact DECIMAL(5,2) DEFAULT 0.00, -- % impacto no PIB/mês
    population_impact DECIMAL(5,2) DEFAULT 0.00, -- % impacto na aprovação
    territorial_usage INTEGER DEFAULT 1, -- Para futuro sistema de mapa
    
    -- Requisitos
    min_gdp DECIMAL(15,2) DEFAULT 0.00, -- PIB mínimo necessário
    min_population BIGINT DEFAULT 0, -- População mínima necessária
    
    -- Contexto para IA
    ai_context_tags TEXT[], -- Tags para contextualização da IA
    specialization_required VARCHAR(100), -- Especialização necessária das empresas
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de construções ativas/em andamento
CREATE TABLE active_constructions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state_id UUID NOT NULL REFERENCES user_states(id) ON DELETE CASCADE,
    construction_type_id UUID NOT NULL REFERENCES construction_types(id),
    
    -- Status da construção
    status VARCHAR(20) NOT NULL DEFAULT 'planning', -- 'planning', 'bidding', 'in_progress', 'completed', 'cancelled'
    progress_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- Datas
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    estimated_completion DATE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    
    -- Financeiro
    final_cost DECIMAL(12,2) NOT NULL, -- Custo acordado na licitação
    paid_amount DECIMAL(12,2) DEFAULT 0.00, -- Valor já pago
    
    -- Dados da empresa vencedora (gerado por IA)
    winning_company JSONB DEFAULT NULL, -- Todos os dados da empresa gerada pela IA
    
    -- Corrupção
    has_corruption BOOLEAN DEFAULT false,
    corruption_amount DECIMAL(10,2) DEFAULT 0.00, -- Valor da propina
    corruption_discovered BOOLEAN DEFAULT false,
    discovery_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    
    -- Qualidade e problemas (gerado por IA)
    quality_issues JSONB DEFAULT NULL, -- Problemas encontrados durante execução
    delay_days INTEGER DEFAULT 0,
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de licitações (empresas geradas por IA)
CREATE TABLE construction_biddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    construction_id UUID NOT NULL REFERENCES active_constructions(id) ON DELETE CASCADE,
    
    -- Status da licitação
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed', 'cancelled'
    
    -- Empresas geradas pela IA (JSON completo)
    generated_companies JSONB NOT NULL DEFAULT '[]',
    
    -- Contexto utilizado pela IA
    ai_context JSONB NOT NULL DEFAULT '{}', -- Estado, economia, corrupção, etc.
    ai_prompt_used TEXT, -- Prompt exato usado na geração
    ai_response_time_ms INTEGER, -- Tempo de resposta da IA
    
    -- Empresa selecionada
    selected_company_index INTEGER DEFAULT NULL,
    selection_reason TEXT DEFAULT NULL,
    
    -- Datas
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico de construções completadas
CREATE TABLE construction_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state_id UUID NOT NULL REFERENCES user_states(id) ON DELETE CASCADE,
    
    -- Dados da construção copiados na conclusão
    construction_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL,
    actual_days INTEGER NOT NULL,
    planned_days INTEGER NOT NULL,
    
    -- Empresa que executou (dados completos gerados por IA)
    executor_company JSONB NOT NULL,
    
    -- Resultados e narrativa (gerado por IA)
    completion_narrative TEXT, -- História da conclusão da obra
    had_corruption BOOLEAN DEFAULT false,
    corruption_discovered BOOLEAN DEFAULT false,
    final_quality VARCHAR(20) DEFAULT 'boa', -- 'ruim', 'regular', 'boa', 'excelente'
    quality_narrative TEXT, -- Explicação da qualidade final
    
    -- Impactos aplicados
    economic_impact_applied DECIMAL(8,4) DEFAULT 0.00,
    governance_impact_applied DECIMAL(8,4) DEFAULT 0.00,
    
    -- Contexto da IA na conclusão
    completion_ai_context JSONB DEFAULT '{}',
    
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para otimização
CREATE INDEX idx_construction_types_category ON construction_types(category);
CREATE INDEX idx_construction_types_active ON construction_types(is_active);
CREATE INDEX idx_active_constructions_user_id ON active_constructions(user_id);
CREATE INDEX idx_active_constructions_status ON active_constructions(status);
CREATE INDEX idx_active_constructions_estimated_completion ON active_constructions(estimated_completion);
CREATE INDEX idx_construction_biddings_construction_id ON construction_biddings(construction_id);
CREATE INDEX idx_construction_history_user_id ON construction_history(user_id);

-- Triggers para atualizar updated_at
CREATE TRIGGER update_active_constructions_updated_at 
    BEFORE UPDATE ON active_constructions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Inserir dados iniciais de tipos de construção (FIXOS)
INSERT INTO construction_types (name, description, category, base_cost, monthly_maintenance, construction_days, economic_impact, population_impact, min_gdp, min_population, ai_context_tags, specialization_required) VALUES

-- Saúde
('Hospital Regional', 'Hospital de grande porte com 200 leitos e centro cirúrgico avançado', 'saude', 150.00, 8.50, 720, 0.15, 2.50, 5000.00, 500000, ARRAY['saúde', 'hospitalar', 'equipamentos médicos', 'UTI', 'centro cirúrgico'], 'construção hospitalar'),

('UBS Comunitária', 'Unidade Básica de Saúde para atendimento primário', 'saude', 8.50, 1.20, 180, 0.05, 1.20, 1000.00, 50000, ARRAY['saúde básica', 'atenção primária', 'comunidade'], 'construção civil básica'),

('Centro de Especialidades Médicas', 'Centro para consultas especializadas e exames', 'saude', 45.00, 3.80, 365, 0.08, 1.80, 2500.00, 200000, ARRAY['especialidades médicas', 'diagnóstico', 'exames'], 'construção hospitalar'),

-- Educação
('Universidade Estadual', 'Campus universitário com 10.000 vagas', 'educacao', 280.00, 12.00, 1095, 0.25, 3.20, 8000.00, 800000, ARRAY['ensino superior', 'campus', 'laboratórios', 'biblioteca'], 'construção educacional complexa'),

('Escola Técnica', 'Instituto de ensino técnico e profissionalizante', 'educacao', 65.00, 4.50, 540, 0.12, 2.10, 3000.00, 300000, ARRAY['ensino técnico', 'oficinas', 'laboratórios práticos'], 'construção educacional especializada'),

('Centro de Educação Infantil', 'Creche para 300 crianças de 0-5 anos', 'educacao', 25.00, 2.80, 270, 0.06, 1.50, 1500.00, 100000, ARRAY['educação infantil', 'segurança infantil', 'recreação'], 'construção educacional básica'),

-- Infraestrutura
('Rodovia Estadual', 'Construção de 50km de rodovia asfaltada', 'infraestrutura', 420.00, 6.20, 900, 0.35, 1.80, 12000.00, 1000000, ARRAY['rodovia', 'pavimentação', 'terraplanagem', 'drenagem'], 'obras rodoviárias'),

('Ponte Rodoviária', 'Ponte de grande porte sobre rio principal', 'infraestrutura', 185.00, 2.50, 720, 0.18, 1.20, 6000.00, 400000, ARRAY['ponte', 'estrutura metálica', 'fundação especial'], 'engenharia de estruturas'),

('Centro Logístico', 'Hub de distribuição e armazenagem', 'infraestrutura', 95.00, 3.20, 450, 0.22, 0.80, 4000.00, 300000, ARRAY['logística', 'armazenagem', 'distribuição'], 'construção industrial'),

-- Segurança
('Quartel da Polícia Militar', 'Base operacional com 200 policiais', 'seguranca', 55.00, 4.80, 360, 0.08, 2.20, 2500.00, 250000, ARRAY['segurança pública', 'quartel', 'armamento'], 'construção de segurança'),

('Centro de Reabilitação', 'Complexo penitenciário moderno', 'seguranca', 130.00, 8.90, 540, 0.05, -0.50, 5000.00, 500000, ARRAY['sistema prisional', 'segurança máxima', 'reabilitação'], 'construção penitenciária'),

('Central de Monitoramento', 'Sistema integrado de videomonitoramento', 'seguranca', 35.00, 2.10, 180, 0.03, 1.80, 2000.00, 200000, ARRAY['tecnologia', 'monitoramento', 'câmeras'], 'tecnologia de segurança'),

-- Social
('Centro Cultural', 'Complexo cultural com teatro e biblioteca', 'social', 75.00, 4.20, 450, 0.10, 2.80, 3500.00, 300000, ARRAY['cultura', 'teatro', 'biblioteca', 'arte'], 'construção cultural'),

('Parque Urbano', 'Área verde de 50 hectares com equipamentos', 'social', 28.00, 1.50, 270, 0.06, 2.20, 2000.00, 150000, ARRAY['meio ambiente', 'lazer', 'paisagismo'], 'paisagismo e urbanismo'),

('Centro Esportivo', 'Ginásio poliesportivo e piscina olímpica', 'social', 62.00, 3.50, 400, 0.08, 2.50, 3000.00, 250000, ARRAY['esporte', 'piscina', 'ginásio', 'atletismo'], 'construção esportiva');