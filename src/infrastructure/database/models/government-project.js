'use strict';

const { PROJECT_STATUS } = require('../../../shared/constants/government-project-constants');

module.exports = (sequelize, DataTypes) => {
  const GovernmentProject = sequelize.define('GovernmentProject', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    state_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'states',
        key: 'id'
      }
    },
    original_idea: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    refined_project: {
      type: DataTypes.JSON,
      allowNull: true
    },
    analysis_data: {
      type: DataTypes.JSON,
      allowNull: true
    },
    population_reaction: {
      type: DataTypes.JSON,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PROJECT_STATUS)),
      allowNull: false,
      defaultValue: PROJECT_STATUS.DRAFT
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    estimated_completion: {
      type: DataTypes.DATE,
      allowNull: true
    },
    refinement_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    processing_logs: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
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
    tableName: 'government_projects',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  GovernmentProject.associate = function(models) {
    // Relacionamento com User
    GovernmentProject.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    // Relacionamento com State
    GovernmentProject.belongsTo(models.State, {
      foreignKey: 'state_id',
      as: 'state'
    });

    // Relacionamento com ProjectExecution
    GovernmentProject.hasMany(models.ProjectExecution, {
      foreignKey: 'project_id',
      as: 'executions'
    });
  };

  return GovernmentProject;
};