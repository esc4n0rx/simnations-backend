const { supabase } = require('../../infrastructure/database/supabase-client');
const ConstructionAIService = require('./construction-ai-service');
const StateService = require('./state-service');
const { CONSTRUCTION_CONSTANTS } = require('../../shared/constants/construction-constants');

class ConstructionService {
    constructor() {
        this.aiService = new ConstructionAIService();
        this.stateService = new StateService();
    }

    /**
     * Listar todas as construções disponíveis
     * @param {Object} filters - Filtros opcionais
     * @returns {Promise<Array>} - Lista de construções disponíveis
     */
    async getAvailableConstructions(filters = {}) {
        try {
            console.log('🏗️ Buscando construções disponíveis...');

            let query = supabase
                .from('construction_types')
                .select('*')
                .eq('is_active', true)
                .order('category', { ascending: true });

            // Aplicar filtros se fornecidos
            if (filters.category) {
                query = query.eq('category', filters.category);
            }
            
            if (filters.max_cost) {
                query = query.lte('base_cost', filters.max_cost);
            }

            if (filters.min_gdp) {
                query = query.lte('min_gdp', filters.min_gdp);
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(`Erro ao buscar construções: ${error.message}`);
            }
            console.log(`✅ ${data.length} construções disponíveis encontradas`);
        return data;

    } catch (error) {
        console.error('❌ Erro ao listar construções:', error);
        throw error;
    }
}

/**
 * Verificar se usuário pode iniciar uma construção
 * @param {string} userId - ID do usuário
 * @param {string} constructionTypeId - ID do tipo de construção
 * @returns {Promise<Object>} - Resultado da verificação
 */
async canStartConstruction(userId, constructionTypeId) {
    try {
        console.log('🔍 Verificando possibilidade de iniciar construção...');

        // Buscar dados do estado do usuário
        const stateData = await this.stateService.getCompleteStateData(userId);
        if (!stateData) {
            return { canStart: false, reason: 'Estado não encontrado' };
        }

        // Buscar dados da construção
        const { data: construction, error: constructionError } = await supabase
            .from('construction_types')
            .select('*')
            .eq('id', constructionTypeId)
            .eq('is_active', true)
            .single();

        if (constructionError || !construction) {
            return { canStart: false, reason: 'Tipo de construção não encontrado' };
        }

        // Verificar construções ativas
        const { data: activeConstructions, error: activeError } = await supabase
            .from('active_constructions')
            .select('id')
            .eq('user_id', userId)
            .in('status', [CONSTRUCTION_CONSTANTS.STATUS.BIDDING, CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS]);

        if (activeError) {
            throw new Error(`Erro ao verificar construções ativas: ${activeError.message}`);
        }

        // Verificar limites
        if (activeConstructions.length >= CONSTRUCTION_CONSTANTS.MAX_CONCURRENT_CONSTRUCTIONS) {
            return { 
                canStart: false, 
                reason: `Limite de ${CONSTRUCTION_CONSTANTS.MAX_CONCURRENT_CONSTRUCTIONS} construções simultâneas atingido` 
            };
        }

        // Verificar requisitos econômicos
        if (stateData.economy.gdp < construction.min_gdp) {
            return { 
                canStart: false, 
                reason: `PIB insuficiente. Necessário: R$ ${construction.min_gdp} milhões` 
            };
        }

        if (stateData.economy.population < construction.min_population) {
            return { 
                canStart: false, 
                reason: `População insuficiente. Necessário: ${construction.min_population} habitantes` 
            };
        }

        if (stateData.economy.treasury_balance < construction.base_cost) {
            return { 
                canStart: false, 
                reason: `Saldo insuficiente. Necessário: R$ ${construction.base_cost} milhões` 
            };
        }

        return { 
            canStart: true, 
            construction,
            stateData 
        };

    } catch (error) {
        console.error('❌ Erro ao verificar possibilidade de construção:', error);
        throw error;
    }
}

/**
 * Iniciar uma nova construção
 * @param {string} userId - ID do usuário
 * @param {string} constructionTypeId - ID do tipo de construção
 * @returns {Promise<Object>} - Dados da construção iniciada
 */
async startConstruction(userId, constructionTypeId) {
    try {
        console.log('🚀 Iniciando nova construção...');

        // Verificar se pode iniciar
        const canStart = await this.canStartConstruction(userId, constructionTypeId);
        if (!canStart.canStart) {
            throw new Error(canStart.reason);
        }

        const { construction, stateData } = canStart;

        // Debitar valor do tesouro
        const newBalance = stateData.economy.treasury_balance - construction.base_cost;
        await this.stateService.updateEconomy(userId, {
            treasury_balance: newBalance
        });

        // Calcular data de conclusão estimada
        const estimatedCompletion = new Date();
        estimatedCompletion.setDate(estimatedCompletion.getDate() + construction.construction_days);

        // Criar registro da construção
        const { data: newConstruction, error: constructionError } = await supabase
            .from('active_constructions')
            .insert([{
                user_id: userId,
                state_id: stateData.state_info.id,
                construction_type_id: constructionTypeId,
                status: CONSTRUCTION_CONSTANTS.STATUS.BIDDING,
                estimated_completion: estimatedCompletion.toISOString().split('T')[0],
                final_cost: construction.base_cost
            }])
            .select()
            .single();

        if (constructionError) {
            throw new Error(`Erro ao criar construção: ${constructionError.message}`);
        }

        console.log('✅ Construção criada, iniciando processo de licitação...');

        // Gerar licitação com empresas via IA
        const biddingResult = await this.generateBidding(newConstruction.id, construction, stateData);

        console.log('🎉 Construção iniciada com sucesso!');
        
        return {
            construction: newConstruction,
            bidding: biddingResult,
            message: 'Construção iniciada e licitação gerada com sucesso'
        };

    } catch (error) {
        console.error('❌ Erro ao iniciar construção:', error);
        throw error;
    }
}

/**
 * Gerar licitação com empresas via IA
 * @param {string} constructionId - ID da construção
 * @param {Object} constructionData - Dados da construção
 * @param {Object} stateData - Dados do estado
 * @returns {Promise<Object>} - Dados da licitação gerada
 */
async generateBidding(constructionId, constructionData, stateData) {
    try {
        console.log('📋 Gerando licitação via IA...');

        // Gerar empresas com IA
        const aiResult = await this.aiService.generateBiddingCompanies(constructionData, stateData);

        // Criar registro da licitação
        const { data: bidding, error: biddingError } = await supabase
            .from('construction_biddings')
            .insert([{
                construction_id: constructionId,
                status: CONSTRUCTION_CONSTANTS.BIDDING_STATUS.OPEN,
                generated_companies: aiResult.companies,
                ai_context: aiResult.context,
                ai_prompt_used: aiResult.prompt_used,
                ai_response_time_ms: aiResult.response_time_ms
            }])
            .select()
            .single();

        if (biddingError) {
            throw new Error(`Erro ao criar licitação: ${biddingError.message}`);
        }

        console.log('✅ Licitação gerada com sucesso');
        return bidding;

    } catch (error) {
        console.error('❌ Erro ao gerar licitação:', error);
        throw error;
    }
}

/**
 * Selecionar empresa vencedora da licitação
 * @param {string} userId - ID do usuário
 * @param {string} constructionId - ID da construção
 * @param {number} companyIndex - Índice da empresa selecionada
 * @param {string} reason - Motivo da seleção
 * @returns {Promise<Object>} - Resultado da seleção
 */
async selectBiddingWinner(userId, constructionId, companyIndex, reason) {
    try {
        console.log('🏆 Selecionando vencedora da licitação...');

        // Buscar construção e licitação
        const { data: construction, error: constructionError } = await supabase
            .from('active_constructions')
            .select(`
                *,
                construction_biddings (*)
            `)
            .eq('id', constructionId)
            .eq('user_id', userId)
            .single();

        if (constructionError || !construction) {
            throw new Error('Construção não encontrada');
        }

        const bidding = construction.construction_biddings[0];
        if (!bidding || bidding.status !== CONSTRUCTION_CONSTANTS.BIDDING_STATUS.OPEN) {
            throw new Error('Licitação não encontrada ou não está aberta');
        }

        const companies = bidding.generated_companies;
        if (!companies[companyIndex]) {
            throw new Error('Empresa selecionada não existe');
        }

        const selectedCompany = companies[companyIndex];

        // Processar corrupção se houver
        let corruptionAmount = 0;
        let hasCorruption = false;
        
        if (selectedCompany.corruption_offer && selectedCompany.corruption_offer.amount > 0) {
            hasCorruption = true;
            corruptionAmount = selectedCompany.corruption_offer.amount;

            // Creditar valor da propina ao tesouro (corrupção)
            const stateData = await this.stateService.getCompleteStateData(userId);
            const newBalance = stateData.economy.treasury_balance + corruptionAmount;
            
            await this.stateService.updateEconomy(userId, {
                treasury_balance: newBalance
            });

            // Impactar índice de corrupção
            const newCorruptionIndex = Math.min(100, (stateData.governance?.corruption_index || 30) + 5);
            await this.stateService.updateGovernance(userId, {
                corruption_index: newCorruptionIndex
            });

            console.log(`💰 Propina de R$ ${corruptionAmount} milhões creditada`);
        }

        // Atualizar construção com empresa vencedora
        const newEstimatedCompletion = new Date();
        newEstimatedCompletion.setDate(newEstimatedCompletion.getDate() + selectedCompany.estimated_days);

        const { error: updateConstructionError } = await supabase
            .from('active_constructions')
            .update({
                status: CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS,
                final_cost: selectedCompany.proposed_price,
                estimated_completion: newEstimatedCompletion.toISOString().split('T')[0],
                winning_company: selectedCompany,
                has_corruption: hasCorruption,
                corruption_amount: corruptionAmount
            })
            .eq('id', constructionId);

        if (updateConstructionError) {
            throw new Error(`Erro ao atualizar construção: ${updateConstructionError.message}`);
        }

        // Fechar licitação
        const { error: closeBiddingError } = await supabase
            .from('construction_biddings')
            .update({
                status: CONSTRUCTION_CONSTANTS.BIDDING_STATUS.CLOSED,
                selected_company_index: companyIndex,
                selection_reason: reason,
                closed_at: new Date().toISOString()
            })
            .eq('id', bidding.id);

        if (closeBiddingError) {
            throw new Error(`Erro ao fechar licitação: ${closeBiddingError.message}`);
        }

        console.log('🎉 Empresa vencedora selecionada com sucesso!');
        
        return {
            selected_company: selectedCompany,
            has_corruption: hasCorruption,
            corruption_amount: corruptionAmount,
            new_estimated_completion: newEstimatedCompletion,
            message: 'Empresa selecionada e obra iniciada com sucesso'
        };

    } catch (error) {
        console.error('❌ Erro ao selecionar vencedora:', error);
        throw error;
    }
}

/**
 * Listar construções do usuário
 * @param {string} userId - ID do usuário
 * @param {Object} filters - Filtros opcionais
 * @returns {Promise<Array>} - Lista de construções do usuário
 */
async getUserConstructions(userId, filters = {}) {
    try {
        console.log('📋 Buscando construções do usuário...');

        let query = supabase
            .from('active_constructions')
            .select(`
                *,
                construction_types (name, description, category),
                construction_biddings (generated_companies, selected_company_index)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        // Aplicar filtros
        if (filters.status) {
            query = query.eq('status', filters.status);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Erro ao buscar construções: ${error.message}`);
        }

        // Calcular progresso para cada construção
        const constructionsWithProgress = data.map(construction => {
            const progress = this.calculateConstructionProgress(construction);
            return {
                ...construction,
                progress_percentage: progress.percentage,
                days_remaining: progress.daysRemaining,
                is_delayed: progress.isDelayed,
                delay_days: progress.delayDays
            };
        });

        console.log(`✅ ${constructionsWithProgress.length} construções encontradas`);
        return constructionsWithProgress;

    } catch (error) {
        console.error('❌ Erro ao buscar construções do usuário:', error);
        throw error;
    }
}

