window.addEventListener('load', () => {
    // URLパラメータからデータを取得
    const params = new URLSearchParams(window.location.search);
    const recipeName = params.get('recipeName');
    const description = params.get('description');
    const steps = params.get('steps');

    const recipeNameElement = document.getElementById('recipe-name');
    const recipeDescriptionElement = document.getElementById('recipe-description');
    const recipeStepsElement = document.getElementById('recipe-steps');

    if (recipeName) recipeNameElement.textContent = recipeName;
    if (description) recipeDescriptionElement.textContent = description;

    // 調理工程の表示
    if (steps && recipeStepsElement) {
        let stepsHtml = '<h4>作り方</h4><ul>';
        steps.split('\n').forEach(step => {
            if (step) stepsHtml += `<li>${step}</li>`;
        });
        stepsHtml += '</ul>';
        recipeStepsElement.innerHTML = stepsHtml;
    }

    // シェアボタン
    document.getElementById('share-button').addEventListener('click', () => {
        const shareText = `ガチャで「${recipeName}」を引きました！\n#キノコリメイカー #レシピガチャ`;
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
        window.open(shareUrl, '_blank');
    });

    // 戻るボタン
    document.getElementById('return-button').addEventListener('click', () => {
        window.location.href = '/index.html';
    });
});