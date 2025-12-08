const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const EMAIL = 'y.c.chen1112@gmail.com';
const PASSWORD = '791112';
const PROJECT_ID = '389e181a-9b7b-4e79-931e-312bb345bdfd';

async function checkArticles() {
    try {
        // Login
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        const token = loginRes.data.token;
        const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

        // Get articles
        const articlesRes = await axios.get(`${API_URL}/articles?project_id=${PROJECT_ID}`, authHeaders);
        const articles = articlesRes.data.data;

        console.log(`\n📊 Total Articles: ${articles.length}\n`);

        articles.forEach((article, index) => {
            console.log(`\n━━━ Article ${index + 1} ━━━`);
            console.log(`ID: ${article._id || article.id}`);
            console.log(`Title: ${article.title || '未命名'}`);
            console.log(`Status: ${article.status}`);
            console.log(`Created: ${article.created_at}`);
            console.log(`Content Length: ${JSON.stringify(article.content_draft || {}).length} chars`);
            console.log(`Has Content: ${!!article.content_draft}`);
            if (article.content_draft) {
                const preview = JSON.stringify(article.content_draft).substring(0, 200);
                console.log(`Content Preview: ${preview}...`);
            }
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

checkArticles();
