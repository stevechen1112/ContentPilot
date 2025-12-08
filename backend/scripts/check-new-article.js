const axios = require('axios');

async function checkNewArticle() {
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
        email: 'y.c.chen1112@gmail.com',
        password: '791112'
    });

    const articleRes = await axios.get('http://localhost:3000/api/articles/bea7cba3-2755-4550-bac6-e908fff97815', {
        headers: { Authorization: `Bearer ${loginRes.data.token}` }
    });

    const article = articleRes.data.data;

    console.log('='.repeat(80));
    console.log('新文章檢查');
    console.log('='.repeat(80));
    console.log('\n標題:', article.title);
    console.log('大綱標題:', article.content_draft?.title);
    console.log('段落數:', article.content_draft?.content?.sections?.length || 0);

    console.log('\n段落內容檢查:');
    article.content_draft?.content?.sections?.forEach((s, i) => {
        const heading = s.heading || s.title || '無標題';
        const content = (s.html || s.content || '').substring(0, 200);
        console.log(`\n[段落 ${i + 1}]`);
        console.log(`標題: ${heading}`);
        console.log(`內容預覽: ${content}...`);
    });

    console.log('\n' + '='.repeat(80));
}

checkNewArticle().catch(e => console.error('Error:', e.message));
