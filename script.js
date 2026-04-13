const ui = {
    ru: {
        placeholder: "Артист, альбом, сингл, EP или трек...",
        closeBtn: "Закрыть",
        saveBtn: "Скачать PNG",
        clearBtn: "Очистить всё",
        confirm: "Сбросить чарт и вернуть все ячейки?",
        hideCellConfirm: "Скрыть эту ячейку?",
        tapText: "+ Выбрать",
        loading: "Ищем релизы…",
        selecting: "Сохраняем обложку…",
        noResults: "Ничего не найдено",
        searchError: "Не удалось выполнить поиск. Проверьте интернет и попробуйте снова.",
        exportError: "Не удалось сохранить PNG. Некоторые обложки могли не загрузиться полностью.",
        unknownArtist: "Неизвестный артист",
        unknownTitle: "Без названия",
        editTitle: "✎ Название ячейки",
        saveTitle: "Сохранить",
        cancelTitle: "Отмена",
        renamePlaceholder: "Введите свое название ячейки",
        hints: {
            desktop: "ПК: правый клик по ячейке, чтобы удалить её",
            mobile: "Телефон: удерживайте ячейку, чтобы удалить её"
        },
        releaseTypes: {
            album: "Альбом",
            single: "Сингл",
            ep: "EP",
            collection: "Релиз"
        },
        cats: [
            "Любимый альбом", "Лучший сюжетный", "Любимая обложка", "Когда-нибудь послушаю", "Произвело влияние", "Помогает в трудные дни",
            "Тебе нравится / никто не любит", "Все любят / тебе не нравится", "Недооцененный", "Переоцененный", "Не мое, но...", "Лучшие инструменталы",
            "Лучший вокал", "Простой, но классный", "Лучший микстейп", "Любимое неизданное", "Большое разочарование", "Большой сюрприз",
            "Лучший саундтрек", "Самый необычный", "Любимая группа", "Любимый артист", "Лучший EP", "Самый депрессивный"
        ]
    },
    en: {
        placeholder: "Artist, album, single, EP, or track...",
        closeBtn: "Close",
        saveBtn: "Download PNG",
        clearBtn: "Clear all",
        confirm: "Reset everything and restore all cells?",
        hideCellConfirm: "Hide this cell?",
        tapText: "+ Tap to add",
        loading: "Searching releases…",
        selecting: "Saving cover…",
        noResults: "Nothing found",
        searchError: "Search failed. Check your connection and try again.",
        exportError: "PNG export failed. Some covers may not have finished loading.",
        unknownArtist: "Unknown artist",
        unknownTitle: "Untitled",
        editTitle: "✎ Cell title",
        saveTitle: "Save",
        cancelTitle: "Cancel",
        renamePlaceholder: "Type a custom cell title",
        hints: {
            desktop: "Desktop: right-click a cell to remove it",
            mobile: "Mobile: press and hold a cell to remove it"
        },
        releaseTypes: {
            album: "Album",
            single: "Single",
            ep: "EP",
            collection: "Release"
        },
        cats: [
            "Favorite Album", "Best Concept", "Favorite Cover", "Will Listen Someday", "Personal Influence", "Helps in Hard Times",
            "I Like / Others Don't", "Others Like / I Don't", "Underrated", "Overrated", "Not My Thing, But...", "Best Instrumentals",
            "Best Vocals", "Simple But Cool", "Best Mixtape", "Favorite Unreleased", "Big Disappointment", "Big Surprise",
            "Best Soundtrack", "Most Unusual", "Favorite Band", "Favorite Artist", "Best EP", "Most Depressing"
        ]
    }
};

const STORAGE_KEYS = {
    lang: 'lang',
    chartData: 'chartData',
    hiddenCells: 'hiddenCells',
    customLabels: 'customLabels'
};

const CELL_COUNT = 24;
const SEARCH_DEBOUNCE_MS = 350;
const LONG_PRESS_MS = 800;
const DEEZER_BASE_URL = 'https://api.deezer.com';
const RESULTS_LIMIT = 48;
const ARTIST_ALBUM_LIMIT = 100;

