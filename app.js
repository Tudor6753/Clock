const CLOCK_UPDATE_MS = 1000;
const SLIDESHOW_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_COORDS = { lat: 44.4323, lon: 26.1063 }; // Bucharest, Romania
const PICSUM_URL = "https://picsum.photos/1920/1080";
const FALLBACK_IMAGES = [
  "Wallpaper/20251109_155809.jpg",
  "Wallpaper/42916480792-cd4b5fcfdf-o.jpg",
  "Wallpaper/52515250436_6ea8fea1ca_o.jpg",
  "Wallpaper/deadpool-pointing-a-gun-meme-cwy6tfv11olwv8mb.jpg",
  "Wallpaper/johnny-sins-wacky-selfie-qkwwxm0y83pqf8jp.jpg",
  "Wallpaper/pexels-mustang-2179483.jpg",
  "Wallpaper/pexels-phil-kallahar-983200.jpg"
];

const timeEl = document.getElementById("time");
const dateEl = document.getElementById("date");
const slideshowEl = document.getElementById("slideshow");
const weatherEls = {
  location: document.getElementById("weather-location"),
  updated: document.getElementById("weather-updated"),
  temp: document.getElementById("weather-temp"),
  desc: document.getElementById("weather-desc"),
  extra: document.getElementById("weather-extra"),
  status: document.getElementById("weather-status")
};

initClock();
initSlideshow();
initWeather();
initFullscreen();

function initClock() {
  if (!timeEl || !dateEl) {
    return;
  }

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  const updateClock = () => {
    const now = new Date();
    timeEl.textContent = timeFormatter.format(now);
    dateEl.textContent = dateFormatter.format(now);
  };

  updateClock();
  setInterval(updateClock, CLOCK_UPDATE_MS);
}

async function initSlideshow() {
  if (!slideshowEl) {
    return;
  }

  let usePicsum = true;
  let fallbackIndex = 0;
  
  // Shuffle fallback images
  const fallbackImages = [...FALLBACK_IMAGES];
  for (let i = fallbackImages.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fallbackImages[i], fallbackImages[j]] = [fallbackImages[j], fallbackImages[i]];
  }

  const cycleSlide = (url) => {
    if (!url) {
      return;
    }

    // Remove visible class from all existing slides
    const existingSlides = slideshowEl.querySelectorAll(".slide");
    existingSlides.forEach(s => s.classList.remove("visible"));

    const slide = document.createElement("div");
    slide.className = "slide";
    slide.style.backgroundImage = `url(${url})`;
    slideshowEl.appendChild(slide);

    // Force reflow then add visible class for transition
    slide.offsetHeight;
    slide.classList.add("visible");

    // Remove old slides after transition completes
    setTimeout(() => {
      const slides = slideshowEl.querySelectorAll(".slide");
      while (slides.length > 1 && slideshowEl.firstChild !== slide) {
        slideshowEl.firstChild.remove();
      }
    }, 2000);
  };

  const loadPicsumImage = () => {
    return new Promise((resolve, reject) => {
      // Add random query to get a different image each time
      const url = `${PICSUM_URL}?random=${Date.now()}`;
      const img = new Image();
      img.decoding = "async";
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => resolve(img.src);
      img.onerror = () => reject(new Error("Picsum failed to load"));
    });
  };

  const loadFallbackImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error("Fallback image failed"));
    });
  };

  const showNextSlide = async () => {
    if (usePicsum) {
      try {
        console.log("Loading image from Picsum...");
        const url = await loadPicsumImage();
        console.log("Picsum loaded:", url);
        cycleSlide(url);
      } catch (error) {
        console.warn("Picsum failed, switching to fallback images", error);
        usePicsum = false;
        // Load fallback instead
        const fallbackUrl = fallbackImages[fallbackIndex];
        fallbackIndex = (fallbackIndex + 1) % fallbackImages.length;
        try {
          await loadFallbackImage(fallbackUrl);
          cycleSlide(fallbackUrl);
        } catch (e) {
          console.error("Fallback also failed", e);
        }
      }
    } else {
      // Use fallback images
      const fallbackUrl = fallbackImages[fallbackIndex];
      console.log("Loading fallback image", fallbackIndex, fallbackUrl);
      fallbackIndex = (fallbackIndex + 1) % fallbackImages.length;
      try {
        await loadFallbackImage(fallbackUrl);
        cycleSlide(fallbackUrl);
      } catch (e) {
        console.warn("Fallback image failed, trying next", e);
        showNextSlide();
      }
    }
  };

  showNextSlide();
  const intervalId = setInterval(showNextSlide, SLIDESHOW_INTERVAL_MS);
  console.log("Slideshow started with interval", SLIDESHOW_INTERVAL_MS, "ms, intervalId:", intervalId);
}

