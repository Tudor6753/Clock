const CLOCK_UPDATE_MS = 1000;
const SLIDESHOW_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const MOVE_INTERVAL_MS = 42000; // ~42 seconds for UI corner cycling
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
	"Wallpaper/pexels-phil-kallahar-983200.jpg",
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
	status: document.getElementById("weather-status"),
};

initClock();
initSlideshow();
initWeather();
initFullscreen();
initPixelSafety();

function initClock() {
	if (!timeEl || !dateEl) {
		return;
	}

	const timeFormatter = new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
  hour12: false,
	});
	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
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
		existingSlides.forEach((s) => s.classList.remove("visible"));

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

	// Detect Chrome version to work around quirks on older Android Chrome builds
	const getChromeMajor = () => {
		try {
			const ua = navigator.userAgent || "";
			const match = ua.match(/Chrom(e|ium)\/(\d+)\./i);
			if (!match) return null;
			return Number(match[2]);
		} catch (e) {
			return null;
		}
	};

	const loadPicsumImage = () => {
		return new Promise((resolve, reject) => {
			// Add random query to get a different image each time
			const url = `${PICSUM_URL}?random=${Date.now()}`;
			const img = new Image();

			// Optional: set decoding if browser supports it
			if ("decoding" in img) {
				try {
					img.decoding = "async";
				} catch (e) {
					/* ignore */
				}
			}

			const chromeMajor = getChromeMajor();
			let attemptedWithoutCrossOrigin = false;

			const tryLoad = (allowCrossOrigin) => {
				try {
					if (allowCrossOrigin) {
						// Feature detect crossOrigin support on the Image prototype
						if (Object.getOwnPropertyDescriptor(Image.prototype, "crossOrigin")) {
							img.crossOrigin = "anonymous";
						}
					} else {
						// Remove any crossOrigin set previously
						try {
							delete img.crossOrigin;
						} catch (e) {
							/* ignore */
						}
					}
				} catch (err) {
					console.debug("Cross-origin attribute handling skipped", err);
				}

				img.src = url;
				img.onload = () => resolve(img.src);
				img.onerror = async () => {
					// If we tried with crossOrigin and the browser is an older Chrome,
					// retry without crossOrigin once. This addresses older Chrome 95
					// quirks where redirects + crossOrigin cause image load failures.
					if (!attemptedWithoutCrossOrigin && chromeMajor && chromeMajor <= 95) {
						attemptedWithoutCrossOrigin = true;
						console.warn("Picsum load failed with crossOrigin; retrying without crossOrigin");
						tryLoad(false);
						return;
					}

					reject(new Error("Picsum failed to load"));
				};
				// close tryLoad function body
			};
			// For older Chrome we initially avoid forcing crossOrigin; allow the
			// normal flow to take place. Otherwise we try with crossOrigin for
			// images that support CORS.
			if (chromeMajor && chromeMajor <= 95) {
				tryLoad(false);
			} else {
				tryLoad(true);
			}
		});
	};

	const loadFallbackImage = (url) => {
		return new Promise((resolve, reject) => {
			const img = new Image();
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
				maximumAge: 15 * 60 * 1000,
			}
		);
	});
}

