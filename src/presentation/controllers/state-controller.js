const StateService = require('../../application/services/state-service');
const ResponseHelper = require('../../shared/utils/response-helper');

class StateController {
    constructor() {
        this.stateService = new StateService();
    }

    /**
     * Obter dados completos do estado do usuário
     */
    getStateData = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const stateData = await this.stateService.getCompleteStateData(userId);
            
            if (!stateData) {
                return ResponseHelper.notFound(res, 'Dados do estado não encontrados');
            }
            
            ResponseHelper.success(res, stateData, 'Dados do estado obtidos com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Obter apenas dados econômicos
     */
    getEconomyData = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const stateData = await this.stateService.getCompleteStateData(userId);
            
            if (!stateData) {
                return ResponseHelper.notFound(res, 'Dados econômicos não encontrados');
            }
            
            ResponseHelper.success(res, {
                economy: stateData.economy,
                summary: stateData.summary,
                analysis: stateData.analysis.economic_health
            }, 'Dados econômicos obtidos com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Obter apenas dados de governança
     */
    getGovernanceData = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const stateData = await this.stateService.getCompleteStateData(userId);
            
            if (!stateData || !stateData.governance) {
                return ResponseHelper.notFound(res, 'Dados de governança não encontrados');
            }
            
            ResponseHelper.success(res, {
                governance: stateData.governance,
                analysis: stateData.analysis.political_health
            }, 'Dados de governança obtidos com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Atualizar dados econômicos
     */
    updateEconomy = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const updateData = req.body;
            
            const updatedEconomy = await this.stateService.updateEconomy(userId, updateData);
            
            ResponseHelper.success(res, { economy: updatedEconomy }, 'Economia atualizada com sucesso');
        } catch (error) {
            if (error.message === 'Estado não encontrado') {
                return ResponseHelper.notFound(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Atualizar dados de governança
     */
    updateGovernance = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const updateData = req.body;
            
            const updatedGovernance = await this.stateService.updateGovernance(userId, updateData);
            
            ResponseHelper.success(res, { governance: updatedGovernance }, 'Governança atualizada com sucesso');
        } catch (error) {
            if (error.message === 'Governança não encontrada') {
                return ResponseHelper.notFound(res, error.message);
            }
            next(error);
        }
    };

    /**
     * Obter análise detalhada do estado
     */
    getStateAnalysis = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const stateData = await this.stateService.getCompleteStateData(userId);
            
            if (!stateData) {
                return ResponseHelper.notFound(res, 'Estado não encontrado para análise');
            }
            
            ResponseHelper.success(res, {
                analysis: stateData.analysis,
                summary: stateData.summary,
                state_info: stateData.state_info
            }, 'Análise do estado obtida com sucesso');
        } catch (error) {
            next(error);
        }
    };

    /**
     * Obter resumo executivo do estado
     */
    getExecutiveSummary = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const stateData = await this.stateService.getCompleteStateData(userId);
            
            if (!stateData) {
                return ResponseHelper.notFound(res, 'Estado não encontrado');
            }
            
            const executiveSummary = {
                state_info: {
                    country: stateData.state_info.country,
                    state: stateData.state_info.state,
                    assigned_at: stateData.state_info.assigned_at,
                    reload_count: stateData.state_info.reload_count
                },
                key_metrics: {
                    population: stateData.summary.population_formatted,
                    gdp: stateData.summary.gdp_formatted,
                    approval_rating: Math.round(stateData.governance?.approval_rating || 0),
                    economic_status: stateData.analysis.economic_health.status,
                    political_status: stateData.analysis.political_health?.status || 'unknown'
                },
                current_situation: {
                    overall_status: stateData.summary.overall_status,
                    political_risk: stateData.summary.political_risk,
                    debt_situation: stateData.summary.debt_situation,
                    monthly_balance: stateData.summary.monthly_balance_formatted
                },
                immediate_concerns: stateData.analysis.key_challenges
                    .filter(challenge => challenge.priority === 'critical' || challenge.priority === 'high')
                    .slice(0, 3),
                next_actions: stateData.analysis.recommendations
                    .filter(rec => rec.priority === 'high')
                    .slice(0, 3)
            };
            
            ResponseHelper.success(res, executiveSummary, 'Resumo executivo obtido com sucesso');
        } catch (error) {
            next(error);
        }
    };
}

module.exports = StateController;