function initWeather() {
  if (!weatherEls.status) {
    return;
  }

  const fetchAndRender = async () => {
    try {
      weatherEls.status.textContent = "Fetching weather...";
      const coords = await getCoordinates().catch(() => DEFAULT_COORDS);
      const weatherData = await fetchWeatherOpenMeteo(coords);
      renderWeatherOpenMeteo(weatherData);
      weatherEls.status.textContent = "";
    } catch (error) {
      console.error("Weather load failed", error);
      weatherEls.status.textContent = "Unable to update weather right now.";
    }
  };

  // Manual refresh button
  const refreshBtn = document.getElementById("weather-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", fetchAndRender);
  }

  fetchAndRender();
  setInterval(fetchAndRender, WEATHER_REFRESH_MS);
}

function getCoordinates() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Geolocation unavailable"));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve({ lat: latitude, lon: longitude });
      },
      (error) => reject(error),
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 15 * 60 * 1000
      }
    );
  });
}

async function fetchWeatherOpenMeteo({ lat, lon }) {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,precipitation",
    timezone: "auto"
  });

  const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`);
  }

  return response.json();
}

function getWeatherDescription(weatherCode) {
  const descriptions = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
  };
  return descriptions[weatherCode] || "Unknown";
}

function renderWeatherOpenMeteo(data) {
  if (!data || !data.current) {
    throw new Error("Incomplete weather payload");
  }

  const current = data.current;
  const temp = Math.round(current.temperature_2m);
  const feelsLike = Math.round(current.apparent_temperature);
  const humidity = Math.round(current.relative_humidity_2m);
  const windKmh = Math.round(current.wind_speed_10m);
  const precipitation = current.precipitation;
  const weatherCode = current.weather_code;
  const description = getWeatherDescription(weatherCode);
  
  // Get precipitation probability from hourly data (current hour)
  let precipProb = null;
  if (data.hourly?.precipitation_probability?.length > 0) {
    const now = new Date();
    const currentHourIndex = data.hourly.time.findIndex(t => {
      const hourTime = new Date(t);
      return hourTime.getHours() === now.getHours() && 
             hourTime.getDate() === now.getDate();
    });
    if (currentHourIndex >= 0) {
      precipProb = data.hourly.precipitation_probability[currentHourIndex];
    }
  }

  const updatedFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  if (weatherEls.location) {
    weatherEls.location.textContent = "Weather";
  }

  if (weatherEls.temp) {
    weatherEls.temp.textContent = `${temp}°C`;
  }

  if (weatherEls.desc) {
    weatherEls.desc.textContent = description;
  }

  if (weatherEls.extra) {
    const detailParts = [`Feels like ${feelsLike}°`, `Humidity ${humidity}%`, `Wind ${windKmh} km/h`];
    if (precipProb !== null) {
      detailParts.push(`Rain ${precipProb}%`);
    }
    if (precipitation > 0) {
      detailParts.push(`Precip ${precipitation} mm`);
    }
    weatherEls.extra.textContent = detailParts.join(" · ");
  }

  if (weatherEls.updated) {
    weatherEls.updated.textContent = `Updated ${updatedFormatter.format(new Date())}`;
  }
}

function initFullscreen() {
  const btn = document.getElementById("fullscreen-btn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  });
}
