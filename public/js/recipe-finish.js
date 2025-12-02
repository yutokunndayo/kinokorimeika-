document.addEventListener('DOMContentLoaded', () => {
    const titleElement = document.getElementById('recipe-title');
    const imageElement = document.getElementById('recipe-image');
    const detailsElement = document.getElementById('recipe-details');
    const shareButton = document.getElementById('share-button');
    const returnButton = document.getElementById('return-button');
    const saveButton = document.getElementById('save-button');

    async function generateAndDisplayRecipe() {
        
        // スロット画面からのデータを取得 (キー名を変更しているため注意)
        const ingredientsRaw = JSON.parse(sessionStorage.getItem('ingredients')); // ["豚肉(100g)", ...]
        const theme = JSON.parse(sessionStorage.getItem('theme')); // { method:..., genre:..., mood:... }

        if (!ingredientsRaw || !theme) {
            titleElement.textContent = "レシピ情報がありません";
            return;
        }
        
        let recipeName, description, steps;

        // サーバーAPI呼び出し
        try {
            titleElement.textContent = "美味しいレシピを考案中...";
            const recipeResponse = await fetch('/api/generate-recipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ingredients: ingredientsRaw,
                    theme: theme
                }),
            });
            
            if (!recipeResponse.ok) throw new Error('レシピ生成APIエラー');
            
            const recipeApiData = await recipeResponse.json();
            recipeName = recipeApiData.recipeName;
            description = recipeApiData.description;
            steps = recipeApiData.steps; 
            
            titleElement.textContent = recipeName;

        } catch (error) {
            console.error(error);
            titleElement.textContent = "レシピ生成エラー";
            recipeName = "名無しのまかない飯";
            description = "エラーが発生しましたが、とりあえず炒めればなんとかなります。";
            steps = ["適当に切る", "適当に炒める", "塩コショウで味を整える"];
        }

        // 画像生成API呼び出し
        try {
            imageElement.src = ""; 
            imageElement.alt = "画像を生成中...";
            
            // 食材名だけ抽出
            const ingredientNames = ingredientsRaw.map(i => i.split('(')[0]);
            const imagePrompt = generateDeliciousImagePrompt(recipeName, ingredientNames, theme.genre, theme.method); 
            
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: imagePrompt }),
            });

            if (!response.ok) throw new Error(`画像生成APIエラー: ${response.status}`);
            const data = await response.json();
            if (data.imageUrl) {
                imageElement.src = data.imageUrl;
                imageElement.alt = recipeName;
            }
        } catch (error) {
            console.error(error);
            imageElement.src = '/img/1402858_s.jpg';
            imageElement.alt = '画像生成失敗';
        }

        // 詳細表示
        let detailsHtml = `<p style="margin-bottom:15px; font-weight:bold;">${description}</p>`;
        detailsHtml += '<h4>作り方</h4><ul>';
        steps.forEach((step, index) => {
            detailsHtml += `<li><span style="color:#00ffff; font-weight:bold;">${index + 1}.</span> ${step}</li>`;
        });
        detailsHtml += '</ul>';
        detailsElement.innerHTML = detailsHtml;

        // 保存ボタン
        saveButton.addEventListener('click', async () => {
            const recipeToSave = { recipeName, description, steps };
            try {
                const saveResponse = await fetch('/api/save-recipe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(recipeToSave),
                });
                const result = await saveResponse.json();
                if (result.success) {
                    alert('みんなの救世主としてガチャに登録されました！');
                    saveButton.disabled = true;
                    saveButton.textContent = '登録済み';
                } else { throw new Error('保存失敗'); }
            } catch (err) { alert('保存できませんでした'); }
        });
        
        // 共有ボタン
        shareButton.addEventListener('click', () => {
            const shareText = `余り物が大変身！「${recipeName}」\n#冷蔵庫の救世主 #グルメイカー`;
            const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
            window.open(shareUrl, '_blank');
        });

        returnButton.addEventListener('click', () => {
            window.location.href = '/index.html';
        });

        // 星評価ロジック（既存のまま）
        const stars = document.querySelectorAll('#rating-stars .star');
        let currentRating = 1;
        function setRating(rating) {
            stars.forEach(star => star.classList.toggle('selected', parseInt(star.dataset.value) <= rating));
        }
        function setHover(rating) {
            stars.forEach(star => star.classList.toggle('hover', parseInt(star.dataset.value) <= rating));
        }
        stars.forEach(star => {
            star.addEventListener('mouseover', () => setHover(parseInt(star.dataset.value)));
            star.addEventListener('click', () => {
                currentRating = parseInt(star.dataset.value);
                setRating(currentRating);
            });
        });
        document.getElementById('rating-stars').addEventListener('mouseout', () => setHover(currentRating));
        setRating(currentRating);
        setHover(currentRating);
    }

    generateAndDisplayRecipe();
});

// --- 画像プロンプト生成関数（美味しそうに変更） ---
function generateDeliciousImagePrompt(recipeName, ingredients, genre, method) {
    return `
        (best quality, masterpiece, food photography:1.3),
        Delicious looking dish "${recipeName}".
        Main ingredients: ${ingredients.join(', ')}.
        Cuisine style: ${genre}. Cooking method: ${method}.
        (steam rising:1.2), (glistening sauce:1.1), fresh ingredients,
        warm lighting, soft focus background, restaurant quality,
        4k, highly detailed, appetizing, mouth-watering.
    `;
}