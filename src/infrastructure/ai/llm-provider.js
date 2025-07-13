/**
 * Interface abstrata para provedores de LLM
 * Permite fácil troca entre Groq, OpenAI, Gemini, etc.
 */
class LLMProvider {
    /**
     * Gerar resposta do LLM
     * @param {string} prompt - Prompt para o modelo
     * @param {Object} options - Opções específicas
     * @returns {Promise<string>} - Resposta gerada
     */
    async generateResponse(prompt, options = {}) {
        throw new Error('generateResponse deve ser implementado pela classe filha');
    }

    /**
     * Gerar resposta estruturada (JSON)
     * @param {string} prompt - Prompt para o modelo
     * @param {Object} schema - Schema esperado
     * @param {Object} options - Opções específicas
     * @returns {Promise<Object>} - Objeto estruturado
     */
    async generateStructuredResponse(prompt, schema, options = {}) {
        throw new Error('generateStructuredResponse deve ser implementado pela classe filha');
    }

    /**
     * Verificar se o provedor está disponível
     * @returns {Promise<boolean>} - True se disponível
     */
    async isAvailable() {
        throw new Error('isAvailable deve ser implementado pela classe filha');
    }

    /**
     * Obter informações do modelo
     * @returns {Object} - Informações do modelo
     */
    getModelInfo() {
        throw new Error('getModelInfo deve ser implementado pela classe filha');
    }
}

module.exports = LLMProvider;