const JwtHelper = require('../../infrastructure/security/jwt-helper');
const ResponseHelper = require('../../shared/utils/response-helper');

function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = JwtHelper.extractTokenFromHeader(authHeader);

        if (!token) {
            return ResponseHelper.unauthorized(res, 'Token de acesso requerido');
        }

        const decoded = JwtHelper.verifyToken(token);
        
        // Adicionar dados do usuário ao request
        req.user = {
            id: decoded.id,
            username: decoded.username,
            email: decoded.email
        };

        next();
    } catch (error) {
        return ResponseHelper.unauthorized(res, error.message);
    }
}

module.exports = authMiddleware;