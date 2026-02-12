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
        
        // データを格納する変数
        let recipeName, summary, detail, fullDescription, steps;

        // --- レシピ生成 ---
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
            summary = recipeApiData.summary; // キャッチコピー
            detail = recipeApiData.detail;   // 詳細解説
            fullDescription = recipeApiData.description; // 結合テキスト
            steps = recipeApiData.steps; 
            
            titleElement.textContent = recipeName;
        } catch (error) {
            console.error(error);
            titleElement.textContent = "生成エラー";
            recipeName = "名無しのまかない飯";
            summary = "生成失敗";
            detail = "エラーが発生しました。";
            fullDescription = summary + detail;
            steps = ["適当に切る", "火を通す"];
        }

        // --- 画像生成 ---
        try {
            imageElement.src = ""; imageElement.alt = "生成中...";
            const ingredientNames = ingredientsRaw.map(i => i.split('(')[0]);
            const imagePrompt = `(best quality, food photography:1.3), Delicious dish "${recipeName}". Ingredients: ${ingredientNames.join(', ')}. Style: ${theme.genre}.`;
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: imagePrompt }),
            });
            const data = await response.json();
            if (data.imageUrl) imageElement.src = data.imageUrl;
        } catch (error) {
            imageElement.src = '/img/gurumeika-3.jpg';
        }

        // --- 表示処理 ---
        let detailsHtml = `
            <div class="summary-box">
                <p class="summary-text"><strong>${summary || ''}</strong></p>
            </div>
            <div class="detail-container">
                <p class="detail-text">${detail || ''}</p>
            </div>
        `;

        detailsHtml += '<h4>作り方</h4><ul>';
        if(steps && Array.isArray(steps)){
            steps.forEach((step, index) => { detailsHtml += `<li><span style="color:#ff6b6b; font-weight:bold;">${index + 1}.</span> ${step}</li>`; });
        }
        detailsHtml += '</ul>';
        detailsElement.innerHTML = detailsHtml;

        // --- 保存処理 (修正版) ---
        saveButton.addEventListener('click', async () => {
            const recipeToSave = { 
                recipeName, 
                summary,    // ★追加
                detail,     // ★追加
                description: fullDescription, 
                steps,
                image: imageElement.src,
                ingredients: ingredientsRaw
            };
            
            try {
                const saveResponse = await fetch('/api/save-recipe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(recipeToSave),
                });

                if (saveResponse.status === 401) {
                    alert('保存するにはログインが必要です！');
                    if(confirm('ログイン画面へ移動しますか？')) {
                         // 現在のデータを保持したい場合、localStorage等に一時保存する工夫が必要ですが今回は省略
                         window.open('login.html', '_blank'); 
                    }
                    return;
                }

                const result = await saveResponse.json();
                if (result.success) {
                    alert('図鑑に登録されました！');
                    saveButton.disabled = true; saveButton.textContent = '登録済み';
                }
            } catch (err) { 
                console.error(err);
                alert('保存エラー: 画像サイズが大きすぎる可能性があります'); 
            }
        });
        
        // シェアボタン
        shareButton.addEventListener('click', () => {
            const shareText = `「${recipeName}」\n${summary}\n#グルメメイカー`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
        });

        returnButton.addEventListener('click', () => { window.location.href = './index.html'; });
    }
    generateAndDisplayRecipe();
});