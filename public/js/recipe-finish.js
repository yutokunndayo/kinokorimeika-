document.addEventListener('DOMContentLoaded', () => {
    const titleElement = document.getElementById('recipe-title');
    const imageElement = document.getElementById('recipe-image');
    const detailsElement = document.getElementById('recipe-details');
    const shareButton = document.getElementById('share-button');
    const returnButton = document.getElementById('return-button');
    const saveButton = document.getElementById('save-button');

    async function generateAndDisplayRecipe() {
        const ingredientsRaw = JSON.parse(sessionStorage.getItem('ingredients'));
        const theme = JSON.parse(sessionStorage.getItem('theme'));

        if (!ingredientsRaw || !theme) {
            titleElement.textContent = "レシピ情報がありません"; return;
        }
        
        let recipeName, description, steps;

        // レシピ生成API
        try {
            titleElement.textContent = "美味しいレシピを考案中...";
            const recipeResponse = await fetch('/api/generate-recipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingredients: ingredientsRaw, theme: theme }),
            });
            if (!recipeResponse.ok) throw new Error('APIエラー');
            const recipeApiData = await recipeResponse.json();
            recipeName = recipeApiData.recipeName;
            description = recipeApiData.description;
            steps = recipeApiData.steps; 
            titleElement.textContent = recipeName;
        } catch (error) {
            console.error(error);
            titleElement.textContent = "まかない飯（生成エラー）";
            recipeName = "名無しのまかない飯";
            description = "エラーが発生しました。とりあえず炒めればOK！";
            steps = ["適当に切る", "火を通す", "味を整える"];
        }

        // 画像生成API
        try {
            imageElement.src = ""; imageElement.alt = "生成中...";
            const ingredientNames = ingredientsRaw.map(i => i.split('(')[0]);
            const imagePrompt = `(best quality, food photography:1.3), Delicious dish "${recipeName}". Ingredients: ${ingredientNames.join(', ')}. Style: ${theme.genre}. Method: ${theme.method}.`;
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: imagePrompt }),
            });
            if (!response.ok) throw new Error(`画像APIエラー`);
            const data = await response.json();
            if (data.imageUrl) imageElement.src = data.imageUrl;
        } catch (error) {
            console.error(error);
            imageElement.src = '/img/1402858_s.jpg';
        }

        // 表示処理
        let detailsHtml = `<p style="margin-bottom:15px; font-weight:bold;">${description}</p>`;
        detailsHtml += '<h4>作り方</h4><ul>';
        steps.forEach((step, index) => { detailsHtml += `<li><span style="color:#ff6b6b; font-weight:bold;">${index + 1}.</span> ${step}</li>`; });
        detailsHtml += '</ul>';
        detailsElement.innerHTML = detailsHtml;

        // ボタンイベント
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
                    alert('登録されました！');
                    saveButton.disabled = true; saveButton.textContent = '登録済み';
                }
            } catch (err) { alert('保存エラー'); }
        });
        
        shareButton.addEventListener('click', () => {
            const shareText = `余り物が大変身！「${recipeName}」\n#キノコリメイカー`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
        });

        returnButton.addEventListener('click', () => { window.location.href = './index.html'; });

        // 星評価
        const stars = document.querySelectorAll('#rating-stars .star');
        let currentRating = 1;
        function setRating(rating) { stars.forEach(star => star.classList.toggle('selected', parseInt(star.dataset.value) <= rating)); }
        function setHover(rating) { stars.forEach(star => star.classList.toggle('hover', parseInt(star.dataset.value) <= rating)); }
        stars.forEach(star => {
            star.addEventListener('mouseover', () => setHover(parseInt(star.dataset.value)));
            star.addEventListener('click', () => { currentRating = parseInt(star.dataset.value); setRating(currentRating); });
        });
        document.getElementById('rating-stars').addEventListener('mouseout', () => setHover(currentRating));
        setRating(currentRating);
    }
    generateAndDisplayRecipe();
});