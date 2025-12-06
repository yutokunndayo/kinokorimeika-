const express = require('express');
const https = require('https');
const path = require('path');
const FormData = require('form-data');
const sqlite3 = require('sqlite3').verbose();
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// データベース接続
const db = new sqlite3.Database(path.join(__dirname, 'yaminabe.db'), (err) => {
    if (err) return console.error('DB接続エラー:', err.message);
    console.log('データベース接続成功');
    
    db.run(`CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipeName TEXT,
        description TEXT,
        steps TEXT,
        image TEXT,
        ingredients TEXT
    )`);
});

// --- APIキー読み込み ---
function getCleanApiKey(keyName) {
    const key = process.env[keyName];
    if (!key) return "";
    return key.replace(/[^\x21-\x7E]/g, '');
}

// --- プロキシ設定 ---
function getProxyAgent() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxyUrl) return new HttpsProxyAgent(proxyUrl);
    return null;
}

// --- ★強力なJSONクリーニング関数 ---
function parseCleanJSON(text) {
    try {
        // 1. Markdown記号を削除
        text = text.replace(/```json/g, '').replace(/```/g, '');
        // 2. 最初の { から 最後の } までを切り出す
        const match = text.match(/\{[\s\S]*\}/);
        if (match) text = match[0];
        // 3. 末尾のカンマ（,）によるエラーを防ぐ
        text = text.replace(/,(\s*[\]}])/g, '$1');
        
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Error. Raw Text:", text);
        throw e;
    }
}

// --- Gemini API (テキスト) ---
async function callGeminiTextAPI(ingredients, theme) {
    const apiKey = getCleanApiKey('GEMINI_API_KEY');
    if (!apiKey) throw new Error("Gemini APIキーが設定されていません");

    const promptText = `
    あなたはクリエイティブなシェフです。以下の食材とテーマを使って、ユニークなレシピを考案してください。
    【食材】: ${ingredients.join(', ')}
    【テーマ】: ジャンル「${theme.genre}」、気分「${theme.mood}」
    以下のフォーマットの **JSONデータのみ** を出力してください（Markdown記法は不要）。
    {
        "recipeName": "料理名",
        "summary": "キャッチコピー",
        "detail": "解説",
        "steps": ["手順1", "手順2", "手順3"]
    }
    `;

    const requestData = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            agent: getProxyAgent()
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error(`API Error: ${res.statusCode}`));
                try {
                    const json = JSON.parse(data);
                    let text = json.candidates[0].content.parts[0].text;
                    // ★修正: クリーニング関数を通す
                    resolve(parseCleanJSON(text));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(requestData);
        req.end();
    });
}

// --- Stability AI (画像) ---
async function callStabilityImageAPI(prompt) {
    const apiKey = getCleanApiKey('STABILITY_API_KEY');
    if (!apiKey) throw new Error("Stability APIキーが設定されていません");

    const form = new FormData();
    form.append('prompt', prompt);
    form.append('output_format', 'png');

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.stability.ai',
            path: `/v2beta/stable-image/generate/core`,
            method: 'POST',
            headers: { ...form.getHeaders(), 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' },
            agent: getProxyAgent()
        };

        const req = https.request(options, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error(`Stability Error: ${res.statusCode}`));
                const buffer = Buffer.concat(chunks);
                resolve(`data:image/png;base64,${buffer.toString('base64')}`);
            });
        });
        req.on('error', (e) => reject(e));
        form.pipe(req);
    });
}

