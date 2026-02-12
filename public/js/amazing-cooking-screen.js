window.addEventListener('load', () => {
    // sessionStorageからデータを取得
    const recipeData = sessionStorage.getItem('gacha_result');
    
    if (!recipeData) {
        alert("レシピ情報が見つかりませんでした。");
        window.location.href = './index.html';
        return;
    }

    const recipe = JSON.parse(recipeData);

    const recipeNameElement = document.getElementById('recipe-name');
    const recipeDescriptionElement = document.getElementById('recipe-description');
    const recipeStepsElement = document.getElementById('recipe-steps');
    const recipeImageElement = document.getElementById('recipe-image');
    const recipeIngredientsElement = document.getElementById('recipe-ingredients');

    // --- データの表示 ---
    if (recipeNameElement) recipeNameElement.textContent = recipe.recipeName;
    if (recipeDescriptionElement) recipeDescriptionElement.textContent = recipe.description;

    // 画像の表示（サーバーから返ってきたパスを使用）
    // recipe.imageUrl が優先、なければ recipe.image を使用
    const imagePath = recipe.imageUrl || recipe.image;
    if (recipeImageElement && imagePath) {
        recipeImageElement.src = imagePath;
        recipeImageElement.alt = recipe.recipeName;
    }

    // 材料の表示
    if (recipeIngredientsElement) {
        const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : ["不明"];
        recipeIngredientsElement.textContent = ingredients.join('、');
    }

    // 調理工程の表示
    if (recipe.steps && recipeStepsElement) {
        let stepsHtml = '<h4>作り方</h4><ul>';
        // データベース保存時に \n で区切られているため配列に戻す
        const stepsArray = typeof recipe.steps === 'string' ? recipe.steps.split('\n') : recipe.steps;
        
        if (Array.isArray(stepsArray)) {
            stepsArray.forEach((step, index) => {
                if (step && step.trim()) {
                    stepsHtml += `<li><span style="color:#ff6b6b; font-weight:bold;">${index + 1}.</span> ${step}</li>`;
                }
            });
        }
        stepsHtml += '</ul>';
        recipeStepsElement.innerHTML = stepsHtml;
    }

    // シェアボタン
    const shareButton = document.getElementById('share-button');
    if (shareButton) {
        shareButton.addEventListener('click', () => {
            const shareText = `ガチャで「${recipe.recipeName}」を引きました！\n#グルメメイカー #レシピガチャ`;
            const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
            window.open(shareUrl, '_blank');
        });
    }

    // 戻るボタン
    const returnButton = document.getElementById('return-button');
    if (returnButton) {
        returnButton.addEventListener('click', () => {
            window.location.href = './index.html';
        });
    }
});