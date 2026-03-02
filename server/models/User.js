const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM(
      'staff',
      'manager',
      'admin',
      'quality_supervisor',
      'physical_supervisor',
      'inventory_staff',
      'financial_account'
    ),
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  staffType: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: null,
    comment: 'mill or location - only for staff role'
  }
}, {
  tableName: 'users',
  indexes: [
    { fields: ['username'] },
    { fields: ['role'] }
  ]
});

module.exports = User;