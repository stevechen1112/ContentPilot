const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const EMAIL = 'y.c.chen1112@gmail.com';
const PASSWORD = '791112';
const ARTICLE_ID = '37d8d136-8e37-4ace-8270-0cf2641da96b';

async function diagnoseArticle() {
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        const token = loginRes.data.token;
        const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

        const articleRes = await axios.get(`${API_URL}/articles/${ARTICLE_ID}`, authHeaders);
        const article = articleRes.data.data;

        console.log('='.repeat(80));
        console.log('文章診斷報告');
        console.log('='.repeat(80));

        console.log('\n【基本資訊】');
        console.log(`標題: ${article.title}`);
        console.log(`建立時間: ${article.created_at}`);
        console.log(`狀態: ${article.status}`);

        if (article.content_draft) {
            console.log('\n【大綱結構】');
            console.log(`大綱標題: ${article.content_draft.title || '無'}`);

            if (article.content_draft.content) {
                const { introduction, sections, conclusion } = article.content_draft.content;

                console.log('\n引言:');
                console.log(JSON.stringify(introduction, null, 2).substring(0, 300));

                console.log('\n段落數量:', sections?.length || 0);
                sections?.forEach((sec, i) => {
                    console.log(`\n[段落 ${i + 1}]`);
                    console.log(`  標題: ${sec.heading || sec.title || '無標題'}`);
                    console.log(`  內容長度: ${(sec.html || sec.content || '').length} 字符`);
                    console.log(`  內容預覽 (前200字):`);
                    console.log(`  ${(sec.html || sec.content || '').substring(0, 200)}`);
                });

                console.log('\n結論:');
                console.log(JSON.stringify(conclusion, null, 2).substring(0, 300));
            }

            console.log('\n【元數據】');
            console.log(JSON.stringify(article.content_draft.metadata, null, 2));
        }

        console.log('\n' + '='.repeat(80));
        console.log('診斷完成');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('診斷失敗:', error.message);
        if (error.response) {
            console.error('API 錯誤:', error.response.data);
        }
    }
}

diagnoseArticle();
