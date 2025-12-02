document.addEventListener('DOMContentLoaded', () => {
    const createRecipeButton = document.getElementById('btn-1');
    const gachaButton = document.getElementById('btn-2');

    console.log("title.js読み込み完了"); // デバッグ用

    if (createRecipeButton) {
        createRecipeButton.addEventListener('click', () => {
            console.log("ボタン1クリック"); // デバッグ用
            window.location.href = '';
        });
    } else {
        console.error('エラー: btn-1 が見つかりません');
    }

    if (gachaButton) {
        gachaButton.addEventListener('click', () => {
            console.log("ボタン2クリック"); // デバッグ用
            window.location.href = '/gacha.html';
        });
    } else {
        console.error('エラー: btn-2 が見つかりません');
    }

});
document.addEventListener('DOMContentLoaded', () => {
    const createRecipeButton = document.getElementById('btn-1');
    const gachaButton = document.getElementById('btn-2');
    if (createRecipeButton) {
        createRecipeButton.addEventListener('click', () => {
            window.location.href = './material-input.html';
        });
    }
    if (gachaButton) {
        gachaButton.addEventListener('click', () => {
            window.location.href = './gacha.html';
        });
    }
});