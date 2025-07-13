const bcrypt = require('bcryptjs');

class PasswordHelper {
    /**
     * Gera hash da senha
     * @param {string} password - Senha em texto plano
     * @returns {Promise<string>} - Hash da senha
     */
    static async hashPassword(password) {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    /**
     * Verifica se a senha está correta
     * @param {string} password - Senha em texto plano
     * @param {string} hashedPassword - Hash da senha
     * @returns {Promise<boolean>} - True se a senha estiver correta
     */
    static async verifyPassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    /**
     * Valida força da senha
     * @param {string} password - Senha para validar
     * @returns {Object} - Resultado da validação
     */
    static validatePasswordStrength(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        const isValid = password.length >= minLength && 
                       hasUpperCase && 
                       hasLowerCase && 
                       hasNumbers && 
                       hasSpecialChar;

        return {
            isValid,
            requirements: {
                minLength: password.length >= minLength,
                hasUpperCase,
                hasLowerCase,
                hasNumbers,
                hasSpecialChar
            }
        };
    }
}

module.exports = PasswordHelper;