'use strict';

const { PROJECT_STATUS, PROJECT_TYPES, PROJECT_RISKS, EXECUTION_METHODS } = require('../../../shared/constants/government-project-constants');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('government_projects', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      state_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'states',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      
      // Dados do projeto
      original_idea: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Ideia original do jogador'
      },
      refined_project: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Projeto refinado pelo Agente 1'
      },
      analysis_data: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Análise técnica do Agente 2'
      },
      population_reaction: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Reação da população do Agente 3'
      },
      
      // Status e controle
      status: {
        type: Sequelize.ENUM(...Object.values(PROJECT_STATUS)),
        allowNull: false,
        defaultValue: PROJECT_STATUS.DRAFT,
        comment: 'Status atual do projeto'
      },
      
      // Timestamps de controle
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Data de aprovação pelo governador'
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Data de início da execução'
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Data de conclusão do projeto'
      },
      estimated_completion: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Data estimada de conclusão'
      },
      
      // Metadados de processamento
      refinement_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Número de tentativas de refinamento'
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Motivo da rejeição se aplicável'
      },
      processing_logs: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: '[]',
        comment: 'Logs de processamento do projeto'
      },
      
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Índices para performance
    await queryInterface.addIndex('government_projects', ['user_id'], {
      name: 'idx_government_projects_user_id'
    });
    
    await queryInterface.addIndex('government_projects', ['state_id'], {
      name: 'idx_government_projects_state_id'
    });
    
    await queryInterface.addIndex('government_projects', ['status'], {
      name: 'idx_government_projects_status'
    });
    
    await queryInterface.addIndex('government_projects', ['user_id', 'status'], {
      name: 'idx_government_projects_user_status'
    });
    
    await queryInterface.addIndex('government_projects', ['created_at'], {
      name: 'idx_government_projects_created_at'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('government_projects');
  }
};