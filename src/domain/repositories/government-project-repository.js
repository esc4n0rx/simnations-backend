const { createClient } = require('@supabase/supabase-js');
const GovernmentProjectEntity = require('../entities/government-project-entity');

class GovernmentProjectRepository {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
    }

    /**
     * Criar novo projeto
     * @param {GovernmentProjectEntity} projectEntity - Entidade do projeto
     * @returns {Promise<GovernmentProjectEntity>} - Projeto criado
     */
    async create(projectEntity) {
        try {
            console.log('📝 [REPO] Criando projeto no banco...');
            
            const { data, error } = await this.supabase
                .from('government_projects')
                .insert({
                    user_id: projectEntity.user_id,
                    state_id: projectEntity.state_id,
                    original_idea: projectEntity.original_idea,
                    status: projectEntity.status,
                    refinement_attempts: projectEntity.refinement_attempts || 0,
                    processing_logs: projectEntity.processing_logs || []
                })
                .select()
                .single();

            if (error) {
                console.error('❌ [REPO] Erro ao criar projeto:', error);
                throw new Error(`Erro ao criar projeto: ${error.message}`);
            }

            console.log('✅ [REPO] Projeto criado com sucesso:', data.id);
            return new GovernmentProjectEntity(data);

        } catch (error) {
            console.error('❌ [REPO] Erro na criação:', error);
            throw error;
        }
    }

    /**
     * Buscar projeto por ID (SEM JOIN)
     * @param {string} projectId - ID do projeto
     * @returns {Promise<GovernmentProjectEntity|null>} - Projeto encontrado
     */
    async findById(projectId) {
        try {
            console.log(`🔍 [REPO] Buscando projeto ${projectId}...`);
            
            const { data, error } = await this.supabase
                .from('government_projects')
                .select('*')  // Removido o join com states
                .eq('id', projectId)
                .single();

            if (error) {
                console.error('❌ [REPO] Erro ao buscar projeto:', error);
                throw new Error(`Erro ao buscar projeto: ${error.message}`);
            }

            if (!data) {
                console.log('📭 [REPO] Projeto não encontrado');
                return null;
            }

            console.log('✅ [REPO] Projeto encontrado');
            return new GovernmentProjectEntity(data);

        } catch (error) {
            console.error('❌ [REPO] Erro na busca por ID:', error);
            throw error;
        }
    }

    /**
     * Atualizar projeto
     * @param {string} projectId - ID do projeto
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<GovernmentProjectEntity>} - Projeto atualizado
     */
    async update(projectId, updateData) {
        try {
            console.log(`📝 [REPO] Atualizando projeto ${projectId}...`);
            
            // Preparar dados para atualização
            const dataToUpdate = { ...updateData };
            
            // Garantir que arrays sejam tratados corretamente
            if (dataToUpdate.processing_logs && Array.isArray(dataToUpdate.processing_logs)) {
                // Ok, já é array
            }

            const { data, error } = await this.supabase
                .from('government_projects')
                .update(dataToUpdate)
                .eq('id', projectId)
                .select()
                .single();

            if (error) {
                console.error('❌ [REPO] Erro ao atualizar projeto:', error);
                throw new Error(`Erro ao atualizar projeto: ${error.message}`);
            }

            console.log('✅ [REPO] Projeto atualizado com sucesso');
            return new GovernmentProjectEntity(data);

        } catch (error) {
            console.error('❌ [REPO] Erro na atualização:', error);
            throw error;
        }
    }

    /**
     * Verificar se usuário pode criar projeto
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Resultado da verificação
     */
    async canUserCreateProject(userId) {
        try {
            console.log(`🔍 [REPO] Verificando se usuário ${userId} pode criar projeto...`);
            
            // Buscar projetos ativos do usuário
            const { data, error } = await this.supabase
                .from('government_projects')
                .select('id, status')
                .eq('user_id', userId)
                .in('status', ['draft', 'refined', 'pending_approval', 'approved', 'in_execution']);

            if (error) {
                console.error('❌ [REPO] Erro ao verificar projetos do usuário:', error);
                throw new Error(`Erro ao verificar projetos: ${error.message}`);
            }

            const activeProjects = data || [];
            console.log(`📊 [REPO] Usuário tem ${activeProjects.length} projetos ativos`);

            // Regra: máximo 3 projetos ativos por usuário
            const maxActiveProjects = 3;
            const canCreate = activeProjects.length < maxActiveProjects;

            const result = {
                canCreate,
                reason: canCreate ? null : `Você já tem ${activeProjects.length} projetos ativos. Máximo permitido: ${maxActiveProjects}`,
                activeProjectsCount: activeProjects.length,
                maxAllowed: maxActiveProjects
            };

            console.log(`✅ [REPO] Verificação concluída: pode criar = ${canCreate}`);
            return result;

        } catch (error) {
            console.error('❌ [REPO] Erro na verificação:', error);
            throw error;
        }
    }

    /**
     * Buscar projetos do usuário
     * @param {string} userId - ID do usuário
     * @param {Object} options - Opções de filtro
     * @returns {Promise<Array>} - Lista de projetos
     */
    async findByUserId(userId, options = {}) {
        try {
            console.log(`🔍 [REPO] Buscando projetos do usuário ${userId}...`);
            
            let query = this.supabase
                .from('government_projects')
                .select('*')
                .eq('user_id', userId);

            // Aplicar filtros
            if (options.status) {
                query = query.eq('status', options.status);
            }

            // Aplicar ordenação
            const orderBy = options.orderBy || 'created_at';
            const orderDirection = options.orderDirection || 'DESC';
            query = query.order(orderBy, { ascending: orderDirection === 'ASC' });

            // Aplicar paginação
            if (options.limit) {
                query = query.limit(options.limit);
            }
            if (options.offset) {
                query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ [REPO] Erro ao buscar projetos do usuário:', error);
                throw new Error(`Erro ao buscar projetos: ${error.message}`);
            }

            console.log(`✅ [REPO] Encontrados ${data?.length || 0} projetos`);
            return (data || []).map(project => new GovernmentProjectEntity(project));

        } catch (error) {
            console.error('❌ [REPO] Erro na busca por usuário:', error);
            throw error;
        }
    }

    /**
     * Buscar projetos pendentes de aprovação
     * @param {string} userId - ID do usuário
     * @returns {Promise<Array>} - Lista de projetos pendentes
     */
    async findPendingByUserId(userId) {
        try {
            console.log(`🔍 [REPO] Buscando projetos pendentes do usuário ${userId}...`);
            
            const { data, error } = await this.supabase
                .from('government_projects')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'pending_approval')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ [REPO] Erro ao buscar projetos pendentes:', error);
                throw new Error(`Erro ao buscar projetos pendentes: ${error.message}`);
            }

            console.log(`✅ [REPO] Encontrados ${data?.length || 0} projetos pendentes`);
            return (data || []).map(project => new GovernmentProjectEntity(project));

        } catch (error) {
            console.error('❌ [REPO] Erro na busca de pendentes:', error);
            throw error;
        }
    }

    /**
     * Obter estatísticas de projetos
     * @returns {Promise<Object>} - Estatísticas
     */
    async getProjectStatistics() {
        try {
            console.log('📊 [REPO] Obtendo estatísticas de projetos...');
            
            const { data, error } = await this.supabase
                .from('government_projects')
                .select('status');

            if (error) {
                console.error('❌ [REPO] Erro ao obter estatísticas:', error);
                throw new Error(`Erro ao obter estatísticas: ${error.message}`);
            }

            const stats = {
                total: data?.length || 0,
                by_status: {}
            };

            // Contar por status
            if (data) {
                data.forEach(project => {
                    const status = project.status;
                    stats.by_status[status] = (stats.by_status[status] || 0) + 1;
                });
            }

            console.log('✅ [REPO] Estatísticas obtidas');
            return stats;

        } catch (error) {
            console.error('❌ [REPO] Erro nas estatísticas:', error);
            throw error;
        }
    }

    /**
     * Buscar projetos com filtros avançados
     * @param {string} userId - ID do usuário
     * @param {Object} searchParams - Parâmetros de busca
     * @returns {Promise<Object>} - Resultados da busca
     */
    async searchProjects(userId, searchParams) {
        try {
            console.log(`🔍 [REPO] Buscando projetos com filtros...`);
            
            let query = this.supabase
                .from('government_projects')
                .select('*', { count: 'exact' })
                .eq('user_id', userId);

            // Aplicar filtros
            if (searchParams.status) {
                query = query.eq('status', searchParams.status);
            }

            if (searchParams.search) {
                query = query.ilike('original_idea', `%${searchParams.search}%`);
            }

            if (searchParams.startDate) {
                query = query.gte('created_at', searchParams.startDate);
            }

            if (searchParams.endDate) {
                query = query.lte('created_at', searchParams.endDate);
            }

            // Ordenação
            const orderBy = searchParams.orderBy || 'created_at';
            const orderDirection = searchParams.orderDirection || 'DESC';
            query = query.order(orderBy, { ascending: orderDirection === 'ASC' });

            // Paginação
            const page = searchParams.page || 1;
            const limit = searchParams.limit || 20;
            const offset = (page - 1) * limit;
            
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) {
                console.error('❌ [REPO] Erro na busca:', error);
                throw new Error(`Erro na busca: ${error.message}`);
            }

            console.log(`✅ [REPO] Busca concluída: ${data?.length || 0} projetos`);
            
            return {
                projects: (data || []).map(project => new GovernmentProjectEntity(project)),
                total: count || 0,
                pagination: {
                    page,
                    limit,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            };

        } catch (error) {
            console.error('❌ [REPO] Erro na busca avançada:', error);
            throw error;
        }
    }
}

module.exports = GovernmentProjectRepository;