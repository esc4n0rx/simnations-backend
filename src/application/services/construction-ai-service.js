const GroqProvider = require('../../infrastructure/ai/groq-provider');
const CONSTRUCTION_CONSTANTS = require('../../shared/constants/construction-constants');

class ConstructionAIService {
    constructor() {
        this.groqProvider = new GroqProvider();
    }

    /**
     * Gerar empresas para licitação usando IA
     * @param {Object} constructionData - Dados da construção
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<Object>} - Resultado com empresas geradas
     */
    async generateBiddingCompanies(constructionData, stateData) {
        try {
            console.log('🤖 Gerando empresas para licitação via IA...');

            // CORREÇÃO: Usar CONSTRUCTION_CONSTANTS diretamente (não CONSTRUCTION_CONSTANTS.CONSTRUCTION_CONSTANTS)
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

            // CORREÇÃO: Usar generateResponse ao invés de generateCompletion
            const startTime = Date.now();
            const aiResponse = await this.groqProvider.generateResponse(prompt, {
                temperature: 0.7,
                max_tokens: 2048
            });
            const responseTime = Date.now() - startTime;

            console.log(`⚡ IA respondeu em ${responseTime}ms`);

            // Parsear resposta da IA
            const companies = this.parseAICompaniesResponse(aiResponse, constructionData.base_cost);

            console.log(`✅ ${companies.length} empresas geradas com sucesso`);
            
            return {
                companies,
                context: context,
                prompt_used: prompt,
                response_time_ms: responseTime
            };

        } catch (error) {
            console.error('❌ Erro ao gerar empresas via IA:', error);
            throw error;
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
            console.log('📖 Gerando narrativa de conclusão...');

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

            // CORREÇÃO: Usar generateResponse ao invés de generateCompletion
            const narrative = await this.groqProvider.generateResponse(prompt, {
                temperature: 0.8,
                max_tokens: 1024
            });
            
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
            console.log('🔍 Parseando resposta da IA...');
            console.log('📄 Resposta recebida:', aiResponse.substring(0, 500) + '...');

            let companies;
            
            // Tentar parsear JSON diretamente
            try {
                companies = JSON.parse(aiResponse);
            } catch (directParseError) {
                console.log('⚠️ Parse direto falhou, tentando extrair JSON...');
                
                // Tentar extrair JSON entre blocos de código
                const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    companies = JSON.parse(jsonMatch[1]);
                } else {
                    // Tentar encontrar JSON simples
                    const simpleJsonMatch = aiResponse.match(/\[[\s\S]*\]/);
                    if (simpleJsonMatch) {
                        companies = JSON.parse(simpleJsonMatch[0]);
                    } else {
                        throw new Error('Não foi possível extrair JSON da resposta');
                    }
                }
            }
            
            // Se não for array, tentar extrair array da resposta
            if (!Array.isArray(companies)) {
                if (companies.companies && Array.isArray(companies.companies)) {
                    companies = companies.companies;
                } else if (companies.empresas && Array.isArray(companies.empresas)) {
                    companies = companies.empresas;
                } else {
                    throw new Error('Resposta não contém array de empresas');
                }
            }

            // Validar e normalizar empresas
            const normalizedCompanies = companies.map((company, index) => {
                console.log(`🏢 Processando empresa ${index + 1}:`, company.name || company.nome);
                
                return {
                    id: index + 1,
                    name: company.name || company.nome || `Empresa ${index + 1}`,
                    proposed_price: this.validatePrice(
                        company.proposed_price || 
                        company.preco_proposto || 
                        company.proposta_preco || 
                        company.valor_proposto, 
                        baseCost
                    ),
                    estimated_days: Math.max(1, 
                        company.estimated_days || 
                        company.prazo_estimado || 
                        company.dias_estimados || 
                        30
                    ),
                    experience_level: company.experience_level || 
                                    company.experiencia || 
                                    company.nivel_experiencia || 
                                    'média',
                    company_history: company.company_history || 
                                   company.historico || 
                                   company.historico_empresa || 
                                   'Empresa consolidada no mercado',
                    corruption_offer: this.parseCorruptionOffer(
                        company.corruption_offer || 
                        company.incentivo_oculto || 
                        company.propina || 
                        company.oferta_corrupcao
                    ),
                    quality_risk: company.quality_risk || 
                                company.risco_qualidade || 
                                'baixo',
                    reliability_score: this.validateReliabilityScore(
                        company.reliability_score || 
                        company.confiabilidade || 
                        company.score_confiabilidade
                    )
                };
            });

            console.log(`✅ ${normalizedCompanies.length} empresas parseadas com sucesso`);
            return normalizedCompanies;

        } catch (error) {
            console.error('❌ Erro ao parsear resposta da IA:', error);
            console.log('📄 Resposta problemática:', aiResponse);
            throw new Error(`Resposta da IA inválida: ${error.message}`);
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
        // CORREÇÃO: Limpar melhor texto explicativo da IA
        let cleanPrice = price.toString();
        
        // Remover textos explicativos entre parênteses
        cleanPrice = cleanPrice.replace(/\s*\([^)]*\)/g, '');
        
