# Spotlight Clock

Fullscreen Android-friendly clock that rotates through Windows Spotlight images and shows concise weather data in the lower-right corner.

## Features

- Large auto-formatting time and date view sized for phones and tablets.
- Background slideshow powered by live Windows Spotlight (Bing) images with smooth crossfades and offline fallbacks.
- Glassmorphism weather card pinned to the lower-right corner with temperature, description, humidity, and wind.
- Geolocation awareness with graceful fallback coordinates so the experience keeps working if permissions are denied.

## Getting started

1. OpenWeatherMap key
   - Create a free key at [https://openweathermap.org/api](https://openweathermap.org/api).
   - In `app.js`, replace `REPLACE_WITH_YOUR_OPENWEATHER_KEY` with your key string.
2. Serve the project
   - Use any static server (for example VS Code Live Server, `npx serve`, or `python -m http.server 5173`).
   - Navigate to the served URL on your Android device. Add it to the home screen for a full-screen experience.
3. Allow permissions
   - When prompted, allow location access so the weather widget can use precise coordinates. If you decline, the app falls back to Seattle, USA.

## Customization tips

- Adjust the slideshow cadence by editing `SLIDESHOW_INTERVAL_MS` in `app.js` (value is in milliseconds).
- Update the fallback Windows Spotlight URLs in `app.js` if you have specific favorites you would like to showcase offline.
- The weather card uses metric units by default. Change `units` inside `fetchWeather` to `imperial` if you prefer Fahrenheit and mph.

## Notes

- The Bing Spotlight endpoint occasionally rate-limits CORS requests. When that happens the app automatically flips over to the bundled fallback list so the UI still looks polished.
- This repository purposely stays framework-free so you can deploy it on any simple hosting service or even keep it as an offline dashboard.