/**
 * Calcular progresso de uma construção
 * @param {Object} construction - Dados da construção
 * @returns {Object} - Dados de progresso
 */
calculateConstructionProgress(construction) {
    const now = new Date();
    const startDate = new Date(construction.started_at);
    const estimatedEnd = new Date(construction.estimated_completion);
    
    const totalDays = Math.ceil((estimatedEnd - startDate) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil((estimatedEnd - now) / (1000 * 60 * 60 * 24)));
    
    let percentage = 0;
    if (construction.status === CONSTRUCTION_CONSTANTS.STATUS.COMPLETED) {
        percentage = 100;
    } else if (construction.status === CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS) {
        percentage = Math.min(95, Math.max(0, (elapsedDays / totalDays) * 100));
    } else if (construction.status === CONSTRUCTION_CONSTANTS.STATUS.BIDDING) {
        percentage = 5; // 5% para processo de licitação
    }

    const isDelayed = now > estimatedEnd && construction.status !== CONSTRUCTION_CONSTANTS.STATUS.COMPLETED;
    const delayDays = isDelayed ? Math.ceil((now - estimatedEnd) / (1000 * 60 * 60 * 24)) : 0;

    return {
        percentage: Math.round(percentage * 100) / 100,
        daysRemaining,
        isDelayed,
        delayDays,
        totalDays,
        elapsedDays
    };
}

