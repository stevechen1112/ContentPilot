/**
 * 测试改进后的内容生成质量
 * 使用相同的关键字，对比优化前后的差异
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function generateArticleWithValidation(keyword, config) {
  console.log(`\n🚀 开始生成文章: ${keyword}`);
  console.log(`📝 配置: ${JSON.stringify(config, null, 2)}\n`);

  try {
    const response = await axios.post(`${API_BASE}/articles/generate`, {
      keyword,
      ...config
    });

    const article = response.data.data;
    
    console.log('\n✅ 文章生成完成');
    console.log(`📄 标题: ${article.title}`);
    console.log(`📊 总字数: ${article.metadata.word_count}`);
    console.log(`📑 章节数: ${article.content.sections.length}`);
    
    // 分析质量
    console.log('\n📊 质量分析:');
    
    article.content.sections.forEach((section, index) => {
      const wordCount = (section.plain_text.match(/[\u4e00-\u9fff]/g) || []).length;
      const h3Count = (section.html.match(/<h3>/g) || []).length;
      const hasNumbers = /\d+%|\d+个|\d+年/.test(section.plain_text);
      const hasSteps = /步骤[一二三1-3]|建议|避免/.test(section.plain_text);
      
      // 检查禁用词
      const bannedPhrases = ['深入探討', '全面解析', '值得注意', '至關重要'];
      const foundBanned = bannedPhrases.filter(phrase => section.plain_text.includes(phrase));
      
      console.log(`\n  章节 ${index + 1}: ${section.heading}`);
      console.log(`    - 字数: ${wordCount}`);
      console.log(`    - H3数量: ${h3Count}`);
      console.log(`    - 包含数据: ${hasNumbers ? '✅' : '❌'}`);
      console.log(`    - 包含步骤/建议: ${hasSteps ? '✅' : '❌'}`);
      console.log(`    - 禁用词: ${foundBanned.length > 0 ? '❌ ' + foundBanned.join(', ') : '✅ 无'}`);
    });

    // 保存文章
    const filename = `test_${Date.now()}_${keyword}.json`;
    const fs = require('fs');
    const path = require('path');
    
    fs.writeFileSync(
      path.join(__dirname, '../generated_articles', filename),
      JSON.stringify(article, null, 2)
    );
    
    console.log(`\n💾 文章已保存: ${filename}`);
    
    return article;

  } catch (error) {
    console.error('❌ 生成失败:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('内容质量验证测试 - 治本方案验证');
  console.log('='.repeat(60));

  // 测试1: 健康类主题
  await generateArticleWithValidation('失眠怎麼辦', {
    persona: 'Sleep Specialist Doctor',
    target_audience: '長期失眠的上班族',
    unique_angle: '從神經科學角度解析',
    tone: 'Professional',
    word_count: 2000
  });

  // 测试2: 投资类主题
  await generateArticleWithValidation('新手投資理財', {
    persona: 'Financial Advisor',
    target_audience: '25-35歲首次投資者',
    unique_angle: '避開90%新手會犯的錯誤',
    tone: 'Friendly Professional',
    word_count: 2000
  });

  console.log('\n\n✅ 所有测试完成');
}

// 如果直接执行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateArticleWithValidation };
