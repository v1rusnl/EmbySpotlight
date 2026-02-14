/*!
 * Spotlight.js — Emby 4.9 compatible Spotlight slider with Video Backdrop Support & Custom Ratings
 * Enhanced with: YouTube Trailers, HTML5 Video, SponsorBlock, Custom Ratings (IMDb, RT, Metacritic, etc.), Oscar + Emmy + Globes + BAFTA + Razzies + Cannes + Berlinale + Venice Wins+Nominations
 * localStorage-based caching for all ratings
 * RT Scraping for Certified Fresh & Verified Hot badges
 * RT Direct Scraping fallback when MDBList has no RT data
 * PERFORMANCE OPTIMIZED: Lazy-loading Awards & Ratings, combined SPARQL queries
 *
 * CORS PROXY (optional):
 * - Without CORS: All Ratings work via MDBList or Wikidata and GraphQL API (except Allociné), RT Certified/Verified badges might not be correct sometimes
 * - With CORS: Enables RT fallback scraping for old movies with MDBList API rating "null" + exact Certified/Verified badges + Allociné Ratings
 *
 * Manually delete ratings cache in Browsers DevConsole (F12):
 * Object.keys(localStorage)
 * .filter(k => k.startsWith('spotlight_ratings_'))
 * .forEach(k => localStorage.removeItem(k));
 * console.log('Ratings-Cache gelöscht');
 *
 * Manually delete ratings cache in Browsers DevConsole (F12) for one TMDb-ID (e.g. 1399 = Game of Thrones):
 * Object.keys(localStorage)
 * .filter(k => k.startsWith('spotlight_ratings_') && k.includes('1399'))
 * .forEach(k => { console.log('Lösche:', k); localStorage.removeItem(k); });
 */

if (typeof GM_xmlhttpRequest === 'undefined') {
  window.GM_xmlhttpRequest = function({ method = 'GET', url, headers = {}, data, onload, onerror }) {
    fetch(url, {
      method,
      headers,
      body: data,
      cache: 'no-store'
    })
    .then(response =>
      response.text().then(text =>
        onload({ status: response.status, responseText: text })
      )
    )
    .catch(err => {
      if (typeof onerror === 'function') onerror(err);
    });
  };
}

