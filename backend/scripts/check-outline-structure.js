const axios = require('axios');

async function checkOutlineStructure() {
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
        email: 'y.c.chen1112@gmail.com',
        password: '791112'
    });

    const articleRes = await axios.get('http://localhost:3000/api/articles/37d8d136-8e37-4ace-8270-0cf2641da96b', {
        headers: { Authorization: `Bearer ${loginRes.data.token}` }
    });

    const article = articleRes.data.data;

    console.log('=== 完整 content_draft 結構 ===\n');
    console.log(JSON.stringify(article.content_draft, null, 2));
}

checkOutlineStructure().catch(e => console.error('Error:', e.message));
