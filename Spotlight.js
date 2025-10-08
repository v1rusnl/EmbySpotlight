/*!
 * Spotlight.js — Emby 4.9 compatible Spotlight slider
 * Source: built for sh0rty (10 items from random latest 50 items (Movies/TVShows))
 * Generated: 2025-10-07
 * 
 * 1. Download Spotlight.js
 * 2. Change the following values to your needs
 *    a) limit variable (line 28) is for the amount of items from 50 latest the plugin shows in Spotlight in random order -> default = 10 items
 *    b) autoplayInterval variable (line 29) sets the amount of time how long an item is presented by Spotlight -> default = 8000ms (8s)
 *    c) backgroundColor variable (line 30) is for the gradient/vignette color at the inside edges of the spotlight and can be any value, e.g.: 
 *       HEX: "#0000000" -> Emby Themes: Dark = #1e1e1e; Black = #000000; Light = #ffffff; Finimalism Inspired = #090214; for other gradient themes like AppleTV or Blue Radiance take e.g. Windows Color Picker (WIN+SHIFT+C) and choose a color on the screen that makes you happy
 *    d) highlightColor variable (line 31) is for the border around the spotlight on hover and can be any valid value, e.g.: 
 *       HEX: "#0000000"
 *       rgb: "rgb(20 170 223)"
 *       rgba: "rgba(20 170 223, 0.2)"
 *       No border: "none"
 *       Emby accent color: "hsl(var(--theme-primary-color-hue), var(--theme-primary-color-saturation), var(--theme-primary-color-lightness))"
 *       Finimalism Inspired: "var(--theme-primary-color)"
 *    e) marginTop variable (line 32) controls the margin of the Spotlight to the top of the page -> Emby default themes = 9rem; Finimalism = 6rem
 * 3. Paste modified Spotlight.js inside /system/dashboard-ui/
 * 4. Add <script src="Spotlight.js"></script> before </body> tag at the end of /system/dashboard-ui/index.html
 * 5. Clear Cache and hard reload Emby Web
 */
