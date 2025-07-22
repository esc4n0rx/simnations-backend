const { supabase } = require('../../infrastructure/database/supabase-client');

class ProjectExecutionRepository {
    constructor() {
        // Usar Supabase ao invés de Sequelize
        this.supabase = supabase;
    }

    /**
     * Criar nova execução
     * @param {Object} executionData - Dados da execução
     * @returns {Promise<Object>} - Execução criada
     */
    async create(executionData) {
        try {
            const { data, error } = await supabase
                .from('project_executions')
                .insert([executionData])
                .select()
                .single();

            if (error) {
                throw new Error(`Erro ao criar execução: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('❌ Erro ao criar execução:', error);
            throw error;
        }
    }

    /**
     * Criar múltiplas execuções
     * @param {Array} executionsData - Array de dados das execuções
     * @returns {Promise<Array>} - Execuções criadas
     */
    async bulkCreate(executionsData) {
        try {
            const { data, error } = await supabase
                .from('project_executions')
                .insert(executionsData)
                .select();

            if (error) {
                throw new Error(`Erro ao criar execuções em lote: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('❌ Erro ao criar execuções em lote:', error);
            throw error;
        }
    }

    /**
     * Buscar execuções pendentes
     * @returns {Promise<Array>} - Lista de execuções pendentes
     */
    async findPendingExecutions() {
        try {
            const { data, error } = await supabase
                .from('project_executions')
                .select(`
                    *,
                    project:government_projects!project_id (
                        *,
                        user:users!user_id (
                            id,
                            email,
                            name
                        )
                    )
                `)
                .eq('status', 'pending')
                .lte('scheduled_for', new Date().toISOString());

            if (error) {
                throw new Error(`Erro ao buscar execuções pendentes: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            console.error('❌ Erro ao buscar execuções pendentes:', error);
            throw error;
        }
    }

    /**
     * Atualizar execução
     * @param {number} executionId - ID da execução
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<Object>} - Execução atualizada
     */
    async update(executionId, updateData) {
        try {
            const { data, error } = await supabase
                .from('project_executions')
                .update(updateData)
                .eq('id', executionId)
                .select()
                .single();

            if (error) {
                throw new Error(`Erro ao atualizar execução: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('❌ Erro ao atualizar execução:', error);
            throw error;
        }
    }

    /**
     * Cancelar execuções de um projeto
     * @param {number} projectId - ID do projeto
     * @returns {Promise<number>} - Número de execuções canceladas
     */
    async cancelProjectExecutions(projectId) {
        try {
            const { data, error } = await supabase
                .from('project_executions')
                .update({ status: 'cancelled' })
                .eq('project_id', projectId)
                .eq('status', 'pending')
                .select();

            if (error) {
                throw new Error(`Erro ao cancelar execuções: ${error.message}`);
            }

            return data?.length || 0;
        } catch (error) {
            console.error('❌ Erro ao cancelar execuções:', error);
            throw error;
        }
    }

    /**
     * Buscar execuções por projeto
     * @param {number} projectId - ID do projeto
     * @returns {Promise<Array>} - Lista de execuções
     */
    async findByProjectId(projectId) {
        try {
            const { data, error } = await supabase
                .from('project_executions')
                .select('*')
                .eq('project_id', projectId)
                .order('scheduled_for', { ascending: true });

            if (error) {
                throw new Error(`Erro ao buscar execuções do projeto: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            console.error('❌ Erro ao buscar execuções do projeto:', error);
            throw error;
        }
    }
}

module.exports = ProjectExecutionRepository;