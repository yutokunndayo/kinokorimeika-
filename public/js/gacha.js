const drawButton = document.getElementById('draw-button');
const machine = document.querySelector('.machine-illustration');

if (drawButton) {
    drawButton.addEventListener('click', async () => {
        // 演出開始
        if (machine) machine.classList.add('shake');
        drawButton.disabled = true;
        drawButton.textContent = 'ガチャを回しています...';

        try {
            const response = await fetch('/api/gacha');
            
            if (!response.ok) throw new Error('サーバーエラー');
            
            const recipe = await response.json();

            // 1.5秒の演出待ち
            setTimeout(() => {
                if (recipe) {
                    // 【重要】画像パスなどのデータをsessionStorageに保存
                    sessionStorage.setItem('gacha_result', JSON.stringify(recipe));
                    
                    // 結果画面へ遷移
                    window.location.href = './amazing-cooking-screen.html';
                } else {
                    alert('まだレシピが登録されていません！まずはレシピを作ってみてね。');
                    resetButton();
                }
            }, 1500);

        } catch (error) {
            console.error("ガチャ失敗:", error);
            alert('通信エラーが発生しました。しばらく待ってからやり直してください。');
            resetButton();
        }
    });
}

function resetButton() {
    if (machine) machine.classList.remove('shake');
    drawButton.disabled = false;
    drawButton.textContent = 'ガチャを回す';
}