const ui = {
    ru: {
        placeholder: "Название альбома...",
        closeBtn: "Закрыть",
        saveBtn: "Скачать PNG",
        clearBtn: "Очистить всё",
        confirm: "Сбросить чарт и вернуть все ячейки?",
        tapText: "+ Выбрать",
        notFound: "Ничего не найдено",
        networkError: "Ошибка сети. Попробуйте позже.",
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
        placeholder: "Album name...",
        closeBtn: "Close",
        saveBtn: "Download PNG",
        clearBtn: "Clear all",
        confirm: "Reset everything and restore cells?",
        tapText: "+ Tap to add",
        notFound: "Nothing found",
        networkError: "Network error. Please try again.",
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

function safeParse(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (e) {
        return fallback;
    }
}

let currentLang = localStorage.getItem('lang');
if (currentLang !== 'ru' && currentLang !== 'en') currentLang = 'ru';

let chartData = safeParse('chartData', Array(24).fill(""));
let hiddenCells = safeParse('hiddenCells', Array(24).fill(false));

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
            return; 
        }
        document.getElementById('searchLoader').style.display = 'block';
        searchTimeout = setTimeout(() => searchAlbums(q), 500);
    });
}

function updateUI() {
    const s = ui[currentLang];
    document.getElementById('albumInput').placeholder = s.placeholder;
    document.getElementById('closeBtn').textContent = s.closeBtn;
    document.getElementById('saveBtn').textContent = s.saveBtn;
    document.getElementById('clearBtn').textContent = s.clearBtn;
    
    if (activeIndex !== null && document.getElementById('modal').style.display === 'block') {
        document.getElementById('modalTitle').textContent = s.cats[activeIndex];
    }
    
    const hintText = isMobileDevice() ? s.hints.mobile : s.hints.desktop;
    document.getElementById('mobileHint').textContent = "by @imaiv • " + hintText;
    document.getElementById('desktopHint').textContent = hintText;
}

function render() {
    const grid = document.getElementById('chartGrid');
    grid.innerHTML = '';
    
    ui[currentLang].cats.forEach((text, i) => {
        if (hiddenCells[i]) return;
        
        const cell = document.createElement('div');
        cell.className = 'cell';
        const imgUrl = chartData[i];
        
        if (imgUrl) {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = "cover";
            img.crossOrigin = "anonymous";
            cell.appendChild(img);
        } else {
            const emptyImg = document.createElement('div');
            emptyImg.className = 'empty-img';
            const tapHint = document.createElement('span');
            tapHint.className = 'tap-hint';
            tapHint.textContent = ui[currentLang].tapText;
            emptyImg.appendChild(tapHint);
            cell.appendChild(emptyImg);
        }
        
        const spanText = document.createElement('span');
        spanText.textContent = text;
        cell.appendChild(spanText);
        
        let isLongPress = false;
        let timer;

        cell.addEventListener('click', () => {
            if (!isLongPress) openModal(i);
        });
        
        cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            removeCell(i);
        });

        cell.addEventListener('touchstart', () => {
            isLongPress = false;
            timer = setTimeout(() => {
                isLongPress = true;
                removeCell(i);
            }, 800);
        }, { passive: true });

        cell.addEventListener('touchend', () => clearTimeout(timer));
        cell.addEventListener('touchmove', () => clearTimeout(timer));

        grid.appendChild(cell);
    });
}

function removeCell(i) {
    if(confirm(ui[currentLang].confirm.replace("?", ""))) { 
        hiddenCells[i] = true;
        localStorage.setItem('hiddenCells', JSON.stringify(hiddenCells));
        render();
    }
}

// Надежный конструктор URL для API Apple
async function fetchAlbums(query, country) {
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.append('term', query);
    url.searchParams.append('media', 'music');
    url.searchParams.append('entity', 'album');
    url.searchParams.append('limit', '16'); // Берем 16 альбомов
    url.searchParams.append('country', country);

    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.results || [];
}

