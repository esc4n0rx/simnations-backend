const express = require('express');
const AuthController = require('../controllers/auth-controller');
const validationMiddleware = require('../middleware/validation-middleware');
const authMiddleware = require('../middleware/auth-middleware');
const { registerSchema, loginSchema } = require('../../application/validators/auth-validator');

const router = express.Router();
const authController = new AuthController();

/**
 * @route POST /api/auth/register
 * @desc Registrar novo usuário
 * @access Public
 */
router.post('/register', 
    validationMiddleware(registerSchema), 
    authController.register
);

/**
 * @route POST /api/auth/login
 * @desc Fazer login
 * @access Public
 */
router.post('/login', 
    validationMiddleware(loginSchema), 
    authController.login
);

/**
 * @route POST /api/auth/verify
 * @desc Verificar token JWT
 * @access Public
 */
router.post('/verify', authController.verifyToken);

/**
 * @route POST /api/auth/refresh
 * @desc Renovar token JWT
 * @access Private
 */
router.post('/refresh', authMiddleware, authController.refreshToken);

/**
 * @route POST /api/auth/logout
 * @desc Fazer logout
 * @access Private
 */
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;