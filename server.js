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

// Importar utils
const { testConnection } = require('./src/infrastructure/database/supabase-client');

const app = express();
const PORT = process.env.PORT || 3000;

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
        environment: process.env.NODE_ENV || 'development'
    });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/quiz', quizRoutes);

// Middleware de tratamento de erros
app.use(errorMiddleware);

// Rota para 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada',
        timestamp: new Date().toISOString()
    });
});

// Inicializar servidor
async function startServer() {
    try {
        // Testar conexão com banco
        const isConnected = await testConnection();
        if (!isConnected) {
            console.error('❌ Falha na conexão com o banco de dados');
            process.exit(1);
        }

        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor rodando na porta ${PORT}`);
            console.log(`🌟 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM recebido, encerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT recebido, encerrando servidor...');
    process.exit(0);
});

// Iniciar aplicação
startServer();