const ConstructionService = require('../../application/services/construction-service');
const ResponseHelper = require('../../shared/utils/response-helper');

class ConstructionController {
    constructor() {
        this.constructionService = new ConstructionService();
    }

    /**
     * Listar construções disponíveis
     */
    async getAvailableConstructions(req, res) {
        try {
            console.log('🏗️ [CONTROLLER] Listando construções disponíveis');
            
            const filters = req.query;
            const constructions = await this.constructionService.getAvailableConstructions(filters);
            
            return ResponseHelper.success(res, {
                constructions,
                total: constructions.length,
                message: 'Construções disponíveis listadas com sucesso'
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao listar construções:', error);
            return ResponseHelper.error(res, 'Erro ao listar construções disponíveis', 500);
        }
    }

    /**
     * Verificar se pode iniciar construção
     */
    async canStartConstruction(req, res) {
        try {
            console.log('🔍 [CONTROLLER] Verificando possibilidade de iniciar construção');
            
            // CORREÇÃO: Validar se user existe
            if (!req.user || !req.user.id) {
                return ResponseHelper.unauthorized(res, 'Usuário não autenticado');
            }

            const userId = req.user.id;
            const { constructionTypeId } = req.params;

            // CORREÇÃO: Validar parâmetros
            if (!constructionTypeId) {
                return ResponseHelper.badRequest(res, 'ID do tipo de construção é obrigatório');
            }
            
            const canStart = await this.constructionService.canStartConstruction(userId, constructionTypeId);
            
            return ResponseHelper.success(res, canStart);

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao verificar construção:', error);
            return ResponseHelper.error(res, 'Erro ao verificar possibilidade de construção', 500);
        }
    }

    /**
     * Iniciar nova construção
     */
    async startConstruction(req, res) {
        try {
            console.log('🚀 [CONTROLLER] Iniciando nova construção');
            
            // CORREÇÃO: Validar autenticação
            if (!req.user || !req.user.id) {
                return ResponseHelper.unauthorized(res, 'Usuário não autenticado');
            }

            const userId = req.user.id;
            const { construction_type_id } = req.body;

            // CORREÇÃO: Validar dados do body
            if (!construction_type_id) {
                return ResponseHelper.badRequest(res, 'ID do tipo de construção é obrigatório');
            }
            
            const result = await this.constructionService.startConstruction(userId, construction_type_id);
            
            return ResponseHelper.success(res, result, 201);

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao iniciar construção:', error);
            
            if (error.message.includes('insuficiente') || error.message.includes('Necessário') || error.message.includes('Limite')) {
                return ResponseHelper.badRequest(res, error.message);
            }

            if (error.message.includes('não encontrado')) {
                return ResponseHelper.notFound(res, error.message);
            }
            
            return ResponseHelper.error(res, 'Erro ao iniciar construção', 500);
        }
    }

    /**
     * Selecionar empresa vencedora da licitação
     */
    async selectBiddingWinner(req, res) {
        try {
            console.log('🏆 [CONTROLLER] Selecionando vencedora da licitação');
            
            // CORREÇÃO: Validar autenticação
            if (!req.user || !req.user.id) {
                return ResponseHelper.unauthorized(res, 'Usuário não autenticado');
            }

            const userId = req.user.id;
            const { constructionId } = req.params;
            const { company_index, reason } = req.body;

            // CORREÇÃO: Validar parâmetros obrigatórios
            if (!constructionId) {
                return ResponseHelper.badRequest(res, 'ID da construção é obrigatório');
            }

            if (company_index === undefined || company_index === null) {
                return ResponseHelper.badRequest(res, 'Índice da empresa é obrigatório');
            }
            
            const result = await this.constructionService.selectBiddingWinner(
                userId, 
                constructionId, 
                company_index, 
                reason
            );
            
            return ResponseHelper.success(res, result);

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao selecionar vencedora:', error);
            
            if (error.message.includes('não encontrada') || error.message.includes('não existe')) {
                return ResponseHelper.notFound(res, error.message);
            }

            if (error.message.includes('inválido') || error.message.includes('licitação')) {
                return ResponseHelper.badRequest(res, error.message);
            }
            
            return ResponseHelper.error(res, 'Erro ao selecionar empresa vencedora', 500);
        }
    }

    /**
     * Listar construções do usuário
     */
    async getUserConstructions(req, res) {
        try {
            console.log('📋 [CONTROLLER] Listando construções do usuário');
            
            // CORREÇÃO: Validar autenticação
            if (!req.user || !req.user.id) {
                return ResponseHelper.unauthorized(res, 'Usuário não autenticado');
            }

            const userId = req.user.id;
            const filters = req.query;
            
            const constructions = await this.constructionService.getUserConstructions(userId, filters);
            
            return ResponseHelper.success(res, {
                constructions,
                total: constructions.length,
                summary: this.generateConstructionsSummary(constructions),
                message: 'Construções do usuário listadas com sucesso'
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao listar construções do usuário:', error);
            return ResponseHelper.error(res, 'Erro ao listar construções do usuário', 500);
        }
    }

    /**
     * Obter detalhes de uma construção específica
     */
    async getConstructionById(req, res) {
        try {
            console.log('🔍 [CONTROLLER] Buscando detalhes da construção');
            
            if (!req.user || !req.user.id) {
                return ResponseHelper.unauthorized(res, 'Usuário não autenticado');
            }

            const userId = req.user.id;
            const { constructionId } = req.params;

            if (!constructionId) {
                return ResponseHelper.badRequest(res, 'ID da construção é obrigatório');
            }

            const construction = await this.constructionService.getConstructionById(userId, constructionId);
            
            return ResponseHelper.success(res, construction);

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao buscar construção:', error);
            
            if (error.message.includes('não encontrada')) {
                return ResponseHelper.notFound(res, error.message);
            }
            
            return ResponseHelper.error(res, 'Erro ao buscar detalhes da construção', 500);
        }
    }

    /**
     * Obter histórico de construções completadas
     */
    async getConstructionHistory(req, res) {
        try {
            console.log('📚 [CONTROLLER] Buscando histórico de construções');
            
            if (!req.user || !req.user.id) {
                return ResponseHelper.unauthorized(res, 'Usuário não autenticado');
            }

            const userId = req.user.id;
            const filters = { ...req.query, status: 'completed' };
            
            const history = await this.constructionService.getUserConstructions(userId, filters);
            
            return ResponseHelper.success(res, {
                history,
                total: history.length,
                message: 'Histórico de construções obtido com sucesso'
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao buscar histórico:', error);
            return ResponseHelper.error(res, 'Erro ao buscar histórico de construções', 500);
        }
    }

    /**
     * Cancelar construção
     */
    async cancelConstruction(req, res) {
        try {
            console.log('🛑 [CONTROLLER] Cancelando construção');
            
            if (!req.user || !req.user.id) {
                return ResponseHelper.unauthorized(res, 'Usuário não autenticado');
            }

            const userId = req.user.id;
            const { constructionId } = req.params;
            const { reason } = req.body;

            if (!constructionId) {
                return ResponseHelper.badRequest(res, 'ID da construção é obrigatório');
            }
            
            const result = await this.constructionService.cancelConstruction(userId, constructionId, reason);
            
            return ResponseHelper.success(res, result);

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao cancelar construção:', error);
            
            if (error.message.includes('não encontrada')) {
                return ResponseHelper.notFound(res, error.message);
            }

            if (error.message.includes('Apenas') || error.message.includes('licitação')) {
                return ResponseHelper.badRequest(res, error.message);
            }
            
            return ResponseHelper.error(res, 'Erro ao cancelar construção', 500);
        }
    }

    /**
     * NOVO: Forçar atualização de construções (Admin)
     */
    async forceConstructionUpdate(req, res) {
        try {
            console.log('🔧 [CONTROLLER] Forçando atualização de construções (Admin)');
            
            if (!req.user || !req.user.id) {
                return ResponseHelper.unauthorized(res, 'Usuário não autenticado');
            }

            // Verificar se é admin (pode adicionar essa validação se necessário)
            // if (!req.user.is_admin) {
            //     return ResponseHelper.forbidden(res, 'Acesso negado - apenas administradores');
            // }

            // Executar verificação de integridade dos dados
            const integrityCheck = await this.constructionService.checkDataIntegrity(req.user.id);
            
            return ResponseHelper.success(res, {
                message: 'Verificação de integridade executada com sucesso',
                integrity_report: integrityCheck,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao forçar atualização:', error);
            return ResponseHelper.error(res, 'Erro ao executar atualização de construções', 500);
        }
    }

    /**
     * Gerar resumo das construções
     * @param {Array} constructions - Lista de construções
     * @returns {Object} - Resumo estatístico
     */
    generateConstructionsSummary(constructions) {
        if (!Array.isArray(constructions) || constructions.length === 0) {
            return {
                total: 0,
                by_status: {},
                by_category: {},
                total_invested: 0,
                active_constructions: 0,
                completed_constructions: 0,
                average_progress: 0
            };
        }

        const summary = {
            total: constructions.length,
            by_status: {},
            by_category: {},
            total_invested: 0,
            active_constructions: 0,
            completed_constructions: 0,
            average_progress: 0
        };

        constructions.forEach(construction => {
            const status = construction.status || 'unknown';
            const category = construction.construction_types?.category || 'unknown';
            
            // Contar por status
            summary.by_status[status] = (summary.by_status[status] || 0) + 1;
            
            // Contar por categoria
            summary.by_category[category] = (summary.by_category[category] || 0) + 1;
            
            // Somar investimentos
            summary.total_invested += parseFloat(construction.final_cost || 0);
            
            // Contar ativas e completas
            if (status === 'in_progress' || status === 'bidding') {
                summary.active_constructions++;
            }
            if (status === 'completed') {
                summary.completed_constructions++;
            }
        });

        // Calcular progresso médio das construções ativas
        const activeConstructions = constructions.filter(c => 
            c.status === 'in_progress' || c.status === 'bidding'
        );
        
        if (activeConstructions.length > 0) {
            const totalProgress = activeConstructions.reduce((sum, c) => 
                sum + (c.progress_percentage || 0), 0
            );
            summary.average_progress = Math.round((totalProgress / activeConstructions.length) * 100) / 100;
        }

        return summary;
    }
}

module.exports = ConstructionController;