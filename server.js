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

const db = new sqlite3.Database(path.join(__dirname, 'yaminabe.db'), (err) => {
    if (err) return console.error('DB接続エラー:', err.message);
    console.log('DB接続成功');
});

// --- ヘルパー関数 ---
function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ★ 実用的なレシピ名を生成するロジック
function generatePracticalRecipeName(ingredientsList, theme) {
    const mainIng = ingredientsList[0].split('(')[0]; // "豚肉"だけ抽出
    const subIng = ingredientsList[1] ? ingredientsList[1].split('(')[0] : '';
    
    const { method, genre, mood } = theme;

    let suffix = '料理';
    if (method === '炒める') suffix = '炒め';
    if (method === '煮る') suffix = '煮';
    if (method === '焼く') suffix = '焼き';
    if (method === '蒸す') suffix = '蒸し';
    if (method === '揚げる') suffix = '揚げ';
    if (method === '和える') suffix = '和え';
    if (method === 'レンチン') suffix = 'レンジ蒸し';

    // ジャンルごとの修飾語
    let genrePrefix = '';
    if (genre === '中華') genrePrefix = getRandomElement(['中華風', 'ピリ辛', 'オイスター', 'ごま油香る']);
    if (genre === '洋風') genrePrefix = getRandomElement(['洋風', 'ガーリック', 'バター醤油', 'ハーブ香る']);
    if (genre === '和風') genrePrefix = getRandomElement(['和風', '甘辛', 'だし香る', 'さっぱり']);
    if (genre === 'エスニック') genrePrefix = getRandomElement(['エスニック風', 'カレー風味', 'スパイシー']);
    if (genre === '韓国風') genrePrefix = getRandomElement(['韓国風', '旨辛', 'コチュジャン']);
    if (genre === 'イタリアン') genrePrefix = getRandomElement(['イタリアン', 'トマト風味', 'チーズ']);

    // 気分による修飾
    let moodPrefix = '';
    if (mood === 'ガッツリ') moodPrefix = 'ご飯が進む！';
    if (mood === 'さっぱり') moodPrefix = '無限に食べられる！';
    if (mood === 'ヘルシー') moodPrefix = '罪悪感なし！';
    if (mood === '時短') moodPrefix = '5分で完成！';
    if (mood === 'ピリ辛') moodPrefix = 'やみつき！';
    if (mood === '濃厚') moodPrefix = 'リッチな味わい！';
    if (mood === 'おつまみ') moodPrefix = 'ビールに合う！';

    // 名前を組み立て
    const baseName = subIng ? `${mainIng}と${subIng}の${genrePrefix}${suffix}` : `${mainIng}の${genrePrefix}${suffix}`;
    
    return {
        name: baseName,
        catchCopy: moodPrefix
    };
}

// ★ 実用的な調理工程を生成するロジック（ルールベース）
function generatePracticalSteps(ingredientsList, theme) {
    const { method, genre } = theme;
    const steps = [];
    
    // 材料名の整形
    const ingNames = ingredientsList.map(i => i.split('(')[0]);

    // 1. 下準備
    steps.push(`【下準備】${ingNames.join('、')}を食べやすい大きさに切ります。`);

    // 味付けの提案
    let seasoning = '塩コショウ';
    if (genre === '和風') seasoning = '醤油、みりん、酒、だしの素';
    if (genre === '洋風') seasoning = 'コンソメ、塩コショウ、バター';
    if (genre === '中華') seasoning = '鶏ガラスープの素、オイスターソース、ごま油';
    if (genre === 'エスニック') seasoning = 'ナンプラー、レモン汁、砂糖、唐辛子';
    if (genre === '韓国風') seasoning = 'コチュジャン、醤油、砂糖、ごま油';
    if (genre === 'イタリアン') seasoning = 'オリーブオイル、塩、ニンニク、粉チーズ';

    // 2. 調理プロセス
    if (method === '炒める') {
        steps.push(`フライパンに油を熱し、火の通りにくい食材から順に中火で炒めます。`);
        steps.push(`全体に火が通ったら、${seasoning}を加えて強火でサッと炒め合わせます。`);
    } else if (method === '煮る') {
        steps.push(`鍋に食材と、具材が浸るくらいの水、${seasoning}を入れます。`);
        steps.push(`落とし蓋をして、食材が柔らかくなるまで弱火〜中火で10分ほどコトコト煮込みます。`);
    } else if (method === '焼く') {
        steps.push(`フライパンまたはトースターで、食材に焼き色がつくまでじっくり焼きます。`);
        steps.push(`仕上げに${seasoning}を回しかけ、香ばしい香りが立つまで焼きます。`);
    } else if (method === 'レンチン') {
        steps.push(`耐熱容器に食材を入れ、ふんわりとラップをかけます。`);
        steps.push(`電子レンジ(600W)で3〜5分加熱します。熱いうちに${seasoning}を加えてよく混ぜ合わせます。`);
    } else if (method === '揚げる') {
        steps.push(`食材の水気を拭き取り、薄く衣（片栗粉など）をまぶします。`);
        steps.push(`170度の油でカリッとなるまで揚げ、熱いうちに${seasoning}（または塩）を振ります。`);
    } else {
        steps.push(`食材を${method}調理します。`);
        steps.push(`${seasoning}で味を調えます。`);
    }

    // 3. 仕上げ
    steps.push(`お皿に盛り付けて完成です！お好みでネギやパセリ、ゴマを散らしてください。`);
    return steps;
}

