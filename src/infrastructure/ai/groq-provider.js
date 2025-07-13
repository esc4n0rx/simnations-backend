const Groq = require('groq-sdk');
const LLMProvider = require('./llm-provider');
const { LLM_SETTINGS } = require('../../shared/constants/political-event-constants');

class GroqProvider extends LLMProvider {
    constructor() {
        super();
        this.client = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
        this.model = process.env.GROQ_MODEL || LLM_SETTINGS.DEFAULT_MODEL;
    }

    /**
     * Gerar resposta do LLM
     * @param {string} prompt - Prompt para o modelo
     * @param {Object} options - Opções específicas
     * @returns {Promise<string>} - Resposta gerada
     */
    async generateResponse(prompt, options = {}) {
        try {
            const response = await this.client.chat.completions.create({
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: this.model,
                max_tokens: options.max_tokens || LLM_SETTINGS.MAX_TOKENS,
                temperature: options.temperature || LLM_SETTINGS.TEMPERATURE,
                top_p: options.top_p || LLM_SETTINGS.TOP_P,
                stream: false
            });

            return response.choices[0]?.message?.content || '';
        } catch (error) {
            console.error('❌ Erro no Groq Provider:', error);
            throw new Error(`Falha na geração de resposta: ${error.message}`);
        }
    }

    /**
     * Gerar resposta estruturada (JSON)
     * @param {string} prompt - Prompt para o modelo
     * @param {Object} schema - Schema esperado (não usado no Groq, apenas validação)
     * @param {Object} options - Opções específicas
     * @returns {Promise<Object>} - Objeto estruturado
     */
    async generateStructuredResponse(prompt, schema, options = {}) {
        try {
            // Adicionar instruções para JSON no prompt
            const jsonPrompt = `${prompt}

IMPORTANTE: Responda APENAS com um JSON válido seguindo exatamente este formato:
${JSON.stringify(schema, null, 2)}

Não inclua explicações, comentários ou texto adicional. Apenas o JSON.`;

            const response = await this.generateResponse(jsonPrompt, options);
            
            // Tentar extrair JSON da resposta
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Resposta não contém JSON válido');
            }

            const parsedResponse = JSON.parse(jsonMatch[0]);
            
            // Validação básica do schema (opcional)
            this.validateResponseSchema(parsedResponse, schema);
            
            return parsedResponse;
        } catch (error) {
            console.error('❌ Erro na resposta estruturada:', error);
            throw new Error(`Falha na geração de resposta estruturada: ${error.message}`);
        }
    }

    /**
     * Validação básica do schema de resposta
     * @param {Object} response - Resposta recebida
     * @param {Object} schema - Schema esperado
     */
    validateResponseSchema(response, schema) {
        const requiredKeys = Object.keys(schema);
        const responseKeys = Object.keys(response);
        
        for (const key of requiredKeys) {
            if (!responseKeys.includes(key)) {
                console.warn(`⚠️ Campo obrigatório ausente: ${key}`);
            }
        }
    }

    /**
     * Verificar se o provedor está disponível
     * @returns {Promise<boolean>} - True se disponível
     */
    async isAvailable() {
        try {
            if (!process.env.GROQ_API_KEY) {
                return false;
            }

            // Teste simples de conectividade
            await this.generateResponse('Test', { max_tokens: 10 });
            return true;
        } catch (error) {
            console.error('❌ Groq Provider indisponível:', error.message);
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
            max_tokens: LLM_SETTINGS.MAX_TOKENS,
            supports_json: true,
            supports_streaming: false // Para esta implementação
        };
    }
}

module.exports = GroqProvider;