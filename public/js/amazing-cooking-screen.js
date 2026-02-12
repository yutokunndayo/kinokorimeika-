window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    
    let recipeData = null;

    if (mode === 'gacha') {
        // ガチャ経由：SessionStorageから取得
        const stored = sessionStorage.getItem('gachaResult');
        if (stored) recipeData = JSON.parse(stored);
    } else {
        // 従来のURLパラメータ方式（バックアップ）
        recipeData = {
            recipeName: params.get('recipeName'),
            description: params.get('description'),
            steps: params.get('steps') ? params.get('steps').split('\n') : []
        };
    }

    if (!recipeData) return;

    const recipeNameElement = document.getElementById('recipe-name');
    const recipeDescriptionElement = document.getElementById('recipe-description');
    const recipeStepsElement = document.getElementById('recipe-steps');
    const recipeImageElement = document.getElementById('recipe-image'); // HTMLに画像要素がある場合

    if (recipeNameElement) recipeNameElement.textContent = recipeData.recipeName;
    
    // 詳細解説があれば優先表示
    const displayText = recipeData.detail || recipeData.description || recipeData.summary;
    if (recipeDescriptionElement) recipeDescriptionElement.textContent = displayText;

    // 画像表示（IDがrecipe-imageのimgタグが必要）
    if (recipeImageElement && (recipeData.image || recipeData.imageUrl)) {
        recipeImageElement.src = recipeData.image || recipeData.imageUrl;
    }

    // 手順表示
    if (recipeStepsElement && recipeData.steps) {
        let stepsHtml = '<h4>作り方</h4><ul>';
        const stepsArray = Array.isArray(recipeData.steps) 
            ? recipeData.steps 
            : (typeof recipeData.steps === 'string' ? recipeData.steps.split('\n') : []);

        stepsArray.forEach(step => {
            if (step) stepsHtml += `<li>${step}</li>`;
        });
        stepsHtml += '</ul>';
        recipeStepsElement.innerHTML = stepsHtml;
    }

    // シェアボタン
    const shareBtn = document.getElementById('share-button');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const shareText = `ガチャで「${recipeData.recipeName}」を引きました！\n#キノコリメイカー #レシピガチャ`;
            const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
            window.open(shareUrl, '_blank');
        });
    }

    // 戻るボタン
    const returnBtn = document.getElementById('return-button');
    if (returnBtn) {
        returnBtn.addEventListener('click', () => {
            window.location.href = '/index.html';
        });
    }
});