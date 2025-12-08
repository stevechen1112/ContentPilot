const { pgPool } = require('../config/db');

class Keyword {
  static async create(data) {
    const { project_id, keyword, search_volume, difficulty_score, user_id } = data;
    
    const result = await pgPool.query(
      `INSERT INTO keywords (project_id, keyword, search_volume, difficulty_score, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [project_id, keyword, search_volume || null, difficulty_score || null, user_id]
    );
    
    return result.rows[0];
  }

  static async findByProject(projectId) {
    const result = await pgPool.query(
      'SELECT * FROM keywords WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await pgPool.query(
      'SELECT * FROM keywords WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const { keyword, search_volume, difficulty_score, status } = data;
    
    const result = await pgPool.query(
      `UPDATE keywords 
       SET keyword = COALESCE($2, keyword),
           search_volume = COALESCE($3, search_volume),
           difficulty_score = COALESCE($4, difficulty_score),
           status = COALESCE($5, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, keyword, search_volume, difficulty_score, status]
    );
    
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pgPool.query(
      'DELETE FROM keywords WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  static async batchCreate(projectId, keywords, userId) {
    const results = [];
    
    for (const keyword of keywords) {
      const result = await this.create({
        project_id: projectId,
        keyword: typeof keyword === 'string' ? keyword : keyword.keyword,
        search_volume: typeof keyword === 'object' ? keyword.search_volume : null,
        difficulty_score: typeof keyword === 'object' ? keyword.difficulty_score : null,
        user_id: userId
      });
      results.push(result);
    }
    
    return results;
  }
}

module.exports = Keyword;
