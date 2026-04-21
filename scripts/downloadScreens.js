const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OUTPUT_TEXT_PATH = "C:\\Users\\S S S\\.gemini\\antigravity\\brain\\71ebe852-305d-4566-8637-abcb2f899442\\.system_generated\\steps\\10\\output.txt";
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

async function downloadScreens() {
  try {
    const rawContent = fs.readFileSync(OUTPUT_TEXT_PATH, 'utf8');
    
    // The previous tool output might have line numbers like "1: {...}"
    // Strip it if it exists.
    let jsonStr = rawContent.trim();
    if (jsonStr.startsWith("1: ")) {
      jsonStr = jsonStr.substring(3);
    }
    
    const data = JSON.parse(jsonStr);
    const screens = data.screens || [];
    
    console.log(`Found ${screens.length} screens. Starting download...`);
    
    let indexHtmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Digital Shield Prototype Navigation</title>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #11062d; color: #ebe1ff; padding: 40px; }
        h1 { color: #a8a4ff; margin-bottom: 30px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .card { background-color: #1d103f; border-radius: 12px; padding: 20px; transition: transform 0.2s, background-color 0.2s; cursor: pointer; text-decoration: none; color: inherit; display: block; border: 1px solid #2a1b52; }
        .card:hover { transform: translateY(-4px); background-color: #231649; border-color: #675df9; }
        .card h3 { margin: 0 0 10px 0; font-size: 1.2rem; color: #00cffc; }
        .card p { margin: 0; font-size: 0.9rem; color: #b1a4d3; }
        .tag { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background-color: #31215c; margin-top: 15px;}
    </style>
</head>
<body>
    <h1>AI Digital Shield Screens</h1>
    <div class="grid">
`;

    for (let i = 0; i < screens.length; i++) {
        const screen = screens[i];
        const screenId = screen.name.split('/').pop();
        const title = screen.title || screenId;
        const width = screen.width;
        const height = screen.height;
        const deviceType = screen.deviceType || 'DESKTOP';
        
        const fileName = `${screenId}.html`;
        const filePath = path.join(PUBLIC_DIR, fileName);
        
        indexHtmlContent += `
        <a href="${fileName}" class="card">
            <h3>${title}</h3>
            <p>ID: ${screenId}</p>
            <span class="tag">${deviceType} (${width}x${height})</span>
        </a>
        `;
        
        if (screen.htmlCode && screen.htmlCode.downloadUrl) {
            console.log(`Downloading HTML for screen: ${title} (${screenId})`);
            const response = await axios.get(screen.htmlCode.downloadUrl, { responseType: 'text' });
            fs.writeFileSync(filePath, response.data, 'utf8');
            console.log(`Saved ${fileName}`);
        } else {
            console.warn(`No HTML download URL found for screen: ${screenId}`);
        }
    }
    
    indexHtmlContent += `
    </div>
</body>
</html>`;
    
    fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), indexHtmlContent, 'utf8');
    console.log("Successfully generated public/index.html with prototype navigation.");
    
  } catch (error) {
    console.error("Error downloading screens:", error.message);
  }
}

downloadScreens();
