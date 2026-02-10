/*!
 * Spotlight.js — Emby 4.9 compatible Spotlight slider with Video Backdrop Support & Custom Ratings
 * Enhanced with: YouTube Trailers, HTML5 Video, SponsorBlock, Custom Ratings (IMDb, RT, Metacritic, etc.), Oscar + Emmy Wins+Nominations
 * localStorage-based caching for all ratings
 * RT Scraping for Certified Fresh & Verified Hot badges
 * RT Direct Scraping fallback when MDBList has no RT data
 * Generated: 2026-02-10
 *
 * CORS PROXY (optional):
 * - Without: Most ratings work via MDBList API
 * - With: Enables RT fallback scraping, exact Certified/Verified badges, and Allociné
 * - Set CORS_PROXY_URL in CONFIG (leave empty '' to disable)
 *
 * Manually delete ratings cache in Browsers DevConsole (F12):
 * Object.keys(localStorage)
 * .filter(k => k.startsWith('spotlight_ratings_'))
 * .forEach(k => localStorage.removeItem(k));
 * console.log('Ratings-Cache gelöscht');
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
    
    const CONFIG = {
        imageWidth: 1900,
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
        
        enableSponsorBlock: true, // Sponsorblock extension needs to be installed on the client
        sponsorBlockCategories: ["sponsor", "intro", "outro", "selfpromo", "interaction", "preview"],
        
        // Custom Ratings Config
        enableCustomRatings: true,
        MDBLIST_API_KEY: '', // API Key from https://mdblist.com/
        TMDB_API_KEY: '', // API Key from https://www.themoviedb.org/
        KINOPOISK_API_KEY: '', // API key from https://kinopoiskapiunofficial.tech/
        CACHE_TTL_HOURS: 168, // Cache duration in Hours
        
        // CORS Proxy URL für RT und Allociné Scraping (leer lassen wenn nicht verfügbar)
        CORS_PROXY_URL: '' // e.g. 'https://cors.yourdomain.com/proxy/'
    };
    
    // ══════════════════════════════════════════════════════════════════
    // CACHE KONFIGURATION
    // ══════════════════════════════════════════════════════════════════
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
                console.warn('[Spotlight Cache] Fehler beim Lesen:', key, e);
                return null;
            }
        },

        set(key, data) {
            try {
                const entry = {
                    timestamp: Date.now(),
                    data: data
                };
                localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
            } catch (e) {
                console.warn('[Spotlight Cache] Fehler beim Schreiben:', key, e);
                if (e.name === 'QuotaExceededError') {
                    this.cleanup(true);
                    try {
                        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
                            timestamp: Date.now(),
                            data: data
                        }));
                    } catch (e2) {
                        console.error('[Spotlight Cache] Cache voll, konnte nicht schreiben:', key);
                    }
                }
            }
        },

        cleanup(force = false) {
            const keysToCheck = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) {
                    keysToCheck.push(k);
                }
            }

            if (force) {
                const entries = keysToCheck.map(k => {
                    try {
                        const raw = localStorage.getItem(k);
                        const parsed = JSON.parse(raw);
                        return { key: k, timestamp: parsed?.timestamp || 0 };
                    } catch {
                        return { key: k, timestamp: 0 };
                    }
                }).sort((a, b) => a.timestamp - b.timestamp);

                const deleteCount = Math.max(1, Math.floor(entries.length / 2));
                for (let i = 0; i < deleteCount; i++) {
                    localStorage.removeItem(entries[i].key);
                }
                console.log(`[Spotlight Cache] Force-Cleanup: ${deleteCount} Einträge gelöscht`);
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
                } catch {
                    localStorage.removeItem(k);
                    removed++;
                }
            });

            if (removed > 0) {
                console.log(`[Spotlight Cache] Cleanup: ${removed} abgelaufene Einträge gelöscht`);
            }
        }
    };

    // Beim Start abgelaufene Einträge bereinigen
    RatingsCache.cleanup();

    const LOGO = {
        imdb: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/IMDb.png',
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
        emmy: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/emmy.png'
    };
    
    // ══════════════════════════════════════════════════════════════════
    // MANUELLE OVERRIDES (Fallback falls RT-Scrape fehlschlägt)
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
    // ══════════════════════════════════════════════════════════════════
    
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
        videoReadyStates: {}
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
                console.warn("[Spotlight] require failed", e);
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
                r: parseInt(hexMatch[1], 16),
                g: parseInt(hexMatch[2], 16),
                b: parseInt(hexMatch[3], 16),
                a: hexMatch[4] ? parseInt(hexMatch[4], 16) / 255 : 1
            };
        }
        
        const rgbaMatch = color.match(/rgba?\(\s*([\d.]+)\s*[,/]\s*([\d.]+)\s*[,/]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+))?\s*\)/);
        if (rgbaMatch) {
            return {
                r: parseInt(rgbaMatch[1]),
                g: parseInt(rgbaMatch[2]),
                b: parseInt(rgbaMatch[3]),
                a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
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
        if (hours > 0) {
            return `${hours}h ${mins}min`;
        }
        return `${mins}min`;
    }
    
    function getImdbId(item) {
        if (item.ProviderIds?.Imdb) {
            return item.ProviderIds.Imdb;
        }
        return null;
    }
    
    function getTmdbId(item) {
        if (item.ProviderIds?.Tmdb) {
            return item.ProviderIds.Tmdb;
        }
        return null;
    }

    // ══════════════════════════════════════════════════════════════════
    // Helper: Check if CORS Proxy is configured
    // ══════════════════════════════════════════════════════════════════
    
    function isCorsProxyConfigured() {
        return CONFIG.CORS_PROXY_URL && CONFIG.CORS_PROXY_URL.trim() !== '';
    }

    // ══════════════════════════════════════════════════════════════════
    // Rotten Tomatoes Scraping (Certified Fresh + Verified Hot)
    // via Wikidata P1258 -> CORS Proxy -> parse embedded JSON
    // ══════════════════════════════════════════════════════════════════

    function getRTSlug(imdbId) {
        return new Promise((resolve) => {
            if (!imdbId) { resolve(null); return; }

            const cacheKey = `rt_slug_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) {
                resolve(cached.slug);
                return;
            }

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

                    RatingsCache.set(cacheKey, { slug: slug });
                    resolve(slug);
                },
                onerror: () => resolve(null)
            });
        });
    }

    /**
     * Scrapes the RT page via CORS proxy and returns both certified statuses.
     * @param {string} imdbId
     * @param {string} type - 'movie' or 'show'
     * @returns {Promise<{criticsCertified: boolean|null, audienceCertified: boolean|null}>}
     */
    function fetchRTCertifiedStatus(imdbId, type) {
        return new Promise((resolve) => {
            // Prüfe ob CORS Proxy verfügbar ist
            if (!imdbId || !isCorsProxyConfigured()) {
                resolve({ criticsCertified: null, audienceCertified: null });
                return;
            }

            const cacheKey = `rt_certified_${type}_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) {
                resolve(cached);
                return;
            }

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
                            console.warn('[Spotlight] RT scrape failed:', res.status, slug);
                            const result = { criticsCertified: null, audienceCertified: null };
                            RatingsCache.set(cacheKey, result);
                            resolve(result);
                            return;
                        }

                        const html = res.responseText;
                        let criticsCertified = null;
                        let audienceCertified = null;

                        // Strategy 1: Parse the embedded media-scorecard JSON
                        const jsonMatch = html.match(
                            /<script[^>]*id="media-scorecard-json"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/
                        );
                        if (jsonMatch) {
                            try {
                                const scoreData = JSON.parse(jsonMatch[1]);
                                if (scoreData.criticsScore && typeof scoreData.criticsScore.certified === 'boolean') {
                                    criticsCertified = scoreData.criticsScore.certified;
                                }
                                if (scoreData.audienceScore && typeof scoreData.audienceScore.certified === 'boolean') {
                                    audienceCertified = scoreData.audienceScore.certified;
                                }
                                console.log(`[Spotlight] RT JSON parsed for ${slug}: critics=${criticsCertified}, audience=${audienceCertified}`);
                            } catch (e) {
                                console.warn('[Spotlight] RT JSON parse error:', e);
                            }
                        }

                        // Strategy 2: Fallback - parse HTML tag attributes
                        if (criticsCertified === null) {
                            const criticsTagMatch = html.match(
                                /<score-icon-critics\s[^>]*certified="(true|false)"[^>]*/
                            );
                            if (criticsTagMatch) {
                                criticsCertified = criticsTagMatch[1] === 'true';
                            }
                        }

                        if (audienceCertified === null) {
                            const audienceTagMatch = html.match(
                                /<score-icon-audience\s[^>]*certified="(true|false)"[^>]*/
                            );
                            if (audienceTagMatch) {
                                audienceCertified = audienceTagMatch[1] === 'true';
                            }
                        }

                        // Strategy 3: data-json attribute variant
                        if (criticsCertified === null || audienceCertified === null) {
                            const altJsonMatch = html.match(
                                /data-json="mediaScorecard"[^>]*>([\s\S]*?)<\/script>/
                            );
                            if (altJsonMatch) {
                                try {
                                    const altData = JSON.parse(altJsonMatch[1]);
                                    if (criticsCertified === null && altData.criticsScore?.certified != null) {
                                        criticsCertified = altData.criticsScore.certified === true;
                                    }
                                    if (audienceCertified === null && altData.audienceScore?.certified != null) {
                                        audienceCertified = altData.audienceScore.certified === true;
                                    }
                                } catch (e) { /* ignore */ }
                            }
                        }

                        // Strategy 4: mpscall variable for critics certified_fresh
                        if (criticsCertified === null) {
                            const mpscallMatch = html.match(/"cag\[certified_fresh\]"\s*:\s*"(\d)"/);
                            if (mpscallMatch) {
                                criticsCertified = mpscallMatch[1] === '1';
                            }
                        }

                        const result = {
                            criticsCertified: criticsCertified,
                            audienceCertified: audienceCertified
                        };

                        console.log(`[Spotlight] RT Certified for ${slug}:`, result);
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

    // ══════════════════════════════════════════════════════════════════
    // Rotten Tomatoes: Direct Scraping (when MDBList has no RT data)
    // ══════════════════════════════════════════════════════════════════

    function fetchRottenTomatoesDirectly(imdbId, type) {
        return new Promise((resolve) => {
            // Prüfe ob CORS Proxy verfügbar ist
            if (!imdbId || !isCorsProxyConfigured()) {
                console.log('[Spotlight] RT Direct Scraping übersprungen - kein CORS Proxy konfiguriert');
                resolve(null);
                return;
            }

            const cacheKey = `rt_direct_${type}_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) {
                if (cached.criticsScore !== null || cached.audienceScore !== null) {
                    resolve(cached);
                } else {
                    resolve(null);
                }
                return;
            }

            getRTSlug(imdbId).then(slug => {
                if (!slug) {
                    console.warn('[Spotlight] Kein RT Slug für', imdbId);
                    RatingsCache.set(cacheKey, { criticsScore: null, audienceScore: null, criticsCertified: false, audienceCertified: false });
                    resolve(null);
                    return;
                }

                const rtUrl = `${CONFIG.CORS_PROXY_URL}https://www.rottentomatoes.com/${slug}`;
                console.log('[Spotlight] RT Direct Scrape für', imdbId, '->', slug);

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: rtUrl,
                    onload(res) {
                        if (res.status !== 200) {
                            console.warn('[Spotlight] RT direct scrape failed:', res.status);
                            RatingsCache.set(cacheKey, { criticsScore: null, audienceScore: null, criticsCertified: false, audienceCertified: false });
                            resolve(null);
                            return;
                        }

                        const html = res.responseText;
                        let criticsScore = null;
                        let criticsCertified = false;
                        let audienceScore = null;
                        let audienceCertified = false;

                        // Parse embedded JSON (most reliable)
                        const jsonMatch = html.match(
                            /<script[^>]*id="media-scorecard-json"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/
                        );

                        if (jsonMatch) {
                            try {
                                const scoreData = JSON.parse(jsonMatch[1]);

                                // Critics Score
                                if (scoreData.criticsScore) {
                                    const likedCount = scoreData.criticsScore.likedCount || 0;
                                    const notLikedCount = scoreData.criticsScore.notLikedCount || 0;
                                    const total = likedCount + notLikedCount;
                                    if (total > 0) {
                                        criticsScore = Math.round((likedCount / total) * 100);
                                    }
                                    criticsCertified = scoreData.criticsScore.certified === true;
                                }

                                // Audience Score
                                if (scoreData.audienceScore) {
                                    const likedCount = scoreData.audienceScore.likedCount || 0;
                                    const notLikedCount = scoreData.audienceScore.notLikedCount || 0;
                                    const total = likedCount + notLikedCount;
                                    if (total > 0) {
                                        audienceScore = Math.round((likedCount / total) * 100);
                                    }
                                    audienceCertified = scoreData.audienceScore.certifiedFresh === 'verified_hot' ||
                                                       scoreData.audienceScore.certified === true;
                                }

                                console.log(`[Spotlight] RT Direct: Critics=${criticsScore}% (certified=${criticsCertified}), Audience=${audienceScore}% (verified=${audienceCertified})`);

                            } catch (e) {
                                console.warn('[Spotlight] RT JSON parse error:', e);
                            }
                        }

                        // Cache the results
                        const result = {
                            criticsScore,
                            criticsCertified,
                            audienceScore,
                            audienceCertified
                        };
                        
                        RatingsCache.set(cacheKey, result);
                        
                        if (criticsScore !== null || audienceScore !== null) {
                            resolve(result);
                        } else {
                            resolve(null);
                        }
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
    // MDBList Ratings (with localStorage Cache + RT Scraping)
    // ══════════════════════════════════════════════════════════════════

    function fetchMDBListRatings(type, tmdbId, item) {
        return new Promise((resolve) => {
            if (!CONFIG.enableCustomRatings || !tmdbId) {
                resolve(null);
                return;
            }
            
            // In-Memory Cache (session-level)
            const memKey = `mdb_${type}_${tmdbId}`;
            if (STATE.ratingsCache[memKey]) {
                resolve(STATE.ratingsCache[memKey]);
                return;
            }

            // Persistent localStorage Cache
            const cacheKey = `mdblist_${type}_${tmdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached) {
                STATE.ratingsCache[memKey] = cached;
                resolve(cached);
                return;
            }
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.mdblist.com/tmdb/${type}/${tmdbId}?apikey=${CONFIG.MDBLIST_API_KEY}`,
                onload(res) {
                    if (res.status !== 200) {
                        resolve(null);
                        return;
                    }
                    let data;
                    try { data = JSON.parse(res.responseText); }
                    catch (e) { 
                        resolve(null);
                        return;
                    }
                    
                    const ratings = [];
                    
                    const isCertifiedFreshOverride = CERTIFIED_FRESH_OVERRIDES.includes(String(tmdbId));
                    const isVerifiedHotOverride    = VERIFIED_HOT_OVERRIDES.includes(String(tmdbId));
                    
                    let metacriticScore = null;
                    let metacriticVotes = null;
                    let tomatoesScore   = null;
                    let tomatoesVotes   = null;
                    let audienceScore   = null;
                    let audienceVotes   = null;
                    let hasRTFromMDBList = false;
                    
                    if (Array.isArray(data.ratings)) {
                        // First pass: collect scores
                        data.ratings.forEach(r => {
                            if (r.value == null) return;
                            const key = r.source.toLowerCase();
                            
                            if (key === 'metacritic') {
                                metacriticScore = r.value;
                                metacriticVotes = r.votes;
                            }
                            else if (key === 'tomatoes') {
                                tomatoesScore = r.value;
                                tomatoesVotes = r.votes;
                                hasRTFromMDBList = true;
                            }
                            else if (key.includes('popcorn') || key.includes('audience')) {
                                audienceScore = r.value;
                                audienceVotes = r.votes;
                                hasRTFromMDBList = true;
                            }
                        });
                        
                        // Second pass: build rating badges with heuristic
                        data.ratings.forEach(r => {
                            if (r.value == null) return;
                            
                            let key = r.source.toLowerCase().replace(/\s+/g, '_');
                            let isCriticsBadge = false;
                            let isAudienceBadge = false;
                            
                            if (key === 'tomatoes') {
                                isCriticsBadge = true;
                                if (r.value < 60) {
                                    key = 'tomatoes_rotten';
                                } else if (isCertifiedFreshOverride || (tomatoesScore >= 75 && tomatoesVotes >= 80)) {
                                    key = 'tomatoes_certified';
                                } else {
                                    key = 'tomatoes';
                                }
                            }
                            else if (key.includes('popcorn')) {
                                isAudienceBadge = true;
                                if (r.value < 60) {
                                    key = 'audience_rotten';
                                } else if (isVerifiedHotOverride || (audienceScore >= 90 && audienceVotes >= 500)) {
                                    key = 'rotten_ver';
                                } else {
                                    key = 'audience';
                                }
                            }
                            else if (key === 'metacritic') {
                                const isMustSee = metacriticScore > 81 && metacriticVotes > 14;
                                key = isMustSee ? 'metacriticms' : 'metacritic';
                            }
                            else if (key.includes('metacritic') && key.includes('user')) key = 'metacriticus';
                            else if (key.includes('trakt')) key = 'trakt';
                            else if (key.includes('letterboxd')) key = 'letterboxd';
                            else if (key.includes('roger') || key.includes('ebert')) key = 'rogerebert';
                            else if (key.includes('myanimelist')) key = 'myanimelist';
                            
                            const logoUrl = LOGO[key];
                            if (!logoUrl) return;
                            
                            ratings.push({
                                source: r.source,
                                value: r.value,
                                votes: r.votes,
                                key: key,
                                logo: logoUrl,
                                _isCritics: isCriticsBadge,
                                _isAudience: isAudienceBadge
                            });
                        });
                    }
                    
                    const result = {
                        ratings: ratings,
                        originalTitle: data.original_title || data.title || '',
                        year: data.year || '',
                        _tomatoesScore: tomatoesScore,
                        _audienceScore: audienceScore,
                        _hasRTFromMDBList: hasRTFromMDBList
                    };
                    
                    // Save to both caches
                    STATE.ratingsCache[memKey] = result;
                    RatingsCache.set(cacheKey, result);
                    resolve(result);
                },
                onerror() {
                    resolve(null);
                }
            });
        });
    }
    
    // ══════════════════════════════════════════════════════════════════
    // AniList (with localStorage Cache)
    // ══════════════════════════════════════════════════════════════════

    function getAnilistId(imdbId) {
        return new Promise((resolve) => {
            if (!imdbId) {
                resolve(null);
                return;
            }

            const cacheKey = `anilist_id_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) {
                resolve(cached.id);
                return;
            }
            
            const sparql = `
                SELECT ?anilist WHERE {
                    ?item wdt:P345 "${imdbId}" .
                    ?item wdt:P8729 ?anilist .
                } LIMIT 1`;
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql),
                onload(res) {
                    if (res.status !== 200) {
                        resolve(null);
                        return;
                    }
                    let json;
                    try { json = JSON.parse(res.responseText); }
                    catch { 
                        resolve(null);
                        return;
                    }
                    const b = json.results.bindings;
                    const id = b.length && b[0].anilist?.value ? b[0].anilist.value : null;

                    RatingsCache.set(cacheKey, { id: id });
                    resolve(id);
                },
                onerror: () => resolve(null)
            });
        });
    }
    
    function queryAniListById(id, imdbId) {
        return new Promise((resolve) => {
            const query = `
                query($id:Int){
                    Media(id:$id,type:ANIME){
                        id meanScore
                    }
                }`;
            
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://graphql.anilist.co',
                headers: {'Content-Type':'application/json'},
                data: JSON.stringify({ query, variables: { id: parseInt(id, 10) } }),
                onload(res) {
                    if (res.status !== 200) {
                        resolve(null);
                        return;
                    }
                    let json;
                    try { json = JSON.parse(res.responseText); }
                    catch { 
                        resolve(null);
                        return;
                    }
                    const m = json.data?.Media;
                    if (m?.meanScore > 0) {
                        const result = { id: m.id, score: m.meanScore };
                        if (imdbId) {
                            RatingsCache.set(`anilist_rating_${imdbId}`, result);
                        }
                        resolve(result);
                    } else {
                        if (imdbId) {
                            RatingsCache.set(`anilist_rating_${imdbId}`, { id: null, score: 0 });
                        }
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }
    
    function queryAniListBySearch(title, year, imdbId) {
        return new Promise((resolve) => {
            const query = `
                query($search:String,$startDate:FuzzyDateInt,$endDate:FuzzyDateInt){
                    Media(
                        search:$search,
                        type:ANIME,
                        startDate_greater:$startDate,
                        startDate_lesser:$endDate
                    ){
                        id meanScore title { romaji english native } startDate { year }
                    }
                }`;
            
            const vars = {
                search: title,
                startDate: parseInt(`${year}0101`, 10),
                endDate: parseInt(`${year+1}0101`, 10)
            };
            
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://graphql.anilist.co',
                headers: {'Content-Type':'application/json'},
                data: JSON.stringify({ query, variables: vars }),
                onload(res) {
                    if (res.status !== 200) {
                        resolve(null);
                        return;
                    }
                    let json;
                    try { json = JSON.parse(res.responseText); }
                    catch { 
                        resolve(null);
                        return;
                    }
                    const m = json.data?.Media;
                    if (m?.meanScore > 0 && m.startDate?.year === year) {
                        const norm = s => s.toLowerCase().trim();
                        const t0 = norm(title);
                        const titles = [m.title.romaji, m.title.english, m.title.native]
                            .filter(Boolean).map(norm);
                        if (titles.includes(t0)) {
                            const result = { id: m.id, score: m.meanScore };
                            if (imdbId) {
                                RatingsCache.set(`anilist_rating_${imdbId}`, result);
                            }
                            resolve(result);
                            return;
                        }
                    }
                    if (imdbId) {
                        RatingsCache.set(`anilist_rating_${imdbId}`, { id: null, score: 0 });
                    }
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
        if (cached !== null) {
            if (cached.score > 0) {
                return cached;
            }
            return null;
        }
        
        const anilistId = await getAnilistId(imdbId);
        if (anilistId) {
            return await queryAniListById(anilistId, imdbId);
        } else if (originalTitle && year) {
            return await queryAniListBySearch(originalTitle, parseInt(year, 10), imdbId);
        }
        RatingsCache.set(cacheKey, { id: null, score: 0 });
        return null;
    }

    // ══════════════════════════════════════════════════════════════════
    // Kinopoisk (with localStorage Cache)
    // ══════════════════════════════════════════════════════════════════

    function fetchKinopoiskRating(title, year, type) {
        return new Promise((resolve) => {
            if (!CONFIG.KINOPOISK_API_KEY || CONFIG.KINOPOISK_API_KEY === 'DEIN_KEY_HIER') {
                resolve(null);
                return;
            }

            const cacheKey = `kinopoisk_${type}_${title}_${year}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) {
                if (cached.score != null) {
                    resolve(cached);
                } else {
                    resolve(null);
                }
                return;
            }
            
            const url = `https://kinopoiskapiunofficial.tech/api/v2.2/films?keyword=${encodeURIComponent(title)}&yearFrom=${year}&yearTo=${year}`;
            
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers: {
                    'X-API-KEY': CONFIG.KINOPOISK_API_KEY,
                    'Content-Type': 'application/json'
                },
                onload(res) {
                    if (res.status !== 200) {
                        resolve(null);
                        return;
                    }
                    let data;
                    try { data = JSON.parse(res.responseText); }
                    catch (e) {
                        resolve(null);
                        return;
                    }
                    
                    const list = data.items || data.films || [];
                    if (!list.length) {
                        RatingsCache.set(cacheKey, { score: null });
                        resolve(null);
                        return;
                    }
                    
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
    // ALLOCINÉ RATINGS (with localStorage Cache)
    // ══════════════════════════════════════════════════════════════════

    function getAllocineId(imdbId, type) {
        return new Promise((resolve) => {
            if (!imdbId) { resolve(null); return; }

            const memKey = `allocine_id_${imdbId}`;
            if (STATE.ratingsCache[memKey]) {
                resolve(STATE.ratingsCache[memKey]);
                return;
            }

            const cacheKey = `allocine_id_${type}_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) {
                STATE.ratingsCache[memKey] = cached.id;
                resolve(cached.id);
                return;
            }

            const prop = type === 'show' ? 'P1267' : 'P1265';
            const sparql = `
                SELECT ?allocine WHERE {
                    ?item wdt:P345 "${imdbId}" .
                    ?item wdt:${prop} ?allocine .
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
                    const allocineId = b.length && b[0].allocine?.value ? b[0].allocine.value : null;
                    
                    if (allocineId) {
                        STATE.ratingsCache[memKey] = allocineId;
                    }
                    RatingsCache.set(cacheKey, { id: allocineId });
                    resolve(allocineId);
                },
                onerror: () => resolve(null)
            });
        });
    }

    function fetchAllocineRatings(imdbId, type) {
        return new Promise((resolve) => {
            // Prüfe ob CORS Proxy verfügbar ist
            if (!imdbId || !isCorsProxyConfigured()) {
                console.log('[Spotlight] Allociné übersprungen - kein CORS Proxy konfiguriert');
                resolve(null);
                return;
            }

            const memKey = `allocine_ratings_${imdbId}`;
            if (STATE.ratingsCache[memKey]) {
                resolve(STATE.ratingsCache[memKey]);
                return;
            }

            const cacheKey = `allocine_ratings_${type}_${imdbId}`;
            const cached = RatingsCache.get(cacheKey);
            if (cached !== null) {
                if (cached.press || cached.audience) {
                    STATE.ratingsCache[memKey] = cached;
                    resolve(cached);
                } else {
                    resolve(null);
                }
                return;
            }

            getAllocineId(imdbId, type).then(allocineId => {
                if (!allocineId) {
                    RatingsCache.set(cacheKey, { press: null, audience: null });
                    resolve(null);
                    return;
                }

                const pathSegment = type === 'show' ? 'series' : 'film';
                const fileSegment = type === 'show' ? `ficheserie_gen_cserie=${allocineId}` : `fichefilm_gen_cfilm=${allocineId}`;
                const url = `${CONFIG.CORS_PROXY_URL}https://www.allocine.fr/${pathSegment}/${fileSegment}.html`;

                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    onload(res) {
                        if (res.status !== 200) { resolve(null); return; }

                        const html = res.responseText;
                        const foundRatings = [];

                        const ratingPattern = /class="stareval-note"[^>]*>\s*([\d][,.][\d])\s*<\/span>/g;
                        let match;
                        while ((match = ratingPattern.exec(html)) !== null) {
                            const val = parseFloat(match[1].replace(',', '.'));
                            if (val > 0 && val <= 5) {
                                foundRatings.push(val);
                            }
                        }

                        if (foundRatings.length === 0) {
                            const ratingItemPattern = /rating-item[\s\S]*?stareval-note[^>]*>\s*([\d][,.][\d])\s*</g;
                            let itemMatch;
                            while ((itemMatch = ratingItemPattern.exec(html)) !== null) {
                                const val = parseFloat(itemMatch[1].replace(',', '.'));
                                if (val > 0 && val <= 5) {
                                    foundRatings.push(val);
                                }
                            }
                        }

                        if (foundRatings.length === 0) {
                            const notePattern = /<span[^>]*class="[^"]*stareval-note[^"]*"[^>]*>\s*([\d][,.][\d])\s*<\/span>/g;
                            let noteMatch;
                            while ((noteMatch = notePattern.exec(html)) !== null) {
                                const val = parseFloat(noteMatch[1].replace(',', '.'));
                                if (val > 0 && val <= 5) {
                                    foundRatings.push(val);
                                }
                            }
                        }

                        if (foundRatings.length === 0) {
                            const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
                            if (jsonLdMatch) {
                                for (const block of jsonLdMatch) {
                                    try {
                                        const jsonStr = block.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '');
                                        const jsonData = JSON.parse(jsonStr);
                                        if (jsonData.aggregateRating) {
                                            const ratingValue = parseFloat(jsonData.aggregateRating.ratingValue);
                                            if (ratingValue > 0 && ratingValue <= 5) {
                                                foundRatings.push(ratingValue);
                                            }
                                        }
                                    } catch (e) { /* ignore */ }
                                }
                            }
                        }

                        if (foundRatings.length === 0) {
                            RatingsCache.set(cacheKey, { press: null, audience: null });
                            resolve(null);
                            return;
                        }

                        const result = {
                            press: foundRatings[0] || null,
                            audience: foundRatings[1] || null
                        };

                        STATE.ratingsCache[memKey] = result;
                        RatingsCache.set(cacheKey, result);
                        resolve(result);
                    },
                    onerror: () => resolve(null)
                });
            });
        });
    }

	// ══════════════════════════════════════════════════════════════════
	// Academy Awards (via Wikidata SPARQL)
	// ══════════════════════════════════════════════════════════════════

	function fetchAcademyAwards(imdbId) {
		return new Promise((resolve) => {
			if (!imdbId) {
				resolve(null);
				return;
			}

			const cacheKey = `academy_awards_${imdbId}`;
			const cached = RatingsCache.get(cacheKey);
			if (cached !== null) {
				if (cached.count > 0 || cached.nominations > 0) {
					resolve(cached);
				} else {
					resolve(null);
				}
				return;
			}

			const sparql = `
				SELECT (COUNT(DISTINCT ?award) AS ?wins) (COUNT(DISTINCT ?nomination) AS ?noms) WHERE {
					?item wdt:P345 "${imdbId}" .
					
					OPTIONAL {
						?item p:P166 ?awardStatement .
						?awardStatement ps:P166 ?award .
						?award wdt:P31*/wdt:P279* wd:Q19020 .
						FILTER NOT EXISTS { ?awardStatement pq:P1552 wd:Q4356445 . }
					}
					
					OPTIONAL {
						?item p:P1411 ?nomStatement .
						?nomStatement ps:P1411 ?nomination .
						?nomination wdt:P31*/wdt:P279* wd:Q19020 .
					}
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
						console.warn('[Spotlight] Wikidata Academy Awards query failed:', res.status);
						RatingsCache.set(cacheKey, { count: 0, nominations: 0 });
						resolve(null);
						return;
					}

					let json;
					try {
						json = JSON.parse(res.responseText);
					} catch (e) {
						console.error('[Spotlight] Academy Awards JSON parse error:', e);
						RatingsCache.set(cacheKey, { count: 0, nominations: 0 });
						resolve(null);
						return;
					}

					const bindings = json.results?.bindings;
					if (!bindings || bindings.length === 0) {
						RatingsCache.set(cacheKey, { count: 0, nominations: 0 });
						resolve(null);
						return;
					}

					const wins = parseInt(bindings[0].wins?.value || '0', 10);
					const nominations = parseInt(bindings[0].noms?.value || '0', 10);

					const result = { count: wins, nominations: nominations };
					RatingsCache.set(cacheKey, result);

					if (wins > 0 || nominations > 0) {
						resolve(result);
					} else {
						resolve(null);
					}
				},
				onerror(err) {
					console.error('[Spotlight] Academy Awards request error:', err);
					RatingsCache.set(cacheKey, { count: 0, nominations: 0 });
					resolve(null);
				}
			});
		});
	}

	function createAcademyAwardsBadge(wins, nominations) {
		const oscarContainer = document.createElement('div');
		oscarContainer.className = 'banner-oscars';
		
		// Separator-Punkt VOR dem Oscar-Logo (wie zwischen Genres)
		const leadingSeparator = document.createElement('span');
		leadingSeparator.className = 'banner-oscar-text banner-oscar-leading-separator';
		leadingSeparator.textContent = '•';
		oscarContainer.appendChild(leadingSeparator);
		
		// Oscar Logo
		const img = document.createElement('img');
		img.src = LOGO.academy;
		img.alt = 'Academy Awards';
		img.className = 'banner-oscar-logo';
		
		let titleText = 'Academy Awards:';
		if (wins > 0) titleText += ` ${wins} gewonnen`;
		if (wins > 0 && nominations > 0) titleText += ',';
		if (nominations > 0) titleText += ` ${nominations} nominiert`;
		img.title = titleText;
		
		oscarContainer.appendChild(img);

		// Wins (falls vorhanden)
		if (wins > 0) {
			const winsSpan = document.createElement('span');
			winsSpan.className = 'banner-oscar-text banner-oscar-wins';
			winsSpan.textContent = `${wins} Win${wins !== 1 ? 's' : ''}`;
			oscarContainer.appendChild(winsSpan);
		}

		// Separator (nur wenn beide vorhanden)
		if (wins > 0 && nominations > 0) {
			const dotSpan = document.createElement('span');
			dotSpan.className = 'banner-oscar-text banner-oscar-separator';
			dotSpan.textContent = '';
			oscarContainer.appendChild(dotSpan);
		}

		// Nominations (falls vorhanden)
		if (nominations > 0) {
			const nomsSpan = document.createElement('span');
			nomsSpan.className = 'banner-oscar-text banner-oscar-noms';
			nomsSpan.textContent = `${nominations} Nomination${nominations !== 1 ? 's' : ''}`;
			oscarContainer.appendChild(nomsSpan);
		}

		return oscarContainer;
	}

	// ══════════════════════════════════════════════════════════════════
	// Emmy Awards (via Wikidata SPARQL)
	// ══════════════════════════════════════════════════════════════════

	function fetchEmmyAwards(imdbId) {
		return new Promise((resolve) => {
			if (!imdbId) {
				resolve(null);
				return;
			}

			const cacheKey = `emmy_awards_${imdbId}`;
			const cached = RatingsCache.get(cacheKey);
			if (cached !== null) {
				if (cached.count > 0 || cached.nominations > 0) {
					resolve(cached);
				} else {
					resolve(null);
				}
				return;
			}

			// Einfachere, zuverlässigere Abfragen
			// Sucht nach allen Awards/Nominations die "Emmy" im englischen Label haben
			const sparqlWins = `
				SELECT (COUNT(DISTINCT ?award) AS ?count) WHERE {
					?item wdt:P345 "${imdbId}" .
					?item wdt:P166 ?award .
					?award rdfs:label ?label .
					FILTER(LANG(?label) = "en")
					FILTER(CONTAINS(LCASE(?label), "emmy"))
				}`;

			const sparqlNoms = `
				SELECT (COUNT(DISTINCT ?nom) AS ?count) WHERE {
					?item wdt:P345 "${imdbId}" .
					?item wdt:P1411 ?nom .
					?nom rdfs:label ?label .
					FILTER(LANG(?label) = "en")
					FILTER(CONTAINS(LCASE(?label), "emmy"))
				}`;

			console.log('[Spotlight] Fetching Emmy Awards für', imdbId);

			let wins = 0;
			let nominations = 0;
			let completedRequests = 0;

			const checkComplete = () => {
				completedRequests++;
				if (completedRequests === 2) {
					console.log(`[Spotlight] Emmy für ${imdbId}: ${wins} Wins, ${nominations} Nominations`);
					const result = { count: wins, nominations: nominations };
					RatingsCache.set(cacheKey, result);
					if (wins > 0 || nominations > 0) {
						resolve(result);
					} else {
						resolve(null);
					}
				}
			};

			// Wins abfragen
			GM_xmlhttpRequest({
				method: 'GET',
				url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparqlWins),
				headers: {
					'Accept': 'application/sparql-results+json',
					'User-Agent': 'EmbySpotlightScript/1.0'
				},
				onload(res) {
					if (res.status === 200) {
						try {
							const json = JSON.parse(res.responseText);
							wins = parseInt(json.results?.bindings?.[0]?.count?.value || '0', 10);
							console.log('[Spotlight] Emmy Wins raw:', json.results?.bindings);
						} catch (e) {
							console.error('[Spotlight] Emmy Wins parse error:', e);
						}
					} else {
						console.warn('[Spotlight] Emmy Wins query failed:', res.status);
					}
					checkComplete();
				},
				onerror(err) { 
					console.error('[Spotlight] Emmy Wins request error:', err);
					checkComplete(); 
				}
			});

			// Nominations abfragen
			GM_xmlhttpRequest({
				method: 'GET',
				url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparqlNoms),
				headers: {
					'Accept': 'application/sparql-results+json',
					'User-Agent': 'EmbySpotlightScript/1.0'
				},
				onload(res) {
					if (res.status === 200) {
						try {
							const json = JSON.parse(res.responseText);
							nominations = parseInt(json.results?.bindings?.[0]?.count?.value || '0', 10);
							console.log('[Spotlight] Emmy Nominations raw:', json.results?.bindings);
						} catch (e) {
							console.error('[Spotlight] Emmy Noms parse error:', e);
						}
					} else {
						console.warn('[Spotlight] Emmy Noms query failed:', res.status);
					}
					checkComplete();
				},
				onerror(err) { 
					console.error('[Spotlight] Emmy Noms request error:', err);
					checkComplete(); 
				}
			});
		});
	}

	function createEmmyAwardsBadge(wins, nominations) {
		const emmyContainer = document.createElement('div');
		emmyContainer.className = 'banner-emmys';
		
		// Separator-Punkt VOR dem Emmy-Logo
		const leadingSeparator = document.createElement('span');
		leadingSeparator.className = 'banner-emmy-text banner-emmy-leading-separator';
		leadingSeparator.textContent = '•';
		emmyContainer.appendChild(leadingSeparator);
		
		// Emmy Logo
		const img = document.createElement('img');
		img.src = LOGO.emmy;
		img.alt = 'Emmy Awards';
		img.className = 'banner-emmy-logo';
		
		let titleText = 'Emmy Awards:';
		if (wins > 0) titleText += ` ${wins} gewonnen`;
		if (wins > 0 && nominations > 0) titleText += ',';
		if (nominations > 0) titleText += ` ${nominations} nominiert`;
		img.title = titleText;
		
		emmyContainer.appendChild(img);

		// Wins (falls vorhanden)
		if (wins > 0) {
			const winsSpan = document.createElement('span');
			winsSpan.className = 'banner-emmy-text banner-emmy-wins';
			winsSpan.textContent = `${wins} Win${wins !== 1 ? 's' : ''}`;
			emmyContainer.appendChild(winsSpan);
		}

		// Separator (nur wenn beide vorhanden)
		if (wins > 0 && nominations > 0) {
			const dotSpan = document.createElement('span');
			dotSpan.className = 'banner-emmy-text banner-emmy-separator';
			dotSpan.textContent = '';
			emmyContainer.appendChild(dotSpan);
		}

		// Nominations (falls vorhanden)
		if (nominations > 0) {
			const nomsSpan = document.createElement('span');
			nomsSpan.className = 'banner-emmy-text banner-emmy-noms';
			nomsSpan.textContent = `${nominations} Nomination${nominations !== 1 ? 's' : ''}`;
			emmyContainer.appendChild(nomsSpan);
		}

		return emmyContainer;
	}

   
    // ══════════════════════════════════════════════════════════════════
    // SponsorBlock
    // ══════════════════════════════════════════════════════════════════

    async function fetchSponsorBlockSegments(videoId) {
        if (!CONFIG.enableSponsorBlock || !videoId) return [];
        
        try {
            const categories = CONFIG.sponsorBlockCategories.join(',');
            const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=[${categories.split(',').map(c => `"${c}"`).join(',')}]`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return [];
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data || [];
            
        } catch (error) {
            console.warn("[Spotlight] SponsorBlock fetch failed:", error);
            return [];
        }
    }
    
    function startSponsorBlockMonitoring(player, videoId, itemId) {
        if (!CONFIG.enableSponsorBlock || STATE.skipIntervals[itemId]) return;
        
        const segments = STATE.sponsorBlockSegments[videoId] || [];
        if (segments.length === 0) return;
        
        const checkInterval = setInterval(() => {
            if (!player || !player.getCurrentTime) {
                clearInterval(checkInterval);
                delete STATE.skipIntervals[itemId];
                return;
            }
            
            try {
                const currentTime = player.getCurrentTime();
                
                for (const segment of segments) {
                    const [start, end] = segment.segment;
                    
                    if (currentTime >= start && currentTime < end) {
                        console.log(`[Spotlight] SponsorBlock: Skipping ${segment.category} from ${start}s to ${end}s`);
                        player.seekTo(end, true);
                        break;
                    }
                }
            } catch (e) {
                console.warn("[Spotlight] SponsorBlock monitoring error:", e);
            }
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
            if (window.YT && window.YT.Player) {
                STATE.youtubeAPIReady = true;
                resolve();
                return;
            }
            
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
            
            if (!url || url.trim() === '') {
                return null;
            }
            
            const videoId = extractYouTubeVideoId(url);
            if (!videoId) {
                console.warn(`[Spotlight] Konnte Video-ID nicht extrahieren aus: ${url}`);
                return null;
            }
            
            return {
                url: url,
                videoId: videoId,
                isYouTube: true
            };
        }
        
        if (item.LocalTrailerIds && item.LocalTrailerIds.length > 0) {
            const trailerId = item.LocalTrailerIds[0];
            const serverAddress = apiClient.serverAddress();
            const accessToken = apiClient.accessToken();
            
            return {
                url: `${serverAddress}/Videos/${trailerId}/stream?static=true&api_key=${accessToken}`,
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
                if (match && match[1]) {
                    console.log(`[Spotlight] Video-ID aus Plugin-URL extrahiert: ${match[1]}`);
                    return match[1];
                }
                return null;
            }
            
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com')) {
                return urlObj.searchParams.get('v');
            }
            if (urlObj.hostname.includes('youtu.be')) {
                return urlObj.pathname.substring(1);
            }
        } catch (e) {
            const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|video_id=)([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                console.log(`[Spotlight] Video-ID per Regex extrahiert: ${match[1]}`);
                return match[1];
            }
            console.warn("[Spotlight] Konnte keine Video-ID extrahieren:", url);
        }
        return null;
    }
    
    function insertStyles() {
        if (document.getElementById("spotlight-css-emby")) return;
        
        const bgColor = CONFIG.backgroundColor;
        const playbuttonColor = CONFIG.playbuttonColor;
        const top = parseColor(CONFIG.vignetteColorTop);
        const bottom = parseColor(CONFIG.vignetteColorBottom);
        const left = parseColor(CONFIG.vignetteColorLeft);
        const right = parseColor(CONFIG.vignetteColorRight);

        function gradientSteps(c) {
            const r = c.r, g = c.g, b = c.b;
            return `
                rgba(${r}, ${g}, ${b}, 1)    0%, 
                rgba(${r}, ${g}, ${b}, 1)    2%,
                rgba(${r}, ${g}, ${b}, 1)    4%,
                rgba(${r}, ${g}, ${b}, 0.99) 6%,
                rgba(${r}, ${g}, ${b}, 0.97) 8%,
                rgba(${r}, ${g}, ${b}, 0.95) 10%,
                rgba(${r}, ${g}, ${b}, 0.9)  15%,
                rgba(${r}, ${g}, ${b}, 0.85) 20%,
                rgba(${r}, ${g}, ${b}, 0.75) 30%,
                rgba(${r}, ${g}, ${b}, 0.6)  40%,
                rgba(${r}, ${g}, ${b}, 0.4)  50%,
                rgba(${r}, ${g}, ${b}, 0.2)  70%,
                transparent                  100%`;
        }
    
        const css = `
        .spotlight-container { 
            width: 100%;
            display: block; 
            position: relative; 
            margin-top: 0;
            margin-left: 0;
            margin-right: 0;
            padding: 0;
            transition: box-shadow 0.3s ease;
            border-radius: 0;
            box-shadow: none;
            min-height: calc(100vh - 10rem);
        }
        
        .spotlight-container:hover {
            box-shadow: none;
            border-radius: 0;
        }
        
        .spotlight { 
            position: relative; 
            overflow: visible;
            width: 100%;
            height: 100%;
        }
        
        .spotlight .banner-slider-wrapper {
            position: relative;
            width: 100%;
            height: calc(100vh - 10rem);
            overflow: hidden;
            border-radius: 0;
            background-color: ${bgColor};
            -webkit-backface-visibility: hidden;
            -moz-backface-visibility: hidden;
            backface-visibility: hidden;
            transform: translateZ(0);
        }
        
        .spotlight .banner-slider { 
            display: flex; 
            transition: transform .5s ease; 
            will-change: transform;
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
        }
        
        .spotlight .banner-item { 
            flex: 0 0 100%; 
            min-width: 100%;
            max-width: 100%;
            height: 100%;
            position: relative; 
            cursor: pointer;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            overflow: hidden;
        }
        
        .spotlight .banner-cover { 
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            display: block; 
            pointer-events: none;
            margin: 0;
            padding: 0;
            border: 0;
            outline: 0;
            position: relative;
            transform-origin: center center;
            animation: zoomOut 8s ease-out forwards;
        }
        
        @keyframes zoomOut {
            0% {
                transform: scale(1.15);
            }
            100% {
                transform: scale(1.0);
            }
        }
        
        .spotlight .video-backdrop {
            width: 100vw;
            height: 56.25vw;
            min-height: 100vh;
            min-width: 177.77vh;
            object-fit: cover;
            object-position: center;
            display: block;
            pointer-events: none;
            margin: 0;
            padding: 0;
            border: 0;
            outline: 0;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(1.2);
            z-index: 1;
        }
        
        .spotlight .youtube-backdrop,
        .spotlight .html5-backdrop {
            animation: none !important;
        }
        
        .spotlight .youtube-backdrop {
            opacity: 0;
            transition: opacity 0.5s ease-in;
        }
        
        .spotlight .youtube-backdrop.video-ready {
            opacity: 1;
        }
        
        .spotlight .youtube-backdrop iframe {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            opacity: 0;
            transition: opacity 0.5s ease-in;
        }

        .spotlight .youtube-backdrop.video-ready iframe {
            opacity: 1;
        }
        
        .spotlight .video-placeholder {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            display: block;
            pointer-events: none;
            margin: 0;
            padding: 0;
            border: 0;
            outline: 0;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 2;
            transition: opacity 0.5s ease-out;
        }
        
        .spotlight .video-placeholder.hidden {
            opacity: 0;
            pointer-events: none;
        }
        
        .spotlight .banner-gradient-left {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            width: 50%;
            pointer-events: none;
            z-index: 6;
            background: linear-gradient(to right, ${gradientSteps(left)});
        }
        
        .spotlight .banner-gradient-right {
            position: absolute;
            top: 0;
            bottom: 0;
            right: 0;
            width: 40%;
            pointer-events: none;
            z-index: 6;
            background: linear-gradient(to left, ${gradientSteps(right)});
        }
        
        .spotlight .banner-vignette-top {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 50%;
            pointer-events: none;
            z-index: 6;
            background: linear-gradient(to bottom, ${gradientSteps(top)});
        }
        
        .spotlight .banner-vignette-bottom {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 50%;
            pointer-events: none;
            z-index: 6;
            background: linear-gradient(to top, ${gradientSteps(bottom)});
        }
        
        .spotlight .banner-logo {
            position: absolute;
            left: 4vw;
            top: 15vh;
            transform: none;
            max-width: 35%;
            max-height: 25vh;
            object-fit: contain;
            z-index: 15;
            filter: drop-shadow(0 6px 20px rgba(0,0,0,0.95)) drop-shadow(0 0 40px rgba(0,0,0,0.6));
            pointer-events: none;
            cursor: default;
            transition: transform 0.5s ease, opacity 0.3s ease;
        }
        
        .spotlight .banner-logo.hidden {
            opacity: 0;
            pointer-events: none;
        }
        
        .spotlight .banner-title { 
            position: absolute; 
            left: 4vw;
            top: 15vh;
            transform: none;
            z-index: 10; 
            font-size: clamp(2rem, 4vw, 3.5rem);
            font-weight: 700; 
            color: #fff;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
            pointer-events: none;
            cursor: default;
            text-align: left;
            max-width: 35%;
            transition: transform 0.5s ease, opacity 0.3s ease;
        }
        
        .spotlight .banner-title.hidden {
            opacity: 0;
            pointer-events: none;
        }
        
        .spotlight .banner-overview {
            position: absolute;
            left: 4vw;
            bottom: 8rem;
            top: auto;
            transform: none;
            z-index: 16;
            max-width: 35%;
            padding: 0;
            background: none;
            opacity: 1;
            pointer-events: none;
            cursor: default;
        }
        
        .spotlight .banner-overview-text {
            font-size: clamp(1rem, 1.6vw, 1.3rem);
            color: rgba(255,255,255,0.9);
            text-shadow: 2px 2px 8px rgba(0,0,0,0.99), 0 0 20px rgba(0,0,0,0.9);
            font-weight: 500;
            line-height: 1.6;
            text-align: left;
            display: -webkit-box;
            -webkit-line-clamp: 7;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        @media (max-width: 1600px), (orientation: portrait) {
            .spotlight .banner-overview {
                visibility: hidden;
            }
            
            .spotlight .banner-overview-text {
                visibility: hidden;
            }
        }
        
        .spotlight .banner-tagline {
            display: none !important;
        }
        
        .spotlight .banner-info {
            position: absolute;
            left: 4vw;
            bottom: 1.5rem;
            z-index: 10;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
            pointer-events: none;
            max-width: 80%;
        }
        
        .spotlight .banner-genres {
            display: flex;
            gap: 0.8rem;
            flex-wrap: wrap;
            justify-content: flex-start;
        }
        
        .spotlight .banner-genre {
            font-size: clamp(1.1rem, 1.8vw, 1.4rem);
            color: rgba(255,255,255,0.9);
            text-shadow: 1px 1px 4px rgba(0,0,0,0.9);
            font-weight: 500;
        }
        
        .spotlight .banner-genre:not(:last-child)::after {
            content: '•';
            margin-left: 0.8rem;
            opacity: 0.6;
        }
        
        .spotlight .banner-meta {
            display: flex;
            gap: 1.2rem;
            align-items: center;
            flex-wrap: wrap;
            justify-content: flex-start;
        }
        
        .spotlight .banner-meta-item {
            font-size: clamp(1.1rem, 1.8vw, 1.4rem);
            color: rgba(255,255,255,0.85);
            text-shadow: 1px 1px 4px rgba(0,0,0,0.9);
            font-weight: 500;
        }
        
        .spotlight .meta-rating-item {
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }
        
        .spotlight .meta-rating-icon {
            width: 1.8rem;
            height: 1.8rem;
            object-fit: contain;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
        }
        
        .spotlight .meta-rating-star {
            width: 1.8rem;
            height: 1.8rem;
            fill: #cb272a;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
        }
        
        .spotlight .meta-rating-score {
            font-size: clamp(1.1rem, 1.8vw, 1.4rem);
            font-weight: 500;
            color: rgba(255,255,255,0.85);
            text-shadow: 1px 1px 4px rgba(0,0,0,0.9);
        }
        
        .spotlight .custom-ratings-container {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
            align-items: center;
        }
        
        .spotlight .custom-rating-item {
            display: flex;
            align-items: center;
            gap: 0.3rem;
        }
        
        .spotlight .custom-rating-logo {
            height: 1.6rem;
            width: auto;
            object-fit: contain;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
        }
        
        .spotlight .custom-rating-value {
            font-size: clamp(1rem, 1.6vw, 1.3rem);
            font-weight: 500;
            color: rgba(255,255,255,0.85);
            text-shadow: 1px 1px 4px rgba(0,0,0,0.9);
        }
        
        .spotlight .play-button-overlay {
            position: absolute;
            top: 5rem;
            right: 1.5rem;
            z-index: 25;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }
        
        .spotlight-container:hover .play-button-overlay {
            opacity: 1;
            pointer-events: all;
        }

		.spotlight .banner-genres-row {
			display: flex;
			align-items: center;
			gap: 1.5rem;
			flex-wrap: wrap;
		}

		.spotlight .banner-oscars,
		.spotlight .banner-emmys {
			display: flex;
			align-items: center;
			gap: 0.4rem;
		}
		
		.banner-oscar-text.banner-oscar-leading-separator,
		.banner-emmy-text.banner-emmy-leading-separator {
			color: rgba(255, 255, 255, 0.5);
		}

		.spotlight .banner-oscar-logo,
		.spotlight .banner-emmy-logo {
			height: clamp(1.1rem, 1.8vw, 1.4rem);
			width: auto;
			object-fit: contain;
			filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
			margin-bottom: 5px;
			margin-right: 12px;
			margin-left: 9px;
		}

		.spotlight .banner-oscar-text,
		.spotlight .banner-emmy-text {
			font-size: clamp(1.1rem, 1.8vw, 1.4rem);
			font-weight: 500;
			text-shadow: 1px 1px 4px rgba(0,0,0,0.9);
			margin-left: -8px;
		}

		.spotlight .banner-oscar-wins {
			color: #d4af37;
		}

		.spotlight .banner-emmy-wins {
			color: #c9a227;
		}

		.spotlight .banner-oscar-separator,
		.spotlight .banner-emmy-separator {
			color: #fff;
			margin: 0 0.3rem;
		}

		.spotlight .banner-oscar-noms,
		.spotlight .banner-emmy-noms {
			color: rgba(255,255,255,0.7);
		}
        
        .spotlight .play-button {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: rgba(55, 55, 55, 0.3);
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        
        .spotlight .play-button:hover {
            transform: scale(1.02);
            background: ${playbuttonColor};
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
        }
        
        .spotlight .play-button svg {
            width: 40px;
            height: 40px;
            fill: #ffffff;
            margin-left: 6px;
            position: relative;
            left: -2px;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
            transition: filter 0.3s ease;
        }
        
        .spotlight .play-button:hover svg {
            filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5));
        }
        
        .spotlight .pause-button {
            position: absolute;
            bottom: 8rem;
            right: 2rem;
            z-index: 25;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: rgba(55, 55, 55, 0.3);
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            opacity: 0;
            pointer-events: none;
        }
        
        .spotlight-container:hover .pause-button.visible {
            opacity: 1;
            pointer-events: all;
        }
        
        .spotlight .pause-button:hover {
            transform: scale(1.02);
            background: ${playbuttonColor};
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
        }
        
        .spotlight .pause-button svg {
            width: 24px;
            height: 24px;
            fill: #ffffff;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
            transition: filter 0.3s ease;
        }
        
        .spotlight .pause-button:hover svg {
            filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5));
        }
        
        .spotlight .mute-button {
            position: absolute;
            bottom: 4rem;
            right: 2rem;
            z-index: 25;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: rgba(55, 55, 55, 0.3);
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            opacity: 0;
            pointer-events: none;
        }
        
        .spotlight-container:hover .mute-button.visible {
            opacity: 1;
            pointer-events: all;
        }
        
        .spotlight .mute-button:hover {
            transform: scale(1.02);
            background: ${playbuttonColor};
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
        }
        
        .spotlight .mute-button svg {
            width: 24px;
            height: 24px;
            fill: #ffffff;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
            transition: filter 0.3s ease;
        }
        
        .spotlight .mute-button:hover svg {
            filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5));
        }
        .spotlight .refresh-button {
            position: absolute;
            bottom: 12rem;
            right: 2rem;
            z-index: 25;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: rgba(55, 55, 55, 0.3);
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            opacity: 0;
            pointer-events: none;
        }
        .spotlight-container:hover .refresh-button.visible {
            opacity: 1;
            pointer-events: all;
        }
        .spotlight .refresh-button:hover {
            transform: scale(1.02) rotate(180deg);
            background: ${playbuttonColor};
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
        }
        .spotlight .refresh-button svg {
            width: 24px;
            height: 24px;
            fill: #ffffff;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
            transition: filter 0.3s ease;
        }
        .spotlight .refresh-button:hover svg {
            filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5));
        }
        .spotlight .refresh-button.refreshing {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from {
                transform: rotate(0deg);
            }
            to {
                transform: rotate(360deg);
            }
        }
        @media (max-width: 768px), (orientation: portrait) {
            .spotlight .refresh-button {
                bottom: calc(1rem + 100px + 1rem);
                right: 1rem;
            }
        }
        
        .spotlight .arrow { 
            position: absolute; 
            top: 50%; 
            transform: translateY(-50%); 
            z-index: 20; 
            border: none; 
            color: white; 
            cursor: pointer; 
            opacity: 0.7; 
            padding: 0;
            background: none;
            transition: opacity 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .spotlight .arrow svg {
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.8));
        }
        
        .spotlight .arrow:hover { 
            opacity: 1; 
        }
        
        .spotlight .arrow.left { left: 1rem; } 
        .spotlight .arrow.right { right: 1rem; }
        
        .spotlight .controls { 
            position: absolute; 
            right: 2rem; 
            bottom: 2.3rem; 
            z-index: 20; 
            display: flex; 
            gap: .5rem; 
        }
        
        .spotlight .control { 
            width: .8rem; 
            height: .8rem; 
            border-radius: 50%; 
            background: rgba(255,255,255,0.4); 
            border: none; 
            cursor: pointer; 
            transition: background 0.3s;
        }
        
        .spotlight .control.active { 
            background: white; 
        }
        
        .spotlight .loader { 
            position: absolute; 
            inset: 0; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            z-index: 30; 
            background: rgba(0,0,0,0.3); 
        }
        
        @media (max-width: 768px), (orientation: portrait) {
            .spotlight-container {
                min-height: 60vh;
            }
            
            .spotlight .banner-slider-wrapper {
                height: 60vh;
            }
            
            .spotlight .video-backdrop {
                width: 100%;
                height: 100%;
                position: relative;
                top: auto;
                left: auto;
                transform: none;
                min-height: unset;
                min-width: unset;
            }
            
            .spotlight .banner-logo,
            .spotlight .banner-title,
            .spotlight .banner-overview {
                left: 50%;
                transform: translateX(-50%);
                max-width: 70%;
                text-align: center;
            }
            
            .spotlight .banner-overview-text {
                text-align: center;
            }
            
            .spotlight .banner-info {
                left: 50%;
                transform: translateX(-50%);
                max-width: 85%;
                align-items: center;
            }
            
            .spotlight .banner-genres,
            .spotlight .banner-meta {
                justify-content: center;
            }
            
            .spotlight .control {
                display: none;
            }
            
            .spotlight .pause-button {
                bottom: 1rem;
                right: calc(1rem + 50px + 1rem);
            }
            
            .spotlight .mute-button {
                bottom: 1rem;
                right: 1rem;
            }
        }
        `;
        
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
            SortBy: "PremiereDate,ProductionYear,CriticRating",
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
        const pref = options.prefer || "Backdrop";
        
        if (item.ImageUrl) {
            let url = item.ImageUrl;
            if (options.addImageSizeToUrl && width) url += "&maxWidth=" + width;
            return url;
        }
        
        const tags = item.ImageTags || {};
        
        if ((pref === "Backdrop" || pref === "Auto") && item.BackdropImageTags && item.BackdropImageTags.length) {
            return apiClient.getImageUrl(item.Id, { type: "Backdrop", maxWidth: width, tag: item.BackdropImageTags[0] });
        }
        if (tags.Primary) {
            return apiClient.getImageUrl(item.Id, { type: "Primary", maxWidth: width, tag: tags.Primary });
        }
        if (tags.Thumb) {
            return apiClient.getImageUrl(item.Id, { type: "Thumb", maxWidth: width, tag: tags.Thumb });
        }
        return apiClient.getImageUrl(item.Id, { type: "Primary", maxWidth: width });
    }
    
    function getLogoUrl(apiClient, item) {
        const tags = item.ImageTags || {};
        if (tags.Logo) {
            return apiClient.getImageUrl(item.Id, { type: "Logo", maxWidth: 800, tag: tags.Logo });
        }
        return null;
    }
    
    async function loadCustomItemsList() {
        try {
            const response = await fetch(CONFIG.customItemsFile);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            
            const itemIds = text
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#'))
                .filter(line => /^[a-zA-Z0-9]+$/.test(line));
            
            if (itemIds.length === 0) {
                return null;
            }
            
            return itemIds;
            
        } catch (error) {
            return null;
        }
    }
    
    async function fetchItemsByIds(apiClient, itemIds) {
        try {
            const items = [];
            const userId = apiClient.getCurrentUserId();
            
            for (const itemId of itemIds) {
                try {
                    const item = await apiClient.getItem(userId, itemId);
                    
                    if (item) {
                        if (item.Type === "BoxSet" || item.CollectionType === "boxsets") {
                            const collectionItems = await apiClient.getItems(userId, {
                                ParentId: itemId,
                                Recursive: true,
                                IncludeItemTypes: "Movie,Series",
                                Fields: "PrimaryImageAspectRatio,BackdropImageTags,ImageTags,ParentLogoImageTag,ParentLogoItemId,CriticRating,CommunityRating,OfficialRating,PremiereDate,ProductionYear,Genres,RunTimeTicks,Taglines,Overview,RemoteTrailers,LocalTrailerIds,ProviderIds"
                            });
                            
                            if (collectionItems && collectionItems.Items) {
                                items.push(...collectionItems.Items);
                            }
                        } else {
                            items.push(item);
                        }
                    }
                } catch (error) {
                    console.warn(`[Spotlight] Fehler beim Laden von Item ${itemId}:`, error);
                }
            }
            
            return items;
            
        } catch (error) {
            return [];
        }
    }
    
    async function fetchStandardItems(apiClient) {
        const q = buildQuery();
        try {
            const items = await apiClient.getItems(apiClient.getCurrentUserId(), q);
            const allItems = items.Items || [];
            const shuffledItems = shuffleArray(allItems);
            return shuffledItems.slice(0, CONFIG.limit);
        } catch (e) {
            return [];
        }
    }
    
    async function fetchItems(apiClient) {
        const customItemIds = await loadCustomItemsList();
        
        if (customItemIds && customItemIds.length > 0) {
            const items = await fetchItemsByIds(apiClient, customItemIds);
            
            if (items.length === 0) {
                return fetchStandardItems(apiClient);
            }
            
            const shuffledItems = shuffleArray(items);
            return shuffledItems.slice(0, Math.min(CONFIG.limit, shuffledItems.length));
        }
        
        return fetchStandardItems(apiClient);
    }
    
	async function createInfoElement(item) {
		const infoContainer = document.createElement("div");
		infoContainer.className = "banner-info";
		
		// Container für Genres + Oscars + Emmys (in einer Zeile)
		const genresRow = document.createElement("div");
		genresRow.className = "banner-genres-row";
		
		// Genres
		if (item.Genres && item.Genres.length > 0) {
			const genresDiv = document.createElement("div");
			genresDiv.className = "banner-genres";
			const genresToShow = item.Genres.slice(0, 3);
			genresToShow.forEach(genre => {
				const genreSpan = document.createElement("span");
				genreSpan.className = "banner-genre";
				genreSpan.textContent = genre;
				genresDiv.appendChild(genreSpan);
			});
			genresRow.appendChild(genresDiv);
		}
		
		// Oscar-Platzhalter (wird async befüllt)
		const oscarPlaceholder = document.createElement("div");
		oscarPlaceholder.className = "banner-oscars-placeholder";
		genresRow.appendChild(oscarPlaceholder);
		
		// Emmy-Platzhalter (wird async befüllt)
		const emmyPlaceholder = document.createElement("div");
		emmyPlaceholder.className = "banner-emmys-placeholder";
		genresRow.appendChild(emmyPlaceholder);
		
		infoContainer.appendChild(genresRow);
		
		// Academy Awards async laden
		const imdbId = getImdbId(item);
		if (imdbId) {
			fetchAcademyAwards(imdbId).then(oscarData => {
				if (oscarData && (oscarData.count > 0 || oscarData.nominations > 0)) {
					const oscarBadge = createAcademyAwardsBadge(oscarData.count, oscarData.nominations);
					oscarPlaceholder.replaceWith(oscarBadge);
					console.log(`[Spotlight] Academy Awards für ${item.Name}: ${oscarData.count} Wins, ${oscarData.nominations} Nominations`);
				} else {
					oscarPlaceholder.remove();
				}
			});
			
			// Emmy Awards async laden
			fetchEmmyAwards(imdbId).then(emmyData => {
				if (emmyData && (emmyData.count > 0 || emmyData.nominations > 0)) {
					const emmyBadge = createEmmyAwardsBadge(emmyData.count, emmyData.nominations);
					emmyPlaceholder.replaceWith(emmyBadge);
					console.log(`[Spotlight] Emmy Awards für ${item.Name}: ${emmyData.count} Wins, ${emmyData.nominations} Nominations`);
				} else {
					emmyPlaceholder.remove();
				}
			});
		} else {
			oscarPlaceholder.remove();
			emmyPlaceholder.remove();
		}
		
		const metaDiv = document.createElement("div");
		metaDiv.className = "banner-meta";
		
		if (item.ProductionYear) {
			const yearSpan = document.createElement("span");
			yearSpan.className = "banner-meta-item";
			yearSpan.textContent = item.ProductionYear;
			metaDiv.appendChild(yearSpan);
		}
		
		if (item.RunTimeTicks) {
			const runtimeMinutes = Math.round(item.RunTimeTicks / 600000000);
			const runtimeSpan = document.createElement("span");
			runtimeSpan.className = "banner-meta-item";
			runtimeSpan.textContent = formatRuntime(runtimeMinutes);
			metaDiv.appendChild(runtimeSpan);
		}
		
		if (CONFIG.enableCustomRatings) {
			const tmdbId = getTmdbId(item);
			const type = item.Type === 'Series' ? 'show' : 'movie';
			
			if (tmdbId) {
				fetchMDBListRatings(type, tmdbId, item).then(async (ratingsData) => {
					if (!ratingsData) return;
					
					const hasRTFromMDBList = ratingsData._hasRTFromMDBList;
					
					// Render all rating badges from MDBList
					ratingsData.ratings.forEach(rating => {
						const ratingItem = document.createElement("div");
						ratingItem.className = "custom-rating-item";
						
						const img = document.createElement("img");
						img.src = rating.logo;
						img.alt = rating.source;
						img.className = "custom-rating-logo";
						img.title = `${rating.source}: ${rating.value}${rating.votes ? ` (${rating.votes} votes)` : ''}`;
						img.dataset.source = rating.key;
						img.dataset.ratingType = rating._isCritics ? 'critics' : (rating._isAudience ? 'audience' : '');
						
						const value = document.createElement("span");
						value.className = "custom-rating-value";
						value.textContent = rating.value;
						
						ratingItem.appendChild(img);
						ratingItem.appendChild(value);
						metaDiv.appendChild(ratingItem);
					});
					
					// RT FALLBACK
					if (!hasRTFromMDBList && imdbId) {
						console.log('[Spotlight] MDBList hat keine RT-Daten für', item.Name, '- scrape direkt von RT');
						const rtDirect = await fetchRottenTomatoesDirectly(imdbId, type);
						
						if (rtDirect) {
							if (rtDirect.criticsScore !== null) {
								const criticsLogo = rtDirect.criticsScore < 60 ? 'tomatoes_rotten' :
												   (rtDirect.criticsCertified ? 'tomatoes_certified' : 'tomatoes');
								
								const ratingItem = document.createElement("div");
								ratingItem.className = "custom-rating-item";
								
								const img = document.createElement("img");
								img.src = LOGO[criticsLogo];
								img.alt = "Rotten Tomatoes";
								img.className = "custom-rating-logo";
								img.title = `Rotten Tomatoes: ${rtDirect.criticsScore}%`;
								img.dataset.source = criticsLogo;
								
								const value = document.createElement("span");
								value.className = "custom-rating-value";
								value.textContent = rtDirect.criticsScore;
								
								ratingItem.appendChild(img);
								ratingItem.appendChild(value);
								metaDiv.appendChild(ratingItem);
							}
							
							if (rtDirect.audienceScore !== null) {
								const audienceLogo = rtDirect.audienceScore < 60 ? 'audience_rotten' :
													(rtDirect.audienceCertified ? 'rotten_ver' : 'audience');
								
								const ratingItem = document.createElement("div");
								ratingItem.className = "custom-rating-item";
								
								const img = document.createElement("img");
								img.src = LOGO[audienceLogo];
								img.alt = "RT Audience";
								img.className = "custom-rating-logo";
								img.title = `RT Audience: ${rtDirect.audienceScore}%`;
								img.dataset.source = audienceLogo;
								
								const value = document.createElement("span");
								value.className = "custom-rating-value";
								value.textContent = rtDirect.audienceScore;
								
								ratingItem.appendChild(img);
								ratingItem.appendChild(value);
								metaDiv.appendChild(ratingItem);
							}
						}
					}
					// RT UPGRADE
					else if (hasRTFromMDBList && imdbId) {
						const tomatoesScore = ratingsData._tomatoesScore;
						const audienceScore = ratingsData._audienceScore;
						
						if (tomatoesScore >= 60 || audienceScore >= 60) {
							fetchRTCertifiedStatus(imdbId, type).then(rtStatus => {
								const allLogos = metaDiv.querySelectorAll('.custom-rating-logo');
								
								allLogos.forEach(logoImg => {
									const ratingType = logoImg.dataset.ratingType;
									const currentSource = logoImg.dataset.source;
									
									if (ratingType === 'critics' && tomatoesScore >= 60 && rtStatus.criticsCertified !== null) {
										if (rtStatus.criticsCertified === true && currentSource !== 'tomatoes_certified') {
											logoImg.src = LOGO.tomatoes_certified;
											logoImg.dataset.source = 'tomatoes_certified';
										} else if (rtStatus.criticsCertified === false && currentSource === 'tomatoes_certified') {
											logoImg.src = LOGO.tomatoes;
											logoImg.dataset.source = 'tomatoes';
										}
									}
									
									if (ratingType === 'audience' && audienceScore >= 60 && rtStatus.audienceCertified !== null) {
										if (rtStatus.audienceCertified === true && currentSource !== 'rotten_ver') {
											logoImg.src = LOGO.rotten_ver;
											logoImg.dataset.source = 'rotten_ver';
										} else if (rtStatus.audienceCertified === false && currentSource === 'rotten_ver') {
											logoImg.src = LOGO.audience;
											logoImg.dataset.source = 'audience';
										}
									}
								});
								
								// Update cache
								const cacheKey = `mdblist_${type}_${tmdbId}`;
								const updatedRatings = ratingsData.ratings.map(r => {
									if (r._isCritics && tomatoesScore >= 60 && rtStatus.criticsCertified !== null) {
										if (rtStatus.criticsCertified === true) {
											return { ...r, key: 'tomatoes_certified', logo: LOGO.tomatoes_certified };
										} else if (rtStatus.criticsCertified === false && r.key === 'tomatoes_certified') {
											return { ...r, key: 'tomatoes', logo: LOGO.tomatoes };
										}
									}
									if (r._isAudience && audienceScore >= 60 && rtStatus.audienceCertified !== null) {
										if (rtStatus.audienceCertified === true) {
											return { ...r, key: 'rotten_ver', logo: LOGO.rotten_ver };
										} else if (rtStatus.audienceCertified === false && r.key === 'rotten_ver') {
											return { ...r, key: 'audience', logo: LOGO.audience };
										}
									}
									return r;
								});
								
								const updatedResult = { ...ratingsData, ratings: updatedRatings };
								const memKey = `mdb_${type}_${tmdbId}`;
								STATE.ratingsCache[memKey] = updatedResult;
								RatingsCache.set(cacheKey, updatedResult);
							});
						}
					}
					
					// AniList
					if (imdbId) {
						const anilistRating = await fetchAniListRating(imdbId, ratingsData.originalTitle, ratingsData.year);
						if (anilistRating && anilistRating.score) {
							const ratingItem = document.createElement("div");
							ratingItem.className = "custom-rating-item";
							
							const img = document.createElement("img");
							img.src = LOGO.anilist;
							img.alt = "AniList";
							img.className = "custom-rating-logo";
							img.title = `AniList: ${anilistRating.score}`;
							
							const value = document.createElement("span");
							value.className = "custom-rating-value";
							value.textContent = anilistRating.score;
							
							ratingItem.appendChild(img);
							ratingItem.appendChild(value);
							metaDiv.appendChild(ratingItem);
						}
					}

					// Kinopoisk
					if (ratingsData.originalTitle && ratingsData.year) {
						const kpRating = await fetchKinopoiskRating(
							ratingsData.originalTitle,
							parseInt(ratingsData.year, 10),
							type
						);
						if (kpRating && kpRating.score) {
							const ratingItem = document.createElement("div");
							ratingItem.className = "custom-rating-item";
							
							const img = document.createElement("img");
							img.src = LOGO.kinopoisk;
							img.alt = "Kinopoisk";
							img.className = "custom-rating-logo";
							img.title = `Kinopoisk: ${kpRating.score}`;
							
							const value = document.createElement("span");
							value.className = "custom-rating-value";
							value.textContent = kpRating.score;
							
							ratingItem.appendChild(img);
							ratingItem.appendChild(value);
							metaDiv.appendChild(ratingItem);
						}
					}
					
					// Allociné
					if (imdbId) {
						const allocineData = await fetchAllocineRatings(imdbId, type);
						if (allocineData) {
							if (allocineData.press) {
								const ratingItem = document.createElement("div");
								ratingItem.className = "custom-rating-item";

								const img = document.createElement("img");
								img.src = LOGO.allocine_critics;
								img.alt = "Allociné Presse";
								img.className = "custom-rating-logo";
								img.title = `Allociné Presse: ${allocineData.press.toFixed(1)} / 5`;

								const value = document.createElement("span");
								value.className = "custom-rating-value";
								value.textContent = allocineData.press.toFixed(1);

								ratingItem.appendChild(img);
								ratingItem.appendChild(value);
								metaDiv.appendChild(ratingItem);
							}

							if (allocineData.audience) {
								const ratingItem = document.createElement("div");
								ratingItem.className = "custom-rating-item";

								const img = document.createElement("img");
								img.src = LOGO.allocine_audience;
								img.alt = "Allociné Spectateurs";
								img.className = "custom-rating-logo";
								img.title = `Allociné Spectateurs: ${allocineData.audience.toFixed(1)} / 5`;

								const value = document.createElement("span");
								value.className = "custom-rating-value";
								value.textContent = allocineData.audience.toFixed(1);

								ratingItem.appendChild(img);
								ratingItem.appendChild(value);
								metaDiv.appendChild(ratingItem);
							}
						}
					}
					
				});
			}
		} else {
			
			if (item.CriticRating !== null && item.CriticRating !== undefined) {
				const rtRating = document.createElement("div");
				rtRating.className = "meta-rating-item banner-meta-item";
				const isFresh = item.CriticRating >= 60;
				const tomatoImg = isFresh ? 'fresh.png' : 'rotten.png';
				
				rtRating.innerHTML = `
					<img src="modules/mediainfo/${tomatoImg}" class="meta-rating-icon" alt="Rotten Tomatoes">
					<span class="meta-rating-score">${item.CriticRating}%</span>
				`;
				metaDiv.appendChild(rtRating);
			}
			
			if (item.CommunityRating) {
				const imdbRating = document.createElement("div");
				imdbRating.className = "meta-rating-item banner-meta-item";
				imdbRating.innerHTML = `
					<svg class="meta-rating-star" viewBox="0 0 24 24">
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
					</svg>
					<span class="meta-rating-score">${item.CommunityRating.toFixed(1)}</span>
				`;
				metaDiv.appendChild(imdbRating);
			}
		}
		
		if (metaDiv.children.length > 0) {
			infoContainer.appendChild(metaDiv);
		}
		
		return infoContainer.children.length > 0 ? infoContainer : null;
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
        if (!videoId) {
            return createImageBackdrop(item, apiClient);
        }
        
        if (CONFIG.enableSponsorBlock && loadSponsorBlockNow) {
            const segments = await fetchSponsorBlockSegments(videoId);
            if (segments.length > 0) {
                STATE.sponsorBlockSegments[videoId] = segments;
                console.log(`[Spotlight] SponsorBlock geladen fuer ${item.Name}`);
            }
        } else if (CONFIG.enableSponsorBlock) {
            fetchSponsorBlockSegments(videoId).then(segments => {
                if (segments.length > 0) {
                    STATE.sponsorBlockSegments[videoId] = segments;
                    console.log(`[Spotlight] SponsorBlock nachgeladen fuer ${item.Name}`);
                }
            });
        }
    
        const containerId = `yt-player-${item.Id}`;
        const wrapper = document.createElement("div");
        wrapper.className = "video-backdrop-wrapper";
        wrapper.style.position = "relative";
        wrapper.style.width = "100%";
        wrapper.style.height = "100%";
        
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
        
        const playerVars = {
            autoplay: 0,
            mute: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            rel: 0,
            loop: 0,
            modestbranding: 1,
            playsinline: 1,
            suggestedQuality: CONFIG.preferredVideoQuality
        };
        
        setTimeout(() => {
            const player = new YT.Player(containerId, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: playerVars,
                events: {
                    'onReady': (event) => {
                        event.target._videoId = videoId;
                        event.target._itemId = item.Id;
                        event.target._containerId = containerId;
                        event.target.mute();
                        
                        STATE.videoPlayers[item.Id] = event.target;
                        STATE.videoReadyStates[item.Id] = false;
                        
                        console.log(`[Spotlight] YouTube Player ready: ${item.Name}`);
                        
                        const bannerItem = container.closest('.banner-item');
                        const slider = container.closest('.banner-slider');
                        if (slider) {
                            const firstSlide = slider.children[1];
                            if (bannerItem === firstSlide) {
                                console.log('[Spotlight] Erstes Slide, starte Auto-Play...');
                                setTimeout(() => {
                                    playCurrentSlideVideo(item.Id);
                                }, 800);
                            }
                        }
                    },
                    'onStateChange': (event) => {
                        const playerState = event.data;
                        console.log(`[Spotlight] YouTube State Change: ${playerState} für ${item.Name}`);
                        
                        if (playerState === YT.PlayerState.PLAYING) {
                            console.log(`[Spotlight] Video spielt: ${item.Name}`);
                            STATE.isPaused = false;
                            updatePauseButtonIcon();
                            startSponsorBlockMonitoring(event.target, videoId, item.Id);
                            
                            const ytContainer = document.getElementById(containerId);
                            console.log(`[Spotlight] YouTube Container neu gefunden:`, ytContainer);
                            
                            if (!ytContainer) {
                                console.error(`[Spotlight] Container ${containerId} nicht im DOM gefunden!`);
                                return;
                            }
                            
                            const wrapper = ytContainer.closest('.video-backdrop-wrapper');
                            console.log(`[Spotlight] Wrapper gefunden:`, wrapper);
                            
                            let currentPlaceholder = null;
                            if (wrapper) {
                                currentPlaceholder = wrapper.querySelector('.video-placeholder');
                                console.log(`[Spotlight] Placeholder in wrapper gefunden:`, currentPlaceholder);
                            }
                            
                            if (!currentPlaceholder) {
                                console.warn(`[Spotlight] KEIN Placeholder gefunden für ${item.Name}!`);
                                ytContainer.classList.add('video-ready');
                                return;
                            }
                            
                            if (!currentPlaceholder.classList.contains('hidden')) {
                                console.log(`[Spotlight] Blende Placeholder aus für: ${item.Name}`);
                                setTimeout(() => {
                                    ytContainer.classList.add('video-ready');
                                    setTimeout(() => {
                                        currentPlaceholder.classList.add('hidden');
                                        console.log(`[Spotlight] Placeholder ausgeblendet!`);
                                    }, 300);
                                }, 500);
                            } else {
                                console.log(`[Spotlight] Placeholder bereits versteckt`);
                                ytContainer.classList.add('video-ready');
                            }
                        } else if (playerState === YT.PlayerState.PAUSED) {
                            console.log(`[Spotlight] Video pausiert`);
                            STATE.isPaused = true;
                            updatePauseButtonIcon();
                            stopSponsorBlockMonitoring(item.Id);
                        } else if (playerState === YT.PlayerState.ENDED) {
                            console.log(`[Spotlight] YouTube Trailer beendet: ${item.Name}`);
                            STATE.isPaused = false;
                            stopSponsorBlockMonitoring(item.Id);
                            if (CONFIG.waitForTrailerToEnd) {
                                setTimeout(() => {
                                    const rightArrow = document.querySelector('.spotlight .arrow.right');
                                    if (rightArrow) {
                                        console.log('[Spotlight] Auto-Advance nach Trailer-Ende');
                                        rightArrow.click();
                                    }
                                }, 500);
                            }
                        } else if (playerState === YT.PlayerState.BUFFERING) {
                            console.log(`[Spotlight] Video buffert...`);
                        }
                    }
                }
            });
        }, 100);
        
        return wrapper;
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
        
        video.addEventListener('play', () => {
            STATE.isPaused = false;
            updatePauseButtonIcon();
        });
        
        video.addEventListener('pause', () => {
            STATE.isPaused = true;
            updatePauseButtonIcon();
        });
        
        video.addEventListener('ended', () => {
            console.log(`[Spotlight] HTML5 Video beendet: ${item.Name}`);
            if (CONFIG.waitForTrailerToEnd) {
                setTimeout(() => {
                    const rightArrow = document.querySelector('.spotlight .arrow.right');
                    if (rightArrow) {
                        console.log('[Spotlight] Weiter zum naechsten Slide');
                        rightArrow.click();
                    }
                }, 500);
            }
        });
        
        STATE.videoPlayers[item.Id] = video;
        
        return video;
    }
    
    async function createBannerElement(item, apiClient, loadSponsorBlockNow = false) {
        const div = document.createElement("div");
        div.className = "banner-item";
        
        const trailerData = getTrailerUrl(item, apiClient);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        const shouldPlayVideo = CONFIG.enableVideoBackdrop && 
                               trailerData && 
                               trailerData.videoId &&
                               (!isMobile || CONFIG.enableMobileVideo);
        
        let backdropElement;
        
        if (shouldPlayVideo) {
            if (trailerData.isYouTube) {
                backdropElement = await createYouTubeBackdrop(item, trailerData.videoId, apiClient, loadSponsorBlockNow);
            } else {
                backdropElement = createHTML5VideoBackdrop(item, trailerData.url);
            }
        } else {
            backdropElement = createImageBackdrop(item, apiClient);
        }
        
        div.appendChild(backdropElement);
        div.dataset.hasVideo = shouldPlayVideo ? 'true' : 'false';
        
        const gradientLeft = document.createElement("div");
        gradientLeft.className = "banner-gradient-left";
        div.appendChild(gradientLeft);
        
        const gradientRight = document.createElement("div");
        gradientRight.className = "banner-gradient-right";
        div.appendChild(gradientRight);
        
        const vignetteTop = document.createElement("div");
        vignetteTop.className = "banner-vignette-top";
        div.appendChild(vignetteTop);
        
        const vignetteBottom = document.createElement("div");
        vignetteBottom.className = "banner-vignette-bottom";
        div.appendChild(vignetteBottom);
        
        const logoUrl = getLogoUrl(apiClient, item);
        if (logoUrl) {
            const logo = document.createElement("img");
            logo.className = "banner-logo";
            logo.src = logoUrl;
            logo.alt = item.Name + " Logo";
            logo.draggable = false;
            div.appendChild(logo);
        } else {
            const title = document.createElement("div");
            title.className = "banner-title";
            title.textContent = item.Name || "";
            div.appendChild(title);
        }
        
        if (item.Overview) {
            const overviewContainer = document.createElement("div");
            overviewContainer.className = "banner-overview";
            
            const overviewText = document.createElement("div");
            overviewText.className = "banner-overview-text";
            overviewText.textContent = item.Overview;
            
            overviewContainer.appendChild(overviewText);
            div.appendChild(overviewContainer);
        }
        
        const info = await createInfoElement(item);
        if (info) {
            div.appendChild(info);
        }
        
        div.dataset.itemId = item.Id;
        if (item.ServerId) {
            div.dataset.serverId = item.ServerId;
        }
        
        return div;
    }
    
    async function buildSlider(items, apiClient) {
        const container = document.createElement("div");
        container.className = "spotlight-container";
        container.id = SPOTLIGHT_CONTAINER_ID;
        
        const spotlight = document.createElement("div");
        spotlight.className = "spotlight";
        
        const loader = document.createElement("div");
        loader.className = "loader";
        loader.innerHTML = "<span>Loading…</span>";
        spotlight.appendChild(loader);
        
        const sliderWrapper = document.createElement("div");
        sliderWrapper.className = "banner-slider-wrapper";
        
        const slider = document.createElement("div");
        slider.className = "banner-slider";
        
        for (let index = 0; index < items.length; index++) {
            const it = items[index];
            const isFirstItem = index === 0;
            const el = await createBannerElement(it, apiClient, isFirstItem);
            slider.appendChild(el);
        }
        
        if (items.length > 1) {
            const originalFirst = slider.children[0];
            const originalLast = slider.children[slider.children.length - 1];
            
            const first = originalFirst.cloneNode(true);
            const last = originalLast.cloneNode(true);
            
            const firstYT = first.querySelector('.youtube-backdrop');
            if (firstYT && firstYT.id) {
                const newId = firstYT.id + '-clone-end';
                firstYT.id = newId;
                firstYT.dataset.isClone = 'true';
                console.log(`[Spotlight] Clone erstellt: ${newId}`);
            }
            
            const lastYT = last.querySelector('.youtube-backdrop');
            if (lastYT && lastYT.id) {
                const newId = lastYT.id + '-clone-start';
                lastYT.id = newId;
                lastYT.dataset.isClone = 'true';
                console.log(`[Spotlight] Clone erstellt: ${newId}`);
            }
            
            slider.appendChild(first);
            slider.insertBefore(last, slider.children[0]);
            
            console.log(`[Spotlight] Klone erstellt. Slider hat jetzt ${slider.children.length} Slides`);
        } else if (items.length === 1) {
            console.warn("[Spotlight] Nur 1 Item - Infinite Scroll deaktiviert");
        }
        
        sliderWrapper.appendChild(slider);
        spotlight.appendChild(sliderWrapper);
        
        const btnLeft = document.createElement("button");
        btnLeft.className = "arrow left";
        btnLeft.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>`;
        btnLeft.setAttribute("aria-label", "Previous");
        
        const btnRight = document.createElement("button");
        btnRight.className = "arrow right";
        btnRight.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>`;
        btnRight.setAttribute("aria-label", "Next");
        
        spotlight.appendChild(btnLeft);
        spotlight.appendChild(btnRight);
        
        const playButtonOverlay = document.createElement("div");
        playButtonOverlay.className = "play-button-overlay";
        const playButton = document.createElement("button");
        playButton.className = "play-button";
        playButton.setAttribute("aria-label", "Play");
        playButton.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
            </svg>
        `;
        playButtonOverlay.appendChild(playButton);
        spotlight.appendChild(playButtonOverlay);
        
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
        
        const controls = document.createElement("div");
        controls.className = "controls";
        
        const count = items.length;
        for (let i = 0; i < count; i++) {
            const c = document.createElement("button");
            c.className = "control";
            if (i === 0) c.classList.add("active");
            c.dataset.index = i + 1;
            c.setAttribute("aria-label", `Slide ${i + 1}`);
            controls.appendChild(c);
        }
        
        spotlight.appendChild(controls);
        container.appendChild(spotlight);
        
        return { 
            container, 
            spotlight, 
            slider, 
            btnLeft, 
            btnRight, 
            controls, 
            sliderWrapper, 
            playButtonOverlay,
            pauseButton,
            muteButton,
            refreshButton
        };
    }
    
    function playItem(itemId, serverId, apiClient) {
        console.log("[Spotlight] Starte Wiedergabe fuer Item:", itemId);
        
        let serverIdToUse = serverId;
        
        if (!serverIdToUse && apiClient) {
            if (apiClient.serverId) {
                serverIdToUse = apiClient.serverId;
            } else if (apiClient.serverInfo && apiClient.serverInfo.Id) {
                serverIdToUse = apiClient.serverInfo.Id;
            } else if (apiClient._serverInfo && apiClient._serverInfo.Id) {
                serverIdToUse = apiClient._serverInfo.Id;
            }
        }
        
        if (window.require) {
            try {
                window.require(['playbackManager'], function(playbackManager) {
                    if (playbackManager && typeof playbackManager.play === 'function') {
                        console.log("[Spotlight] Verwende playbackManager");
                        playbackManager.play({
                            ids: [itemId],
                            serverId: serverIdToUse
                        });
                        return;
                    }
                });
                return;
            } catch (e) {
                console.warn("[Spotlight] playbackManager nicht verfuegbar", e);
            }
        }
        
        if (window.appRouter && typeof window.appRouter.showItem === "function") {
            console.log("[Spotlight] Verwende appRouter mit Autoplay");
            window.appRouter.showItem(itemId, serverIdToUse);
            setTimeout(() => {
                const playButton = document.querySelector('.btnPlay');
                if (playButton) playButton.click();
            }, 500);
        }
    }
    
    function navigateToItem(itemId, serverId, apiClient) {
        console.log("[Spotlight] Navigiere zu Item Details:", itemId, "ServerId:", serverId);
        
        let serverIdToUse = serverId;
        
        if (!serverIdToUse && apiClient) {
            if (apiClient.serverId) {
                serverIdToUse = apiClient.serverId;
            } else if (apiClient.serverInfo && apiClient.serverInfo.Id) {
                serverIdToUse = apiClient.serverInfo.Id;
            } else if (apiClient._serverInfo && apiClient._serverInfo.Id) {
                serverIdToUse = apiClient._serverInfo.Id;
            }
        }
        
        if (window.appRouter && typeof window.appRouter.showItem === "function") {
            console.log("[Spotlight] Verwende appRouter.showItem");
            window.appRouter.showItem(itemId, serverIdToUse);
            return;
        }
        
        if (window.Dashboard && typeof window.Dashboard.navigate === "function") {
            const url = serverIdToUse 
                ? `item?id=${itemId}&serverId=${serverIdToUse}` 
                : `item?id=${itemId}`;
            console.log("[Spotlight] Verwende Dashboard.navigate:", url);
            window.Dashboard.navigate(url);
            return;
        }
        
        if (typeof require === "function") {
            try {
                require(['appRouter'], function(appRouter) {
                    if (appRouter && typeof appRouter.showItem === "function") {
                        console.log("[Spotlight] Verwende require appRouter.showItem");
                        appRouter.showItem(itemId, serverIdToUse);
                    }
                });
                return;
            } catch (e) {
                console.warn("[Spotlight] require appRouter failed", e);
            }
        }
        
        const url = serverIdToUse 
            ? `#!/item?id=${itemId}&serverId=${serverIdToUse}` 
            : `#!/item?id=${itemId}`;
        console.log("[Spotlight] Fallback: Hash-Navigation:", url);
        window.location.hash = url;
        
        setTimeout(() => {
            if (window.location.hash.includes(itemId)) {
                window.location.reload();
            }
        }, 100);
    }

    function logYouTubeURL(videoId, itemName) {
        if (videoId) {
            const youtubeURL = `https://www.youtube.com/watch?v=${videoId}`;
            console.log(`%c[Spotlight] Current Trailer:`, 'color: #00ff00; font-weight: bold');
            console.log(`%c[Spotlight] Item: ${itemName || 'Unbekannt'}`, 'color: #00aaff');
            console.log(`%c[Spotlight] URL: ${youtubeURL}`, 'color: #ffaa00; font-weight: bold');
            console.log(`%c[Spotlight] Video-ID: ${videoId}`, 'color: #ff00ff');
            console.log('─'.repeat(80));
        }
    }
    
    function playCurrentSlideVideo(itemId) {
        let player = STATE.videoPlayers[itemId];
        
        if (!player && STATE.currentSlider) {
            console.warn(`[Spotlight] Player nicht im STATE gefunden: ${itemId}, suche im DOM...`);
            
            const currentSlide = STATE.currentSlider.children[STATE.currentSlideIndex];
            const youtubeContainer = currentSlide?.querySelector('.youtube-backdrop[data-item-id="' + itemId + '"]');
            
            if (youtubeContainer) {
                const playerId = youtubeContainer.id;
                
                player = STATE.videoPlayers[playerId];
                
                if (!player && window.YT && window.YT.get) {
                    player = window.YT.get(playerId);
                    if (player) {
                        console.log(`[Spotlight] Clone-Player gefunden: ${playerId}`);
                        STATE.videoPlayers[playerId] = player;
                    }
                }
            }
            
            const videoElement = currentSlide?.querySelector(`video.video-backdrop[data-item-id="${itemId}"]`);
            if (videoElement) {
                console.log(`[Spotlight] HTML5 Video im DOM gefunden: ${itemId}`);
                player = videoElement;
                STATE.videoPlayers[itemId] = player;
            }
            
            if (!player) {
                console.error(`[Spotlight] Kein Player gefunden fuer ${itemId}`);
                return;
            }
        }
        
        if (player.playVideo && typeof player.playVideo === 'function') {
            console.log(`[Spotlight] Starte YouTube Video: ${itemId}`);
            
            const currentSlide = STATE.currentSlider?.children[STATE.currentSlideIndex];
            const itemName = currentSlide?.querySelector('.banner-title')?.textContent || 
                             currentSlide?.querySelector('.banner-logo')?.alt || 
                             'Unbekannt';
            const videoId = player._videoId;
            logYouTubeURL(videoId, itemName);
            
            if (STATE.isMuted) {
                player.mute();
            } else {
                player.unMute();
                player.setVolume(CONFIG.videoVolume * 100);
            }
            
            player.playVideo();
            STATE.isPaused = false;
            updatePauseButtonIcon();
        }
        else if (player.play && typeof player.play === 'function') {
            console.log(`[Spotlight] Starte HTML5 Video: ${itemId}`);
            
            player.currentTime = 0;
            player.muted = STATE.isMuted;
            
            if (!STATE.isMuted) {
                player.volume = CONFIG.videoVolume;
            }
            
            player.play().catch(e => {
                console.warn('[Spotlight] Autoplay blocked, fallback to muted');
                player.muted = true;
                STATE.isMuted = true;
                updateMuteButtonIcon();
                player.play();
            });
            STATE.isPaused = false;
            updatePauseButtonIcon();
        }
    }
    
    function pauseAllVideos() {
        Object.entries(STATE.videoPlayers).forEach(([itemId, player]) => {
            if (player.pauseVideo && typeof player.pauseVideo === 'function') {
                player.pauseVideo();
                stopSponsorBlockMonitoring(itemId);
            } else if (player.pause && typeof player.pause === 'function') {
                player.pause();
            }
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
            if (player.mute && typeof player.mute === 'function') {
                if (STATE.isMuted) {
                    player.mute();
                } else {
                    player.unMute();
                    player.setVolume(CONFIG.videoVolume * 100);
                }
            } else if (player.muted !== undefined) {
                player.muted = STATE.isMuted;
                if (!STATE.isMuted) {
                    player.volume = CONFIG.videoVolume;
                }
            }
        });
    }
    
    function initializeYouTubePlayers(slider) {
        const pendingPlayers = slider.querySelectorAll('.youtube-backdrop[data-video-id]');
        
        pendingPlayers.forEach(container => {
            const itemId = container.dataset.itemId;
            const videoId = container.dataset.videoId;
            const playerId = container.id;
            const isClone = container.dataset.isClone === 'true';
            
            if (!videoId || !playerId) {
                return;
            }
            
            if (!isClone && STATE.videoPlayers[itemId]) {
                return; 
            }
            
            console.log(`[Spotlight] Creating YouTube Player for ${playerId} (Clone: ${isClone})`);
            
            const placeholder = container.parentElement?.querySelector('.video-placeholder');
            
            const playerVars = {
                autoplay: 0,
                mute: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                iv_load_policy: 3,
                rel: 0,
                loop: 0,
                modestbranding: 1,
                playsinline: 1,
                suggestedQuality: CONFIG.preferredVideoQuality
            };
            
            const player = new YT.Player(playerId, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: playerVars,
                events: {
                    'onReady': (event) => {
                        event.target._videoId = videoId;
                        event.target._itemId = itemId;
                        event.target._playerId = playerId;
                        event.target.mute();
                        
                        if (isClone) {
                            STATE.videoPlayers[playerId] = event.target;
                        } else {
                            STATE.videoPlayers[itemId] = event.target;
                        }
                        
                        STATE.videoReadyStates[itemId] = false;
                        
                        console.log(`[Spotlight] YouTube Player ready: ${playerId}`);
                        
                        const bannerItem = container.closest('.banner-item');
                        const slider = container.closest('.banner-slider');
                        if (slider) {
                            const firstSlide = slider.children[1];
                            if (bannerItem === firstSlide) {
                                setTimeout(() => {
                                    playCurrentSlideVideo(itemId);
                                }, 500);
                            }
                        }
                    },
                    'onStateChange': (event) => {
                        const playerState = event.data;
                        
                        if (playerState === YT.PlayerState.PLAYING) {
                            console.log(`[Spotlight] Video spielt: ${itemId}`);
                            STATE.isPaused = false;
                            updatePauseButtonIcon();
                            startSponsorBlockMonitoring(event.target, videoId, itemId);
                            
                            const ytContainer = document.getElementById(playerId);
                            console.log(`[Spotlight] YouTube Container neu gefunden:`, ytContainer);
                            
                            if (!ytContainer) {
                                console.error(`[Spotlight] Container ${playerId} nicht im DOM gefunden!`);
                                return;
                            }
                            
                            const wrapper = ytContainer.closest('.video-backdrop-wrapper');
                            console.log(`[Spotlight] Wrapper gefunden:`, wrapper);
                            
                            let currentPlaceholder = null;
                            if (wrapper) {
                                currentPlaceholder = wrapper.querySelector('.video-placeholder');
                                console.log(`[Spotlight] Placeholder in wrapper gefunden:`, currentPlaceholder);
                            }
                            
                            if (!currentPlaceholder) {
                                console.warn(`[Spotlight] KEIN Placeholder gefunden für ${itemId}!`);
                                ytContainer.classList.add('video-ready');
                                return;
                            }
                            
                            if (!currentPlaceholder.classList.contains('hidden')) {
                                console.log(`[Spotlight] Blende Placeholder aus für: ${itemId}`);
                                setTimeout(() => {
                                    ytContainer.classList.add('video-ready');
                                    setTimeout(() => {
                                        currentPlaceholder.classList.add('hidden');
                                        console.log(`[Spotlight] Placeholder ausgeblendet!`);
                                    }, 300);
                                }, 500);
                            } else {
                                console.log(`[Spotlight] Placeholder bereits versteckt`);
                                ytContainer.classList.add('video-ready');
                            }
                        } 
                        else if (playerState === YT.PlayerState.BUFFERING) {
                            console.log(`[Spotlight] Video buffert: ${itemId}`);
                        }
                        else if (playerState === YT.PlayerState.ENDED) {
                            console.log(`[Spotlight] Video beendet: ${itemId}`);
                            stopSponsorBlockMonitoring(itemId);
                            
                            const ytContainer = document.getElementById(playerId);
                            const wrapper = ytContainer?.closest('.video-backdrop-wrapper');
                            const currentPlaceholder = wrapper?.querySelector('.video-placeholder');
                            
                            if (currentPlaceholder) {
                                currentPlaceholder.classList.remove('hidden');
                            }
                            if (ytContainer) {
                                ytContainer.classList.remove('video-ready');
                            }
                            
                            if (CONFIG.waitForTrailerToEnd) {
                                setTimeout(() => {
                                    const rightArrow = document.querySelector('.spotlight .arrow.right');
                                    if (rightArrow) {
                                        console.log('[Spotlight] Auto-Advance nach Video-Ende');
                                        rightArrow.click();
                                    }
                                }, 500);
                            }
                        } 
                        else if (playerState === YT.PlayerState.PAUSED) {
                            console.log(`[Spotlight] Video pausiert: ${itemId}`);
                            STATE.isPaused = true;
                            updatePauseButtonIcon();
                            stopSponsorBlockMonitoring(itemId);
                        }
                    }
                }
            });
        });
    }
    
    function ensurePlayerForCurrentSlide(currentIndex, slider) {
        const currentSlide = slider.children[currentIndex];
        if (!currentSlide) return null;
        
        const itemId = currentSlide.dataset.itemId;
        const hasVideo = currentSlide.dataset.hasVideo === 'true';
        
        if (!hasVideo || !itemId) return null;
        
        if (STATE.videoPlayers[itemId]) {
            return STATE.videoPlayers[itemId];
        }
        
        console.log(`[Spotlight] Re-initialisiere Player fuer geklontes Slide: ${itemId}`);
        
        const youtubeContainer = currentSlide.querySelector(`.youtube-backdrop[data-item-id="${itemId}"]`);
        if (youtubeContainer) {
            const playerId = youtubeContainer.id;
            
            if (window.YT && window.YT.get) {
                const player = window.YT.get(playerId);
                
                if (player) {
                    STATE.videoPlayers[playerId] = player;
                    console.log(`[Spotlight] Player fuer Clone gefunden: ${playerId}`);
                    return player;
                }
            }
        }
        
        return null;
    }
    
    async function refreshSlideshow(apiClient, oldContainer) {
        console.log("[Spotlight] Refreshing slideshow...");
        
        const refreshButton = document.querySelector('.spotlight .refresh-button');
        if (refreshButton) {
            refreshButton.classList.add('refreshing');
        }
        
        pauseAllVideos();
        
        Object.keys(STATE.skipIntervals).forEach(itemId => {
            stopSponsorBlockMonitoring(itemId);
        });
        
        Object.values(STATE.videoPlayers).forEach(player => {
            if (player.destroy && typeof player.destroy === 'function') {
                player.destroy();
            }
        });
        STATE.videoPlayers = {};
        STATE.sponsorBlockSegments = {};
        STATE.ratingsCache = {};
        STATE.videoReadyStates = {};
        STATE.currentSlider = null;
        
        if (oldContainer) {
            oldContainer.remove();
        }
        
        try {
            sessionStorage.removeItem('spotlight-current-index');
        } catch (e) {}
        
        STATE.isInitializing = false;
        
        await init();
    }
    
    function attachSliderBehavior(state, apiClient) {
        const { slider, itemsCount, btnLeft, btnRight, controls, spotlight, pauseButton, muteButton, refreshButton } = state;
        let currentIndex = 1;
        
        STATE.currentSlider = slider;
        
        function saveCurrentIndex() {
            try {
                sessionStorage.setItem('spotlight-current-index', currentIndex.toString());
            } catch (e) { }
        }
        
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
            const sliderWrapper = spotlight.querySelector('.banner-slider-wrapper');
            const width = sliderWrapper.getBoundingClientRect().width;
            const x = Math.round(-(index * width));
            
            if (!animate) {
                slider.style.transition = "none";
            } else {
                slider.style.transition = "transform .5s ease";
            }
            
            slider.style.transform = `translate3d(${x}px, 0, 0)`;
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
            if (visibleItem && visibleItem.dataset.hasVideo === 'true') {
                muteButton.classList.add('visible');
                pauseButton.classList.add('visible');
            } else {
                muteButton.classList.remove('visible');
                pauseButton.classList.remove('visible');
            }
        }
        
        const resizeHandler = () => {
            updateTransform(currentIndex, false);
            void slider.offsetHeight;
        };
        window.addEventListener("resize", resizeHandler);
        
        setTimeout(() => {
            if (STATE.youtubeAPIReady) {
                initializeYouTubePlayers(slider);
            }
        }, 800);
        
        setTimeout(() => {
            updateTransform(currentIndex, false);
            setActiveDot(currentIndex);
            triggerZoomAnimation();
            updateVideoButtonsVisibility();
            STATE.currentSlideIndex = currentIndex;
            
            const firstItem = slider.children[currentIndex];
            if (firstItem && firstItem.dataset.hasVideo === 'true') {
                const itemId = firstItem.dataset.itemId;
                if (itemId) {
                    const tryPlay = (attempts = 0) => {
                        const player = STATE.videoPlayers[itemId];
                        
                        if (!player && attempts < 40) {
                            console.log(`[Spotlight] Warte auf Player... ${attempts + 1}/40`);
                            setTimeout(() => tryPlay(attempts + 1), 300);
                            return;
                        }
                        
                        if (player && typeof player.getPlayerState === 'function') {
                            const state = player.getPlayerState();
                            
                            if (state === YT.PlayerState.UNSTARTED || state === YT.PlayerState.CUED) {
                                console.log('[Spotlight] Player vollständig bereit, starte erstes Video');
                                
                                setTimeout(() => {
                                    playCurrentSlideVideo(itemId);
                                }, 800);
                            } else if (state === -1 && attempts < 40) {
                                setTimeout(() => tryPlay(attempts + 1), 300);
                            } else if (state !== -1) {
                                playCurrentSlideVideo(itemId);
                            }
                        } else if (player && player.tagName === 'VIDEO') {
                            playCurrentSlideVideo(itemId);
                        }
                    };
                    
                    setTimeout(() => tryPlay(), 2000);
                }
            }
        }, 100);
        
        btnRight.addEventListener("click", (e) => {
            e.stopPropagation();
            console.log(`[Spotlight] Arrow Right: ${currentIndex} -> ${currentIndex + 1}`);
            currentIndex++;
            animate();
        });
        
        btnLeft.addEventListener("click", (e) => {
            e.stopPropagation();
            console.log(`[Spotlight] Arrow Left: ${currentIndex} -> ${currentIndex - 1}`);
            currentIndex--;
            animate();
        });
        
        controls.addEventListener("click", (e) => {
            e.stopPropagation();
            if (e.target.classList.contains("control")) {
                const idx = parseInt(e.target.dataset.index, 10);
                currentIndex = idx;
                updateTransform(currentIndex, true);
                setActiveDot(currentIndex);
                saveCurrentIndex();
                setTimeout(() => {
                    triggerZoomAnimation();
                    handleVideoPlayback();
                }, 100);
            }
        });
        
        function handleVideoPlayback() {
            STATE.isPaused = false;
            updatePauseButtonIcon();
            
            pauseAllVideos();
            updateVideoButtonsVisibility();
            STATE.currentSlideIndex = currentIndex;
            
            const visibleItem = slider.children[currentIndex];
            const hasVideo = visibleItem && visibleItem.dataset.hasVideo === 'true';
            
            console.log(`[Spotlight] handleVideoPlayback - Index: ${currentIndex}, hasVideo: ${hasVideo}`);
            
            if (CONFIG.waitForTrailerToEnd && hasVideo) {
                console.log('[Spotlight] Video-Slide aktiv, stoppe Autoplay');
                stopAutoplay();
            } else {
                console.log('[Spotlight] Bild-Slide aktiv, starte Autoplay');
                startAutoplay();
            }
            
            ensurePlayerForCurrentSlide(currentIndex, slider);
            
            if (hasVideo) {
                const itemId = visibleItem.dataset.itemId;
                if (itemId) {
                    setTimeout(() => playCurrentSlideVideo(itemId), 300);
                }
            }
        }
        
        function animate() {
            pauseAllVideos();
            
            updateTransform(currentIndex, true);
            setActiveDot(currentIndex);
            saveCurrentIndex();
            setTimeout(() => triggerZoomAnimation(), 100);
            
            setTimeout(() => {
                if (itemsCount < 2) {
                    console.warn("[Spotlight] Zu wenige Items fuer Loop");
                    handleVideoPlayback();
                    return;
                }
                
                if (currentIndex === 0) {
                    console.log(`[Spotlight] Loop: Index 0 -> ${itemsCount}`);
                    currentIndex = itemsCount;
                    updateTransform(currentIndex, false);
                    setActiveDot(currentIndex);
                    saveCurrentIndex();
                    setTimeout(() => triggerZoomAnimation(), 100);
                } else if (currentIndex === itemsCount + 1) {
                    console.log(`[Spotlight] Loop: Index ${itemsCount + 1} -> 1`);
                    currentIndex = 1;
                    updateTransform(currentIndex, false);
                    setActiveDot(currentIndex);
                    saveCurrentIndex();
                    setTimeout(() => triggerZoomAnimation(), 100);
                }
                
                STATE.currentSlideIndex = currentIndex;
                handleVideoPlayback();
            }, 520);
        }
        
        spotlight.addEventListener("click", (e) => {
            if (e.target.closest('.arrow') || 
                e.target.closest('.controls') || 
                e.target.closest('.play-button-overlay') || 
                e.target.closest('.pause-button') ||
                e.target.closest('.mute-button') ||
                e.target.closest('.refresh-button')) {
                return;
            }
            
            const visibleItem = slider.children[currentIndex];
            if (visibleItem && visibleItem.dataset?.itemId) {
                const itemId = visibleItem.dataset.itemId;
                const serverId = visibleItem.dataset.serverId;
                
                console.log("[Spotlight] Container geklickt, oeffne Item Details");
                
                e.stopPropagation();
                e.preventDefault();
                
                navigateToItem(itemId, serverId, apiClient);
            }
        });
        
        const playButtonOverlay = spotlight.querySelector('.play-button-overlay');
        if (playButtonOverlay) {
            playButtonOverlay.addEventListener("click", (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const visibleItem = slider.children[currentIndex];
                if (visibleItem && visibleItem.dataset?.itemId) {
                    const itemId = visibleItem.dataset.itemId;
                    const serverId = visibleItem.dataset.serverId;
                    playItem(itemId, serverId, apiClient);
                }
            });
        }
        
        if (pauseButton) {
            pauseButton.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const visibleItem = slider.children[currentIndex];
                if (!visibleItem || visibleItem.dataset.hasVideo !== 'true') {
                    return;
                }
                
                const itemId = visibleItem.dataset.itemId;
                if (!itemId) return;
                
                const player = STATE.videoPlayers[itemId];
                if (!player) {
                    console.warn("[Spotlight] Kein Player fuer Pause/Play");
                    return;
                }
                
                const wantsToPause = !STATE.isPaused;
                
                console.log("[Spotlight] Gewuenschte Aktion:", wantsToPause ? "PAUSIEREN" : "ABSPIELEN");
                
                if (player.getPlayerState && typeof player.getPlayerState === 'function') {
                    const playerState = player.getPlayerState();
                    console.log("[Spotlight] YouTube Player State:", playerState);
                    
                    if (wantsToPause) {
                        console.log("[Spotlight] Pausiere YouTube Video");
                        player.pauseVideo();
                        STATE.isPaused = true;
                        stopSponsorBlockMonitoring(itemId);
                    } else {
                        console.log("[Spotlight] Starte YouTube Video");
                        player.playVideo();
                        STATE.isPaused = false;
                    }
                    
                    updatePauseButtonIcon();
                }
                else if (player.tagName === 'VIDEO') {
                    if (wantsToPause) {
                        console.log("[Spotlight] Pausiere HTML5 Video");
                        player.pause();
                        STATE.isPaused = true;
                    } else {
                        console.log("[Spotlight] Starte HTML5 Video");
                        player.play();
                        STATE.isPaused = false;
                    }
                    
                    updatePauseButtonIcon();
                }
            });
        }
        
        if (muteButton) {
            muteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleMute();
            });
        }
        
        if (refreshButton) {
            refreshButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log("[Spotlight] Refresh Button geklickt");
                
                const container = document.getElementById(SPOTLIGHT_CONTAINER_ID);
                await refreshSlideshow(apiClient, container);
            });
        }
        
        let autoplayTimer = null;
        
        function startAutoplay() {
            if (autoplayTimer) clearInterval(autoplayTimer);
            
            const currentItem = slider.children[currentIndex];
            const hasVideo = currentItem && currentItem.dataset.hasVideo === 'true';
            
            if (CONFIG.waitForTrailerToEnd && hasVideo) {
                console.log('[Spotlight] Trailer aktiv, Autoplay pausiert (wartet auf Video-Ende)');
                return;
            }
            
            autoplayTimer = setInterval(() => {
                console.log('[Spotlight] Autoplay: Naechster Slide');
                currentIndex++;
                animate();
            }, CONFIG.autoplayInterval);
        }
        
        function stopAutoplay() {
            if (autoplayTimer) clearInterval(autoplayTimer);
            autoplayTimer = null;
        }
        
        spotlight.addEventListener("mouseenter", stopAutoplay);
        spotlight.addEventListener("mouseleave", startAutoplay);
        startAutoplay();
        
        state.cleanup = () => {
            window.removeEventListener("resize", resizeHandler);
            stopAutoplay();
        };
    }
    
    async function init() {
        try {
            if (document.getElementById(SPOTLIGHT_CONTAINER_ID)) {
                console.warn("[Spotlight] Container bereits vorhanden");
                return;
            }
            
            if (STATE.isInitializing) {
                console.warn("[Spotlight] Initialisierung laeuft bereits");
                return;
            }
            
            STATE.isInitializing = true;
            
            insertStyles();
            
            const home = findHomeContainer();
            if (!home) {
                STATE.isInitializing = false;
                return;
            }
            
            const [connectionManager, ApiClient] = await safeRequire(["connectionManager", "ApiClient"]);
            
            let apiClient = null;
            try {
                if (connectionManager && connectionManager[0] && connectionManager[0].currentApiClient) {
                    apiClient = connectionManager[0].currentApiClient();
                }
            } catch (e) { }
            
            if (!apiClient) {
                try {
                    if (ApiClient && ApiClient[0] && ApiClient[0].serverAddress) {
                        apiClient = ApiClient[0];
                    }
                } catch (e) { }
            }
            
            if (!apiClient && window.ApiClient) apiClient = window.ApiClient;
            
            if (!apiClient) {
                STATE.isInitializing = false;
                return;
            }
            
            const items = await fetchItems(apiClient);
            if (!items || items.length === 0) {
                console.warn("[Spotlight] Keine Items erhalten");
                STATE.isInitializing = false;
                return;
            }
            
            console.log(`[Spotlight] Items geladen: ${items.length}`);
            console.log("[Spotlight] CONFIG.limit:", CONFIG.limit);
            
            const { container, spotlight, slider, btnLeft, btnRight, controls, pauseButton, muteButton, refreshButton } = await buildSlider(items, apiClient);
            
            console.log("[Spotlight] Slider Children (inkl. Klone):", slider.children.length);
            console.log("[Spotlight] Item Count fuer Behavior:", items.length);
            
            const reference = home.querySelector ? home.querySelector(".homeSectionsContainer") : null;
            if (reference && reference.parentNode) {
                reference.parentNode.insertBefore(container, reference);
            } else {
                home.insertBefore(container, home.firstChild);
            }
            
            const loader = container.querySelector(".loader");
            if (loader) loader.style.display = "none";
            
            attachSliderBehavior({ slider, itemsCount: items.length, btnLeft, btnRight, controls, spotlight, pauseButton, muteButton, refreshButton }, apiClient);
            
            console.log(`[Spotlight] Initialisiert mit ${items.length} Items`);
        } catch (err) {
            console.error("[Spotlight] Init error", err);
            STATE.isInitializing = false;
        } finally {
            STATE.isInitializing = false;
        }
    }
    
    function observeViewAndInit() {
        let initialized = false;
        
        const observer = new MutationObserver((mutations) => {
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
                    
                    if (player.stopVideo && typeof player.stopVideo === 'function') {
                        player.stopVideo();
                    } else if (player.pauseVideo && typeof player.pauseVideo === 'function') {
                        player.pauseVideo();
                    }
                    
                    if (player.destroy && typeof player.destroy === 'function') {
                        player.destroy();
                    } else if (player.tagName === 'VIDEO') {
                        player.pause();
                        player.src = '';
                        player.load();
                    }
                });
                
                STATE.videoPlayers = {};
                STATE.sponsorBlockSegments = {};
                STATE.ratingsCache = {};
                STATE.videoReadyStates = {};
                STATE.currentSlider = null;
                
                const oldSlider = document.getElementById(SPOTLIGHT_CONTAINER_ID);
                if (oldSlider) {
                    oldSlider.remove();
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
            if (!initialized && !STATE.isInitializing) {
                const hv = !!document.querySelector(".view:not(.hide) .homeSectionsContainer, .view:not(.hide) [data-view='home']");
                if (hv) init();
            }
        }, 500);
    }
    
    observeViewAndInit();
})();