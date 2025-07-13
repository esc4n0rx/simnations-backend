const { supabase } = require('../../infrastructure/database/supabase-client');
const { StateEconomy, StateGovernance } = require('../entities/state');

class StateRepository {
    /**
     * Criar economia base para o estado
     * @param {Object} economyData - Dados da economia
     * @returns {Promise<StateEconomy>} - Economia criada
     */
    async createStateEconomy(economyData) {
        const { data, error } = await supabase
            .from('state_economies')
            .insert([economyData])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar economia do estado: ${error.message}`);
        }

        return new StateEconomy(data);
    }

    /**
     * Criar governança base para o estado
     * @param {Object} governanceData - Dados da governança
     * @returns {Promise<StateGovernance>} - Governança criada
     */
    async createStateGovernance(governanceData) {
        const { data, error } = await supabase
            .from('state_governance')
            .insert([governanceData])
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar governança do estado: ${error.message}`);
        }

        return new StateGovernance(data);
    }

    /**
     * Buscar economia do estado por usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<StateEconomy|null>} - Economia encontrada ou null
     */
    async findEconomyByUserId(userId) {
        const { data, error } = await supabase
            .from('state_economies')
            .select(`
                *,
                user_states!state_id (
                    id,
                    country,
                    state,
                    is_active
                )
            `)
            .eq('user_id', userId)
            .eq('user_states.is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar economia: ${error.message}`);
        }

        return new StateEconomy(data);
    }

    /**
     * Buscar governança do estado por usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<StateGovernance|null>} - Governança encontrada ou null
     */
    async findGovernanceByUserId(userId) {
        const { data, error } = await supabase
            .from('state_governance')
            .select(`
                *,
                user_states!state_id (
                    id,
                    country,
                    state,
                    is_active
                )
            `)
            .eq('user_id', userId)
            .eq('user_states.is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar governança: ${error.message}`);
        }

        return new StateGovernance(data);
    }

    /**
     * Buscar economia e governança completas por usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object|null>} - Dados completos ou null
     */
    async findCompleteStateDataByUserId(userId) {
        const { data, error } = await supabase
            .from('state_economies')
            .select(`
                *,
                user_states!state_id (
                    id,
                    country,
                    state,
                    is_active,
                    assigned_at,
                    reload_count
                ),
                state_governance (*)
            `)
            .eq('user_id', userId)
            .eq('user_states.is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar dados completos do estado: ${error.message}`);
        }

        return {
            economy: new StateEconomy(data),
            governance: data.state_governance ? new StateGovernance(data.state_governance[0]) : null,
            state_info: data.user_states
        };
    }

    /**
     * Atualizar economia do estado
     * @param {string} economyId - ID da economia
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<StateEconomy>} - Economia atualizada
     */
    async updateEconomy(economyId, updateData) {
        const { data, error } = await supabase
            .from('state_economies')
            .update(updateData)
            .eq('id', economyId)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao atualizar economia: ${error.message}`);
        }

        return new StateEconomy(data);
    }

    /**
     * Atualizar governança do estado
     * @param {string} governanceId - ID da governança
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<StateGovernance>} - Governança atualizada
     */
    async updateGovernance(governanceId, updateData) {
        const { data, error } = await supabase
            .from('state_governance')
            .update(updateData)
            .eq('id', governanceId)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao atualizar governança: ${error.message}`);
        }

        return new StateGovernance(data);
    }

    /**
     * Deletar economia e governança por state_id (para reload)
     * @param {string} stateId - ID do estado
     * @returns {Promise<boolean>} - True se deletado
     */
    async deleteStateDataByStateId(stateId) {
        // Deletar governança primeiro (tem FK para economia)
        await supabase
            .from('state_governance')
            .delete()
            .eq('state_id', stateId);

        // Deletar economia
        const { error } = await supabase
            .from('state_economies')
            .delete()
            .eq('state_id', stateId);

        if (error) {
            throw new Error(`Erro ao deletar dados do estado: ${error.message}`);
        }

        return true;
    }

    /**
     * Gerar economia base usando função do banco
     * @param {string} country - País
     * @param {string} stateName - Nome do estado
     * @param {Object} userScores - Pontuações do usuário
     * @returns {Promise<Object>} - Dados econômicos gerados
     */
    async generateBaseEconomy(country, stateName, userScores) {
        const { data, error } = await supabase
            .rpc('generate_base_economy', {
                p_country: country,
                p_state_name: stateName,
                p_user_scores: userScores
            });

        if (error) {
            throw new Error(`Erro ao gerar economia base: ${error.message}`);
        }

        return data;
    }

    /**
     * Gerar governança base usando função do banco
     * @returns {Promise<Object>} - Dados de governança gerados
     */
    async generateBaseGovernance() {
        const { data, error } = await supabase
            .rpc('generate_base_governance');

        if (error) {
            throw new Error(`Erro ao gerar governança base: ${error.message}`);
        }

        return data;
    }
}

module.exports = StateRepository;