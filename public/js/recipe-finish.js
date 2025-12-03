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
        
        let recipeName, summary, detail, fullDescription, steps;

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
            summary = recipeApiData.summary || "要約なし";
            detail = recipeApiData.detail || recipeApiData.description;
            fullDescription = recipeApiData.description || (summary + "\n" + detail);
            steps = recipeApiData.steps; 
            
            titleElement.textContent = recipeName;
        } catch (error) {
            console.error(error);
            titleElement.textContent = "まかない飯（生成エラー）";
            recipeName = "名無しのまかない飯";
            summary = "エラーが発生しました。";
            detail = "とりあえず炒めればOK！";
            fullDescription = summary + detail;
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

        // --- 表示処理 ---
        // 解説文コンテナ（初期状態はJSでクラス操作するため hidden クラスはHTMLには直接書かずCSSで制御）
        let detailsHtml = `
            <div class="summary-box">
                <p class="summary-text"><strong>${summary}</strong></p>
            </div>
            
            <div class="detail-container">
                <button id="toggle-detail-btn" class="toggle-btn">詳しい解説を見る ▼</button>
                <div id="detail-content" class="detail-content">
                    <p class="detail-text">${detail}</p>
                </div>
            </div>
        `;

        detailsHtml += '<h4>作り方</h4><ul>';
        steps.forEach((step, index) => { detailsHtml += `<li><span style="color:#ff6b6b; font-weight:bold;">${index + 1}.</span> ${step}</li>`; });
        detailsHtml += '</ul>';
        detailsElement.innerHTML = detailsHtml;

        // --- ボタンのクリックイベント（高さを動的に計算） ---
        const toggleBtn = document.getElementById('toggle-detail-btn');
        const detailContent = document.getElementById('detail-content');
        
        if(toggleBtn && detailContent) {
            toggleBtn.addEventListener('click', () => {
                const isOpen = detailContent.classList.contains('open');
                
                if (isOpen) {
                    // 閉じる処理
                    detailContent.style.maxHeight = null; // nullにするとCSSの0に戻る
                    detailContent.classList.remove('open');
                    toggleBtn.textContent = '詳しい解説を見る ▼';
                    toggleBtn.classList.remove('open');
                } else {
                    // 開く処理
                    detailContent.classList.add('open');
                    // コンテンツの実際の高さを取得してmax-heightに設定
                    detailContent.style.maxHeight = detailContent.scrollHeight + "px";
                    toggleBtn.textContent = '解説を閉じる ▲';
                    toggleBtn.classList.add('open');
                }
            });
        }
        // ------------------------

        // 保存ボタン
        saveButton.addEventListener('click', async () => {
            const recipeToSave = { recipeName, description: fullDescription, steps };
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