async function fetchWeatherOpenMeteo({ lat, lon }) {
	// Open-Meteo expects `latitude`/`longitude` and boolean `current_weather`
	// for a condensed current weather object. We also request hourly arrays
	// for the variables we need and then synthesize a `current` object that
	// `renderWeatherOpenMeteo` expects (for backward compatibility).
	const params = new URLSearchParams({
		latitude: lat.toString(),
		longitude: lon.toString(),
		current_weather: "true",
		hourly: "temperature_2m,apparent_temperature,relativehumidity_2m,windspeed_10m,precipitation,precipitation_probability,weathercode",
		timezone: "auto",
	});

	const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, {
		cache: "no-store",
	});

	if (!response.ok) {
		throw new Error(`Weather request failed: ${response.status}`);
	}

	const json = await response.json();

	// Map Open-Meteo shape to the `data.current` shape expected by the
	// rendering function for compatibility with other providers.
	const mapToCurrent = (payload) => {
		const now = new Date();
		const times = payload.hourly?.time || [];
		const findIndexForNow = () => {
			for (let i = 0; i < times.length; i++) {
				const t = new Date(times[i]);
				if (
					t.getHours() === now.getHours() &&
					t.getDate() === now.getDate() &&
					t.getMonth() === now.getMonth() &&
					t.getFullYear() === now.getFullYear()
				) {
					return i;
				}
			}
			return times.length - 1;
		};

		const idx = findIndexForNow();
		const used = payload.hourly || {};
		const safeGet = (obj, key) => (obj && Array.isArray(obj[key]) ? obj[key][idx] : null);

		return {
			temperature_2m: safeGet(used, "temperature_2m") ?? Math.round(payload.current_weather?.temperature ?? null),
			apparent_temperature: safeGet(used, "apparent_temperature") ?? null,
			relative_humidity_2m: safeGet(used, "relativehumidity_2m") ?? safeGet(used, "relative_humidity_2m") ?? null,
			wind_speed_10m:
				safeGet(used, "windspeed_10m") ??
				safeGet(used, "wind_speed_10m") ??
				Math.round(payload.current_weather?.windspeed ?? null),
			precipitation: safeGet(used, "precipitation") ?? 0,
			precipitation_probability: safeGet(used, "precipitation_probability") ?? null,
			weather_code: safeGet(used, "weathercode") ?? payload.current_weather?.weathercode ?? null,
		};
	};

	// Attach a `current` property for backward compatibility with `renderWeatherOpenMeteo`.
	if (json && !json.current && (json.hourly || json.current_weather)) {
		json.current = mapToCurrent(json);
	}

	return json;
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
		99: "Thunderstorm with heavy hail",
	};
	return descriptions[weatherCode] || "Unknown";
}

