document.addEventListener('DOMContentLoaded', () => {
    const titleElement = document.getElementById('recipe-title');
    const imageElement = document.getElementById('recipe-image');
    const detailsElement = document.getElementById('recipe-details');
    const saveButton = document.getElementById('save-button');
    const shareButton = document.getElementById('share-button');
    const returnButton = document.getElementById('return-button');

    let recipeDataGlobal = null;

    async function generateAndDisplayRecipe() {
        const ingredientsRaw = JSON.parse(sessionStorage.getItem('ingredients'));
        const theme = JSON.parse(sessionStorage.getItem('theme'));

        if (!ingredientsRaw || !theme) {
            titleElement.textContent = "レシピ情報がありません"; 
            return;
        }
        
        try {
            titleElement.textContent = "美味しいレシピを考案中...";
            
            // 1. テキスト生成
            const recipeResponse = await fetch('/api/generate-recipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingredients: ingredientsRaw, theme: theme }),
            });
            const recipeApiData = await recipeResponse.json();
            
            recipeDataGlobal = recipeApiData;
            titleElement.textContent = recipeApiData.recipeName;

            // 2. 画像生成
            imageElement.alt = "画像を生成中...";
            const imageResponse = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: `Professional food photography of ${recipeApiData.recipeName}` }),
            });
            const imageData = await imageResponse.json();
            imageElement.src = imageData.imageUrl;

            // 3. 画面表示
            renderDetails(recipeApiData);

        } catch (error) {
            console.error(error);
            titleElement.textContent = "生成エラーが発生しました";
        }
    }

    function renderDetails(data) {
        let html = `
            <div class="summary-box"><p><strong>${data.summary}</strong></p></div>
            <div class="detail-text"><p>${data.detail}</p></div>
            <h4>作り方</h4><ul>
        `;
        data.steps.forEach((step, i) => {
            html += `<li><span style="color:#ff6b6b; font-weight:bold;">${i + 1}.</span> ${step}</li>`;
        });
        html += '</ul>';
        detailsElement.innerHTML = html;
    }

    // 保存処理
    saveButton.addEventListener('click', async () => {
        if (!recipeDataGlobal) return;

        const body = {
            recipeName: recipeDataGlobal.recipeName,
            description: recipeDataGlobal.description,
            steps: recipeDataGlobal.steps,
            image: imageElement.src, // サーバー側でパスに変換される
            ingredients: JSON.parse(sessionStorage.getItem('ingredients'))
        };

        try {
            const res = await fetch('/api/save-recipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const result = await res.json();
            if (result.success) {
                alert('登録されました！');
                saveButton.disabled = true;
                saveButton.textContent = '登録済み';
            }
        } catch (e) {
            alert('保存に失敗しました');
        }
    });

    returnButton.addEventListener('click', () => { location.href = './index.html'; });
    
    shareButton.addEventListener('click', () => {
        const text = `新レシピ「${titleElement.textContent}」を開発！\n#グルメメイカー`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    });

    generateAndDisplayRecipe();
});