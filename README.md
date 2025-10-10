
# EmbySpotlight

A Spotlight banner for Emby Media Server

<img width="1000" height="304" alt="Screenshot 2025-10-08 074242" src="https://github.com/user-attachments/assets/ec29913a-85e5-4a5e-8f86-e580e643b244" />

<img width="1000" height="340" alt="Screenshot 2025-10-08 122744" src="https://github.com/user-attachments/assets/7856701a-c064-413e-b6c5-d5859258aa2d" />



### First and foremost:
- This is vibe-coded with the help of Claude Sonnet 4.5 and just a proof of concept
- Tested with stable Server 4.9.1.80 on a 1080p-Screen
- This Banner just works on the Web Client


## Installation

 1. Download [Spotlight.js](https://github.com/v1rusnl/EmbySpotlight/blob/main/Spotlight.js) and optionally [spotlight-items.txt](https://github.com/v1rusnl/EmbySpotlight/blob/main/spotlight-items.txt), if you want to decide which items you want to present
 2. Change the following values in Spotlight.js to your needs
 
 a) limit variable (line 10) is for the amount of items from 100 latest the plugin shows in Spotlight in random order
 
 ```
 default = 10 items
 ```

 b) autoplayInterval variable (line 11) sets the amount of time how long an item is presented by Spotlight

 ```
 default = 8000ms (8s)
 ```

 c) backgroundColor variable (line 12) is for the gradient/vignette color at the inside edges of the spotlight and can be any supported value of: 
 
```
HEX: "#0000000" -> Emby Themes: Dark = #1e1e1e; Black = #000000; Light = #ffffff; Finimalism inspired = #090214; for other gradient themes like AppleTV or Blue Radiance take e.g. Windows Color Picker (WIN+SHIFT+C) and choose a color on the screen that makes you happy
```

 d) highlightColor variable (line 13) is for the border around the spotlight on hover and can be any valid value. e.g.: 
 
 ```
 HEX: "#0000000"
 rgb: "rgb(20 170 223)"
 rgba: "rgba(20 170 223, 0.2)"
 No border: "none"
 Emby Theme accent color: "hsl(var(--theme-primary-color-hue), var(--theme-primary-color-saturation), var(--theme-primary-color-lightness))"
 Finimalism Inspired: "var(--theme-primary-color)"
 ```
 
 e) marginTop variable (line 14) controls the margin of the Spotlight to the top of the page

 ```
 Emby default themes = 9rem; Finimalism Inspired = 6rem
 ```
 
 f) playbuttonColor variable (line 15) controls the color of the play button when hovering over it and can be any valid value. e.g.:
 
 ```
 HEX: "#0000000"
 rgb: "rgb(20 170 223)"
 rgba: "rgba(20 170 223, 0.2)"
 No color: "none"
 Emby accent color: "hsl(var(--theme-primary-color-hue), var(--theme-primary-color-saturation), var(--theme-primary-color-lightness))"
 Finimalism Inspired: "var(--theme-primary-color)"
 ```
 
 3. Optional: Add IDs of the items you want to present into spotlight-items.txt like this:
 <img width="326" height="155" alt="image" src="https://github.com/user-attachments/assets/6f48bf50-7477-4378-af0c-6f4f1f9064ee" />

 4. Paste modified Spotlight.js (and optional spotlight-items.txt) inside /system/dashboard-ui/
 
 5. Add ```<script src="Spotlight.js"></script>``` before ```</body>``` tag at the end of /system/dashboard-ui/index.html
<img width="429" height="81" alt="Screenshot 2025-10-05 155428" src="https://github.com/user-attachments/assets/10f18d01-a610-45b4-bb79-7c895204023d" />
 
 6. Clear Cache and hard reload Emby Web

## Usage
 - Spotlight Banner switches between items automatically in the set up time frame (default 8s)
 - Hover over the Banner to see the Play-Button and click it to watch the item
 - Click the Logoart to see the Plot overview, click the Plot overview to see the Logo again (switches automatically back to logo when changing item)
 - Use the Left-/Right-Arrows to jump between items

    
## License

[MIT](https://github.com/v1rusnl/EmbySpotlight/blob/main/LICENSE)
