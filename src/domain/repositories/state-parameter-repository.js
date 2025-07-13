const { supabase } = require('../../infrastructure/database/supabase-client');
const { StateParameter, EconomicUpdateLog } = require('../entities/state-parameter');

class StateParameterRepository {
    /**
     * Buscar parâmetros por usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<StateParameter|null>} - Parâmetros encontrados ou null
     */
    async findByUserId(userId) {
        const { data, error } = await supabase
            .from('state_parameters')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar parâmetros: ${error.message}`);
        }

        return new StateParameter(data);
    }

    /**
     * Buscar parâmetros por state_id
     * @param {string} stateId - ID do estado
     * @returns {Promise<StateParameter|null>} - Parâmetros encontrados ou null
     */
    async findByStateId(stateId) {
        const { data, error } = await supabase
            .from('state_parameters')
            .select('*')
            .eq('state_id', stateId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar parâmetros: ${error.message}`);
        }

        return new StateParameter(data);
    }

    /**
     * Buscar todos os parâmetros ativos
     * @returns {Promise<Array<StateParameter>>} - Lista de parâmetros
     */
    async findAllActive() {
        const { data, error } = await supabase
            .from('state_parameters')
            .select(`
                *,
                user_states!state_id (
                    id,
                    is_active
                )
            `)
            .eq('user_states.is_active', true);

        if (error) {
            throw new Error(`Erro ao buscar parâmetros ativos: ${error.message}`);
        }

        return data.map(param => new StateParameter(param));
    }

    /**
     * Criar parâmetros padrão para um estado
     * @param {Object} parameterData - Dados dos parâmetros
     * @returns {Promise<StateParameter>} - Parâmetros criados
     */
    async create(parameterData) {
        const { data, error } = await supabase
            .from('state_parameters')
            .insert([parameterData])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar parâmetros: ${error.message}`);
        }

        return new StateParameter(data);
    }

    /**
     * Atualizar parâmetros
     * @param {string} id - ID dos parâmetros
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<StateParameter>} - Parâmetros atualizados
     */
    async update(id, updateData) {
        const { data, error } = await supabase
            .from('state_parameters')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao atualizar parâmetros: ${error.message}`);
        }

        return new StateParameter(data);
    }

    /**
     * Salvar log de atualização econômica
     * @param {Object} logData - Dados do log
     * @returns {Promise<EconomicUpdateLog>} - Log salvo
     */
    async saveUpdateLog(logData) {
        const { data, error } = await supabase
            .from('economic_update_logs')
            .insert([logData])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao salvar log: ${error.message}`);
        }

        return new EconomicUpdateLog(data);
    }

    /**
     * Buscar logs de um usuário
     * @param {string} userId - ID do usuário
     * @param {number} limit - Limite de registros
     * @returns {Promise<Array<EconomicUpdateLog>>} - Lista de logs
     */
    async findLogsByUserId(userId, limit = 10) {
        const { data, error } = await supabase
            .from('economic_update_logs')
            .select('*')
            .eq('user_id', userId)
            .order('processed_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Erro ao buscar logs: ${error.message}`);
        }

        return data.map(log => new EconomicUpdateLog(log));
    }
}

module.exports = StateParameterRepository;