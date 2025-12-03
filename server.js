/* server.js */
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

// DB接続（変更なし）
const db = new sqlite3.Database(path.join(__dirname, 'yaminabe.db'), (err) => {
    if (err) return console.error('DB接続エラー:', err.message);
    console.log('DB接続成功');
    db.run(`CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipeName TEXT,
        description TEXT,
        steps TEXT
    )`);
});

// ★★★ AIを使ってレシピを考える関数（デバッグ機能付き） ★★★
// ★★★ AIを使ってレシピを考える関数（Gemini 2.5 Flash対応版） ★★★
async function generateSurprisingRecipeWithAI(ingredientsList, theme) {
    const apiKey = process.env.GEMINI_API_KEY; 
    if (!apiKey) throw new Error("APIキーが設定されていません");

    // プロンプト（AIへの命令）
    const promptText = `
    あなたは「味覚の科学者」です。以下の食材を使って、
    「きゅうり+ハチミツ=メロン」や「プリン+醤油=ウニ」のような、
    **意外性があり、かつ理論的に美味しそうな（あるいは再現性のある）**レシピを1つ考案してください。
    
    【使用食材】: ${ingredientsList.join(', ')}
    【テーマ】: ${theme.genre} × ${theme.method}
    【気分】: ${theme.mood}

    出力は以下のJSON形式のみで行ってください（余計な会話は不要）:
    {
        "recipeName": "料理名（キャッチーに）",
        "description": "なぜこの組み合わせなのかの理論的解説（例: 香気成分が似ているため〜など）",
        "steps": ["工程1", "工程2", "工程3"...]
    }
    `;

    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            // ★ モデル名を gemini-2.5-flash に変更しました ★
            path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);

                    if (response.error) {
                        console.error("Gemini API Error Detail:", JSON.stringify(response.error, null, 2));
                        // もし2.5もダメなら gemini-2.0-flash を試すようエラー文に含める
                        throw new Error(`Gemini APIエラー: ${response.error.message}`);
                    }
                    
                    if (!response.candidates || response.candidates.length === 0) {
                        console.error("Gemini Response (No candidates):", JSON.stringify(response, null, 2));
                        throw new Error("AIからの回答がありませんでした");
                    }

                    const text = response.candidates[0].content.parts[0].text;
                    const jsonStr = text.replace(/```json|```/g, '').trim();
                    resolve(JSON.parse(jsonStr));

                } catch (e) {
                    console.error("パースまたはAPI処理中のエラー:", e);
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            console.error("通信エラー:", e);
            reject(e);
        });
        
        req.write(requestBody);
        req.end();
    });
}

// 画像生成API（変更なし）
app.post('/api/generate-image', async (req, res) => {
    /* ...既存のStability AIのコード... */
    // (省略: 元のコードをそのまま使用)
    const { prompt } = req.body;
    // ...簡易ダミーレスポンス
    res.json({ imageUrl: '/img/1402858_s.jpg' }); 
});

// レシピ生成API（ここをAI呼び出しに変更）
app.post('/api/generate-recipe', async (req, res) => {
    try {
        const { ingredients, theme } = req.body;
        if (!ingredients || !theme) return res.status(400).json({ error: 'データ不足' });

        // AIでレシピ生成
        const recipeData = await generateSurprisingRecipeWithAI(ingredients, theme);
        
        res.json(recipeData);
    } catch (error) {
        console.error("レシピ生成エラー:", error);
        // エラー時のフォールバック（従来のルールベースなどを残してもOK）
        res.json({
            recipeName: "謎の実験料理（通信エラー）",
            description: "AIの接続に失敗しました。食材を混ぜて祈りましょう。",
            steps: ["全部混ぜる", "焼く", "完成"]
        });
    }
});

/* ... ガチャAPI、保存APIなどは変更なし ... */

app.listen(PORT, HOST, () => {
    console.log(`サーバー起動: http://localhost:${PORT}`);
});