function renderWeatherOpenMeteo(data) {
	if (!data || !data.current) {
		throw new Error("Incomplete weather payload");
	}

	const current = data.current;
	const safeNum = (v) => {
		if (v === null || v === undefined) return null;
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	};

	const temp = safeNum(current.temperature_2m) ?? safeNum(current.temperature) ?? null;
	const feelsLike = safeNum(current.apparent_temperature) ?? null;
	const humidity = safeNum(current.relative_humidity_2m ?? current.relativehumidity_2m) ?? null;
	// Open-Meteo reports wind in m/s; convert to km/h. If value looks like
	// it's already in km/h (> 50), don't multiply.
	let windSpeed = current.wind_speed_10m ?? current.windspeed_10m ?? 0;
	let windKmh = 0;
	if (windSpeed) {
		windSpeed = Number(windSpeed);
		if (windSpeed > 50) {
			// Probably already km/h
			windKmh = Math.round(windSpeed);
		} else {
			// Convert m/s to km/h
			windKmh = Math.round(windSpeed * 3.6);
		}
	}
	const precipitation = current.precipitation ?? 0;
	const weatherCode = current.weather_code ?? current.weathercode ?? null;
	const description = getWeatherDescription(weatherCode);

	// Get precipitation probability from hourly data (current hour)
	let precipProb = null;
	if (data.hourly?.precipitation_probability?.length > 0) {
		const now = new Date();
		const currentHourIndex = data.hourly.time.findIndex((t) => {
			const hourTime = new Date(t);
			return hourTime.getHours() === now.getHours() && hourTime.getDate() === now.getDate();
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
		weatherEls.temp.textContent = temp !== null ? `${Math.round(temp)}°C` : `--°`;
	}

	if (weatherEls.desc) {
		weatherEls.desc.textContent = description;
	}

	if (weatherEls.extra) {
		const detailParts = [];
		if (feelsLike !== null) {
			detailParts.push(`Feels like ${Math.round(feelsLike)}°`);
		}
		if (humidity !== null) {
			detailParts.push(`Humidity ${Math.round(humidity)}%`);
		}
		detailParts.push(`Wind ${windKmh} km/h`);
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

function initPixelSafety() {
	const clock = document.querySelector(".clock");
	const weather = document.querySelector(".weather");
	const fsBtn = document.querySelector(".fullscreen-btn");
	const content = document.querySelector(".content");

	if (!clock || !weather || !fsBtn) return;

	let corner = 0; // 0: TR, 1: BR, 2: BL, 3: TL
	let swapSide = false; // false: normal (clock left), true: reversed (clock right)

	[clock, weather, fsBtn].forEach((el) => {
		if (el) {
			el.classList.add("floating-animated");
		}
	});

	const resetStyles = (el) => {
		el.style.position = "";
		el.style.top = "";
		el.style.bottom = "";
		el.style.left = "";
		el.style.right = "";
		el.style.width = "";
		el.style.transform = "";
		el.style.transformOrigin = "";
		el.style.zIndex = "";
		el.style.overflow = "";
	};

	const runCycle = () => {
		// 1. Cycle Corners
		corner = (corner + 1) % 4;

		// 2. Determine Layout Mode
		// Even corners (0:TR, 2:BL) -> Normal Layout (Clock Center, Weather BR)
		// Odd corners (1:BR, 3:TL) -> Swapped Layout (Weather Center, Clock moves)
		const isSwapped = corner % 2 !== 0;

		resetStyles(clock);
		resetStyles(weather);
		resetStyles(fsBtn);

		if (isSwapped) {
			// Enter swap mode: center both clock and weather side-by-side
			if (content) content.classList.add('swap-mode');

			// Make both flow items and prepare them for a horizontal swap animation
			weather.style.position = "static";
			weather.style.width = ""; // allow natural width in flex

			clock.style.position = "static";
			clock.style.width = "";

			// Add swap-transition class for smooth transform/margin changes
			weather.classList.add('swap-transition');
			clock.classList.add('swap-transition');

			// Prepare a small horizontal slide, then toggle order to produce a smooth swap
			const slidePxClassRight = 'swap-slide-right';
			const slidePxClassLeft = 'swap-slide-left';

			// Decide next side and animate
			const nextSide = !swapSide;
			// apply initial small offsets in opposite direction so clearing them animates movement
			if (nextSide) {
				// clock will move to the right, weather to the left
				clock.classList.add(slidePxClassRight);
				weather.classList.add(slidePxClassLeft);
			} else {
				clock.classList.add(slidePxClassLeft);
				weather.classList.add(slidePxClassRight);
			}

			// Force reflow then flip order and remove offset classes so they animate into place
			void clock.offsetWidth;
			setTimeout(() => {
				swapSide = nextSide;
				if (content) content.classList.toggle('swap-reverse', swapSide);
				clock.classList.remove(slidePxClassLeft, slidePxClassRight);
				weather.classList.remove(slidePxClassLeft, slidePxClassRight);
			}, 40);
		} else {
			// Exit swap mode: return to default layout (clock center, weather bottom-right)
			if (content) content.classList.remove('swap-mode');
			// ensure order is reset for next time
			swapSide = false;
			if (content) content.classList.remove('swap-reverse');
			weather.classList.remove('swap-transition');
			clock.classList.remove('swap-transition');
		}

		// Animate swap pulse
		[clock, weather].forEach((el) => {
			if (!el) return;
			el.classList.remove("swap-pulse");
			// Force reflow to restart animation
			void el.offsetWidth;
			el.classList.add("swap-pulse");
		});

		// 3. Position Fullscreen Button
		fsBtn.style.position = "fixed";
		const pad = "clamp(12px, 3vw, 24px)";

		switch (corner) {
			case 0: // Top-Right
					fsBtn.style.top = pad;
					fsBtn.style.right = pad;
				break;
			case 1: // Bottom-Right
					fsBtn.style.bottom = pad;
					fsBtn.style.right = pad;
				break;
			case 2: // Bottom-Left
					fsBtn.style.bottom = pad;
					fsBtn.style.left = pad;
				break;
			case 3: // Top-Left
					fsBtn.style.top = pad;
					fsBtn.style.left = pad;
				break;
		}
	};

	runCycle();
	setInterval(runCycle, MOVE_INTERVAL_MS);
	// expose for manual testing
	window.runCycle = runCycle;
}
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock is active');
    } else {
      console.warn('Wake Lock API is not supported in this browser');
    }
  } catch (err) {
    console.error('Failed to activate Wake Lock:', err);
  }
}

// Request wake lock when the app is loaded
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock === null) {
    requestWakeLock();
  } else if (document.visibilityState === 'hidden' && wakeLock !== null) {
    wakeLock.release();
    wakeLock = null;
    console.log('Wake Lock released');
  }
});

requestWakeLock();