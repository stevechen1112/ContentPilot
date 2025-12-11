const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../generated_articles/2025-12-11T11-10-44-100Z_上背痛原因.json');

try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const draft = data.content_draft;
    
    let html = `<h1>${draft.title}</h1>\n\n`;
    
    if (draft.introduction && draft.introduction.html) {
        html += `<div class="introduction">\n${draft.introduction.html}\n</div>\n\n`;
    }
    
    if (draft.content && draft.content.sections) {
        draft.content.sections.forEach((section, index) => {
            html += `<div class="section" id="section-${index + 1}">\n`;
            html += `<h2>${section.heading}</h2>\n`;
            html += `${section.html}\n`;
            html += `</div>\n\n`;
        });
    }
    
    if (draft.conclusion && draft.conclusion.html) {
        html += `<div class="conclusion">\n${draft.conclusion.html}\n</div>`;
    }
    
    console.log(html);
} catch (error) {
    console.error("Error reading or parsing file:", error);
}
