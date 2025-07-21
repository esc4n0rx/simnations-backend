const GroqProvider = require('../../infrastructure/ai/groq-provider');
const { CONSTRUCTION_CONSTANTS } = require('../../shared/constants/construction-constants');

class ConstructionAIService {
    constructor() {
        this.groqProvider = new GroqProvider();
    }

    /**
     * Gerar empresas para licitação usando IA
     * @param {Object} constructionData - Dados da construção
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<Array>} - Array de empresas geradas
     */
    async generateBiddingCompanies(constructionData, stateData) {
        try {
            console.log('🤖 Gerando empresas para licitação via IA...');

            const numCompanies = this.getRandomBetween(
                CONSTRUCTION_CONSTANTS.MIN_COMPANIES_PER_BIDDING,
                CONSTRUCTION_CONSTANTS.MAX_COMPANIES_PER_BIDDING
            );

            // Preparar contexto para IA
            const context = {
                numCompanies,
                constructionName: constructionData.name,
                constructionType: constructionData.category,
                baseCost: constructionData.base_cost,
                specialization: constructionData.specialization_required,
                contextTags: constructionData.ai_context_tags?.join(', ') || '',
                stateName: stateData.state_info.state,
                gdp: stateData.economy.gdp,
                population: stateData.economy.population,
                corruptionIndex: stateData.governance?.corruption_index || 30,
                approvalRating: stateData.governance?.approval_rating || 50
            };

            // Substituir variáveis no prompt
            let prompt = CONSTRUCTION_CONSTANTS.AI_PROMPTS.GENERATE_COMPANIES;
            Object.keys(context).forEach(key => {
                prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), context[key]);
            });

            console.log('📋 Contexto preparado para IA:', context);

            // Enviar para IA
            const startTime = Date.now();
            const aiResponse = await this.groqProvider.generateCompletion(prompt);
            const responseTime = Date.now() - startTime;

            console.log(`⚡ IA respondeu em ${responseTime}ms`);

            // Parsear resposta da IA
            const companies = this.parseAICompaniesResponse(aiResponse, constructionData.base_cost);

            console.log(`✅ ${companies.length} empresas geradas com sucesso`);
            
