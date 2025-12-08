const axios = require('axios');

async function quickCheck() {
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
        email: 'y.c.chen1112@gmail.com',
        password: '791112'
    });

    const articleRes = await axios.get('http://localhost:3000/api/articles/37d8d136-8e37-4ace-8270-0cf2641da96b', {
        headers: { Authorization: `Bearer ${loginRes.data.token}` }
    });

    const a = articleRes.data.data;

    console.log('文章標題:', a.title);
    console.log('大綱標題:', a.content_draft?.title);
    console.log('\n段落標題:');
    a.content_draft?.content?.sections?.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.heading || s.title}`);
    });
}

quickCheck().catch(console.error);