(function () {
    'use strict';
    const CONFIG = {
        imageWidth: 1900,
		limit: 10,
        autoplayInterval: 8000,
        backgroundColor: "#000000",
		highlightColor: "hsl(var(--theme-primary-color-hue), var(--theme-primary-color-saturation), var(--theme-primary-color-lightness))",
		marginTop: "9rem"
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
        const fallback = document.querySelector(".view:not(.hide)");
        return fallback;
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
    
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
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
   
	function insertStyles() {
		if (document.getElementById("spotlight-css-emby")) return;
		
		const bgColor = CONFIG.backgroundColor;
		const highlightColor = CONFIG.highlightColor;
		const marginTop = CONFIG.marginTop;
		const rgb = hexToRgb(bgColor);
		const rgbaColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
		
		const css = `
	/* Spotlight Slider Styles */
	.spotlight-container { 
		width: 94%; 
		display: block; 
		position: relative; 
		margin-top: ${marginTop};
		margin-left: auto;
		margin-right: auto;
		padding: 0;
        transition: box-shadow 0.3s ease;
        border-radius: 0.5rem;
        box-shadow: 10px 10px 10px 0px rgba(0, 0, 0, 0.35);
	}
	.spotlight-container:hover {
		box-shadow: 10px 10px 10px 0px rgba(0, 0, 0, 0.35), 0 0 2px 4px ${highlightColor};
		border-radius: 0.5rem;
    }
	.spotlight { 
		position: relative; 
		overflow: visible;
		width: 100%;
	}
	.spotlight .banner-slider-wrapper {
		position: relative;
		width: 100%;
		overflow: hidden;
        border-radius: 0.5rem;
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
	}
	.spotlight .banner-item { 
		flex: 0 0 100%; 
		min-width: 100%;
		max-width: 100%;
		position: relative; 
		cursor: pointer;
		margin: 0;
		padding: 0;
		box-sizing: border-box;
		overflow: hidden;
	}
	.spotlight .banner-cover { 
		width: 100%;
		height: min(48vmax, 54vh);
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
	.spotlight .banner-gradient-left {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 35%;
		pointer-events: none;
		z-index: 6;
		background: linear-gradient(to right, 
			${rgbaColor} 0%, 
			${rgbaColor} 3%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.98) 6%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.95) 10%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.92) 15%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.87) 20%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8) 25%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7) 35%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55) 45%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4) 55%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25) 65%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15) 75%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08) 85%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.03) 92%,
			transparent 100%);
	}
	.spotlight .banner-gradient-right {
		position: absolute;
		top: 0;
		bottom: 0;
		right: 0;
		width: 35%;
		pointer-events: none;
		z-index: 6;
		background: linear-gradient(to left, 
			${rgbaColor} 0%, 
			${rgbaColor} 3%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.98) 6%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.95) 10%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.92) 15%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.87) 20%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8) 25%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7) 35%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55) 45%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4) 55%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25) 65%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15) 75%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08) 85%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.03) 92%,
			transparent 100%);
	}
	.spotlight .banner-vignette-top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 30%;
		background: linear-gradient(to bottom, 
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85) 0%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6) 30%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3) 60%,
			transparent 100%);
		pointer-events: none;
		z-index: 6;
	}
	.spotlight .banner-vignette-bottom {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 30%;
		background: linear-gradient(to top, 
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85) 0%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6) 30%,
			rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3) 60%,
			transparent 100%);
		pointer-events: none;
		z-index: 6;
	}
	.spotlight .banner-logo {
		position: absolute;
		left: 50%;
		top: 45%;
		transform: translate(-50%, -50%);
		max-width: 60%;
		max-height: 50%;
		object-fit: contain;
		z-index: 15;
		filter: drop-shadow(0 6px 20px rgba(0,0,0,0.95)) drop-shadow(0 0 40px rgba(0,0,0,0.6));
		pointer-events: none;
		transition: transform 0.3s ease;
	}
	.spotlight-container:hover .banner-logo {
        transform: translate(-50%, -50%) scale(1.05);
    }
	.spotlight .banner-title { 
		position: absolute; 
		left: 50%;
		top: 45%;
		transform: translate(-50%, -50%);
		z-index: 10; 
		font-size: clamp(1.5rem, 3.5vw, 3rem); 
		font-weight: 700; 
		color: #fff;
		text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
		pointer-events: none;
		text-align: center;
		max-width: 80%;
		transition: transform 0.3s ease;
	}
	.spotlight-container:hover .banner-title {
        transform: translate(-50%, -50%) scale(1.05);
    }
	.spotlight .banner-tagline {
		position: absolute;
		left: 50%;
		bottom: 4%;
		transform: translateX(-50%);
		z-index: 10;
		font-size: clamp(1.3rem, 2vw, 1.6rem);
		font-weight: 500;
		color: rgba(255,255,255,0.9);
		text-shadow: 1px 1px 4px rgba(0,0,0,0.9);
		pointer-events: none;
		text-align: center;
		max-width: 60%;
	}
	@media (max-width: 1500px) {
        .spotlight .banner-tagline {
            display: none;
        }
    }
	.spotlight .banner-info {
		position: absolute;
		left: 3vmin;
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
		bottom: 2rem; 
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
	`;
		const s = document.createElement("style");
		s.id = "spotlight-css-emby";
		s.innerHTML = css;
		document.head.appendChild(s);
	}
    
	function buildQuery() {
		const q = {
			IncludeItemTypes: "Movie,Series",
			Recursive: true,
			Limit: 50,
			SortBy: "PremiereDate,ProductionYear,SortName",
			SortOrder: "Descending",
			EnableImageTypes: "Primary,Backdrop,Thumb,Logo,Banner",
			EnableUserData: false,
			EnableTotalRecordCount: false,
			Fields: "PrimaryImageAspectRatio,BackdropImageTags,ImageTags,ParentLogoImageTag,ParentLogoItemId,CriticRating,CommunityRating,OfficialRating,PremiereDate,ProductionYear,Genres,RunTimeTicks,Taglines"  // Taglines hinzugefügt
		};
		return q;
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
    
    async function fetchItems(apiClient) {
        const q = buildQuery();
        try {
            const items = await apiClient.getItems(apiClient.getCurrentUserId(), q);
            const allItems = items.Items || [];
            const shuffledItems = shuffleArray(allItems);
            return shuffledItems.slice(0, CONFIG.limit);
        } catch (e) {
            console.warn("[Spotlight] Fehler beim Abrufen der Items", e);
            return [];
        }
    }
    
	function createInfoElement(item) {
		const infoContainer = document.createElement("div");
		infoContainer.className = "banner-info";
		
		// Genres (max 3) - darüber
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
		
		// Meta-Informationen (Jahr, Laufzeit, Ratings) - in dieser Reihenfolge
		const metaDiv = document.createElement("div");
		metaDiv.className = "banner-meta";
		
		// Jahr ZUERST
		if (item.ProductionYear) {
			const yearSpan = document.createElement("span");
			yearSpan.className = "banner-meta-item";
			yearSpan.textContent = item.ProductionYear;
			metaDiv.appendChild(yearSpan);
		}
		
		// Rotten Tomatoes Rating
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
		
		// IMDb Rating
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
		
		// Laufzeit
		if (item.RunTimeTicks) {
			const runtimeMinutes = Math.round(item.RunTimeTicks / 600000000);
			const runtimeSpan = document.createElement("span");
			runtimeSpan.className = "banner-meta-item";
			runtimeSpan.textContent = formatRuntime(runtimeMinutes);
			metaDiv.appendChild(runtimeSpan);
		}
		
		if (metaDiv.children.length > 0) {
			infoContainer.appendChild(metaDiv);
		}
		
		return infoContainer.children.length > 0 ? infoContainer : null;
	}
    
	function createBannerElement(item, apiClient) {
		const div = document.createElement("div");
		div.className = "banner-item";
		
		const img = document.createElement("img");
		img.className = "banner-cover";
		img.draggable = false;
		img.alt = item.Name || "";
		img.loading = "eager";
		img.decoding = "async";
		img.src = getImageUrl(apiClient, item, { width: CONFIG.imageWidth, prefer: "Backdrop" });
		
		div.appendChild(img);
		
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
		
		// NEU: Tagline hinzufügen
		if (item.Taglines && item.Taglines.length > 0) {
			const tagline = document.createElement("div");
			tagline.className = "banner-tagline";
			tagline.textContent = item.Taglines[0];
			div.appendChild(tagline);
		}
		
		const info = createInfoElement(item);
		if (info) {
			div.appendChild(info);
		}
		
		div.dataset.itemId = item.Id;
		if (item.ServerId) {
			div.dataset.serverId = item.ServerId;
		}
		return div;
	}
    
    function buildSlider(items, apiClient) {
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
        
        items.forEach(it => {
            const el = createBannerElement(it, apiClient);
            slider.appendChild(el);
        });
        
        if (items.length > 1) {
            const first = slider.children[0].cloneNode(true);
            const last = slider.children[slider.children.length - 1].cloneNode(true);
            slider.appendChild(first);
            slider.insertBefore(last, slider.children[0]);
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
        
        return { container, spotlight, slider, btnLeft, btnRight, controls, sliderWrapper };
    }
    
    function navigateToItem(itemId, serverId, apiClient) {
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
        
        if (!serverIdToUse) {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                serverIdToUse = urlParams.get('serverId');
            } catch (e) { /* ignore */ }
        }
        
        if (!serverIdToUse && window.localStorage) {
            try {
                serverIdToUse = window.localStorage.getItem('serverId');
            } catch (e) { /* ignore */ }
        }
        
        console.log("[Spotlight] Navigiere zu Item:", itemId, "ServerId:", serverIdToUse);
        
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
        
        if (typeof window.page === "function") {
            const url = serverIdToUse 
                ? `/item?id=${itemId}&serverId=${serverIdToUse}` 
                : `/item?id=${itemId}`;
            console.log("[Spotlight] Verwende page():", url);
            window.page(url);
            return;
        }
        
        if (typeof require === "function") {
            try {
                require(['appRouter'], function(appRouter) {
                    if (appRouter && typeof appRouter.showItem === "function") {
                        console.log("[Spotlight] Verwende require appRouter.showItem");
                        appRouter.showItem(itemId, serverIdToUse);
                    } else if (appRouter && typeof appRouter.show === "function") {
                        const url = serverIdToUse 
                            ? `item?id=${itemId}&serverId=${serverIdToUse}` 
                            : `item?id=${itemId}`;
                        console.log("[Spotlight] Verwende require appRouter.show:", url);
                        appRouter.show(url);
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
        console.log("[Spotlight] Fallback: Hash-Navigation mit Reload:", url);
        window.location.hash = url;
        
        setTimeout(() => {
            if (window.location.hash.includes(itemId)) {
                console.log("[Spotlight] Forcing page reload");
                window.location.reload();
            }
        }, 100);
    }
    
    function attachSliderBehavior(state, apiClient) {
        const { slider, itemsCount, btnLeft, btnRight, controls, spotlight } = state;
        let currentIndex = 1;
        
        try {
            const savedIndex = sessionStorage.getItem('spotlight-current-index');
            if (savedIndex) {
                const parsedIndex = parseInt(savedIndex, 10);
                if (parsedIndex >= 1 && parsedIndex <= itemsCount) {
                    currentIndex = parsedIndex;
                }
            }
        } catch (e) { /* ignore */ }
        
        function saveCurrentIndex() {
            try {
                sessionStorage.setItem('spotlight-current-index', currentIndex.toString());
            } catch (e) { /* ignore */ }
        }
        
        function triggerZoomAnimation() {
            const visibleItem = slider.children[currentIndex];
            if (visibleItem) {
                const cover = visibleItem.querySelector('.banner-cover');
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
			const x = Math.round(-(index * width)); // ← Math.round hinzugefügt
			
			if (!animate) {
				slider.style.transition = "none";
			} else {
				slider.style.transition = "transform .5s ease";
			}
			
			slider.style.transform = `translate3d(${x}px, 0, 0)`;
			// NEU: Force repaint
			void slider.offsetHeight;
		}
        
        function setActiveDot(idx) {
            const dots = controls.querySelectorAll(".control");
            dots.forEach(d => d.classList.remove("active"));
            const realIndex = ((idx - 1 + itemsCount) % itemsCount);
            if (dots[realIndex]) dots[realIndex].classList.add("active");
        }
        
		const resizeHandler = () => {
			updateTransform(currentIndex, false);
			void slider.offsetHeight; // Force repaint - NEU hinzugefügt
		};
		window.addEventListener("resize", resizeHandler);
		setTimeout(() => {
			updateTransform(currentIndex, false);
			setActiveDot(currentIndex);
			triggerZoomAnimation();
		}, 50);
        
        btnRight.addEventListener("click", (e) => {
            e.stopPropagation();
            currentIndex++;
            animate();
        });
        
        btnLeft.addEventListener("click", (e) => {
            e.stopPropagation();
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
                setTimeout(() => triggerZoomAnimation(), 100);
            }
        });
        
        function animate() {
            updateTransform(currentIndex, true);
            setActiveDot(currentIndex);
            saveCurrentIndex();
            setTimeout(() => triggerZoomAnimation(), 100);
            
            setTimeout(() => {
                if (currentIndex === 0) {
                    currentIndex = itemsCount;
                    updateTransform(currentIndex, false);
                    setActiveDot(currentIndex);
                    saveCurrentIndex();
                    setTimeout(() => triggerZoomAnimation(), 100);
                } else if (currentIndex === itemsCount + 1) {
                    currentIndex = 1;
                    updateTransform(currentIndex, false);
                    setActiveDot(currentIndex);
                    saveCurrentIndex();
                    setTimeout(() => triggerZoomAnimation(), 100);
                }
            }, 520);
        }
        
        slider.addEventListener("click", (e) => {
            if (e.target.closest('.arrow') || e.target.closest('.controls')) {
                return;
            }
            
            let node = e.target;
            while (node && node !== slider && !node.dataset?.itemId) {
                node = node.parentElement;
            }
            
            if (node && node.dataset?.itemId) {
                const itemId = node.dataset.itemId;
                const serverId = node.dataset.serverId;
                console.log("[Spotlight] Klick auf Item:", itemId, "ServerId:", serverId);
                navigateToItem(itemId, serverId, apiClient);
            }
        });
        
        const bannerItems = slider.querySelectorAll('.banner-item');
        bannerItems.forEach(item => {
            item.style.cursor = 'pointer';
        });
        
        let autoplayTimer = null;
        
        function startAutoplay() {
            if (autoplayTimer) clearInterval(autoplayTimer);
            autoplayTimer = setInterval(() => {
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
                console.log("[Spotlight] Slider bereits vorhanden, überspringe Init");
                return;
            }
            
            insertStyles();
            
            const home = findHomeContainer();
            if (!home) {
                console.warn("[Spotlight] Home container not found");
                return;
            }
            
            const [connectionManager, ApiClient] = await safeRequire(["connectionManager", "ApiClient"]);
            
            let apiClient = null;
            try {
                if (connectionManager && connectionManager[0] && connectionManager[0].currentApiClient) {
                    apiClient = connectionManager[0].currentApiClient();
                }
            } catch (e) { /* ignore */ }
            
            if (!apiClient) {
                try {
                    if (ApiClient && ApiClient[0] && ApiClient[0].serverAddress) {
                        apiClient = ApiClient[0];
                    }
                } catch (e) { /* ignore */ }
            }
            
            if (!apiClient && window.ApiClient) apiClient = window.ApiClient;
            
            if (!apiClient) {
                console.warn("[Spotlight] ApiClient not available - cannot fetch items");
                return;
            }
            
            const items = await fetchItems(apiClient);
            if (!items || items.length === 0) {
                console.warn("[Spotlight] Keine Items erhalten");
                return;
            }
            
            console.log("[Spotlight] ApiClient ServerId:", apiClient.serverId || apiClient.serverInfo?.Id || "nicht gefunden");
            console.log("[Spotlight] Items geladen:", items.length);
            
            const { container, spotlight, slider, btnLeft, btnRight, controls } = buildSlider(items, apiClient);
            
            const reference = home.querySelector ? home.querySelector(".homeSectionsContainer") : null;
            if (reference && reference.parentNode) {
                reference.parentNode.insertBefore(container, reference);
            } else {
                home.insertBefore(container, home.firstChild);
            }
            
            const loader = container.querySelector(".loader");
            if (loader) loader.style.display = "none";
            
            attachSliderBehavior({ slider, itemsCount: items.length, btnLeft, btnRight, controls, spotlight }, apiClient);
            
            console.log("[Spotlight] Slider initialisiert mit", items.length, "Elementen");
        } catch (err) {
            console.error("[Spotlight] init error", err);
        }
    }
    
    function observeViewAndInit() {
        let initialized = false;
        
        const observer = new MutationObserver((mutations) => {
            const homeVisible = !!document.querySelector(".view:not(.hide) .homeSectionsContainer, .view:not(.hide) [data-view='home'], .view:not(.hide) .view-home-home");
            
            if (homeVisible && !initialized) {
                initialized = true;
                setTimeout(() => init(), 300);
            }
            
            if (!homeVisible && initialized) {
                initialized = false;
                const oldSlider = document.getElementById(SPOTLIGHT_CONTAINER_ID);
                if (oldSlider) {
                    oldSlider.remove();
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
            const hv = !!document.querySelector(".view:not(.hide) .homeSectionsContainer, .view:not(.hide) [data-view='home']");
            if (hv) init();
        }, 500);
    }
    
    observeViewAndInit();
})();