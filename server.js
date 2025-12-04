const express = require('express');
const https = require('https');
const path = require('path');
const FormData = require('form-data');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// 画像データ（Base64）などのためにサイズ制限を緩和
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// データベース接続
const db = new sqlite3.Database(path.join(__dirname, 'yaminabe.db'), (err) => {
    if (err) return console.error('DB接続エラー:', err.message);
    console.log('データベース接続成功');
    
    // テーブル作成（ingredientsカラムを追加）
    db.run(`CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipeName TEXT,
        description TEXT,
        steps TEXT,
        image TEXT,
        ingredients TEXT
    )`);
});

// --- APIキー読み込み用ヘルパー関数 ---
function getCleanApiKey(keyName) {
    const key = process.env[keyName];
    if (!key) return "";
    return key.replace(/[^\x21-\x7E]/g, '');
}

// --- Gemini API (テキスト生成) ---
async function callGeminiTextAPI(ingredients, theme) {
    const apiKey = getCleanApiKey('GEMINI_API_KEY');
    if (!apiKey) throw new Error("Gemini APIキーが設定されていません");

    const promptText = `
    あなたはクリエイティブなシェフです。以下の食材とテーマを使って、ユニークなレシピを考案してください。
    
    【食材】: ${ingredients.join(', ')}
    【テーマ】: ジャンル「${theme.genre}」、気分「${theme.mood}」
    
    以下のフォーマットの **JSONデータのみ** を出力してください（Markdown記法は不要）。
    {
        "recipeName": "料理名（テーマを反映した面白い名前）",
        "summary": "短いキャッチコピー（20文字以内）",
        "detail": "料理の詳しい解説。科学的・実験的なニュアンスを含めて、なぜその調理法を選んだのか、どんな味がするのかを100〜150文字程度で魅力的に説明してください。",
        "steps": [
            "調理手順1（下準備）",
            "調理手順2（調理工程）",
            "調理手順3（調理工程）",
            "調理手順4（仕上げ）"
        ]
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
            headers: { 'Content-Type': 'application/json' }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error(`Text API Error: ${res.statusCode}`));
                try {
                    const jsonResponse = JSON.parse(data);
                    let text = jsonResponse.candidates[0].content.parts[0].text;
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) text = jsonMatch[0];
                    resolve(JSON.parse(text));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(requestData);
        req.end();
    });
}

// --- Stability AI (画像生成) ---
async function callStabilityImageAPI(prompt) {
    const apiKey = getCleanApiKey('STABILITY_API_KEY');
    if (!apiKey) throw new Error("Stability APIキーが設定されていません");

    const form = new FormData();
    form.append('prompt', prompt);
    form.append('output_format', 'png');

    return new Promise((resolve, reject) => {
        const request = https.request({
            hostname: 'api.stability.ai',
            path: `/v2beta/stable-image/generate/core`,
            method: 'POST',
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'image/*'
            }
        });

        let responseData = [];
        request.on('response', (response) => {
            if (response.statusCode === 200) {
                response.on('data', (chunk) => responseData.push(chunk));
                response.on('end', () => {
                    const buffer = Buffer.concat(responseData);
                    resolve(`data:image/png;base64,${buffer.toString('base64')}`);
                });
            } else {
                reject(new Error(`Stability API Error: ${response.statusCode}`));
            }
        });
        request.on('error', (e) => reject(e));
        form.pipe(request);
    });
}

// --- 材料推測 (Gemini: 過去データ用) ---
async function callGeminiExtractIngredients(recipeName, description) {
    const apiKey = getCleanApiKey('GEMINI_API_KEY');
    if (!apiKey) return ["謎の食材"];

    const promptText = `
    以下の料理名と解説から、使われていると思われる食材を3〜5つ推測してリストアップしてください。
    【料理名】: ${recipeName}
    【解説】: ${description}
    以下のフォーマットの **JSONデータのみ** を出力してください。
    { "ingredients": ["食材1", "食材2", "食材3"] }
    `;

    const requestData = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    let text = json.candidates[0].content.parts[0].text;
                    const match = text.match(/\{[\s\S]*\}/);
                    if (match) text = match[0];
                    resolve(JSON.parse(text).ingredients || ["不明"]);
                } catch (e) { resolve(["不明"]); }
            });
        });
        req.on('error', () => resolve(["不明"]));
        req.write(requestData);
        req.end();
    });
}

// --- フォールバック ---
function generateFallbackRecipe(ingredients, theme) {
    const mainIng = ingredients[0] ? ingredients[0].split('(')[0] : '謎の食材';
    return {
        recipeName: `${theme.genre}風 ${mainIng}の実験`,
        summary: "AI生成に失敗しました",
        detail: "API接続エラー。時間をおいて再度お試しください。",
        steps: ["食材を切る", "加熱する", "盛り付ける"]
    };
}

// --- APIエンドポイント ---

// 1. 画像生成API
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;
    try {
        const imageUrl = await callStabilityImageAPI(prompt);
        res.json({ imageUrl });
    } catch (error) {
        console.error('画像生成エラー:', error.message);
        res.status(500).json({ imageUrl: '/img/1402858_s.jpg' });
    }
});

// 2. レシピ生成API
app.post('/api/generate-recipe', async (req, res) => {
    try {
        const { ingredients, theme } = req.body; 
        console.log("レシピ生成開始:", theme);
        try {
            const aiRecipe = await callGeminiTextAPI(ingredients, theme);
            console.log("\n=== 生成成功 ===");
            console.log(`名: ${aiRecipe.recipeName}`);
            
            aiRecipe.description = `${aiRecipe.summary} ${aiRecipe.detail}`;
            res.json(aiRecipe);
        } catch (apiError) {
            console.error("AI生成失敗:", apiError.message);
            const fallback = generateFallbackRecipe(ingredients, theme);
            fallback.description = `${fallback.summary} ${fallback.detail}`;
            res.json(fallback);
        }
    } catch (error) {
        res.status(500).json({ error: '生成失敗' });
    }
});

// 3. ガチャAPI (材料・画像対応版)
app.get('/api/gacha', async (req, res) => {
    const sql = `SELECT * FROM recipes ORDER BY RANDOM() LIMIT 1;`;
    
    db.get(sql, [], async (err, row) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        if (!row) { res.json(null); return; }

        try {
            let imageUrl = row.image; 
            let ingredients = [];

            // ★保存された材料があればパースして使う
            if (row.ingredients) {
                try {
                    ingredients = JSON.parse(row.ingredients);
                } catch (e) {
                    console.error("材料パースエラー:", e);
                    ingredients = ["不明"];
                }
            } else {
                // 保存されていなければAIで推測（古いデータ用）
                ingredients = await callGeminiExtractIngredients(row.recipeName, row.description);
            }

            // 画像が保存されていない場合のみ生成する
            if (!imageUrl) {
                console.log(`ガチャ: 画像未保存のため生成中 (${row.recipeName})`);
                imageUrl = await callStabilityImageAPI(`(best quality, food photography:1.3), Delicious dish "${row.recipeName}". Style: Experimental cuisine.`).catch(e => '/img/1402858_s.jpg');
            } else {
                console.log(`ガチャ: 保存済み画像を使用 (${row.recipeName})`);
            }

            res.json({
                ...row,
                ingredients: ingredients,
                imageUrl: imageUrl
            });

        } catch (e) {
            console.error("ガチャエラー:", e);
            res.json({ ...row, ingredients: ["不明"], imageUrl: '/img/1402858_s.jpg' });
        }
    });
});

// 4. レシピ保存API (材料・画像対応)
app.post('/api/save-recipe', (req, res) => {
    const { recipeName, description, steps, image, ingredients } = req.body;
    
    if (!recipeName || !description || !steps) return res.status(400).json({ success: false });
    
    const stepsString = Array.isArray(steps) ? steps.join('\n') : steps;
    const ingredientsString = JSON.stringify(ingredients || []); // 材料を文字列化して保存
    
    const sql = `INSERT INTO recipes (recipeName, description, steps, image, ingredients) VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [recipeName, description, stepsString, image, ingredientsString], function(err) {
        if (err) {
            console.error("保存エラー:", err.message);
            return res.status(500).json({ success: false });
        }
        console.log(`レシピ保存完了: ${recipeName} (ID: ${this.lastID})`);
        res.json({ success: true, id: this.lastID });
    });
});

app.listen(PORT, HOST, () => {
    console.log(`サーバー起動: http://localhost:${PORT}`);
});