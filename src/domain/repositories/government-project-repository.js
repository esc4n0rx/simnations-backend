const { Op } = require('sequelize');
const GovernmentProjectEntity = require('../entities/government-project-entity');
const { PROJECT_STATUS, SYSTEM_LIMITS } = require('../../shared/constants/government-project-constants');

class GovernmentProjectRepository {
    constructor() {
        // Importar models dinamicamente para evitar dependências circulares
        this.GovernmentProject = require('../../infrastructure/database/models').GovernmentProject;
        this.ProjectExecution = require('../../infrastructure/database/models').ProjectExecution;
        this.User = require('../../infrastructure/database/models').User;
        this.State = require('../../infrastructure/database/models').State;
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

            const createdProject = await this.GovernmentProject.create(projectData);
            return new GovernmentProjectEntity(createdProject.toJSON());
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
            const project = await this.GovernmentProject.findByPk(projectId, {
                include: [
                    {
                        model: this.User,
                        as: 'user',
                        attributes: ['id', 'email', 'name']
                    },
                    {
                        model: this.State,
                        as: 'state',
                        attributes: ['id', 'name', 'acronym']
                    }
                ]
            });

            return project ? new GovernmentProjectEntity(project.toJSON()) : null;
        } catch (error) {
            console.error('❌ Erro ao buscar projeto por ID:', error);
            throw new Error(`Falha ao buscar projeto: ${error.message}`);
        }
    }

    /**
     * Buscar projetos do usuário
     * @param {number} userId - ID do usuário
     * @param {Object} options - Opções de busca
     * @returns {Promise<Array<GovernmentProjectEntity>>} - Lista de projetos
     */
    async findByUserId(userId, options = {}) {
        try {
            const {
                status = null,
                limit = 20,
                offset = 0,
                orderBy = 'created_at',
                orderDirection = 'DESC'
            } = options;

            const whereClause = { user_id: userId };
            if (status) {
                whereClause.status = status;
            }

            const projects = await this.GovernmentProject.findAll({
                where: whereClause,
                include: [
                    {
                        model: this.State,
                        as: 'state',
                        attributes: ['id', 'name', 'acronym']
                    }
                ],
                limit,
                offset,
                order: [[orderBy, orderDirection]]
            });

            return projects.map(project => new GovernmentProjectEntity(project.toJSON()));
        } catch (error) {
            console.error('❌ Erro ao buscar projetos do usuário:', error);
            throw new Error(`Falha ao buscar projetos: ${error.message}`);
        }
    }

    /**
     * Buscar projetos ativos do usuário
     * @param {number} userId - ID do usuário
     * @returns {Promise<Array<GovernmentProjectEntity>>} - Projetos ativos
     */
    async findActiveProjectsByUserId(userId) {
        try {
            const activeStatuses = [
                PROJECT_STATUS.PENDING_APPROVAL,
                PROJECT_STATUS.APPROVED,
                PROJECT_STATUS.IN_EXECUTION
            ];

            const projects = await this.GovernmentProject.findAll({
                where: {
                    user_id: userId,
                    status: {
                        [Op.in]: activeStatuses
                    }
                },
                include: [
                    {
                        model: this.State,
                        as: 'state',
                        attributes: ['id', 'name', 'acronym']
                    }
                ],
                order: [['created_at', 'DESC']]
            });

            return projects.map(project => new GovernmentProjectEntity(project.toJSON()));
        } catch (error) {
            console.error('❌ Erro ao buscar projetos ativos:', error);
            throw new Error(`Falha ao buscar projetos ativos: ${error.message}`);
        }
    }

    /**
     * Buscar projetos pendentes de aprovação
     * @param {number} userId - ID do usuário
     * @returns {Promise<Array<GovernmentProjectEntity>>} - Projetos pendentes
     */
    async findPendingApprovalByUserId(userId) {
        try {
            const projects = await this.GovernmentProject.findAll({
                where: {
                    user_id: userId,
                    status: PROJECT_STATUS.PENDING_APPROVAL
                },
                order: [['created_at', 'DESC']]
            });

            return projects.map(project => new GovernmentProjectEntity(project.toJSON()));
        } catch (error) {
            console.error('❌ Erro ao buscar projetos pendentes:', error);
            throw new Error(`Falha ao buscar projetos pendentes: ${error.message}`);
        }
    }

    /**
     * Buscar projetos em execução
     * @param {number} userId - ID do usuário (opcional)
     * @returns {Promise<Array<GovernmentProjectEntity>>} - Projetos em execução
     */
    async findInExecution(userId = null) {
        try {
            const whereClause = { status: PROJECT_STATUS.IN_EXECUTION };
            if (userId) {
                whereClause.user_id = userId;
            }

            const projects = await this.GovernmentProject.findAll({
                where: whereClause,
                include: [
                    {
                        model: this.User,
                        as: 'user',
                        attributes: ['id', 'email', 'name']
                    },
                    {
                        model: this.State,
                        as: 'state',
                        attributes: ['id', 'name', 'acronym']
                    }
                ],
                order: [['started_at', 'ASC']]
            });

            return projects.map(project => new GovernmentProjectEntity(project.toJSON()));
        } catch (error) {
            console.error('❌ Erro ao buscar projetos em execução:', error);
            throw new Error(`Falha ao buscar projetos em execução: ${error.message}`);
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
            const [updatedRowsCount] = await this.GovernmentProject.update(
                updateData,
                {
                    where: { id: projectId },
                    returning: true
                }
            );

            if (updatedRowsCount === 0) {
                throw new Error('Projeto não encontrado');
            }

            const updatedProject = await this.findById(projectId);
            return updatedProject;
        } catch (error) {
            console.error('❌ Erro ao atualizar projeto:', error);
            throw new Error(`Falha ao atualizar projeto: ${error.message}`);
        }
    }

    /**
     * Deletar projeto
     * @param {number} projectId - ID do projeto
     * @returns {Promise<boolean>} - Sucesso da operação
     */
    async delete(projectId) {
        try {
            const deletedRowsCount = await this.GovernmentProject.destroy({
                where: { id: projectId }
            });

            return deletedRowsCount > 0;
        } catch (error) {
            console.error('❌ Erro ao deletar projeto:', error);
            throw new Error(`Falha ao deletar projeto: ${error.message}`);
        }
    }

    /**
     * Verificar se usuário pode criar novo projeto
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object>} - Status da verificação
     */
    async canUserCreateProject(userId) {
        try {
            // Verificar projetos ativos
            const activeProjects = await this.findActiveProjectsByUserId(userId);
            const activeCount = activeProjects.length;

            if (activeCount >= SYSTEM_LIMITS.MAX_ACTIVE_PROJECTS_PER_USER) {
                return {
                    canCreate: false,
                    reason: 'Limite de projetos ativos atingido',
                    activeCount,
                    maxAllowed: SYSTEM_LIMITS.MAX_ACTIVE_PROJECTS_PER_USER
                };
            }

            // Verificar projetos pendentes
            const pendingProjects = await this.findPendingApprovalByUserId(userId);
            const pendingCount = pendingProjects.length;

            if (pendingCount >= SYSTEM_LIMITS.MAX_PENDING_PROJECTS_PER_USER) {
                return {
                    canCreate: false,
                    reason: 'Limite de projetos pendentes atingido',
                    pendingCount,
                    maxAllowed: SYSTEM_LIMITS.MAX_PENDING_PROJECTS_PER_USER
                };
            }

            // Verificar cooldown
            const lastProject = await this.GovernmentProject.findOne({
                where: { user_id: userId },
                order: [['created_at', 'DESC']]
            });

            if (lastProject) {
                const timeSinceLastProject = Date.now() - new Date(lastProject.created_at).getTime();
                const cooldownTime = SYSTEM_LIMITS.PROJECT_COOLDOWN_HOURS * 60 * 60 * 1000;

                if (timeSinceLastProject < cooldownTime) {
                    const remainingTime = Math.ceil((cooldownTime - timeSinceLastProject) / (60 * 60 * 1000));
                    return {
                        canCreate: false,
                        reason: 'Período de cooldown ativo',
                        remainingHours: remainingTime
                    };
                }
            }

            return {
                canCreate: true,
                activeCount,
                pendingCount
            };
        } catch (error) {
            console.error('❌ Erro ao verificar criação de projeto:', error);
            throw new Error(`Falha na verificação: ${error.message}`);
        }
    }

    /**
     * Buscar projetos que devem ser finalizados
     * @returns {Promise<Array<GovernmentProjectEntity>>} - Projetos para finalizar
     */
    async findProjectsToComplete() {
        try {
            const projects = await this.GovernmentProject.findAll({
                where: {
                    status: PROJECT_STATUS.IN_EXECUTION,
                    estimated_completion: {
                        [Op.lte]: new Date()
                    }
                },
                include: [
                    {
                        model: this.User,
                        as: 'user',
                        attributes: ['id', 'email', 'name']
                    },
                    {
                        model: this.State,
                        as: 'state',
                        attributes: ['id', 'name', 'acronym']
                    }
                ]
            });

            return projects.map(project => new GovernmentProjectEntity(project.toJSON()));
        } catch (error) {
            console.error('❌ Erro ao buscar projetos para completar:', error);
            throw new Error(`Falha na busca: ${error.message}`);
        }
    }

    /**
     * Obter estatísticas de projetos do usuário
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object>} - Estatísticas
     */
    async getUserProjectStats(userId) {
        try {
            const stats = await this.GovernmentProject.findAll({
                where: { user_id: userId },
                attributes: [
                    'status',
                    [this.GovernmentProject.sequelize.fn('COUNT', '*'), 'count']
                ],
                group: ['status'],
                raw: true
            });

            const result = {
                total: 0,
                draft: 0,
                pending_approval: 0,
                approved: 0,
                rejected: 0,
                in_execution: 0,
                completed: 0,
                cancelled: 0
            };

            stats.forEach(stat => {
                result[stat.status] = parseInt(stat.count);
                result.total += parseInt(stat.count);
            });

            return result;
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw new Error(`Falha ao obter estatísticas: ${error.message}`);
        }
    }

    /**
     * Buscar projetos com filtros avançados
     * @param {Object} filters - Filtros de busca
     * @returns {Promise<Object>} - Resultado com projetos e metadados
     */
    async findWithFilters(filters = {}) {
        try {
            const {
                userId = null,
                stateId = null,
                status = null,
                projectType = null,
                startDate = null,
                endDate = null,
                search = null,
                page = 1,
                limit = 20,
                orderBy = 'created_at',
                orderDirection = 'DESC'
            } = filters;

            const whereClause = {};
            const offset = (page - 1) * limit;

            // Filtros básicos
            if (userId) whereClause.user_id = userId;
            if (stateId) whereClause.state_id = stateId;
            if (status) whereClause.status = status;

            // Filtro por data
            if (startDate || endDate) {
                whereClause.created_at = {};
                if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
                if (endDate) whereClause.created_at[Op.lte] = new Date(endDate);
            }

            // Filtro por tipo de projeto (JSON)
            if (projectType) {
                whereClause['$refined_project.project_type$'] = projectType;
            }

            // Busca textual
            if (search) {
                whereClause[Op.or] = [
                    { original_idea: { [Op.like]: `%${search}%` } },
                    { '$refined_project.name$': { [Op.like]: `%${search}%` } },
                    { '$refined_project.description$': { [Op.like]: `%${search}%` } }
                ];
            }

            // Buscar projetos
            const { count, rows } = await this.GovernmentProject.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: this.User,
                        as: 'user',
                        attributes: ['id', 'email', 'name']
                    },
                    {
                        model: this.State,
                        as: 'state',
                        attributes: ['id', 'name', 'acronym']
                    }
                ],
                limit,
                offset,
                order: [[orderBy, orderDirection]],
                distinct: true
            });

            const projects = rows.map(project => new GovernmentProjectEntity(project.toJSON()));

            return {
                projects,
                pagination: {
                    total: count,
                    page,
                    limit,
                    pages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            console.error('❌ Erro na busca com filtros:', error);
            throw new Error(`Falha na busca: ${error.message}`);
        }
    }
}

module.exports = GovernmentProjectRepository;