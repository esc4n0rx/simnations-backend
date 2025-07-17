const axios = require('axios');

class GroqProvider {
    constructor() {
        this.apiKey = process.env.GROQ_API_KEY;
        this.baseURL = 'https://api.groq.com/openai/v1';
        this.model = 'llama3-70b-8192';
        
        if (!this.apiKey) {
            console.warn('⚠️ GROQ_API_KEY não configurada');
        }
    }

    /**
     * Testar conexão com a API
     * @returns {Promise<boolean>} - Status da conexão
     */
    async testConnection() {
        try {
            if (!this.apiKey) {
                return false;
            }

            const response = await axios.get(`${this.baseURL}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            return response.status === 200;
        } catch (error) {
            console.error('❌ Erro ao testar conexão com Groq:', error.message);
            return false;
        }
    }

    /**
     * Gerar resposta da IA
     * @param {string} prompt - Prompt para a IA
     * @param {Object} options - Opções de configuração
     * @returns {Promise<string>} - Resposta da IA
     */
    async generateResponse(prompt, options = {}) {
        try {
            if (!this.apiKey) {
                throw new Error('GROQ_API_KEY não configurada');
            }

            console.log(`🤖 [Groq] Enviando prompt para IA...`);
            
            const requestData = {
                model: options.model || this.model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || options.maxTokens || 2048,
                top_p: options.topP || 0.9,
                stream: false
            };

            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: options.timeout || 30000
                }
            );

            if (!response.data?.choices?.[0]?.message?.content) {
                throw new Error('Resposta inválida da IA');
            }

            const aiResponse = response.data.choices[0].message.content.trim();
            console.log(`✅ [Groq] Resposta recebida (${aiResponse.length} caracteres)`);
            
            return aiResponse;

        } catch (error) {
            console.error('❌ [Groq] Erro na geração de resposta:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });

            if (error.response?.status === 429) {
                throw new Error('Limite de taxa excedido na API da Groq');
            } else if (error.response?.status === 401) {
                throw new Error('Chave de API da Groq inválida');
            } else if (error.code === 'ECONNABORTED') {
                throw new Error('Timeout na conexão com a API da Groq');
            }

            throw new Error(`Erro na API da Groq: ${error.message}`);
        }
    }

    /**
     * Gerar resposta estruturada (JSON) com schema específico
     * @param {string} prompt - Prompt para o modelo
     * @param {Object} schema - Schema esperado (não usado diretamente pela API Groq, mas para validação)
     * @param {Object} options - Opções específicas
     * @returns {Promise<Object>} - Objeto estruturado
     */
    async generateStructuredResponse(prompt, schema, options = {}) {
        try {
            console.log(`🤖 [Groq] Gerando resposta estruturada...`);
            
            // Adicionar instruções JSON ao prompt para forçar resposta estruturada
            const structuredPrompt = `${prompt}

IMPORTANTE: Responda APENAS com um JSON válido no formato especificado. Não inclua explicações adicionais ou texto fora do JSON.`;

            const response = await this.generateResponse(structuredPrompt, {
                ...options,
                temperature: options.temperature || 0.3 // Menor temperatura para JSON mais consistente
            });

            // Tentar extrair JSON da resposta
            let jsonStr = response;
            
            // Procurar JSON entre blocos de código
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1];
            } else {
                // Procurar JSON simples que comece com { e termine com }
                const simpleJsonMatch = response.match(/\{[\s\S]*\}/);
                if (simpleJsonMatch) {
                    jsonStr = simpleJsonMatch[0];
                }
            }

            try {
                const parsedResponse = JSON.parse(jsonStr);
                console.log(`✅ [Groq] Resposta estruturada parseada com sucesso`);
                return parsedResponse;
            } catch (parseError) {
                console.error('❌ [Groq] Erro ao parsear JSON:', {
                    response: response.substring(0, 500) + '...',
                    parseError: parseError.message
                });
                throw new Error('Resposta da IA não é um JSON válido');
            }

        } catch (error) {
            console.error('❌ [Groq] Erro na geração de resposta estruturada:', error);
            throw error;
        }
    }

    /**
     * Gerar resposta JSON estruturada (método legado)
     * @param {string} prompt - Prompt para a IA
     * @param {Object} options - Opções de configuração
     * @returns {Promise<Object>} - Resposta JSON parseada
     */
    async generateJSONResponse(prompt, options = {}) {
        try {
            const response = await this.generateResponse(prompt, {
                ...options,
                temperature: 0.3 // Menor temperatura para JSON mais consistente
            });

            // Tentar extrair JSON da resposta
            let jsonStr = response;
            
            // Procurar JSON entre blocos de código
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1];
            } else {
                // Procurar JSON simples
                const simpleJsonMatch = response.match(/\{[\s\S]*\}/);
                if (simpleJsonMatch) {
                    jsonStr = simpleJsonMatch[0];
                }
            }

            try {
                return JSON.parse(jsonStr);
            } catch (parseError) {
                console.error('❌ [Groq] Erro ao parsear JSON:', {
                    response: response.substring(0, 500),
                    parseError: parseError.message
                });
                throw new Error('Resposta da IA não é um JSON válido');
            }

        } catch (error) {
            console.error('❌ [Groq] Erro na geração de JSON:', error);
            throw error;
        }
    }

    /**
     * Verificar se o provedor está disponível
     * @returns {Promise<boolean>} - True se disponível
     */
    async isAvailable() {
        try {
            return await this.testConnection();
        } catch (error) {
            console.error('❌ [Groq] Provedor indisponível:', error);
            return false;
        }
    }

    /**
     * Obter informações do modelo
     * @returns {Object} - Informações do modelo
     */
    getModelInfo() {
        return {
            provider: 'Groq',
            model: this.model,
            maxTokens: 8192,
            supportsJSON: true,
            apiConfigured: !!this.apiKey
        };
    }
}

module.exports = GroqProvider;