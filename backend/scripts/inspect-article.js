const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const EMAIL = 'y.c.chen1112@gmail.com';
const PASSWORD = '791112';

// The ID of the latest article found in previous step
const ARTICLE_ID = '37d8d136-8e37-4ace-8270-0cf2641da96b';

async function inspectArticleStructure() {
    try {
        // Login
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        const token = loginRes.data.token;
        const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

        // Get specific article
        const articleRes = await axios.get(`${API_URL}/articles/${ARTICLE_ID}`, authHeaders);
        const article = articleRes.data.data;

        console.log('--- Article Root Keys ---');
        console.log(Object.keys(article));

        console.log('\n--- Content Draft Keys ---');
        if (article.content_draft) {
            console.log(Object.keys(article.content_draft));

            if (article.content_draft.content) {
                console.log('\n--- content_draft.content Keys ---');
                console.log(Object.keys(article.content_draft.content));

                if (Array.isArray(article.content_draft.content.sections)) {
                    console.log(`\n✅ Found sections in content_draft.content.sections (Count: ${article.content_draft.content.sections.length})`);
                    article.content_draft.content.sections.forEach((sec, i) => {
                        console.log(`\n[Section ${i + 1}] Title: ${sec.heading || sec.title}`);
                        console.log(`Content (HTML):\n${sec.html || sec.content}`);
                        console.log('---');
                    });
                }
            }

            if (Array.isArray(article.content_draft.sections)) {
                console.log(`\n✅ Found sections in content_draft.sections (Count: ${article.content_draft.sections.length})`);
            }
        } else {
            console.log('❌ content_draft is missing or empty');
        }

        console.log('\n--- Content Field (mapped by controller) ---');
        if (article.content) {
            console.log(Object.keys(article.content));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

inspectArticleStructure();