        // Remover caracteres não numéricos exceto ponto e vírgula
        cleanPrice = cleanPrice.replace(/[^\d.,]/g, '');
        
        // Converter vírgulas em pontos para números decimais
        cleanPrice = cleanPrice.replace(',', '.');
        
        numericPrice = parseFloat(cleanPrice);
        
        // Se ainda não conseguiu parsear, usar uma variação do custo base
        if (isNaN(numericPrice)) {
            console.warn(`⚠️ Não foi possível parsear preço: "${price}", usando custo base com variação`);
            const variation = (Math.random() - 0.5) * 0.4; // -20% a +20%
            numericPrice = baseCost * (1 + variation);
        }
    }
    
        // Garantir que o preço não seja menor que 10% do custo base nem maior que 200%
        const minPrice = baseCost * 0.1;
        const maxPrice = baseCost * 2.0;
        
        return Math.max(minPrice, Math.min(maxPrice, numericPrice));
    }

        /**
         * Parsear oferta de corrupção
         * @param {any} corruptionOffer - Oferta de corrupção
         * @returns {number} - Valor numérico da propina
         */
        parseCorruptionOffer(corruptionOffer) {
            if (!corruptionOffer || corruptionOffer === 0 || corruptionOffer === '0') {
                return 0;
            }
            
            // Se for string, tentar extrair número
            if (typeof corruptionOffer === 'string') {
                // Remover textos explicativos
                let cleanOffer = corruptionOffer.replace(/\s*\([^)]*\)/g, '');
                cleanOffer = cleanOffer.replace(/[^\d.,]/g, '');
                cleanOffer = cleanOffer.replace(',', '.');
                
                const numericOffer = parseFloat(cleanOffer);
                return isNaN(numericOffer) ? 0 : numericOffer;
            }
            
            return parseFloat(corruptionOffer) || 0;
        }

    /**
     * Validar score de confiabilidade
     * @param {any} score - Score a validar
     * @returns {number} - Score válido (0-1)
     */
    validateReliabilityScore(score) {
        const numericScore = parseFloat(score);
        
        if (isNaN(numericScore)) {
            return 0.8; // Valor padrão
        }
        
        // Garantir que está entre 0 e 1
        return Math.max(0, Math.min(1, numericScore));
    }

    /**
     * Gerar empresas de fallback se IA falhar
     * @param {Object} constructionData - Dados da construção
     * @returns {Object} - Dados de fallback
     */
    generateFallbackCompanies(constructionData) {
        console.log('🔄 Gerando empresas de fallback...');
        
        const baseCost = Number(constructionData.base_cost) || 10;
        const constructionDays = Number(constructionData.construction_days) || 30;
        
        const fallbackCompanies = [
            {
                id: 1,
                name: `Construtora ${constructionData.category.charAt(0).toUpperCase()}${constructionData.category.slice(1)} Ltda`,
                proposed_price: baseCost * 0.95,
                estimated_days: constructionDays + 5,
                experience_level: 'alta',
                company_history: 'Empresa com experiência no setor',
                corruption_offer: 0,
                quality_risk: 'baixo',
                reliability_score: 0.85
            },
            {
                id: 2,
                name: `Engenharia e Obras do Estado`,
                proposed_price: baseCost * 1.15,
                estimated_days: Math.round(constructionDays * 0.9),
                experience_level: 'excelente',
                company_history: 'Empresa consolidada com várias obras públicas',
                corruption_offer: baseCost * 0.05,
                quality_risk: 'muito_baixo',
                reliability_score: 0.92
            },
            {
                id: 3,
                name: `Construções Rápidas S.A.`,
                proposed_price: baseCost * 0.82,
                estimated_days: Math.round(constructionDays * 1.2),
                experience_level: 'média',
                company_history: 'Empresa em crescimento no mercado',
                corruption_offer: 0,
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