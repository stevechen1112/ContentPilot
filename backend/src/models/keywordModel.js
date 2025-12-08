const { pgPool } = require('../config/db');

class KeywordModel {
  /**
   * 批量新增關鍵字
   */
  static async createBatch(project_id, keywords) {
    const values = keywords.map((kw, index) => {
      const offset = index * 5;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    }).join(', ');

    const params = keywords.flatMap(kw => [
      project_id,
      kw.keyword,
      kw.search_volume || null,
      kw.difficulty_score || null,
      kw.priority || 'medium'
    ]);

    const query = `
      INSERT INTO keywords (project_id, keyword, search_volume, difficulty_score, priority)
      VALUES ${values}
      RETURNING *
    `;

    const result = await pgPool.query(query, params);
    return result.rows;
  }

  /**
   * 新增單一關鍵字
   */
  static async create({ project_id, keyword, search_volume, difficulty_score, priority }) {
    const result = await pgPool.query(
      `INSERT INTO keywords (project_id, keyword, search_volume, difficulty_score, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [project_id, keyword, search_volume, difficulty_score, priority || 'medium']
    );
    return result.rows[0];
  }

  /**
   * 根據專案 ID 查詢所有關鍵字
   */
  static async findByProjectId(project_id, filters = {}) {
    let query = `
      SELECT k.*, 
             COUNT(a.id) as article_count
      FROM keywords k
      LEFT JOIN articles a ON k.id = a.keyword_id
      WHERE k.project_id = $1
    `;
    const params = [project_id];
    let paramCount = 2;

    // 狀態篩選
    if (filters.status) {
      query += ` AND k.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    // 優先級篩選
    if (filters.priority) {
      query += ` AND k.priority = $${paramCount}`;
      params.push(filters.priority);
      paramCount++;
    }

    query += ` GROUP BY k.id ORDER BY k.created_at DESC`;

    const result = await pgPool.query(query, params);
    return result.rows;
  }

  /**
   * 根據 ID 查詢關鍵字
   */
  static async findById(id) {
    const result = await pgPool.query(
      'SELECT * FROM keywords WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  /**
   * 更新關鍵字資訊
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (['keyword', 'search_volume', 'difficulty_score', 'priority', 'status'].includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);

    const query = `
      UPDATE keywords 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pgPool.query(query, values);
    return result.rows[0];
  }

  /**
   * 刪除關鍵字
   */
  static async delete(id) {
    const result = await pgPool.query(
      'DELETE FROM keywords WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  /**
   * 批量更新關鍵字狀態
   */
  static async updateStatusBatch(keyword_ids, status) {
    const result = await pgPool.query(
      `UPDATE keywords 
       SET status = $1 
       WHERE id = ANY($2::uuid[])
       RETURNING *`,
      [status, keyword_ids]
    );
    return result.rows;
  }

  /**
   * 取得專案關鍵字統計
   */
  static async getStatsByProject(project_id) {
    const result = await pgPool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
        ROUND(AVG(search_volume), 0) as avg_search_volume,
        ROUND(AVG(difficulty_score), 1) as avg_difficulty
      FROM keywords
      WHERE project_id = $1`,
      [project_id]
    );
    return result.rows[0];
  }
}

module.exports = KeywordModel;
