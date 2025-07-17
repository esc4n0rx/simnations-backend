/**
 * Logger específico para debug de criação de projetos
 */
class DebugLogger {
    constructor(context = 'DEFAULT') {
        this.context = context;
        this.isDebugMode = process.env.NODE_ENV === 'development' || process.env.PROJECT_DEBUG === 'true';
        this.currentSession = null;
    }

    /**
     * Iniciar nova sessão de debug
     * @param {string} userId - ID do usuário
     * @param {string} originalIdea - Ideia original
     * @returns {string} - ID da sessão
     */
    startSession(userId, originalIdea) {
        this.currentSession = {
            id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId,
            originalIdea: originalIdea.substring(0, 100) + '...',
            startTime: new Date(),
            steps: []
        };

        this.log('SESSION_START', {
            sessionId: this.currentSession.id,
            userId,
            ideaLength: originalIdea.length,
            timestamp: new Date().toISOString()
        });

        return this.currentSession.id;
    }

    /**
     * Log de etapa específica
     * @param {string} step - Nome da etapa
     * @param {Object} data - Dados da etapa
     * @param {string} status - Status (START, SUCCESS, ERROR)
     */
    logStep(step, data = {}, status = 'INFO') {
        if (!this.isDebugMode) return;

        const timestamp = new Date();
        const stepData = {
            step,
            status,
            timestamp: timestamp.toISOString(),
            sessionId: this.currentSession?.id,
            context: this.context,
            data
        };

        if (this.currentSession) {
            this.currentSession.steps.push(stepData);
        }

        const emoji = this.getEmoji(status);
        const stepName = step.replace(/_/g, ' ').toUpperCase();
        
        console.log(`\n${emoji} [${this.context}] ${stepName} - ${status}`);
        console.log(`📅 Timestamp: ${timestamp.toISOString()}`);
        console.log(`🆔 Session: ${this.currentSession?.id || 'N/A'}`);
        
        if (Object.keys(data).length > 0) {
            console.log(`📊 Data:`, JSON.stringify(data, null, 2));
        }
        
        console.log(`${'═'.repeat(80)}`);
    }

    /**
     * Log de erro detalhado
     * @param {string} step - Etapa onde ocorreu o erro
     * @param {Error} error - Objeto de erro
     * @param {Object} context - Contexto adicional
     */
    logError(step, error, context = {}) {
        this.logStep(step, {
            error: {
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 5),
                name: error.name
            },
            context
        }, 'ERROR');
    }

    /**
     * Log de sucesso
     * @param {string} step - Etapa concluída
     * @param {Object} result - Resultado da etapa
     */
    logSuccess(step, result = {}) {
        this.logStep(step, {
            result: typeof result === 'object' ? this.sanitizeResult(result) : result
        }, 'SUCCESS');
    }

    /**
     * Log de timeout
     * @param {string} step - Etapa que deu timeout
     * @param {number} timeout - Tempo limite
     */
    logTimeout(step, timeout) {
        this.logStep(step, {
            timeout,
            message: `Operação excedeu ${timeout}ms`
        }, 'TIMEOUT');
    }

    /**
     * Finalizar sessão
     * @param {string} finalStatus - Status final
     */
    endSession(finalStatus = 'COMPLETED') {
        if (!this.currentSession) return;

        const duration = new Date() - this.currentSession.startTime;
        
        console.log(`\n🏁 [${this.context}] SESSÃO FINALIZADA`);
        console.log(`🆔 Session ID: ${this.currentSession.id}`);
        console.log(`👤 User ID: ${this.currentSession.userId}`);
        console.log(`⏱️  Duração total: ${duration}ms`);
        console.log(`📊 Status final: ${finalStatus}`);
        console.log(`🔢 Total de etapas: ${this.currentSession.steps.length}`);
        
        // Resumo das etapas
        console.log(`\n📋 RESUMO DAS ETAPAS:`);
        this.currentSession.steps.forEach((step, index) => {
            const emoji = this.getEmoji(step.status);
            console.log(`  ${index + 1}. ${emoji} ${step.step} (${step.status})`);
        });
        
        console.log(`\n${'═'.repeat(100)}\n`);
        
        this.currentSession = null;
    }

    /**
     * Obter emoji para status
     * @param {string} status - Status
     * @returns {string} - Emoji
     */
    getEmoji(status) {
        const emojis = {
            'START': '🚀',
            'SUCCESS': '✅',
            'ERROR': '❌',
            'TIMEOUT': '⏰',
            'INFO': 'ℹ️',
            'WARNING': '⚠️'
        };
        return emojis[status] || '📝';
    }

    /**
     * Sanitizar resultado para log
     * @param {Object} result - Resultado a sanitizar
     * @returns {Object} - Resultado sanitizado
     */
    sanitizeResult(result) {
        if (!result) return result;
        
        const sanitized = { ...result };
        
        // Remover campos sensíveis ou muito grandes
        const fieldsToLimit = ['analysis_data', 'refined_project', 'processing_logs'];
        fieldsToLimit.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[OBJETO_GRANDE]';
            }
        });
        
        return sanitized;
    }

    /**
     * Log simples sem sessão
     * @param {string} message - Mensagem
     * @param {Object} data - Dados opcionais
     */
    log(message, data = {}) {
        if (!this.isDebugMode) return;
        
        console.log(`\n🔍 [${this.context}] ${message}`);
        if (Object.keys(data).length > 0) {
            console.log(JSON.stringify(data, null, 2));
        }
        console.log(`${'-'.repeat(60)}`);
    }
}

/**
 * Helper para gerenciar timeouts em operações assíncronas
 */
class TimeoutHelper {
    /**
     * Executa uma função com timeout
     * @param {Function} fn - Função a ser executada
     * @param {number} timeoutMs - Timeout em milissegundos
     * @param {string} operation - Nome da operação para logs
     * @returns {Promise} - Promise com timeout
     */
    static withTimeout(fn, timeoutMs = 30000, operation = 'operação') {
        return Promise.race([
            typeof fn === 'function' ? fn() : fn,
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

// Instância singleton para uso global
const debugLogger = new DebugLogger('PROJECT_DEBUG');

// Exportar tanto as classes quanto a instância singleton
module.exports = {
    DebugLogger,
    TimeoutHelper,
    debugLogger
};