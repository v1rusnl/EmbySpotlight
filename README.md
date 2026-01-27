
# EmbySpotlight

A Spotlight banner for Emby Media Server

<img alt="image" src="https://github.com/user-attachments/assets/e324bd27-805d-42e2-adf3-f61ea6b13d68" />


### First and foremost:
- This is vibe-coded with the help of Claude Sonnet 4.5 and just a proof of concept
- Tested with stable Server 4.9.0.30 on a 1080p-Screen
- This Banner just works on the Web Client
- Big thanks to @Druidblack for the ratings codebase


## Installation

 1. Download [Spotlight.js](https://github.com/v1rusnl/EmbySpotlight/blob/main/Spotlight.js) and optionally [spotlight-items.txt](https://github.com/v1rusnl/EmbySpotlight/blob/main/spotlight-items.txt), if you want to decide which items you want to present to users
 2. Set up you MDBLIST_API_KEY and TMDB_API_KEY in line 73-74 -> The keys are needed for the custom ratings
 3. Change the following values (line 53-69) to your needs
 
 a) limit: The amount of items from 50 latest the plugin shows in Spotlight in random order
 
 ```
 default = 10 items
 ```

 b) autoplayInterval: The amount of time how long an item is presented by Spotlight if it has no Trailer (see enableVideoBackdrop and waitForTrailerToEnd variable)

 ```
 default = 10000ms (10s)
 ```

 c) backgroundColor: The gradient/vignette color at the inside edges of the spotlight; can be any supported value of: 
 
```
HEX: "#0000000" -> Emby Themes: Dark = #1e1e1e; Black = #000000; Light = #ffffff; Finimalism inspired = #0a0515; for other gradient themes like AppleTV or Blue Radiance take e.g. Windows Color Picker (WIN+SHIFT+C) and choose a color on the screen that makes you happy
```
 
 d) playbuttonColor: controls the color of the play button when hovering over it and can be any valid value. e.g.:
 
 ```
 HEX: "#0000000"
 rgb: "rgb(20 170 223)"
 rgba: "rgba(20 170 223, 0.2)"
 No color: "none"
 Emby accent color: "hsl(var(--theme-primary-color-hue), var(--theme-primary-color-saturation), var(--theme-primary-color-lightness))"
 Finimalism Inspired: "var(--theme-primary-color)"
 ```
 
 e) enableVideoBackdrop: true|false -> enables/disbales Trailer playback
 
 f) startMuted: true|false -> controls if Trailers start muted or not
 
 g) videoVolume: Audio Volume of Trailers
 
 h) waitForTrailerToEnd: true|false -> Respect autoplayInterval even an item has a Trailer
 
 i) enableMobileVideo: true|false -> Enables Trailer playback in mobile views
 
 j) preferredVideoQuality: hd720|hd1080|highres -> Video Quality of Trailer playback, hd720 should be sufficient in most cases due to image masking
 
 k) enableSponsorBlock: true|false -> Enable SponsorBlock api
 
 3. Optional: Add IDs of the items you want to present into spotlight-items.txt like this:
 <img width="326" height="155" alt="image" src="https://github.com/user-attachments/assets/6f48bf50-7477-4378-af0c-6f4f1f9064ee" />

 4. Paste modified Spotlight.js (and optional spotlight-items.txt) inside /system/dashboard-ui/
 
 5. Add ```<script src="Spotlight.js"></script>``` before ```</body>``` tag at the end of /system/dashboard-ui/index.html
<img width="429" height="81" alt="Screenshot 2025-10-05 155428" src="https://github.com/user-attachments/assets/10f18d01-a610-45b4-bb79-7c895204023d" />
 
 6. Clear Cache and hard reload Emby Web

## License

[MIT](https://github.com/v1rusnl/EmbySpotlight/blob/main/LICENSE)
