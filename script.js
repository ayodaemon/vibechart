const ui = {
    ru: {
        placeholder: "Начните вводить имя артиста...",
        closeBtn: "Закрыть",
        saveBtn: "Скачать PNG",
        clearBtn: "Очистить всё",
        confirm: "Сбросить чарт и вернуть все ячейки?",
        tapText: "+ Выбрать",
        artistHeader: "Результаты поиска:",
        discographyHeader: "Дискография артиста:",
        hints: {
            desktop: "Для удаления ячейки: ПКМ",
            mobile: "Для удаления ячейки: долгий тап"
        },
        cats: [
            "Любимый альбом", "Лучший сюжетный", "Любимая обложка", "Когда-нибудь послушаю", "Произвело влияние", "Помогает в трудные дни",
            "Тебе нравится / никто не любит", "Все любят / тебе не нравится", "Недооцененный", "Переоцененный", "Не мое, но...", "Лучшие инструменталы",
            "Лучший вокал", "Простой, но классный", "Лучший микстейп", "Любимое неизданное", "Большое разочарование", "Большой сюрприз",
            "Лучший саундтрек", "Самый необычный", "Любимая группа", "Любимый артист", "Лучший EP", "Самый депрессивный"
        ]
    },
    en: {
        placeholder: "Start typing artist name...",
        closeBtn: "Close",
        saveBtn: "Download PNG",
        clearBtn: "Clear all",
        confirm: "Reset everything and restore cells?",
        tapText: "+ Tap to add",
        artistHeader: "Search Results:",
        discographyHeader: "Artist Discography:",
        hints: {
            desktop: "To delete a cell: Right-click",
            mobile: "To delete a cell: long press"
        },
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

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 1100;
}

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
            document.getElementById('artistDiscographyHeader').style.display = 'none';
            return; 
        }
        document.getElementById('searchLoader').style.display = 'block';
        searchTimeout = setTimeout(() => searchArtist(q), 400);
    });
}

