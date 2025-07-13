const AuthService = require('../../application/services/auth-service');
const ResponseHelper = require('../../shared/utils/response-helper');

class AuthController {
    constructor() {
        this.authService = new AuthService();
    }

    /**
     * Registrar novo usuário
     */
    register = async (req, res, next) => {
        try {
            const result = await this.authService.register(req.body);
            
            ResponseHelper.success(res, result, 'Usuário registrado com sucesso', 201);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Fazer login
     */
    login = async (req, res, next) => {
        try {
            const { username, password } = req.body;
            const result = await this.authService.login(username, password);
            
            ResponseHelper.success(res, result, 'Login realizado com sucesso');
        } catch (error) {
            if (error.message === 'Credenciais inválidas') {
                return ResponseHelper.unauthorized(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Verificar token
     */
    verifyToken = async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader?.substring(7); // Remove "Bearer "
            
            if (!token) {
                return ResponseHelper.unauthorized(res, 'Token não fornecido');
            }

            const user = await this.authService.verifyToken(token);
            
            ResponseHelper.success(res, { user }, 'Token válido');
        } catch (error) {
            return ResponseHelper.unauthorized(res, error.message);
        }
    };

    /**
     * Refresh token
     */
    refreshToken = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const newToken = await this.authService.refreshToken(userId);
            
            ResponseHelper.success(res, { token: newToken }, 'Token renovado com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Logout (invalidar token no frontend)
     */
    logout = async (req, res, next) => {
        try {
            // Como estamos usando JWT stateless, o logout é feito no frontend
            // removendo o token do storage. Aqui apenas confirmamos a operação.
            
            ResponseHelper.success(res, null, 'Logout realizado com sucesso');
        } catch (error) {
            next(error);
        }
    };
}

module.exports = AuthController;