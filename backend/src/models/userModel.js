const { pgPool } = require('../config/db');

class UserModel {
  static async findByEmail(email) {
    const result = await pgPool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async create({ email, password_hash, name }) {
    const result = await pgPool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [email, password_hash, name]
    );
    return result.rows[0];
  }
}

module.exports = UserModel;
