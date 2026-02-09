
# EmbySpotlight

A Spotlight banner for Emby Media Server

<img alt="image" src="https://github.com/user-attachments/assets/1d59d591-ef84-4b6b-b393-56e87c122c40" />


### First and foremost:
- This is vibe-coded with the help of Claude Sonnet 4.5 and just a proof of concept
- Tested with stable Server 4.9.X.X on a 1080p-Screen
- This Banner just works on the Web Client
- Big thanks to @Druidblack for the ratings codebase (https://github.com/Druidblack/jellyfin_ratings)


## Installation

 1. Download [Spotlight.js](https://github.com/v1rusnl/EmbySpotlight/blob/main/Spotlight.js) and optionally [spotlight-items.txt](https://github.com/v1rusnl/EmbySpotlight/blob/main/spotlight-items.txt), if you want to decide which items you want to present to users
 
 2. Enable enableCustomRatings and set up your MDBLIST_API_KEY, TMDB_API_KEY and KINOPOISK_API_KEY in line 65-68 -> The keys are needed for the custom ratings, min. MDBList key is mandatory
 
 3. Set your desired cache duration to store Ratings in Browser in line 69 (to minimize API calls). Cou can manually delete ratings cache in Browsers DevConsole (F12):
 
 ```
 Object.keys(localStorage)
 .filter(k => k.startsWith('emby_ratings_'))
 .forEach(k => localStorage.removeItem(k));
 console.log('Erased Ratings-Cache');
 ```
 4. For Allociné in general and Rotten Tomatoes "Verified Hot" Badge to work automatically, you need a reliant CORS proxy, e.g. https://github.com/obeone/simple-cors-proxy and you need to set its base URL in line 72. The reasons are that Allociné has no API and the RT "Verified Hot" badge is also present on movies with a Popcornmeter <90 + not available via MDBList API. Also MDBList API does not provide Rating on some older movies for RT. If you do not want a CORS Proxy, you will get no Allociné and missing some RT ratings. Also the automatic RT "Verified Hot" badge will be based on simple math (Popcornmeter >89 + min. 500 verified Ratings). If you choose to use the script without CORS Proxy, you can set manual overrides for false negatives in RT "Cerified Fresh" and "Verified Hot" status by adding the TMDB-ID in line 203 ff. (e.g. an Item should be "Verified Hot" but has a Rating below 90)
 
 
 3. Change the following values (line 45-61) to your needs:
 
 - limit: The amount of items from 100 latest the plugin shows in Spotlight in random order
 
 ```
 default = 10 items
 ```

 - autoplayInterval: The amount of time how long an item is presented by Spotlight if it has no Trailer (see enableVideoBackdrop and waitForTrailerToEnd variable)

 ```
 default = 10000ms (10s)
 ```

 - vignetteColorTop/Bottom/Left/Right: The gradient/vignette color at the inside edges of the spotlight; can be any supported value of: 
 
```
HEX: "#0000000" -> Emby Themes: Dark = #1e1e1e; Black = #000000; Light = #ffffff; Finimalism inspired = #0a0515; for other gradient themes like AppleTV or Blue Radiance take e.g. Windows Color Picker (WIN+SHIFT+C) and choose a color on the screen that makes you happy
```
 
 - playbuttonColor: controls the color of the play button when hovering over it and can be any valid value. e.g.:
 
 ```
 HEX: "#0000000"
 rgb: "rgb(20 170 223)"
 rgba: "rgba(20 170 223, 0.2)"
 No color: "none"
 Emby accent color: "hsl(var(--theme-primary-color-hue), var(--theme-primary-color-saturation), var(--theme-primary-color-lightness))"
 Finimalism Inspired: "var(--theme-primary-color)"
 ```
 
 - enableVideoBackdrop: true|false -> enables/disbales Trailer playback
 
 - startMuted: true|false -> controls if Trailers start muted or not
 
 - videoVolume: Audio Volume of Trailers
 
 - waitForTrailerToEnd: true|false -> Respect autoplayInterval even an item has a Trailer
 
 - enableMobileVideo: true|false -> Enables Trailer playback in mobile views
 
 - preferredVideoQuality: hd720|hd1080|highres -> Video Quality of Trailer playback, hd720 should be sufficient in most cases due to image masking
 
 - enableSponsorBlock: true|false -> Enable SponsorBlock api; NOTE: You need to have installed the Sponsorblock browser extension
 
 3. Optional: Add IDs of the items you want to present into spotlight-items.txt like this (nested IDs like Collection supported):
 <img width="326" height="155" alt="image" src="https://github.com/user-attachments/assets/6f48bf50-7477-4378-af0c-6f4f1f9064ee" />

 4. Paste modified Spotlight.js (and optional spotlight-items.txt) inside /system/dashboard-ui/ (Windows) or your OS equivalent
 
 5. Add ```<script src="Spotlight.js"></script>``` before ```</body>``` tag at the end of /system/dashboard-ui/index.html
<img width="429" height="81" alt="Screenshot 2025-10-05 155428" src="https://github.com/user-attachments/assets/10f18d01-a610-45b4-bb79-7c895204023d" />
 
 6. Hard reload Emby Web

## License

[MIT](https://github.com/v1rusnl/EmbySpotlight/blob/main/LICENSE)