// --- 材料推測 (Gemini) ---
async function callGeminiExtractIngredients(recipeName, description) {
    const apiKey = getCleanApiKey('GEMINI_API_KEY');
    if (!apiKey) return ["謎の食材"];

    const promptText = `
    料理名「${recipeName}」と解説「${description}」から、食材を3〜5つ推測してリストアップしてください。
    出力はJSONのみ: { "ingredients": ["食材1", "食材2"] }
    `;

    const requestData = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    return new Promise((resolve) => {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            agent: getProxyAgent()
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    let text = json.candidates[0].content.parts[0].text;
                    // ★修正: クリーニング関数を通す
                    const result = parseCleanJSON(text);
                    resolve(result.ingredients || ["不明"]);
                } catch (e) { resolve(["不明"]); }
            });
        });
        req.on('error', () => resolve(["不明"]));
        req.write(requestData);
        req.end();
    });
}

// --- APIエンドポイント ---

app.get('/api/recipes/:id', (req, res) => {
    const sql = `SELECT * FROM recipes WHERE id = ?`;
    db.get(sql, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Recipe not found' });
        try { if (row.ingredients) row.ingredients = JSON.parse(row.ingredients); } catch (e) { row.ingredients = ["不明"]; }
        res.json(row);
    });
});

app.post('/api/generate-image', async (req, res) => {
    try {
        const imageUrl = await callStabilityImageAPI(req.body.prompt);
        res.json({ imageUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ imageUrl: '/img/gurumeika-3.jpg' });
    }
});

app.post('/api/generate-recipe', async (req, res) => {
    try {
        const { ingredients, theme } = req.body;
        const aiRecipe = await callGeminiTextAPI(ingredients, theme);
        console.log(`\n生成完了: ${aiRecipe.recipeName}`);
        aiRecipe.description = `${aiRecipe.summary} ${aiRecipe.detail}`;
        res.json(aiRecipe);
    } catch (error) {
        console.error("レシピ生成エラー:", error);
        res.status(500).json({ 
            recipeName: "エラーが発生しました", 
            summary: "再試行してください", 
            detail: "AIの生成に失敗しました。もう一度お試しください。", 
            steps: ["エラー"] 
        });
    }
});

app.get('/api/gacha', (req, res) => {
    const sql = `SELECT * FROM recipes ORDER BY RANDOM() LIMIT 1;`;
    db.get(sql, [], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json(null);

        try {
            let imageUrl = row.image;
            let ingredients = [];
            let needsUpdate = false;

            if (row.ingredients) {
                try { ingredients = JSON.parse(row.ingredients); } catch(e) { ingredients = ["不明"]; }
            } else {
                console.log(`ガチャ: 材料推測...`);
                ingredients = await callGeminiExtractIngredients(row.recipeName, row.description);
                needsUpdate = true;
            }

            if (!imageUrl) {
                console.log(`ガチャ: 画像生成...`);
                try {
                    imageUrl = await callStabilityImageAPI(`(best quality, food photography:1.3), Delicious dish "${row.recipeName}". Style: Experimental cuisine.`);
                    needsUpdate = true;
                } catch (e) {
                    console.error("画像生成失敗:", e.message);
                    imageUrl = '/img/gurumeika-3.jpg';
                }
            }

            if (needsUpdate) {
                const updateSql = `UPDATE recipes SET image = ?, ingredients = ? WHERE id = ?`;
                db.run(updateSql, [imageUrl, JSON.stringify(ingredients), row.id]);
            }

            res.json({ ...row, ingredients, imageUrl });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "ガチャエラー" });
        }
    });
});

app.post('/api/save-recipe', (req, res) => {
    const { recipeName, description, steps, image, ingredients } = req.body;
    const stepsString = Array.isArray(steps) ? steps.join('\n') : steps;
    const ingredientsString = JSON.stringify(ingredients || []);
    const sql = `INSERT INTO recipes (recipeName, description, steps, image, ingredients) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [recipeName, description, stepsString, image, ingredientsString], function(err) {
        if (err) {
            console.error("保存エラー:", err.message);
            return res.status(500).json({ success: false });
        }
        console.log(`保存完了 ID: ${this.lastID}`);
        res.json({ success: true, id: this.lastID });
    });
});

app.listen(PORT, HOST, () => {
    console.log(`サーバー起動: http://localhost:${PORT}`);
});