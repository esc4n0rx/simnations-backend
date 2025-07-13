# SimNations Backend

[![Node.js](https://img.shields.io/badge/Node.js-18.0.0+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18.2-blue.svg)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.38.0-orange.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Backend robusto e escalável para o jogo **SimNations** - um simulador de gerenciamento de países que utiliza um sistema de quiz personalizado para determinar as características políticas e sociais de cada nação.

## Sobre o Projeto

O **SimNations** é um jogo de simulação política onde os jogadores respondem a um quiz personalizado que determina as características de sua nação virtual. O sistema analisa seis dimensões principais:

- **Racionalidade**: Tomada de decisões baseada em lógica e dados
- **Conservadorismo**: Tendência a manter tradições e valores estabelecidos
- **Audácia**: Disposição para mudanças e inovações
- **Autoridade**: Centralização do poder e hierarquia
- **Coletivismo**: Foco no bem comum vs. individualismo
- **Influência**: Capacidade de diplomacia e relações internacionais

Após completar o quiz, os jogadores recebem um estado real para gerenciar, com sistema completo de economia e governança que reflete suas escolhas políticas.

## Arquitetura

O projeto segue uma arquitetura **Clean Architecture** com separação clara de responsabilidades:

```
src/
├── application/          # Casos de uso e regras de negócio
│   ├── services/        # Serviços de aplicação
│   └── validators/      # Validação de dados
├── domain/              # Entidades e regras de domínio
│   ├── entities/        # Entidades do domínio
│   └── repositories/    # Interfaces dos repositórios
├── infrastructure/      # Implementações externas
│   ├── database/        # Configuração do banco de dados
│   └── security/        # Utilitários de segurança
├── presentation/        # Camada de apresentação
│   ├── controllers/     # Controladores da API
│   ├── middleware/      # Middlewares
│   └── routes/          # Definição das rotas
└── shared/             # Utilitários compartilhados
    ├── constants/       # Constantes do sistema
    └── utils/          # Utilitários gerais
```

### 🏛️ **Sistema de Estados**

O projeto agora inclui um sistema completo de gerenciamento de estados com:

- **Economia Dinâmica**: PIB, população, dívida, desemprego, inflação
- **Governança Política**: Aprovação, estabilidade, corrupção, risco de golpe
- **Análise Inteligente**: Sistema de análise que identifica desafios e recomendações
- **Reload de Estados**: Possibilidade de trocar de estado mantendo progresso
```

## Tecnologias

- **Node.js** (v18.0.0+) - Runtime JavaScript
- **Express.js** - Framework web
- **Supabase** - Banco de dados PostgreSQL
- **JWT** - Autenticação e autorização
- **bcryptjs** - Criptografia de senhas
- **Zod** - Validação de schemas
- **Helmet** - Segurança HTTP
- **CORS** - Cross-Origin Resource Sharing
- **Rate Limiting** - Proteção contra ataques

## Pré-requisitos

- Node.js 18.0.0 ou superior
- NPM ou Yarn
- Conta no Supabase (para banco de dados)
- Variáveis de ambiente configuradas

## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/esc4n0rx/simnations-backend.git
cd simnations-backend
```

### 2. Instale as dependências

```bash
npm install
```
### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Configurações do Servidor
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=sua_url_do_supabase
SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_do_supabase

# JWT
JWT_SECRET=seu_jwt_secret_super_seguro
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Frontend URL (para CORS)
FRONTEND_URL=http://localhost:3000
```
### 4. Configure o banco de dados

Execute o script de migração no Supabase:

```sql
-- Execute no SQL Editor do Supabase
-- Arquivo: src/infrastructure/database/migrations/create-tables.sql
```

### 5. Inicie o servidor

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```
O servidor estará disponível em `http://localhost:3000`

## Documentação da API

### Base URL
```
http://localhost:3000/api
```

### Autenticação
Todas as rotas protegidas requerem um token JWT no header:
```
Authorization: Bearer <seu_token_jwt>
```
### Endpoints

#### Autenticação

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| POST | `/auth/register` | Registrar novo usuário | Público |
| POST | `/auth/login` | Fazer login | Público |
| POST | `/auth/verify` | Verificar token JWT | Público |
| POST | `/auth/refresh` | Renovar token JWT | Privado |
| POST | `/auth/logout` | Fazer logout | Privado |

#### Usuários

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | `/user/profile` | Obter perfil do usuário | Privado |
| PUT | `/user/profile` | Atualizar perfil | Privado |
| DELETE | `/user/account` | Deletar conta | Privado |

#### Quiz

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | `/quiz/questions` | Obter perguntas do quiz | Privado |
| POST | `/quiz/submit` | Submeter respostas do quiz | Privado |
| GET | `/quiz/result` | Obter resultado do quiz | Privado |
| GET | `/quiz/status` | Verificar status do quiz | Privado |
| GET | `/quiz/state` | Obter estado atual do usuário | Privado |
| POST | `/quiz/reload-state` | Recarregar estado do usuário | Privado |

#### Estados

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | `/state/data` | Obter dados completos do estado | Privado |
| GET | `/state/economy` | Obter dados econômicos | Privado |
| GET | `/state/governance` | Obter dados de governança | Privado |
| GET | `/state/analysis` | Obter análise detalhada | Privado |
| GET | `/state/summary` | Obter resumo executivo | Privado |
| PUT | `/state/economy` | Atualizar dados econômicos | Privado |
| PUT | `/state/governance` | Atualizar dados de governança | Privado |

#### Sistema Econômico (v1.2.0)

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | `/state/economic-logs` | Obter logs de atualizações econômicas | Privado |
| GET | `/state/parameters` | Obter parâmetros econômicos do estado | Privado |
| POST | `/state/force-economic-update` | Forçar atualização econômica manual | Privado |
| GET | `/state/economic-stats` | Obter estatísticas do sistema econômico | Privado |

#### Administrativo (v1.2.0)

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | `/admin/economic-job/status` | Status da job econômica | Admin |
| POST | `/admin/economic-job/execute` | Executar job manualmente (dev) | Admin |

#### Eventos Políticos (v1.3.0)

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| POST | `/events/generate` | Gerar novo evento político | Privado |
| GET | `/events/active` | Obter evento ativo do usuário | Privado |
| POST | `/events/:eventId/decide` | Tomar decisão em um evento | Privado |
| GET | `/events/history` | Obter histórico de eventos do usuário | Privado |
| GET | `/events/statistics` | Obter estatísticas de eventos do usuário | Privado |
| GET | `/events/system/status` | Verificar status do sistema de eventos | Privado |
| POST | `/events/admin/expire` | Forçar expiração de eventos antigos (admin) | Privado |

### Exemplos de Uso

#### Registrar usuário
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jogador123",
    "name": "João Silva",
    "email": "joao@email.com",
    "password": "senha123",
    "birth_date": "1990-01-01"
  }'
```

#### Fazer login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@email.com",
    "password": "senha123"
  }'
```

#### Submeter quiz
```bash
curl -X POST http://localhost:3000/api/quiz/submit \
  -H "Authorization: Bearer <seu_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {"question_id": 1, "answer_index": 2},
      {"question_id": 2, "answer_index": 1}
    ]
  }'
```

#### Obter dados do estado
```bash
curl -X GET http://localhost:3000/api/state/data \
  -H "Authorization: Bearer <seu_token>"
```

#### Atualizar economia
```bash
curl -X PUT http://localhost:3000/api/state/economy \
  -H "Authorization: Bearer <seu_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "gdp": 1500000,
    "unemployment_rate": 5.2,
    "inflation_rate": 2.1
  }'
```

#### Obter análise do estado
```bash
curl -X GET http://localhost:3000/api/state/analysis \
  -H "Authorization: Bearer <seu_token>"
```

#### Obter logs econômicos
```bash
curl -X GET http://localhost:3000/api/state/economic-logs?limit=10 \
  -H "Authorization: Bearer <seu_token>"
```

#### Forçar atualização econômica
```bash
curl -X POST http://localhost:3000/api/state/force-economic-update \
  -H "Authorization: Bearer <seu_token>"
```

#### Verificar status da job econômica
```bash
curl -X GET http://localhost:3000/admin/economic-job/status
```

#### Executar job manualmente (desenvolvimento)
```bash
curl -X POST http://localhost:3000/admin/economic-job/execute
```

#### Gerar evento político
```bash
curl -X POST http://localhost:3000/api/events/generate \
  -H "Authorization: Bearer <seu_token>"
```

#### Obter evento ativo
```bash
curl -X GET http://localhost:3000/api/events/active \
  -H "Authorization: Bearer <seu_token>"
```

#### Tomar decisão em evento
```bash
curl -X POST http://localhost:3000/api/events/<eventId>/decide \
  -H "Authorization: Bearer <seu_token>" \
  -H "Content-Type: application/json" \
  -d '{ "option_id": 1, "reasoning": "Minha justificativa" }'
```

#### Histórico de eventos
```bash
curl -X GET http://localhost:3000/api/events/history \
  -H "Authorization: Bearer <seu_token>"
```

#### Estatísticas de eventos
```bash
curl -X GET http://localhost:3000/api/events/statistics \
  -H "Authorization: Bearer <seu_token>"
```

#### Status do sistema de eventos
```bash
curl -X GET http://localhost:3000/api/events/system/status \
  -H "Authorization: Bearer <seu_token>"
```

## Segurança

O projeto implementa várias camadas de segurança:

- **Helmet**: Headers de segurança HTTP
- **CORS**: Controle de acesso cross-origin
- **Rate Limiting**: Proteção contra ataques de força bruta
- **JWT**: Autenticação stateless
- **bcryptjs**: Hash seguro de senhas
- **Validação**: Schemas Zod para validação de entrada
- **Sanitização**: Limpeza de dados de entrada

## Testes

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes com coverage
npm run test:coverage
```

## Monitoramento

### Health Check
```
GET /health
```
Resposta:
```json
{
  "success": true,
  "message": "SimNations Backend está funcionando!",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "development"
}
```
### Logs
O sistema registra automaticamente:
- Requisições HTTP
- Erros de aplicação
- Tentativas de autenticação
- Performance de queries

## 🏛️ Sistema de Estados

### Economia
O sistema de economia inclui:
- **PIB e Crescimento**: Monitoramento do produto interno bruto
- **População**: Crescimento demográfico e distribuição
- **Dívida Pública**: Razão dívida/PIB e gestão fiscal
- **Indicadores Sociais**: Desemprego, inflação, qualidade de vida
- **Receitas e Despesas**: Balanço mensal e projeções

### Governança
O sistema de governança monitora:
- **Aprovação Popular**: Níveis de apoio da população
- **Estabilidade Política**: Risco de golpe e protestos
- **Corrupção**: Índice de transparência e integridade
- **Relações Internacionais**: Diplomacia e alianças
- **Histórico de Decisões**: Taxa de sucesso das políticas

### Análise Inteligente
O sistema fornece:
- **Análise Econômica**: Saúde financeira e projeções
- **Análise Política**: Estabilidade e riscos
- **Desafios Identificados**: Problemas críticos e urgentes
- **Recomendações**: Sugestões de políticas e ações
- **Resumo Executivo**: Visão geral para tomada de decisões

### ⚙️ Motor Econômico (v1.2.0)
O sistema agora inclui:
- **Atualização Automática**: Job diária que processa todos os estados
- **Parâmetros Econômicos**: Taxas, eficiência e modificadores por estado
- **Logs de Auditoria**: Rastreamento completo de mudanças econômicas
- **Validação de Integridade**: Verificação automática de dados
- **Processamento em Lote**: Atualização eficiente de múltiplos estados
- **Controle de Corrupção**: Impacto da corrupção na economia

## Deploy

### Variáveis de Ambiente para Produção

```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=sua_url_producao
SUPABASE_ANON_KEY=sua_chave_producao
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_producao
JWT_SECRET=secret_super_seguro_producao
JWT_EXPIRES_IN=24h
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
FRONTEND_URL=https://seu-frontend.com

# Configurações do Motor Econômico (v1.2.0)
ECONOMIC_JOB_SCHEDULE=0 6 * * *  # Diariamente às 6h
ECONOMIC_JOB_TIMEZONE=America/Sao_Paulo
ECONOMIC_LOG_RETENTION_DAYS=90
```

### Docker (Opcional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Dependências Adicionais (v1.2.0)

```bash
# Instalar node-cron para jobs agendadas
npm install node-cron

# Verificar se todas as dependências estão instaladas
npm install
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

- **Email**: suporte@simnations.com
- **Issues**: [GitHub Issues](https://github.com/esc4n0rx/simnations-backend/issues)
- **Documentação**: [Wiki do Projeto](https://github.com/esc4n0rx/simnations-backend/wiki)

## 🙏 Agradecimentos

- Equipe de desenvolvimento
- Comunidade open source
- Supabase pela infraestrutura
- Todos os contribuidores

## 📈 Novas Features (v1.3.0)

### 🗳️ Sistema de Eventos Políticos
- **Geração de Eventos**: Criação dinâmica de eventos políticos para cada usuário
- **Decisão do Jogador**: Usuário pode tomar decisões que afetam o estado
- **Histórico e Estatísticas**: Consulta de histórico e análise de decisões
- **Sistema Inteligente**: Status do sistema, cooldowns e controle de expiração
- **Administração**: Forçar expiração de eventos antigos via endpoint admin

### 🏛️ Sistema de Estados
- **Gerenciamento Completo**: Economia e governança integradas
- **Análise Inteligente**: Sistema de análise automática de dados
- **Reload de Estados**: Troca de estados mantendo progresso
- **Resumo Executivo**: Visão geral para tomada de decisões

### 📊 Indicadores Avançados
- **Métricas Econômicas**: PIB, dívida, desemprego, inflação
- **Indicadores Políticos**: Aprovação, estabilidade, risco de golpe
- **Análise de Riscos**: Identificação automática de problemas
- **Recomendações**: Sugestões baseadas em dados

### 🔄 Funcionalidades Dinâmicas
- **Atualização em Tempo Real**: Modificação de dados econômicos e políticos
- **Validação Inteligente**: Schemas de validação para todas as operações
- **Logs Detalhados**: Rastreamento completo de mudanças
- **API RESTful**: Endpoints organizados e documentados

### ⚙️ Motor Econômico Automatizado
- **Job Agendada**: Atualização econômica diária automática às 6h
- **Processamento em Lote**: Atualização de todos os estados ativos
- **Logs de Auditoria**: Rastreamento completo de mudanças econômicas
- **Validação de Integridade**: Verificação automática de dados

### 📈 Sistema de Parâmetros Econômicos
- **Taxas Personalizadas**: Taxa de impostos configurável por estado
- **Eficiência Administrativa**: Impacto da gestão na arrecadação
- **Controle de Gastos**: Taxa de despesas e eficiência
- **Impacto da Corrupção**: Redução de receitas e aumento de despesas

### 🔍 Monitoramento Avançado
- **Logs Econômicos**: Histórico completo de atualizações
- **Estatísticas do Sistema**: Métricas de performance do motor econômico
- **Atualização Manual**: Forçar atualização para usuários específicos
- **Status da Job**: Monitoramento em tempo real da execução

### 🛠️ Ferramentas Administrativas
- **Endpoints de Admin**: Rotas para monitoramento e controle
- **Execução Manual**: Trigger manual da job econômica (desenvolvimento)
- **Status da Job**: Verificação do estado da atualização automática
- **Logs Detalhados**: Auditoria completa de todas as operações

---

**Desenvolvido com ❤️ pela equipe SimNations**
