const { PROJECT_STATUS, PROJECT_TYPES, PROJECT_RISKS, EXECUTION_METHODS } = require('../../shared/constants/government-project-constants');

class GovernmentProjectEntity {
    constructor(data) {
        this.id = data.id || null;
        this.user_id = data.user_id;
        this.state_id = data.state_id;
        
        // Dados do projeto
        this.original_idea = data.original_idea;
        this.refined_project = data.refined_project || null;
        this.analysis_data = data.analysis_data || null;
        this.population_reaction = data.population_reaction || null;
        
        // Status e timing
        this.status = data.status || PROJECT_STATUS.DRAFT;
        this.created_at = data.created_at || new Date();
        this.approved_at = data.approved_at || null;
        this.started_at = data.started_at || null;
        this.completed_at = data.completed_at || null;
        this.estimated_completion = data.estimated_completion || null;
        
        // Metadados de processamento
        this.refinement_attempts = data.refinement_attempts || 0;
        this.rejection_reason = data.rejection_reason || null;
        this.processing_logs = data.processing_logs || [];
        
        // Validar dados na criação
        this.validate();
    }

    /**
     * Validar dados da entidade
     */
    validate() {
        if (!this.user_id) {
            throw new Error('user_id é obrigatório');
        }

        if (!this.state_id) {
            throw new Error('state_id é obrigatório');
        }

        if (!this.original_idea || this.original_idea.trim().length === 0) {
            throw new Error('original_idea é obrigatória');
        }

        if (!Object.values(PROJECT_STATUS).includes(this.status)) {
            throw new Error(`Status inválido: ${this.status}`);
        }
    }

    /**
     * Atualizar projeto refinado
     * @param {Object} refinedData - Dados do projeto refinado
     */
    setRefinedProject(refinedData) {
        this.refined_project = {
            name: refinedData.name,
            objective: refinedData.objective,
            description: refinedData.description,
            justification: refinedData.justification,
            target_population: refinedData.target_population,
            expected_impacts: refinedData.expected_impacts,
            project_type: refinedData.project_type,
            refined_at: new Date()
        };
        
        this.status = PROJECT_STATUS.PENDING_APPROVAL;
        this.addProcessingLog('Projeto refinado com sucesso');
    }

    /**
     * Atualizar análise do projeto
     * @param {Object} analysisData - Dados da análise
     */
    setAnalysisData(analysisData) {
        this.analysis_data = {
            implementation_cost: analysisData.implementation_cost,
            execution_method: analysisData.execution_method,
            installments_config: analysisData.installments_config || null,
            estimated_duration_months: analysisData.estimated_duration_months,
            technical_feasibility: analysisData.technical_feasibility,
            required_resources: analysisData.required_resources,
            potential_risks: analysisData.potential_risks,
            economic_return_projection: analysisData.economic_return_projection,
            social_impact_projection: analysisData.social_impact_projection,
            analyzed_at: new Date()
        };
        
        this.addProcessingLog('Análise técnica concluída');
    }

    /**
     * Aprovar projeto
     */
    approve() {
        if (this.status !== PROJECT_STATUS.PENDING_APPROVAL) {
            throw new Error('Projeto não está pendente de aprovação');
        }
        
        this.status = PROJECT_STATUS.APPROVED;
        this.approved_at = new Date();
        this.addProcessingLog('Projeto aprovado pelo governador');
    }

    /**
     * Rejeitar projeto
     * @param {string} reason - Motivo da rejeição
     */
    reject(reason) {
        this.status = PROJECT_STATUS.REJECTED;
        this.rejection_reason = reason;
        this.addProcessingLog(`Projeto rejeitado: ${reason}`);
    }

    /**
     * Iniciar execução do projeto
     */
    startExecution() {
        if (this.status !== PROJECT_STATUS.APPROVED) {
            throw new Error('Projeto não está aprovado');
        }
        
        this.status = PROJECT_STATUS.IN_EXECUTION;
        this.started_at = new Date();
        
        // Calcular data estimada de conclusão
        if (this.analysis_data && this.analysis_data.estimated_duration_months) {
            this.estimated_completion = new Date();
            this.estimated_completion.setMonth(
                this.estimated_completion.getMonth() + this.analysis_data.estimated_duration_months
            );
        }
        
        this.addProcessingLog('Execução do projeto iniciada');
    }

    /**
     * Completar projeto
     * @param {Object} completionData - Dados de finalização
     */
    complete(completionData = {}) {
        if (this.status !== PROJECT_STATUS.IN_EXECUTION) {
            throw new Error('Projeto não está em execução');
        }
        
        this.status = PROJECT_STATUS.COMPLETED;
        this.completed_at = new Date();
        this.addProcessingLog('Projeto concluído com sucesso');
    }

    /**
     * Cancelar projeto
     * @param {string} reason - Motivo do cancelamento
     */
    cancel(reason) {
        if ([PROJECT_STATUS.COMPLETED, PROJECT_STATUS.CANCELLED].includes(this.status)) {
            throw new Error('Projeto não pode ser cancelado');
        }
        
        this.status = PROJECT_STATUS.CANCELLED;
        this.addProcessingLog(`Projeto cancelado: ${reason}`);
    }

    /**
     * Adicionar reação da população
     * @param {Object} reactionData - Dados da reação
     */
    setPopulationReaction(reactionData) {
        this.population_reaction = {
            public_opinion: reactionData.public_opinion,
            sector_reactions: reactionData.sector_reactions || [],
            approval_impact: reactionData.approval_impact,
            protest_level: reactionData.protest_level,
            media_coverage: reactionData.media_coverage,
            generated_at: new Date()
        };
        
        this.addProcessingLog('Reação da população registrada');
    }

    /**
     * Adicionar log de processamento
     * @param {string} message - Mensagem do log
     */
    addProcessingLog(message) {
        this.processing_logs.push({
            timestamp: new Date(),
            message: message
        });
    }

    /**
     * Verificar se projeto pode ser aprovado
     * @returns {boolean}
     */
    canBeApproved() {
        return this.status === PROJECT_STATUS.PENDING_APPROVAL && 
               this.refined_project && 
               this.analysis_data;
    }

    /**
     * Verificar se projeto está ativo (em execução)
     * @returns {boolean}
     */
    isActive() {
        return this.status === PROJECT_STATUS.IN_EXECUTION;
    }

    /**
     * Obter duração total do projeto (em dias)
     * @returns {number|null}
     */
    getTotalDurationDays() {
        if (!this.started_at || !this.completed_at) {
            return null;
        }
        
        const diffTime = Math.abs(this.completed_at - this.started_at);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Converter para objeto plain para API
     * @returns {Object}
     */
    toObject() {
        return {
            id: this.id,
            user_id: this.user_id,
            state_id: this.state_id,
            original_idea: this.original_idea,
            refined_project: this.refined_project,
            analysis_data: this.analysis_data,
            population_reaction: this.population_reaction,
            status: this.status,
            created_at: this.created_at,
            approved_at: this.approved_at,
            started_at: this.started_at,
            completed_at: this.completed_at,
            estimated_completion: this.estimated_completion,
            refinement_attempts: this.refinement_attempts,
            rejection_reason: this.rejection_reason,
            processing_logs: this.processing_logs,
            // Propriedades computadas
            can_be_approved: this.canBeApproved(),
            is_active: this.isActive(),
            total_duration_days: this.getTotalDurationDays()
        };
    }
}

module.exports = GovernmentProjectEntity;