// Хелпер вывода текста в модалку
function showMessage(text, isError = false) {
    const resDiv = document.getElementById('results');
    resDiv.innerHTML = '';
    const msg = document.createElement('div');
    msg.style.cssText = `grid-column: 1 / -1; text-align: center; padding: 20px; font-weight: bold; ${isError ? 'color: red;' : 'opacity: 0.5;'}`;
    msg.textContent = text;
    resDiv.appendChild(msg);
}

// Упрощенный поиск - только обложки
async function searchAlbums(q) {
    if (controller) controller.abort();
    controller = new AbortController();
    
    const resDiv = document.getElementById('results');
    const s = ui[currentLang];

    try {
        const safeFetch = async (c) => {
            try { return await fetchAlbums(q, c); } 
            catch (e) { if (e.name === 'AbortError') throw e; return []; }
        };

        // Ищем в двух сторах для полноты
        const [ruAlbums, usAlbums] = await Promise.all([
            safeFetch('ru'), safeFetch('us')
        ]);

        document.getElementById('searchLoader').style.display = 'none';

        const combinedAlbums = [...ruAlbums, ...usAlbums];
        // Убираем дубликаты
        const uniqueAlbums = Array.from(new Map(combinedAlbums.map(a => [a.collectionId, a])).values());

        resDiv.innerHTML = '';
        
        if (uniqueAlbums.length === 0) {
            showMessage(s.notFound);
            return;
        }

        uniqueAlbums.forEach(a => {
            if (!a.artworkUrl100) return;
            const colEl = document.createElement('div');
            // ВАЖНО: Никаких классов невидимок!
            colEl.className = 'collection-result';
            
            const img = document.createElement('img');
            img.src = a.artworkUrl100.replace('100x100bb', '600x600bb');
            img.title = `${a.artistName} - ${a.collectionName}`;
            img.loading = "lazy";
            img.crossOrigin = "anonymous";
            
            img.addEventListener('click', () => {
                chartData[activeIndex] = img.src;
                localStorage.setItem('chartData', JSON.stringify(chartData));
                render();
                closeModal();
            });
            
            colEl.appendChild(img);
            resDiv.appendChild(colEl);
        });

    } catch(e) {
        if (e.name !== 'AbortError') {
            document.getElementById('searchLoader').style.display = 'none';
            showMessage(s.networkError, true);
        }
    }
}

function openModal(i) {
    activeIndex = i;
    document.getElementById('modal').style.display = 'block';
    document.getElementById('modalTitle').textContent = ui[currentLang].cats[i]; 
    document.getElementById('albumInput').value = '';
    document.getElementById('results').innerHTML = '';
    document.getElementById('searchLoader').style.display = 'none';
    
    // Прячем старые заголовки дискографии, если они остались в HTML
    const discoHeader = document.getElementById('artistDiscographyHeader');
    if (discoHeader) discoHeader.style.display = 'none';
    
    document.getElementById('albumInput').focus();
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    if (controller) controller.abort();
    activeIndex = null;
}

// Экспорт картинки
async function saveChart() {
    const area = document.getElementById('capture-area');
    const gridEl = document.getElementById('chartGrid');
    const hints = document.querySelectorAll('.tap-hint');
    
    gridEl.classList.add('force-desktop');
    hints.forEach(h => h.style.display = 'none');
    
    try {
        const canvas = await html2canvas(area, { backgroundColor: "#ffffff", scale: 3, useCORS: true });
        const a = document.createElement('a');
        a.download = `music-chart-imaiv.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    } catch (error) {
        alert(currentLang === 'ru' ? "Ошибка сохранения картинки." : "Failed to save image.");
    } finally {
        gridEl.classList.remove('force-desktop');
        hints.forEach(h => h.style.display = 'block');
    }
}

function clearData() {
    if (confirm(ui[currentLang].confirm)) {
        chartData = Array(24).fill("");
        hiddenCells = Array(24).fill(false);
        localStorage.removeItem('chartData');
        localStorage.removeItem('hiddenCells');
        localStorage.removeItem('lang');
        render();
    }
}

document.getElementById('langToggle').addEventListener('change', (e) => {
    currentLang = e.target.checked ? 'en' : 'ru';
    localStorage.setItem('lang', currentLang);
    updateUI();
    render();
});

window.addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
window.addEventListener('resize', updateUI);

init();
