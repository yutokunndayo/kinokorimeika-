const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs'); // ファイルシステム操作用
const FormData = require('form-data');
const sqlite3 = require('sqlite3').verbose();
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// JSONの解析制限を10MBに拡大（画像データ送信に対応）
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// --- 画像保存用のディレクトリ設定 ---
const UPLOAD_DIR = path.join(__dirname, 'public', 'img', 'recipes');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- データベース接続と初期化 ---
const db = new sqlite3.Database(path.join(__dirname, 'yaminabe.db'), (err) => {
    if (err) return console.error('DB接続エラー:', err.message);
    console.log('データベース接続成功');
    
    // テーブル作成（材料・手順・画像パスを保持）
    db.run(`CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipeName TEXT,
        description TEXT,
        steps TEXT,
        image TEXT,
        ingredients TEXT
    )`);
});

// --- ユーティリティ関数 ---

// APIキーのクリーニング
function getCleanApiKey(keyName) {
    const key = process.env[keyName];
    return key ? key.replace(/[^\x21-\x7E]/g, '') : "";
}

// プロキシ設定
function getProxyAgent() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    return proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;
}

// AIのレスポンス（JSON）を安全にパースする
function parseCleanJSON(text) {
    try {
        text = text.replace(/```json/g, '').replace(/```/g, '');
        const match = text.match(/\{[\s\S]*\}/);
        if (match) text = match[0];
        text = text.replace(/,(\s*[\]}])/g, '$1');
        return JSON.parse(text);
    } catch (e) {
        console.error("JSONパース失敗:", text);
        throw e;
    }
}

// --- AI API連携 (Gemini & Stability) ---

// レシピ生成 (Gemini)
async function callGeminiTextAPI(ingredients, theme) {
    const apiKey = getCleanApiKey('GEMINI_API_KEY');
    if (!apiKey) throw new Error("GEMINI_API_KEYが未設定です");

    const promptText = `
    あなたはクリエイティブなシェフです。以下の食材とテーマを使って、ユニークなレシピを考案してください。
    【食材】: ${ingredients.join(', ')}
    【テーマ】: ジャンル「${theme.genre}」、気分「${theme.mood}」
    以下のフォーマットの **JSONデータのみ** を出力してください。
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
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error(`APIエラー: ${res.statusCode}`));
                try {
                    const json = JSON.parse(data);
                    const text = json.candidates[0].content.parts[0].text;
                    resolve(parseCleanJSON(text));
                } catch (e) { reject(e); }
            });
        });
        req.write(requestData);
        req.end();
    });
}

// 画像生成 & 保存 (Stability AI)
async function callStabilityImageAPI(prompt) {
    const apiKey = getCleanApiKey('STABILITY_API_KEY');
    if (!apiKey) throw new Error("STABILITY_API_KEYが未設定です");

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
            if (res.statusCode !== 200) return reject(new Error(`Stability Error: ${res.statusCode}`));
            
            const fileName = `recipe_${Date.now()}.png`;
            const filePath = path.join(UPLOAD_DIR, fileName);
            const fileStream = fs.createWriteStream(filePath);

            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve(`/img/recipes/${fileName}`);
            });
        });

        req.on('error', e => reject(e));
        form.pipe(req);
    });
}

// 材料推測 (Gemini)
async function callGeminiExtractIngredients(recipeName, description) {
    const apiKey = getCleanApiKey('GEMINI_API_KEY');
    if (!apiKey) return ["不明な食材"];

    const promptText = `料理名「${recipeName}」と解説「${description}」から、食材を3〜5つリストアップしてください。形式: { "ingredients": ["食材1", "食材2"] }`;

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
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = parseCleanJSON(JSON.parse(data).candidates[0].content.parts[0].text);
                    resolve(result.ingredients || ["不明"]);
                } catch (e) { resolve(["不明"]); }
            });
        });
        req.write(requestData);
        req.end();
    });
}

// --- APIエンドポイント ---

// 1. レシピ生成API
app.post('/api/generate-recipe', async (req, res) => {
    try {
        const { ingredients, theme } = req.body;
        const aiRecipe = await callGeminiTextAPI(ingredients, theme);
        aiRecipe.description = `${aiRecipe.summary} ${aiRecipe.detail}`;
        res.json(aiRecipe);
    } catch (error) {
        console.error(error);
        res.status(500).json({ recipeName: "エラー", description: "AI生成に失敗しました", steps: ["もう一度お試しください"] });
    }
});

// 2. 画像生成API
app.post('/api/generate-image', async (req, res) => {
    try {
        const imageUrl = await callStabilityImageAPI(req.body.prompt);
        res.json({ imageUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ imageUrl: '/img/gurumeika-3.jpg' });
    }
});

// 3. レシピ保存API
app.post('/api/save-recipe', (req, res) => {
    let { recipeName, description, steps, image, ingredients } = req.body;
    
    // 画像がBase64の場合、ファイルとして保存しパスに変換
    if (image && image.startsWith('data:image')) {
        try {
            const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
            const fileName = `saved_${Date.now()}.png`;
            fs.writeFileSync(path.join(UPLOAD_DIR, fileName), base64Data, 'base64');
            image = `/img/recipes/${fileName}`;
        } catch (e) {
            console.error("画像保存失敗:", e);
        }
    }

    const stepsString = Array.isArray(steps) ? steps.join('\n') : steps;
    const ingredientsString = JSON.stringify(ingredients || []);
    
    const sql = `INSERT INTO recipes (recipeName, description, steps, image, ingredients) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [recipeName, description, stepsString, image, ingredientsString], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, id: this.lastID });
    });
});

// 4. ガチャAPI
app.get('/api/gacha', (req, res) => {
    const sql = `SELECT * FROM recipes ORDER BY RANDOM() LIMIT 1;`;
    db.get(sql, [], async (err, row) => {
        if (err || !row) return res.json(null);

        try {
            let imageUrl = row.image;
            let ingredients = [];
            let needsUpdate = false;

            // 材料データの復元
            if (row.ingredients) {
                try { ingredients = JSON.parse(row.ingredients); } catch(e) { ingredients = ["不明"]; }
            } else {
                ingredients = await callGeminiExtractIngredients(row.recipeName, row.description);
                needsUpdate = true;
            }

            // 画像がない、または古いデフォルト画像の場合は生成を試みる
            if (!imageUrl || imageUrl.startsWith('/img/gurumeika-')) {
                try {
                    imageUrl = await callStabilityImageAPI(`Gourmet photography of ${row.recipeName}`);
                    needsUpdate = true;
                } catch (e) { imageUrl = '/img/gurumeika-3.jpg'; }
            }

            if (needsUpdate) {
                db.run(`UPDATE recipes SET image = ?, ingredients = ? WHERE id = ?`, 
                    [imageUrl, JSON.stringify(ingredients), row.id]);
            }

            res.json({ ...row, ingredients, imageUrl });
        } catch (e) {
            res.status(500).json({ error: "ガチャ処理エラー" });
        }
    });
});

// 5. マイリスト（図鑑）取得API
app.get('/api/my-recipes', (req, res) => {
    db.all(`SELECT * FROM recipes ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const recipes = rows.map(row => {
            try { row.ingredients = row.ingredients ? JSON.parse(row.ingredients) : []; }
            catch (e) { row.ingredients = []; }
            return row;
        });
        res.json(recipes);
    });
});

app.listen(PORT, HOST, () => {
    console.log(`サーバー起動: http://localhost:${PORT}`);
});