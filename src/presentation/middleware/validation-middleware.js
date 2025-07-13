const ResponseHelper = require('../../shared/utils/response-helper');

function validationMiddleware(schema) {
    return (req, res, next) => {
        try {
            // Validar dados do request
            const validatedData = schema.parse(req.body);
            req.body = validatedData;
            next();
        } catch (error) {
            if (error.name === 'ZodError') {
                const validationErrors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }));
                return ResponseHelper.validationError(res, validationErrors);
            }
            next(error);
        }
    };
}

module.exports = validationMiddleware;