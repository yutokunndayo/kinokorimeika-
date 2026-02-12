const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const sqlite3 = require('sqlite3').verbose();
const { HttpsProxyAgent } = require('https-proxy-agent');
const session = require('express-session'); // 追加
const bcrypt = require('bcryptjs'); // 追加
require('dotenv').config();

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// --- セッション設定 (ログイン状態の維持) ---
app.use(session({
    secret: 'my-secret-key-kinoko', // 本番では推測困難な文字列にしてください
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1日有効
}));

const UPLOAD_DIR = path.join(__dirname, 'public', 'img', 'recipes');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- データベース初期化 ---
const db = new sqlite3.Database(path.join(__dirname, 'yaminabe.db'), (err) => {
    if (err) return console.error('DB接続エラー:', err.message);
    console.log('データベース接続成功');
    
    // ユーザーテーブル作成
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    // レシピテーブル作成（userIdカラムを追加）
    db.run(`CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipeName TEXT,
        description TEXT,
        steps TEXT,
        image TEXT,
        ingredients TEXT,
        userId INTEGER
    )`, () => {
        // 既存のテーブルに userId がない場合の対応（カラム追加）
        db.run(`ALTER TABLE recipes ADD COLUMN userId INTEGER`, (err) => {
            // エラーが出ても（すでにカラムがある場合など）無視して続行
        });
    });
});

// --- ユーティリティ ---
function getCleanApiKey(keyName) {
    const key = process.env[keyName];
    return key ? key.replace(/[^\x21-\x7E]/g, '') : "";
}

function getProxyAgent() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    return proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;
}

function parseCleanJSON(text) {
    try {
        text = text.replace(/```json/g, '').replace(/```/g, '');
        const match = text.match(/\{[\s\S]*\}/);
        if (match) text = match[0];
        return JSON.parse(text);
    } catch (e) {
        console.error("JSONパース失敗:", text);
        throw e;
    }
}

// --- AI API関連 ---
async function callGeminiTextAPI(ingredients, theme) {
    const apiKey = getCleanApiKey('GEMINI_API_KEY');
    if (!apiKey) throw new Error("GEMINI_API_KEY未設定");

    const promptText = `
    以下の食材とテーマでレシピを考案してください。
    【食材】: ${ingredients.join(', ')}
    【テーマ】: ${theme.genre}, ${theme.mood}
    JSON形式のみ出力: {"recipeName": "", "summary": "", "detail": "", "steps": [""]}
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
            res.on('data', c => data += c);
            res.on('end', () => {
                if(res.statusCode!==200) return reject(new Error("Gemini Error"));
                try {
                    const json = JSON.parse(data);
                    resolve(parseCleanJSON(json.candidates[0].content.parts[0].text));
                } catch(e) { reject(e); }
            });
        });
        req.write(requestData);
        req.end();
    });
}

async function callStabilityImageAPI(prompt) {
    const apiKey = getCleanApiKey('STABILITY_API_KEY');
    if(!apiKey) throw new Error("STABILITY_API_KEY未設定");
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
            if(res.statusCode!==200) return reject(new Error("Stability Error"));
            const fileName = `recipe_${Date.now()}.png`;
            const filePath = path.join(UPLOAD_DIR, fileName);
            const fileStream = fs.createWriteStream(filePath);
            res.pipe(fileStream);
            fileStream.on('finish', () => resolve(`/img/recipes/${fileName}`));
        });
        form.pipe(req);
    });
}

// --- 認証用エンドポイント ---

// ユーザー登録
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "入力が不足しています" });

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function(err) {
        if (err) return res.status(400).json({ error: "ユーザー名が既に使用されています" });
        
        // 登録後そのままログインさせる
        req.session.userId = this.lastID;
        req.session.username = username;
        res.json({ success: true });
    });
});

// ログイン
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: "ユーザー名またはパスワードが違います" });
        }
        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ success: true });
    });
});

// ログアウト
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// 現在のログイン状態確認
app.get('/api/me', (req, res) => {
    if (req.session.userId) {
        res.json({ loggedIn: true, username: req.session.username });
    } else {
        res.json({ loggedIn: false });
    }
});


// --- レシピ関連エンドポイント ---

app.post('/api/generate-recipe', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "ログインしてください" });
    try {
        const data = await callGeminiTextAPI(req.body.ingredients, req.body.theme);
        data.description = `${data.summary} ${data.detail}`;
        res.json(data);
    } catch(e) { res.status(500).json({ error: "生成失敗" }); }
});

app.post('/api/generate-image', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "ログインしてください" });
    try {
        const url = await callStabilityImageAPI(req.body.prompt);
        res.json({ imageUrl: url });
    } catch(e) { res.status(500).json({ imageUrl: '/img/gurumeika-3.jpg' }); }
});

app.post('/api/save-recipe', (req, res) => {
    // ログインチェック
    if (!req.session.userId) return res.status(401).json({ error: "ログインが必要です" });

    let { recipeName, description, steps, image, ingredients } = req.body;
    if (image && image.startsWith('data:image')) {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const fileName = `saved_${Date.now()}.png`;
        fs.writeFileSync(path.join(UPLOAD_DIR, fileName), base64Data, 'base64');
        image = `/img/recipes/${fileName}`;
    }

    const stepsStr = Array.isArray(steps) ? steps.join('\n') : steps;
    const ingStr = JSON.stringify(ingredients || []);
    const userId = req.session.userId; // セッションからID取得

    db.run(`INSERT INTO recipes (recipeName, description, steps, image, ingredients, userId) VALUES (?, ?, ?, ?, ?, ?)`,
        [recipeName, description, stepsStr, image, ingStr, userId], function(err) {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true });
        });
});

// マイレシピ取得（自分のデータだけ）
app.get('/api/my-recipes', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "ログインしてください" });

    db.all(`SELECT * FROM recipes WHERE userId = ? ORDER BY id DESC`, [req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => {
            try { row.ingredients = JSON.parse(row.ingredients); } catch(e) { row.ingredients = []; }
            return row;
        }));
    });
});

// ガチャ（全ユーザーのレシピからランダム ※ここはあえて全公開にするのが一般的ですが、制限したい場合はここも修正可）
app.get('/api/gacha', (req, res) => {
    // ガチャはログイン不要で遊べるようにしています
    db.get(`SELECT * FROM recipes ORDER BY RANDOM() LIMIT 1;`, [], (err, row) => {
        if (err || !row) return res.json(null);
        try { row.ingredients = JSON.parse(row.ingredients); } catch(e){}
        res.json(row);
    });
});

app.listen(PORT, HOST, () => console.log(`http://localhost:${PORT}`));