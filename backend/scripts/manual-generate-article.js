const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const EMAIL = 'y.c.chen1112@gmail.com';
const PASSWORD = '791112';
const KEYWORD = '台灣原住民文化傳承';

async function run() {
    console.log('🚀 Starting Manual Article Generation Script...');

    try {
        // 1. Login
        console.log('\n🔐 Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        const token = loginRes.data.token;
        console.log('✅ Login Successful');
        const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

        // 2. Get Projects
        console.log('\n📂 Fetching Projects...');
        const projectsRes = await axios.get(`${API_URL}/projects`, authHeaders);
        const projects = projectsRes.data.data;
        if (projects.length === 0) throw new Error('No projects found.');
        const projectId = projects[0].id;
        console.log(`✅ Using Project: ${projects[0].name} (ID: ${projectId})`);

        // 3. Generate Outline
        console.log(`\n📝 Generating Outline for keyword "${KEYWORD}"...`);
        console.log('⏳ Triggering Ollama (gpt-oss:20b)... Watch GPU!');

        const outlineRes = await axios.post(`${API_URL}/articles/generate-outline`, {
            keyword: KEYWORD,
            project_id: projectId
        }, { ...authHeaders, timeout: 300000 });

        const outline = outlineRes.data.data.outline;
        const serpData = outlineRes.data.data.serp_data;
        console.log('✅ Outline Generated Successfully');
        // console.log(JSON.stringify(outline, null, 2));

        // 4. Generate Full Article
        console.log('\n✍️  Generating Full Article...');

        let keywordId = null;
        try {
            // Try to find existing keyword
            const keywordsRes = await axios.get(`${API_URL}/projects/${projectId}/keywords`, authHeaders);
            const keywordObj = keywordsRes.data.data.find(k => k.name === KEYWORD);
            keywordId = keywordObj ? keywordObj._id || keywordObj.id : null;
        } catch (e) { }

        const articleRes = await axios.post(`${API_URL}/articles/generate`, {
            project_id: projectId,
            keyword_id: keywordId,
            outline: outline,
            serp_data: serpData
        }, { ...authHeaders, timeout: 600000 });

        console.log('\n✅ Article Generated and Saved!');
        console.log(`   Article ID: ${articleRes.data.data.id}`);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

run();
