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

## Deploy

### Variáveis de Ambiente para Produção

```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=sua_url_producao
SUPABASE_ANON_KEY=sua_chave_producao
JWT_SECRET=secret_super_seguro_producao
FRONTEND_URL=https://seu-frontend.com
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

---

**Desenvolvido com ❤️ pela equipe SimNations**
