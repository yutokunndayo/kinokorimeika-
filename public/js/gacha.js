const drawButton = document.getElementById('draw-button');
const machine = document.querySelector('.machine-illustration');

drawButton.addEventListener('click', async () => {
    machine.classList.add('shake');
    drawButton.disabled = true;
    drawButton.textContent = '回っています...';

    try {
        const response = await fetch('/api/gacha');
        const recipe = await response.json();

        setTimeout(() => {
            if (recipe) {
                // ★修正: データをSessionStorageに保存
                sessionStorage.setItem('gachaResult', JSON.stringify(recipe));
                // URLパラメータはモード指定のみにする
                window.location.href = '/amazing-cooking-screen.html?mode=gacha';
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
}