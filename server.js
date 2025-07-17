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
const politicalEventRoutes = require('./src/presentation/routes/political-event-routes');
const governmentProjectRoutes = require('./src/presentation/routes/government-project-routes');

// Importar utils
const { testConnection } = require('./src/infrastructure/database/supabase-client');

// [CORRIGIDO] Importar job econômica e constantes
const EconomicUpdateJob = require('./src/infrastructure/jobs/economic-update-job');
const { ECONOMIC_CONSTANTS } = require('./src/shared/constants/economic-constants');

const app = express();
const PORT = process.env.PORT || 3000;

// Instância da job econômica
let economicJob = null;

// Configuração de Rate Limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limite de 100 requests por IP
    message: {
        success: false,
        message: 'Muitas tentativas. Tente novamente em alguns minutos.',
        timestamp: new Date().toISOString()
    }
});

// Middlewares de segurança
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(limiter);

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logs
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'SimNations Backend está funcionando!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        economic_job_status: economicJob ? economicJob.isRunning() : 'not_initialized'
    });
});

// Configurar rotas da API
const apiRouter = express.Router();

// Rotas de autenticação
apiRouter.use('/auth', authRoutes);

// Rotas de usuário
apiRouter.use('/user', userRoutes);

// Rotas de quiz
apiRouter.use('/quiz', quizRoutes);

// Rotas de estado
apiRouter.use('/state', stateRoutes);

// Rotas de eventos políticos
apiRouter.use('/political-events', politicalEventRoutes);

// [CORRIGIDO] Rotas de projetos governamentais
apiRouter.use('/government-projects', governmentProjectRoutes);

// Aplicar todas as rotas da API com prefixo /api
app.use('/api', apiRouter);

// Middleware de tratamento de erros (deve ser o último)
app.use(errorMiddleware);

// Função para inicializar jobs
async function initializeJobs() {
    try {
        console.log('🔄 Inicializando jobs do sistema...');
        
        // Inicializar job econômica
        economicJob = new EconomicUpdateJob();
        await economicJob.start();
        
        console.log('✅ Jobs inicializadas com sucesso');
    } catch (error) {
        console.error('❌ Erro ao inicializar jobs:', error);
    }
}

// Função para inicializar o servidor
async function startServer() {
    try {
        // Testar conexão com o banco
        console.log('🔍 Testando conexão com o banco de dados...');
        const isConnected = await testConnection();
        
        if (!isConnected) {
            throw new Error('Falha na conexão com o banco de dados');
        }
        
        // Inicializar jobs
        await initializeJobs();
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`
🚀 Servidor SimNations iniciado com sucesso!
🌍 Ambiente: ${process.env.NODE_ENV || 'development'}
🔗 URL: http://localhost:${PORT}
📊 Health Check: http://localhost:${PORT}/health
📚 API Base: http://localhost:${PORT}/api
⏰ Job Econômica: ${economicJob ? 'Ativa' : 'Inativa'}
            `);
        });
        
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

// Tratamento de sinais do sistema
process.on('SIGTERM', async () => {
    console.log('📴 Recebido SIGTERM. Desligando servidor...');
    
    if (economicJob) {
        await economicJob.stop();
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('📴 Recebido SIGINT. Desligando servidor...');
    
    if (economicJob) {
        await economicJob.stop();
    }
    
    process.exit(0);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
    console.error('Promise:', promise);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Iniciar o servidor
startServer();