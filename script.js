const ui = {
    ru: {
        placeholder: "Название альбома или артиста...",
        closeBtn: "Закрыть",
        saveBtn: "Скачать PNG",
        clearBtn: "Очистить всё",
        confirm: "Сбросить чарт и вернуть все ячейки?",
        tapText: "+ Выбрать",
        artistHeader: "Артисты (нажмите для дискографии):",
        discographyHeader: "Дискография:",
        notFound: "Ничего не найдено",
        noCollections: "Коллекции не найдены",
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
        placeholder: "Album or artist name...",
        closeBtn: "Close",
        saveBtn: "Download PNG",
        clearBtn: "Clear all",
        confirm: "Reset everything and restore cells?",
        tapText: "+ Tap to add",
        artistHeader: "Artists (tap for discography):",
        discographyHeader: "Discography:",
        notFound: "Nothing found",
        noCollections: "No collections found",
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

// Безопасный парсинг LocalStorage
function safeParse(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (e) {
        console.error(`Error parsing localStorage key "${key}":`, e);
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
            document.getElementById('artistDiscographyHeader').style.display = 'none';
            return; 
        }
        document.getElementById('searchLoader').style.display = 'block';
        searchTimeout = setTimeout(() => searchHybrid(q), 400);
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
    grid.innerHTML = ''; // Очистка родителя безопасна
    
    ui[currentLang].cats.forEach((text, i) => {
        if (hiddenCells[i]) return;
        
        const cell = document.createElement('div');
        cell.className = 'cell';
        
        const imgUrl = chartData[i];
        
        if (imgUrl) {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = "cover";
            img.crossOrigin = "anonymous"; // Помогает с CORS при экспорте
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
        
        // Обработка событий (защита от конфликта тапов)
        let isLongPress = false;
        let timer;

        cell.addEventListener('click', (e) => {
            if (!isLongPress) openModal(i);
        });
        
        cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            removeCell(i);
        });

        cell.addEventListener('touchstart', (e) => {
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
    if(confirm(currentLang === 'ru' ? "Скрыть эту ячейку?" : "Hide this cell?")) {
        hiddenCells[i] = true;
        localStorage.setItem('hiddenCells', JSON.stringify(hiddenCells));
        render();
    }
}

// Защищенный загрузчик с пробросом реальных ошибок
async function fetchItunes(url, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    return data.results || [];
}

// Вспомогательная функция для безопасного вывода текста (XSS защита)
function createTextNode(text, styles = {}) {
    const el = document.createElement('p');
    el.textContent = text;
    Object.assign(el.style, styles);
    return el;
}

// Гибридный поиск
async function searchHybrid(q) {
    if (controller) controller.abort();
    controller = new AbortController();
    
    const resDiv = document.getElementById('results');
    const s = ui[currentLang];

    try {
        const query = encodeURIComponent(q);
        
        const [ruAlbums, usAlbums, ruArtists, usArtists] = await Promise.all([
            fetchItunes(`https://itunes.apple.com/search?term=${query}&entity=album&limit=12&country=ru`, controller.signal).catch(e => { if (e.name === 'AbortError') throw e; return []; }),
            fetchItunes(`https://itunes.apple.com/search?term=${query}&entity=album&limit=12&country=us`, controller.signal).catch(e => { if (e.name === 'AbortError') throw e; return []; }),
            fetchItunes(`https://itunes.apple.com/search?term=${query}&entity=artist&limit=3&country=ru`, controller.signal).catch(e => { if (e.name === 'AbortError') throw e; return []; }),
            fetchItunes(`https://itunes.apple.com/search?term=${query}&entity=artist&limit=3&country=us`, controller.signal).catch(e => { if (e.name === 'AbortError') throw e; return []; })
        ]);
        
        const uniqueAlbums = Array.from(new Map([...ruAlbums, ...usAlbums].map(a => [a.collectionId, a])).values());
        const uniqueArtists = Array.from(new Map([...ruArtists, ...usArtists].map(a => [a.artistId, a])).values()).slice(0, 4);

        resDiv.innerHTML = '';
        document.getElementById('searchLoader').style.display = 'none';
        document.getElementById('artistDiscographyHeader').style.display = 'none';
        
        if (uniqueAlbums.length === 0 && uniqueArtists.length === 0) {
            resDiv.appendChild(createTextNode(s.notFound, { gridColumn: '1 / -1', opacity: '0.5' }));
            return;
        }

        // Отрисовка артистов
        if (uniqueArtists.length > 0) {
            const artistWrap = document.createElement('div');
            Object.assign(artistWrap.style, { gridColumn: '1 / -1', display: 'flex', gap: '15px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '10px' });
            
            const artistHeader = document.createElement('div');
            Object.assign(artistHeader.style, { width: '100%', fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' });
            artistHeader.textContent = s.artistHeader;
            resDiv.appendChild(artistHeader);

            uniqueArtists.forEach(artist => {
                const artEl = document.createElement('div');
                artEl.className = 'artist-result html2canvas-ignore';
                Object.assign(artEl.style, { flex: '0 0 auto', width: '90px', border: 'none' });
                
                if (artist.artworkUrl100) {
                    const img = document.createElement('img');
                    img.src = artist.artworkUrl100.replace('100x100bb', '200x200bb');
                    img.crossOrigin = "anonymous";
                    Object.assign(img.style, { width: '75px', height: '75px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #000', display: 'block', margin: '0 auto 8px auto' });
                    artEl.appendChild(img);
                } else {
                    const placeholder = document.createElement('div');
                    Object.assign(placeholder.style, { width: '75px', height: '75px', borderRadius: '50%', border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eee', fontSize: '30px', margin: '0 auto 8px auto' });
                    placeholder.textContent = '👤';
                    artEl.appendChild(placeholder);
                }

                const nameDiv = document.createElement('div');
                Object.assign(nameDiv.style, { fontSize: '11px', fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', lineHeight: '1.2', wordBreak: 'break-word' });
                nameDiv.textContent = artist.artistName;
                artEl.appendChild(nameDiv);

                artEl.addEventListener('click', () => loadArtistDiscography(artist.artistId, artist.artistName));
                artistWrap.appendChild(artEl);
            });
            resDiv.appendChild(artistWrap);
        }

        // Отрисовка альбомов
        uniqueAlbums.forEach(a => {
            if (!a.artworkUrl100) return;
            const colEl = document.createElement('div');
            colEl.className = 'collection-result html2canvas-ignore';
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
            resDiv.innerHTML = '';
            resDiv.appendChild(createTextNode(s.networkError, { gridColumn: '1 / -1', color: 'red' }));
        }
    }
}

// Загрузка дискографии
async function loadArtistDiscography(artistId, artistName) {
    document.getElementById('searchLoader').style.display = 'block';
    const resDiv = document.getElementById('results');
    resDiv.innerHTML = ''; 

    const s = ui[currentLang];
    document.getElementById('modalTitle').textContent = `${s.cats[activeIndex]} > ${artistName}`;

    try {
        const [resultsRu, resultsUs] = await Promise.all([
            fetchItunes(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200&country=ru`, controller.signal).catch(e => { if (e.name === 'AbortError') throw e; return []; }),
            fetchItunes(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200&country=us`, controller.signal).catch(e => { if (e.name === 'AbortError') throw e; return []; })
        ]);
        
        document.getElementById('searchLoader').style.display = 'none';
        
        const albumsRu = resultsRu.filter(item => item.wrapperType === 'collection');
        const albumsUs = resultsUs.filter(item => item.wrapperType === 'collection');
        const combined = [...albumsRu, ...albumsUs];
        
        const uniqueAlbums = Array.from(new Map(combined.map(a => [a.collectionId, a])).values());

        if (uniqueAlbums.length === 0) {
            resDiv.appendChild(createTextNode(s.noCollections, { gridColumn: '1 / -1', opacity: '0.5' }));
            return;
        }

        const header = document.createElement('h4');
        Object.assign(header.style, { gridColumn: '1 / -1', margin: '5px 0 15px 0', fontSize: '16px', fontWeight: '700', textAlign: 'left' });
        header.textContent = s.discographyHeader;
        resDiv.appendChild(header);

        uniqueAlbums.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

        uniqueAlbums.forEach(a => {
            if (!a.artworkUrl100) return;
            const colEl = document.createElement('div');
            colEl.className = 'collection-result html2canvas-ignore';
            const img = document.createElement('img');
            img.src = a.artworkUrl100.replace('100x100bb', '600x600bb');
            img.title = a.collectionName; 
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
            resDiv.appendChild(createTextNode(s.networkError, { gridColumn: '1 / -1', color: 'red' }));
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
    document.getElementById('artistDiscographyHeader').style.display = 'none';
    document.getElementById('albumInput').focus();
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    if (controller) controller.abort();
    activeIndex = null;
}

// Экспорт с защитой try/catch/finally
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
        console.error("Export error:", error);
        alert(currentLang === 'ru' ? "Ошибка сохранения картинки. Возможно, проблема с CORS." : "Failed to save image. Possible CORS issue.");
    } finally {
        // Гарантированно возвращаем интерфейс в норму
        gridEl.classList.remove('force-desktop');
        hints.forEach(h => h.style.display = 'block');
    }
}

// Безопасная очистка (не трогаем чужие ключи)
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