let currentLang = getStoredLang();
let chartData = safeReadArray(STORAGE_KEYS.chartData, CELL_COUNT, '');
let hiddenCells = safeReadArray(STORAGE_KEYS.hiddenCells, CELL_COUNT, false);
let customLabels = safeReadArray(STORAGE_KEYS.customLabels, CELL_COUNT, '');
let activeIndex = null;
let searchTimeout = null;
let searchController = null;
let ignoreNextClick = false;
let lastSearchToken = 0;
let selectingInProgress = false;
let titleEditing = false;

const dom = {};

function getStoredLang() {
    const lang = localStorage.getItem(STORAGE_KEYS.lang);
    return lang === 'en' ? 'en' : 'ru';
}

function safeReadArray(key, expectedLength, fallbackValue) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return Array(expectedLength).fill(fallbackValue);
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return Array(expectedLength).fill(fallbackValue);

        const normalized = Array(expectedLength).fill(fallbackValue);
        for (let i = 0; i < expectedLength; i += 1) {
            if (i < parsed.length && typeof parsed[i] === typeof fallbackValue) {
                normalized[i] = parsed[i];
            }
        }
        return normalized;
    } catch {
        return Array(expectedLength).fill(fallbackValue);
    }
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 1100;
}

function getCellLabel(index) {
    const custom = String(customLabels[index] || '').trim();
    return custom || ui[currentLang].cats[index];
}

function init() {
    dom.langToggle = document.getElementById('langToggle');
    dom.albumInput = document.getElementById('albumInput');
    dom.results = document.getElementById('results');
    dom.searchLoader = document.getElementById('searchLoader');
    dom.modal = document.getElementById('modal');
    dom.modalTitle = document.getElementById('modalTitle');
    dom.closeBtn = document.getElementById('closeBtn');
    dom.saveBtn = document.getElementById('saveBtn');
    dom.clearBtn = document.getElementById('clearBtn');
    dom.mobileHint = document.getElementById('mobileHint');
    dom.desktopHint = document.getElementById('desktopHint');
    dom.chartGrid = document.getElementById('chartGrid');
    dom.captureArea = document.getElementById('capture-area');
    dom.titleEditBtn = document.getElementById('titleEditBtn');
    dom.titleEditPanel = document.getElementById('titleEditPanel');
    dom.titleEditInput = document.getElementById('titleEditInput');
    dom.titleSaveBtn = document.getElementById('titleSaveBtn');
    dom.titleCancelBtn = document.getElementById('titleCancelBtn');

    dom.langToggle.checked = currentLang === 'en';
    dom.langToggle.addEventListener('change', handleLanguageChange);
    dom.albumInput.addEventListener('input', handleSearchInput);
    dom.titleEditBtn.addEventListener('click', toggleTitleEditMode);
    dom.titleSaveBtn.addEventListener('click', saveActiveTitle);
    dom.titleCancelBtn.addEventListener('click', () => setTitleEditMode(false));
    dom.titleEditInput.addEventListener('keydown', handleTitleInputKeydown);

    updateUI();
    render();

    window.addEventListener('resize', () => {
        updateUI();
        render();
    });
    window.addEventListener('click', (event) => {
        if (event.target === dom.modal) closeModal();
    });
}

function updateUI() {
    const s = ui[currentLang];
    dom.albumInput.placeholder = s.placeholder;
    dom.closeBtn.textContent = s.closeBtn;
    dom.saveBtn.textContent = s.saveBtn;
    dom.clearBtn.textContent = s.clearBtn;
    dom.titleEditBtn.textContent = s.editTitle;
    dom.titleSaveBtn.textContent = s.saveTitle;
    dom.titleCancelBtn.textContent = s.cancelTitle;
    dom.titleEditInput.placeholder = s.renamePlaceholder;

    if (activeIndex !== null && dom.modal.style.display === 'block') {
        dom.modalTitle.textContent = getCellLabel(activeIndex);
        if (titleEditing) {
            dom.titleEditInput.value = customLabels[activeIndex] || '';
        }
    }

    dom.mobileHint.textContent = s.hints.mobile;
    dom.desktopHint.textContent = s.hints.desktop;
    dom.mobileHint.hidden = !s.hints.mobile;
    dom.desktopHint.hidden = !s.hints.desktop;
}

