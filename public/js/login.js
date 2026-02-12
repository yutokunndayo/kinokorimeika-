const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submit-btn');
const toggleBtn = document.getElementById('toggle-mode');
const formTitle = document.getElementById('form-title');

let isLoginMode = true;

toggleBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        formTitle.textContent = 'ログイン';
        submitBtn.textContent = 'ログイン';
        toggleBtn.textContent = 'アカウント作成はこちら';
    } else {
        formTitle.textContent = '新規登録';
        submitBtn.textContent = '登録して開始';
        toggleBtn.textContent = 'ログインに戻る';
    }
});

submitBtn.addEventListener('click', async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!username || !password) {
        alert('ユーザー名とパスワードを入力してください');
        return;
    }

    const endpoint = isLoginMode ? '/api/login' : '/api/register';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();

        if (res.ok) {
            // ログイン成功したらトップへ
            window.location.href = './index.html';
        } else {
            alert(data.error || 'エラーが発生しました');
        }
    } catch (e) {
        alert('通信エラー');
    }
});