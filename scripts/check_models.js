const https = require('https');
const fs = require('fs');
const path = require('path');

// Read .env.local manually to get the key
const envPath = path.join(__dirname, '../.env.local');
try {
    if (!fs.existsSync(envPath)) {
        console.error("Error: .env.local file not found at", envPath);
        process.exit(1);
    }
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY=(.+)/);
    const apiKey = match ? match[1].trim() : null;

    if (!apiKey) {
        console.error("Error: GEMINI_API_KEY not found in .env.local");
        process.exit(1);
    }

    console.log("Querying Gemini API for available models...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.error) {
                    console.error("API Error details:", JSON.stringify(json.error, null, 2));
                } else if (json.models) {
                    const generateModels = json.models.filter(m =>
                        m.supportedGenerationMethods.includes('generateContent')
                    );
                    const output = generateModels.map(m => m.name.replace('models/', ''));
                    fs.writeFileSync(path.join(__dirname, 'models.json'), JSON.stringify(output, null, 2));
                    console.log("Saved models to scripts/models.json");
                } else {
                    console.log("Unexpected response format:", json);
                }
            } catch (e) {
                console.error("JSON Parse Error:", e.message);
                console.log("Raw Response:", data);
            }
        });
    }).on('error', (e) => {
        console.error("Network Request Error:", e.message);
    });

} catch (err) {
    console.error("Script Error:", err);
}
