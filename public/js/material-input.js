document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('add-ingredient');
    const ingredientList = document.getElementById('ingredient-list');
    const removeBtn = document.getElementById('remove-ingredient');
    const submitBtn = document.querySelector('.submit-btn');

    // 材料入力行を作成する関数
    function createIngredientRow() {
        const row = document.createElement('div');
        row.className = 'ingredient-row';

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'ingredient-input';
        
        // プレースホルダーを「余り物」っぽく
        const examples = ['例: キャベツ1/4', '例: 豚コマ少し', '例: 豆腐一丁', '例: 余ったご飯', '例: 卵2個'];
        textInput.placeholder = examples[Math.floor(Math.random() * examples.length)];

        // 数量入力フィールド（「分量」もAIに任せるため、シンプルに）
        const quantityInput = document.createElement('input');
        quantityInput.type = 'text'; 
        quantityInput.className = 'quantity-input';
        quantityInput.placeholder = '量(適当でOK)';
        
        row.appendChild(textInput);
        row.appendChild(quantityInput);
        
        return row;
    }

    addBtn.addEventListener('click', () => {
        const currentCount = ingredientList.querySelectorAll('.ingredient-row').length;
        if (currentCount >= 5) {
            alert('食材は5つまででお願いします！');
            return;
        }
        ingredientList.appendChild(createIngredientRow());
    });

    removeBtn.addEventListener('click', () => {
        const allRows = ingredientList.querySelectorAll('.ingredient-row');
        if (allRows.length > 1) {
            allRows[allRows.length - 1].remove();
        }
    });

    submitBtn.addEventListener('click', () => {
        const allRows = document.querySelectorAll('.ingredient-row');
        const ingredientsData = [];
        
        allRows.forEach(row => {
            const textInput = row.querySelector('.ingredient-input');
            const quantityInput = row.querySelector('.quantity-input');

            if (textInput.value) {
                ingredientsData.push({
                    name: textInput.value,
                    quantity: quantityInput.value || '適量'
                });
            }
        });

        if (ingredientsData.length === 0) {
            alert('せめて1つは食材を入力してください！');
            return;
        }

        const params = new URLSearchParams({
            ingredients: JSON.stringify(ingredientsData)
        });
        window.location.href = `/surotto.html?${params.toString()}`;
    });

    // 初期状態で3つの入力欄を用意（推奨が3〜4つなので）
    ingredientList.appendChild(createIngredientRow());
    ingredientList.appendChild(createIngredientRow());
    ingredientList.appendChild(createIngredientRow());
});