const { supabase } = require('../../infrastructure/database/supabase-client');
const GovernmentProjectEntity = require('../entities/government-project-entity');
const { PROJECT_STATUS, SYSTEM_LIMITS } = require('../../shared/constants/government-project-constants');

class GovernmentProjectRepository {
    constructor() {
        // Usar Supabase ao invés de Sequelize
    }

    /**
     * Criar novo projeto
     * @param {GovernmentProjectEntity} projectEntity - Entidade do projeto
     * @returns {Promise<GovernmentProjectEntity>} - Projeto criado
     */
    async create(projectEntity) {
        try {
            const projectData = {
                user_id: projectEntity.user_id,
                state_id: projectEntity.state_id,
                original_idea: projectEntity.original_idea,
                refined_project: projectEntity.refined_project,
                analysis_data: projectEntity.analysis_data,
                population_reaction: projectEntity.population_reaction,
                status: projectEntity.status,
                approved_at: projectEntity.approved_at,
                started_at: projectEntity.started_at,
                completed_at: projectEntity.completed_at,
                estimated_completion: projectEntity.estimated_completion,
                refinement_attempts: projectEntity.refinement_attempts,
                rejection_reason: projectEntity.rejection_reason,
                processing_logs: projectEntity.processing_logs
            };

            const { data, error } = await supabase
                .from('government_projects')
                .insert([projectData])
                .select()
                .single();

            if (error) {
                console.error('❌ Erro ao criar projeto:', error);
                throw new Error(`Falha ao criar projeto: ${error.message}`);
            }

            return new GovernmentProjectEntity(data);
        } catch (error) {
            console.error('❌ Erro ao criar projeto:', error);
            throw new Error(`Falha ao criar projeto: ${error.message}`);
        }
    }

    /**
     * Buscar projeto por ID
     * @param {number} projectId - ID do projeto
     * @returns {Promise<GovernmentProjectEntity|null>} - Projeto encontrado
     */
    async findById(projectId) {
        try {
            const { data, error } = await supabase
                .from('government_projects')
                .select(`
                    *,
                    user:users!user_id (
                        id,
                        email,
                        name
                    ),
                    state:states!state_id (
                        id,
                        name,
                        acronym
                    )
                `)
                .eq('id', projectId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw new Error(`Erro ao buscar projeto: ${error.message}`);
            }

            return new GovernmentProjectEntity(data);
        } catch (error) {
            console.error('❌ Erro ao buscar projeto por ID:', error);
            throw error;
        }
    }

    /**
     * Buscar projetos por usuário
     * @param {number} userId - ID do usuário
     * @param {Object} filters - Filtros opcionais
     * @returns {Promise<Array<GovernmentProjectEntity>>} - Lista de projetos
     */
    async findByUserId(userId, filters = {}) {
        try {
            let query = supabase
                .from('government_projects')
                .select(`
                    *,
                    user:users!user_id (
                        id,
                        email,
                        name
                    ),
                    state:states!state_id (
                        id,
                        name,
                        acronym
                    )
                `)
                .eq('user_id', userId);

            // Aplicar filtros
            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            // Ordenar por data de criação (mais recente primeiro)
            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;

            if (error) {
                throw new Error(`Erro ao buscar projetos do usuário: ${error.message}`);
            }

            return data.map(project => new GovernmentProjectEntity(project));
        } catch (error) {
            console.error('❌ Erro ao buscar projetos por usuário:', error);
            throw error;
        }
    }

    /**
     * Atualizar projeto
     * @param {number} projectId - ID do projeto
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<GovernmentProjectEntity>} - Projeto atualizado
     */
    async update(projectId, updateData) {
        try {
            const { data, error } = await supabase
                .from('government_projects')
                .update(updateData)
                .eq('id', projectId)
                .select()
                .single();

            if (error) {
                throw new Error(`Erro ao atualizar projeto: ${error.message}`);
            }

            return new GovernmentProjectEntity(data);
        } catch (error) {
            console.error('❌ Erro ao atualizar projeto:', error);
            throw error;
        }
    }

    /**
     * Deletar projeto
     * @param {number} projectId - ID do projeto
     * @returns {Promise<boolean>} - Sucesso da operação
     */
    async delete(projectId) {
        try {
            const { error } = await supabase
                .from('government_projects')
                .delete()
                .eq('id', projectId);

            if (error) {
                throw new Error(`Erro ao deletar projeto: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('❌ Erro ao deletar projeto:', error);
            throw error;
        }
    }

    /**
     * Verificar se usuário pode criar projeto
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object>} - Resultado da verificação
     */
    async canUserCreateProject(userId) {
        try {
            // Buscar projetos ativos do usuário (não finalizados)
            const { data: activeProjects, error } = await supabase
                .from('government_projects')
                .select('id, status')
                .eq('user_id', userId)
                .not('status', 'in', `(${PROJECT_STATUS.COMPLETED},${PROJECT_STATUS.CANCELLED})`);

            if (error) {
                throw new Error(`Erro ao verificar projetos ativos: ${error.message}`);
            }

            const activeCount = activeProjects?.length || 0;

            if (activeCount >= SYSTEM_LIMITS.MAX_ACTIVE_PROJECTS_PER_USER) {
                return {
                    canCreate: false,
                    reason: `Limite de ${SYSTEM_LIMITS.MAX_ACTIVE_PROJECTS_PER_USER} projetos ativos atingido`,
                    activeProjects: activeCount
                };
            }

            return {
                canCreate: true,
                activeProjects: activeCount,
                remainingSlots: SYSTEM_LIMITS.MAX_ACTIVE_PROJECTS_PER_USER - activeCount
            };
        } catch (error) {
            console.error('❌ Erro ao verificar se usuário pode criar projeto:', error);
            throw error;
        }
    }

    /**
     * Buscar projetos por status
     * @param {string} status - Status do projeto
     * @param {Object} options - Opções da consulta
     * @returns {Promise<Array<GovernmentProjectEntity>>} - Lista de projetos
     */
    async findByStatus(status, options = {}) {
        try {
            let query = supabase
                .from('government_projects')
                .select(`
                    *,
                    user:users!user_id (
                        id,
                        email,
                        name
                    ),
                    state:states!state_id (
                        id,
                        name,
                        acronym
                    )
                `)
                .eq('status', status);

            if (options.limit) {
                query = query.limit(options.limit);
            }

            if (options.orderBy) {
                query = query.order(options.orderBy, { 
                    ascending: options.ascending || false 
                });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(`Erro ao buscar projetos por status: ${error.message}`);
            }

            return data.map(project => new GovernmentProjectEntity(project));
        } catch (error) {
            console.error('❌ Erro ao buscar projetos por status:', error);
            throw error;
        }
    }

    /**
     * Contar projetos por usuário e status
     * @param {number} userId - ID do usuário
     * @param {string} status - Status (opcional)
     * @returns {Promise<number>} - Contagem de projetos
     */
    async countByUser(userId, status = null) {
        try {
            let query = supabase
                .from('government_projects')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId);

            if (status) {
                query = query.eq('status', status);
            }

            const { count, error } = await query;

            if (error) {
                throw new Error(`Erro ao contar projetos: ${error.message}`);
            }

            return count || 0;
        } catch (error) {
            console.error('❌ Erro ao contar projetos:', error);
            throw error;
        }
    }
}

module.exports = GovernmentProjectRepository;