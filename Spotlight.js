/*!
 * Spotlight.js — Emby 4.9 compatible Spotlight slider with Video Backdrop Support & Custom Ratings
 * Enhanced with: YouTube Trailers, HTML5 Video, SponsorBlock, Custom Ratings (IMDb, RT, Metacritic, etc.) - Big thanks to https://github.com/Druidblack/jellyfin_ratings/tree/main
 * Generated: 2026-02-07
 */
if (typeof GM_xmlhttpRequest === 'undefined') {
    const PROXIES = [
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest='
    ];
    const DIRECT_DOMAINS = [
        'api.mdblist.com',
        'graphql.anilist.co',
        'query.wikidata.org',
        'www.google.com',
        'api.themoviedb.org'
    ];
    
    window.GM_xmlhttpRequest = function({ method = 'GET', url, headers = {}, data, onload, onerror }) {
        const isDirect = DIRECT_DOMAINS.some(d => url.includes(d));
        let fetchUrl;
        
        if (isDirect) {
            fetchUrl = url;
        } else {
            const proxy = PROXIES[Math.floor(Math.random() * PROXIES.length)];
            const sep = url.includes('?') ? '&' : '?';
            const bump = `_=${Date.now()}`;
            fetchUrl = proxy + encodeURIComponent(url + sep + bump);
        }
        
        fetch(fetchUrl, {
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
        playbuttonColor: "var(--theme-primary-color)",
        customItemsFile: "spotlight-items.txt",
        
        enableVideoBackdrop: true,
        startMuted: false,
        videoVolume: 0.4,
        waitForTrailerToEnd: true,
        enableMobileVideo: false,
        preferredVideoQuality: "hd1080",
        
        enableSponsorBlock: true,
        sponsorBlockCategories: ["sponsor", "intro", "outro", "selfpromo", "interaction", "preview"],
        
        // Custom Ratings Config
        enableCustomRatings: true,
        MDBLIST_API_KEY: 'YOUR_API_KEY',
        TMDB_API_KEY: 'YOUR_API_KEY'
    };
    
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
        anilist: 'https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo/anilist.png'
    };
	
	// ══════════════════════════════════════════════════════════════════
    // MANUELLE OVERRIDES: TMDb-IDs für erzwungene Badges
    // Füge hier TMDb-IDs hinzu, die das jeweilige Badge erhalten sollen,
    // auch wenn die Score/Votes-Schwellenwerte nicht erreicht werden.
    // ══════════════════════════════════════════════════════════════════
    const CERTIFIED_FRESH_OVERRIDES = [
        // '550',      // Fight Club
        // '680',      // Pulp Fiction
        // '13',       // Forrest Gump
    ];
    
    const VERIFIED_HOT_OVERRIDES = [
// Movies with a score <90, but RT verified hot nonetheless
'812583', // Wake Up Dead Man A Knives Out Mystery
'1272837', // 28 Years Later: The Bone Temple
'1054867', // One Battle After Another
'1088166', // Relay
'1007734', // Nobody 2
'1078605', // Weapons
'1100988', // 28 Years Later
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
    
	function fetchMDBListRatings(type, tmdbId, item) {
        return new Promise((resolve) => {
            if (!CONFIG.enableCustomRatings || !tmdbId) {
                resolve(null);
                return;
            }
            
            const cacheKey = `mdb_${type}_${tmdbId}`;
            if (STATE.ratingsCache[cacheKey]) {
                resolve(STATE.ratingsCache[cacheKey]);
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
                    
                    // Check manual overrides for this tmdbId
                    const isCertifiedFreshOverride = CERTIFIED_FRESH_OVERRIDES.includes(String(tmdbId));
                    const isVerifiedHotOverride    = VERIFIED_HOT_OVERRIDES.includes(String(tmdbId));
                    
                    // ── First pass: collect all scores & votes for special logo decisions ──
                    let metacriticScore = null;
                    let metacriticVotes = null;
                    let tomatoesScore   = null;
                    let tomatoesVotes   = null;
                    let audienceScore   = null;
                    let audienceVotes   = null;
                    
                    if (Array.isArray(data.ratings)) {
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
                            }
                            else if (key.includes('popcorn') || key.includes('audience')) {
                                audienceScore = r.value;
                                audienceVotes = r.votes;
                            }
                        });
                        
                        // ── Second pass: process all ratings with correct logos ──
                        data.ratings.forEach(r => {
                            if (r.value == null) return;
                            
                            let key = r.source.toLowerCase().replace(/\s+/g, '_');
                            
                            // ── Rotten Tomatoes Critics ──
                            if (key === 'tomatoes') {
                                if (r.value < 60) {
                                    key = 'tomatoes_rotten';
                                } else if (isCertifiedFreshOverride || (tomatoesScore >= 75 && tomatoesVotes >= 80)) {
                                    // Certified Fresh: manual override OR score >= 75 AND votes >= 80
                                    key = 'tomatoes_certified';
                                } else {
                                    key = 'tomatoes';
                                }
                            }
                            // ── Rotten Tomatoes Audience ──
                            else if (key.includes('popcorn')) {
                                if (r.value < 60) {
                                    key = 'audience_rotten';
                                } else if (isVerifiedHotOverride || (audienceScore >= 90 && audienceVotes >= 500)) {
                                    // Verified Hot: manual override OR score >= 90% AND >= 500 verified ratings
                                    key = 'rotten_ver';
                                } else {
                                    key = 'audience';
                                }
                            }
                            // ── Metacritic ──
                            else if (key === 'metacritic') {
                                const isMustSee = metacriticScore > 81 && metacriticVotes > 14;
                                key = isMustSee ? 'metacriticms' : 'metacritic';
                            }
                            else if (key.includes('metacritic') && key.includes('user')) key = 'metacriticus';
                            else if (key.includes('trakt')) key = 'trakt';
                            else if (key.includes('letterboxd')) key = 'letterboxd';
                            else if (key.includes('myanimelist')) key = 'myanimelist';
                            
                            const logoUrl = LOGO[key];
                            if (!logoUrl) return;
                            
                            ratings.push({
                                source: r.source,
                                value: r.value,
                                votes: r.votes,
                                key: key,
                                logo: logoUrl
                            });
                        });
                    }
                    
                    const result = {
                        ratings: ratings,
                        originalTitle: data.original_title || data.title || '',
                        year: data.year || ''
                    };
                    
                    STATE.ratingsCache[cacheKey] = result;
                    resolve(result);
                },
                onerror() {
                    resolve(null);
                }
            });
        });
    }
    
    function getAnilistId(imdbId) {
        return new Promise((resolve) => {
            if (!imdbId) {
                resolve(null);
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
                    resolve(b.length && b[0].anilist?.value ? b[0].anilist.value : null);
                },
                onerror: () => resolve(null)
            });
        });
    }
    
    function queryAniListById(id) {
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
                        resolve({ id: m.id, score: m.meanScore });
                    } else {
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }
    
    function queryAniListBySearch(title, year) {
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
                            resolve({ id: m.id, score: m.meanScore });
                        } else {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }
    
    async function fetchAniListRating(imdbId, originalTitle, year) {
        if (!imdbId) return null;
        
        const anilistId = await getAnilistId(imdbId);
        if (anilistId) {
            return await queryAniListById(anilistId);
        } else if (originalTitle && year) {
            return await queryAniListBySearch(originalTitle, parseInt(year, 10));
        }
        return null;
    }
    
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
            max-width: 60%;
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
            top: 4rem;
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
            bottom: 7rem;
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
            bottom: 3rem;
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
            bottom: 11rem;
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
            bottom: 1.5rem; 
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
            infoContainer.appendChild(genresDiv);
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
            const imdbId = getImdbId(item);
            const type = item.Type === 'Series' ? 'show' : 'movie';
            
            if (tmdbId) {
                fetchMDBListRatings(type, tmdbId, item).then(async (ratingsData) => {
                    if (!ratingsData) return;
                    
                    // Ratings are already resolved with correct logos
                    // (tomatoes_certified, rotten_ver, metacriticms etc.)
                    // directly from MDBList data — no external RT scraping needed
                    ratingsData.ratings.forEach(rating => {
                        const ratingItem = document.createElement("div");
                        ratingItem.className = "custom-rating-item";
                        
                        const img = document.createElement("img");
                        img.src = rating.logo;
                        img.alt = rating.source;
                        img.className = "custom-rating-logo";
                        img.title = `${rating.source}: ${rating.value}${rating.votes ? ` (${rating.votes} votes)` : ''}`;
                        img.dataset.source = rating.key;
                        
                        const value = document.createElement("span");
                        value.className = "custom-rating-value";
                        value.textContent = rating.value;
                        
                        ratingItem.appendChild(img);
                        ratingItem.appendChild(value);
                        metaDiv.appendChild(ratingItem);
                    });
                    
                    // AniList lookup (still uses IMDb for Wikidata lookup)
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