(function () {
    'use strict';

    // ══════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ══════════════════════════════════════════════════════════════════    
    const CONFIG = {
        imageWidth: 1900,
		
		// ══════════════════════════════════════════════════════════════════
		// SPOTLIGHT CONTAINER SETTINGS
		// ══════════════════════════════════════════════════════════════════
        limit: 10,
        autoplayInterval: 10000,
        vignetteColorTop:    "#1e1e1e",
        vignetteColorBottom: "#1e1e1e",
        vignetteColorLeft:   "#1e1e1e",
        vignetteColorRight:  "#1e1e1e",
        playbuttonColor: "hsl(var(--theme-primary-color-hue), var(--theme-primary-color-saturation), var(--theme-primary-color-lightness))",
        customItemsFile: "spotlight-items.txt",
        
        enableVideoBackdrop: true,
        startMuted: false,
        videoVolume: 0.4,
        waitForTrailerToEnd: true,
        enableMobileVideo: false,
        preferredVideoQuality: "hd720",
        
        enableSponsorBlock: true,
        sponsorBlockCategories: ["sponsor", "intro", "outro", "selfpromo", "interaction", "preview"],

		// ══════════════════════════════════════════════════════════════════
		// API KEYS
		// ══════════════════════════════════════════════════════════════════
		MDBLIST_API_KEY: '', // API Key from https://mdblist.com/
        TMDB_API_KEY: '', // API Key from https://www.themoviedb.org/
        KINOPOISK_API_KEY: '', // API key from https://kinopoiskapiunofficial.tech/
        
		// ══════════════════════════════════════════════════════════════════
		// CUSTOM RATINGS CONFIG
		// ══════════════════════════════════════════════════════════════════
		enableCustomRatings: true,

		// ══════════════════════════════════════════════════════════════════
		// INDIVIDUAL RATING PROVIDERS (true = enabled, false = disabled)
		// ══════════════════════════════════════════════════════════════════
		enableIMDb: true,
		enableTMDb: true,
		enableRottenTomatoes: true,
		enableMetacritic: true,
		enableTrakt: true,
		enableLetterboxd: true,
		enableRogerEbert: true,
		enableAllocine: true,
		enableKinopoisk: true,
		enableMyAnimeList: true,
		enableAniList: true,

		// ══════════════════════════════════════════════════════════════════
		// RATINGS CACHE
		// ══════════════════════════════════════════════════════════════════		
        CACHE_TTL_HOURS: 168, // in hours

		// ══════════════════════════════════════════════════════════════════
		// CORS PROXY - RT und Allociné Scraping (leave empty without proxy)
		// ══════════════════════════════════════════════════════════════════
        CORS_PROXY_URL: '' // e.g. 'https://cors.yourdomain.com/proxy/'
    };

    // ══════════════════════════════════════════════════════════════════
    // END CONFIGURATION
    // ══════════════════════════════════════════════════════════════════

	function isRatingProviderEnabled(source) {
		if (!CONFIG.enableCustomRatings) return false;
		const key = source.toLowerCase().replace(/\s+/g, '_');
		if (key === 'imdb') return CONFIG.enableIMDb;
		if (key === 'tmdb') return CONFIG.enableTMDb;
		if (key === 'tomatoes' || key === 'tomatoes_rotten' || key === 'tomatoes_certified' ||
			key.includes('popcorn') || key.includes('audience') || key === 'rotten_ver')
			return CONFIG.enableRottenTomatoes;
		if (key === 'metacritic' || key === 'metacriticms' || key === 'metacriticus' ||
			key.includes('metacritic'))
			return CONFIG.enableMetacritic;
		if (key === 'trakt') return CONFIG.enableTrakt;
		if (key === 'letterboxd') return CONFIG.enableLetterboxd;
		if (key === 'rogerebert' || key === 'roger_ebert') return CONFIG.enableRogerEbert;
		if (key === 'allocine' || key === 'allocine_critics' || key === 'allocine_audience')
			return CONFIG.enableAllocine;
		if (key === 'kinopoisk') return CONFIG.enableKinopoisk;
		if (key === 'myanimelist' || key === 'mal') return CONFIG.enableMyAnimeList;
		if (key === 'anilist') return CONFIG.enableAniList;
		return true;
	}

    const CACHE_PREFIX = 'spotlight_ratings_';
    const CACHE_TTL_MS = CONFIG.CACHE_TTL_HOURS * 60 * 60 * 1000;

    const RatingsCache = {
        get(key) {
            try {
                const raw = localStorage.getItem(CACHE_PREFIX + key);
                if (!raw) return null;
                const entry = JSON.parse(raw);
                if (!entry || !entry.timestamp || !('data' in entry)) return null;
                if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
                    localStorage.removeItem(CACHE_PREFIX + key);
                    return null;
                }
                return entry.data;
            } catch (e) {
                return null;
            }
        },
        set(key, data) {
            try {
                localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
                    timestamp: Date.now(),
                    data: data
                }));
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    this.cleanup(true);
                    try {
                        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
                            timestamp: Date.now(),
                            data: data
                        }));
                    } catch (e2) { }
                }
            }
        },
        cleanup(force = false) {
            const keysToCheck = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) keysToCheck.push(k);
            }
            if (force) {
                const entries = keysToCheck.map(k => {
                    try {
                        const raw = localStorage.getItem(k);
                        const parsed = JSON.parse(raw);
                        return { key: k, timestamp: parsed?.timestamp || 0 };
                    } catch { return { key: k, timestamp: 0 }; }
                }).sort((a, b) => a.timestamp - b.timestamp);
                const deleteCount = Math.max(1, Math.floor(entries.length / 2));
                for (let i = 0; i < deleteCount; i++) localStorage.removeItem(entries[i].key);
                return;
            }
            let removed = 0;
            keysToCheck.forEach(k => {
                try {
                    const raw = localStorage.getItem(k);
                    if (!raw) return;
                    const entry = JSON.parse(raw);
                    if (!entry?.timestamp || (Date.now() - entry.timestamp > CACHE_TTL_MS)) {
                        localStorage.removeItem(k);
                        removed++;
                    }
                } catch { localStorage.removeItem(k); removed++; }
            });
        }
    };

    RatingsCache.cleanup();

    const LOGO = {
        imdb: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/IMDb_noframe.png',
        tmdb: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/TMDB.png',
        tomatoes: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Rotten_Tomatoes.png',
        tomatoes_rotten: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Rotten_Tomatoes_rotten.png',
        tomatoes_certified: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/rotten-tomatoes-certified.png',
        audience: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Rotten_Tomatoes_positive_audience.png',
        audience_rotten: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Rotten_Tomatoes_negative_audience.png',
        rotten_ver: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Rotten_Tomatoes_ver.png',
        metacritic: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Metacritic.png',
        metacriticms: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/metacriticms.png',
        metacriticus: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/mus2.png',
        trakt: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Trakt.png',
        letterboxd: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/letterboxd.png',
        myanimelist: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/mal.png',
        anilist: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/anilist.png',
        kinopoisk: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/kinopoisk.png',
        rogerebert: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Roger_Ebert.png',
        allocine_critics: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/allocine_crit.png',
        allocine_audience: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/allocine_user.png',
        academy: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/academyaw.png',
        emmy: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/emmy.png',
        globes: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/globes.png',
        oscars_nom: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Oscars_Nom.png',
        oscars_win: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Oscars_Win.png',
        globes_nom: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Globe_Nom.png',
        globes_win: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Globe_Win.png',
        emmy_nom: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Emmy_Nom.png',
        emmy_win: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/Emmy_Win.png',
        bafta: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/bafta.png',
        bafta_nom: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/bafta_Nom.png',
        bafta_win: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/bafta_Win.png',
        razzies: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/razzie.png',
        razzies_nom: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/razzie_Nom.png',
        razzies_win: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/razzie_Win.png',
        venezia_gold: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/venezia_gold.png',
        venezia_silver: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/venezia_silver.png',
		berlinale: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/berlinalebear.png',
		cannes: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/cannes.png'
    };

    // ══════════════════════════════════════════════════════════════════
    // MANUAL OVERRIDES (Fallback if RT-Scrape fails)
    // ══════════════════════════════════════════════════════════════════    
    const CERTIFIED_FRESH_OVERRIDES = [
	    // '550',      // Fight Club
	];
    
    const VERIFIED_HOT_OVERRIDES = [
        // Movies with a score <90, but RT verified hot nonetheless
        '812583', // Wake Up Dead Man A Knives Out Mystery
        '1272837', // 28 Years Later: The Bone Temple
        '1054867', // One Battle After Another
        '1088166', // Relay
        '1007734', // Nobody 2
        '1078605', // Weapons
        '1022787', // Elio
        '575265', // Mission: Impossible - The Final Reckoning
        '574475', // Final Destination Bloodlines
        '1197306', // A Working Man
        '784524', // Magazine Dreams
        '1084199', // Companion
        '1280672', // One of Them Days
        '1082195', // The Order
        '845781', // Red One
        '1064213', // Anora
        '1034541', // Terrifier 3
        '1112426', // Stree 2
        '1079091', // It Ends with Us
        '956842', // Fly Me to the Moon
        '823464', // Godzilla x Kong: The New Empire
        '768362', // Missing
        '614939', // Bros
        '335787', // Uncharted
        '576845', // Last Night in Soho
        '568124', // Encanto
        '340558', // Fantasmas
        '1259102', // Eternity
    ];

    const STATE = {
        videoPlayers: {},
        isMuted: CONFIG.startMuted,
        isPaused: false,
        currentSlideIndex: 0,
        youtubeAPIReady: false,
        sponsorBlockSegments: {},
        skipIntervals: {},
        currentSlider: null,
        isInitializing: false,
        ratingsCache: {},
        videoReadyStates: {},
        // NEW: Track which slides have been enriched with ratings/awards
        enrichedSlides: new Set(),
        // NEW: Store items for lazy loading
        sliderItems: [],
        // NEW: Pending enrichment promises to avoid duplicates
        enrichmentPromises: {}
    };
    
    const SPOTLIGHT_CONTAINER_ID = 'emby-spotlight-slider-container';
    
    const homeContainerSelectors = [
        ".view:not(.hide) .homeSectionsContainer",
        ".view:not(.hide) .view-home-home",
        ".view-home-home",
        ".view-home",
        ".homeSectionsContainer",
        ".homeView",
        ".view[data-view='home'] .homeSectionsContainer",
        ".view[data-view='home']"
    ];
    
    function findHomeContainer() {
        for (const s of homeContainerSelectors) {
            const el = document.querySelector(s);
            if (el) return el;
        }
        return document.querySelector(".view:not(.hide)");
    }
    
    function safeRequire(modules) {
        return new Promise((resolve) => {
            try {
                if (typeof window.require === "function") {
                    window.require(modules, function () {
                        resolve(Array.prototype.slice.call(arguments));
                    });
                } else if (typeof require === "function") {
                    resolve([require.apply(null, modules)]);
                } else {
                    resolve([]);
                }
            } catch (e) {
                resolve([]);
            }
        });
    }
    
    function parseColor(color) {
        if (!color) return { r: 0, g: 0, b: 0, a: 1 };
        color = color.trim();
        const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(color);
        if (hexMatch) {
            return {
                r: parseInt(hexMatch[1], 16), g: parseInt(hexMatch[2], 16),
                b: parseInt(hexMatch[3], 16), a: hexMatch[4] ? parseInt(hexMatch[4], 16) / 255 : 1
            };
        }
        const rgbaMatch = color.match(/rgba?\(\s*([\d.]+)\s*[,/]\s*([\d.]+)\s*[,/]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+))?\s*\)/);
        if (rgbaMatch) {
            return {
                r: parseInt(rgbaMatch[1]), g: parseInt(rgbaMatch[2]),
                b: parseInt(rgbaMatch[3]), a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
            };
        }
        return { r: 0, g: 0, b: 0, a: 1 };
    }
    
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    function formatRuntime(minutes) {
        if (!minutes) return '';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
    }
    
    function getImdbId(item) {
        return item.ProviderIds?.Imdb || null;
    }
    
    function getTmdbId(item) {
        return item.ProviderIds?.Tmdb || null;
    }

    function isCorsProxyConfigured() {
        return CONFIG.CORS_PROXY_URL && CONFIG.CORS_PROXY_URL.trim() !== '';
    }

    // ══════════════════════════════════════════════════════════════════
    // COMBINED AWARDS QUERY — single SPARQL request for ALL awards
    // ══════════════════════════════════════════════════════════════════

    function fetchAllAwardsCombined(imdbId) {
        return new Promise((resolve) => {
            if (!imdbId) { resolve(null); return; }

            const cacheKey = `all_awards_combined_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) {
                resolve(cached);
                return;
            }

            // Single query that fetches wins and nominations with labels,
            // plus checks for Cannes, Berlinale, Venice specific awards
            const sparql = `
                SELECT 
                    ?awardLabel ?nomLabel
                    ?isCannes ?isBerlinale ?isVeniceGold ?isVeniceSilver
                WHERE {
                    ?item wdt:P345 "${imdbId}" .
                    
                    OPTIONAL {
                        ?item wdt:P166 ?award .
                        ?award rdfs:label ?awardLabel .
                        FILTER(LANG(?awardLabel) = "en")
                    }
                    OPTIONAL {
                        ?item wdt:P1411 ?nom .
                        ?nom rdfs:label ?nomLabel .
                        FILTER(LANG(?nomLabel) = "en")
                    }
                    
                    BIND(EXISTS { ?item wdt:P166 wd:Q179808 } AS ?isCannes)
                    BIND(EXISTS { ?item wdt:P166 wd:Q154590 } AS ?isBerlinale)
                    BIND(EXISTS { ?item wdt:P166 wd:Q189038 } AS ?isVeniceGold)
                    BIND(EXISTS { ?item wdt:P166 wd:Q830814 } AS ?isVeniceSilver)
                }`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql),
                headers: {
                    'Accept': 'application/sparql-results+json',
                    'User-Agent': 'EmbySpotlightScript/1.0'
                },
                onload(res) {
                    if (res.status !== 200) {
                        RatingsCache.set(cacheKey, null);
                        resolve(null);
                        return;
                    }

                    let json;
                    try { json = JSON.parse(res.responseText); }
                    catch { RatingsCache.set(cacheKey, null); resolve(null); return; }

                    const bindings = json.results?.bindings || [];

                    // Categorize wins and nominations
                    const winLabels = new Set();
                    const nomLabels = new Set();
                    let isCannes = false, isBerlinale = false, isVeniceGold = false, isVeniceSilver = false;

                    bindings.forEach(row => {
                        if (row.awardLabel?.value) winLabels.add(row.awardLabel.value);
                        if (row.nomLabel?.value) nomLabels.add(row.nomLabel.value);
                        if (row.isCannes?.value === 'true') isCannes = true;
                        if (row.isBerlinale?.value === 'true') isBerlinale = true;
                        if (row.isVeniceGold?.value === 'true') isVeniceGold = true;
                        if (row.isVeniceSilver?.value === 'true') isVeniceSilver = true;
                    });

                    // Count by category
                    function countByKeyword(labels, keywords) {
                        let count = 0;
                        labels.forEach(label => {
                            const lower = label.toLowerCase();
                            if (keywords.some(kw => lower.includes(kw))) count++;
                        });
                        return count;
                    }

                    const oscarKeywords = ['academy award', 'oscar'];
                    const emmyKeywords = ['emmy'];
                    const globeKeywords = ['golden globe'];
                    const baftaKeywords = ['bafta'];
                    const razzieKeywords = ['razzie', 'golden raspberry'];

                    const result = {
                        oscars: {
                            wins: countByKeyword(winLabels, oscarKeywords),
                            nominations: countByKeyword(nomLabels, oscarKeywords)
                        },
                        emmys: {
                            wins: countByKeyword(winLabels, emmyKeywords),
                            nominations: countByKeyword(nomLabels, emmyKeywords)
                        },
                        globes: {
                            wins: countByKeyword(winLabels, globeKeywords),
                            nominations: countByKeyword(nomLabels, globeKeywords)
                        },
                        bafta: {
                            wins: countByKeyword(winLabels, baftaKeywords),
                            nominations: countByKeyword(nomLabels, baftaKeywords)
                        },
                        razzies: {
                            wins: countByKeyword(winLabels, razzieKeywords),
                            nominations: countByKeyword(nomLabels, razzieKeywords)
                        },
                        cannes: isCannes,
                        berlinale: isBerlinale,
                        venice: { gold: isVeniceGold, silver: isVeniceSilver }
                    };

                    console.log(`[Spotlight] Combined awards for ${imdbId}:`, result);
                    RatingsCache.set(cacheKey, result);
                    resolve(result);
                },
                onerror() {
                    RatingsCache.set(cacheKey, null);
                    resolve(null);
                }
            });
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // Rotten Tomatoes Scraping
    // ══════════════════════════════════════════════════════════════════

    function getRTSlug(imdbId) {
        return new Promise((resolve) => {
            if (!imdbId) { resolve(null); return; }
            const cacheKey = `rt_slug_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) { resolve(cached.slug); return; }

            const sparql = `
                SELECT ?rtId WHERE {
                    ?item wdt:P345 "${imdbId}" .
                    ?item wdt:P1258 ?rtId .
                } LIMIT 1`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql),
                onload(res) {
                    if (res.status !== 200) { resolve(null); return; }
                    let json;
                    try { json = JSON.parse(res.responseText); }
                    catch { resolve(null); return; }
                    const b = json.results.bindings;
                    const slug = b.length && b[0].rtId?.value ? b[0].rtId.value : null;
                    RatingsCache.set(cacheKey, { slug });
                    resolve(slug);
                },
                onerror: () => resolve(null)
            });
        });
    }

    function fetchRTCertifiedStatus(imdbId, type) {
        return new Promise((resolve) => {
            if (!imdbId || !isCorsProxyConfigured()) {
                resolve({ criticsCertified: null, audienceCertified: null });
                return;
            }
            const cacheKey = `rt_certified_${type}_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) { resolve(cached); return; }

            getRTSlug(imdbId).then(slug => {
                if (!slug) {
                    const result = { criticsCertified: null, audienceCertified: null };
                    RatingsCache.set(cacheKey, result);
                    resolve(result);
                    return;
                }
                const rtUrl = `${CONFIG.CORS_PROXY_URL}https://www.rottentomatoes.com/${slug}`;
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: rtUrl,
                    onload(res) {
                        if (res.status !== 200) {
                            const result = { criticsCertified: null, audienceCertified: null };
                            RatingsCache.set(cacheKey, result);
                            resolve(result);
                            return;
                        }
                        const html = res.responseText;
                        let criticsCertified = null, audienceCertified = null;

                        const jsonMatch = html.match(/<script[^>]*id="media-scorecard-json"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
                        if (jsonMatch) {
                            try {
                                const scoreData = JSON.parse(jsonMatch[1]);
                                if (scoreData.criticsScore && typeof scoreData.criticsScore.certified === 'boolean')
                                    criticsCertified = scoreData.criticsScore.certified;
                                if (scoreData.audienceScore && typeof scoreData.audienceScore.certified === 'boolean')
                                    audienceCertified = scoreData.audienceScore.certified;
                            } catch (e) { }
                        }
                        if (criticsCertified === null) {
                            const m = html.match(/<score-icon-critics\s[^>]*certified="(true|false)"[^>]*/);
                            if (m) criticsCertified = m[1] === 'true';
                        }
                        if (audienceCertified === null) {
                            const m = html.match(/<score-icon-audience\s[^>]*certified="(true|false)"[^>]*/);
                            if (m) audienceCertified = m[1] === 'true';
                        }
                        if (criticsCertified === null) {
                            const m = html.match(/"cag\[certified_fresh\]"\s*:\s*"(\d)"/);
                            if (m) criticsCertified = m[1] === '1';
                        }
                        const result = { criticsCertified, audienceCertified };
                        RatingsCache.set(cacheKey, result);
                        resolve(result);
                    },
                    onerror() {
                        const result = { criticsCertified: null, audienceCertified: null };
                        RatingsCache.set(cacheKey, result);
                        resolve(result);
                    }
                });
            });
        });
    }

    function fetchRottenTomatoesDirectly(imdbId, type) {
        return new Promise((resolve) => {
            if (!imdbId || !isCorsProxyConfigured()) { resolve(null); return; }
            const cacheKey = `rt_direct_${type}_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) {
                resolve((cached.criticsScore !== null || cached.audienceScore !== null) ? cached : null);
                return;
            }
            getRTSlug(imdbId).then(slug => {
                if (!slug) {
                    RatingsCache.set(cacheKey, { criticsScore: null, audienceScore: null, criticsCertified: false, audienceCertified: false });
                    resolve(null);
                    return;
                }
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${CONFIG.CORS_PROXY_URL}https://www.rottentomatoes.com/${slug}`,
                    onload(res) {
                        if (res.status !== 200) {
                            RatingsCache.set(cacheKey, { criticsScore: null, audienceScore: null, criticsCertified: false, audienceCertified: false });
                            resolve(null);
                            return;
                        }
                        const html = res.responseText;
                        let criticsScore = null, criticsCertified = false, audienceScore = null, audienceCertified = false;
                        const jsonMatch = html.match(/<script[^>]*id="media-scorecard-json"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
                        if (jsonMatch) {
                            try {
                                const scoreData = JSON.parse(jsonMatch[1]);
                                if (scoreData.criticsScore) {
                                    const total = (scoreData.criticsScore.likedCount || 0) + (scoreData.criticsScore.notLikedCount || 0);
                                    if (total > 0) criticsScore = Math.round((scoreData.criticsScore.likedCount / total) * 100);
                                    criticsCertified = scoreData.criticsScore.certified === true;
                                }
                                if (scoreData.audienceScore) {
                                    const total = (scoreData.audienceScore.likedCount || 0) + (scoreData.audienceScore.notLikedCount || 0);
                                    if (total > 0) audienceScore = Math.round((scoreData.audienceScore.likedCount / total) * 100);
                                    audienceCertified = scoreData.audienceScore.certifiedFresh === 'verified_hot' || scoreData.audienceScore.certified === true;
                                }
                            } catch (e) { }
                        }
                        const result = { criticsScore, criticsCertified, audienceScore, audienceCertified };
                        RatingsCache.set(cacheKey, result);
                        resolve((criticsScore !== null || audienceScore !== null) ? result : null);
                    },
                    onerror() {
                        RatingsCache.set(cacheKey, { criticsScore: null, audienceScore: null, criticsCertified: false, audienceCertified: false });
                        resolve(null);
                    }
                });
            });
        });
    }
    
    // ══════════════════════════════════════════════════════════════════
    // MDBList Ratings
    // ══════════════════════════════════════════════════════════════════

    function fetchMDBListRatings(type, tmdbId, item) {
        return new Promise((resolve) => {
            if (!CONFIG.enableCustomRatings || !tmdbId) { resolve(null); return; }
            
            const memKey = `mdb_${type}_${tmdbId}`;
            if (STATE.ratingsCache[memKey]) { resolve(STATE.ratingsCache[memKey]); return; }
            const cacheKey = `mdblist_${type}_${tmdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached) { STATE.ratingsCache[memKey] = cached; resolve(cached); return; }
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.mdblist.com/tmdb/${type}/${tmdbId}?apikey=${CONFIG.MDBLIST_API_KEY}`,
                onload(res) {
                    if (res.status !== 200) { resolve(null); return; }
                    let data;
                    try { data = JSON.parse(res.responseText); } catch { resolve(null); return; }
                    
                    const ratings = [];
                    const isCertifiedFreshOverride = CERTIFIED_FRESH_OVERRIDES.includes(String(tmdbId));
                    const isVerifiedHotOverride = VERIFIED_HOT_OVERRIDES.includes(String(tmdbId));
                    let metacriticScore = null, metacriticVotes = null;
                    let tomatoesScore = null, tomatoesVotes = null;
                    let audienceScore = null, audienceVotes = null;
                    let hasRTFromMDBList = false;
                    
                    if (Array.isArray(data.ratings)) {
                        data.ratings.forEach(r => {
                            if (r.value == null) return;
                            const key = r.source.toLowerCase();
                            if (key === 'metacritic') { metacriticScore = r.value; metacriticVotes = r.votes; }
                            else if (key === 'tomatoes') { tomatoesScore = r.value; tomatoesVotes = r.votes; hasRTFromMDBList = true; }
                            else if (key.includes('popcorn') || key.includes('audience')) { audienceScore = r.value; audienceVotes = r.votes; hasRTFromMDBList = true; }
                        });
                        
                        data.ratings.forEach(r => {
                            if (r.value == null) return;
                            let key = r.source.toLowerCase().replace(/\s+/g, '_');
                            if (!isRatingProviderEnabled(key)) return;
                            
                            let isCriticsBadge = false, isAudienceBadge = false;
                            if (key === 'tomatoes') {
                                isCriticsBadge = true;
                                key = r.value < 60 ? 'tomatoes_rotten' :
                                      (isCertifiedFreshOverride || (tomatoesScore >= 75 && tomatoesVotes >= 80)) ? 'tomatoes_certified' : 'tomatoes';
                            } else if (key.includes('popcorn')) {
                                isAudienceBadge = true;
                                key = r.value < 60 ? 'audience_rotten' :
                                      (isVerifiedHotOverride || (audienceScore >= 90 && audienceVotes >= 500)) ? 'rotten_ver' : 'audience';
                            } else if (key === 'metacritic') {
                                key = (metacriticScore > 81 && metacriticVotes > 14) ? 'metacriticms' : 'metacritic';
                            } else if (key.includes('metacritic') && key.includes('user')) key = 'metacriticus';
                            else if (key.includes('trakt')) key = 'trakt';
                            else if (key.includes('letterboxd')) key = 'letterboxd';
                            else if (key.includes('roger') || key.includes('ebert')) key = 'rogerebert';
                            else if (key.includes('myanimelist')) key = 'myanimelist';
                            
                            const logoUrl = LOGO[key];
                            if (!logoUrl) return;
                            ratings.push({
                                source: r.source, value: r.value, votes: r.votes, key,
                                logo: logoUrl, _isCritics: isCriticsBadge, _isAudience: isAudienceBadge
                            });
                        });
                    }
                    
                    const result = {
                        ratings, originalTitle: data.original_title || data.title || '',
                        year: data.year || '', _tomatoesScore: tomatoesScore,
                        _audienceScore: audienceScore, _hasRTFromMDBList: hasRTFromMDBList
                    };
                    STATE.ratingsCache[memKey] = result;
                    RatingsCache.set(cacheKey, result);
                    resolve(result);
                },
                onerror() { resolve(null); }
            });
        });
    }
    
    // ══════════════════════════════════════════════════════════════════
    // AniList
    // ══════════════════════════════════════════════════════════════════

    function getAnilistId(imdbId) {
        return new Promise((resolve) => {
            if (!imdbId) { resolve(null); return; }
            const cacheKey = `anilist_id_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) { resolve(cached.id); return; }
            
            const sparql = `SELECT ?anilist WHERE { ?item wdt:P345 "${imdbId}" . ?item wdt:P8729 ?anilist . } LIMIT 1`;
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql),
                onload(res) {
                    if (res.status !== 200) { resolve(null); return; }
                    let json;
                    try { json = JSON.parse(res.responseText); } catch { resolve(null); return; }
                    const b = json.results.bindings;
                    const id = b.length && b[0].anilist?.value ? b[0].anilist.value : null;
                    RatingsCache.set(cacheKey, { id });
                    resolve(id);
                },
                onerror: () => resolve(null)
            });
        });
    }
    
    function queryAniListById(id, imdbId) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST', url: 'https://graphql.anilist.co',
                headers: {'Content-Type':'application/json'},
                data: JSON.stringify({
                    query: `query($id:Int){Media(id:$id,type:ANIME){id meanScore}}`,
                    variables: { id: parseInt(id, 10) }
                }),
                onload(res) {
                    if (res.status !== 200) { resolve(null); return; }
                    let json;
                    try { json = JSON.parse(res.responseText); } catch { resolve(null); return; }
                    const m = json.data?.Media;
                    if (m?.meanScore > 0) {
                        const result = { id: m.id, score: m.meanScore };
                        if (imdbId) RatingsCache.set(`anilist_rating_${imdbId}`, result);
                        resolve(result);
                    } else {
                        if (imdbId) RatingsCache.set(`anilist_rating_${imdbId}`, { id: null, score: 0 });
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }
    
    function queryAniListBySearch(title, year, imdbId) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST', url: 'https://graphql.anilist.co',
                headers: {'Content-Type':'application/json'},
                data: JSON.stringify({
                    query: `query($search:String,$startDate:FuzzyDateInt,$endDate:FuzzyDateInt){
                        Media(search:$search,type:ANIME,startDate_greater:$startDate,startDate_lesser:$endDate){
                            id meanScore title{romaji english native} startDate{year}
                        }}`,
                    variables: { search: title, startDate: parseInt(`${year}0101`, 10), endDate: parseInt(`${year+1}0101`, 10) }
                }),
                onload(res) {
                    if (res.status !== 200) { resolve(null); return; }
                    let json;
                    try { json = JSON.parse(res.responseText); } catch { resolve(null); return; }
                    const m = json.data?.Media;
                    if (m?.meanScore > 0 && m.startDate?.year === year) {
                        const norm = s => s.toLowerCase().trim();
                        const titles = [m.title.romaji, m.title.english, m.title.native].filter(Boolean).map(norm);
                        if (titles.includes(norm(title))) {
                            const result = { id: m.id, score: m.meanScore };
                            if (imdbId) RatingsCache.set(`anilist_rating_${imdbId}`, result);
                            resolve(result);
                            return;
                        }
                    }
                    if (imdbId) RatingsCache.set(`anilist_rating_${imdbId}`, { id: null, score: 0 });
                    resolve(null);
                },
                onerror: () => resolve(null)
            });
        });
    }
    
    async function fetchAniListRating(imdbId, originalTitle, year) {
        if (!imdbId) return null;
        const cacheKey = `anilist_rating_${imdbId}`;
        const cached = RatingsCache.get(cacheKey);
        if (cached !== null) return cached.score > 0 ? cached : null;
        
        const anilistId = await getAnilistId(imdbId);
        if (anilistId) return await queryAniListById(anilistId, imdbId);
        else if (originalTitle && year) return await queryAniListBySearch(originalTitle, parseInt(year, 10), imdbId);
        RatingsCache.set(cacheKey, { id: null, score: 0 });
        return null;
    }

    // ══════════════════════════════════════════════════════════════════
    // Kinopoisk
    // ══════════════════════════════════════════════════════════════════

    function fetchKinopoiskRating(title, year, type) {
        return new Promise((resolve) => {
            if (!CONFIG.KINOPOISK_API_KEY || CONFIG.KINOPOISK_API_KEY === 'DEIN_KEY_HIER') { resolve(null); return; }
            const cacheKey = `kinopoisk_${type}_${title}_${year}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) { resolve(cached.score != null ? cached : null); return; }
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://kinopoiskapiunofficial.tech/api/v2.2/films?keyword=${encodeURIComponent(title)}&yearFrom=${year}&yearTo=${year}`,
                headers: { 'X-API-KEY': CONFIG.KINOPOISK_API_KEY, 'Content-Type': 'application/json' },
                onload(res) {
                    if (res.status !== 200) { resolve(null); return; }
                    let data;
                    try { data = JSON.parse(res.responseText); } catch { resolve(null); return; }
                    const list = data.items || data.films || [];
                    if (!list.length) { RatingsCache.set(cacheKey, { score: null }); resolve(null); return; }
                    const desired = type === 'show' ? 'TV_SERIES' : 'FILM';
                    const item = list.find(i => i.type === desired) || list[0];
                    if (item.ratingKinopoisk != null) {
                        const result = { score: item.ratingKinopoisk };
                        RatingsCache.set(cacheKey, result);
                        resolve(result);
                    } else {
                        RatingsCache.set(cacheKey, { score: null });
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }
    
    // ══════════════════════════════════════════════════════════════════
    // Allociné
    // ══════════════════════════════════════════════════════════════════

    function getAllocineId(imdbId, type) {
        return new Promise((resolve) => {
            if (!imdbId) { resolve(null); return; }
            const cacheKey = `allocine_id_${type}_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) { resolve(cached.id); return; }

            const prop = type === 'show' ? 'P1267' : 'P1265';
            const sparql = `SELECT ?allocine WHERE { ?item wdt:P345 "${imdbId}" . ?item wdt:${prop} ?allocine . } LIMIT 1`;
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql),
                onload(res) {
                    if (res.status !== 200) { resolve(null); return; }
                    let json;
                    try { json = JSON.parse(res.responseText); } catch { resolve(null); return; }
                    const b = json.results.bindings;
                    const allocineId = b.length && b[0].allocine?.value ? b[0].allocine.value : null;
                    RatingsCache.set(cacheKey, { id: allocineId });
                    resolve(allocineId);
                },
                onerror: () => resolve(null)
            });
        });
    }

    function fetchAllocineRatings(imdbId, type) {
        return new Promise((resolve) => {
            if (!imdbId || !isCorsProxyConfigured()) { resolve(null); return; }
            const cacheKey = `allocine_ratings_${type}_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) {
                resolve((cached.press || cached.audience) ? cached : null);
                return;
            }
            getAllocineId(imdbId, type).then(allocineId => {
                if (!allocineId) { RatingsCache.set(cacheKey, { press: null, audience: null }); resolve(null); return; }
                const pathSegment = type === 'show' ? 'series' : 'film';
                const fileSegment = type === 'show' ? `ficheserie_gen_cserie=${allocineId}` : `fichefilm_gen_cfilm=${allocineId}`;
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${CONFIG.CORS_PROXY_URL}https://www.allocine.fr/${pathSegment}/${fileSegment}.html`,
                    onload(res) {
                        if (res.status !== 200) { resolve(null); return; }
                        const html = res.responseText;
                        const foundRatings = [];
                        let match;
                        const ratingPattern = /class="stareval-note"[^>]*>\s*([\d][,.][\d])\s*<\/span>/g;
                        while ((match = ratingPattern.exec(html)) !== null) {
                            const val = parseFloat(match[1].replace(',', '.'));
                            if (val > 0 && val <= 5) foundRatings.push(val);
                        }
                        if (foundRatings.length === 0) {
                            const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
                            if (jsonLdMatch) {
                                for (const block of jsonLdMatch) {
                                    try {
                                        const jsonStr = block.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '');
                                        const jsonData = JSON.parse(jsonStr);
                                        if (jsonData.aggregateRating) {
                                            const rv = parseFloat(jsonData.aggregateRating.ratingValue);
                                            if (rv > 0 && rv <= 5) foundRatings.push(rv);
                                        }
                                    } catch (e) { }
                                }
                            }
                        }
                        if (foundRatings.length === 0) {
                            RatingsCache.set(cacheKey, { press: null, audience: null });
                            resolve(null);
                            return;
                        }
                        const result = { press: foundRatings[0] || null, audience: foundRatings[1] || null };
                        RatingsCache.set(cacheKey, result);
                        resolve(result);
                    },
                    onerror: () => resolve(null)
                });
            });
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // Award Badge Creators
    // ══════════════════════════════════════════════════════════════════

    function createAwardStatueBadge(options) {
        const { containerClass, textClass, separatorClass, logoClass, logoSrc, logoAlt,
                winIconKey, nomIconKey, wins, nominations, awardName, iconSize } = options;
        const nomOnly = Math.max(0, nominations - wins);
        const container = document.createElement('div');
        container.className = containerClass;

        const leadingSeparator = document.createElement('span');
        leadingSeparator.className = `${textClass} ${separatorClass}`;
        leadingSeparator.textContent = '•';
        container.appendChild(leadingSeparator);

        let titleText = `${awardName}:`;
        if (wins > 0) titleText += ` ${wins} Won`;
        if (wins > 0 && nomOnly > 0) titleText += ',';
        if (nomOnly > 0) titleText += ` ${nomOnly} Nominated`;

        const logo = document.createElement('img');
        logo.src = logoSrc;
        logo.alt = logoAlt;
        logo.className = logoClass;
        logo.title = titleText;
        container.appendChild(logo);

        const size = iconSize || 'clamp(1.1rem, 1.8vw, 1.4rem)';
        for (let i = 0; i < wins; i++) {
            const statue = document.createElement('img');
            statue.src = LOGO[winIconKey];
            statue.alt = `${awardName} Win`;
            statue.title = `${awardName} Win`;
            statue.style.cssText = `height:${size}; vertical-align:middle; margin-bottom: 4px; margin-left: -4px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));`;
            container.appendChild(statue);
        }
        if (wins > 0 && nomOnly > 0) {
            const gap = document.createElement('span');
            gap.style.cssText = 'display:inline-block; width:0px;';
            container.appendChild(gap);
        }
        for (let i = 0; i < nomOnly; i++) {
            const statue = document.createElement('img');
            statue.src = LOGO[nomIconKey];
            statue.alt = `${awardName} Nomination`;
            statue.title = `${awardName} Nomination`;
            statue.style.cssText = `height:${size}; vertical-align:middle; margin-bottom: 4px; margin-left: -4px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));`;
            container.appendChild(statue);
        }
        return container;
    }

    function createAcademyAwardsBadge(w, n) {
        return createAwardStatueBadge({ containerClass:'banner-oscars', textClass:'banner-oscar-text', separatorClass:'banner-oscar-leading-separator', logoClass:'banner-oscar-logo', logoSrc:LOGO.academy, logoAlt:'Academy Awards', winIconKey:'oscars_win', nomIconKey:'oscars_nom', wins:w, nominations:n, awardName:'Academy Awards' });
    }
    function createEmmyAwardsBadge(w, n) {
        return createAwardStatueBadge({ containerClass:'banner-emmys', textClass:'banner-emmy-text', separatorClass:'banner-emmy-leading-separator', logoClass:'banner-emmy-logo', logoSrc:LOGO.emmy, logoAlt:'Emmy Awards', winIconKey:'emmy_win', nomIconKey:'emmy_nom', wins:w, nominations:n, awardName:'Emmy Awards' });
    }
    function createGoldenGlobeAwardsBadge(w, n) {
        return createAwardStatueBadge({ containerClass:'banner-globes', textClass:'banner-globes-text', separatorClass:'banner-globes-leading-separator', logoClass:'banner-globes-logo', logoSrc:LOGO.globes, logoAlt:'Golden Globe Awards', winIconKey:'globes_win', nomIconKey:'globes_nom', wins:w, nominations:n, awardName:'Golden Globe Awards' });
    }
    function createBAFTAAwardsBadge(w, n) {
        return createAwardStatueBadge({ containerClass:'banner-bafta', textClass:'banner-bafta-text', separatorClass:'banner-bafta-leading-separator', logoClass:'banner-bafta-logo', logoSrc:LOGO.bafta, logoAlt:'BAFTA Awards', winIconKey:'bafta_win', nomIconKey:'bafta_nom', wins:w, nominations:n, awardName:'BAFTA Awards' });
    }
    function createRazzieAwardsBadge(w, n) {
        return createAwardStatueBadge({ containerClass:'banner-razzies', textClass:'banner-razzies-text', separatorClass:'banner-razzies-leading-separator', logoClass:'banner-razzies-logo', logoSrc:LOGO.razzies, logoAlt:'Razzie Awards', winIconKey:'razzies_win', nomIconKey:'razzies_nom', wins:w, nominations:n, awardName:'Razzie Awards' });
    }

    function createFestivalBadge(type, logoKey, alt, title, className) {
        const container = document.createElement('div');
        container.className = className;
        container.style.cssText = 'display:flex; align-items:center; gap:0.4rem;';
        const separator = document.createElement('span');
        separator.className = `${className.replace('banner-', 'banner-')}-text ${className}-leading-separator`;
        separator.textContent = '•';
        container.appendChild(separator);
        const logo = document.createElement('img');
        logo.src = LOGO[logoKey];
        logo.alt = alt;
        logo.title = title;
        logo.className = `${className}-logo`;
        container.appendChild(logo);
        return container;
    }

    function createBerlinaleBadge() {
        return createFestivalBadge('berlinale', 'berlinale', 'Goldener Bär (Berlinale)', 'Goldener Bär – Berlinale', 'banner-berlinale');
    }
    function createCannesBadge() {
        return createFestivalBadge('cannes', 'cannes', "Palme d'Or (Cannes)", "Palme d'Or – Festival de Cannes", 'banner-cannes');
    }
    function createVeneziaBadge(tier) {
        const isGold = tier === 'gold';
        return createFestivalBadge('venezia', isGold ? 'venezia_gold' : 'venezia_silver',
            isGold ? "Leone d'Oro (Venice)" : 'Gran Premio della Giuria (Venice)',
            isGold ? "Leone d'Oro – Venice Film Festival" : 'Gran Premio della Giuria – Venice Film Festival',
            'banner-venezia');
    }
   
    // ══════════════════════════════════════════════════════════════════
    // SponsorBlock
    // ══════════════════════════════════════════════════════════════════

    async function fetchSponsorBlockSegments(videoId) {
        if (!CONFIG.enableSponsorBlock || !videoId) return [];
        try {
            const categories = CONFIG.sponsorBlockCategories.map(c => `"${c}"`).join(',');
            const response = await fetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=[${categories}]`);
            if (!response.ok) return [];
            return await response.json() || [];
        } catch { return []; }
    }
    
    function startSponsorBlockMonitoring(player, videoId, itemId) {
        if (!CONFIG.enableSponsorBlock || STATE.skipIntervals[itemId]) return;
        const segments = STATE.sponsorBlockSegments[videoId] || [];
        if (segments.length === 0) return;
        const checkInterval = setInterval(() => {
            if (!player || !player.getCurrentTime) { clearInterval(checkInterval); delete STATE.skipIntervals[itemId]; return; }
            try {
                const currentTime = player.getCurrentTime();
                for (const segment of segments) {
                    const [start, end] = segment.segment;
                    if (currentTime >= start && currentTime < end) {
                        player.seekTo(end, true);
                        break;
                    }
                }
            } catch (e) { }
        }, 500);
        STATE.skipIntervals[itemId] = checkInterval;
    }
    
    function stopSponsorBlockMonitoring(itemId) {
        if (STATE.skipIntervals[itemId]) {
            clearInterval(STATE.skipIntervals[itemId]);
            delete STATE.skipIntervals[itemId];
        }
    }
    
    function loadYouTubeIframeAPI() {
        return new Promise((resolve) => {
            if (window.YT && window.YT.Player) { STATE.youtubeAPIReady = true; resolve(); return; }
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            const previousCallback = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (previousCallback) previousCallback();
                STATE.youtubeAPIReady = true;
                resolve();
            };
        });
    }
    
    function getTrailerUrl(item, apiClient) {
        if (item.RemoteTrailers && item.RemoteTrailers.length > 0) {
            const url = item.RemoteTrailers[0].Url;
            if (!url || url.trim() === '') return null;
            const videoId = extractYouTubeVideoId(url);
            if (!videoId) return null;
            return { url, videoId, isYouTube: true };
        }
        if (item.LocalTrailerIds && item.LocalTrailerIds.length > 0) {
            const trailerId = item.LocalTrailerIds[0];
            return {
                url: `${apiClient.serverAddress()}/Videos/${trailerId}/stream?static=true&api_key=${apiClient.accessToken()}`,
                isYouTube: false
            };
        }
        return null;
    }
    
    function extractYouTubeVideoId(url) {
        if (!url) return null;
        try {
            if (url.startsWith('plugin://')) {
                const match = url.match(/video_id=([a-zA-Z0-9_-]+)/);
                return match ? match[1] : null;
            }
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com')) return urlObj.searchParams.get('v');
            if (urlObj.hostname.includes('youtu.be')) return urlObj.pathname.substring(1);
        } catch (e) {
            const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|video_id=)([a-zA-Z0-9_-]+)/);
            return match ? match[1] : null;
        }
        return null;
    }
    
    function insertStyles() {
        if (document.getElementById("spotlight-css-emby")) return;
        
        const playbuttonColor = CONFIG.playbuttonColor;
        const top = parseColor(CONFIG.vignetteColorTop);
        const bottom = parseColor(CONFIG.vignetteColorBottom);
        const left = parseColor(CONFIG.vignetteColorLeft);
        const right = parseColor(CONFIG.vignetteColorRight);

        function gradientSteps(c) {
            const r = c.r, g = c.g, b = c.b;
            return `rgba(${r},${g},${b},1) 0%,rgba(${r},${g},${b},1) 2%,rgba(${r},${g},${b},1) 4%,rgba(${r},${g},${b},0.99) 6%,rgba(${r},${g},${b},0.97) 8%,rgba(${r},${g},${b},0.95) 10%,rgba(${r},${g},${b},0.9) 15%,rgba(${r},${g},${b},0.85) 20%,rgba(${r},${g},${b},0.75) 30%,rgba(${r},${g},${b},0.6) 40%,rgba(${r},${g},${b},0.4) 50%,rgba(${r},${g},${b},0.2) 70%,transparent 100%`;
        }
    
        const css = `
        .spotlight-container{width:100%;display:block;position:relative;margin:0;padding:0;transition:box-shadow .3s ease;border-radius:0;box-shadow:none;min-height:calc(100vh - 10rem)}
        .spotlight-container:hover{box-shadow:none;border-radius:0}
        .spotlight{position:relative;overflow:visible;width:100%;height:100%}
        .spotlight .banner-slider-wrapper{position:relative;width:100%;height:calc(100vh - 10rem);overflow:hidden;border-radius:0;-webkit-backface-visibility:hidden;backface-visibility:hidden;transform:translateZ(0)}
        .spotlight .banner-slider{display:flex;transition:transform .5s ease;will-change:transform;margin:0;padding:0;width:100%;height:100%}
        .spotlight .banner-item{flex:0 0 100%;min-width:100%;max-width:100%;height:100%;position:relative;cursor:pointer;margin:0;padding:0;box-sizing:border-box;overflow:hidden}
        .spotlight .banner-cover{width:100%;height:100%;object-fit:cover;object-position:center;display:block;pointer-events:none;margin:0;padding:0;border:0;outline:0;position:relative;transform-origin:center center;animation:zoomOut 8s ease-out forwards}
        @keyframes zoomOut{0%{transform:scale(1.15)}100%{transform:scale(1.0)}}
        .spotlight .video-backdrop{width:100vw;height:56.25vw;min-height:100vh;min-width:177.77vh;object-fit:cover;object-position:center;display:block;pointer-events:none;margin:0;padding:0;border:0;outline:0;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(1.2);z-index:1}
        .spotlight .youtube-backdrop,.spotlight .html5-backdrop{animation:none!important}
        .spotlight .youtube-backdrop{opacity:0;transition:opacity .5s ease-in}
        .spotlight .youtube-backdrop.video-ready{opacity:1}
        .spotlight .youtube-backdrop iframe{width:100%;height:100%;position:absolute;top:0;left:0;opacity:0;transition:opacity .5s ease-in}
        .spotlight .youtube-backdrop.video-ready iframe{opacity:1}
        .spotlight .video-placeholder{width:100%;height:100%;object-fit:cover;object-position:center;display:block;pointer-events:none;margin:0;padding:0;border:0;outline:0;position:absolute;top:0;left:0;z-index:2;transition:opacity .5s ease-out}
        .spotlight .video-placeholder.hidden{opacity:0;pointer-events:none}
        .spotlight .banner-gradient-left{position:absolute;top:0;bottom:0;left:0;width:50%;pointer-events:none;z-index:6;background:linear-gradient(to right,${gradientSteps(left)})}
        .spotlight .banner-gradient-right{position:absolute;top:0;bottom:0;right:0;width:40%;pointer-events:none;z-index:6;background:linear-gradient(to left,${gradientSteps(right)})}
        .spotlight .banner-vignette-top{position:absolute;top:0;left:0;right:0;height:50%;pointer-events:none;z-index:6;background:linear-gradient(to bottom,${gradientSteps(top)})}
        .spotlight .banner-vignette-bottom{position:absolute;bottom:0;left:0;right:0;height:50%;pointer-events:none;z-index:6;background:linear-gradient(to top,${gradientSteps(bottom)})}
        .spotlight .banner-logo{position:absolute;left:4vw;top:15vh;transform:none;max-width:35%;max-height:25vh;object-fit:contain;z-index:15;filter:drop-shadow(0 6px 20px rgba(0,0,0,0.95)) drop-shadow(0 0 40px rgba(0,0,0,0.6));pointer-events:none;cursor:default;transition:transform .5s ease,opacity .3s ease}
        .spotlight .banner-logo.hidden{opacity:0;pointer-events:none}
        .spotlight .banner-title{position:absolute;left:4vw;top:15vh;transform:none;z-index:10;font-size:clamp(2rem,4vw,3.5rem);font-weight:700;color:#fff;text-shadow:2px 2px 8px rgba(0,0,0,0.9);pointer-events:none;cursor:default;text-align:left;max-width:35%;transition:transform .5s ease,opacity .3s ease}
        .spotlight .banner-title.hidden{opacity:0;pointer-events:none}
        .spotlight .banner-overview{margin-top:.8rem;max-width:45%;padding:0;background:none;pointer-events:none;cursor:default}
        .spotlight .banner-overview-text{font-size:clamp(1rem,1.6vw,1.3rem);color:rgba(255,255,255,0.9);text-shadow:2px 2px 8px rgba(0,0,0,0.99),0 0 20px rgba(0,0,0,0.9);font-weight:500;line-height:1.6;text-align:left;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis}
        @media(max-width:1600px),(orientation:portrait){.spotlight .banner-overview,.spotlight .banner-overview-text{visibility:hidden}}
        .spotlight .banner-tagline{display:none!important}
        .spotlight .banner-info{position:absolute;left:4vw;bottom:1.5rem;z-index:10;display:flex;flex-direction:column;align-items:flex-start;gap:.5rem;pointer-events:none;max-width:80%}
        .spotlight .banner-genres{display:flex;gap:.8rem;flex-wrap:wrap;justify-content:flex-start}
        .spotlight .banner-genre{font-size:clamp(1.1rem,1.8vw,1.4rem);color:rgba(255,255,255,0.9);text-shadow:1px 1px 4px rgba(0,0,0,0.9);font-weight:500}
        .spotlight .banner-genre:not(:last-child)::after{content:'•';margin-left:1.5rem;opacity:.6}
        .spotlight .banner-meta{display:flex;gap:1.2rem;align-items:center;flex-wrap:wrap;justify-content:flex-start}
        .spotlight .banner-meta-item{font-size:clamp(1.1rem,1.8vw,1.4rem);color:rgba(255,255,255,0.85);text-shadow:1px 1px 4px rgba(0,0,0,0.9);font-weight:500}
        .spotlight .meta-rating-item{display:flex;align-items:center;gap:.4rem}
        .spotlight .meta-rating-icon{width:1.8rem;height:1.8rem;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))}
        .spotlight .meta-rating-star{width:1.8rem;height:1.8rem;fill:#cb272a;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))}
        .spotlight .meta-rating-score{font-size:clamp(1.1rem,1.8vw,1.4rem);font-weight:500;color:rgba(255,255,255,0.85);text-shadow:1px 1px 4px rgba(0,0,0,0.9)}
        .spotlight .custom-ratings-container{display:flex;gap:1rem;flex-wrap:wrap;align-items:center}
        .spotlight .custom-rating-item{display:flex;align-items:center;gap:.3rem}
        .spotlight .custom-rating-logo{height:1.6rem;width:auto;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))}
        .spotlight .custom-rating-value{font-size:clamp(1rem,1.6vw,1.3rem);font-weight:500;color:rgba(255,255,255,0.85);text-shadow:1px 1px 4px rgba(0,0,0,0.9)}
        .spotlight .play-button-overlay{position:absolute;top:5rem;right:1.5rem;z-index:25;opacity:0;transition:opacity .3s ease;pointer-events:none}
        .spotlight-container:hover .play-button-overlay{opacity:1;pointer-events:all}
        .spotlight .banner-genres-row{display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap}
        .spotlight .banner-awards-row{display:none;align-items:center;gap:.6rem;flex-wrap:wrap}
        .spotlight .banner-awards-row.has-awards{display:flex}
        .spotlight .banner-oscars,.spotlight .banner-globes,.spotlight .banner-emmys,.spotlight .banner-bafta,.spotlight .banner-razzies,.spotlight .banner-berlinale,.spotlight .banner-cannes,.spotlight .banner-venezia{display:flex;align-items:center;gap:.4rem}
        .banner-oscar-text.banner-oscar-leading-separator,.banner-globes-text.banner-globes-leading-separator,.banner-emmy-text.banner-emmy-leading-separator,.banner-bafta-text.banner-bafta-leading-separator,.banner-razzies-text.banner-razzies-leading-separator,.banner-berlinale-text.banner-berlinale-leading-separator,.banner-cannes-text.banner-cannes-leading-separator,.banner-venezia-text.banner-venezia-leading-separator{color:rgba(255,255,255,0.5);font-size:clamp(1.1rem,1.8vw,1.4rem);font-weight:500;text-shadow:1px 1px 4px rgba(0,0,0,0.9);margin-left:.5em;margin-right:.7em}
        .spotlight .banner-awards-row>:first-child .banner-oscar-leading-separator,.spotlight .banner-awards-row>:first-child .banner-globes-leading-separator,.spotlight .banner-awards-row>:first-child .banner-emmy-leading-separator,.spotlight .banner-awards-row>:first-child .banner-bafta-leading-separator,.spotlight .banner-awards-row>:first-child .banner-razzies-leading-separator,.spotlight .banner-awards-row>:first-child .banner-berlinale-leading-separator,.spotlight .banner-awards-row>:first-child .banner-cannes-leading-separator,.spotlight .banner-awards-row>:first-child .banner-venezia-leading-separator{display:none}
        .spotlight .banner-oscar-logo,.spotlight .banner-globes-logo,.spotlight .banner-emmy-logo,.spotlight .banner-bafta-logo,.spotlight .banner-razzies-logo,.spotlight .banner-berlinale-logo,.spotlight .banner-cannes-logo,.spotlight .banner-venezia-logo{height:clamp(1.1rem,1.8vw,1.4rem);width:auto;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8));margin-bottom:3px;margin-right:5px;margin-left:0}
        .spotlight .play-button{width:80px;height:80px;border-radius:50%;background:rgba(55,55,55,0.3);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.4)}
        .spotlight .play-button:hover{transform:scale(1.02);background:${playbuttonColor};box-shadow:0 6px 20px rgba(0,0,0,0.5)}
        .spotlight .play-button svg{width:40px;height:40px;fill:#fff;margin-left:6px;position:relative;left:-2px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));transition:filter .3s ease}
        .spotlight .play-button:hover svg{filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5))}
        .spotlight .pause-button{position:absolute;bottom:8rem;right:2rem;z-index:25;width:50px;height:50px;border-radius:50%;background:rgba(55,55,55,0.3);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.4);opacity:0;pointer-events:none}
        .spotlight-container:hover .pause-button.visible{opacity:1;pointer-events:all}
        .spotlight .pause-button:hover{transform:scale(1.02);background:${playbuttonColor};box-shadow:0 6px 20px rgba(0,0,0,0.5)}
        .spotlight .pause-button svg{width:24px;height:24px;fill:#fff;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));transition:filter .3s ease}
        .spotlight .pause-button:hover svg{filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5))}
        .spotlight .mute-button{position:absolute;bottom:4rem;right:2rem;z-index:25;width:50px;height:50px;border-radius:50%;background:rgba(55,55,55,0.3);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.4);opacity:0;pointer-events:none}
        .spotlight-container:hover .mute-button.visible{opacity:1;pointer-events:all}
        .spotlight .mute-button:hover{transform:scale(1.02);background:${playbuttonColor};box-shadow:0 6px 20px rgba(0,0,0,0.5)}
        .spotlight .mute-button svg{width:24px;height:24px;fill:#fff;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));transition:filter .3s ease}
        .spotlight .mute-button:hover svg{filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5))}
        .spotlight .refresh-button{position:absolute;bottom:12rem;right:2rem;z-index:25;width:50px;height:50px;border-radius:50%;background:rgba(55,55,55,0.3);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.4);opacity:0;pointer-events:none}
        .spotlight-container:hover .refresh-button.visible{opacity:1;pointer-events:all}
        .spotlight .refresh-button:hover{transform:scale(1.02) rotate(180deg);background:${playbuttonColor};box-shadow:0 6px 20px rgba(0,0,0,0.5)}
        .spotlight .refresh-button svg{width:24px;height:24px;fill:#fff;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));transition:filter .3s ease}
        .spotlight .refresh-button:hover svg{filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5))}
        .spotlight .refresh-button.refreshing{animation:spin 1s linear infinite}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media(max-width:768px),(orientation:portrait){.spotlight .refresh-button{bottom:calc(1rem + 100px + 1rem);right:1rem}}
        .spotlight .arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:20;border:none;color:#fff;cursor:pointer;opacity:.7;padding:0;background:none;transition:opacity .3s;display:flex;align-items:center;justify-content:center}
        .spotlight .arrow svg{filter:drop-shadow(0 2px 6px rgba(0,0,0,0.8))}
        .spotlight .arrow:hover{opacity:1}
        .spotlight .arrow.left{left:1rem}
        .spotlight .arrow.right{right:1rem}
        .spotlight .controls{position:absolute;right:2rem;bottom:2.3rem;z-index:20;display:flex;gap:.5rem}
        .spotlight .control{width:.8rem;height:.8rem;border-radius:50%;background:rgba(255,255,255,0.4);border:none;cursor:pointer;transition:background .3s}
        .spotlight .control.active{background:#fff}
        .spotlight .loader{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:30;background:rgba(0,0,0,0.3)}
        @media(max-width:768px),(orientation:portrait){
            .spotlight-container{min-height:60vh}
            .spotlight .banner-slider-wrapper{height:60vh}
            .spotlight .video-backdrop{width:100%;height:100%;position:relative;top:auto;left:auto;transform:none;min-height:unset;min-width:unset}
            .spotlight .banner-logo,.spotlight .banner-title,.spotlight .banner-overview{left:50%;transform:translateX(-50%);max-width:70%;text-align:center}
            .spotlight .banner-overview-text{text-align:center}
            .spotlight .banner-info{left:50%;transform:translateX(-50%);max-width:85%;align-items:center}
            .spotlight .banner-genres,.spotlight .banner-meta{justify-content:center}
            .spotlight .control{display:none}
            .spotlight .pause-button{bottom:1rem;right:calc(1rem + 50px + 1rem)}
            .spotlight .mute-button{bottom:1rem;right:1rem}
        }`;
        
        const s = document.createElement("style");
        s.id = "spotlight-css-emby";
        s.innerHTML = css;
        document.head.appendChild(s);
    }
    
    function buildQuery() {
        return {
            IncludeItemTypes: "Movie,Series",
            Recursive: true,
            Limit: 100,
            IsPlayed: false,
            Years: "2020,2021,2022,2023,2024,2025,2026",
            SortBy: "Random",
            SortOrder: "Descending",
            EnableImageTypes: "Primary,Backdrop,Thumb,Logo,Banner",
            EnableUserData: false,
            EnableTotalRecordCount: false,
            Fields: "PrimaryImageAspectRatio,BackdropImageTags,ImageTags,ParentLogoImageTag,ParentLogoItemId,CriticRating,CommunityRating,OfficialRating,PremiereDate,ProductionYear,Genres,RunTimeTicks,Taglines,Overview,RemoteTrailers,LocalTrailerIds,ProviderIds"
        };
    }
    
    function getImageUrl(apiClient, item, options) {
        options = options || {};
        const width = options.width || CONFIG.imageWidth;
        if (item.ImageUrl) {
            let url = item.ImageUrl;
            if (options.addImageSizeToUrl && width) url += "&maxWidth=" + width;
            return url;
        }
        const tags = item.ImageTags || {};
        if (item.BackdropImageTags && item.BackdropImageTags.length)
            return apiClient.getImageUrl(item.Id, { type: "Backdrop", maxWidth: width, tag: item.BackdropImageTags[0] });
        if (tags.Primary)
            return apiClient.getImageUrl(item.Id, { type: "Primary", maxWidth: width, tag: tags.Primary });
        if (tags.Thumb)
            return apiClient.getImageUrl(item.Id, { type: "Thumb", maxWidth: width, tag: tags.Thumb });
        return apiClient.getImageUrl(item.Id, { type: "Primary", maxWidth: width });
    }
    
    function getLogoUrl(apiClient, item) {
        const tags = item.ImageTags || {};
        return tags.Logo ? apiClient.getImageUrl(item.Id, { type: "Logo", maxWidth: 800, tag: tags.Logo }) : null;
    }
    
    async function loadCustomItemsList() {
        try {
            const response = await fetch(CONFIG.customItemsFile);
            if (!response.ok) return null;
            const text = await response.text();
            const itemIds = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#')).filter(l => /^[a-zA-Z0-9]+$/.test(l));
            return itemIds.length > 0 ? itemIds : null;
        } catch { return null; }
    }
    
    async function fetchItemsByIds(apiClient, itemIds) {
        const items = [];
        const userId = apiClient.getCurrentUserId();
        for (const itemId of itemIds) {
            try {
                const item = await apiClient.getItem(userId, itemId);
                if (item) {
                    if (item.Type === "BoxSet" || item.CollectionType === "boxsets") {
                        const coll = await apiClient.getItems(userId, {
                            ParentId: itemId, Recursive: true, IncludeItemTypes: "Movie,Series",
                            Fields: "PrimaryImageAspectRatio,BackdropImageTags,ImageTags,ParentLogoImageTag,ParentLogoItemId,CriticRating,CommunityRating,OfficialRating,PremiereDate,ProductionYear,Genres,RunTimeTicks,Taglines,Overview,RemoteTrailers,LocalTrailerIds,ProviderIds"
                        });
                        if (coll?.Items) items.push(...coll.Items);
                    } else items.push(item);
                }
            } catch (e) { }
        }
        return items;
    }
    
    async function fetchStandardItems(apiClient) {
        try {
            const items = await apiClient.getItems(apiClient.getCurrentUserId(), buildQuery());
            return shuffleArray(items.Items || []).slice(0, CONFIG.limit);
        } catch { return []; }
    }
    
    async function fetchItems(apiClient) {
        const customItemIds = await loadCustomItemsList();
        if (customItemIds?.length > 0) {
            const items = await fetchItemsByIds(apiClient, customItemIds);
            if (items.length > 0) return shuffleArray(items).slice(0, Math.min(CONFIG.limit, items.length));
        }
        return fetchStandardItems(apiClient);
    }

    // ══════════════════════════════════════════════════════════════════
    // LAZY ENRICHMENT — Awards + Ratings loaded AFTER slide is visible
    // ══════════════════════════════════════════════════════════════════

    function enrichSlideWithAwards(bannerItem, item) {
        const imdbId = getImdbId(item);
        if (!imdbId) return;
        
        const awardsRow = bannerItem.querySelector('.banner-awards-row');
        if (!awardsRow) return;

        // Use combined query instead of 8 separate ones
        fetchAllAwardsCombined(imdbId).then(awards => {
            if (!awards) return;
            
            let hasAwards = false;

            // Oscars
            if (awards.oscars.wins > 0 || awards.oscars.nominations > 0) {
                awardsRow.appendChild(createAcademyAwardsBadge(awards.oscars.wins, awards.oscars.nominations));
                hasAwards = true;
            }
            // Golden Globes
            if (awards.globes.wins > 0 || awards.globes.nominations > 0) {
                awardsRow.appendChild(createGoldenGlobeAwardsBadge(awards.globes.wins, awards.globes.nominations));
                hasAwards = true;
            }
            // Emmys
            if (awards.emmys.wins > 0 || awards.emmys.nominations > 0) {
                awardsRow.appendChild(createEmmyAwardsBadge(awards.emmys.wins, awards.emmys.nominations));
                hasAwards = true;
            }
            // BAFTA
            if (awards.bafta.wins > 0 || awards.bafta.nominations > 0) {
                awardsRow.appendChild(createBAFTAAwardsBadge(awards.bafta.wins, awards.bafta.nominations));
                hasAwards = true;
            }
            // Razzies
            if (awards.razzies.wins > 0 || awards.razzies.nominations > 0) {
                awardsRow.appendChild(createRazzieAwardsBadge(awards.razzies.wins, awards.razzies.nominations));
                hasAwards = true;
            }
            // Berlinale
            if (awards.berlinale) {
                awardsRow.appendChild(createBerlinaleBadge());
                hasAwards = true;
            }
            // Cannes
            if (awards.cannes) {
                awardsRow.appendChild(createCannesBadge());
                hasAwards = true;
            }
            // Venice
            if (awards.venice.gold || awards.venice.silver) {
                awardsRow.appendChild(createVeneziaBadge(awards.venice.gold ? 'gold' : 'silver'));
                hasAwards = true;
            }

            if (hasAwards) awardsRow.classList.add('has-awards');
        }).catch(err => {
            console.warn('[Spotlight] Combined awards fetch error:', err);
        });
    }

    function enrichSlideWithRatings(bannerItem, item) {
        const metaDiv = bannerItem.querySelector('.banner-meta');
        if (!metaDiv) return;
        
        const tmdbId = getTmdbId(item);
        const imdbId = getImdbId(item);
        const type = item.Type === 'Series' ? 'show' : 'movie';
        
        if (!CONFIG.enableCustomRatings || !tmdbId) {
            // Fallback: Emby built-in ratings
            if (item.CriticRating !== null && item.CriticRating !== undefined) {
                const rtRating = document.createElement("div");
                rtRating.className = "meta-rating-item banner-meta-item";
                const tomatoImg = item.CriticRating >= 60 ? 'fresh.png' : 'rotten.png';
                rtRating.innerHTML = `<img src="modules/mediainfo/${tomatoImg}" class="meta-rating-icon" alt="RT"><span class="meta-rating-score">${item.CriticRating}%</span>`;
                metaDiv.appendChild(rtRating);
            }
            if (item.CommunityRating) {
                const imdbRating = document.createElement("div");
                imdbRating.className = "meta-rating-item banner-meta-item";
                imdbRating.innerHTML = `<svg class="meta-rating-star" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><span class="meta-rating-score">${item.CommunityRating.toFixed(1)}</span>`;
                metaDiv.appendChild(imdbRating);
            }
            return;
        }

        fetchMDBListRatings(type, tmdbId, item).then(async (ratingsData) => {
            if (!ratingsData) return;
            
            const hasRTFromMDBList = ratingsData._hasRTFromMDBList;
            
            function addRatingBadge(logo, alt, key, value, title, ratingType) {
                const ratingItem = document.createElement("div");
                ratingItem.className = "custom-rating-item";
                const img = document.createElement("img");
                img.src = logo; img.alt = alt; img.className = "custom-rating-logo";
                img.title = title; img.dataset.source = key; img.dataset.ratingType = ratingType || '';
                const val = document.createElement("span");
                val.className = "custom-rating-value"; val.textContent = value;
                ratingItem.appendChild(img); ratingItem.appendChild(val);
                metaDiv.appendChild(ratingItem);
            }
            
            ratingsData.ratings.forEach(rating => {
                addRatingBadge(rating.logo, rating.source, rating.key, rating.value,
                    `${rating.source}: ${rating.value}${rating.votes ? ` (${rating.votes} votes)` : ''}`,
                    rating._isCritics ? 'critics' : (rating._isAudience ? 'audience' : ''));
            });
            
            // RT FALLBACK (no RT from MDBList)
            if (!hasRTFromMDBList && imdbId && CONFIG.enableRottenTomatoes) {
                const rtDirect = await fetchRottenTomatoesDirectly(imdbId, type);
                if (rtDirect) {
                    if (rtDirect.criticsScore !== null) {
                        const logo = rtDirect.criticsScore < 60 ? 'tomatoes_rotten' :
                                    (rtDirect.criticsCertified ? 'tomatoes_certified' : 'tomatoes');
                        addRatingBadge(LOGO[logo], 'RT', logo, rtDirect.criticsScore, `Rotten Tomatoes: ${rtDirect.criticsScore}%`, 'critics');
                    }
                    if (rtDirect.audienceScore !== null) {
                        const logo = rtDirect.audienceScore < 60 ? 'audience_rotten' :
                                    (rtDirect.audienceCertified ? 'rotten_ver' : 'audience');
                        addRatingBadge(LOGO[logo], 'RT Audience', logo, rtDirect.audienceScore, `RT Audience: ${rtDirect.audienceScore}%`, 'audience');
                    }
                }
            }
            // RT UPGRADE (verify certified/verified_hot status)
            else if (hasRTFromMDBList && imdbId && CONFIG.enableRottenTomatoes) {
                const tomatoesScore = ratingsData._tomatoesScore;
                const audienceScore = ratingsData._audienceScore;
                if (tomatoesScore >= 60 || audienceScore >= 60) {
                    fetchRTCertifiedStatus(imdbId, type).then(rtStatus => {
                        metaDiv.querySelectorAll('.custom-rating-logo').forEach(logoImg => {
                            const ratingType = logoImg.dataset.ratingType;
                            const currentSource = logoImg.dataset.source;
                            if (ratingType === 'critics' && tomatoesScore >= 60 && rtStatus.criticsCertified !== null) {
                                if (rtStatus.criticsCertified && currentSource !== 'tomatoes_certified') {
                                    logoImg.src = LOGO.tomatoes_certified; logoImg.dataset.source = 'tomatoes_certified';
                                } else if (!rtStatus.criticsCertified && currentSource === 'tomatoes_certified') {
                                    logoImg.src = LOGO.tomatoes; logoImg.dataset.source = 'tomatoes';
                                }
                            }
                            if (ratingType === 'audience' && audienceScore >= 60 && rtStatus.audienceCertified !== null) {
                                if (rtStatus.audienceCertified && currentSource !== 'rotten_ver') {
                                    logoImg.src = LOGO.rotten_ver; logoImg.dataset.source = 'rotten_ver';
                                } else if (!rtStatus.audienceCertified && currentSource === 'rotten_ver') {
                                    logoImg.src = LOGO.audience; logoImg.dataset.source = 'audience';
                                }
                            }
                        });
                    });
                }
            }
            
            // AniList
            if (imdbId && CONFIG.enableAniList) {
                const anilistRating = await fetchAniListRating(imdbId, ratingsData.originalTitle, ratingsData.year);
                if (anilistRating?.score)
                    addRatingBadge(LOGO.anilist, 'AniList', 'anilist', anilistRating.score, `AniList: ${anilistRating.score}`, '');
            }
            // Kinopoisk
            if (ratingsData.originalTitle && ratingsData.year && CONFIG.enableKinopoisk) {
                const kpRating = await fetchKinopoiskRating(ratingsData.originalTitle, parseInt(ratingsData.year, 10), type);
                if (kpRating?.score)
                    addRatingBadge(LOGO.kinopoisk, 'Kinopoisk', 'kinopoisk', kpRating.score, `Kinopoisk: ${kpRating.score}`, '');
            }
            // Allociné
            if (imdbId && CONFIG.enableAllocine) {
                const allocineData = await fetchAllocineRatings(imdbId, type);
                if (allocineData) {
                    if (allocineData.press)
                        addRatingBadge(LOGO.allocine_critics, 'Allociné Presse', 'allocine_critics', allocineData.press.toFixed(1), `Allociné Presse: ${allocineData.press.toFixed(1)} / 5`, '');
                    if (allocineData.audience)
                        addRatingBadge(LOGO.allocine_audience, 'Allociné Spectateurs', 'allocine_audience', allocineData.audience.toFixed(1), `Allociné Spectateurs: ${allocineData.audience.toFixed(1)} / 5`, '');
                }
            }
        });
    }

    /**
     * Enrich a slide with awards + ratings — called lazily when slide becomes visible.
     * Prevents duplicate enrichment via STATE.enrichedSlides.
     */
    function enrichSlide(slideIndex, slider, items) {
        const slide = slider.children[slideIndex];
        if (!slide) return;
        
        const itemId = slide.dataset.itemId;
        if (!itemId) return;
        
        // Skip if already enriched or clone
        const enrichKey = `${slideIndex}_${itemId}`;
        if (STATE.enrichedSlides.has(enrichKey)) return;
        STATE.enrichedSlides.add(enrichKey);
        
        // Find the matching item
        const item = items.find(it => it.Id === itemId);
        if (!item) return;
        
        console.log(`[Spotlight] Enriching slide ${slideIndex} for "${item.Name}"`);
        
        // Fire-and-forget: load awards and ratings in parallel
        enrichSlideWithAwards(slide, item);
        enrichSlideWithRatings(slide, item);
    }

    /**
     * Pre-enrich nearby slides (current + neighbors)
     */
    function enrichNearbySlides(currentIndex, slider, items, itemsCount) {
        // Enrich current slide
        enrichSlide(currentIndex, slider, items);
        
        // Enrich neighbors (next and previous)
        const prevIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : itemsCount;
        const nextIndex = currentIndex + 1 <= itemsCount + 1 ? currentIndex + 1 : 1;
        
        // Delay neighbor enrichment slightly to prioritize current slide
        setTimeout(() => {
            enrichSlide(nextIndex, slider, items);
            enrichSlide(prevIndex, slider, items);
        }, 200);
    }

    // ══════════════════════════════════════════════════════════════════
    // SYNCHRONOUS Banner Element Creation (no awaiting ratings/awards)
    // ══════════════════════════════════════════════════════════════════

    function createInfoElementSync(item) {
        const infoContainer = document.createElement("div");
        infoContainer.className = "banner-info";
        
        // Overview
        if (item.Overview) {
            const overviewContainer = document.createElement("div");
            overviewContainer.className = "banner-overview";
            const overviewText = document.createElement("div");
            overviewText.className = "banner-overview-text";
            overviewText.textContent = item.Overview;
            overviewContainer.appendChild(overviewText);
            infoContainer.appendChild(overviewContainer);
        }

        // Awards Row (empty, will be filled lazily)
        const awardsRow = document.createElement("div");
        awardsRow.className = "banner-awards-row";
        infoContainer.appendChild(awardsRow);

        // Genres Row
        const genresRow = document.createElement("div");
        genresRow.className = "banner-genres-row";
        if (item.ProductionYear) {
            const yearSpan = document.createElement("span");
            yearSpan.className = "banner-genre";
            yearSpan.textContent = item.ProductionYear;
            genresRow.appendChild(yearSpan);
        }
        if (item.RunTimeTicks) {
            const runtimeSpan = document.createElement("span");
            runtimeSpan.className = "banner-genre";
            runtimeSpan.textContent = formatRuntime(Math.round(item.RunTimeTicks / 600000000));
            genresRow.appendChild(runtimeSpan);
        }
        if (item.Genres?.length > 0) {
            item.Genres.slice(0, 3).forEach(genre => {
                const genreSpan = document.createElement("span");
                genreSpan.className = "banner-genre";
                genreSpan.textContent = genre;
                genresRow.appendChild(genreSpan);
            });
        }
        infoContainer.appendChild(genresRow);

        // Meta Row (empty, will be filled lazily by enrichSlideWithRatings)
        const metaDiv = document.createElement("div");
        metaDiv.className = "banner-meta";
        infoContainer.appendChild(metaDiv);
        
        return infoContainer;
    }

    function createImageBackdrop(item, apiClient) {
        const img = document.createElement("img");
        img.className = "banner-cover";
        img.draggable = false;
        img.alt = item.Name || "";
        img.loading = "eager";
        img.decoding = "async";
        img.src = getImageUrl(apiClient, item, { width: CONFIG.imageWidth, prefer: "Backdrop" });
        return img;
    }
    
    async function createYouTubeBackdrop(item, videoId, apiClient, loadSponsorBlockNow = false) {
        if (!videoId) return createImageBackdrop(item, apiClient);
        
        if (CONFIG.enableSponsorBlock) {
            const sbPromise = fetchSponsorBlockSegments(videoId).then(segments => {
                if (segments.length > 0) STATE.sponsorBlockSegments[videoId] = segments;
            });
            if (loadSponsorBlockNow) await sbPromise;
        }
    
        const containerId = `yt-player-${item.Id}`;
        const wrapper = document.createElement("div");
        wrapper.className = "video-backdrop-wrapper";
        wrapper.style.cssText = "position:relative;width:100%;height:100%";
        
        const placeholder = document.createElement("img");
        placeholder.className = "banner-cover video-placeholder";
        placeholder.draggable = false;
        placeholder.alt = item.Name || "";
        placeholder.src = getImageUrl(apiClient, item, { width: CONFIG.imageWidth, prefer: "Backdrop" });
        
        const container = document.createElement("div");
        container.id = containerId;
        container.className = "banner-cover video-backdrop youtube-backdrop";
        container.dataset.videoId = videoId;
        container.dataset.itemId = item.Id;
        
        wrapper.appendChild(placeholder);
        wrapper.appendChild(container);
        
        await loadYouTubeIframeAPI();
        
        setTimeout(() => {
            const player = new YT.Player(containerId, {
                height: '100%', width: '100%', videoId,
                playerVars: {
                    autoplay: 0, mute: 1, controls: 0, disablekb: 1, fs: 0,
                    iv_load_policy: 3, rel: 0, loop: 0, modestbranding: 1,
                    playsinline: 1, suggestedQuality: CONFIG.preferredVideoQuality
                },
                events: {
                    'onReady': (event) => {
                        event.target._videoId = videoId;
                        event.target._itemId = item.Id;
                        event.target._containerId = containerId;
                        event.target.mute();
                        STATE.videoPlayers[item.Id] = event.target;
                        STATE.videoReadyStates[item.Id] = false;
                        
                        const bannerItem = container.closest('.banner-item');
                        const sl = container.closest('.banner-slider');
                        if (sl && bannerItem === sl.children[1]) {
                            setTimeout(() => playCurrentSlideVideo(item.Id), 800);
                        }
                    },
                    'onStateChange': (event) => {
                        handleYouTubeStateChange(event, item, videoId, containerId);
                    }
                }
            });
        }, 100);
        
        return wrapper;
    }

    function handleYouTubeStateChange(event, item, videoId, containerId) {
        const playerState = event.data;
        
        if (playerState === YT.PlayerState.PLAYING) {
            STATE.isPaused = false;
            updatePauseButtonIcon();
            startSponsorBlockMonitoring(event.target, videoId, item.Id);
            
            const ytContainer = document.getElementById(containerId);
            if (!ytContainer) return;
            const wrapper = ytContainer.closest('.video-backdrop-wrapper');
            const currentPlaceholder = wrapper?.querySelector('.video-placeholder');
            
            if (currentPlaceholder && !currentPlaceholder.classList.contains('hidden')) {
                setTimeout(() => {
                    ytContainer.classList.add('video-ready');
                    setTimeout(() => currentPlaceholder.classList.add('hidden'), 300);
                }, 500);
            } else {
                ytContainer.classList.add('video-ready');
            }
        } else if (playerState === YT.PlayerState.PAUSED) {
            STATE.isPaused = true;
            updatePauseButtonIcon();
            stopSponsorBlockMonitoring(item.Id);
        } else if (playerState === YT.PlayerState.ENDED) {
            stopSponsorBlockMonitoring(item.Id);
            
            const ytContainer = document.getElementById(containerId);
            const wrapper = ytContainer?.closest('.video-backdrop-wrapper');
            const currentPlaceholder = wrapper?.querySelector('.video-placeholder');
            if (currentPlaceholder) currentPlaceholder.classList.remove('hidden');
            if (ytContainer) ytContainer.classList.remove('video-ready');
            
            if (CONFIG.waitForTrailerToEnd) {
                setTimeout(() => {
                    const rightArrow = document.querySelector('.spotlight .arrow.right');
                    if (rightArrow) rightArrow.click();
                }, 500);
            }
        }
    }
    
    function createHTML5VideoBackdrop(item, url) {
        const video = document.createElement("video");
        video.className = "banner-cover video-backdrop html5-backdrop";
        video.src = url;
        video.autoplay = false;
        video.loop = false;
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.dataset.itemId = item.Id;
        
        video.addEventListener('play', () => { STATE.isPaused = false; updatePauseButtonIcon(); });
        video.addEventListener('pause', () => { STATE.isPaused = true; updatePauseButtonIcon(); });
        video.addEventListener('ended', () => {
            if (CONFIG.waitForTrailerToEnd) {
                setTimeout(() => {
                    const rightArrow = document.querySelector('.spotlight .arrow.right');
                    if (rightArrow) rightArrow.click();
                }, 500);
            }
        });
        
        STATE.videoPlayers[item.Id] = video;
        return video;
    }
    
    /**
     * Creates banner element SYNCHRONOUSLY for fast initial render.
     * Video setup is deferred. Ratings/Awards loaded lazily.
     */
    function createBannerElementSync(item, apiClient) {
        const div = document.createElement("div");
        div.className = "banner-item";
        
        // Always start with image backdrop (fast)
        const backdropElement = createImageBackdrop(item, apiClient);
        div.appendChild(backdropElement);
        
        // Check if video should be loaded later
        const trailerData = getTrailerUrl(item, apiClient);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const shouldPlayVideo = CONFIG.enableVideoBackdrop && trailerData?.videoId && (!isMobile || CONFIG.enableMobileVideo);
        div.dataset.hasVideo = shouldPlayVideo ? 'true' : 'false';
        div.dataset.videoSetup = 'false';
        if (shouldPlayVideo) {
            div.dataset.trailerIsYouTube = trailerData.isYouTube ? 'true' : 'false';
            div.dataset.trailerVideoId = trailerData.videoId || '';
            div.dataset.trailerUrl = trailerData.url || '';
        }
        
        // Vignettes
        ['banner-gradient-left', 'banner-gradient-right', 'banner-vignette-top', 'banner-vignette-bottom'].forEach(cls => {
            const el = document.createElement("div");
            el.className = cls;
            div.appendChild(el);
        });
        
        // Logo or Title
        const logoUrl = getLogoUrl(apiClient, item);
        if (logoUrl) {
            const logo = document.createElement("img");
            logo.className = "banner-logo";
            logo.src = logoUrl;
            logo.alt = (item.Name || "") + " Logo";
            logo.draggable = false;
            div.appendChild(logo);
        } else {
            const title = document.createElement("div");
            title.className = "banner-title";
            title.textContent = item.Name || "";
            div.appendChild(title);
        }
        
        // Info (synchronous — no ratings/awards yet)
        const info = createInfoElementSync(item);
        div.appendChild(info);
        
        div.dataset.itemId = item.Id;
        if (item.ServerId) div.dataset.serverId = item.ServerId;
        
        return div;
    }

    /**
     * Setup video backdrop for a slide (called lazily when slide becomes active)
     */
    async function setupVideoForSlide(bannerItem, item, apiClient, loadSponsorBlockNow) {
        if (bannerItem.dataset.videoSetup === 'true') return;
        if (bannerItem.dataset.hasVideo !== 'true') return;
        
        bannerItem.dataset.videoSetup = 'true';
        
        const isYouTube = bannerItem.dataset.trailerIsYouTube === 'true';
        const videoId = bannerItem.dataset.trailerVideoId;
        const trailerUrl = bannerItem.dataset.trailerUrl;
        
        // Keep existing image as fallback
        const existingImg = bannerItem.querySelector('.banner-cover:not(.video-backdrop)');
        
        let videoElement;
        if (isYouTube && videoId) {
            videoElement = await createYouTubeBackdrop(item, videoId, apiClient, loadSponsorBlockNow);
        } else if (trailerUrl) {
            videoElement = createHTML5VideoBackdrop(item, trailerUrl);
        }
        
        if (videoElement && existingImg) {
            existingImg.parentNode.insertBefore(videoElement, existingImg);
            // Keep image as placeholder for YouTube
            if (isYouTube) {
                existingImg.remove(); // YouTube wrapper has its own placeholder
            } else {
                existingImg.remove();
            }
        }
    }
    
    function buildSliderSync(items, apiClient) {
        const container = document.createElement("div");
        container.className = "spotlight-container";
        container.id = SPOTLIGHT_CONTAINER_ID;
        
        const spotlight = document.createElement("div");
        spotlight.className = "spotlight";
        
        const sliderWrapper = document.createElement("div");
        sliderWrapper.className = "banner-slider-wrapper";
        
        const slider = document.createElement("div");
        slider.className = "banner-slider";
        
        // Build all slides synchronously (fast — no API calls)
        for (const it of items) {
            slider.appendChild(createBannerElementSync(it, apiClient));
        }
        
        // Clone for infinite scroll
        if (items.length > 1) {
            const first = slider.children[0].cloneNode(true);
            const last = slider.children[slider.children.length - 1].cloneNode(true);
            
            const firstYT = first.querySelector('.youtube-backdrop');
            if (firstYT?.id) { firstYT.id += '-clone-end'; firstYT.dataset.isClone = 'true'; }
            const lastYT = last.querySelector('.youtube-backdrop');
            if (lastYT?.id) { lastYT.id += '-clone-start'; lastYT.dataset.isClone = 'true'; }
            
            slider.appendChild(first);
            slider.insertBefore(last, slider.children[0]);
        }
        
        sliderWrapper.appendChild(slider);
        spotlight.appendChild(sliderWrapper);
        
        // Navigation arrows
        const btnLeft = document.createElement("button");
        btnLeft.className = "arrow left";
        btnLeft.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`;
        btnLeft.setAttribute("aria-label", "Previous");
        
        const btnRight = document.createElement("button");
        btnRight.className = "arrow right";
        btnRight.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`;
        btnRight.setAttribute("aria-label", "Next");
        
        spotlight.appendChild(btnLeft);
        spotlight.appendChild(btnRight);
        
        // Play button
        const playButtonOverlay = document.createElement("div");
        playButtonOverlay.className = "play-button-overlay";
        const playButton = document.createElement("button");
        playButton.className = "play-button";
        playButton.setAttribute("aria-label", "Play");
        playButton.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
        playButtonOverlay.appendChild(playButton);
        spotlight.appendChild(playButtonOverlay);
        
        // Control buttons
        const pauseButton = document.createElement("button");
        pauseButton.className = "pause-button";
        pauseButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
        pauseButton.setAttribute("aria-label", "Pause/Play");
        spotlight.appendChild(pauseButton);
        
        const muteButton = document.createElement("button");
        muteButton.className = "mute-button";
        muteButton.innerHTML = STATE.isMuted 
            ? '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
            : '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
        muteButton.setAttribute("aria-label", "Toggle Mute");
        spotlight.appendChild(muteButton);
        
        const refreshButton = document.createElement("button");
        refreshButton.className = "refresh-button visible";
        refreshButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
        refreshButton.setAttribute("aria-label", "Refresh Items");
        spotlight.appendChild(refreshButton);
        
        // Dots
        const controls = document.createElement("div");
        controls.className = "controls";
        for (let i = 0; i < items.length; i++) {
            const c = document.createElement("button");
            c.className = "control";
            if (i === 0) c.classList.add("active");
            c.dataset.index = i + 1;
            c.setAttribute("aria-label", `Slide ${i + 1}`);
            controls.appendChild(c);
        }
        spotlight.appendChild(controls);
        container.appendChild(spotlight);
        
        return { container, spotlight, slider, btnLeft, btnRight, controls, sliderWrapper, playButtonOverlay, pauseButton, muteButton, refreshButton };
    }
    
    function playItem(itemId, serverId, apiClient) {
        let serverIdToUse = serverId;
        if (!serverIdToUse && apiClient) {
            serverIdToUse = apiClient.serverId || apiClient.serverInfo?.Id || apiClient._serverInfo?.Id;
        }
        if (window.require) {
            try {
                window.require(['playbackManager'], function(playbackManager) {
                    if (playbackManager?.play) {
                        playbackManager.play({ ids: [itemId], serverId: serverIdToUse });
                    }
                });
                return;
            } catch (e) { }
        }
        if (window.appRouter?.showItem) {
            window.appRouter.showItem(itemId, serverIdToUse);
            setTimeout(() => { const pb = document.querySelector('.btnPlay'); if (pb) pb.click(); }, 500);
        }
    }
    
    function navigateToItem(itemId, serverId, apiClient) {
        let serverIdToUse = serverId;
        if (!serverIdToUse && apiClient) {
            serverIdToUse = apiClient.serverId || apiClient.serverInfo?.Id || apiClient._serverInfo?.Id;
        }
        if (window.appRouter?.showItem) { window.appRouter.showItem(itemId, serverIdToUse); return; }
        if (window.Dashboard?.navigate) { window.Dashboard.navigate(serverIdToUse ? `item?id=${itemId}&serverId=${serverIdToUse}` : `item?id=${itemId}`); return; }
        if (typeof require === "function") {
            try { require(['appRouter'], function(r) { if (r?.showItem) r.showItem(itemId, serverIdToUse); }); return; } catch (e) { }
        }
        window.location.hash = serverIdToUse ? `#!/item?id=${itemId}&serverId=${serverIdToUse}` : `#!/item?id=${itemId}`;
    }

    function logYouTubeURL(videoId, itemName) {
        if (videoId) console.log(`[Spotlight] Trailer: ${itemName} -> https://www.youtube.com/watch?v=${videoId}`);
    }
    
    function playCurrentSlideVideo(itemId) {
        let player = STATE.videoPlayers[itemId];
        
        if (!player && STATE.currentSlider) {
            const currentSlide = STATE.currentSlider.children[STATE.currentSlideIndex];
            const ytContainer = currentSlide?.querySelector('.youtube-backdrop[data-item-id="' + itemId + '"]');
            if (ytContainer) {
                const playerId = ytContainer.id;
                player = STATE.videoPlayers[playerId];
                if (!player && window.YT?.get) {
                    player = window.YT.get(playerId);
                    if (player) STATE.videoPlayers[playerId] = player;
                }
            }
            const videoElement = currentSlide?.querySelector(`video.video-backdrop[data-item-id="${itemId}"]`);
            if (videoElement) { player = videoElement; STATE.videoPlayers[itemId] = player; }
            if (!player) return;
        }
        
        if (player?.playVideo) {
            const currentSlide = STATE.currentSlider?.children[STATE.currentSlideIndex];
            const itemName = currentSlide?.querySelector('.banner-title')?.textContent || currentSlide?.querySelector('.banner-logo')?.alt || '';
            logYouTubeURL(player._videoId, itemName);
            if (STATE.isMuted) player.mute();
            else { player.unMute(); player.setVolume(CONFIG.videoVolume * 100); }
            player.playVideo();
            STATE.isPaused = false;
            updatePauseButtonIcon();
        } else if (player?.play) {
            player.currentTime = 0;
            player.muted = STATE.isMuted;
            if (!STATE.isMuted) player.volume = CONFIG.videoVolume;
            player.play().catch(() => { player.muted = true; STATE.isMuted = true; updateMuteButtonIcon(); player.play(); });
            STATE.isPaused = false;
            updatePauseButtonIcon();
        }
    }
    
    function pauseAllVideos() {
        Object.entries(STATE.videoPlayers).forEach(([itemId, player]) => {
            if (player?.pauseVideo) { player.pauseVideo(); stopSponsorBlockMonitoring(itemId); }
            else if (player?.pause) player.pause();
        });
        STATE.isPaused = true;
        updatePauseButtonIcon();
    }
    
    function updateMuteButtonIcon() {
        const muteButton = document.querySelector('.spotlight .mute-button');
        if (muteButton) {
            muteButton.innerHTML = STATE.isMuted 
                ? '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
                : '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
        }
    }
    
    function updatePauseButtonIcon() {
        const pauseButton = document.querySelector('.spotlight .pause-button');
        if (pauseButton) {
            pauseButton.innerHTML = STATE.isPaused
                ? '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
                : '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
        }
    }
    
    function toggleMute() {
        STATE.isMuted = !STATE.isMuted;
        updateMuteButtonIcon();
        Object.values(STATE.videoPlayers).forEach(player => {
            if (player?.mute) {
                if (STATE.isMuted) player.mute();
                else { player.unMute(); player.setVolume(CONFIG.videoVolume * 100); }
            } else if (player?.muted !== undefined) {
                player.muted = STATE.isMuted;
                if (!STATE.isMuted) player.volume = CONFIG.videoVolume;
            }
        });
    }
    
    function initializeYouTubePlayers(slider) {
        slider.querySelectorAll('.youtube-backdrop[data-video-id]').forEach(container => {
            const itemId = container.dataset.itemId;
            const videoId = container.dataset.videoId;
            const playerId = container.id;
            const isClone = container.dataset.isClone === 'true';
            if (!videoId || !playerId) return;
            if (!isClone && STATE.videoPlayers[itemId]) return;
            
            const player = new YT.Player(playerId, {
                height: '100%', width: '100%', videoId,
                playerVars: {
                    autoplay: 0, mute: 1, controls: 0, disablekb: 1, fs: 0,
                    iv_load_policy: 3, rel: 0, loop: 0, modestbranding: 1,
                    playsinline: 1, suggestedQuality: CONFIG.preferredVideoQuality
                },
                events: {
                    'onReady': (event) => {
                        event.target._videoId = videoId;
                        event.target._itemId = itemId;
                        event.target._playerId = playerId;
                        event.target.mute();
                        if (isClone) STATE.videoPlayers[playerId] = event.target;
                        else STATE.videoPlayers[itemId] = event.target;
                        STATE.videoReadyStates[itemId] = false;
                        
                        const bannerItem = container.closest('.banner-item');
                        const sl = container.closest('.banner-slider');
                        if (sl && bannerItem === sl.children[1]) {
                            setTimeout(() => playCurrentSlideVideo(itemId), 500);
                        }
                    },
                    'onStateChange': (event) => {
                        handleYouTubeStateChange(event, { Id: itemId, Name: '' }, videoId, playerId);
                    }
                }
            });
        });
    }
    
    function ensurePlayerForCurrentSlide(currentIndex, slider) {
        const currentSlide = slider.children[currentIndex];
        if (!currentSlide) return null;
        const itemId = currentSlide.dataset.itemId;
        if (!itemId || currentSlide.dataset.hasVideo !== 'true') return null;
        if (STATE.videoPlayers[itemId]) return STATE.videoPlayers[itemId];
        
        const ytContainer = currentSlide.querySelector(`.youtube-backdrop[data-item-id="${itemId}"]`);
        if (ytContainer) {
            const playerId = ytContainer.id;
            if (window.YT?.get) {
                const player = window.YT.get(playerId);
                if (player) { STATE.videoPlayers[playerId] = player; return player; }
            }
        }
        return null;
    }
    
    async function refreshSlideshow(apiClient, oldContainer) {
        pauseAllVideos();
        Object.keys(STATE.skipIntervals).forEach(id => stopSponsorBlockMonitoring(id));
        Object.values(STATE.videoPlayers).forEach(p => { if (p?.destroy) p.destroy(); });
        STATE.videoPlayers = {};
        STATE.sponsorBlockSegments = {};
        STATE.ratingsCache = {};
        STATE.videoReadyStates = {};
        STATE.currentSlider = null;
        STATE.enrichedSlides = new Set();
        STATE.sliderItems = [];
        STATE.enrichmentPromises = {};
        if (oldContainer) oldContainer.remove();
        try { sessionStorage.removeItem('spotlight-current-index'); } catch (e) {}
        STATE.isInitializing = false;
        await init();
    }
    
    function attachSliderBehavior(state, apiClient, items) {
        const { slider, itemsCount, btnLeft, btnRight, controls, spotlight, pauseButton, muteButton, refreshButton } = state;
        let currentIndex = 1;
        
        STATE.currentSlider = slider;
        STATE.sliderItems = items;
        
        function triggerZoomAnimation() {
            const visibleItem = slider.children[currentIndex];
            if (visibleItem) {
                const cover = visibleItem.querySelector('.banner-cover:not(.video-backdrop)');
                if (cover) {
                    cover.style.animation = 'none';
                    void cover.offsetWidth;
                    cover.style.animation = 'zoomOut 8s ease-out forwards';
                }
            }
        }
        
        function updateTransform(index, animate = true) {
            const width = spotlight.querySelector('.banner-slider-wrapper').getBoundingClientRect().width;
            slider.style.transition = animate ? "transform .5s ease" : "none";
            slider.style.transform = `translate3d(${Math.round(-(index * width))}px, 0, 0)`;
            void slider.offsetHeight;
        }
        
        function setActiveDot(idx) {
            const dots = controls.querySelectorAll(".control");
            dots.forEach(d => d.classList.remove("active"));
            const realIndex = ((idx - 1 + itemsCount) % itemsCount);
            if (dots[realIndex]) dots[realIndex].classList.add("active");
        }
        
        function updateVideoButtonsVisibility() {
            const visibleItem = slider.children[currentIndex];
            if (visibleItem?.dataset.hasVideo === 'true') {
                muteButton.classList.add('visible');
                pauseButton.classList.add('visible');
            } else {
                muteButton.classList.remove('visible');
                pauseButton.classList.remove('visible');
            }
        }
        
        const resizeHandler = () => updateTransform(currentIndex, false);
        window.addEventListener("resize", resizeHandler);
        
        // Initial setup
        setTimeout(() => {
            updateTransform(currentIndex, false);
            setActiveDot(currentIndex);
            triggerZoomAnimation();
            updateVideoButtonsVisibility();
            STATE.currentSlideIndex = currentIndex;
            
            // LAZY: Enrich first slide + neighbors
            enrichNearbySlides(currentIndex, slider, items, itemsCount);
            
            // Setup video for first slide
            const firstItem = slider.children[currentIndex];
            if (firstItem?.dataset.hasVideo === 'true') {
                const itemId = firstItem.dataset.itemId;
                const item = items.find(it => it.Id === itemId);
                if (item) {
                    setupVideoForSlide(firstItem, item, apiClient, true).then(() => {
                        if (STATE.youtubeAPIReady) initializeYouTubePlayers(slider);
                        
                        const tryPlay = (attempts = 0) => {
                            const player = STATE.videoPlayers[itemId];
                            if (!player && attempts < 40) {
                                setTimeout(() => tryPlay(attempts + 1), 300);
                                return;
                            }
                            if (player?.getPlayerState) {
                                const s = player.getPlayerState();
                                if (s === YT.PlayerState.UNSTARTED || s === YT.PlayerState.CUED) {
                                    setTimeout(() => playCurrentSlideVideo(itemId), 800);
                                } else if (s === -1 && attempts < 40) {
                                    setTimeout(() => tryPlay(attempts + 1), 300);
                                } else if (s !== -1) {
                                    playCurrentSlideVideo(itemId);
                                }
                            } else if (player?.tagName === 'VIDEO') {
                                playCurrentSlideVideo(itemId);
                            }
                        };
                        setTimeout(() => tryPlay(), 1500);
                    });
                }
            }
        }, 100);
        
        btnRight.addEventListener("click", (e) => { e.stopPropagation(); currentIndex++; animate(); });
        btnLeft.addEventListener("click", (e) => { e.stopPropagation(); currentIndex--; animate(); });
        
        controls.addEventListener("click", (e) => {
            e.stopPropagation();
            if (e.target.classList.contains("control")) {
                currentIndex = parseInt(e.target.dataset.index, 10);
                updateTransform(currentIndex, true);
                setActiveDot(currentIndex);
                setTimeout(() => { triggerZoomAnimation(); handleVideoPlayback(); }, 100);
            }
        });
        
        function handleVideoPlayback() {
            STATE.isPaused = false;
            updatePauseButtonIcon();
            pauseAllVideos();
            updateVideoButtonsVisibility();
            STATE.currentSlideIndex = currentIndex;
            
            // LAZY: Enrich slides when they become visible
            enrichNearbySlides(currentIndex, slider, items, itemsCount);
            
            const visibleItem = slider.children[currentIndex];
            const hasVideo = visibleItem?.dataset.hasVideo === 'true';
            
            if (CONFIG.waitForTrailerToEnd && hasVideo) stopAutoplay();
            else startAutoplay();
            
            if (hasVideo) {
                const itemId = visibleItem.dataset.itemId;
                const item = items.find(it => it.Id === itemId);
                
                // Setup video if not done yet
                if (item && visibleItem.dataset.videoSetup !== 'true') {
                    setupVideoForSlide(visibleItem, item, apiClient, false).then(() => {
                        if (STATE.youtubeAPIReady) initializeYouTubePlayers(slider);
                        setTimeout(() => {
                            ensurePlayerForCurrentSlide(currentIndex, slider);
                            if (itemId) playCurrentSlideVideo(itemId);
                        }, 500);
                    });
                } else {
                    ensurePlayerForCurrentSlide(currentIndex, slider);
                    if (itemId) setTimeout(() => playCurrentSlideVideo(itemId), 300);
                }
            }
        }
        
        function animate() {
            pauseAllVideos();
            updateTransform(currentIndex, true);
            setActiveDot(currentIndex);
            setTimeout(() => triggerZoomAnimation(), 100);
            
            setTimeout(() => {
                if (itemsCount < 2) { handleVideoPlayback(); return; }
                if (currentIndex === 0) {
                    currentIndex = itemsCount;
                    updateTransform(currentIndex, false);
                    setActiveDot(currentIndex);
                    setTimeout(() => triggerZoomAnimation(), 100);
                } else if (currentIndex === itemsCount + 1) {
                    currentIndex = 1;
                    updateTransform(currentIndex, false);
                    setActiveDot(currentIndex);
                    setTimeout(() => triggerZoomAnimation(), 100);
                }
                STATE.currentSlideIndex = currentIndex;
                handleVideoPlayback();
            }, 520);
        }
        
        spotlight.addEventListener("click", (e) => {
            if (e.target.closest('.arrow,.controls,.play-button-overlay,.pause-button,.mute-button,.refresh-button')) return;
            const visibleItem = slider.children[currentIndex];
            if (visibleItem?.dataset?.itemId) {
                e.stopPropagation(); e.preventDefault();
                navigateToItem(visibleItem.dataset.itemId, visibleItem.dataset.serverId, apiClient);
            }
        });
        
        spotlight.querySelector('.play-button-overlay')?.addEventListener("click", (e) => {
            e.stopPropagation(); e.preventDefault();
            const visibleItem = slider.children[currentIndex];
            if (visibleItem?.dataset?.itemId) playItem(visibleItem.dataset.itemId, visibleItem.dataset.serverId, apiClient);
        });
        
        pauseButton?.addEventListener('click', (e) => {
            e.stopPropagation(); e.preventDefault();
            const visibleItem = slider.children[currentIndex];
            if (!visibleItem || visibleItem.dataset.hasVideo !== 'true') return;
            const itemId = visibleItem.dataset.itemId;
            if (!itemId) return;
            const player = STATE.videoPlayers[itemId];
            if (!player) return;
            const wantsToPause = !STATE.isPaused;
            
            if (player.getPlayerState) {
                if (wantsToPause) { player.pauseVideo(); STATE.isPaused = true; stopSponsorBlockMonitoring(itemId); }
                else { player.playVideo(); STATE.isPaused = false; }
            } else if (player.tagName === 'VIDEO') {
                if (wantsToPause) { player.pause(); STATE.isPaused = true; }
                else { player.play(); STATE.isPaused = false; }
            }
            updatePauseButtonIcon();
        });
        
        muteButton?.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); toggleMute(); });
        
        refreshButton?.addEventListener('click', async (e) => {
            e.stopPropagation(); e.preventDefault();
            refreshButton.classList.add('refreshing');
            await refreshSlideshow(apiClient, document.getElementById(SPOTLIGHT_CONTAINER_ID));
        });
        
        let autoplayTimer = null;
        function startAutoplay() {
            if (autoplayTimer) clearInterval(autoplayTimer);
            const currentItem = slider.children[currentIndex];
            if (CONFIG.waitForTrailerToEnd && currentItem?.dataset.hasVideo === 'true') return;
            autoplayTimer = setInterval(() => { currentIndex++; animate(); }, CONFIG.autoplayInterval);
        }
        function stopAutoplay() { if (autoplayTimer) clearInterval(autoplayTimer); autoplayTimer = null; }
        
        spotlight.addEventListener("mouseenter", stopAutoplay);
        spotlight.addEventListener("mouseleave", startAutoplay);
        startAutoplay();
        
        state.cleanup = () => { window.removeEventListener("resize", resizeHandler); stopAutoplay(); };
    }
    
    // ══════════════════════════════════════════════════════════════════
    // Preload first slide images
    // ══════════════════════════════════════════════════════════════════
    
    function preloadImages(items, apiClient, count = 3) {
        const toPreload = items.slice(0, count);
        toPreload.forEach(item => {
            const img = new Image();
            img.src = getImageUrl(apiClient, item, { width: CONFIG.imageWidth, prefer: "Backdrop" });
        });
    }
    
    async function init() {
        try {
            if (document.getElementById(SPOTLIGHT_CONTAINER_ID) || STATE.isInitializing) return;
            STATE.isInitializing = true;
            
            insertStyles();
            
            const home = findHomeContainer();
            if (!home) { STATE.isInitializing = false; return; }
            
            const [connectionManager, ApiClient] = await safeRequire(["connectionManager", "ApiClient"]);
            
            let apiClient = null;
            try { if (connectionManager?.[0]?.currentApiClient) apiClient = connectionManager[0].currentApiClient(); } catch (e) { }
            if (!apiClient) { try { if (ApiClient?.[0]?.serverAddress) apiClient = ApiClient[0]; } catch (e) { } }
            if (!apiClient && window.ApiClient) apiClient = window.ApiClient;
            if (!apiClient) { STATE.isInitializing = false; return; }
            
            const items = await fetchItems(apiClient);
            if (!items?.length) { STATE.isInitializing = false; return; }
            
            console.log(`[Spotlight] ${items.length} items loaded`);
            
            // Preload first images in parallel
            preloadImages(items, apiClient, 3);
            
            // Build slider SYNCHRONOUSLY (no await for ratings/awards)
            const { container, spotlight, slider, btnLeft, btnRight, controls, pauseButton, muteButton, refreshButton } = buildSliderSync(items, apiClient);
            
            // Insert into DOM immediately
            const reference = home.querySelector?.(".homeSectionsContainer");
            if (reference?.parentNode) reference.parentNode.insertBefore(container, reference);
            else home.insertBefore(container, home.firstChild);
            
            // Attach behavior (which will lazily enrich slides)
            attachSliderBehavior(
                { slider, itemsCount: items.length, btnLeft, btnRight, controls, spotlight, pauseButton, muteButton, refreshButton },
                apiClient, items
            );
            
            console.log(`[Spotlight] Initialized with ${items.length} items`);
        } catch (err) {
            console.error("[Spotlight] Init error", err);
        } finally {
            STATE.isInitializing = false;
        }
    }
    
    function observeViewAndInit() {
        let initialized = false;
        
        const observer = new MutationObserver(() => {
            const homeVisible = !!document.querySelector(".view:not(.hide) .homeSectionsContainer, .view:not(.hide) [data-view='home'], .view:not(.hide) .view-home-home");
            
            if (homeVisible && !initialized && !STATE.isInitializing) {
                initialized = true;
                setTimeout(() => init(), 300);
            }
            
            if (!homeVisible && initialized) {
                initialized = false;
                STATE.isInitializing = false;
                
                Object.entries(STATE.videoPlayers).forEach(([itemId, player]) => {
                    stopSponsorBlockMonitoring(itemId);
                    if (player?.stopVideo) player.stopVideo();
                    else if (player?.pauseVideo) player.pauseVideo();
                    if (player?.destroy) player.destroy();
                    else if (player?.tagName === 'VIDEO') { player.pause(); player.src = ''; player.load(); }
                });
                
                STATE.videoPlayers = {};
                STATE.sponsorBlockSegments = {};
                STATE.ratingsCache = {};
                STATE.videoReadyStates = {};
                STATE.currentSlider = null;
                STATE.enrichedSlides = new Set();
                STATE.sliderItems = [];
                STATE.enrichmentPromises = {};
                
                document.getElementById(SPOTLIGHT_CONTAINER_ID)?.remove();
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
            if (!initialized && !STATE.isInitializing) {
                if (document.querySelector(".view:not(.hide) .homeSectionsContainer, .view:not(.hide) [data-view='home']")) init();
            }
        }, 500);
    }
    
    observeViewAndInit();
})();