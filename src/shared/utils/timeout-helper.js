/**
 * Helper para gerenciar timeouts em operações assíncronas
 */
class TimeoutHelper {
    /**
     * Executa uma Promise com timeout
     * @param {Promise} promise - Promise a ser executada
     * @param {number} timeoutMs - Timeout em milissegundos
     * @param {string} operation - Nome da operação para logs
     * @returns {Promise} - Promise com timeout
     */
    static withTimeout(promise, timeoutMs = 30000, operation = 'operação') {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Timeout de ${timeoutMs}ms excedido para ${operation}`));
                }, timeoutMs);
            })
        ]);
    }

    /**
     * Executa função assíncrona com retry
     * @param {Function} fn - Função assíncrona
     * @param {number} maxRetries - Número máximo de tentativas
     * @param {number} delay - Delay entre tentativas (ms)
     * @returns {Promise} - Resultado da função
     */
    static async withRetry(fn, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                console.warn(`❌ Tentativa ${attempt}/${maxRetries} falhou:`, error.message);
                
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                }
            }
        }
        
        throw lastError;
    }
}

module.exports = TimeoutHelper;