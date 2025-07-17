const ResponseHelper = require('../../shared/utils/response-helper');

function validationMiddleware(schema) {
    return (req, res, next) => {
        console.log(`\n🔍 [VALIDATION MIDDLEWARE] STARTED`);
        console.log(`📍 Timestamp: ${new Date().toISOString()}`);
        console.log(`📍 Schema provided: ${!!schema}`);
        console.log(`📍 Request body: ${JSON.stringify(req.body)}`);
        console.log(`${'='.repeat(80)}`);

        try {
            console.log(`\n🔧 [VALIDATION] PARSING WITH SCHEMA`);
            
            // Verificar se schema existe
            if (!schema) {
                console.log(`❌ [VALIDATION] NO SCHEMA PROVIDED`);
                return next(new Error('Schema de validação não fornecido'));
            }

            console.log(`✅ [VALIDATION] SCHEMA EXISTS, ATTEMPTING PARSE`);
            
            // Validar dados do request
            const validatedData = schema.parse(req.body);
            
            console.log(`✅ [VALIDATION] PARSE SUCCESSFUL`);
            console.log(`📍 Validated data: ${JSON.stringify(validatedData)}`);
            console.log(`${'='.repeat(80)}`);
            
            req.body = validatedData;
            next();
            
        } catch (error) {
            console.log(`\n❌ [VALIDATION] ERROR OCCURRED`);
            console.log(`📍 Error name: ${error.name}`);
            console.log(`📍 Error message: ${error.message}`);
            console.log(`📍 Error stack: ${error.stack}`);
            console.log(`${'='.repeat(80)}`);
            
            if (error.name === 'ZodError') {
                console.log(`🔍 [VALIDATION] ZOD ERROR DETECTED`);
                const validationErrors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }));
                console.log(`📍 Validation errors: ${JSON.stringify(validationErrors)}`);
                return ResponseHelper.validationError(res, validationErrors);
            }
            
            console.log(`🔍 [VALIDATION] NON-ZOD ERROR, PASSING TO NEXT`);
            next(error);
        }
    };
}

module.exports = validationMiddleware;