function handleLanguageChange(event) {
    currentLang = event.target.checked ? 'en' : 'ru';
    localStorage.setItem(STORAGE_KEYS.lang, currentLang);
    updateUI();
    render();
}

function handleSearchInput(event) {
    const query = event.target.value.trim();
    clearTimeout(searchTimeout);

    if (!query) {
        abortSearch();
        setLoading(false);
        dom.results.innerHTML = '';
        return;
    }

    setLoading(true);
    searchTimeout = setTimeout(() => {
        searchReleases(query);
    }, SEARCH_DEBOUNCE_MS);
}

function handleTitleInputKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        saveActiveTitle();
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        setTitleEditMode(false);
    }
}

function toggleTitleEditMode() {
    setTitleEditMode(!titleEditing);
}

function setTitleEditMode(isEditing) {
    titleEditing = Boolean(isEditing) && activeIndex !== null;
    dom.titleEditPanel.hidden = !titleEditing;
    dom.titleEditBtn.classList.toggle('is-active', titleEditing);
    if (titleEditing && activeIndex !== null) {
        dom.titleEditInput.value = customLabels[activeIndex] || '';
        requestAnimationFrame(() => {
            dom.titleEditInput.focus();
            dom.titleEditInput.select();
        });
    }
}

function saveCustomLabels() {
    localStorage.setItem(STORAGE_KEYS.customLabels, JSON.stringify(customLabels));
}

function saveActiveTitle() {
    if (activeIndex === null) return;
    customLabels[activeIndex] = dom.titleEditInput.value.trim();
    saveCustomLabels();
    dom.modalTitle.textContent = getCellLabel(activeIndex);
    setTitleEditMode(false);
    render();
}

function setLoading(isLoading) {
    dom.searchLoader.style.display = isLoading ? 'block' : 'none';
}

function abortSearch() {
    if (searchController) {
        searchController.abort();
        searchController = null;
    }
}

function beginSearchRequest() {
    abortSearch();
    searchController = new AbortController();
    lastSearchToken += 1;
    return {
        signal: searchController.signal,
        token: lastSearchToken
    };
}

function saveChartData() {
    localStorage.setItem(STORAGE_KEYS.chartData, JSON.stringify(chartData));
}

function saveHiddenCells() {
    localStorage.setItem(STORAGE_KEYS.hiddenCells, JSON.stringify(hiddenCells));
}

function render() {
    dom.chartGrid.innerHTML = '';

    ui[currentLang].cats.forEach((_, index) => {
        if (hiddenCells[index]) return;

        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('role', 'button');
        cell.setAttribute('tabindex', '0');

        const imageArea = chartData[index] ? createCoverPreview(chartData[index]) : createEmptyPreview();
        const label = document.createElement('span');
        label.className = 'cell-label';
        label.textContent = getCellLabel(index);

        cell.appendChild(imageArea);
        cell.appendChild(label);

        attachCellInteractions(cell, index);
        dom.chartGrid.appendChild(cell);
    });

    if (isMobileDevice()) {
        dom.chartGrid.appendChild(createMobileBrandCard());
    }
}

function createMobileBrandCard() {
    const brandCard = document.createElement('div');
    brandCard.className = 'brand-cell-mobile';

    const logo = document.createElement('img');
    logo.src = 'logo.png';
    logo.alt = 'Logo';
    logo.className = 'brand-cell-logo';
    logo.addEventListener('error', () => {
        logo.style.display = 'none';
    }, { once: true });

    const line = document.createElement('div');
    line.className = 'brand-cell-line';
    line.textContent = 'by @imaiv';

    const sub = document.createElement('div');
    sub.className = 'brand-cell-sub';
    sub.textContent = ui[currentLang].hints.mobile;

    brandCard.appendChild(logo);
    brandCard.appendChild(line);
    brandCard.appendChild(sub);
    return brandCard;
}