function updateUI() {
    const s = ui[currentLang];
    document.getElementById('albumInput').placeholder = s.placeholder;
    document.getElementById('closeBtn').innerText = s.closeBtn;
    document.getElementById('saveBtn').innerText = s.saveBtn;
    document.getElementById('clearBtn').innerText = s.clearBtn;
    
    if (activeIndex !== null && document.getElementById('modal').style.display === 'block') {
        document.getElementById('modalTitle').innerText = s.cats[activeIndex];
    }
    
    const hintText = isMobileDevice() ? s.hints.mobile : s.hints.desktop;
    document.getElementById('mobileHint').innerText = "by @imaiv • " + hintText;
    document.getElementById('desktopHint').innerText = hintText;
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
            ${img ? `<img src="${img}" alt="cover">` : `<div class="empty-img"><span class="tap-hint">${ui[currentLang].tapText}</span></div>`}
            <span>${text}</span>
        `;
        
        cell.onclick = () => openModal(i);
        
        cell.oncontextmenu = (e) => {
            e.preventDefault();
            removeCell(i);
        };

        let timer;
        cell.ontouchstart = () => { timer = setTimeout(() => removeCell(i), 800); };
        cell.ontouchend = () => clearTimeout(timer);
        cell.ontouchmove = () => clearTimeout(timer);

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

// Этап 1: Двойной поиск артистов (США + Россия) для баланса
async function searchArtist(q) {
    if (controller) controller.abort();
    controller = new AbortController();
    try {
        // Делаем два параллельных запроса в разные сторы
        const [resRu, resUs] = await Promise.all([
            fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=artist&limit=5&country=ru`, { signal: controller.signal }).catch(() => ({ json: () => ({ results: [] }) })),
            fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=artist&limit=5&country=us`, { signal: controller.signal }).catch(() => ({ json: () => ({ results: [] }) }))
        ]);
        
        const dataRu = await resRu.json();
        const dataUs = await resUs.json();
        
        // Объединяем списки артистов из RU и US
        const combined = [...(dataRu.results || []), ...(dataUs.results || [])];
        
        // Удаляем дубликаты (один и тот же артист может быть в обоих сторах)
        const uniqueArtists = Array.from(new Map(combined.map(a => [a.artistId, a])).values()).slice(0, 8);

        const resDiv = document.getElementById('results');
        resDiv.innerHTML = '';
        document.getElementById('searchLoader').style.display = 'none';
        document.getElementById('artistDiscographyHeader').style.display = 'none';
        
        if (uniqueArtists.length === 0) {
            resDiv.innerHTML = '<p style="grid-column: 1/4; opacity: 0.5;">Ничего не найдено</p>';
            return;
        }

        uniqueArtists.forEach(artist => {
            const artEl = document.createElement('div');
            artEl.className = 'artist-result html2canvas-ignore';
            artEl.innerHTML = `
                ${artist.artworkUrl100 ? `<img src="${artist.artworkUrl100.replace('100x100bb', '600x600bb')}">` : `<div style="width:100px; height:100px; border-radius:50%; border:2px solid #000; display:flex; align-items:center; justify-content:center; background:#eee; font-size:40px;">👤</div>`}
                <span class="artist-name">${artist.artistName}</span>
            `;
            artEl.onclick = () => {
                loadArtistDiscography(artist.artistId, artist.artistName);
            };
            resDiv.appendChild(artEl);
        });
    } catch(e) {
        if (e.name !== 'AbortError') {
            document.getElementById('searchLoader').style.display = 'none';
        }
    }
}

// Этап 2: Двойной поиск дискографии
async function loadArtistDiscography(artistId, artistName) {
    document.getElementById('searchLoader').style.display = 'block';
    const resDiv = document.getElementById('results');
    resDiv.innerHTML = ''; 

    const s = ui[currentLang];
    document.getElementById('modalTitle').innerText = `${s.cats[activeIndex]} > ${artistName}`;
    document.getElementById('artistDiscographyHeader').innerText = `${s.discographyHeader}`;
    document.getElementById('artistDiscographyHeader').style.display = 'block';

    try {
        // Подтягиваем альбомы из обоих магазинов
        const [resRu, resUs] = await Promise.all([
            fetch(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200&country=ru`).catch(() => ({ json: () => ({ results: [] }) })),
            fetch(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200&country=us`).catch(() => ({ json: () => ({ results: [] }) }))
        ]);
        
        const dataRu = await resRu.json();
        const dataUs = await resUs.json();
        document.getElementById('searchLoader').style.display = 'none';
        
        // Первый элемент - сам артист, убираем его из выборки
        const collectionsRu = dataRu.results ? dataRu.results.slice(1) : [];
        const collectionsUs = dataUs.results ? dataUs.results.slice(1) : [];
        const combined = [...collectionsRu, ...collectionsUs];
        
        // Убираем дубликаты альбомов
        const uniqueAlbums = Array.from(new Map(combined.map(a => [a.collectionId, a])).values());

        if (uniqueAlbums.length === 0) {
            resDiv.innerHTML = '<p style="grid-column: 1/4; opacity: 0.5;">Коллекции не найдены</p>';
            return;
        }

        // Сортируем альбомы по дате релиза (от свежих к старым)
        uniqueAlbums.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

        uniqueAlbums.forEach(a => {
            const colEl = document.createElement('div');
            colEl.className = 'collection-result html2canvas-ignore';
            const img = document.createElement('img');
            img.src = a.artworkUrl100.replace('100x100bb', '600x600bb');
            img.title = a.collectionName; // Всплывающая подсказка с названием
            img.onclick = () => {
                chartData[activeIndex] = img.src;
                localStorage.setItem('chartData', JSON.stringify(chartData));
                render();
                closeModal();
            };
            colEl.appendChild(img);
            resDiv.appendChild(colEl);
        });
    } catch(e) {
        document.getElementById('searchLoader').style.display = 'none';
    }
}

function openModal(i) {
    activeIndex = i;
    document.getElementById('modal').style.display = 'block';
    document.getElementById('modalTitle').innerText = ui[currentLang].cats[i]; 
    document.getElementById('albumInput').value = '';
    document.getElementById('results').innerHTML = '';
    document.getElementById('searchLoader').style.display = 'none';
    document.getElementById('artistDiscographyHeader').style.display = 'none';
    document.getElementById('albumInput').focus();
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    if (controller) controller.abort();
    document.getElementById('artistDiscographyHeader').style.display = 'none';
    activeIndex = null;
}

function saveChart() {
    const area = document.getElementById('capture-area');
    const gridEl = document.getElementById('chartGrid');
    
    gridEl.classList.add('force-desktop');
    const hints = document.querySelectorAll('.tap-hint');
    hints.forEach(h => h.style.display = 'none');
    
    html2canvas(area, { backgroundColor: "#ffffff", scale: 3, useCORS: true }).then(canvas => {
        const a = document.createElement('a');
        a.download = `music-chart-imaiv.png`;
        a.href = canvas.toDataURL();
        a.click();
        
        gridEl.classList.remove('force-desktop');
        hints.forEach(h => h.style.display = 'block');
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
window.addEventListener('resize', updateUI);

init();
