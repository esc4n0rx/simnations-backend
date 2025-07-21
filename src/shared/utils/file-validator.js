const fs = require('fs').promises;
const path = require('path');

class FileValidator {
    /**
     * Validar e carregar arquivo JSON de estados
     * @param {string} filePath - Caminho para o arquivo
     * @returns {Promise<Object>} - Dados validados
     */
    static async validateAndLoadStatesFile(filePath) {
        try {
            // Verificar se arquivo existe
            await fs.access(filePath);
            
            // Ler arquivo em chunks para arquivos grandes
            const fileStats = await fs.stat(filePath);
            console.log(`📁 Carregando arquivo de ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
            
            // Ler conteúdo completo
            const fileContent = await fs.readFile(filePath, 'utf8');
            
            // Validar se é um JSON válido
            const data = JSON.parse(fileContent);
            
            // Validar estrutura do JSON
            this.validateStatesDataStructure(data);
            
            // Contar países e estados
            const stats = this.getDataStatistics(data);
            console.log(`✅ Dados carregados: ${stats.countries} países, ${stats.totalStates} estados`);
            
            return data;
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Arquivo de estados não encontrado: ${filePath}`);
            } else if (error instanceof SyntaxError) {
                throw new Error(`Arquivo JSON inválido: ${error.message}`);
            } else {
                throw new Error(`Erro ao carregar dados dos estados: ${error.message}`);
            }
        }
    }

    /**
     * Validar estrutura dos dados de estados
     * @param {Object} data - Dados para validar
     */
    static validateStatesDataStructure(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Dados dos estados devem ser um objeto');
        }

        // Verificar se tem pelo menos um país
        const countries = Object.keys(data);
        if (countries.length === 0) {
            throw new Error('Nenhum país encontrado nos dados');
        }

        // Verificar estrutura de cada país
        for (const country of countries) {
            const states = data[country];
            if (!states || typeof states !== 'object') {
                throw new Error(`Estrutura inválida para país: ${country}`);
            }

            // Verificar se tem pelo menos um estado
            const stateNames = Object.keys(states);
            if (stateNames.length === 0) {
                console.warn(`⚠️ País sem estados: ${country}`);
                continue;
            }

            // Verificar estrutura de cada estado (amostragem)
            const firstState = states[stateNames[0]];
            const requiredFields = ['racionalidade', 'conservadorismo', 'audacia', 'autoridade', 'coletivismo'];
            
            for (const field of requiredFields) {
                if (typeof firstState[field] !== 'number') {
                    throw new Error(`Campo obrigatório ausente ou inválido: ${field} em ${country}.${stateNames[0]}`);
                }
            }
        }
    }

    /**
     * Obter estatísticas dos dados
     * @param {Object} data - Dados dos estados
     * @returns {Object} - Estatísticas
     */
    static getDataStatistics(data) {
        const countries = Object.keys(data);
        let totalStates = 0;
        let countryStats = {};

        for (const country of countries) {
            const stateCount = Object.keys(data[country]).length;
            totalStates += stateCount;
            countryStats[country] = stateCount;
        }

        return {
            countries: countries.length,
            totalStates,
            countryStats,
            countriesList: countries.slice(0, 5) // Primeiros 5 países para debug
        };
    }
}

module.exports = FileValidator;