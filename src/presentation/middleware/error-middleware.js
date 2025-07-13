const ResponseHelper = require('../../shared/utils/response-helper');

function errorMiddleware(error, req, res, next) {
    console.error('❌ Erro capturado pelo middleware:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });

    // Erro de validação do Zod
    if (error.name === 'ZodError') {
        const validationErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
        }));
        return ResponseHelper.validationError(res, validationErrors);
    }

    // Erro de JWT
    if (error.message.includes('Token') || error.message.includes('JWT')) {
        return ResponseHelper.unauthorized(res, error.message);
    }

    // Erro do Supabase
    if (error.code && error.code.startsWith('23')) {
        if (error.code === '23505') {
            return ResponseHelper.conflict(res, 'Este recurso já existe');
        }
        return ResponseHelper.error(res, 'Erro de banco de dados', 500);
    }

    // Erro padrão
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erro interno do servidor';
    
    return ResponseHelper.error(res, message, statusCode);
}

module.exports = errorMiddleware;