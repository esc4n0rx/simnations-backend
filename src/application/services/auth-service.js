const UserRepository = require('../../domain/repositories/user-repository');
const PasswordHelper = require('../../infrastructure/security/password-helper');
const JwtHelper = require('../../infrastructure/security/jwt-helper');

class AuthService {
    constructor() {
        this.userRepository = new UserRepository();
    }

    /**
     * Registrar novo usuário
     * @param {Object} userData - Dados do usuário
     * @returns {Promise<Object>} - Usuário criado e token
     */
    async register(userData) {
        const { username, email, password, ...otherData } = userData;

        // Verificar se username já existe
        const usernameExists = await this.userRepository.usernameExists(username);
        if (usernameExists) {
            throw new Error('Nome de usuário já existe');
        }

        // Verificar se email já existe
        const emailExists = await this.userRepository.emailExists(email);
        if (emailExists) {
            throw new Error('Email já está em uso');
        }

        // Validar força da senha
        const passwordValidation = PasswordHelper.validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            throw new Error('Senha não atende aos requisitos de segurança');
        }

        // Hash da senha
        const password_hash = await PasswordHelper.hashPassword(password);

        // Criar usuário
        const newUser = await this.userRepository.create({
            username,
            email,
            password_hash,
            ...otherData
        });

        // Gerar token JWT
        const token = JwtHelper.generateToken(newUser.toJWTPayload());

        return {
            user: newUser.toSafeObject(),
            token
        };
    }

    /**
     * Fazer login do usuário
     * @param {string} username - Nome de usuário
     * @param {string} password - Senha
     * @returns {Promise<Object>} - Usuário e token
     */
    async login(username, password) {
        // Buscar usuário
        const user = await this.userRepository.findByUsername(username);
        if (!user) {
            throw new Error('Credenciais inválidas');
        }

        // Verificar senha
        const isPasswordValid = await PasswordHelper.verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            throw new Error('Credenciais inválidas');
        }

        // Gerar token JWT
        const token = JwtHelper.generateToken(user.toJWTPayload());

        return {
            user: user.toSafeObject(),
            token
        };
    }

    /**
     * Verificar token JWT
     * @param {string} token - Token JWT
     * @returns {Promise<Object>} - Dados do usuário
     */
    async verifyToken(token) {
        try {
            const decoded = JwtHelper.verifyToken(token);
            const user = await this.userRepository.findById(decoded.id);
            
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            return user.toSafeObject();
        } catch (error) {
            throw new Error('Token inválido');
        }
    }

    /**
     * Refresh token
     * @param {string} userId - ID do usuário
     * @returns {Promise<string>} - Novo token
     */
    async refreshToken(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }

        return JwtHelper.generateToken(user.toJWTPayload());
    }
}

module.exports = AuthService;