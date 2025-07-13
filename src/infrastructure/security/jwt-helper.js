const jwt = require('jsonwebtoken');

class JwtHelper {
    /**
     * Gera token JWT
     * @param {Object} payload - Dados do usuário
     * @returns {string} - Token JWT
     */
    static generateToken(payload) {
        return jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { 
                expiresIn: process.env.JWT_EXPIRES_IN || '7d',
                issuer: 'simnations-backend',
                audience: 'simnations-frontend'
            }
        );
    }

    /**
     * Verifica e decodifica token JWT
     * @param {string} token - Token JWT
     * @returns {Object} - Payload decodificado
     */
    static verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token expirado');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Token inválido');
            } else {
                throw new Error('Erro na verificação do token');
            }
        }
    }

    /**
     * Decodifica token sem verificar assinatura
     * @param {string} token - Token JWT
     * @returns {Object} - Payload decodificado
     */
    static decodeToken(token) {
        return jwt.decode(token);
    }

    /**
     * Extrai token do header Authorization
     * @param {string} authHeader - Header Authorization
     * @returns {string|null} - Token ou null
     */
    static extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
    }
}

module.exports = JwtHelper;