function createCoverPreview(src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'cover';
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
        img.src = createFallbackCoverDataUrl(ui[currentLang].unknownTitle, ui[currentLang].unknownArtist);
    }, { once: true });
    return img;
}

function createEmptyPreview() {
    const empty = document.createElement('div');
    empty.className = 'empty-img';

    const hint = document.createElement('span');
    hint.className = 'tap-hint';
    hint.textContent = ui[currentLang].tapText;

    empty.appendChild(hint);
    return empty;
}

function attachCellInteractions(cell, index) {
    let longPressTimer = null;
    let longPressTriggered = false;

    cell.addEventListener('click', () => {
        if (ignoreNextClick || longPressTriggered) {
            ignoreNextClick = false;
            longPressTriggered = false;
            return;
        }
        openModal(index);
    });

    cell.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openModal(index);
        }
    });

    cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        removeCell(index);
    });

    cell.addEventListener('touchstart', () => {
        longPressTriggered = false;
        longPressTimer = window.setTimeout(() => {
            longPressTriggered = true;
            ignoreNextClick = true;
            removeCell(index);
        }, LONG_PRESS_MS);
    }, { passive: true });

    const clearLongPress = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    cell.addEventListener('touchend', clearLongPress, { passive: true });
    cell.addEventListener('touchmove', clearLongPress, { passive: true });
    cell.addEventListener('touchcancel', clearLongPress, { passive: true });
}

