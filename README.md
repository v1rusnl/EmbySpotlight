
# EmbySpotlight

A Spotlight banner for Emby Media Server

<img width="1000" height="304" alt="Screenshot 2025-10-08 074242" src="https://github.com/user-attachments/assets/ec29913a-85e5-4a5e-8f86-e580e643b244" />


### First and foremost:
- This is vibe-coded with the help of Claude Sonnet 4.5 and just a proof of concept
- Tested with stable Server 4.9.1.80 on a 1080p-Screen
- This Banner just works on the Web Client


## Usage

 1. Download [Spotlight.js](https://github.com/v1rusnl/EmbySpotlight/blob/main/Spotlight.js)
 2. Change the following values to your needs
 
 a) limit variable (line 28) is for the amount of items from 50 latest the plugin shows in Spotlight in random order
 
 ```
 default = 10 items
 ```

 b) autoplayInterval variable (line 29) sets the amount of time how long an item is presented by Spotlight

 ```
 default = 8000ms (8s)
 ```

 c) backgroundColor variable (line 30) is for the gradient/vignette color at the inside edges of the spotlight and can be any value, e.g.: 
```
HEX: "#0000000" -> Emby Themes: Dark = #1e1e1e; Black = #000000; Light = #ffffff; Finimalism inspired = #090214; for other gradient themes like AppleTV or Blue Radiance take e.g. Windows Color Picker (WIN+SHIFT+C) and choose a color on the screen that makes you happy
```
 d) highlightColor variable (line 31) is for the border around the spotlight on hover and can be any valid value, e.g.: 
 ```
 HEX: "#0000000"
 rgb: "rgb(20 170 223)"
 rgba: "rgba(20 170 223, 0.2)"
 No border: "none"
 Emby Theme accent color: "hsl(var(--theme-primary-color-hue), var(--theme-primary-color-saturation), var(--theme-primary-color-lightness))"
 Finimalism Inspired: "var(--theme-primary-color)"
 ```
 e) marginTop variable (line 32) controls the margin of the Spotlight to the top of the page

 ```
 Emby default themes = 9rem; Finimalism Inspired = 6rem
 ```

 3. Paste modified Spotlight.js inside /system/dashboard-ui/
 4. Add ```<script src="Spotlight.js"></script>``` before ```</body>``` tag at the end of /system/dashboard-ui/index.html

 5. Clear Cache and hard reload Emby Web
    
## License

[MIT](https://github.com/v1rusnl/EmbySpotlight/blob/main/LICENSE)
