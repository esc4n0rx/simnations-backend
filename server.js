require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Importar middleware
const errorMiddleware = require('./src/presentation/middleware/error-middleware');

// Importar rotas
const authRoutes = require('./src/presentation/routes/auth-routes');
const userRoutes = require('./src/presentation/routes/user-routes');
const quizRoutes = require('./src/presentation/routes/quiz-routes');
const stateRoutes = require('./src/presentation/routes/state-routes');
const constructionRoutes = require('./src/presentation/routes/construction-routes');
const ConstructionJob = require('./src/infrastructure/jobs/construction-job');
const politicalEventRoutes = require('./src/presentation/routes/political-event-routes');
const governmentProjectRoutes = require('./src/presentation/routes/government-project-routes');

// Importar utils
const { testConnection } = require('./src/infrastructure/database/supabase-client');

// Importar jobs
const EconomicUpdateJob = require('./src/infrastructure/jobs/economic-update-job');
const ProjectExecutionService = require('./src/application/services/project-execution-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Instâncias das jobs
let economicJob = null;
let projectExecutionService = null;
let constructionJob;

// CONFIGURAÇÃO CRÍTICA: Trust proxy para resolver erro de rate limiting
// Necessário quando a aplicação está atrás de proxy/load balancer
app.set('trust proxy', true);

// Configuração de origens permitidas para CORS
const allowedOrigins = [
    'http://localhost:3000',
    'https://localhost:3000',
    'https://routina.fun',
    'http://routina.fun',
    'https://www.routina.fun',
    'http://www.routina.fun'
];

// Configuração de CORS para múltiplas origens
const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requests sem origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log(`❌ CORS: Origem não permitida: ${origin}`);
            callback(new Error('Não permitido pelo CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
};

// Configuração de Rate Limiting com suporte a proxy
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limite de 100 requests por IP
    message: {
        success: false,
        message: 'Muitas tentativas. Tente novamente em alguns minutos.',
        timestamp: new Date().toISOString()
    },
    // Configuração para trabalhar com proxies
    standardHeaders: true, // Retorna rate limit info nos headers `RateLimit-*`
    legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
    // Configuração de identificação de IP para proxies
    keyGenerator: (req) => {
        // Priorizar X-Forwarded-For se disponível e confiável
        const forwarded = req.get('X-Forwarded-For');
        if (forwarded) {
            // Pegar o primeiro IP da lista (cliente original)
            return forwarded.split(',')[0].trim();
        }
        return req.ip;
    },
    // Skip rate limiting para IPs locais em desenvolvimento
    skip: (req) => {
        if (process.env.NODE_ENV === 'development') {
            const ip = req.ip || req.connection.remoteAddress;
            return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.');
        }
        return false;
    }
});

// Middlewares de segurança
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Aplicar CORS ANTES do rate limiting
app.use(cors(corsOptions));

// Rate limiting aplicado após CORS
app.use(limiter);

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logs melhorado
app.use((req, res, next) => {
    const ip = req.get('X-Forwarded-For') || req.ip || req.connection.remoteAddress;
    const origin = req.get('Origin') || 'Sem origem';
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${ip} - Origin: ${origin}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'SimNations Backend está funcionando!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        economic_job_status: economicJob ? 'Ativa' : 'Inativa',
        project_execution_job_status: projectExecutionService ? 'Ativa' : 'Inativa',
        trust_proxy: app.get('trust proxy'),
        allowed_origins: allowedOrigins
    });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/political-events', politicalEventRoutes);
app.use('/api/government-projects', governmentProjectRoutes);
app.use('/api/constructions', constructionRoutes);

// Middleware de tratamento de erros (deve ser o último)
app.use(errorMiddleware);

// Função para inicializar jobs
async function initializeJobs() {
    try {
        console.log('🔄 Inicializando jobs...');
        
        // Inicializar job de atualizações econômicas
        economicJob = new EconomicUpdateJob();
        economicJob.start();
        console.log('💰 Job de Economia: Ativa');
        
        // Inicializar serviço de execução de projetos
        projectExecutionService = new ProjectExecutionService();
        await projectExecutionService.start();
        console.log('🎯 Job de Projetos: Ativa');

        constructionJob = new ConstructionJob();
        constructionJob.start();
        console.log('🏗️ Job de Construções: Ativa');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar jobs:', error.message);
    }
}

// Função para graceful shutdown
async function gracefulShutdown() {
    console.log('🔄 Iniciando graceful shutdown...');
    
    try {
        if (economicJob) {
            economicJob.stop();
            console.log('💰 Job de Economia: Parada');
        }
        
        if (projectExecutionService) {
            await projectExecutionService.stop();
            console.log('🎯 Job de Projetos: Parada');
        }
        if (constructionJob) {
            constructionJob.stop();
            console.log('🏗️ Job de Construções: Parada');
        }
        
        console.log('✅ Graceful shutdown concluído');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro durante graceful shutdown:', error);
        process.exit(1);
    }
}

// Event listeners para graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Inicializar servidor
const startServer = async () => {
    try {
        // Testar conexão com banco
        console.log('🔄 Testando conexão com banco...');
        await testConnection();
        console.log('✅ Conexão com banco estabelecida');
        
        // Inicializar jobs
        await initializeJobs();
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor rodando na porta ${PORT}`);
            console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📱 Origens permitidas: ${allowedOrigins.join(', ')}`);
            console.log(`🛡️  Trust Proxy: ${app.get('trust proxy')}`);
        });
        
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
};

// Inicializar aplicação
startServer();