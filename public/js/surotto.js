window.addEventListener('DOMContentLoaded', () => {
    const clickSound = new Audio('/sound/bow-arrow-hit.mp3');
    const spinStartSound = new Audio('/sound/ziyagura-reba.mp3');
    const stopSound = new Audio('/sound/bow-arrow-hit.mp3');
    const gogoSound = new Audio('/sound/ziyagura-gako.mp3');
    function playSound(audio) { audio.currentTime = 0; audio.play().catch(e=>{}); }

    const startScreen = document.getElementById('start-screen');
    const mainSlotScreen = document.getElementById('main-slot-screen');
    const screens = document.querySelectorAll('.screen');
    const cookingStartButton = document.getElementById('cooking-start-button');
    const startButton = document.getElementById('start-button');
    const stopButtons = document.querySelectorAll('.stop-button');
    const nextButton = document.getElementById('next-button');
    const ingredientList = document.getElementById('ingredient-list');
    const reelStrips = document.querySelectorAll('.reel-strip');
    const reels = document.querySelectorAll('.reel');
    const gogoLamp = document.querySelector('.gogo-lamp');
    const resultDisplay = document.getElementById('result-display');
    const resultText = document.getElementById('result-text');

    let ingredients = [];

    // ★★★ リールの中身（実験テーマ） ★★★
    
    // Reel A: ジャンル (場所・スタイル)
    const genres = ['錯覚フレンチ', '実験中華', '未来食', 'フェイクフード', '融合料理', '再現料理'];

    // Reel B: 調理法 (科学的なアプローチ)
    const methods = ['分子調理', '低温調理', '燻製', 'キャラメリゼ', '発酵', '乳化', '抽出'];
    
    // Reel C: 気分 (チャレンジ精神)
    const moods = ['脳がバグる味', '見た目とのギャップ', '高級食材風', '化学反応', '未知の体験', '背徳の味'];

    // ★修正: リールの並び順を「ジャンル・調理法・気分」に変更
    // (以前は [methods, genres, moods] でした)
    const reelData = [genres, methods, moods];
    
    const SYMBOL_HEIGHT = 60;
    const REEL_REPEAT_COUNT = 10;
    let isSpinning = false;
    let stoppedReels = [false, false, false];
    let animationFrameIds = [null, null, null];
    let reelPositions = [0, 0, 0];
    let finalResults = {}; 

    function initializeApp() {
        const params = new URLSearchParams(window.location.search);
        const ingredientsParam = params.get('ingredients');
        if (ingredientsParam) {
            try {
                const parsedIngredients = JSON.parse(ingredientsParam);
                ingredients = parsedIngredients.map(item => `${item.name}(${item.quantity})`);
            } catch (e) { ingredients = ['解析失敗']; }
        }
        ingredientList.innerHTML = '';
        ingredients.forEach(ing => {
            const li = document.createElement('li');
            li.textContent = ing;
            ingredientList.appendChild(li);
        });
        showScreen('start-screen');
    }

    function showScreen(screenId) {
        screens.forEach(screen => screen.classList.toggle('hidden', screen.id !== screenId));
    }

    function setupMainReels() {
        reelStrips.forEach((strip, index) => {
            const symbols = reelData[index];
            strip.innerHTML = '';
            const repeatedSymbols = Array(REEL_REPEAT_COUNT).fill(symbols).flat();
            repeatedSymbols.forEach(symbolText => {
                const el = document.createElement('div');
                el.textContent = symbolText;
                strip.appendChild(el);
            });
            const initialOffset = -(symbols.length * SYMBOL_HEIGHT * (REEL_REPEAT_COUNT - 3));
            strip.style.transition = 'none';
            strip.style.transform = `translateY(${initialOffset}px)`;
            reelPositions[index] = initialOffset;
        });
    }

    function startReel(index) {
        if (animationFrameIds[index]) cancelAnimationFrame(animationFrameIds[index]);
        const strip = reelStrips[index];
        strip.style.transition = 'none';
        let lastTime = 0;
        const speed = 0.8;
        function spinLoop(timestamp) {
            if (!lastTime) lastTime = timestamp;
            const delta = timestamp - lastTime;
            reelPositions[index] += speed * delta;
            const oneLoopHeight = reelData[index].length * SYMBOL_HEIGHT;
            if (reelPositions[index] > -oneLoopHeight) reelPositions[index] -= oneLoopHeight;
            strip.style.transform = `translateY(${reelPositions[index]}px)`;
            lastTime = timestamp;
            animationFrameIds[index] = requestAnimationFrame(spinLoop);
        }
        animationFrameIds[index] = requestAnimationFrame(spinLoop);
    }

    function onMainGameEnd() {
        isSpinning = false;
        
        // ★修正: リールの並び順変更に合わせて取得元を変更
        finalResults = {
            genre: reels[0].dataset.finalSymbol,  // 左(0)がジャンル
            method: reels[1].dataset.finalSymbol, // 中(1)が調理法
            mood: reels[2].dataset.finalSymbol    // 右(2)が気分
        };
        
        // 表示順もリールと一致させる
        const resultMessage = `テーマ:【${finalResults.genre}】×【${finalResults.method}】\n気分: ${finalResults.mood}`;
        resultText.innerText = resultMessage;
        resultDisplay.classList.add('show');
        nextButton.disabled = false;
    }

    cookingStartButton.addEventListener('click', () => { 
        playSound(clickSound);
        setupMainReels();
        showScreen('main-slot-screen');
    });
    
    nextButton.addEventListener('click', () => { 
        playSound(clickSound);
        sessionStorage.setItem('ingredients', JSON.stringify(ingredients));
        sessionStorage.setItem('theme', JSON.stringify(finalResults));
        window.location.href = './recipe-finish.html';
    });
    
    startButton.addEventListener('click', () => {
        if (isSpinning) return;
        playSound(spinStartSound); 
        isSpinning = true;
        stoppedReels = [false, false, false];
        resultDisplay.classList.remove('show');
        const isLampLit = Math.random() < 0.3; 
        gogoLamp.classList.toggle('lit', isLampLit);
        if (isLampLit) setTimeout(() => { playSound(gogoSound); }, 600);
        startButton.disabled = true;
        stopButtons.forEach(b => b.disabled = false);
        reels.forEach((_, i) => { startReel(i); });
    });

    stopButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            if (!isSpinning || stoppedReels[index]) return;
            playSound(stopSound);
            cancelAnimationFrame(animationFrameIds[index]);
            stoppedReels[index] = true;
            button.disabled = true;
            
            const strip = reelStrips[index];
            strip.style.transform = `translateY(${reelPositions[index]}px)`;
            const symbols = reelData[index];
            const finalSymbolIndex = Math.floor(Math.random() * symbols.length);
            reels[index].dataset.finalSymbol = symbols[finalSymbolIndex];
            
            const targetLoop = REEL_REPEAT_COUNT - 2;
            const symbolPosition = (targetLoop * symbols.length + finalSymbolIndex) * SYMBOL_HEIGHT;
            const centerOffset = (reels[index].offsetHeight - SYMBOL_HEIGHT) / 2;
            const targetY = -(symbolPosition - centerOffset);
            
            strip.style.transition = 'transform 1.5s cubic-bezier(0.25, 1, 0.5, 1)';
            strip.style.transform = `translateY(${targetY}px)`;
            
            if (stoppedReels.every(s => s)) setTimeout(onMainGameEnd, 1600);
        });
    });

    initializeApp();
});