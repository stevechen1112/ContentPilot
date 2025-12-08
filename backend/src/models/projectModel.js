const { pgPool } = require('../config/db');

class ProjectModel {
  /**
   * 建立新專案
   */
  static async create({ user_id, name, domain, industry, target_audience }) {
    const result = await pgPool.query(
      `INSERT INTO projects (user_id, name, domain, industry, target_audience) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user_id, name, domain, industry, target_audience]
    );
    return result.rows[0];
  }

  /**
   * 根據 ID 查詢專案
   */
  static async findById(id) {
    const result = await pgPool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  /**
   * 查詢使用者的所有專案
   */
  static async findByUserId(user_id) {
    const result = await pgPool.query(
      `SELECT p.*, 
              COUNT(DISTINCT k.id) as keyword_count,
              COUNT(DISTINCT a.id) as article_count
       FROM projects p
       LEFT JOIN keywords k ON p.id = k.project_id
       LEFT JOIN articles a ON p.id = a.project_id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [user_id]
    );
    return result.rows;
  }

  /**
   * 更新專案資訊
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // 動態建立 UPDATE 語句
    Object.keys(updates).forEach(key => {
      if (['name', 'domain', 'industry', 'target_audience', 'style_template_id'].includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE projects 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pgPool.query(query, values);
    return result.rows[0];
  }

  /**
   * 刪除專案（CASCADE 會自動刪除相關 keywords 和 articles）
   */
  static async delete(id) {
    const result = await pgPool.query(
      'DELETE FROM projects WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  /**
   * 取得專案統計資料
   */
  static async getStatistics(project_id) {
    const result = await pgPool.query(
      `SELECT 
        (SELECT COUNT(*) FROM keywords WHERE project_id = $1) as total_keywords,
        (SELECT COUNT(*) FROM keywords WHERE project_id = $1 AND status = 'completed') as completed_keywords,
        (SELECT COUNT(*) FROM articles WHERE project_id = $1) as total_articles,
        (SELECT COUNT(*) FROM articles WHERE project_id = $1 AND status = 'published') as published_articles
      `,
      [project_id]
    );
    return result.rows[0];
  }
}

module.exports = ProjectModel;
