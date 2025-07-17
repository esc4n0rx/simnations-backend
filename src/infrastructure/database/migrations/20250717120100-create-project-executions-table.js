'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_executions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'government_projects',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      
      // Dados de execução
      execution_type: {
        type: Sequelize.ENUM('payment', 'effect', 'completion'),
        allowNull: false,
        comment: 'Tipo de execução: pagamento, efeito ou finalização'
      },
      scheduled_for: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Data agendada para execução'
      },
      executed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Data de execução realizada'
      },
      
      // Dados do pagamento (se aplicável)
      payment_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Valor do pagamento se for parcela'
      },
      installment_number: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Número da parcela'
      },
      total_installments: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Total de parcelas'
      },
      
      // Efeitos do projeto
      economic_effects: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Efeitos econômicos aplicados'
      },
      social_effects: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Efeitos sociais aplicados'
      },
      
      // Status da execução
      status: {
        type: Sequelize.ENUM('pending', 'executed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Mensagem de erro se falhou'
      },
      
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Índices
    await queryInterface.addIndex('project_executions', ['project_id'], {
      name: 'idx_project_executions_project_id'
    });
    
    await queryInterface.addIndex('project_executions', ['scheduled_for'], {
      name: 'idx_project_executions_scheduled_for'
    });
    
    await queryInterface.addIndex('project_executions', ['status'], {
      name: 'idx_project_executions_status'
    });
    
    await queryInterface.addIndex('project_executions', ['execution_type'], {
      name: 'idx_project_executions_type'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('project_executions');
  }
};