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
        searchTimeout = setTimeout(() => searchHybrid(q), 400);
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

// Защищенный загрузчик
async function fetchItunes(url, signal) {
    try {
        const res = await fetch(url, { signal });
        const data = await res.json();
        return data.results || [];
    } catch (err) {
        if (err.name === 'AbortError') throw err; 
        return []; 
    }
}

// Гибридный поиск: ищем и альбомы, и артистов
async function searchHybrid(q) {
    if (controller) controller.abort();
    controller = new AbortController();
    
    try {
        const query = encodeURIComponent(q);
        
        // 4 параллельных запроса (RU + US) х (Альбомы + Артисты)
        const [ruAlbums, usAlbums, ruArtists, usArtists] = await Promise.all([
            fetchItunes(`https://itunes.apple.com/search?term=${query}&entity=album&limit=12&country=ru`, controller.signal),
            fetchItunes(`https://itunes.apple.com/search?term=${query}&entity=album&limit=12&country=us`, controller.signal),
            fetchItunes(`https://itunes.apple.com/search?term=${query}&entity=artist&limit=3&country=ru`, controller.signal),
            fetchItunes(`https://itunes.apple.com/search?term=${query}&entity=artist&limit=3&country=us`, controller.signal)
        ]);
        
        // Убираем дубликаты
        const uniqueAlbums = Array.from(new Map([...ruAlbums, ...usAlbums].map(a => [a.collectionId, a])).values());
        const uniqueArtists = Array.from(new Map([...ruArtists, ...usArtists].map(a => [a.artistId, a])).values()).slice(0, 4);

        const resDiv = document.getElementById('results');
        resDiv.innerHTML = '';
        document.getElementById('searchLoader').style.display = 'none';
        document.getElementById('artistDiscographyHeader').style.display = 'none';
        
        if (uniqueAlbums.length === 0 && uniqueArtists.length === 0) {
            resDiv.innerHTML = '<p style="grid-column: 1 / -1; opacity: 0.5;">Ничего не найдено</p>';
            return;
        }

        // 1. Отрисовка строки с артистами (если есть совпадения)
        if (uniqueArtists.length > 0) {
            const artistWrap = document.createElement('div');
            artistWrap.style.gridColumn = '1 / -1'; // Растягиваем на всю ширину модалки
            artistWrap.style.display = 'flex';
            artistWrap.style.gap = '15px';
            artistWrap.style.marginBottom = '15px';
            artistWrap.style.overflowX = 'auto'; // Горизонтальный скролл
            artistWrap.style.paddingBottom = '10px';
            
            // Заголовок для артистов
            const artistHeader = document.createElement('div');
            artistHeader.style.width = '100%';
            artistHeader.style.fontWeight = 'bold';
            artistHeader.style.marginBottom = '10px';
            artistHeader.style.fontSize = '14px';
            artistHeader.innerText = ui[currentLang].artistHeader;
            resDiv.appendChild(artistHeader);

            uniqueArtists.forEach(artist => {
                const artEl = document.createElement('div');
                artEl.className = 'artist-result html2canvas-ignore';
                artEl.style.flex = '0 0 auto';
                artEl.style.width = '90px';
                artEl.style.border = 'none';
                artEl.innerHTML = `
                    ${artist.artworkUrl100 ? `<img src="${artist.artworkUrl100.replace('100x100bb', '200x200bb')}" style="width:75px; height:75px; border-radius:50%; object-fit:cover; border:2px solid #000; display:block; margin:0 auto 8px auto;">` : `<div style="width:75px; height:75px; border-radius:50%; border:2px solid #000; display:flex; align-items:center; justify-content:center; background:#eee; font-size:30px; margin:0 auto 8px auto;">👤</div>`}
                    <div style="font-size:11px; font-weight:700; text-align:center; text-transform:uppercase; line-height:1.2; word-break:break-word;">${artist.artistName}</div>
                `;
                artEl.onclick = () => loadArtistDiscography(artist.artistId, artist.artistName);
                artistWrap.appendChild(artEl);
            });
            resDiv.appendChild(artistWrap);
        }

        // 2. Отрисовка найденных обложек альбомов
        uniqueAlbums.forEach(a => {
            const colEl = document.createElement('div');
            colEl.className = 'collection-result html2canvas-ignore';
            const img = document.createElement('img');
            img.src = a.artworkUrl100.replace('100x100bb', '600x600bb');
            img.title = `${a.artistName} - ${a.collectionName}`;
            img.loading = "lazy";
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
        if (e.name !== 'AbortError') {
            document.getElementById('searchLoader').style.display = 'none';
        }
    }
}

// Загрузка дискографии артиста
async function loadArtistDiscography(artistId, artistName) {
    document.getElementById('searchLoader').style.display = 'block';
    const resDiv = document.getElementById('results');
    resDiv.innerHTML = ''; 

    const s = ui[currentLang];
    document.getElementById('modalTitle').innerText = `${s.cats[activeIndex]} > ${artistName}`;
    document.getElementById('artistDiscographyHeader').innerText = s.discographyHeader;
    document.getElementById('artistDiscographyHeader').style.display = 'block';

    try {
        // Подтягиваем альбомы из обоих магазинов
        const [resultsRu, resultsUs] = await Promise.all([
            fetchItunes(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200&country=ru`, controller.signal),
            fetchItunes(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200&country=us`, controller.signal)
        ]);
        
        document.getElementById('searchLoader').style.display = 'none';
        
        // Отфильтровываем альбомы
        const albumsRu = resultsRu.filter(item => item.wrapperType === 'collection');
        const albumsUs = resultsUs.filter(item => item.wrapperType === 'collection');
        const combined = [...albumsRu, ...albumsUs];
        
        const uniqueAlbums = Array.from(new Map(combined.map(a => [a.collectionId, a])).values());

        if (uniqueAlbums.length === 0) {
            resDiv.innerHTML = '<p style="grid-column: 1 / -1; opacity: 0.5;">Коллекции не найдены</p>';
            return;
        }

        // Сортировка: новые релизы сверху
        uniqueAlbums.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

        uniqueAlbums.forEach(a => {
            const colEl = document.createElement('div');
            colEl.className = 'collection-result html2canvas-ignore';
            const img = document.createElement('img');
            img.src = a.artworkUrl100.replace('100x100bb', '600x600bb');
            img.title = a.collectionName; 
            img.loading = "lazy";
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
        if (e.name !== 'AbortError') {
            document.getElementById('searchLoader').style.display = 'none';
        }
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
