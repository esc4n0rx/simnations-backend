// CORREÇÃO: Caminho correto para as constantes
const CONSTRUCTION_CONSTANTS = require('../../shared/constants/construction-constants');

class ConstructionAIService {
    constructor(aiProvider) {
        this.groqProvider = aiProvider;
    }

    /**
     * Gerar empresas para licitação usando IA
     * @param {Object} constructionData - Dados da construção
     * @param {Object} stateData - Dados do estado
     * @returns {Promise<Object>} - Resultado com empresas e contexto
     */
    async generateBiddingCompanies(constructionData, stateData) {
        const startTime = Date.now();
        
        try {
            console.log('🤖 Gerando empresas para licitação via IA...');

            // Preparar contexto para a IA
            const context = this.prepareBiddingContext(constructionData, stateData);
            console.log('📋 Contexto preparado para IA:', context);

            // Montar prompt com instruções claras para JSON
            const prompt = this.buildBiddingPrompt(context);
            
            console.log('🤖 [Groq] Enviando prompt para IA...');
            
            // Usar o método de resposta estruturada para garantir JSON limpo
            const aiResponse = await this.groqProvider.generateResponse(prompt, {
                temperature: 0.7,
                max_tokens: 2048
            });
            
            const responseTime = Date.now() - startTime;
            console.log(`⚡ IA respondeu em ${responseTime}ms`);

            // Parse da resposta com tratamento robusto
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
     * Preparar contexto para geração de empresas
     * @param {Object} constructionData - Dados da construção
     * @param {Object} stateData - Dados do estado
     * @returns {Object} - Contexto preparado
     */
    prepareBiddingContext(constructionData, stateData) {
        // CORREÇÃO: Verificar se TYPES existe antes de acessar
        const constructionConfig = CONSTRUCTION_CONSTANTS.TYPES?.[constructionData.category] || {
            specialization: 'construção civil geral',
            context_tags: 'infraestrutura pública'
        };
        
        // CORREÇÃO: Mapear corretamente os dados de acordo com a estrutura real
        return {
            numCompanies: 5,
            constructionName: constructionData.name || constructionData.construction_name || 'Obra Pública',
            constructionType: constructionData.category,
            baseCost: constructionData.base_cost,
            specialization: constructionData.specialization_required || constructionConfig.specialization,
            contextTags: constructionData.ai_context_tags?.join?.(', ') || constructionConfig.context_tags,
            // CORREÇÃO: Acessar dados aninhados corretamente
            stateName: stateData.state_info?.state || stateData.name || 'Estado',
            gdp: stateData.economy?.gdp || stateData.gdp || 1000,
            population: stateData.economy?.population || stateData.population || 1000000,
            corruptionIndex: stateData.governance?.corruption_index || stateData.corruption_index || 30,
            approvalRating: stateData.governance?.approval_rating || stateData.approval_rating || 50
        };
    }

    /**
     * Construir prompt para geração de empresas
     * @param {Object} context - Contexto da licitação
     * @returns {string} - Prompt formatado
     */
    buildBiddingPrompt(context) {
        // CORREÇÃO: Garantir que todos os valores existem antes de usar toLocaleString()
        const safePopulation = (context.population || 1000000).toString();
        const safeGdp = (context.gdp || 1000).toString();
        const safeCorruptionIndex = context.corruptionIndex || 30;
        const safeApprovalRating = context.approvalRating || 50;
        
        return `Gere exatamente ${context.numCompanies} empresas fictícias para licitação de "${context.constructionName}" (${context.constructionType}) no estado de ${context.stateName}.

CONTEXTO:
- Custo base: R$ ${context.baseCost} milhões
- Especialização: ${context.specialization}
- População: ${safePopulation}
- PIB: R$ ${safeGdp}
- Índice de corrupção: ${safeCorruptionIndex}%
- Aprovação: ${safeApprovalRating}%

INSTRUÇÕES CRÍTICAS:
1. Responda APENAS com JSON válido, sem comentários
2. Não inclua "//" ou qualquer tipo de comentário no JSON
3. Use apenas aspas duplas, nunca aspas simples
4. Não adicione texto explicativo fora do JSON

FORMATO EXATO (JSON válido):
[
  {
    "nome": "Nome da Empresa Ltda.",
    "proposta_de_preco": 7.5,
    "prazo_estimado": 180,
    "nivel_de_experiencia": 8,
    "historico_resumido": "Descrição da experiência da empresa",
    "incentivo_oculto": 0
  }
]

REGRAS:
- proposta_de_preco: valor em milhões (ex: 7.5 para R$ 7,5 milhões)
- prazo_estimado: dias para conclusão (120-365)
- nivel_de_experiencia: número de 1-10
- incentivo_oculto: valor da propina em milhares (ex: 150 para R$ 150.000) ou 0
- Baseado no índice de corrupção ${safeCorruptionIndex}%, aproximadamente ${Math.round(safeCorruptionIndex / 100 * context.numCompanies)} empresas devem oferecer propina
- Varie preços entre 80% e 130% do valor base
- Empresas com maior experiência tendem a cobrar mais
- Empresas que oferecem propina podem ter preços mais altos

Responda APENAS com o array JSON válido:`;
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
            let cleanedResponse = aiResponse.trim();
            
            try {
                // ETAPA 1: Tentar parse direto (caso a IA retorne JSON limpo)
                companies = JSON.parse(cleanedResponse);
                console.log('✅ Parse direto bem-sucedido');
            } catch (directParseError) {
                console.log('⚠️ Parse direto falhou, iniciando limpeza...');
                
                // ETAPA 2: Extrair JSON de blocos de código
                let jsonMatch = cleanedResponse.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    cleanedResponse = jsonMatch[1].trim();
                    console.log('🧹 JSON extraído de bloco de código');
                } else {
                    // ETAPA 3: Procurar array JSON simples
                    jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        cleanedResponse = jsonMatch[0];
                        console.log('🧹 Array JSON extraído');
                    }
                }

                // ETAPA 4: Limpar comentários JavaScript
                cleanedResponse = this.removeJavaScriptComments(cleanedResponse);
                console.log('🧹 Comentários removidos');

                // ETAPA 5: Tentar parse final
                try {
                    companies = JSON.parse(cleanedResponse);
                    console.log('✅ Parse após limpeza bem-sucedido');
                } catch (finalParseError) {
                    console.error('❌ Erro no parse final:', finalParseError.message);
                    console.log('📄 Resposta problemática:', cleanedResponse.substring(0, 300) + '...');
                    throw new Error(`Resposta da IA inválida: ${finalParseError.message}`);
                }
            }
            
            // ETAPA 6: Validar estrutura
            if (!Array.isArray(companies)) {
                // Tentar extrair array de propriedades conhecidas
                if (companies.companies && Array.isArray(companies.companies)) {
                    companies = companies.companies;
                } else if (companies.empresas && Array.isArray(companies.empresas)) {
                    companies = companies.empresas;
                } else {
                    throw new Error('Resposta não contém array de empresas válido');
                }
            }

            if (companies.length === 0) {
                throw new Error('Nenhuma empresa foi gerada');
            }

            // ETAPA 7: Normalizar e validar cada empresa
            const normalizedCompanies = companies.map((company, index) => {
                try {
                    return this.normalizeCompany(company, index, baseCost);
                } catch (normalizeError) {
                    console.warn(`⚠️ Erro ao normalizar empresa ${index + 1}:`, normalizeError.message);
                    return this.createFallbackCompany(index, baseCost);
                }
            });

            console.log(`✅ ${normalizedCompanies.length} empresas parseadas e normalizadas`);
            return normalizedCompanies;

        } catch (error) {
            console.error('❌ Erro crítico no parsing:', error);
            throw new Error(`Resposta da IA inválida: ${error.message}`);
        }
    }

    /**
     * Remover comentários JavaScript do JSON
     * @param {string} jsonString - String JSON com possíveis comentários
     * @returns {string} - String JSON limpa
     */
    removeJavaScriptComments(jsonString) {
        // Remove comentários de linha única // até o final da linha
        let cleaned = jsonString.replace(/\/\/.*$/gm, '');
        
        // Remove comentários de múltiplas linhas /* ... */
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Remove vírgulas órfãs que podem ter sobrado
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
        
        // Remove múltiplos espaços e quebras de linha
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
    }

    /**
     * Normalizar dados de uma empresa
     * @param {Object} company - Dados brutos da empresa
     * @param {number} index - Índice da empresa
     * @param {number} baseCost - Custo base
     * @returns {Object} - Empresa normalizada
     */
    normalizeCompany(company, index, baseCost) {
        return {
            id: index + 1,
            name: this.extractCompanyName(company, index),
            proposed_price: this.validatePrice(company, baseCost),
            estimated_days: this.validateDays(company),
            experience_level: this.extractExperienceLevel(company),
            company_history: this.extractHistory(company),
            corruption_offer: this.parseCorruptionOffer(company),
            quality_risk: company.quality_risk || company.risco_qualidade || 'baixo'
        };
    }

    /**
     * Extrair nome da empresa
     */
    extractCompanyName(company, index) {
        return company.name || 
               company.nome || 
               company.empresa || 
               `Empresa ${index + 1} Ltda.`;
    }

    /**
     * Validar e normalizar preço proposto
     */
    validatePrice(company, baseCost) {
        const rawPrice = company.proposed_price || 
                        company.preco_proposto || 
                        company.proposta_preco || 
                        company.proposta_de_preco ||
                        company.valor_proposto;
        
        let price = parseFloat(rawPrice);
        
        // Se o preço não for válido, gerar um baseado no custo base
        if (isNaN(price) || price <= 0) {
            // Varia entre 80% e 130% do custo base
            const variation = 0.8 + (Math.random() * 0.5);
            price = baseCost * variation;
        }
        
        // Garantir que o preço está em uma faixa razoável
        const minPrice = baseCost * 0.6;  // Mínimo 60% do custo base
        const maxPrice = baseCost * 1.5;  // Máximo 150% do custo base
        
        return Math.max(minPrice, Math.min(maxPrice, price));
    }

    /**
     * Validar dias estimados
     */
    validateDays(company) {
        const rawDays = company.estimated_days || 
                       company.prazo_estimado || 
                       company.dias_estimados ||
                       company.prazo;
        
        let days = parseInt(rawDays);
        
        if (isNaN(days) || days <= 0) {
            // Padrão entre 120 e 365 dias
            days = 120 + Math.floor(Math.random() * 245);
        }
        
        return Math.max(30, Math.min(730, days)); // Entre 30 dias e 2 anos
    }

    /**
     * Extrair nível de experiência
     */
    extractExperienceLevel(company) {
        const rawExp = company.experience_level || 
                      company.experiencia || 
                      company.nivel_experiencia ||
                      company.nivel_de_experiencia;
        
        if (typeof rawExp === 'string') {
            // Converter descrições para números
            const expMap = {
                'baixa': 3, 'baixo': 3,
                'média': 6, 'medio': 6,
                'alta': 8, 'alto': 8,
                'excelente': 9
            };
            return expMap[rawExp.toLowerCase()] || 5;
        }
        
        const exp = parseInt(rawExp);
        return isNaN(exp) ? 5 : Math.max(1, Math.min(10, exp));
    }

    /**
     * Extrair histórico da empresa
     */
    extractHistory(company) {
        return company.company_history || 
               company.historico || 
               company.historico_empresa ||
               company.historico_resumido ||
               'Empresa consolidada no mercado com experiência em obras públicas.';
    }

    /**
     * Parsear oferta de corrupção
     */
    parseCorruptionOffer(company) {
        const rawOffer = company.corruption_offer || 
                        company.incentivo_oculto || 
                        company.propina || 
                        company.oferta_corrupcao;
        
        if (rawOffer === null || rawOffer === undefined || rawOffer === 0) {
            return 0;
        }
        
        const offer = parseFloat(rawOffer);
        return isNaN(offer) ? 0 : Math.max(0, offer);
    }

    /**
     * Criar empresa de fallback em caso de erro
     */
    createFallbackCompany(index, baseCost) {
        const variation = 0.8 + (Math.random() * 0.4); // 80% a 120%
        const hasCorruption = Math.random() < 0.3; // 30% de chance
        
        return {
            id: index + 1,
            name: `Construtora ${index + 1} Ltda.`,
            proposed_price: baseCost * variation,
            estimated_days: 180 + Math.floor(Math.random() * 120), // 180-300 dias
            experience_level: 5 + Math.floor(Math.random() * 4), // 5-8
            company_history: 'Empresa com experiência em construção civil e obras públicas.',
            corruption_offer: hasCorruption ? 50 + Math.floor(Math.random() * 200) : 0, // 0 ou 50-250k
            quality_risk: 'médio'
        };
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
     * Gerar narrativa de fallback
     */
    generateFallbackNarrative(constructionData, completionData) {
        const delay = completionData.actual_days > completionData.planned_days;
        const corruption = completionData.had_corruption;
        
        let narrative = `A construção da ${constructionData.construction_name} foi concluída `;
        
        if (delay) {
            const extraDays = completionData.actual_days - completionData.planned_days;
            narrative += `com atraso de ${extraDays} dias, `;
        } else {
            narrative += 'dentro do prazo previsto, ';
        }
        
        narrative += `sendo executada pela ${completionData.company_name}. `;
        
        if (corruption && completionData.corruption_discovered) {
            narrative += 'Durante a execução, foram descobertos indícios de irregularidades que impactaram o cronograma da obra. ';
        }
        
        narrative += `O investimento total foi de R$ ${completionData.total_cost} milhões, representando um importante avanço para a infraestrutura local.`;
        
        return narrative;
    }
}

module.exports = ConstructionAIService;