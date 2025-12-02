document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('add-ingredient');
    const ingredientList = document.getElementById('ingredient-list');
    const removeBtn = document.getElementById('remove-ingredient');
    const submitBtn = document.querySelector('.submit-btn');

    function createIngredientRow() {
        const row = document.createElement('div');
        row.className = 'ingredient-row';
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'ingredient-input';
        const examples = ['例: キャベツ1/4', '例: 豚コマ少し', '例: 豆腐一丁', '例: 余ったご飯', '例: 卵2個'];
        textInput.placeholder = examples[Math.floor(Math.random() * examples.length)];
        const quantityInput = document.createElement('input');
        quantityInput.type = 'text'; 
        quantityInput.className = 'quantity-input';
        quantityInput.placeholder = '量';
        row.appendChild(textInput);
        row.appendChild(quantityInput);
        return row;
    }

    addBtn.addEventListener('click', () => {
        if (ingredientList.querySelectorAll('.ingredient-row').length >= 5) { alert('食材は5つまでです'); return; }
        ingredientList.appendChild(createIngredientRow());
    });

    removeBtn.addEventListener('click', () => {
        const allRows = ingredientList.querySelectorAll('.ingredient-row');
        if (allRows.length > 1) allRows[allRows.length - 1].remove();
    });

    submitBtn.addEventListener('click', () => {
        const allRows = document.querySelectorAll('.ingredient-row');
        const ingredientsData = [];
        allRows.forEach(row => {
            const textInput = row.querySelector('.ingredient-input');
            const quantityInput = row.querySelector('.quantity-input');
            if (textInput.value) {
                ingredientsData.push({ name: textInput.value, quantity: quantityInput.value || '適量' });
            }
        });
        if (ingredientsData.length === 0) { alert('食材を入力してください'); return; }
        const params = new URLSearchParams({ ingredients: JSON.stringify(ingredientsData) });
        window.location.href = `./surotto.html?${params.toString()}`;
    });

    ingredientList.appendChild(createIngredientRow());
    ingredientList.appendChild(createIngredientRow());
    ingredientList.appendChild(createIngredientRow());
});