/**
 * Cancelar construção (apenas se em licitação)
 * @param {string} userId - ID do usuário
 * @param {string} constructionId - ID da construção
 * @param {string} reason - Motivo do cancelamento
 * @returns {Promise<Object>} - Resultado do cancelamento
 */
async cancelConstruction(userId, constructionId, reason) {
    try {
        console.log('🛑 Cancelando construção...');

        // Buscar construção
        const { data: construction, error: constructionError } = await supabase
            .from('active_constructions')
            .select(`
                *,
                construction_types (base_cost)
            `)
            .eq('id', constructionId)
            .eq('user_id', userId)
            .single();

        if (constructionError || !construction) {
            throw new Error('Construção não encontrada');
        }

        // Só pode cancelar se estiver em licitação
        if (construction.status !== CONSTRUCTION_CONSTANTS.STATUS.BIDDING) {
            throw new Error('Apenas construções em licitação podem ser canceladas');
        }

        // Devolver valor ao tesouro
        const stateData = await this.stateService.getCompleteStateData(userId);
        const refundAmount = construction.construction_types.base_cost;
        const newBalance = stateData.economy.treasury_balance + refundAmount;
        
        await this.stateService.updateEconomy(userId, {
            treasury_balance: newBalance
        });

        // Atualizar status
        const { error: updateError } = await supabase
            .from('active_constructions')
            .update({
                status: CONSTRUCTION_CONSTANTS.STATUS.CANCELLED
            })
            .eq('id', constructionId);

        if (updateError) {
            throw new Error(`Erro ao cancelar construção: ${updateError.message}`);
        }

        // Cancelar licitação se existir
        await supabase
            .from('construction_biddings')
            .update({
                status: CONSTRUCTION_CONSTANTS.BIDDING_STATUS.CANCELLED
            })
            .eq('construction_id', constructionId);

        console.log('✅ Construção cancelada com sucesso');
        
        return {
            refunded_amount: refundAmount,
            message: `Construção cancelada. R$ ${refundAmount} milhões devolvidos ao tesouro.`
        };

    } catch (error) {
        console.error('❌ Erro ao cancelar construção:', error);
        throw error;
    }
}