function removeCell(index) {
    if (!confirm(ui[currentLang].hideCellConfirm)) return;
    hiddenCells[index] = true;
    saveHiddenCells();
    render();
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

function tokenize(value) {
    const normalized = normalizeText(value);
    return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function looksLikeStructuredQuery(query) {
    return /\s[-–—/:|]\s/.test(query) || /\s[|:]\s/.test(query) || tokenize(query).length >= 4;
}

function scoreArtistCandidate(query, artistName) {
    const normalizedQuery = normalizeText(query);
    const normalizedArtist = normalizeText(artistName);
    if (!normalizedQuery || !normalizedArtist) return 0;
    if (normalizedArtist === normalizedQuery) return 1000;
    if (normalizedArtist.startsWith(`${normalizedQuery} `) || normalizedQuery.startsWith(`${normalizedArtist} `)) return 800;
    if (normalizedArtist.includes(normalizedQuery) || normalizedQuery.includes(normalizedArtist)) return 650;

    const queryTokens = tokenize(normalizedQuery);
    const artistTokens = tokenize(normalizedArtist);
    let score = 0;

    queryTokens.forEach((token) => {
        if (artistTokens.includes(token)) score += 120;
        else if (normalizedArtist.includes(token)) score += 40;
    });

    if (queryTokens.length > 0 && queryTokens.every((token) => normalizedArtist.includes(token))) {
        score += 240;
    }

    return score;
}

function createJsonpRequest(url, signal, callbackParam = 'callback') {
    return new Promise((resolve, reject) => {
        const callbackName = `jsonp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const script = document.createElement('script');
        const separator = url.includes('?') ? '&' : '?';
        let finished = false;

        const cleanup = () => {
            if (script.parentNode) script.parentNode.removeChild(script);
            if (window[callbackName]) delete window[callbackName];
            if (signal) signal.removeEventListener('abort', abortHandler);
        };

        const abortHandler = () => {
            if (finished) return;
            finished = true;
            cleanup();
            reject(new DOMException('Aborted', 'AbortError'));
        };

        window[callbackName] = (data) => {
            if (finished) return;
            finished = true;
            cleanup();
            resolve(data || {});
        };

        script.onerror = () => {
            if (finished) return;
            finished = true;
            cleanup();
            reject(new Error('JSONP request failed'));
        };

        script.src = `${url}${separator}${callbackParam}=${callbackName}&output=jsonp`;
        script.async = true;

        if (signal) {
            if (signal.aborted) {
                abortHandler();
                return;
            }
            signal.addEventListener('abort', abortHandler, { once: true });
        }

        document.head.appendChild(script);
    });
}

async function fetchDeezer(path, signal) {
    const url = path.startsWith('http') ? path : `${DEEZER_BASE_URL}${path}`;
    const response = await createJsonpRequest(url, signal);
    if (response?.error) {
        throw new Error(response.error.message || 'Deezer API error');
    }
    return response;
}

function normalizeReleaseType(recordType, title = '') {
    const type = String(recordType || '').toLowerCase();
    const normalizedTitle = normalizeText(title);

    if (type.includes('ep') || /\bep\b/.test(normalizedTitle)) return 'ep';
    if (type.includes('single')) return 'single';
    if (type.includes('album')) return 'album';
    if (/\bsingle\b/.test(normalizedTitle)) return 'single';
    return 'album';
}

function releasePriority(type) {
    if (type === 'album') return 3;
    if (type === 'ep') return 2;
    if (type === 'single') return 1;
    return 0;
}

function getDeezerArtwork(item) {
    return item.cover_xl || item.cover_big || item.cover_medium || item.cover || item.md5_image || '';
}

function normalizeDeezerAlbum(item) {
    return {
        id: `deezer-album-${item.id}`,
        source: 'deezer',
        artistId: item.artist?.id || null,
        artistName: item.artist?.name || ui[currentLang].unknownArtist,
        title: item.title || ui[currentLang].unknownTitle,
        artworkUrl: getDeezerArtwork(item),
        releaseDate: item.release_date || '',
        releaseType: normalizeReleaseType(item.record_type, item.title),
        rank: item.rank || item.fans || 0,
        sortKey: `deezer-${item.id}`
    };
}

function normalizeDeezerTrack(item) {
    const album = item.album || {};
    return {
        id: `deezer-album-${album.id || item.id}`,
        source: 'deezer-track',
        artistId: item.artist?.id || null,
        artistName: item.artist?.name || ui[currentLang].unknownArtist,
        title: album.title || item.title || ui[currentLang].unknownTitle,
        artworkUrl: getDeezerArtwork(album),
        releaseDate: album.release_date || item.release_date || '',
        releaseType: normalizeReleaseType(album.record_type || item.record_type, album.title || item.title),
        rank: item.rank || 0,
        sortKey: `deezer-track-${album.id || item.id}`
    };
}

function dedupeCollections(items) {
    const unique = new Map();

    items.forEach((item) => {
        if (!item || !item.id) return;
        if (!unique.has(item.id)) {
            unique.set(item.id, item);
            return;
        }

        const existing = unique.get(item.id);
        const scoreExisting = Number(Boolean(existing.artworkUrl)) + releasePriority(existing.releaseType) + (existing.rank || 0);
        const scoreNext = Number(Boolean(item.artworkUrl)) + releasePriority(item.releaseType) + (item.rank || 0);

        if (scoreNext > scoreExisting) {
            unique.set(item.id, item);
        }
    });

    return Array.from(unique.values());
}

function compareDatesDesc(a, b) {
    const timeA = a ? new Date(a).getTime() : 0;
    const timeB = b ? new Date(b).getTime() : 0;
    return timeB - timeA;
}

function countTokenMatches(fieldTokens, queryTokens) {
    const used = new Set();
    let matches = 0;

    queryTokens.forEach((token) => {
        const index = fieldTokens.findIndex((fieldToken, idx) => !used.has(idx) && fieldToken === token);
        if (index !== -1) {
            used.add(index);
            matches += 1;
        }
    });

    return matches;
}

function hasOrderedTokenPhrase(field, phraseTokens) {
    if (!phraseTokens.length) return false;
    return field.includes(phraseTokens.join(' '));
}

function getBestSplitMatchScore(queryTokens, artist, title) {
    if (queryTokens.length < 2) return 0;

    let best = 0;

    for (let mask = 1; mask < (1 << queryTokens.length) - 1; mask += 1) {
        const first = [];
        const second = [];

        queryTokens.forEach((token, index) => {
            if ((mask >> index) & 1) first.push(token);
            else second.push(token);
        });

        if (!first.length || !second.length) continue;

        const titleFirstArtistSecond = hasOrderedTokenPhrase(title, first) && hasOrderedTokenPhrase(artist, second);
        const artistFirstTitleSecond = hasOrderedTokenPhrase(artist, first) && hasOrderedTokenPhrase(title, second);

        if (titleFirstArtistSecond || artistFirstTitleSecond) {
            const phraseBonus = (first.length + second.length) * 320;
            const balancedBonus = Math.min(first.length, second.length) * 180;
            best = Math.max(best, phraseBonus + balancedBonus);
        }
    }

    return best;
}

function scoreReleaseAgainstQuery(collection, query) {
    const normalizedQuery = normalizeText(query);
    const queryTokens = tokenize(query);
    const artist = normalizeText(collection.artistName);
    const title = normalizeText(collection.title);
    const combined = `${artist} ${title}`.trim();
    const artistTokens = tokenize(collection.artistName);
    const titleTokens = tokenize(collection.title);

    let score = 0;

    if (title === normalizedQuery) score += 3000;
    if (artist === normalizedQuery) score += 2400;
    if (combined === normalizedQuery) score += 3600;

    if (title.startsWith(normalizedQuery)) score += 1200;
    if (artist.startsWith(normalizedQuery)) score += 900;
    if (combined.includes(normalizedQuery)) score += 650;

    const titleExactTokenMatches = countTokenMatches(titleTokens, queryTokens);
    const artistExactTokenMatches = countTokenMatches(artistTokens, queryTokens);
    const combinedTokenCoverage = new Set([...artistTokens, ...titleTokens]);
    const coveredTokens = queryTokens.filter((token, index) => queryTokens.indexOf(token) === index && combinedTokenCoverage.has(token));
    const missingTokens = queryTokens.filter((token) => !combinedTokenCoverage.has(token));

    score += titleExactTokenMatches * 260;
    score += artistExactTokenMatches * 190;
    score += coveredTokens.length * 220;
    score -= missingTokens.length * 260;

    if (queryTokens.length > 0 && missingTokens.length === 0) score += 1000;
    if (queryTokens.length > 1 && titleExactTokenMatches >= Math.max(1, queryTokens.length - 1)) score += 500;
    if (titleExactTokenMatches > 0 && artistExactTokenMatches > 0) score += 1250;

    score += getBestSplitMatchScore(queryTokens, artist, title);
    score += releasePriority(collection.releaseType) * 40;
    score += Math.min(collection.rank || 0, 1000000) / 25000;

    return score;
}

async function searchReleases(query) {
    const { signal, token } = beginSearchRequest();

    try {
        const artistMode = await resolveArtistMode(query, signal);
        if (signal.aborted || token !== lastSearchToken) return;

        if (artistMode) {
            const collections = await loadArtistReleases(artistMode, signal);
            if (signal.aborted || token !== lastSearchToken) return;
            renderCollectionResults(sortArtistCollections(dedupeCollections(collections)));
            return;
        }

        const collections = await loadSearchCollections(query, signal);
        if (signal.aborted || token !== lastSearchToken) return;

        const sorted = dedupeCollections(collections)
            .filter((item) => item.artworkUrl)
            .sort((a, b) => {
                const scoreDiff = scoreReleaseAgainstQuery(b, query) - scoreReleaseAgainstQuery(a, query);
                if (scoreDiff !== 0) return scoreDiff;

                const typeDiff = releasePriority(b.releaseType) - releasePriority(a.releaseType);
                if (typeDiff !== 0) return typeDiff;

                const rankDiff = (b.rank || 0) - (a.rank || 0);
                if (rankDiff !== 0) return rankDiff;

                return compareDatesDesc(a.releaseDate, b.releaseDate);
            });

        renderCollectionResults(sorted);
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error(error);
        renderStatusMessage(ui[currentLang].searchError, 'error');
    } finally {
        if (!signal.aborted && token === lastSearchToken) setLoading(false);
    }
}

async function resolveArtistMode(query, signal) {
    if (looksLikeStructuredQuery(query)) return null;

    const response = await fetchDeezer(`/search/artist?q=${encodeURIComponent(query)}&limit=5&strict=on`, signal);
    const artists = Array.isArray(response?.data) ? response.data : [];
    if (artists.length === 0) return null;

    const best = artists
        .map((artist) => ({
            artist,
            score: scoreArtistCandidate(query, artist.name)
        }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (b.artist.nb_fan || 0) - (a.artist.nb_fan || 0);
        })[0];

    if (!best) return null;
    return best.score >= 700 ? best.artist : null;
}

async function loadArtistReleases(artist, signal) {
    const response = await fetchDeezer(`/artist/${artist.id}/albums?limit=${ARTIST_ALBUM_LIMIT}&index=0`, signal);
    const data = Array.isArray(response?.data) ? response.data : [];
    return data.map(normalizeDeezerAlbum).filter((item) => item.artworkUrl);
}

async function loadSearchCollections(query, signal) {
    const encodedQuery = encodeURIComponent(query);
    const [albumsResponse, tracksResponse] = await Promise.all([
        fetchDeezer(`/search/album?q=${encodedQuery}&limit=${RESULTS_LIMIT}&order=RATING_DESC`, signal),
        fetchDeezer(`/search/track?q=${encodedQuery}&limit=${RESULTS_LIMIT}&order=RATING_DESC`, signal)
    ]);

    const albums = Array.isArray(albumsResponse?.data) ? albumsResponse.data.map(normalizeDeezerAlbum) : [];
    const tracks = Array.isArray(tracksResponse?.data) ? tracksResponse.data.map(normalizeDeezerTrack) : [];

    return [...albums, ...tracks].filter((item) => item.artworkUrl);
}

function sortArtistCollections(items) {
    return [...items].sort((a, b) => {
        const typeDiff = releasePriority(b.releaseType) - releasePriority(a.releaseType);
        if (typeDiff !== 0) return typeDiff;

        const rankDiff = (b.rank || 0) - (a.rank || 0);
        if (rankDiff !== 0) return rankDiff;

        return compareDatesDesc(a.releaseDate, b.releaseDate);
    });
}

function renderCollectionResults(collections) {
    dom.results.innerHTML = '';

    if (collections.length === 0) {
        renderStatusMessage(ui[currentLang].noResults, 'info');
        return;
    }

    collections.forEach((collection) => {
        dom.results.appendChild(createCollectionCard(collection));
    });
}

function createCollectionCard(collection) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result-card';
    button.title = `${collection.artistName} — ${collection.title}`;
    button.addEventListener('click', () => selectCollection(collection, button));

    const image = document.createElement('img');
    image.src = collection.artworkUrl;
    image.alt = `${collection.artistName} — ${collection.title}`;
    image.loading = 'lazy';
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
        image.src = createFallbackCoverDataUrl(collection.title, collection.artistName);
    }, { once: true });

    const meta = document.createElement('div');
    meta.className = 'result-meta';

    const title = document.createElement('div');
    title.className = 'result-title';
    title.textContent = collection.title;

    const artist = document.createElement('div');
    artist.className = 'result-artist';
    artist.textContent = collection.artistName;

    const badges = document.createElement('div');
    badges.className = 'result-badges';

    const typeBadge = document.createElement('span');
    typeBadge.className = 'result-type';
    typeBadge.textContent = ui[currentLang].releaseTypes[collection.releaseType] || ui[currentLang].releaseTypes.collection;
    badges.appendChild(typeBadge);

    if (collection.releaseDate) {
        const yearBadge = document.createElement('span');
        yearBadge.className = 'result-year';
        const year = new Date(collection.releaseDate).getFullYear();
        if (!Number.isNaN(year)) {
            yearBadge.textContent = year;
            badges.appendChild(yearBadge);
        }
    }

    meta.appendChild(title);
    meta.appendChild(artist);
    meta.appendChild(badges);

    button.appendChild(image);
    button.appendChild(meta);

    return button;
}

function renderStatusMessage(message, tone = 'info') {
    dom.results.innerHTML = '';
    const status = document.createElement('div');
    status.className = `status-message ${tone}`;
    status.textContent = message;
    dom.results.appendChild(status);
}

async function selectCollection(collection, button) {
    if (activeIndex === null || selectingInProgress) return;

    selectingInProgress = true;
    const originalDisabled = button?.disabled;
    if (button) button.disabled = true;
    setLoading(true);

    try {
        const storedArtwork = await toPersistentImage(collection.artworkUrl, collection.title, collection.artistName);
        if (activeIndex === null) return;
        chartData[activeIndex] = storedArtwork;
        saveChartData();
        render();
        closeModal();
    } catch (error) {
        console.error(error);
        chartData[activeIndex] = collection.artworkUrl || createFallbackCoverDataUrl(collection.title, collection.artistName);
        saveChartData();
        render();
        closeModal();
    } finally {
        selectingInProgress = false;
        if (button) button.disabled = Boolean(originalDisabled);
        setLoading(false);
    }
}

async function toPersistentImage(url, title, artist) {
    if (!url) return createFallbackCoverDataUrl(title, artist);

    try {
        const response = await fetch(url, {
            mode: 'cors',
            cache: 'force-cache'
        });

        if (!response.ok) throw new Error(`Image HTTP ${response.status}`);
        const blob = await response.blob();
        return await blobToDataUrl(blob);
    } catch {
        return url;
    }
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function createFallbackCoverDataUrl(title, artist) {
    const safeTitle = escapeHtml(title || ui[currentLang].unknownTitle);
    const safeArtist = escapeHtml(artist || ui[currentLang].unknownArtist);
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
            <rect width="800" height="800" fill="#f2f2f2" />
            <rect x="32" y="32" width="736" height="736" fill="#ffffff" stroke="#000000" stroke-width="12" rx="32" />
            <text x="400" y="345" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#000000">${safeTitle}</text>
            <text x="400" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#555555">${safeArtist}</text>
        </svg>
    `;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function openModal(index) {
    activeIndex = index;
    dom.modal.style.display = 'block';
    dom.modalTitle.textContent = getCellLabel(index);
    dom.albumInput.value = '';
    dom.results.innerHTML = '';
    selectingInProgress = false;
    setLoading(false);
    setTitleEditMode(false);
    requestAnimationFrame(() => dom.albumInput.focus());
}

function closeModal() {
    dom.modal.style.display = 'none';
    abortSearch();
    clearTimeout(searchTimeout);
    activeIndex = null;
    dom.results.innerHTML = '';
    selectingInProgress = false;
    setLoading(false);
    setTitleEditMode(false);
}

async function saveChart() {
    const gridEl = dom.chartGrid;
    const hints = document.querySelectorAll('.tap-hint');

    gridEl.classList.add('force-desktop');
    hints.forEach((hint) => {
        hint.style.visibility = 'hidden';
    });

    try {
        const canvas = await html2canvas(dom.captureArea, {
            backgroundColor: '#ffffff',
            scale: 3,
            useCORS: true,
            allowTaint: false,
            logging: false
        });

        const link = document.createElement('a');
        link.download = 'music-chart-imaiv.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        alert(ui[currentLang].exportError);
        console.error(error);
    } finally {
        gridEl.classList.remove('force-desktop');
        hints.forEach((hint) => {
            hint.style.visibility = 'visible';
        });
    }
}

function clearData() {
    if (!confirm(ui[currentLang].confirm)) return;

    chartData = Array(CELL_COUNT).fill('');
    hiddenCells = Array(CELL_COUNT).fill(false);
    customLabels = Array(CELL_COUNT).fill('');

    localStorage.removeItem(STORAGE_KEYS.chartData);
    localStorage.removeItem(STORAGE_KEYS.hiddenCells);
    localStorage.removeItem(STORAGE_KEYS.customLabels);

    render();
}

window.saveChart = saveChart;
window.clearData = clearData;
window.closeModal = closeModal;

init();
