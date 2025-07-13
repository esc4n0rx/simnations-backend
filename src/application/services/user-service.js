const UserRepository = require('../../domain/repositories/user-repository');
const PasswordHelper = require('../../infrastructure/security/password-helper');

class UserService {
    constructor() {
        this.userRepository = new UserRepository();
    }

    /**
     * Buscar perfil do usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Dados do usuário
     */
    async getProfile(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }

        return user.toSafeObject();
    }

    /**
     * Atualizar perfil do usuário
     * @param {string} userId - ID do usuário
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<Object>} - Usuário atualizado
     */
    async updateProfile(userId, updateData) {
        const { email, ...otherData } = updateData;

        // Se está atualizando email, verificar se já existe
        if (email) {
            const existingUser = await this.userRepository.findByEmail(email);
            if (existingUser && existingUser.id !== userId) {
                throw new Error('Email já está em uso por outro usuário');
            }
        }

        const updatedUser = await this.userRepository.update(userId, updateData);
        return updatedUser.toSafeObject();
    }

    /**
     * Alterar senha do usuário
     * @param {string} userId - ID do usuário
     * @param {string} currentPassword - Senha atual
     * @param {string} newPassword - Nova senha
     * @returns {Promise<boolean>} - True se alterada com sucesso
     */
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }

        // Verificar senha atual
        const isCurrentPasswordValid = await PasswordHelper.verifyPassword(
            currentPassword, 
            user.password_hash
        );
        if (!isCurrentPasswordValid) {
            throw new Error('Senha atual incorreta');
        }

        // Validar nova senha
        const passwordValidation = PasswordHelper.validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
            throw new Error('Nova senha não atende aos requisitos de segurança');
        }

        // Hash da nova senha
        const newPasswordHash = await PasswordHelper.hashPassword(newPassword);

        // Atualizar senha
        await this.userRepository.update(userId, { 
            password_hash: newPasswordHash 
        });

        return true;
    }

    /**
     * Desativar conta do usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<boolean>} - True se desativada com sucesso
     */
    async deactivateAccount(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }

        return await this.userRepository.deactivate(userId);
    }

    /**
     * Verificar se usuário existe
     * @param {string} identifier - Username ou email
     * @returns {Promise<boolean>} - True se existe
     */
    async userExists(identifier) {
        let user;
        
        // Verificar se é email ou username
        if (identifier.includes('@')) {
            user = await this.userRepository.findByEmail(identifier);
        } else {
            user = await this.userRepository.findByUsername(identifier);
        }

        return !!user;
    }
}

module.exports = UserService;