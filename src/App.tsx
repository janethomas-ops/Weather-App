import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronRight,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Compass,
  Copy,
  Download,
  Droplets,
  Heart,
  HelpCircle,
  Info,
  MapPin,
  Moon,
  RefreshCw,
  Search,
  Shirt,
  Snowflake,
  Sparkles,
  Sun,
  Thermometer,
  TrendingUp,
  Wind,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { GeocodingResult, WeatherData, WeatherRecommendation, ChartDataPoint } from "./types";
import { generateLocalRecommendation, getWeatherCodeDetails } from "./utils";

const PRESET_CITIES = [
  { name: "New York", country: "United States", lat: 40.7128, lon: -74.006 },
  { name: "London", country: "United Kingdom", lat: 51.5074, lon: -0.1278 },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503 },
  { name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093 },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
];

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [recommendation, setRecommendation] = useState<WeatherRecommendation | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [unit, setUnit] = useState<"C" | "F">("C");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [chartType, setChartType] = useState<"temperature" | "precipitation">("temperature");

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const defaultCity = PRESET_CITIES[1];
    void fetchWeather(defaultCity.lat, defaultCity.lon, `London, ${defaultCity.country}`);
  }, []);

  const handleSearchChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=5&language=en&format=json`
      );
      if (!response.ok) throw new Error("Failed to search locations");
      const data = await response.json();
      setSearchResults(data.results ?? []);
      setShowDropdown((data.results?.length ?? 0) > 0);
    } catch (error) {
      console.error(error);
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setIsSearching(false);
    }
  };

  const formatTemp = (celsius: number) => {
    if (unit === "F") {
      return `${Math.round((celsius * 9) / 5 + 32)}°F`;
    }
    return `${Math.round(celsius)}°C`;
  };

  const fetchWeather = async (lat: number, lon: number, cityName: string) => {
    setIsLoadingWeather(true);
    setWeatherError(null);
    setShowDropdown(false);
    setSelectedDayIndex(0);

    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability,precipitation_sum&timezone=auto`
      );
      if (!response.ok) throw new Error("Failed to load forecast data from Open-Meteo.");

      const data = await response.json();
      if (!data.current || !data.daily) {
        throw new Error("Weather forecast format returned from Open-Meteo is invalid.");
      }

      const parsedWeatherData: WeatherData = {
        city: cityName,
        latitude: lat,
        longitude: lon,
        current: {
          temp: data.current.temperature_2m,
          feelsLike: data.current.apparent_temperature,
          humidity: data.current.relative_humidity_2m,
          windSpeed: data.current.wind_speed_10m,
          weatherCode: data.current.weather_code,
          precipitation: data.current.precipitation,
          isDay: data.current.is_day === 1,
          time: data.current.time,
        },
        daily: {
          dates: data.daily.time,
          tempMax: data.daily.temperature_2m_max,
          tempMin: data.daily.temperature_2m_min,
          weatherCode: data.daily.weather_code,
          precipitationProbability: data.daily.precipitation_probability,
          precipitationSum: data.daily.precipitation_sum,
        },
      };

      setWeatherData(parsedWeatherData);
      void fetchAIRecommendation(parsedWeatherData);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred while fetching the weather forecast.";
      setWeatherError(message);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const fetchAIRecommendation = async (data: WeatherData) => {
    setIsLoadingAI(true);
    try {
      const response = await fetch("/api/weather/recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: data.current, daily: data.daily, city: data.city }),
      });

      if (!response.ok) throw new Error("AI service temporarily unavailable.");
      const aiData = await response.json();
      if (aiData.error) throw new Error(aiData.error);
      setRecommendation(aiData);
    } catch (error) {
      console.warn("AI recommendation failed, using local planner fallback.", error);
      setRecommendation(generateLocalRecommendation(data));
    } finally {
      setIsLoadingAI(false);
    }
  };

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!weatherData) return [];
    return weatherData.daily.dates.map((dateStr, index) => {
      const date = new Date(dateStr);
      return {
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        date: dateStr,
        tempMax: weatherData.daily.tempMax[index],
        tempMin: weatherData.daily.tempMin[index],
        rainProbability: weatherData.daily.precipitationProbability[index],
        rainSum: weatherData.daily.precipitationSum[index],
        weatherCode: weatherData.daily.weatherCode[index],
      };
    });
  }, [weatherData]);

  const currentDetails = weatherData ? getWeatherCodeDetails(weatherData.current.weatherCode, weatherData.current.isDay) : null;
  const selectedDay = weatherData ? chartData[selectedDayIndex] : null;

  const copyRecommendationToClipboard = () => {
    if (!recommendation) return;
    const text = `Weather Intelligence Report for ${weatherData?.city || "Location"}:\nSummary: ${recommendation.summary}\nClothing Advice:\n- Top: ${recommendation.clothing.top}\n- Bottom: ${recommendation.clothing.bottom}\n- Footwear: ${recommendation.clothing.footwear}\n- Gear: ${recommendation.clothing.accessories.join(", ")}\nBest Outdoor Time: ${recommendation.scheduleOptimization.bestTimeForOutdoors}\nOutdoor Suitability: ${recommendation.outdoorSuitability.status} (${recommendation.outdoorSuitability.reason})`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const downloadReport = () => {
    if (!weatherData) return;
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(weatherData, null, 2))}`;
    const anchor = document.createElement("a");
    anchor.setAttribute("href", dataStr);
    anchor.setAttribute("download", `weather_intelligence_${weatherData.city.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const renderWeatherIcon = (code: number, className = "h-6 w-6") => {
    const details = getWeatherCodeDetails(code);
    switch (details.icon) {
      case "Sun":
        return <Sun className={`${className} text-amber-500`} />;
      case "Moon":
        return <Moon className={`${className} text-indigo-400`} />;
      case "Cloud":
        return <Cloud className={`${className} text-slate-400`} />;
      case "CloudSun":
        return <CloudSun className={`${className} text-sky-400`} />;
      case "CloudFog":
        return <CloudFog className={`${className} text-zinc-400`} />;
      case "CloudDrizzle":
        return <CloudDrizzle className={`${className} text-teal-400`} />;
      case "CloudRain":
        return <CloudRain className={`${className} text-blue-400`} />;
      case "CloudSnow":
      case "Snowflake":
        return <Snowflake className={`${className} text-cyan-300`} />;
      case "CloudRainWind":
        return <CloudRainWind className={`${className} text-indigo-400`} />;
      case "CloudLightning":
        return <CloudLightning className={`${className} text-yellow-400`} />;
      default:
        return <Cloud className={`${className} text-slate-400`} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="rounded-3xl border border-slate-900 bg-slate-950/80 p-4 shadow-2xl shadow-black/20 backdrop-blur xl:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">AtmosIntel</h1>
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Weather Intelligence</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:min-w-[420px] lg:items-end">
              <div ref={dropdownRef} className="relative w-full">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-3 h-5 w-5 text-slate-500" />
                  <input
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    className="w-full rounded-full border border-slate-800 bg-slate-900 py-3 pl-12 pr-12 text-sm text-slate-200 outline-none ring-0 transition focus:border-sky-500"
                    placeholder="Search global cities..."
                  />
                  {isSearching ? <RefreshCw className="absolute right-4 top-3 h-4 w-4 animate-spin text-sky-400" /> : null}
                </div>

                {showDropdown ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/60">
                    {searchResults.map((city) => (
                      <button
                        key={city.id}
                        className="flex w-full flex-col items-start px-4 py-3 text-left transition hover:bg-slate-800"
                        onClick={() => {
                          const fullName = `${city.name}${city.admin1 ? `, ${city.admin1}` : ""}, ${city.country || ""}`;
                          setSearchQuery(city.name);
                          void fetchWeather(city.latitude, city.longitude, fullName);
                        }}
                      >
                        <span className="text-sm font-semibold text-slate-100">{city.name}</span>
                        <span className="text-xs text-slate-500">
                          {city.admin1 ? `${city.admin1}, ` : ""}
                          {city.country}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setUnit("C")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${unit === "C" ? "bg-sky-500 text-white" : "bg-slate-900 text-slate-400"}`}
                >
                  °C
                </button>
                <button
                  onClick={() => setUnit("F")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${unit === "F" ? "bg-sky-500 text-white" : "bg-slate-900 text-slate-400"}`}
                >
                  °F
                </button>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                  Live weather feed
                </span>
              </div>
            </div>
          </div>
        </header>

        {weatherError ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" />
              {weatherError}
            </div>
          </div>
        ) : null}

        {weatherData ? (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-3xl border border-slate-900 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl shadow-black/20">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-500">Current conditions</p>
                  <h2 className="mt-2 text-3xl font-black text-white">{weatherData.city}</h2>
                  <p className="mt-2 text-sm text-slate-400">{weatherData.current.time}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-sky-400" />
                    {weatherData.latitude.toFixed(2)}, {weatherData.longitude.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
                  <div className="flex items-center gap-3">
                    {currentDetails ? renderWeatherIcon(weatherData.current.weatherCode, "h-10 w-10") : <Cloud className="h-10 w-10 text-slate-400" />} 
                    <div>
                      <p className="text-sm text-slate-400">{currentDetails?.label ?? "Weather"}</p>
                      <p className="text-5xl font-black tracking-tight text-white">{formatTemp(weatherData.current.temp)}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-300">
                    <div className="rounded-2xl bg-slate-900/80 p-3">
                      <div className="flex items-center gap-2 text-slate-400"><Thermometer className="h-4 w-4" /> Feels like</div>
                      <div className="mt-2 font-semibold">{formatTemp(weatherData.current.feelsLike)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-900/80 p-3">
                      <div className="flex items-center gap-2 text-slate-400"><Droplets className="h-4 w-4" /> Humidity</div>
                      <div className="mt-2 font-semibold">{weatherData.current.humidity}%</div>
                    </div>
                    <div className="rounded-2xl bg-slate-900/80 p-3">
                      <div className="flex items-center gap-2 text-slate-400"><Wind className="h-4 w-4" /> Wind</div>
                      <div className="mt-2 font-semibold">{weatherData.current.windSpeed} km/h</div>
                    </div>
                    <div className="rounded-2xl bg-slate-900/80 p-3">
                      <div className="flex items-center gap-2 text-slate-400"><CloudRain className="h-4 w-4" /> Rain</div>
                      <div className="mt-2 font-semibold">{weatherData.current.precipitation} mm</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Weekly outlook</p>
                      <p className="text-sm text-slate-400">Tap a day to inspect conditions.</p>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-slate-400">{chartData.length} days</div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {chartData.map((day, index) => (
                      <button
                        key={day.date}
                        onClick={() => setSelectedDayIndex(index)}
                        className={`flex items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${selectedDayIndex === index ? "border-sky-500/40 bg-slate-900" : "border-slate-800 bg-slate-900/60"}`}
                      >
                        <div>
                          <div className="text-sm font-semibold text-white">{day.day}</div>
                          <div className="text-xs text-slate-500">{day.date}</div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          {renderWeatherIcon(day.weatherCode, "h-4 w-4")}
                          <span>{formatTemp(day.tempMax)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <aside className="flex flex-col gap-6">
              <section className="rounded-3xl border border-slate-900 bg-slate-950/80 p-6 shadow-2xl shadow-black/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">AI planning summary</p>
                    <p className="text-sm text-slate-500">Personalized recommendations</p>
                  </div>
                  <div className="rounded-full bg-sky-500/10 p-2 text-sky-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>

                {isLoadingAI ? (
                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
                    Generating your plan...
                  </div>
                ) : recommendation ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                      <p className="text-sm text-slate-300">{recommendation.summary}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Shirt className="h-4 w-4 text-sky-400" /> Clothing
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <div><span className="text-slate-500">Top:</span> {recommendation.clothing.top}</div>
                        <div><span className="text-slate-500">Bottom:</span> {recommendation.clothing.bottom}</div>
                        <div><span className="text-slate-500">Footwear:</span> {recommendation.clothing.footwear}</div>
                        <div><span className="text-slate-500">Gear:</span> {recommendation.clothing.accessories.join(", ")}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={copyRecommendationToClipboard} className="flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800">
                        {copied ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy summary"}
                      </button>
                      <button onClick={downloadReport} className="flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800">
                        <Download className="h-4 w-4" /> Export JSON
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-3xl border border-slate-900 bg-slate-950/80 p-6 shadow-2xl shadow-black/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Compass className="h-4 w-4 text-sky-400" /> Daily planner
                </div>
                {recommendation ? (
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="flex items-center gap-2 text-slate-400"><Calendar className="h-4 w-4" /> Best outdoor time</div>
                      <div className="mt-2">{recommendation.scheduleOptimization.bestTimeForOutdoors}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="flex items-center gap-2 text-slate-400"><Heart className="h-4 w-4" /> Health advice</div>
                      <ul className="mt-2 space-y-1">
                        {recommendation.healthAdvice.map((tip) => (
                          <li key={tip} className="flex items-start gap-2">
                            <ChevronRight className="mt-0.5 h-4 w-4 text-sky-400" /> {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </section>
            </aside>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-900 bg-slate-950/80 p-10 text-center text-slate-400">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900">
              <RefreshCw className="h-6 w-6 animate-spin text-sky-400" />
            </div>
            <p className="mt-4 font-semibold text-slate-200">Loading forecast…</p>
            <p className="mt-2 text-sm">The latest weather intelligence is being prepared.</p>
          </div>
        )}

        {weatherData ? (
          <section className="rounded-3xl border border-slate-900 bg-slate-950/80 p-6 shadow-2xl shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Forecast trend</p>
                <p className="text-sm text-slate-500">Temperature and precipitation outlook</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setChartType("temperature")} className={`rounded-full px-3 py-1.5 text-sm ${chartType === "temperature" ? "bg-sky-500 text-white" : "bg-slate-900 text-slate-400"}`}>Temperature</button>
                <button onClick={() => setChartType("precipitation")} className={`rounded-full px-3 py-1.5 text-sm ${chartType === "precipitation" ? "bg-sky-500 text-white" : "bg-slate-900 text-slate-400"}`}>Precipitation</button>
              </div>
            </div>

            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke="#64748b" tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey={chartType === "temperature" ? "tempMax" : "rainProbability"} stroke="#38bdf8" fill="url(#tempGradient)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
