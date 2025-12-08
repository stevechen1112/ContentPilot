const { pgPool } = require('../config/db');

class ArticleModel {
  /**
   * 建立新文章
   */
  static async create({ project_id, keyword_id, title, content_draft, assigned_to }) {
    const result = await pgPool.query(
      `INSERT INTO articles (project_id, keyword_id, title, content_draft, assigned_to, status)
       VALUES ($1, $2, $3, $4, $5, 'draft') RETURNING *`,
      [project_id, keyword_id, title, content_draft, assigned_to]
    );
    return result.rows[0];
  }

  /**
   * 根據 ID 查詢文章
   */
  static async findById(id) {
    const result = await pgPool.query(
      'SELECT * FROM articles WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  /**
   * 查詢專案的所有文章
   */
  static async findByProjectId(project_id, filters = {}) {
    let query = 'SELECT a.*, k.keyword, u.name as author_name FROM articles a LEFT JOIN keywords k ON a.keyword_id = k.id LEFT JOIN users u ON a.assigned_to = u.id WHERE a.project_id = $1';
    const params = [project_id];
    let paramCount = 2;

    if (filters.status) {
      query += ` AND a.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    query += ' ORDER BY a.created_at DESC';

    const result = await pgPool.query(query, params);
    return result.rows;
  }

  /**
   * 更新文章
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['title', 'slug', 'content_draft', 'content_final', 'status', 
                           'quality_score', 'eeat_score', 'seo_score', 'published_at'];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE articles SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pgPool.query(query, values);
    return result.rows[0];
  }

  /**
   * 刪除文章
   */
  static async delete(id) {
    const result = await pgPool.query(
      'DELETE FROM articles WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  /**
   * 取得文章統計
   */
  static async getStatsByProject(project_id) {
    const result = await pgPool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as drafts,
        COUNT(*) FILTER (WHERE status = 'review') as in_review,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        ROUND(AVG(quality_score), 1) as avg_quality,
        ROUND(AVG(eeat_score), 1) as avg_eeat,
        ROUND(AVG(seo_score), 1) as avg_seo
      FROM articles
      WHERE project_id = $1`,
      [project_id]
    );
    return result.rows[0];
  }

  /**
   * 更新文章狀態
   */
  static async updateStatus(id, status) {
    const result = await pgPool.query(
      `UPDATE articles 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  }
}

module.exports = ArticleModel;
