document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('auth-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');

    async function handleAuth(url) {
        const username = usernameInput.value;
        const password = passwordInput.value;

        if (!username || !password) {
            alert('ユーザー名とパスワードを入力してください');
            return;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (response.ok) {
                alert('成功しました！');
                window.location.href = 'index.html';
            } else {
                alert(data.error || 'エラーが発生しました');
            }
        } catch (e) {
            console.error(e);
            alert('通信エラー');
        }
    }

    // ログインボタン（フォーム送信）
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAuth('/api/login');
    });

    // 新規登録ボタン
    registerBtn.addEventListener('click', () => {
        handleAuth('/api/register');
    });
});