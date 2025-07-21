const { supabase } = require('../../infrastructure/database/supabase-client');
const ConstructionAIService = require('./construction-ai-service');
const StateService = require('./state-service');
const GroqProvider = require('../../infrastructure/ai/groq-provider'); 
const CONSTRUCTION_CONSTANTS = require('../../shared/constants/construction-constants');

class ConstructionService {
    constructor() {
        const groqProvider = new GroqProvider();
        this.aiService = new ConstructionAIService(groqProvider);
        this.stateService = new StateService();
    }

    /**
     * Iniciar nova construção
     * CORREÇÃO: NÃO inicia a construção imediatamente - apenas cria no status de licitação
     * @param {string} userId - ID do usuário
     * @param {string} constructionTypeId - ID do tipo de construção
     * @returns {Promise<Object>} - Dados da construção criada
     */
    async startConstruction(userId, constructionTypeId) {
        try {
            console.log('🚀 Iniciando nova construção...');

            // Validar dados de entrada
            if (!userId || !constructionTypeId) {
                throw new Error('ID do usuário e ID do tipo de construção são obrigatórios');
            }

            // CORREÇÃO: Usar getCompleteStateData ao invés de getStateData
            const stateData = await this.stateService.getCompleteStateData(userId);
            if (!stateData) {
                throw new Error('Estado não encontrado');
            }

            const stateId = stateData.state_info.id;

            // Buscar tipo de construção
            const { data: construction, error: constructionError } = await supabase
                .from('construction_types')
                .select('*')
                .eq('id', constructionTypeId)
                .single();

            if (constructionError || !construction) {
                throw new Error('Tipo de construção não encontrado');
            }

            // Verificar se atende aos pré-requisitos
            if (construction.min_gdp_required && stateData.economy.gdp < construction.min_gdp_required) {
                throw new Error(`PIB insuficiente. Necessário: R$ ${construction.min_gdp_required} milhões`);
            }

            if (construction.min_population_required && stateData.economy.population < construction.min_population_required) {
                throw new Error(`População insuficiente. Necessário: ${construction.min_population_required} habitantes`);
            }

            // Verificar limites de construções simultâneas
            const { data: activeConstructions, error: activeError } = await supabase
                .from('active_constructions')
                .select('id')
                .eq('user_id', userId)
                .in('status', [CONSTRUCTION_CONSTANTS.STATUS.BIDDING, CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS]);

            if (activeError) {
                throw new Error(`Erro ao verificar construções ativas: ${activeError.message}`);
            }

            if (activeConstructions.length >= CONSTRUCTION_CONSTANTS.MAX_CONCURRENT_CONSTRUCTIONS) {
                throw new Error(`Limite de ${CONSTRUCTION_CONSTANTS.MAX_CONCURRENT_CONSTRUCTIONS} construções simultâneas atingido`);
            }

            // Calcular custo da construção
            const constructionCost = Number(construction.base_cost);
            const currentBalance = Number(stateData.economy.treasury_balance);

            if (currentBalance < constructionCost) {
                throw new Error(`Saldo insuficiente. Necessário: R$ ${constructionCost} milhões, Disponível: R$ ${currentBalance} milhões`);
            }

            // Debitar o valor do tesouro
            console.log(`💰 Debitando R$ ${constructionCost} milhões do tesouro`);
            await this.stateService.updateEconomy(userId, {
                treasury_balance: currentBalance - constructionCost
            });

            // Calcular data estimada de conclusão (apenas para referência inicial)
            const estimatedCompletion = new Date();
            estimatedCompletion.setDate(estimatedCompletion.getDate() + (Number(construction.construction_days) || 30));

            // CORREÇÃO: Criar construção no status de licitação (não iniciar automaticamente)
            const { data: newConstruction, error: createError } = await supabase
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

            if (createError) {
                // ROLLBACK: Devolver o dinheiro em caso de erro
                await this.stateService.updateEconomy(userId, {
                    treasury_balance: currentBalance
                });
                throw new Error(`Erro ao criar construção: ${createError.message}`);
            }

            console.log('✅ Construção criada, iniciando processo de licitação...');

            // CORREÇÃO: Gerar licitação automaticamente mas NÃO iniciar a construção
            const biddingResult = await this.generateBidding(newConstruction.id, construction, stateData);

            console.log('🎉 Construção criada e licitação gerada! Aguardando seleção da empresa vencedora.');
            
            return {
                construction: newConstruction,
                bidding: biddingResult,
                message: 'Construção criada e licitação gerada com sucesso. Selecione a empresa vencedora para iniciar a obra.'
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

            // Tentar gerar empresas com IA
            try {
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

            } catch (aiError) {
                console.error('❌ Erro ao gerar empresas via IA:', aiError);
                console.log('🔄 Gerando empresas de fallback...');
                return this.generateMockBidding(constructionId, constructionData);
            }

        } catch (error) {
            console.error('❌ Erro ao gerar licitação:', error);
            // FALLBACK: Gerar licitação mockada em caso de erro
            return this.generateMockBidding(constructionId, constructionData);
        }
    }

    /**
     * Gerar licitação mockada como fallback
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

        // CORREÇÃO: Buscar construção separadamente
        const { data: construction, error: constructionError } = await supabase
            .from('active_constructions')
            .select(`
                *,
                construction_types (name, construction_days)
            `)
            .eq('id', constructionId)
            .eq('user_id', userId)
            .single();

        if (constructionError || !construction) {
            console.error('❌ Erro ao buscar construção:', constructionError);
            throw new Error('Construção não encontrada');
        }

        // CORREÇÃO: Verificar se está em licitação
        if (construction.status !== CONSTRUCTION_CONSTANTS.STATUS.BIDDING) {
            throw new Error('Esta construção não está em processo de licitação');
        }

        // CORREÇÃO: Buscar licitação separadamente
        const { data: bidding, error: biddingError } = await supabase
            .from('construction_biddings')
            .select('*')
            .eq('construction_id', constructionId)
            .eq('status', CONSTRUCTION_CONSTANTS.BIDDING_STATUS.OPEN)
            .single();

        if (biddingError || !bidding) {
            console.error('❌ Erro ao buscar licitação:', biddingError);
            throw new Error('Licitação não encontrada ou inválida');
        }

        // CORREÇÃO: Verificar se tem empresas geradas
        if (!bidding.generated_companies || !Array.isArray(bidding.generated_companies)) {
            throw new Error('Licitação não possui empresas válidas');
        }

        // CORREÇÃO: Validar índice da empresa
        const companyIdx = Number(companyIndex);
        if (companyIdx < 0 || companyIdx >= bidding.generated_companies.length) {
            throw new Error(`Índice de empresa inválido. Deve estar entre 0 e ${bidding.generated_companies.length - 1}`);
        }

        const selectedCompany = bidding.generated_companies[companyIdx];
        if (!selectedCompany) {
            throw new Error('Empresa selecionada não encontrada');
        }

        console.log('🏢 Empresa selecionada:', selectedCompany.name || selectedCompany.nome);

        // CORREÇÃO: Verificar corrupção (suportar ambos os formatos)
        const corruptionOffer = selectedCompany.corruption_offer || selectedCompany.incentivo_oculto || selectedCompany.hidden_incentive || 0;
        const hasCorruption = corruptionOffer > 0;
        const corruptionAmount = hasCorruption ? Number(corruptionOffer) / 1000 : 0; // Converter de milhares para milhões

        // CORREÇÃO: Obter preço e prazo (suportar ambos os formatos)
        const proposedCost = selectedCompany.proposed_price || selectedCompany.proposta_de_preco || selectedCompany.proposed_cost || construction.final_cost;
        const estimatedDays = selectedCompany.estimated_days || selectedCompany.prazo_estimado || construction.construction_types?.construction_days || 180;

        // Calcular nova data de conclusão
        const currentDate = new Date();
        const newEstimatedCompletion = new Date(currentDate.getTime() + (estimatedDays * 24 * 60 * 60 * 1000));

        // CORREÇÃO: Atualizar construção com empresa vencedora
        const { data: updatedConstruction, error: updateError } = await supabase
            .from('active_constructions')
            .update({
                status: CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS,
                winning_company: selectedCompany,
                final_cost: proposedCost,
                estimated_completion: newEstimatedCompletion.toISOString(),
                has_corruption: hasCorruption,
                corruption_amount: corruptionAmount,
                updated_at: new Date().toISOString()
            })
            .eq('id', constructionId)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Erro ao atualizar construção:', updateError);
            throw new Error('Erro ao atualizar construção com empresa vencedora');
        }

        // CORREÇÃO: Fechar licitação
        const { error: closeBiddingError } = await supabase
            .from('construction_biddings')
            .update({
                status: CONSTRUCTION_CONSTANTS.BIDDING_STATUS.CLOSED,
                selected_company_index: companyIdx,
                selection_reason: reason,
                closed_at: new Date().toISOString()
            })
            .eq('id', bidding.id);

        if (closeBiddingError) {
            console.error('❌ Erro ao fechar licitação:', closeBiddingError);
            // Não falhar por isso, mas logar o erro
        }

        // Log da seleção
        if (hasCorruption) {
            console.log('⚠️ CORRUPÇÃO DETECTADA: Empresa ofereceu propina de R$', corruptionAmount, 'milhões');
        }

        console.log('✅ Empresa selecionada e construção iniciada!');

        return {
            construction_id: constructionId,
            selected_company: {
                name: selectedCompany.name || selectedCompany.nome,
                proposed_price: proposedCost,
                estimated_days: estimatedDays,
                corruption_offer: hasCorruption ? {
                    amount: corruptionAmount,
                    description: 'Incentivo para agilização do processo'
                } : null
            },
            new_status: CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS,
            estimated_completion: newEstimatedCompletion.toISOString(),
            has_corruption: hasCorruption,
            corruption_amount: corruptionAmount,
            message: hasCorruption ? 
                'Empresa selecionada com oferta de propina. A corrupção foi registrada no sistema.' :
                'Empresa selecionada e construção iniciada com sucesso!'
        };

    } catch (error) {
        console.error('❌ Erro ao selecionar empresa vencedora:', error);
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
            console.log('❌ Cancelando construção...');

            // Buscar construção
            const { data: construction, error: constructionError } = await supabase
                .from('active_constructions')
                .select('*, construction_types (base_cost)')
                .eq('id', constructionId)
                .eq('user_id', userId)
                .single();

            if (constructionError || !construction) {
                throw new Error('Construção não encontrada');
            }

            // Verificar se pode cancelar (apenas em licitação)
            if (construction.status !== CONSTRUCTION_CONSTANTS.STATUS.BIDDING) {
                throw new Error('Construção só pode ser cancelada durante o processo de licitação');
            }

            // Devolver o dinheiro
            const refundAmount = Number(construction.final_cost) || Number(construction.construction_types.base_cost);
            const stateData = await this.stateService.getCompleteStateData(userId);
            const currentBalance = Number(stateData.economy.treasury_balance);

            await this.stateService.updateEconomy(userId, {
                treasury_balance: currentBalance + refundAmount
            });

            // Atualizar status
            const { error: updateError } = await supabase
                .from('active_constructions')
                .update({
                    status: CONSTRUCTION_CONSTANTS.STATUS.CANCELLED,
                    cancelled_at: new Date().toISOString(),
                    cancellation_reason: reason
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

            console.log(`✅ Construção cancelada, R$ ${refundAmount} milhões devolvidos ao tesouro`);

            return {
                construction_id: constructionId,
                refunded_amount: refundAmount,
                new_treasury_balance: currentBalance + refundAmount,
                message: 'Construção cancelada e valor devolvido ao tesouro'
            };

        } catch (error) {
            console.error('❌ Erro ao cancelar construção:', error);
            throw error;
        }
    }

    /**
     * Listar construções do usuário
     * @param {string} userId - ID do usuário
     * @param {Object} filters - Filtros opcionais
     * @returns {Promise<Array>} - Lista de construções
     */
    async getUserConstructions(userId, filters = {}) {
    try {
        console.log('📋 Listando construções do usuário...');

        // CORREÇÃO: Usar nomes corretos dos campos da tabela construction_types
        let query = supabase
            .from('active_constructions')
            .select(`
                *,
                construction_types (
                    id,
                    name, 
                    category, 
                    base_cost, 
                    construction_days,
                    economic_impact,
                    population_impact,
                    monthly_maintenance
                ),
                construction_biddings (
                    status,
                    generated_companies,
                    selected_company_index,
                    selection_reason
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        // Aplicar filtros se fornecidos
        if (filters.status) {
            query = query.eq('status', filters.status);
        }

        if (filters.category) {
            query = query.eq('construction_types.category', filters.category);
        }

        const { data: constructions, error } = await query;

        if (error) {
            console.error('❌ Erro na query:', error);
            throw new Error(`Erro ao buscar construções: ${error.message}`);
        }

        return constructions || [];

    } catch (error) {
        console.error('❌ Erro ao listar construções:', error);
        throw error;
    }
}

    /**
     * Obter detalhes de uma construção específica
     * @param {string} userId - ID do usuário
     * @param {string} constructionId - ID da construção
     * @returns {Promise<Object>} - Detalhes da construção
     */
    async getConstructionDetails(userId, constructionId) {
        try {
            const { data: construction, error } = await supabase
                .from('active_constructions')
                .select(`
                    *,
                    construction_types (*),
                    construction_biddings (*)
                `)
                .eq('id', constructionId)
                .eq('user_id', userId)
                .single();

            if (error || !construction) {
                throw new Error('Construção não encontrada');
            }

            return construction;

        } catch (error) {
            console.error('❌ Erro ao buscar detalhes da construção:', error);
            throw error;
        }
    }

    /**
     * Calcular progresso da construção
     * @param {Object} construction - Dados da construção
     * @returns {Object} - Progresso e informações
     */
    calculateConstructionProgress(construction) {
        try {
            if (!construction.started_at || construction.status !== CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS) {
                return {
                    percentage: 0,
                    isDelayed: false,
                    delayDays: 0,
                    remainingDays: construction.estimated_days || 30,
                    elapsedDays: 0
                };
            }

            const startDate = new Date(construction.started_at);
            const endDate = new Date(construction.estimated_completion);
            const currentDate = new Date();

            const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            const elapsedDays = Math.ceil((currentDate - startDate) / (1000 * 60 * 60 * 24));
            
            let percentage = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
            
            // Ajuste por qualidade da empresa e corrupção
            if (construction.has_corruption) {
                percentage = Math.max(0, percentage - 5); // Corrupção atrasa 5%
            }

            const isDelayed = currentDate > endDate;
            const delayDays = isDelayed ? Math.ceil((currentDate - endDate) / (1000 * 60 * 60 * 24)) : 0;
            const remainingDays = Math.max(0, totalDays - elapsedDays);

            return {
                percentage: Math.max(0, percentage),
                isDelayed,
                delayDays,
                remainingDays,
                elapsedDays: Math.max(0, elapsedDays),
                totalDays
            };

        } catch (error) {
            console.error('❌ Erro ao calcular progresso:', error);
            return {
                percentage: 0,
                isDelayed: false,
                delayDays: 0,
                remainingDays: 30,
                elapsedDays: 0,
                totalDays: 30
            };
        }
    }

    /**
     * Forçar atualização de construções (Admin)
     * @returns {Promise<Object>} - Resultado da atualização
     */
    async forceConstructionUpdate() {
        try {
            console.log('🔧 Forçando atualização de construções...');

            // Buscar construções em andamento
            const { data: constructions, error } = await supabase
                .from('active_constructions')
                .select(`
                    *,
                    construction_types (name, gdp_impact, population_impact)
                `)
                .eq('status', CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS);

            if (error) {
                throw new Error(`Erro ao buscar construções: ${error.message}`);
            }

            let completedCount = 0;
            let updatedCount = 0;

            for (const construction of constructions) {
                const progress = this.calculateConstructionProgress(construction);

                // Se chegou a 100% ou passou do prazo, completar
                if (progress.percentage >= 100 || (progress.isDelayed && progress.percentage >= 95)) {
                    await this.completeConstruction(construction);
                    completedCount++;
                } else {
                    // Apenas atualizar progresso
                    await supabase
                        .from('active_constructions')
                        .update({
                            progress_percentage: progress.percentage,
                            delay_days: progress.delayDays
                        })
                        .eq('id', construction.id);

                    updatedCount++;
                }
            }

            console.log(`✅ Atualização concluída: ${completedCount} concluídas, ${updatedCount} atualizadas`);

            return {
                completed_constructions: completedCount,
                updated_constructions: updatedCount,
                total_processed: constructions.length,
                message: `Processadas ${constructions.length} construções: ${completedCount} concluídas, ${updatedCount} atualizadas`
            };

        } catch (error) {
            console.error('❌ Erro na atualização forçada:', error);
            throw error;
        }
    }

    /**
     * Completar uma construção
     * @param {Object} construction - Dados da construção
     * @returns {Promise<void>}
     */
    async completeConstruction(construction) {
        try {
            console.log(`🏁 Completando construção: ${construction.id}`);

            // Calcular qualidade final baseada na empresa e corrupção
            let finalQuality = this.calculateFinalQuality(construction);
            
            // Buscar dados do estado para aplicar benefícios
            const stateData = await this.stateService.getCompleteStateData(construction.user_id);
            if (!stateData) {
                throw new Error('Estado não encontrado para aplicar benefícios');
            }

            // Aplicar impactos no PIB e população
            const constructionType = construction.construction_types;
            if (constructionType) {
                const gdpImpact = Number(constructionType.gdp_impact) || 0;
                const populationImpact = Number(constructionType.population_impact) || 0;

                // Ajustar impactos baseados na qualidade
                const qualityMultiplier = this.getQualityMultiplier(finalQuality);
                
                if (gdpImpact > 0 || populationImpact > 0) {
                    const adjustedGdpImpact = gdpImpact * qualityMultiplier;
                    const adjustedPopulationImpact = populationImpact * qualityMultiplier;

                    const newGdp = stateData.economy.gdp + adjustedGdpImpact;
                    const newPopulation = Math.round(stateData.economy.population + adjustedPopulationImpact);

                    await this.stateService.updateEconomy(construction.user_id, {
                        gdp: newGdp,
                        population: newPopulation
                    });

                    console.log(`📊 Benefícios aplicados: PIB +${adjustedGdpImpact}, População +${adjustedPopulationImpact}`);
                }
            }

            // Calcular custos e prazos reais
            const actualCost = this.calculateActualCost(construction, finalQuality);
            const actualDays = this.calculateActualDays(construction);

            // Marcar como concluída
            await supabase
                .from('active_constructions')
                .update({
                    status: CONSTRUCTION_CONSTANTS.STATUS.COMPLETED,
                    completed_at: new Date().toISOString(),
                    progress_percentage: 100,
                    final_quality: finalQuality,
                    actual_cost: actualCost,
                    actual_days: actualDays,
                    completion_narrative: await this.generateCompletionNarrative(construction, finalQuality)
                })
                .eq('id', construction.id);

            console.log(`✅ Construção ${construction.id} concluída com qualidade: ${finalQuality}`);

            return {
                construction_id: construction.id,
                final_quality: finalQuality,
                actual_cost: actualCost,
                actual_days: actualDays,
                benefits_applied: {
                    gdp_impact: constructionType?.gdp_impact || 0,
                    population_impact: constructionType?.population_impact || 0
                }
            };

        } catch (error) {
           console.error(`❌ Erro ao completar construção ${construction.id}:`, error);
           throw error;
       }
   }

   /**
    * Calcular qualidade final da construção
    * @param {Object} construction - Dados da construção
    * @returns {string} - Qualidade final
    */
   calculateFinalQuality(construction) {
       try {
           let qualityScore = 70; // Base: 70 pontos

           // Fatores que afetam a qualidade
           const progress = this.calculateConstructionProgress(construction);

           // Atraso penaliza qualidade
           if (progress.isDelayed) {
               qualityScore -= Math.min(20, progress.delayDays * 2);
           }

           // Corrupção afeta qualidade
           if (construction.has_corruption) {
               qualityScore -= 15;
           }

           // Experiência da empresa (baseada no nome/histórico)
           const companyExperience = this.getCompanyExperienceLevel(construction);
           switch (companyExperience) {
               case 'excelente':
                   qualityScore += 20;
                   break;
               case 'alto':
                   qualityScore += 10;
                   break;
               case 'médio':
                   qualityScore += 0;
                   break;
               case 'baixo':
                   qualityScore -= 10;
                   break;
           }

           // Aleatoriedade (fatores externos)
           qualityScore += (Math.random() * 20) - 10; // -10 a +10

           // Converter score para categoria
           if (qualityScore >= 90) return CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.EXCELLENT;
           if (qualityScore >= 75) return CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.GOOD;
           if (qualityScore >= 60) return CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.REGULAR;
           return CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.POOR;

       } catch (error) {
           console.error('❌ Erro ao calcular qualidade:', error);
           return CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.REGULAR;
       }
   }

   /**
    * Obter nível de experiência da empresa
    * @param {Object} construction - Dados da construção
    * @returns {string} - Nível de experiência
    */
   getCompanyExperienceLevel(construction) {
       if (!construction.selected_company_name) {
           return 'médio';
       }

       const companyName = construction.selected_company_name.toLowerCase();
       
       // Palavras que indicam experiência
       if (companyName.includes('engenharia') || companyName.includes('obras do estado')) {
           return 'excelente';
       }
       if (companyName.includes('alpha') || companyName.includes('gamma')) {
           return 'alto';
       }
       if (companyName.includes('beta') || companyName.includes('crescimento')) {
           return 'médio';
       }
       if (companyName.includes('rápidas') || companyName.includes('barata')) {
           return 'baixo';
       }

       return 'médio';
   }

   /**
    * Obter multiplicador de qualidade
    * @param {string} quality - Qualidade final
    * @returns {number} - Multiplicador
    */
   getQualityMultiplier(quality) {
       switch (quality) {
           case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.EXCELLENT:
               return 1.3;
           case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.GOOD:
               return 1.1;
           case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.REGULAR:
               return 0.9;
           case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.POOR:
               return 0.7;
           default:
               return 1.0;
       }
   }

   /**
    * Calcular custo real da obra
    * @param {Object} construction - Dados da construção
    * @param {string} finalQuality - Qualidade final
    * @returns {number} - Custo real
    */
   calculateActualCost(construction, finalQuality) {
       try {
           let actualCost = Number(construction.final_cost);

           // Obras de baixa qualidade podem ter custos extras para correções
           if (finalQuality === CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.POOR) {
               actualCost *= 1.15; // +15% para correções
           }

           // Corrupção pode inflar custos
           if (construction.has_corruption) {
               actualCost *= 1.05; // +5% por corrupção
           }

           return Math.round(actualCost * 100) / 100; // Arredondar para 2 casas decimais

       } catch (error) {
           console.error('❌ Erro ao calcular custo real:', error);
           return Number(construction.final_cost) || 0;
       }
   }

   /**
    * Calcular dias reais da obra
    * @param {Object} construction - Dados da construção
    * @returns {number} - Dias reais
    */
   calculateActualDays(construction) {
       try {
           if (!construction.started_at) {
               return Number(construction.estimated_days) || 30;
           }

           const startDate = new Date(construction.started_at);
           const completionDate = new Date();
           
           return Math.ceil((completionDate - startDate) / (1000 * 60 * 60 * 24));

       } catch (error) {
           console.error('❌ Erro ao calcular dias reais:', error);
           return Number(construction.estimated_days) || 30;
       }
   }

   /**
    * Gerar narrativa de conclusão
    * @param {Object} construction - Dados da construção
    * @param {string} finalQuality - Qualidade final
    * @returns {Promise<string>} - Narrativa gerada
    */
   async generateCompletionNarrative(construction, finalQuality) {
       try {
           // Tentar gerar com IA
           if (this.aiService) {
               const completionData = {
                   construction_name: construction.construction_types?.name || 'Obra pública',
                   state_name: construction.state_info?.state || 'Estado',
                   company_name: construction.selected_company_name || 'Empresa contratada',
                   total_cost: this.calculateActualCost(construction, finalQuality),
                   actual_days: this.calculateActualDays(construction),
                   planned_days: construction.estimated_days || 30,
                   had_corruption: construction.has_corruption || false,
                   corruption_discovered: construction.corruption_discovered || false,
                   final_quality: finalQuality
               };

               try {
                   const narrative = await this.aiService.generateCompletionNarrative(construction, completionData);
                   if (narrative && narrative.length > 10) {
                       return narrative;
                   }
               } catch (aiError) {
                   console.warn('❌ IA indisponível para narrativa, usando fallback:', aiError);
               }
           }

           // Fallback: narrativa simples
           return this.generateFallbackNarrative(construction, finalQuality);

       } catch (error) {
           console.error('❌ Erro ao gerar narrativa:', error);
           return this.generateFallbackNarrative(construction, finalQuality);
       }
   }

   /**
    * Gerar narrativa de fallback
    * @param {Object} construction - Dados da construção
    * @param {string} finalQuality - Qualidade final
    * @returns {string} - Narrativa básica
    */
   generateFallbackNarrative(construction, finalQuality) {
       const progress = this.calculateConstructionProgress(construction);
       const constructionName = construction.construction_types?.name || 'obra pública';
       const companyName = construction.selected_company_name || 'empresa contratada';
       
       let narrative = `A ${constructionName} foi concluída pela ${companyName}`;
       
       if (progress.isDelayed) {
           narrative += ` com ${progress.delayDays} dias de atraso`;
       } else {
           narrative += ' dentro do prazo previsto';
       }

       narrative += '. ';

       switch (finalQuality) {
           case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.EXCELLENT:
               narrative += 'A obra foi entregue com padrão de excelência, superando as expectativas da população.';
               break;
           case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.GOOD:
               narrative += 'A construção atende aos padrões técnicos esperados.';
               break;
           case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.REGULAR:
               narrative += 'A obra foi entregue com qualidade adequada.';
               break;
           case CONSTRUCTION_CONSTANTS.QUALITY_LEVELS.POOR:
               narrative += 'A qualidade final ficou abaixo do esperado, necessitando algumas correções.';
               break;
       }

       if (construction.corruption_discovered) {
           narrative += ' Investigações posteriores revelaram irregularidades no processo licitatório.';
       }

       return narrative;
   }

   /**
    * Obter estatísticas das construções do usuário
    * @param {string} userId - ID do usuário
    * @returns {Promise<Object>} - Estatísticas
    */
   async getConstructionStatistics(userId) {
       try {
           const { data: constructions, error } = await supabase
               .from('active_constructions')
               .select(`
                   *,
                   construction_types (category)
               `)
               .eq('user_id', userId);

           if (error) {
               throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
           }

           const stats = {
               total: constructions.length,
               by_status: {
                   bidding: 0,
                   in_progress: 0,
                   completed: 0,
                   cancelled: 0
               },
               by_category: {},
               by_quality: {
                   excellent: 0,
                   good: 0,
                   regular: 0,
                   poor: 0
               },
               total_cost: 0,
               avg_completion_days: 0,
               corruption_cases: 0
           };

           let totalDays = 0;
           let completedCount = 0;

           constructions.forEach(construction => {
               // Status
               stats.by_status[construction.status] = (stats.by_status[construction.status] || 0) + 1;

               // Categoria
               const category = construction.construction_types?.category || 'other';
               stats.by_category[category] = (stats.by_category[category] || 0) + 1;

               // Qualidade (apenas concluídas)
               if (construction.status === CONSTRUCTION_CONSTANTS.STATUS.COMPLETED && construction.final_quality) {
                   stats.by_quality[construction.final_quality] = (stats.by_quality[construction.final_quality] || 0) + 1;
               }

               // Custo total
               stats.total_cost += Number(construction.actual_cost || construction.final_cost || 0);

               // Dias para conclusão (apenas concluídas)
               if (construction.status === CONSTRUCTION_CONSTANTS.STATUS.COMPLETED && construction.actual_days) {
                   totalDays += Number(construction.actual_days);
                   completedCount++;
               }

               // Casos de corrupção
               if (construction.has_corruption) {
                   stats.corruption_cases++;
               }
           });

           // Média de dias de conclusão
           if (completedCount > 0) {
               stats.avg_completion_days = Math.round(totalDays / completedCount);
           }

           return stats;

       } catch (error) {
           console.error('❌ Erro ao obter estatísticas:', error);
           throw error;
       }
   }

   /**
    * Obter construções próximas do vencimento
    * @param {string} userId - ID do usuário
    * @param {number} daysAhead - Dias à frente para verificar (padrão: 7)
    * @returns {Promise<Array>} - Construções próximas do vencimento
    */
   async getUpcomingCompletions(userId, daysAhead = 7) {
       try {
           const { data: constructions, error } = await supabase
               .from('active_constructions')
               .select(`
                   *,
                   construction_types (name, category)
               `)
               .eq('user_id', userId)
               .eq('status', CONSTRUCTION_CONSTANTS.STATUS.IN_PROGRESS);

           if (error) {
               throw new Error(`Erro ao buscar construções em andamento: ${error.message}`);
           }

           const upcomingCompletions = [];
           const currentDate = new Date();
           const targetDate = new Date(currentDate.getTime() + (daysAhead * 24 * 60 * 60 * 1000));

           constructions.forEach(construction => {
               const completionDate = new Date(construction.estimated_completion);
               
               if (completionDate <= targetDate) {
                   const progress = this.calculateConstructionProgress(construction);
                   
                   upcomingCompletions.push({
                       ...construction,
                       progress: progress,
                       days_until_completion: Math.ceil((completionDate - currentDate) / (1000 * 60 * 60 * 24))
                   });
               }
           });

           // Ordenar por data de conclusão
           upcomingCompletions.sort((a, b) => 
               new Date(a.estimated_completion) - new Date(b.estimated_completion)
           );

           return upcomingCompletions;

       } catch (error) {
           console.error('❌ Erro ao buscar construções próximas do vencimento:', error);
           throw error;
       }
   }

   /**
    * Verificar e processar descoberta de corrupção
    * @param {Object} construction - Dados da construção
    * @returns {Promise<boolean>} - Se houve descoberta
    */
   async checkCorruptionDiscovery(construction) {
       try {
           if (!construction.has_corruption || construction.corruption_discovered) {
               return false;
           }

           // Chance de descoberta aumenta com o progresso
           const progress = this.calculateConstructionProgress(construction);
           const discoveryChance = CONSTRUCTION_CONSTANTS.CORRUPTION_DISCOVERY_CHANCE + (progress.percentage * 0.001);

           if (Math.random() < discoveryChance) {
               // Corrupção descoberta!
               await supabase
                   .from('active_constructions')
                   .update({
                       corruption_discovered: true,
                       corruption_discovered_at: new Date().toISOString()
                   })
                   .eq('id', construction.id);

               console.log(`🚨 Corrupção descoberta na construção ${construction.id}!`);
               
               // Aplicar penalidades se já houver estado
               try {
                   await this.applyCorruptionPenalties(construction);
               } catch (penaltyError) {
                   console.warn('⚠️ Erro ao aplicar penalidades de corrupção:', penaltyError);
               }

               return true;
           }

           return false;

       } catch (error) {
           console.error('❌ Erro ao verificar descoberta de corrupção:', error);
           return false;
       }
   }

   /**
    * Aplicar penalidades por corrupção descoberta
    * @param {Object} construction - Dados da construção
    * @returns {Promise<void>}
    */
   async applyCorruptionPenalties(construction) {
       try {
           console.log(`⚖️ Aplicando penalidades por corrupção na construção ${construction.id}...`);

           const stateData = await this.stateService.getCompleteStateData(construction.user_id);
           if (!stateData) {
               console.warn('⚠️ Estado não encontrado para aplicar penalidades');
               return;
           }

           // Penalidades:
           // 1. Redução na aprovação do governador (-5 a -10%)
           const approvalPenalty = 5 + Math.random() * 5;
           const newApprovalRating = Math.max(0, stateData.governance.approval_rating - approvalPenalty);

           // 2. Multa baseada no valor da corrupção
           const corruptionAmount = Number(construction.corruption_amount) || 0;
           const fine = corruptionAmount * 2; // Multa de 200% do valor desviado
           const newTreasuryBalance = Math.max(0, stateData.economy.treasury_balance - fine);

           // Aplicar penalidades
           await this.stateService.updateGovernance(construction.user_id, {
               approval_rating: newApprovalRating,
               corruption_index: Math.min(100, stateData.governance.corruption_index + 2)
           });

           await this.stateService.updateEconomy(construction.user_id, {
               treasury_balance: newTreasuryBalance
           });

           console.log(`✅ Penalidades aplicadas: -${approvalPenalty.toFixed(1)}% aprovação, -R$${fine} milhões`);

       } catch (error) {
           console.error('❌ Erro ao aplicar penalidades de corrupção:', error);
           throw error;
       }
   }
}

module.exports = ConstructionService;