const ui = {
    ru: {
        placeholder: "Название альбома или артиста...",
        closeBtn: "Закрыть",
        saveBtn: "Скачать PNG",
        clearBtn: "Очистить всё",
        confirm: "Сбросить чарт и вернуть все ячейки?",
        tapText: "+ Выбрать",
        artistHeader: "Артисты (нажмите для дискографии):",
        albumsHeader: "Альбомы:",
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
        albumsHeader: "Albums:",
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
            document.getElementById('artistDiscographyHeader').style.display = 'none';
            return; 
        }
        document.getElementById('searchLoader').style.display = 'block';
        searchTimeout = setTimeout(() => searchHybrid(q), 500);
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

// 100% безопасное и правильное формирование URL для iTunes API
async function fetchItunes(query, type, country) {
    let url = new URL('https://itunes.apple.com/search');
    
    if (type === 'lookup') {
        url = new URL('https://itunes.apple.com/lookup');
        url.searchParams.append('id', query);
        url.searchParams.append('entity', 'album');
        url.searchParams.append('limit', '200');
    } else {
        url.searchParams.append('term', query);
        url.searchParams.append('media', 'music');
        if (type === 'artist') {
            url.searchParams.append('entity', 'musicArtist');
            url.searchParams.append('limit', '4');
        } else if (type === 'album') {
            url.searchParams.append('entity', 'album');
            url.searchParams.append('limit', '12');
        }
    }
    url.searchParams.append('country', country);

    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.results || [];
}

// Хелпер для вывода сообщений
function showMessage(text, isError = false) {
    const resDiv = document.getElementById('results');
    resDiv.innerHTML = '';
    const msg = document.createElement('div');
    msg.style.cssText = `grid-column: 1 / -1; text-align: center; padding: 20px; font-weight: bold; ${isError ? 'color: red;' : 'opacity: 0.5;'}`;
    msg.textContent = text;
    resDiv.appendChild(msg);
}

// Гибридный поиск: Альбомы + Артисты
async function searchHybrid(q) {
    if (controller) controller.abort();
    controller = new AbortController();
    
    const resDiv = document.getElementById('results');
    const s = ui[currentLang];

    try {
        const safeFetch = async (t, c) => {
            try { return await fetchItunes(q, t, c); } 
            catch (e) { if (e.name === 'AbortError') throw e; return []; }
        };

        const [ruArtists, usArtists, ruAlbums, usAlbums] = await Promise.all([
            safeFetch('artist', 'ru'), safeFetch('artist', 'us'),
            safeFetch('album', 'ru'), safeFetch('album', 'us')
        ]);

        document.getElementById('searchLoader').style.display = 'none';
        document.getElementById('artistDiscographyHeader').style.display = 'none';

        const combinedArtists = [...ruArtists, ...usArtists];
        const combinedAlbums = [...ruAlbums, ...usAlbums];

        const uniqueArtists = Array.from(new Map(combinedArtists.map(a => [a.artistId, a])).values()).slice(0, 4);
        const uniqueAlbums = Array.from(new Map(combinedAlbums.map(a => [a.collectionId, a])).values());

        resDiv.innerHTML = '';
        
        if (uniqueArtists.length === 0 && uniqueAlbums.length === 0) {
            showMessage(s.notFound);
            return;
        }

        // 1. Отрисовка артистов
        if (uniqueArtists.length > 0) {
            const artistWrap = document.createElement('div');
            artistWrap.style.cssText = 'grid-column: 1 / -1; display: flex; gap: 15px; margin-bottom: 15px; overflow-x: auto; padding-bottom: 10px;';
            
            const artistHeader = document.createElement('div');
            artistHeader.style.cssText = 'grid-column: 1 / -1; width: 100%; font-weight: bold; margin-bottom: 5px; font-size: 14px;';
            artistHeader.textContent = s.artistHeader;
            resDiv.appendChild(artistHeader);

            uniqueArtists.forEach(artist => {
                const artEl = document.createElement('div');
                // ВАЖНО: Убрали класс html2canvas-ignore, чтобы они были видимыми!
                artEl.className = 'artist-result';
                artEl.style.cssText = 'flex: 0 0 auto; width: 90px; border: none; cursor: pointer;';
                
                if (artist.artworkUrl100) {
                    const img = document.createElement('img');
                    img.src = artist.artworkUrl100.replace('100x100bb', '200x200bb');
                    img.crossOrigin = "anonymous";
                    img.style.cssText = 'width: 75px; height: 75px; border-radius: 50%; object-fit: cover; border: 2px solid #000; display: block; margin: 0 auto 8px auto;';
                    artEl.appendChild(img);
                } else {
                    const placeholder = document.createElement('div');
                    placeholder.style.cssText = 'width: 75px; height: 75px; border-radius: 50%; border: 2px solid #000; display: flex; align-items: center; justify-content: center; background: #eee; font-size: 30px; margin: 0 auto 8px auto;';
                    placeholder.textContent = '👤';
                    artEl.appendChild(placeholder);
                }

                const nameDiv = document.createElement('div');
                nameDiv.style.cssText = 'font-size: 11px; font-weight: 700; text-align: center; text-transform: uppercase; line-height: 1.2; word-break: break-word;';
                nameDiv.textContent = artist.artistName;
                artEl.appendChild(nameDiv);

                artEl.addEventListener('click', () => loadArtistDiscography(artist.artistId, artist.artistName));
                artistWrap.appendChild(artEl);
            });
            resDiv.appendChild(artistWrap);
        }

        // 2. Отрисовка альбомов
        if (uniqueAlbums.length > 0) {
            // Добавляем заголовок "Альбомы", если есть и артисты, чтобы отделить их визуально
            if (uniqueArtists.length > 0) {
                const albumHeader = document.createElement('div');
                albumHeader.style.cssText = 'grid-column: 1 / -1; font-weight: bold; margin-top: 5px; margin-bottom: 5px; font-size: 14px;';
                albumHeader.textContent = s.albumsHeader;
                resDiv.appendChild(albumHeader);
            }

            uniqueAlbums.forEach(a => {
                if (!a.artworkUrl100) return;
                const colEl = document.createElement('div');
                // ВАЖНО: Убрали класс html2canvas-ignore!
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
        }

    } catch(e) {
        if (e.name !== 'AbortError') {
            document.getElementById('searchLoader').style.display = 'none';
            showMessage(s.networkError, true);
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
        const safeFetch = async (c) => {
            try { return await fetchItunes(artistId, 'lookup', c); } 
            catch (e) { if (e.name === 'AbortError') throw e; return []; }
        };

        const [resultsRu, resultsUs] = await Promise.all([safeFetch('ru'), safeFetch('us')]);
        document.getElementById('searchLoader').style.display = 'none';
        
        const combined = [...resultsRu, ...resultsUs].filter(item => item.wrapperType === 'collection');
        const uniqueAlbums = Array.from(new Map(combined.map(a => [a.collectionId, a])).values());

        if (uniqueAlbums.length === 0) {
            showMessage(s.noCollections);
            return;
        }

        document.getElementById('artistDiscographyHeader').textContent = s.discographyHeader;
        document.getElementById('artistDiscographyHeader').style.display = 'block';

        uniqueAlbums.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

        uniqueAlbums.forEach(a => {
            if (!a.artworkUrl100) return;
            const colEl = document.createElement('div');
            // ВАЖНО: Убрали класс html2canvas-ignore!
            colEl.className = 'collection-result';
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
    document.getElementById('artistDiscographyHeader').style.display = 'none';
    document.getElementById('albumInput').focus();
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    if (controller) controller.abort();
    activeIndex = null;
}

// Экспорт (не требует классов невидимки на результатах поиска)
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
