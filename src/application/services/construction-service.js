const { supabase } = require('../../infrastructure/database/supabase-client');
const ConstructionAIService = require('./construction-ai-service');
const StateService = require('./state-service');
// CORREÇÃO CRÍTICA: Import das constantes corrigido
const CONSTRUCTION_CONSTANTS = require('../../shared/constants/construction-constants');

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

            // VALIDAÇÃO: Verificar se os IDs são válidos
            if (!userId || !constructionTypeId) {
                return { canStart: false, reason: 'IDs inválidos fornecidos' };
            }

            // Buscar dados do estado do usuário
            const stateData = await this.stateService.getCompleteStateData(userId);
            if (!stateData) {
                return { canStart: false, reason: 'Estado não encontrado' };
            }

            // CORREÇÃO: Verificar se stateData tem a estrutura esperada
            if (!stateData.economy) {
                return { canStart: false, reason: 'Dados econômicos do estado não encontrados' };
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

            // CORREÇÃO CRÍTICA: Verificar construções ativas - usar constante correta
            const { data: activeConstructions, error: activeError } = await supabase
                .from('active_constructions')
                .select('id')
                .eq('user_id', userId)
                .in('status', [CONSTRUCTION_CONSTANTS.STATUS.BIDDING, CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS]);

            if (activeError) {
                throw new Error(`Erro ao verificar construções ativas: ${activeError.message}`);
            }

            // Verificar limites
            if (activeConstructions && activeConstructions.length >= CONSTRUCTION_CONSTANTS.MAX_CONCURRENT_CONSTRUCTIONS) {
                return { 
                    canStart: false, 
                    reason: `Limite de ${CONSTRUCTION_CONSTANTS.MAX_CONCURRENT_CONSTRUCTIONS} construções simultâneas atingido` 
                };
            }

            // CORREÇÃO: Verificar se os valores são números válidos
            const gdp = Number(stateData.economy.gdp) || 0;
            const population = Number(stateData.economy.population) || 0;
            const treasuryBalance = Number(stateData.economy.treasury_balance) || 0;
            const minGdp = Number(construction.min_gdp) || 0;
            const minPopulation = Number(construction.min_population) || 0;
            const baseCost = Number(construction.base_cost) || 0;

            // Verificar requisitos econômicos
            if (gdp < minGdp) {
                return { 
                    canStart: false, 
                    reason: `PIB insuficiente. Necessário: R$ ${minGdp} milhões` 
                };
            }

            if (population < minPopulation) {
                return { 
                    canStart: false, 
                    reason: `População insuficiente. Necessário: ${minPopulation} habitantes` 
                };
            }

            if (treasuryBalance < baseCost) {
                return { 
                    canStart: false, 
                    reason: `Saldo insuficiente. Necessário: R$ ${baseCost} milhões` 
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

            // CORREÇÃO: Adicionar validação de entrada
            if (!userId || !constructionTypeId) {
                throw new Error('IDs de usuário e tipo de construção são obrigatórios');
            }

            // Verificar se pode iniciar
            const canStart = await this.canStartConstruction(userId, constructionTypeId);
            if (!canStart.canStart) {
                throw new Error(canStart.reason);
            }

            const { construction, stateData } = canStart;

            // CORREÇÃO: Validar se temos os dados necessários
            if (!construction || !stateData) {
                throw new Error('Dados insuficientes para iniciar construção');
            }

            // Debitar valor do tesouro
            const currentBalance = Number(stateData.economy.treasury_balance) || 0;
            const constructionCost = Number(construction.base_cost) || 0;
            const newBalance = currentBalance - constructionCost;

            await this.stateService.updateEconomy(userId, {
                treasury_balance: newBalance
            });

            // Calcular data de conclusão estimada
            const estimatedCompletion = new Date();
            const constructionDays = Number(construction.construction_days) || 30;
            estimatedCompletion.setDate(estimatedCompletion.getDate() + constructionDays);

            // CORREÇÃO: Verificar se state_id existe no stateData
            const stateId = stateData.state_info?.id;
            if (!stateId) {
                throw new Error('ID do estado não encontrado nos dados do usuário');
            }

            // Criar registro da construção
            const { data: newConstruction, error: constructionError } = await supabase
                .from('active_constructions')
                .insert([{
                    user_id: userId,
                    state_id: stateId,
                    construction_type_id: constructionTypeId,
                    status: CONSTRUCTION_CONSTANTS.STATUS.BIDDING,
                    estimated_completion: estimatedCompletion.toISOString().split('T')[0],
                    final_cost: constructionCost
                }])
                .select()
                .single();

            if (constructionError) {
                // ROLLBACK: Devolver o dinheiro em caso de erro
                await this.stateService.updateEconomy(userId, {
                    treasury_balance: currentBalance
                });
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

            // CORREÇÃO: Verificar se o aiService está disponível
            if (!this.aiService) {
                console.warn('⚠️ Serviço de IA não disponível, usando licitação mockada');
                return this.generateMockBidding(constructionId, constructionData);
            }

            // Gerar empresas com IA
            const aiResult = await this.aiService.generateBiddingCompanies(constructionData, stateData);

            // CORREÇÃO: Validar resposta da IA
            if (!aiResult || !aiResult.companies || !Array.isArray(aiResult.companies)) {
                console.warn('⚠️ Resposta da IA inválida, usando licitação mockada');
                return this.generateMockBidding(constructionId, constructionData);
            }

            // Criar registro da licitação
            const { data: bidding, error: biddingError } = await supabase
                .from('construction_biddings')
                .insert([{
                    construction_id: constructionId,
                    status: CONSTRUCTION_CONSTANTS.BIDDING_STATUS.OPEN,
                    generated_companies: aiResult.companies,
                    ai_context: aiResult.context || {},
                    ai_prompt_used: aiResult.prompt_used || '',
                    ai_response_time_ms: aiResult.response_time_ms || 0
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
            // FALLBACK: Gerar licitação mockada em caso de erro
            return this.generateMockBidding(constructionId, constructionData);
        }
    }

    /**
     * NOVO: Gerar licitação mockada como fallback
     * @param {string} constructionId - ID da construção
     * @param {Object} constructionData - Dados da construção
     * @returns {Promise<Object>} - Dados da licitação mockada
     */
    async generateMockBidding(constructionId, constructionData) {
        try {
            console.log('🔧 Gerando licitação mockada...');

            const baseCost = Number(constructionData.base_cost) || 1000;
            
            const mockCompanies = [
                {
                    name: 'Construtora Alpha Ltda',
                    proposed_cost: baseCost * 0.95,
                    estimated_days: (constructionData.construction_days || 30) + 5,
                    experience_level: 'Alto',
                    company_history: 'Empresa consolidada no mercado',
                    hidden_incentive: 0
                },
                {
                    name: 'Beta Engenharia S/A',
                    proposed_cost: baseCost * 1.10,
                    estimated_days: (constructionData.construction_days || 30) - 3,
                    experience_level: 'Médio',
                    company_history: 'Empresa em crescimento',
                    hidden_incentive: baseCost * 0.02
                },
                {
                    name: 'Gamma Construções',
                    proposed_cost: baseCost * 1.05,
                    estimated_days: constructionData.construction_days || 30,
                    experience_level: 'Alto',
                    company_history: 'Tradição em obras públicas',
                    hidden_incentive: 0
                }
            ];

            const { data: bidding, error: biddingError } = await supabase
                .from('construction_biddings')
                .insert([{
                    construction_id: constructionId,
                    status: CONSTRUCTION_CONSTANTS.BIDDING_STATUS.OPEN,
                    generated_companies: mockCompanies,
                    ai_context: { mock: true, reason: 'AI service unavailable' },
                    ai_prompt_used: 'Mock bidding generation',
                    ai_response_time_ms: 0
                }])
                .select()
                .single();

            if (biddingError) {
                throw new Error(`Erro ao criar licitação mockada: ${biddingError.message}`);
            }

            console.log('✅ Licitação mockada gerada com sucesso');
            return bidding;

        } catch (error) {
            console.error('❌ Erro ao gerar licitação mockada:', error);
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
            console.log('🏆 Selecionando empresa vencedora...');

            // CORREÇÃO: Validar parâmetros de entrada
            if (!userId || !constructionId || companyIndex === undefined) {
                throw new Error('Parâmetros inválidos para seleção da empresa');
            }

            // Buscar construção e licitação
            const { data: construction, error: constructionError } = await supabase
                .from('active_constructions')
                .select(`
                    *,
                    construction_types (name, construction_days),
                    construction_biddings (generated_companies, status)
                `)
                .eq('id', constructionId)
                .eq('user_id', userId)
                .single();

            if (constructionError || !construction) {
                throw new Error('Construção não encontrada');
            }

            // CORREÇÃO: Verificar se está em licitação
            if (construction.status !== CONSTRUCTION_CONSTANTS.STATUS.BIDDING) {
                throw new Error('Esta construção não está em processo de licitação');
            }

            // CORREÇÃO: Verificar se tem licitação associada
            const bidding = construction.construction_biddings;
            if (!bidding || !bidding.generated_companies || !Array.isArray(bidding.generated_companies)) {
                throw new Error('Licitação não encontrada ou inválida');
            }

            // CORREÇÃO: Validar índice da empresa
            const companyIdx = Number(companyIndex);
            if (companyIdx < 0 || companyIdx >= bidding.generated_companies.length) {
                throw new Error('Índice de empresa inválido');
            }

            const selectedCompany = bidding.generated_companies[companyIdx];
            if (!selectedCompany) {
                throw new Error('Empresa selecionada não encontrada');
            }

            // Verificar corrupção
            const hasCorruption = selectedCompany.hidden_incentive && selectedCompany.hidden_incentive > 0;
            const corruptionAmount = hasCorruption ? Number(selectedCompany.hidden_incentive) : 0;

            // Calcular nova data de conclusão
            const newEstimatedCompletion = new Date();
            const estimatedDays = Number(selectedCompany.estimated_days) || Number(construction.construction_types?.construction_days) || 30;
            newEstimatedCompletion.setDate(newEstimatedCompletion.getDate() + estimatedDays);

            // Atualizar construção
            const { error: updateError } = await supabase
                .from('active_constructions')
                .update({
                    status: CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS,
                    selected_company_index: companyIdx,
                    selected_company_name: selectedCompany.name,
                    final_cost: Number(selectedCompany.proposed_cost) || construction.final_cost,
                    estimated_completion: newEstimatedCompletion.toISOString().split('T')[0],
                    started_at: new Date().toISOString(),
                    selection_reason: reason || 'Melhor proposta',
                    has_corruption: hasCorruption,
                    corruption_amount: corruptionAmount,
                    estimated_days: estimatedDays
                })
                .eq('id', constructionId);

            if (updateError) {
                throw new Error(`Erro ao atualizar construção: ${updateError.message}`);
            }

            // Atualizar status da licitação
            const { error: biddingUpdateError } = await supabase
                .from('construction_biddings')
                .update({
                    status: CONSTRUCTION_CONSTANTS.BIDDING_STATUS.CLOSED,
                    selected_company_index: companyIdx
                })
                .eq('construction_id', constructionId);

            if (biddingUpdateError) {
                console.warn('⚠️ Erro ao atualizar licitação:', biddingUpdateError.message);
            }

            console.log('✅ Empresa selecionada com sucesso');
            
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

            // CORREÇÃO: Validar userId
            if (!userId) {
                throw new Error('ID do usuário é obrigatório');
            }

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

            // CORREÇÃO: Verificar se data existe antes de processar
            if (!data) {
                return [];
            }

            // Calcular progresso para cada construção
            const constructionsWithProgress = data.map(construction => {
                try {
                    const progress = this.calculateConstructionProgress(construction);
                    return {
                        ...construction,
                        progress_percentage: progress.percentage,
                        days_remaining: progress.daysRemaining,
                        is_delayed: progress.isDelayed,
                        delay_days: progress.delayDays
                    };
                } catch (progressError) {
                    console.warn(`⚠️ Erro ao calcular progresso da construção ${construction.id}:`, progressError);
                    return {
                        ...construction,
                        progress_percentage: 0,
                        days_remaining: 0,
                        is_delayed: false,
                        delay_days: 0
                    };
                }
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
        try {
            // CORREÇÃO: Validar dados de entrada
            if (!construction) {
                throw new Error('Dados da construção não fornecidos');
            }

            const now = new Date();
            let startDate, estimatedEnd;

            // CORREÇÃO: Tratar datas com validação
            try {
                startDate = construction.started_at ? new Date(construction.started_at) : new Date(construction.created_at);
                estimatedEnd = new Date(construction.estimated_completion);
            } catch (dateError) {
                console.warn('⚠️ Erro ao parsear datas:', dateError);
                return {
                    percentage: 0,
                    daysRemaining: 0,
                    isDelayed: false,
                    delayDays: 0,
                    totalDays: 0,
                    elapsedDays: 0
                };
            }

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
        } catch (error) {
            console.error('❌ Erro ao calcular progresso:', error);
            // Retornar valores padrão em caso de erro
            return {
                percentage: 0,
                daysRemaining: 0,
                isDelayed: false,
                delayDays: 0,
                totalDays: 0,
                elapsedDays: 0
            };
        }
    }

    /**
     * NOVO: Obter detalhes de uma construção específica
     * @param {string} userId - ID do usuário
     * @param {string} constructionId - ID da construção
     * @returns {Promise<Object>} - Detalhes da construção
     */
    async getConstructionById(userId, constructionId) {
        try {
            console.log('🔍 Buscando detalhes da construção...');

            if (!userId || !constructionId) {
                throw new Error('Parâmetros inválidos');
            }

            const { data: construction, error } = await supabase
                .from('active_constructions')
                .select(`
                    *,
                    construction_types (name, description, category, base_cost, construction_days),
                    construction_biddings (generated_companies, selected_company_index, status)
                `)
                .eq('id', constructionId)
                .eq('user_id', userId)
                .single();

            if (error || !construction) {
                throw new Error('Construção não encontrada');
            }

            // Calcular progresso
            const progress = this.calculateConstructionProgress(construction);

            return {
                ...construction,
                progress_percentage: progress.percentage,
                days_remaining: progress.daysRemaining,
                is_delayed: progress.isDelayed,
                delay_days: progress.delayDays,
                total_days: progress.totalDays,
                elapsed_days: progress.elapsedDays
            };

        } catch (error) {
            console.error('❌ Erro ao buscar construção por ID:', error);
            throw error;
        }
    }

    /**
     * NOVO: Verificar integridade dos dados de construção
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Relatório de integridade
     */
    async checkDataIntegrity(userId) {
        try {
            console.log('🔍 Verificando integridade dos dados de construção...');

            const issues = [];
            let totalConstructions = 0;
            let issuesFound = 0;

            // Verificar construções sem licitação
            const { data: constructionsWithoutBidding } = await supabase
                .from('active_constructions')
                .select('id, status')
                .eq('user_id', userId)
                .eq('status', CONSTRUCTION_CONSTANTS.STATUS.BIDDING)
                .is('construction_biddings', null);

            if (constructionsWithoutBidding && constructionsWithoutBidding.length > 0) {
                issues.push({
                    type: 'missing_bidding',
                    count: constructionsWithoutBidding.length,
                    description: 'Construções em licitação sem dados de licitação'
                });
                issuesFound += constructionsWithoutBidding.length;
            }

            // Verificar construções em progresso sem dados de empresa selecionada
            const { data: constructionsWithoutCompany } = await supabase
                .from('active_constructions')
                .select('id, status, selected_company_name')
                .eq('user_id', userId)
                .eq('status', CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS)
                .is('selected_company_name', null);

            if (constructionsWithoutCompany && constructionsWithoutCompany.length > 0) {
                issues.push({
                    type: 'missing_company',
                    count: constructionsWithoutCompany.length,
                    description: 'Construções em progresso sem empresa selecionada'
                });
                issuesFound += constructionsWithoutCompany.length;
            }

            // Contar total de construções
            const { count } = await supabase
                .from('active_constructions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            totalConstructions = count || 0;

            return {
                total_constructions: totalConstructions,
                issues_found: issuesFound,
                issues,
                integrity_score: totalConstructions > 0 ? ((totalConstructions - issuesFound) / totalConstructions * 100).toFixed(2) : 100
            };

        } catch (error) {
            console.error('❌ Erro ao verificar integridade:', error);
            throw error;
        }
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

            // CORREÇÃO: Validar parâmetros
            if (!userId || !constructionId) {
                throw new Error('Parâmetros inválidos para cancelamento');
            }

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

            // CORREÇÃO: Só pode cancelar se estiver em licitação
            if (construction.status !== CONSTRUCTION_CONSTANTS.STATUS.BIDDING) {
                throw new Error('Apenas construções em licitação podem ser canceladas');
            }

            // CORREÇÃO: Verificar se tem dados da construção
            if (!construction.construction_types) {
                throw new Error('Dados do tipo de construção não encontrados');
            }

            // Devolver valor ao tesouro
            const stateData = await this.stateService.getCompleteStateData(userId);
            if (!stateData || !stateData.economy) {
                throw new Error('Dados econômicos do estado não encontrados');
            }

            const refundAmount = Number(construction.construction_types.base_cost) || 0;
            const currentBalance = Number(stateData.economy.treasury_balance) || 0;
            const newBalance = currentBalance + refundAmount;
            
            await this.stateService.updateEconomy(userId, {
                treasury_balance: newBalance
            });

            // Atualizar status
            const { error: updateError } = await supabase
                .from('active_constructions')
                .update({
                    status: CONSTRUCTION_CONSTANTS.STATUS.CANCELLED,
                    cancellation_reason: reason || 'Cancelamento solicitado pelo usuário',
                    cancelled_at: new Date().toISOString()
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
                message: `Construção cancelada. Valor de R$ ${refundAmount} milhões devolvido ao tesouro.`
            };

        } catch (error) {
            console.error('❌ Erro ao cancelar construção:', error);
            throw error;
        }
    }
}

module.exports = ConstructionService;