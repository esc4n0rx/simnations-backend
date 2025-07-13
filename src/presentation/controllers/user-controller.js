const UserService = require('../../application/services/user-service');
const ResponseHelper = require('../../shared/utils/response-helper');

class UserController {
    constructor() {
        this.userService = new UserService();
    }

    /**
     * Obter perfil do usuário
     */
    getProfile = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const profile = await this.userService.getProfile(userId);
            
            ResponseHelper.success(res, { user: profile }, 'Perfil obtido com sucesso');
        } catch (error) {
            if (error.message === 'Usuário não encontrado') {
                return ResponseHelper.notFound(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Atualizar perfil do usuário
     */
    updateProfile = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const updateData = req.body;
            
            const updatedUser = await this.userService.updateProfile(userId, updateData);
            
            ResponseHelper.success(res, { user: updatedUser }, 'Perfil atualizado com sucesso');
        } catch (error) {
            if (error.message.includes('já está em uso')) {
                return ResponseHelper.conflict(res, error.message);
            }
            if (error.message === 'Usuário não encontrado') {
                return ResponseHelper.notFound(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Alterar senha do usuário
     */
    changePassword = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { current_password, new_password } = req.body;
            
            await this.userService.changePassword(userId, current_password, new_password);
            
            ResponseHelper.success(res, null, 'Senha alterada com sucesso');
        } catch (error) {
            if (error.message === 'Senha atual incorreta') {
                return ResponseHelper.error(res, error.message, 400);
            }
            if (error.message.includes('requisitos de segurança')) {
                return ResponseHelper.error(res, error.message, 400);
            }
            if (error.message === 'Usuário não encontrado') {
                return ResponseHelper.notFound(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Desativar conta do usuário
     */
    deactivateAccount = async (req, res, next) => {
        try {
            const userId = req.user.id;
            
            await this.userService.deactivateAccount(userId);
            
            ResponseHelper.success(res, null, 'Conta desativada com sucesso');
        } catch (error) {
            if (error.message === 'Usuário não encontrado') {
                return ResponseHelper.notFound(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Verificar se usuário existe
     */
    checkUserExists = async (req, res, next) => {
        try {
            const { identifier } = req.params;
            const exists = await this.userService.userExists(identifier);
            
            ResponseHelper.success(res, { exists }, 'Verificação realizada com sucesso');
        } catch (error) {
            next(error);
        }
    };
}

module.exports = UserController;