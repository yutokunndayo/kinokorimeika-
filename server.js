const express = require('express');
const https = require('https');
const path = require('path');
const FormData = require('form-data');
const sqlite3 = require('sqlite3').verbose();
const { HttpsProxyAgent } = require('https-proxy-agent');
const session = require('express-session'); // 追加
const bcrypt = require('bcrypt'); // 追加
require('dotenv').config();

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// --- セッション設定 ---
app.use(session({
    secret: 'secret_key_kinokorimeika', // 本番運用時は推測困難な値に変更
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // HTTPS化する場合はtrue
}));

// --- データベース接続とテーブル作成 ---
const db = new sqlite3.Database(path.join(__dirname, 'yaminabe.db'), (err) => {
    if (err) return console.error('DB接続エラー:', err.message);
    console.log('データベース接続成功');
    
    // ユーザーテーブル
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    // レシピテーブル (拡張版)
    db.run(`CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        recipeName TEXT,
        summary TEXT,       -- キャッチコピー
        detail TEXT,        -- 詳細解説
        description TEXT,   -- 互換性用（summary + detail）
        steps TEXT,         -- 手順(JSON)
        image TEXT,
        ingredients TEXT,   -- 材料(JSON)
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

// --- ユーティリティ関数 ---
function getCleanApiKey(keyName) {
    const key = process.env[keyName];
    if (!key) return "";
    return key.replace(/[^\x21-\x7E]/g, '');
}

function getProxyAgent() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxyUrl) return new HttpsProxyAgent(proxyUrl);
    return null;
}

function parseCleanJSON(text) {
    try {
        text = text.replace(/```json/g, '').replace(/```/g, '');
        const match = text.match(/\{[\s\S]*\}/);
        if (match) text = match[0];
        text = text.replace(/,(\s*[\]}])/g, '$1');
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Error. Raw Text:", text);
        throw e;
    }
}

// --- 認証系API ---

// ユーザー登録
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'ユーザー名とパスワードが必要です' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function(err) {
            if (err) return res.status(500).json({ error: 'そのユーザー名は既に使用されています' });
            req.session.userId = this.lastID; // 登録と同時にログイン
            req.session.username = username;
            res.json({ success: true, username });
        });
    } catch (e) {
        res.status(500).json({ error: '登録エラー' });
    }
});

// ログイン
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'ユーザーが見つかりません' });
        
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.userId = user.id;
            req.session.username = user.username;
            res.json({ success: true, username });
        } else {
            res.status(401).json({ error: 'パスワードが違います' });
        }
    });
});

// ログアウト
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// 現在のユーザー確認
app.get('/api/user', (req, res) => {
    if (req.session.userId) {
        res.json({ loggedIn: true, username: req.session.username });
    } else {
        res.json({ loggedIn: false });
    }
});

// --- Gemini & Image API ---
async function callGeminiTextAPI(ingredients, theme) {
    const apiKey = getCleanApiKey('GEMINI_API_KEY');
    if (!apiKey) throw new Error("Gemini APIキー未設定");

    const promptText = `
    以下の食材とテーマを使ってユニークなレシピを考案してください。
    【食材】: ${ingredients.join(', ')}
    【テーマ】: ジャンル「${theme.genre}」、気分「${theme.mood}」
    以下のJSONフォーマットのみを出力:
    {
        "recipeName": "料理名",
        "summary": "短いキャッチコピー（1文）",
        "detail": "料理の詳細な解説やストーリー（長文可）",
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
                    resolve(parseCleanJSON(text));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(requestData);
        req.end();
    });
}

async function callStabilityImageAPI(prompt) {
    const apiKey = getCleanApiKey('STABILITY_API_KEY');
    if (!apiKey) throw new Error("Stability APIキー未設定");

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

// --- アプリケーションAPI ---

app.post('/api/generate-recipe', async (req, res) => {
    try {
        const { ingredients, theme } = req.body;
        const aiRecipe = await callGeminiTextAPI(ingredients, theme);
        // 互換性のためdescriptionも生成しておく
        aiRecipe.description = `${aiRecipe.summary}\n\n${aiRecipe.detail}`;
        res.json(aiRecipe);
    } catch (error) {
        console.error("レシピ生成エラー:", error);
        res.status(500).json({ error: "生成失敗" });
    }
});

app.post('/api/generate-image', async (req, res) => {
    try {
        const imageUrl = await callStabilityImageAPI(req.body.prompt);
        res.json({ imageUrl });
    } catch (error) {
        res.status(500).json({ imageUrl: '/img/gurumeika-3.jpg' });
    }
});

// ★レシピ保存（詳細情報対応・ログイン必須）
app.post('/api/save-recipe', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'ログインが必要です' });

    const { recipeName, summary, detail, description, steps, image, ingredients } = req.body;
    
    const stepsString = Array.isArray(steps) ? JSON.stringify(steps) : steps;
    const ingredientsString = JSON.stringify(ingredients || []);
    
    const sql = `INSERT INTO recipes (user_id, recipeName, summary, detail, description, steps, image, ingredients) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [req.session.userId, recipeName, summary, detail, description, stepsString, image, ingredientsString], function(err) {
        if (err) {
            console.error("保存エラー:", err.message);
            return res.status(500).json({ success: false });
        }
        res.json({ success: true, id: this.lastID });
    });
});

// ★ガチャ（全データ取得）
app.get('/api/gacha', (req, res) => {
    // ランダムに1件取得
    const sql = `SELECT * FROM recipes ORDER BY RANDOM() LIMIT 1;`;
    db.get(sql, [], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json(null);

        try {
            // データを復元
            let steps = [], ingredients = [];
            try { steps = JSON.parse(row.steps); } catch(e) { steps = row.steps ? row.steps.split('\n') : []; }
            try { ingredients = JSON.parse(row.ingredients); } catch(e) { ingredients = []; }

            // 画像がない場合のフォールバック（簡易版）
            if (!row.image) row.image = '/img/gurumeika-3.jpg';

            res.json({
                ...row,
                steps: steps,
                ingredients: ingredients
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "ガチャ処理エラー" });
        }
    });
});

// ★マイレシピ図鑑（ユーザー別）
app.get('/api/my-recipes', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'ログインが必要です' });

    const sql = `SELECT * FROM recipes WHERE user_id = ? ORDER BY id DESC`;
    db.all(sql, [req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const recipes = rows.map(row => {
            try { row.ingredients = JSON.parse(row.ingredients); } catch (e) { row.ingredients = []; }
            try { row.steps = JSON.parse(row.steps); } catch (e) { row.steps = []; }
            return row;
        });
        res.json(recipes);
    });
});

app.listen(PORT, HOST, () => {
    console.log(`サーバー起動: http://localhost:${PORT}`);
});