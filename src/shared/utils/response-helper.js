class ResponseHelper {
    /**
     * Resposta de sucesso
     * @param {Object} res - Response object
     * @param {Object} data - Dados de resposta
     * @param {string} message - Mensagem de sucesso
     * @param {number} statusCode - Código de status HTTP
     */
    static success(res, data = null, message = 'Operação realizada com sucesso', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta de erro
     * @param {Object} res - Response object
     * @param {string} message - Mensagem de erro
     * @param {number} statusCode - Código de status HTTP
     * @param {Object} errors - Detalhes dos erros
     */
    static error(res, message = 'Erro interno do servidor', statusCode = 500, errors = null) {
        return res.status(statusCode).json({
            success: false,
            message,
            errors,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta de validação
     * @param {Object} res - Response object
     * @param {Object} errors - Erros de validação
     */
    static validationError(res, errors) {
        return res.status(400).json({
            success: false,
            message: 'Dados inválidos',
            errors,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta de não autorizado
     * @param {Object} res - Response object
     * @param {string} message - Mensagem de erro
     */
    static unauthorized(res, message = 'Acesso não autorizado') {
        return res.status(401).json({
            success: false,
            message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta de não encontrado
     * @param {Object} res - Response object
     * @param {string} message - Mensagem de erro
     */
    static notFound(res, message = 'Recurso não encontrado') {
        return res.status(404).json({
            success: false,
            message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta de conflito
     * @param {Object} res - Response object
     * @param {string} message - Mensagem de erro
     */
    static conflict(res, message = 'Recurso já existe') {
        return res.status(409).json({
            success: false,
            message,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = ResponseHelper;