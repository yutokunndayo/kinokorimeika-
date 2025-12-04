const express = require('express');
const https = require('https');
const path = require('path');
const FormData = require('form-data');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.static('public'));

// データベース接続
const db = new sqlite3.Database(path.join(__dirname, 'yaminabe.db'), (err) => {
    if (err) return console.error('DB接続エラー:', err.message);
    console.log('データベース接続成功');
});

// --- APIキー読み込み用ヘルパー関数 ---
function getCleanApiKey(keyName) {
    const key = process.env[keyName];
    if (!key) return "";
    return key.replace(/[^\x21-\x7E]/g, '');
}

// --- Gemini API 呼び出し関数 ---
async function callGeminiAPI(ingredients, theme) {
    const apiKey = getCleanApiKey('GEMINI_API_KEY');
    if (!apiKey) throw new Error("Gemini APIキーが設定されていません");

    // ★修正: 調理法(method)は指定せず、AIに考えてもらう
    const promptText = `
    あなたはクリエイティブなシェフです。以下の食材とテーマを使って、ユニークなレシピを考案してください。
    
    【食材】: ${ingredients.join(', ')}
    【テーマ】: ジャンル「${theme.genre}」、気分「${theme.mood}」
    
    ※調理法（焼く、煮る、分子調理など）は、食材とジャンルに合わせてあなたが最適かつユニークなものを提案してください。
    
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
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.error(`Gemini API Error Body: ${data}`);
                    reject(new Error(`Gemini API Error: ${res.statusCode}`));
                    return;
                }
                try {
                    const jsonResponse = JSON.parse(data);
                    if (jsonResponse.candidates && jsonResponse.candidates[0] && jsonResponse.candidates[0].content) {
                        const text = jsonResponse.candidates[0].content.parts[0].text;
                        resolve(JSON.parse(text));
                    } else {
                        reject(new Error("Gemini APIからの応答が不正です"));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(requestData);
        req.end();
    });
}

// --- 定型文生成（APIエラー時の予備） ---
function generateFallbackRecipe(ingredients, theme) {
    const mainIng = ingredients[0] ? ingredients[0].split('(')[0] : '謎の食材';
    const { genre, mood } = theme;
    
    return {
        recipeName: `${genre}風 ${mainIng}の実験調理`,
        summary: `${mood}な味わい！`,
        detail: `${ingredients.join('、')}を使用し、素材のポテンシャルを引き出しました。${genre}の要素を取り入れた、${mood}な一品です。（※AI生成に失敗したため定型文を表示しています）`,
        steps: [
            `${ingredients.join('、')}を食べやすい大きさに切ります。`,
            `フライパンで加熱し、謎の化学反応（メイラード反応）を起こします。`,
            `調味料を加えて味のバランスを整えます。`,
            `お皿に盛り付けて完成です。`
        ]
    };
}

// --- APIエンドポイント ---

// 1. 画像生成API (Stability AI)
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'プロンプトが必要です。' });
    console.log('Stability AIへのプロンプト:', prompt);

    const apiKey = getCleanApiKey('STABILITY_API_KEY');
    
    if (!apiKey) {
        console.error("Stability APIキーが設定されていません");
        return res.status(500).json({ imageUrl: '/img/1402858_s.jpg' });
    }

    try {
        const form = new FormData();
        form.append('prompt', prompt);
        form.append('output_format', 'png');
        
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

        form.pipe(request);

        let responseData = [];
        request.on('response', (response) => {
            if (response.statusCode === 200) {
                response.on('data', (chunk) => responseData.push(chunk));
                response.on('end', () => {
                    console.log('画像生成成功！');
                    const buffer = Buffer.concat(responseData);
                    const imageUrl = `data:image/png;base64,${buffer.toString('base64')}`;
                    res.json({ imageUrl });
                });
            } else {
                 console.error(`Stability API エラー: Status ${response.statusCode}`);
                 res.status(500).json({ imageUrl: '/img/1402858_s.jpg' });
            }
        });
        request.on('error', (error) => {
            console.error('通信エラー:', error);
            res.status(500).json({ imageUrl: '/img/1402858_s.jpg' });
        });
    } catch (error) {
        console.error('サーバー内部エラー:', error);
        res.status(500).json({ imageUrl: '/img/1402858_s.jpg' });
    }
});

// 2. レシピ生成API
app.post('/api/generate-recipe', async (req, res) => {
    try {
        const { ingredients, theme } = req.body; 
        if (!ingredients || !theme) return res.status(400).json({ error: 'データ不足' });
        
        console.log("レシピ生成開始:", theme);

        try {
            const aiRecipe = await callGeminiAPI(ingredients, theme);
            console.log("\n====== AIレシピ生成結果 ======");
            console.log(`【レシピ名】: ${aiRecipe.recipeName}`);
            console.log(`【要約】: ${aiRecipe.summary}`);
            console.log("==============================\n");
            
            aiRecipe.description = `${aiRecipe.summary} ${aiRecipe.detail}`;
            res.json(aiRecipe);

        } catch (apiError) {
            console.error("AI生成失敗（フォールバックを使用）:", apiError.message);
            const fallback = generateFallbackRecipe(ingredients, theme);
            fallback.description = `${fallback.summary} ${fallback.detail}`;
            res.json(fallback);
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '生成失敗' });
    }
});

// 3. ガチャAPI
app.get('/api/gacha', (req, res) => {
    const sql = `SELECT * FROM recipes ORDER BY RANDOM() LIMIT 1;`;
    db.get(sql, [], (err, row) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        res.json(row);
    });
});

// 4. レシピ保存API
app.post('/api/save-recipe', (req, res) => {
    const { recipeName, description, steps } = req.body;
    if (!recipeName || !description || !steps) return res.status(400).json({ success: false });
    
    const stepsString = Array.isArray(steps) ? steps.join('\n') : steps;
    const sql = `INSERT INTO recipes (recipeName, description, steps) VALUES (?, ?, ?)`;
    db.run(sql, [recipeName, description, stepsString], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, id: this.lastID });
    });
});

app.listen(PORT, HOST, () => {
    console.log(`サーバー起動: http://localhost:${PORT}`);
});