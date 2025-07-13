-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    birth_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de quiz results
CREATE TABLE quiz_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    racionalidade DECIMAL(3,1) NOT NULL CHECK (racionalidade >= 0 AND racionalidade <= 10),
    conservadorismo DECIMAL(3,1) NOT NULL CHECK (conservadorismo >= 0 AND conservadorismo <= 10),
    audacia DECIMAL(3,1) NOT NULL CHECK (audacia >= 0 AND audacia <= 10),
    autoridade DECIMAL(3,1) NOT NULL CHECK (autoridade >= 0 AND autoridade <= 10),
    coletivismo DECIMAL(3,1) NOT NULL CHECK (coletivismo >= 0 AND coletivismo <= 10),
    influencia DECIMAL(3,1) NOT NULL CHECK (influencia >= 0 AND influencia <= 10),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de estados atribuídos
CREATE TABLE user_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    country VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reload_count INTEGER DEFAULT 0 CHECK (reload_count >= 0 AND reload_count <= 3),
    is_active BOOLEAN DEFAULT true
);

-- Tabela de quiz answers (para auditoria)
CREATE TABLE quiz_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    answer_index INTEGER NOT NULL CHECK (answer_index >= 0 AND answer_index <= 4),
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para otimização
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX idx_user_states_user_id ON user_states(user_id);
CREATE INDEX idx_user_states_active ON user_states(user_id, is_active);
CREATE INDEX idx_quiz_answers_user_id ON quiz_answers(user_id);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at na tabela users
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
