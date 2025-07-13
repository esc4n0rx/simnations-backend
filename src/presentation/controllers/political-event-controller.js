const PoliticalEventService = require('../../application/services/political-event-service');
const ResponseHelper = require('../../shared/utils/response-helper');

class PoliticalEventController {
    constructor() {
        this.eventService = new PoliticalEventService();
    }

    /**
     * Gerar novo evento político para o usuário
     */
    generateEvent = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const result = await this.eventService.generateEventForUser(userId);
            
            if (result.has_active_event) {
                return ResponseHelper.conflict(res, 'Usuário já possui evento ativo', result.active_event);
            }
            
            if (result.in_cooldown) {
                return ResponseHelper.error(res, result.reason, 429, {
                    next_available: result.next_available
                });
            }
            
            ResponseHelper.success(res, result, 'Evento político gerado com sucesso', 201);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Obter evento ativo do usuário
     */
    getActiveEvent = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const activeEvent = await this.eventService.getActiveEventForUser(userId);
            
            if (!activeEvent) {
                return ResponseHelper.notFound(res, 'Nenhum evento ativo encontrado');
            }
            
            ResponseHelper.success(res, { event: activeEvent }, 'Evento ativo obtido com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Processar decisão do jogador
     */
    makeDecision = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { eventId } = req.params;
            const { option_id, reasoning } = req.body;
            
            const result = await this.eventService.processPlayerDecision(
                userId, 
                eventId, 
                option_id, 
                reasoning
            );
            
            ResponseHelper.success(res, result, 'Decisão processada com sucesso');
        } catch (error) {
            if (error.message.includes('não encontrado') || error.message.includes('não está ativo')) {
                return ResponseHelper.notFound(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Obter histórico de eventos do usuário
     */
    getEventHistory = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 10;
            
            const history = await this.eventService.getEventHistoryForUser(userId, limit);
            
            ResponseHelper.success(res, { 
                events: history,
                total: history.length 
            }, 'Histórico de eventos obtido com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Verificar status do sistema de eventos (CORRIGIDO)
     */
    getSystemStatus = async (req, res, next) => {
        try {
            const status = await this.eventService.checkAISystemStatus();
            
            // Filtrar dados para evitar referências circulares
            const safeStatus = {
                llm_provider_available: status.llm_provider_available,
                model_info: status.model_info ? {
                    provider: status.model_info.provider,
                    model: status.model_info.model,
                    max_tokens: status.model_info.max_tokens,
                    supports_json: status.model_info.supports_json,
                    supports_streaming: status.model_info.supports_streaming
                } : null,
                agents_status: status.agents_status,
                system_ready: status.system_ready,
                error: status.error || null
            };
            
            ResponseHelper.success(res, safeStatus, 'Status do sistema obtido com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Forçar expiração de eventos antigos (admin)
     */
    expireOldEvents = async (req, res, next) => {
        try {
            const expiredCount = await this.eventService.expireOldEvents();
            
            ResponseHelper.success(res, { 
                expired_events: expiredCount 
            }, `${expiredCount} eventos expirados com sucesso`);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Obter estatísticas gerais de eventos
     */
    getEventStatistics = async (req, res, next) => {
        try {
            const userId = req.user.id;
            
            // Buscar estatísticas básicas
            const recentEvents = await this.eventService.getEventHistoryForUser(userId, 50);
            
            const stats = {
                total_events: recentEvents.length,
                events_by_type: {},
                events_by_severity: {},
                avg_processing_time: 0,
                decision_patterns: {
                    most_chosen_option_index: null,
                    avg_decision_time: null
                }
            };

            // Calcular estatísticas
            recentEvents.forEach(event => {
                // Contar por tipo
                stats.events_by_type[event.event_type] = 
                    (stats.events_by_type[event.event_type] || 0) + 1;
                
                // Contar por severidade
                stats.events_by_severity[event.severity] = 
                    (stats.events_by_severity[event.severity] || 0) + 1;
            });

            ResponseHelper.success(res, stats, 'Estatísticas de eventos obtidas com sucesso');
        } catch (error) {
            next(error);
        }
    };
}

module.exports = PoliticalEventController;