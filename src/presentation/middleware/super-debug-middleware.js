/**
 * Middleware ultra-verboso para debug total
 */
function superDebugMiddleware(req, res, next) {
    if (req.method === 'POST' && req.originalUrl.includes('government-projects')) {
        const timestamp = new Date().toISOString();
        
        console.log(`\n🔍 [SUPER DEBUG] ${timestamp} - MIDDLEWARE CHAIN START`);
        console.log(`📍 URL: ${req.originalUrl}`);
        console.log(`📍 Method: ${req.method}`);
        console.log(`📍 Path: ${req.path}`);
        console.log(`📍 Route: ${req.route?.path || 'N/A'}`);
        console.log(`📍 User: ${req.user?.id || 'NOT_SET'}`);
        console.log(`📍 Body: ${JSON.stringify(req.body)}`);
        console.log(`📍 Headers Auth: ${req.headers.authorization ? 'PRESENT' : 'MISSING'}`);
        console.log(`${'='.repeat(80)}`);

        // Interceptar next() para ver quando passa
        const originalNext = next;
        next = function(...args) {
            console.log(`\n✅ [SUPER DEBUG] ${new Date().toISOString()} - MIDDLEWARE PASSED`);
            if (args.length > 0) {
                console.log(`❌ [SUPER DEBUG] ERROR IN MIDDLEWARE:`, args[0]);
            }
            console.log(`${'='.repeat(80)}`);
            originalNext(...args);
        };

        // Timeout de segurança
        setTimeout(() => {
            console.log(`\n⏰ [SUPER DEBUG] ${new Date().toISOString()} - MIDDLEWARE TIMEOUT (10s)`);
            console.log(`📍 Still in middleware chain - something is hanging`);
            console.log(`${'='.repeat(80)}`);
        }, 10000);
    }
    
    next();
}

module.exports = superDebugMiddleware;