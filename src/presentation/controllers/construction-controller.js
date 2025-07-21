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
            
            const userId = req.user.id;
            const { constructionTypeId } = req.params;
            
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
            
            const userId = req.user.id;
            const { construction_type_id } = req.body;
            
            const result = await this.constructionService.startConstruction(userId, construction_type_id);
            
            return ResponseHelper.success(res, result, 201);

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao iniciar construção:', error);
            
            if (error.message.includes('insuficiente') || error.message.includes('Necessário')) {
                return ResponseHelper.badRequest(res, error.message);
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
            
            const userId = req.user.id;
            const { constructionId } = req.params;
            const { company_index, reason } = req.body;
            
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
            
            return ResponseHelper.error(res, 'Erro ao selecionar empresa vencedora', 500);
        }
    }

    /**
     * Listar construções do usuário
     */
    async getUserConstructions(req, res) {
        try {
            console.log('📋 [CONTROLLER] Listando construções do usuário');
            
            const userId = req.user.id;
            const filters = req.query;
            
            const constructions = await this.constructionService.getUserConstructions(userId, filters);
            
            return ResponseHelper.success(res, {
                constructions,
                total: constructions.length,
                summary: this.generateConstructionsSummary(constructions)
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao listar construções do usuário:', error);
            return ResponseHelper.error(res, 'Erro ao listar suas construções', 500);
        }
    }

    /**
     * Obter detalhes de uma construção específica
     */
    async getConstructionById(req, res) {
        try {
            console.log('🔍 [CONTROLLER] Buscando detalhes da construção');
            
            const userId = req.user.id;
            const { constructionId } = req.params;
            
            const construction = await this.constructionService.getConstructionDetails(userId, constructionId);
            
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
     * Cancelar construção
     */
    async cancelConstruction(req, res) {
        try {
            console.log('🛑 [CONTROLLER] Cancelando construção');
            
            const userId = req.user.id;
            const { constructionId } = req.params;
            const { reason } = req.body;
            
            const result = await this.constructionService.cancelConstruction(userId, constructionId, reason);
            
            return ResponseHelper.success(res, result);

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao cancelar construção:', error);
            
            if (error.message.includes('não encontrada') || error.message.includes('não podem ser')) {
                return ResponseHelper.badRequest(res, error.message);
            }
            
            return ResponseHelper.error(res, 'Erro ao cancelar construção', 500);
        }
    }

    /**
     * Obter histórico de construções
     */
    async getConstructionHistory(req, res) {
        try {
            console.log('📚 [CONTROLLER] Buscando histórico de construções');
            
            const userId = req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            
            const { data: history, error } = await supabase
                .from('construction_history')
                .select('*')
                .eq('user_id', userId)
                .order('completed_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                throw error;
            }

            const { data: totalCount, error: countError } = await supabase
                .from('construction_history')
                .select('id', { count: 'exact' })
                .eq('user_id', userId);

            if (countError) {
                throw countError;
            }

            return ResponseHelper.success(res, {
                history,
                pagination: {
                    page,
                    limit,
                    total: totalCount.length,
                    total_pages: Math.ceil(totalCount.length / limit)
                }
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao buscar histórico:', error);
            return ResponseHelper.error(res, 'Erro ao buscar histórico de construções', 500);
        }
    }

    /**
     * Forçar atualização de construções (Admin)
     */
    async forceConstructionUpdate(req, res) {
        try {
            console.log('🔧 [CONTROLLER] Forçando atualização de construções');
            
            // Esta função seria chamada pela job
            // Por enquanto, retornamos sucesso
            return ResponseHelper.success(res, {
                message: 'Atualização de construções executada com sucesso'
            });

        } catch (error) {
            console.error('❌ [CONTROLLER] Erro ao forçar atualização:', error);
            return ResponseHelper.error(res, 'Erro ao executar atualização', 500);
        }
    }

    /**
     * Gerar resumo das construções
     * @param {Array} constructions - Lista de construções
     * @returns {Object} - Resumo estatístico
     */
    generateConstructionsSummary(constructions) {
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
            const status = construction.status;
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
            summary.average_progress = totalProgress / activeConstructions.length;
        }

        return summary;
    }
}

module.exports = ConstructionController;