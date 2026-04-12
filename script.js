const ui = {
    ru: {
        placeholder: "Начни вводить название альбома...",
        modalTitle: "Что слушаем сегодня?",
        closeBtn: "Закрыть",
        saveBtn: "Скачать PNG",
        clearBtn: "Очистить всё",
        confirm: "Сбросить чарт и вернуть все ячейки?",
        hint: "ПК: ПКМ для удаления • Мобилка: долгий тап",
        cats: [
            "Любимый альбом", "Лучший сюжетный", "Любимая обложка", "Когда-нибудь послушаю", "Произвело влияние", "Помогает в трудные дни",
            "Тебе нравится / никто не любит", "Все любят / тебе не нравится", "Недооцененный", "Переоцененный", "Не мое, но...", "Лучшие инструменталы",
            "Лучший вокал", "Простой, но классный", "Лучший микстейп", "Любимое неизданное", "Большое разочарование", "Большой сюрприз",
            "Лучший саундтрек", "Самый необычный", "Любимая группа", "Любимый артист", "Лучший EP", "Самый депрессивный"
        ]
    },
    en: {
        placeholder: "Search for an album...",
        modalTitle: "What's the vibe?",
        closeBtn: "Close",
        saveBtn: "Download PNG",
        clearBtn: "Clear all",
        confirm: "Reset everything and restore cells?",
        hint: "PC: Right-click to delete • Mobile: Long press",
        cats: [
            "Favorite Album", "Best Concept", "Favorite Cover", "Will Listen Someday", "Personal Influence", "Helps in Hard Times",
            "I Like / Others Don't", "Others Like / I Don't", "Underrated", "Overrated", "Not My Thing, But...", "Best Instrumentals",
            "Best Vocals", "Simple But Cool", "Best Mixtape", "Favorite Unreleased", "Big Disappointment", "Big Surprise",
            "Best Soundtrack", "Most Unusual", "Favorite Band", "Favorite Artist", "Best EP", "Most Depressing"
        ]
    }
};

let currentLang = localStorage.getItem('lang') || 'ru';
let chartData = JSON.parse(localStorage.getItem('chartData')) || Array(24).fill("");
let hiddenCells = JSON.parse(localStorage.getItem('hiddenCells')) || Array(24).fill(false);
let activeIndex = null;
let searchTimeout = null;
let controller = null;

function init() {
    document.getElementById('langToggle').checked = (currentLang === 'en');
    updateUI();
    render();
    
    document.getElementById('albumInput').addEventListener('input', (e) => {
        const q = e.target.value.trim();
        clearTimeout(searchTimeout);
        if (!q) { 
            document.getElementById('results').innerHTML = ''; 
            document.getElementById('searchLoader').style.display = 'none';
            return; 
        }
        document.getElementById('searchLoader').style.display = 'block';
        searchTimeout = setTimeout(() => search(q), 400);
    });
}

function updateUI() {
    const s = ui[currentLang];
    document.getElementById('albumInput').placeholder = s.placeholder;
    document.getElementById('modalTitle').innerText = s.modalTitle;
    document.getElementById('closeBtn').innerText = s.closeBtn;
    document.getElementById('saveBtn').innerText = s.saveBtn;
    document.getElementById('clearBtn').innerText = s.clearBtn;
    document.getElementById('deleteHint').innerText = s.hint;
}

function render() {
    const grid = document.getElementById('chartGrid');
    grid.innerHTML = '';
    
    ui[currentLang].cats.forEach((text, i) => {
        if (hiddenCells[i]) return;
        
        const cell = document.createElement('div');
        cell.className = 'cell';
        const img = chartData[i];
        
        cell.innerHTML = `
            ${img ? `<img src="${img}" alt="cover">` : `<div class="empty-img"></div>`}
            <span>${text}</span>
        `;
        
        cell.onclick = () => openModal(i);
        
        // ПКМ (удаление)
        cell.oncontextmenu = (e) => {
            e.preventDefault();
            removeCell(i);
        };

        // Long Press
        let timer;
        cell.ontouchstart = () => { timer = setTimeout(() => removeCell(i), 800); };
        cell.ontouchend = () => clearTimeout(timer);

        grid.appendChild(cell);
    });
}

function removeCell(i) {
    if(confirm(currentLang === 'ru' ? "Скрыть эту ячейку?" : "Hide this cell?")) {
        hiddenCells[i] = true;
        localStorage.setItem('hiddenCells', JSON.stringify(hiddenCells));
        render();
    }
}

async function search(q) {
    if (controller) controller.abort();
    controller = new AbortController();
    try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=16`, { signal: controller.signal });
        const data = await res.json();
        const resDiv = document.getElementById('results');
        resDiv.innerHTML = '';
        document.getElementById('searchLoader').style.display = 'none';
        
        data.results.forEach(a => {
            const img = document.createElement('img');
            img.src = a.artworkUrl100.replace('100x100bb', '600x600bb');
            img.onclick = () => {
                chartData[activeIndex] = img.src;
                localStorage.setItem('chartData', JSON.stringify(chartData));
                render();
                closeModal();
            };
            resDiv.appendChild(img);
        });
    } catch(e) {}
}

function openModal(i) {
    activeIndex = i;
    document.getElementById('modal').style.display = 'block';
    document.getElementById('albumInput').value = '';
    document.getElementById('results').innerHTML = '';
    document.getElementById('albumInput').focus();
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    if (controller) controller.abort();
}

function saveChart() {
    const area = document.getElementById('capture-area');
    const gridEl = document.getElementById('chartGrid');
    gridEl.classList.add('force-desktop');
    
    html2canvas(area, { backgroundColor: "#ffffff", scale: 3, useCORS: true }).then(canvas => {
        const a = document.createElement('a');
        a.download = `music-chart-imaiv.png`;
        a.href = canvas.toDataURL();
        a.click();
        gridEl.classList.remove('force-desktop');
    });
}

function clearData() {
    if (confirm(ui[currentLang].confirm)) {
        chartData = Array(24).fill("");
        hiddenCells = Array(24).fill(false);
        localStorage.clear();
        render();
    }
}

document.getElementById('langToggle').onchange = (e) => {
    currentLang = e.target.checked ? 'en' : 'ru';
    localStorage.setItem('lang', currentLang);
    updateUI();
    render();
};

window.onclick = (e) => { if (e.target.id === 'modal') closeModal(); };

init();