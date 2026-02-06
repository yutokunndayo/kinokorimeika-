// ガチャのロジック
const drawButton = document.getElementById('draw-button');
const machine = document.querySelector('.machine-illustration');

drawButton.addEventListener('click', async () => {
    // 演出
    machine.classList.add('shake');
    drawButton.disabled = true;
    drawButton.textContent = '回っています...';

    try {
        // サーバーからランダムなレシピを取得
        const response = await fetch('/api/gacha');
        
        if (!response.ok) {
            throw new Error('ガチャの通信に失敗しました');
        }
        
        const recipe = await response.json();

        // 1.5秒待ってから結果画面へ
        setTimeout(() => {
            if (recipe) {
                // クエリパラメータでデータを渡す
                const params = new URLSearchParams({
                    recipeName: recipe.recipeName,
                    description: recipe.description,
                    steps: recipe.steps
                });
                window.location.href = `/amazing-cooking-screen.html?${params.toString()}`;
            } else {
                alert('まだレシピが登録されていません！まずはレシピを作ってみてね。');
                resetButton();
            }
        }, 1500);

    } catch (error) {
        console.error(error);
        alert('エラーが発生しました。もう一度お試しください。');
        resetButton();
    }
});

function resetButton() {
    machine.classList.remove('shake');
    drawButton.disabled = false;
    drawButton.textContent = 'ガチャを回す';
}// public/js/gacha.js (もしファイルがない場合は新規作成または追記)

async function spinGacha() {
    try {
        const response = await fetch('/api/gacha');
        const recipe = await response.json();

        if (!recipe) {
            alert("レシピがまだ登録されていません！");
            return;
        }

        // --- 画像の表示処理 ---
        const recipeImageElement = document.getElementById('gacha-recipe-image');
        if (recipeImageElement) {
            // サーバーから返ってきた imageUrl (Base64データまたはパス) をセット
            recipeImageElement.src = recipe.imageUrl || '/img/gurumeika-3.jpg';
            recipeImageElement.alt = recipe.recipeName;
        }

        // --- 名前の表示処理 ---
        const recipeNameElement = document.getElementById('gacha-recipe-name');
        if (recipeNameElement) {
            recipeNameElement.textContent = recipe.recipeName;
        }

        // その他、材料や説明の表示...
    } catch (error) {
        console.error("ガチャエラー:", error);
    }
}