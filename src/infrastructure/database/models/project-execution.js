'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProjectExecution = sequelize.define('ProjectExecution', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    project_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'government_projects',
        key: 'id'
      }
    },
    execution_type: {
      type: DataTypes.ENUM('payment', 'effect', 'completion'),
      allowNull: false
    },
    scheduled_for: {
      type: DataTypes.DATE,
      allowNull: false
    },
    executed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    payment_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    installment_number: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    total_installments: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    economic_effects: {
      type: DataTypes.JSON,
      allowNull: true
    },
    social_effects: {
      type: DataTypes.JSON,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'executed', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE
    }
  }, {
    tableName: 'project_executions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  ProjectExecution.associate = function(models) {
    // Relacionamento com GovernmentProject
    ProjectExecution.belongsTo(models.GovernmentProject, {
      foreignKey: 'project_id',
      as: 'project'
    });
  };

  return ProjectExecution;
};