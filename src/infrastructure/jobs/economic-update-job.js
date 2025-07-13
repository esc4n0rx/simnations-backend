const cron = require('node-cron');
const EconomicEngineService = require('../../application/services/economic-engine-service');
const { ECONOMIC_CONSTANTS } = require('../../shared/constants/economic-constants');

class EconomicUpdateJob {
    constructor() {
        this.economicEngine = new EconomicEngineService();
        this.isRunning = false;
        this.isActive = true; // [CORRIGIDO] Adicionar propriedade que estava faltando
        this.lastExecution = null;
        this.lastResult = null;
    }

    /**
     * Inicializar job automatizada
     */
    start() {
        console.log('🕐 Inicializando job de atualização econômica...');
        console.log(`📅 Agendamento: ${ECONOMIC_CONSTANTS.JOB_SCHEDULE} (${ECONOMIC_CONSTANTS.JOB_TIMEZONE})`);

        // Agendar execução diária
        cron.schedule(ECONOMIC_CONSTANTS.JOB_SCHEDULE, async () => {
            if (this.isActive) { // [CORRIGIDO] Verificar se está ativa
                await this.executeUpdate();
            }
        }, {
            scheduled: true,
            timezone: ECONOMIC_CONSTANTS.JOB_TIMEZONE
        });

        console.log('✅ Job de atualização econômica ativada!');
    }

    /**
     * Executar atualização econômica
     */
    async executeUpdate() {
        if (this.isRunning) {
            console.warn('⚠️ Job já está em execução, pulando...');
            return;
        }

        this.isRunning = true;
        this.lastExecution = new Date();

        try {
            console.log('🚀 Iniciando execução da job de atualização econômica...');
            
            const result = await this.economicEngine.processAllStatesEconomicUpdate();
            this.lastResult = result;

            console.log('✅ Job de atualização econômica concluída com sucesso!');
            console.log(`📊 Resultado: ${result.processed_states} estados processados, ${result.error_states} erros`);

            // Log de alerta se muitos erros
            if (result.error_states > result.processed_states * 0.1) { // Mais de 10% de erros
                console.warn(`⚠️ ALERTA: Alta taxa de erros na atualização econômica: ${result.error_states}/${result.total_states}`);
            }

        } catch (error) {
            console.error('❌ Erro crítico na job de atualização econômica:', error);
            this.lastResult = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Executar manualmente (para testes ou manutenção)
     * @returns {Promise<Object>} - Resultado da execução
     */
    async executeManual() {
        console.log('🔧 Execução manual da job de atualização econômica...');
        await this.executeUpdate();
        return this.lastResult;
    }

    /**
     * Obter status da job
     * @returns {Object} - Status atual
     */
    getStatus() {
        return {
            is_running: this.isRunning,
            is_active: this.isActive,
            last_execution: this.lastExecution,
            last_result: this.lastResult,
            schedule: ECONOMIC_CONSTANTS.JOB_SCHEDULE,
            timezone: ECONOMIC_CONSTANTS.JOB_TIMEZONE
        };
    }

    /**
     * Parar job (para manutenção)
     */
    stop() {
        console.log('🛑 Parando job de atualização econômica...');
        this.isActive = false;
        console.log('⏹️ Job de atualização econômica desativada');
    }
}

module.exports = EconomicUpdateJob;