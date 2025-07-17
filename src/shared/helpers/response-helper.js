/**
 * Helper para padronizar respostas da API
 */
class ResponseHelper {
    /**
     * Resposta de sucesso
     * @param {Object} res - Response object do Express
     * @param {Object} data - Dados a serem retornados
     * @param {string} message - Mensagem de sucesso
     * @param {number} statusCode - Código de status (padrão: 200)
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
     * Resposta de criação bem-sucedida
     * @param {Object} res - Response object do Express
     * @param {Object} data - Dados criados
     * @param {string} message - Mensagem de sucesso
     */
    static created(res, data = null, message = 'Recurso criado com sucesso') {
        return this.success(res, data, message, 201);
    }

    /**
     * Resposta de erro de validação (400)
     * @param {Object} res - Response object do Express
     * @param {string} message - Mensagem de erro
     * @param {Object} details - Detalhes adicionais do erro
     */
    static badRequest(res, message = 'Dados inválidos', details = null) {
        return res.status(400).json({
            success: false,
            error: message,
            details,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta de não autorizado (401)
     * @param {Object} res - Response object do Express
     * @param {string} message - Mensagem de erro
     */
    static unauthorized(res, message = 'Não autorizado') {
        return res.status(401).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta de acesso negado (403)
     * @param {Object} res - Response object do Express
     * @param {string} message - Mensagem de erro
     */
    static forbidden(res, message = 'Acesso negado') {
        return res.status(403).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta de recurso não encontrado (404)
     * @param {Object} res - Response object do Express
     * @param {string} message - Mensagem de erro
     */
    static notFound(res, message = 'Recurso não encontrado') {
        return res.status(404).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta de conflito (409)
     * @param {Object} res - Response object do Express
     * @param {string} message - Mensagem de erro
     * @param {Object} details - Detalhes do conflito
     */
    static conflict(res, message = 'Conflito de dados', details = null) {
        return res.status(409).json({
            success: false,
            error: message,
            details,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta de erro interno do servidor (500)
     * @param {Object} res - Response object do Express
     * @param {string} message - Mensagem de erro
     * @param {Object} details - Detalhes do erro (apenas em desenvolvimento)
     */
    static serverError(res, message = 'Erro interno do servidor', details = null) {
        const response = {
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        };

        // Incluir detalhes apenas em ambiente de desenvolvimento
        if (process.env.NODE_ENV === 'development' && details) {
            response.details = details;
        }

        return res.status(500).json(response);
    }

    /**
     * Resposta de erro de validação com lista de erros
     * @param {Object} res - Response object do Express
     * @param {Array} errors - Array de erros de validação
     * @param {string} message - Mensagem principal
     */
    static validationError(res, errors = [], message = 'Erro de validação') {
        return res.status(422).json({
            success: false,
            error: message,
            validation_errors: errors,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta de rate limit excedido (429)
     * @param {Object} res - Response object do Express
     * @param {string} message - Mensagem de erro
     * @param {Object} retryAfter - Tempo para tentar novamente
     */
    static tooManyRequests(res, message = 'Muitas tentativas', retryAfter = null) {
        const response = {
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        };

        if (retryAfter) {
            response.retry_after = retryAfter;
            res.set('Retry-After', retryAfter);
        }

        return res.status(429).json(response);
    }

    /**
     * Resposta paginada
     * @param {Object} res - Response object do Express
     * @param {Array} data - Dados da página atual
     * @param {Object} pagination - Informações de paginação
     * @param {string} message - Mensagem de sucesso
     */
    static paginated(res, data = [], pagination = {}, message = 'Dados obtidos com sucesso') {
        const response = {
            success: true,
            message,
            data,
            pagination: {
                current_page: pagination.page || 1,
                per_page: pagination.limit || 20,
                total: pagination.total || 0,
                total_pages: pagination.pages || 0,
                has_next_page: (pagination.page || 1) < (pagination.pages || 0),
                has_prev_page: (pagination.page || 1) > 1
            },
            timestamp: new Date().toISOString()
        };

        return res.status(200).json(response);
    }

    /**
     * Resposta de operação assíncrona aceita (202)
     * @param {Object} res - Response object do Express
     * @param {Object} data - Dados da operação aceita
     * @param {string} message - Mensagem
     */
    static accepted(res, data = null, message = 'Operação aceita e será processada') {
        return res.status(202).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta sem conteúdo (204)
     * @param {Object} res - Response object do Express
     */
    static noContent(res) {
        return res.status(204).send();
    }

    /**
     * Resposta customizada
     * @param {Object} res - Response object do Express
     * @param {number} statusCode - Código de status HTTP
     * @param {Object} body - Corpo da resposta
     */
    static custom(res, statusCode, body) {
        return res.status(statusCode).json({
            ...body,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Middleware para tratar erros de validação do express-validator
     * @param {Array} errors - Erros do express-validator
     * @returns {Array} - Array de erros formatados
     */
    static formatValidationErrors(errors) {
        return errors.map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value,
            location: error.location
        }));
    }

    /**
     * Resposta para operações em lote
     * @param {Object} res - Response object do Express
     * @param {Object} results - Resultados da operação em lote
     * @param {string} message - Mensagem principal
     */
    static batchOperation(res, results = {}, message = 'Operação em lote concluída') {
        const {
            successful = 0,
            failed = 0,
            total = 0,
            errors = [],
            data = null
        } = results;

        return res.status(200).json({
            success: failed === 0,
            message,
            batch_results: {
                total_processed: total,
                successful_operations: successful,
                failed_operations: failed,
                success_rate: total > 0 ? ((successful / total) * 100).toFixed(2) + '%' : '0%'
            },
            errors,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta para status de saúde da aplicação
     * @param {Object} res - Response object do Express
     * @param {Object} healthData - Dados de saúde dos serviços
     * @param {boolean} isHealthy - Se a aplicação está saudável
     */
    static health(res, healthData = {}, isHealthy = true) {
        const statusCode = isHealthy ? 200 : 503;
        
        return res.status(statusCode).json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            services: healthData
        });
    }
}

module.exports = ResponseHelper;