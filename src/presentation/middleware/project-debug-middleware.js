const { debugLogger } = require('../../shared/utils/project-debug-logger');

/**
 * Middleware específico para debug de criação de projetos
 */
function projectDebugMiddleware(req, res, next) {
    // Aplicar apenas para POST /api/government-projects
    if (req.method === 'POST' && req.path === '/') {
        const startTime = Date.now();
        
        debugLogger.log('REQUEST_RECEIVED', {
            method: req.method,
            path: req.originalUrl,
            userId: req.user?.id,
            bodySize: JSON.stringify(req.body).length,
            headers: {
                'content-type': req.headers['content-type'],
                'authorization': req.headers.authorization ? 'Bearer [TOKEN]' : 'None'
            }
        });

        // Interceptar resposta
        const originalSend = res.send;
        res.send = function(data) {
            const duration = Date.now() - startTime;
            
            debugLogger.log('RESPONSE_SENT', {
                statusCode: res.statusCode,
                duration,
                responseSize: data ? data.length : 0,
                contentType: res.getHeader('content-type')
            });
            
            originalSend.call(this, data);
        };

        // Interceptar erros
        const originalError = res.status;
        res.status = function(code) {
            if (code >= 400) {
                debugLogger.log('RESPONSE_ERROR', {
                    statusCode: code,
                    duration: Date.now() - startTime
                });
            }
            return originalError.call(this, code);
        };
    }
    
    next();
}

module.exports = projectDebugMiddleware;