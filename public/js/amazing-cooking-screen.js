window.addEventListener('load', () => {
    // 【修正】URLパラメータではなく、sessionStorageからデータを取得する
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
    const recipeImageElement = document.getElementById('recipe-image'); // HTMLに<img>がある場合
    const recipeIngredientsElement = document.getElementById('recipe-ingredients'); // HTMLに表示枠がある場合

    // --- データの表示 ---
    if (recipeNameElement) recipeNameElement.textContent = recipe.recipeName;
    if (recipeDescriptionElement) recipeDescriptionElement.textContent = recipe.description;

    // 画像の表示（ファイルパスまたはBase64に対応）
    if (recipeImageElement && recipe.imageUrl) {
        recipeImageElement.src = recipe.imageUrl;
        recipeImageElement.alt = recipe.recipeName;
    }

    // 材料の表示
    if (recipeIngredientsElement && recipe.ingredients) {
        const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
        recipeIngredientsElement.textContent = ingredients.join('、');
    }

    // 調理工程の表示
    if (recipe.steps && recipeStepsElement) {
        let stepsHtml = '<h4>作り方</h4><ul>';
        // データベース保存時に \n で区切られているため split で配列に戻す
        const stepsArray = typeof recipe.steps === 'string' ? recipe.steps.split('\n') : recipe.steps;
        
        stepsArray.forEach((step, index) => {
            if (step.trim()) {
                stepsHtml += `<li><span style="color:#ff6b6b; font-weight:bold;">${index + 1}.</span> ${step}</li>`;
            }
        });
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