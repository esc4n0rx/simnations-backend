const express = require('express');
const UserController = require('../controllers/user-controller');
const validationMiddleware = require('../middleware/validation-middleware');
const authMiddleware = require('../middleware/auth-middleware');
const { updateProfileSchema, changePasswordSchema } = require('../../application/validators/user-validator');

const router = express.Router();
const userController = new UserController();

/**
 * @route GET /api/user/profile
 * @desc Obter perfil do usuário
 * @access Private
 */
router.get('/profile', authMiddleware, userController.getProfile);

/**
 * @route PUT /api/user/profile
 * @desc Atualizar perfil do usuário
 * @access Private
 */
router.put('/profile', 
    authMiddleware,
    validationMiddleware(updateProfileSchema), 
    userController.updateProfile
);

/**
 * @route PUT /api/user/password
 * @desc Alterar senha do usuário
 * @access Private
 */
router.put('/password', 
    authMiddleware,
    validationMiddleware(changePasswordSchema), 
    userController.changePassword
);

/**
 * @route DELETE /api/user/account
 * @desc Desativar conta do usuário
 * @access Private
 */
router.delete('/account', authMiddleware, userController.deactivateAccount);

/**
 * @route GET /api/user/exists/:identifier
 * @desc Verificar se usuário existe
 * @access Public
 */
router.get('/exists/:identifier', userController.checkUserExists);

module.exports = router;