            return {
                companies,
                context,
                prompt_used: prompt,
                response_time_ms: responseTime
            };

        } catch (error) {
            console.error('❌ Erro ao gerar empresas via IA:', error);
            
            // Fallback: gerar empresas básicas se IA falhar
            return this.generateFallbackCompanies(constructionData);
        }
    }

    /**
     * Gerar narrativa de conclusão da obra
     * @param {Object} constructionData - Dados da construção
     * @param {Object} completionData - Dados da conclusão
     * @returns {Promise<string>} - Narrativa gerada
     */
    async generateCompletionNarrative(constructionData, completionData) {
        try {
            console.log('📝 Gerando narrativa de conclusão via IA...');

            const context = {
                constructionName: constructionData.construction_name,
                stateName: completionData.state_name,
                companyName: completionData.company_name,
                finalCost: completionData.total_cost,
                actualDays: completionData.actual_days,
                plannedDays: completionData.planned_days,
                hadCorruption: completionData.had_corruption ? 'Sim' : 'Não',
                corruptionDiscovered: completionData.corruption_discovered ? 'Sim' : 'Não'
            };

            // Substituir variáveis no prompt
            let prompt = CONSTRUCTION_CONSTANTS.AI_PROMPTS.COMPLETION_NARRATIVE;
            Object.keys(context).forEach(key => {
                prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), context[key]);
            });

            const narrative = await this.groqProvider.generateCompletion(prompt);
            
            console.log('✅ Narrativa de conclusão gerada');
            return narrative;

        } catch (error) {
            console.error('❌ Erro ao gerar narrativa:', error);
            return this.generateFallbackNarrative(constructionData, completionData);
        }
    }

    /**
     * Parsear resposta da IA para empresas
     * @param {string} aiResponse - Resposta da IA
     * @param {number} baseCost - Custo base da obra
     * @returns {Array} - Array de empresas parseadas
     */
    parseAICompaniesResponse(aiResponse, baseCost) {
        try {
            // Tentar parsear JSON diretamente
            let companies = JSON.parse(aiResponse);
            
            // Se não for array, tentar extrair array da resposta
            if (!Array.isArray(companies)) {
                const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    companies = JSON.parse(jsonMatch[0]);
                }
            }

            // Validar e normalizar empresas
            return companies.map((company, index) => ({
                id: index + 1,
                name: company.name || `Empresa ${index + 1}`,
                proposed_price: this.validatePrice(company.proposed_price || company.preco_proposto, baseCost),
                estimated_days: company.estimated_days || company.prazo_estimado || 365,
                experience_level: company.experience_level || company.experiencia || 'média',
                company_history: company.company_history || company.historico || 'Empresa consolidada no mercado',
                corruption_offer: company.corruption_offer || company.incentivo_oculto || null,
                quality_risk: company.quality_risk || company.risco_qualidade || 'baixo',
                reliability_score: company.reliability_score || company.confiabilidade || 0.8
            }));

        } catch (error) {
            console.error('❌ Erro ao parsear resposta da IA:', error);
            throw new Error('Resposta da IA inválida');
        }
    }

    /**
     * Validar preço proposto
     * @param {any} price - Preço a validar
     * @param {number} baseCost - Custo base
     * @returns {number} - Preço válido
     */
    validatePrice(price, baseCost) {
        let numericPrice = parseFloat(price);
        
        if (isNaN(numericPrice)) {
            // Se veio como string com "R$" ou formatação
            numericPrice = parseFloat(price.toString().replace(/[R$\s.,]/g, ''));
        }
        
        if (isNaN(numericPrice) || numericPrice <= 0) {
            // Fallback: gerar preço aleatório baseado no custo base
            const variation = this.getRandomBetween(0.8, 1.3);
            numericPrice = baseCost * variation;
        }
        
        return Number(numericPrice.toFixed(2));
    }

    /**
     * Gerar empresas de fallback se IA falhar
     * @param {Object} constructionData - Dados da construção
     * @returns {Object} - Dados de fallback
     */
    generateFallbackCompanies(constructionData) {
        console.log('🔄 Gerando empresas de fallback...');
        
        const fallbackCompanies = [
            {
                id: 1,
                name: `Construtora ${constructionData.category.charAt(0).toUpperCase()}${constructionData.category.slice(1)} Ltda`,
                proposed_price: constructionData.base_cost * 0.95,
                estimated_days: constructionData.construction_days,
                experience_level: 'alta',
                company_history: 'Empresa com experiência no setor',
                corruption_offer: null,
                quality_risk: 'baixo',
                reliability_score: 0.85
            },
            {
                id: 2,
                name: `Engenharia e Obras do Estado`,
                proposed_price: constructionData.base_cost * 1.15,
                estimated_days: constructionData.construction_days * 0.9,
                experience_level: 'excelente',
                company_history: 'Empresa consolidada com várias obras públicas',
                corruption_offer: {
                    amount: constructionData.base_cost * 0.05,
                    description: 'Agilização do processo'
                },
                quality_risk: 'muito_baixo',
                reliability_score: 0.92
            },
            {
                id: 3,
                name: `Construções Rápidas S.A.`,
                proposed_price: constructionData.base_cost * 0.82,
                estimated_days: constructionData.construction_days * 1.2,
                experience_level: 'média',
                company_history: 'Empresa em crescimento no mercado',
                corruption_offer: null,
                quality_risk: 'médio',
                reliability_score: 0.70
            }
        ];

        return {
            companies: fallbackCompanies,
            context: { fallback: true },
            prompt_used: 'FALLBACK_MODE',
            response_time_ms: 0
        };
    }

    /**
     * Gerar narrativa de fallback
     * @param {Object} constructionData - Dados da construção
     * @param {Object} completionData - Dados da conclusão
     * @returns {string} - Narrativa básica
     */
    generateFallbackNarrative(constructionData, completionData) {
        const delay = completionData.actual_days > completionData.planned_days ? 'com atraso' : 'dentro do prazo';
        const cost = completionData.total_cost > constructionData.base_cost * 1.1 ? 'acima do orçamento' : 'dentro do orçamento';
        
        return `A obra de ${constructionData.construction_name} foi concluída ${delay} e ${cost}. ` +
               `A empresa ${completionData.company_name} executou os trabalhos em ${completionData.actual_days} dias. ` +
               `O investimento total foi de R$ ${completionData.total_cost} milhões, beneficiando diretamente a população local.`;
    }

    /**
     * Gerar número aleatório entre min e max
     * @param {number} min - Valor mínimo
     * @param {number} max - Valor máximo
     * @returns {number} - Número aleatório
     */
    getRandomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

module.exports = ConstructionAIService;