// --- APIエンドポイント ---

// 画像生成API (Stability AI・SDK不要版)
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'プロンプトが必要です。' });
    console.log('Stability AIへのプロンプト:', prompt);

    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
        console.error('Stability AI APIキーが.envファイルに設定されていません。');
        return res.status(500).json({ imageUrl: '/img/1402858_s.jpg' });
    }

    try {
        console.log('Stability AI APIに画像生成をリクエストします...');
        const form = new FormData();
        form.append('prompt', prompt);
        form.append('output_format', 'png');
        const model = 'stable-diffusion-3-medium'; 

        const request = https.request({
            hostname: 'api.stability.ai',
            path: `/v2beta/stable-image/generate/core`,
            method: 'POST',
            headers: { ...form.getHeaders(), 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' }
        });

        form.pipe(request);

        let responseData = [];
        request.on('response', (response) => {
            if (response.statusCode === 200) {
                response.on('data', (chunk) => responseData.push(chunk));
                response.on('end', () => {
                    console.log('画像の生成に成功しました。');
                    const buffer = Buffer.concat(responseData);
                    const imageUrl = `data:image/png;base64,${buffer.toString('base64')}`;
                    res.json({ imageUrl });
                });
            } else {
                 console.error(`Stability AI APIエラー: Status Code ${response.statusCode}`);
                 res.status(500).json({ imageUrl: '/img/1402858_s.jpg' });
            }
        });
        request.on('error', (error) => {
            console.error('Stability AI APIでリクエストエラーが発生しました:', error);
            res.status(500).json({ imageUrl: '/img/1402858_s.jpg' });
        });
    } catch (error) {
        console.error('サーバー内部でエラーが発生しました:', error);
        res.status(500).json({ imageUrl: '/img/1402858_s.jpg' });
    }
});

// レシピ生成API (リニューアル)
app.post('/api/generate-recipe', (req, res) => {
    try {
        const { ingredients, theme } = req.body; 
        if (!ingredients || !theme) return res.status(400).json({ error: 'データ不足' });
        
        // 実用的な名前と工程を生成
        const nameData = generatePracticalRecipeName(ingredients, theme);
        const recipeName = nameData.name;
        const description = `${nameData.catchCopy} ${ingredients.join('、')}を使った、${theme.mood}な${theme.genre}レシピです。`;
        const steps = generatePracticalSteps(ingredients, theme);

        res.json({ recipeName, description, steps });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '生成失敗' });
    }
});

// ガチャ・保存API (そのまま維持)
app.get('/api/gacha', (req, res) => {
    const sql = `SELECT * FROM recipes ORDER BY RANDOM() LIMIT 1;`;
    db.get(sql, [], (err, row) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        res.json(row);
    });
});
app.post('/api/save-recipe', (req, res) => {
    const { recipeName, description, steps } = req.body;
    if (!recipeName || !description || !steps) return res.status(400).json({ success: false });
    const stepsString = Array.isArray(steps) ? steps.join('\n') : steps;
    const sql = `INSERT INTO recipes (recipeName, description, steps) VALUES (?, ?, ?)`;
    db.run(sql, [recipeName, description, stepsString], function(err) {
        if (err) { res.status(500).json({ success: false }); return; }
        res.json({ success: true, id: this.lastID });
    });
});

app.listen(PORT, HOST, () => {
    // 0.0.0.0 ではなく localhost と表示するように変更
    console.log(`--------------------------------------------------`);
    console.log(`サーバーが起動しました！以下のURLをクリックしてください:`);
    console.log(`http://localhost:${PORT}`);
    console.log(`--------------------------------------------------`);
});