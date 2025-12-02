// DOMの読み込みが完了してから処理を実行する
document.addEventListener('DOMContentLoaded', () => {
    // ボタンの要素を取得
    const createRecipeButton = document.getElementById('btn-1');
    const gachaButton = document.getElementById('btn-2');

    // 「1, 余り物をリメイク」ボタンがクリックされた時の処理
    if (createRecipeButton) {
        createRecipeButton.addEventListener('click', () => {
            // 材料入力画面へ移動
            window.location.href = '/material-input.html';
        });
    } else {
        console.error('エラー: id="btn-1" のボタンが見つかりません');
    }

    // 「2, レシピガチャ」ボタンがクリックされた時の処理
    if (gachaButton) {
        gachaButton.addEventListener('click', () => {
            // ガチャ画面へ移動
            window.location.href = '/gacha.html';
        });
    } else {
        console.error('エラー: id="btn-2" のボタンが見つかりません');
    }
});