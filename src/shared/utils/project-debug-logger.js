/**
 * Logger específico para debug de criação de projetos
 */
class ProjectDebugLogger {
    constructor() {
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
            data
        };

        if (this.currentSession) {
            this.currentSession.steps.push(stepData);
        }

        const emoji = this.getEmoji(status);
        const stepName = step.replace(/_/g, ' ').toUpperCase();
        
        console.log(`\n${emoji} [PROJECT DEBUG] ${stepName} - ${status}`);
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
        
        console.log(`\n🏁 [PROJECT DEBUG] SESSÃO FINALIZADA`);
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
        
        console.log(`\n🔍 [PROJECT DEBUG] ${message}`);
        if (Object.keys(data).length > 0) {
            console.log(JSON.stringify(data, null, 2));
        }
        console.log(`${'-'.repeat(60)}`);
    }
}

// Instância singleton
const debugLogger = new ProjectDebugLogger();

module.exports = debugLogger;