/**
 * Obter detalhes completos de uma construção
 * @param {string} userId - ID do usuário
 * @param {string} constructionId - ID da construção
 * @returns {Promise<Object>} - Detalhes completos da construção
 */
async getConstructionDetails(userId, constructionId) {
    try {
        console.log('🔍 Buscando detalhes da construção...');

        const { data, error } = await supabase
            .from('active_constructions')
            .select(`
                *,
                construction_types (*),
                construction_biddings (*)
            `)
            .eq('id', constructionId)
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            throw new Error('Construção não encontrada');
        }

        // Calcular progresso
        const progress = this.calculateConstructionProgress(data);
        
        // Adicionar informações extras
        const constructionDetails = {
            ...data,
            progress: progress,
            can_cancel: data.status === CONSTRUCTION_CONSTANTS.STATUS.BIDDING,
            corruption_risk: this.calculateCorruptionRisk(data),
            estimated_impact: this.calculateEstimatedImpact(data)
        };

        console.log('✅ Detalhes da construção carregados');
        return constructionDetails;

    } catch (error) {
        console.error('❌ Erro ao buscar detalhes da construção:', error);
        throw error;
    }
}

/**
 * Calcular risco de corrupção
 * @param {Object} construction - Dados da construção
 * @returns {string} - Nível de risco
 */
calculateCorruptionRisk(construction) {
    if (construction.has_corruption && !construction.corruption_discovered) {
        return 'alto'; // Há corrupção não descoberta
    } else if (construction.has_corruption && construction.corruption_discovered) {
        return 'descoberto'; // Corrupção foi descoberta
    } else {
        return 'baixo'; // Sem corrupção conhecida
    }
}

/**
 * Calcular impacto estimado
 * @param {Object} construction - Dados da construção
 * @returns {Object} - Impactos estimados
 */
calculateEstimatedImpact(construction) {
    const constructionType = construction.construction_types;
    
    return {
        economic: {
            monthly_gdp_impact: constructionType.economic_impact,
            monthly_maintenance_cost: constructionType.monthly_maintenance
        },
        social: {
            approval_impact: constructionType.population_impact,
            territorial_usage: constructionType.territorial_usage
        }
    };
}

}

module.exports = ConstructionService;