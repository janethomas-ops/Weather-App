import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  Snowflake,
  CloudRainWind,
  CloudLightning,
  Wind,
  Droplets,
  Compass,
  AlertCircle,
  Sparkles,
  Shirt,
  Calendar,
  Heart,
  Activity,
  CheckCircle,
  HelpCircle,
  MapPin,
  RefreshCw,
  Info,
  Download,
  Copy,
  ChevronRight,
  TrendingUp,
  Thermometer,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import {
  GeocodingResult,
  WeatherData,
  WeatherRecommendation,
  ChartDataPoint,
} from "./types";
import { getWeatherCodeDetails, generateLocalRecommendation } from "./utils";

// Preset cities to populate initial state or quick select
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
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [chartType, setChartType] = useState<"temperature" | "precipitation">("temperature");

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Run initial weather query for the first city (London)
  useEffect(() => {
    fetchWeather(PRESET_CITIES[1].lat, PRESET_CITIES[1].lon, "London, United Kingdom");
  }, []);

  // Handle city search autocomplete (UPDATED: Using Direct Geocoding URL)
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (val.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(val)}&count=5&language=en&format=json`
      );
      if (!response.ok) throw new Error("Failed to search locations");
      const data = await response.json();
      if (data.results) {
        setSearchResults(data.results);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  // Convert Celsius to Fahrenheit
  const formatTemp = (celsius: number) => {
    if (unit === "F") {
      return Math.round((celsius * 9) / 5 + 32) + "°F";
    }
    return Math.round(celsius) + "°C";
  };

  // Fetch full weather metrics from Open-Meteo APIs (UPDATED: Using Direct Forecast URL)
  const fetchWeather = async (lat: number, lon: number, cityName: string) => {
    setIsLoadingWeather(true);
    setWeatherError(null);
    setShowDropdown(false);
    setSelectedDayIndex(0);

    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability,precipitation_sum&timezone=auto`;
      const response = await fetch(weatherUrl);

      if (!response.ok) {
        throw new Error("Failed to load forecast data from Open-Meteo.");
      }

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
      // Immediately request recommendation
      fetchAIRecommendation(parsedWeatherData);
    } catch (err: any) {
      setWeatherError(err.message || "An unexpected error occurred while fetching the weather forecast.");
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Fetch AI powered Weather Planning Intelligence
  const fetchAIRecommendation = async (data: WeatherData) => {
    setIsLoadingAI(true);
    try {
      const response = await fetch("/api/weather/recommendation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current: data.current,
          daily: data.daily,
          city: data.city,
        }),
      });

      if (!response.ok) {
        throw new Error("AI service temporarily unavailable.");
      }

      const aiData = await response.json();
      if (aiData.error) {
        throw new Error(aiData.error);
      }
      setRecommendation(aiData);
    } catch (err) {
      console.warn("AI recommendation failed, triggering premium rule-based planner engine.", err);
      // Fallback local planner logic
      const fallback = generateLocalRecommendation(data);
      setRecommendation(fallback);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Build chart-friendly data format for Recharts
  const getChartData = (): ChartDataPoint[] => {
    if (!weatherData) return [];
    return weatherData.daily.dates.map((dateStr, idx) => {
      const date = new Date(dateStr);
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      return {
        day: dayName,
        date: dateStr,
        tempMax: weatherData.daily.tempMax[idx],
        tempMin: weatherData.daily.tempMin[idx],
        rainProbability: weatherData.daily.precipitationProbability[idx],
        rainSum: weatherData.daily.precipitationSum[idx],
        weatherCode: weatherData.daily.weatherCode[idx],
      };
    });
  };

  // Copy recommendation summary to clipboard
  const copyRecommendationToClipboard = () => {
    if (!recommendation) return;
    const text = `Weather Intelligence Report for ${weatherData?.city || "Location"}:
Summary: ${recommendation.summary}
Clothing Advice:
- Top: ${recommendation.clothing.top}
- Bottom: ${recommendation.clothing.bottom}
- Footwear: ${recommendation.clothing.footwear}
- Gear: ${recommendation.clothing.accessories.join(", ")}
Best Outdoor Time: ${recommendation.scheduleOptimization.bestTimeForOutdoors}
Outdoor Suitability: ${recommendation.outdoorSuitability.status} (${recommendation.outdoorSuitability.reason})`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export forecast to JSON report
  const downloadReport = () => {
    if (!weatherData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(weatherData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `weather_intelligence_${weatherData.city.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Map Weather Code string key to Lucide Component
  const renderWeatherIcon = (code: number, className: string = "w-6 h-6") => {
    const details = getWeatherCodeDetails(code);
    switch (details.icon) {
      case "Sun":
        return <Sun id={`icon-sun-${code}`} className={`${className} text-amber-500`} />;
      case "Moon":
        return <Moon id={`icon-moon-${code}`} className={`${className} text-indigo-400`} />;
      case "Cloud":
        return <Cloud id={`icon-cloud-${code}`} className={`${className} text-slate-400`} />;
      case "CloudSun":
        return <CloudSun id={`icon-cloudsun-${code}`} className={`${className} text-sky-400`} />;
      case "CloudFog":
        return <CloudFog id={`icon-cloudfog-${code}`} className={`${className} text-zinc-400`} />;
      case "CloudDrizzle":
        return <CloudDrizzle id={`icon-clouddrizzle-${code}`} className={`${className} text-teal-400`} />;
      case "CloudRain":
        return <CloudRain id={`icon-cloudrain-${code}`} className={`${className} text-blue-400`} />;
      case "CloudSnow":
      case "Snowflake":
        return <Snowflake id={`icon-snow-${code}`} className={`${className} text-cyan-300`} />;
      case "CloudRainWind":
        return <CloudRainWind id={`icon-rainwind-${code}`} className={`${className} text-indigo-400`} />;
      case "CloudLightning":
        return <CloudLightning id={`icon-lightning-${code}`} className={`${className} text-yellow-400`} />;
      default:
        return <Cloud id={`icon-default-${code}`} className={`${className} text-slate-400`} />;
    }
  };

  const chartData = getChartData();
  const currentDetails = weatherData ? getWeatherCodeDetails(weatherData.current.weatherCode, weatherData.current.isDay) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative selection:bg-sky-500/30 selection:text-white">
      {/* Background radial gradient decoration */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Header Bar */}
      <header className="border-b border-slate-900/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Sparkles className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              AtmosIntel <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              WEATHER INTELLIGENCE V2.4
            </p>
          </div>
        </div>

        {/* Search Engine & Suggestions */}
        <div ref={dropdownRef} className="relative w-full max-w-md z-40">
          <div className="relative">
            <input
              id="search-input"
              type="text"
              placeholder="Search global cities (e.g. Kyoto, Vancouver)..."
              className="w-full bg-slate-900 border border-slate-800 rounded-full py-2.5 px-5 pl-12 pr-10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 placeholder-slate-500 shadow-inner transition-all duration-300"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
            />
            <Search className="h-5 w-5 absolute left-4 top-2.5 text-slate-500" />
            {isSearching && (
              <RefreshCw className="h-4 w-4 absolute right-4 top-3 text-sky-400 animate-spin" />
            )}
          </div>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden z-50 divide-y divide-slate-800/60"
              >
                <div className="p-2.5 bg-slate-950/40 text-[10px] font-bold text-slate-500 tracking-widest uppercase flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" /> Matches found
                </div>
                {searchResults.map((city) => (
                  <button
                    key={city.id}
                    className="w-full text-left px-5 py-3 hover:bg-slate-800/80 transition-colors flex flex-col gap-0.5"
                    onClick={() => {
                      const fullName = `${city.name}${city.admin1 ? `, ${city.admin1}` : ""}, ${city.country || ""}`;
                      setSearchQuery(city.name);
                      fetchWeather(city.latitude, city.longitude, fullName);
                    }}
                  >
                    <span className="text-sm font-semibold text-slate-200">{city.name}</span>
                    <span className="text-xs text-slate-500">
                      {city.admin1 && `${city.admin1}, `}
                      {city.country}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Units / System Status badges */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900/90 border border-slate-800 p-0.5 rounded-full flex gap-1 shadow-inner">
            <button
              onClick={() => setUnit("C")}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                unit === "C"
                  ? "bg-sky-500 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              °C
            </button>
            <button
              onClick={() => setUnit("F")}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                unit === "F"
                  ? "bg-sky-500 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              °F
            </button>
          </div>

          <div className="px-3.5 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-2 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span >
            <span>API Online</span>
          </div>
        </div>
      </header>

      {/* Preset Cities Subbar */}
      <div className="bg-slate-950 px-6 py-2 border-b border-slate-900/60 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2 whitespace-nowrap">
          Quick Access:
        </span>
        {PRESET_CITIES.map((city) => (
          <button
            key={city.name}
            onClick={() => fetchWeather(city.lat, city.lon, `${city.name}, ${city.country}`)}
            className="px-3.5 py-1 text-xs font-medium bg-slate-900/60 border border-slate-880/80 hover:border-sky-500/30 rounded-full text-slate-300 hover:bg-slate-800 transition-all whitespace-nowrap"
          >
            {city.name}
          </button>
        ))}
      </div>

      {/* Main Viewport Container */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* Error Alert Display */}
        {weatherError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 text-red-400 shadow-lg"
          >
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-red-200">Forecast Fetch Failure</h4>
              <p className="text-sm text-slate-300 mt-1">{weatherError}</p>
              <button
                onClick={() => fetchWeather(PRESET_CITIES[1].lat, PRESET_CITIES[1].lon, "London, United Kingdom")}
                className="mt-2 text-xs text-sky-400 hover:underline font-semibold flex items-center gap-1"
              >
                Reset to London
              </button>
            </div>
          </motion.div>
        )}

        {isLoadingWeather ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCw className="w-12 h-12 text-sky-500 animate-spin" />
            <p className="text-slate-400 font-medium text-sm tracking-wide">
              Retrieving dynamic climate intelligence and metric layers...
            </p>
          </div>
        ) : weatherData ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN (4 spans): Current Metrics Hero & Grid */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Climate Hero Card */}
              <div
                className={`relative bg-gradient-to-br ${
                  currentDetails?.bgClass || "from-sky-600 to-blue-700"
                } rounded-3xl p-8 text-white shadow-2xl shadow-sky-955/20 overflow-hidden group border border-white/5`}
              >
                {/* Background overlay icon */}
                <div className="absolute -right-8 -bottom-8 w-44 h-44 opacity-15 text-white transition-transform duration-700 group-hover:scale-110">
                  {renderWeatherIcon(weatherData.current.weatherCode, "w-full h-full")}
                </div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight flex items-center gap-1">
                        {weatherData.city.split(",")[0]}
                      </h2>
                      <p className="text-xs tracking-wider uppercase font-bold opacity-60 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {weatherData.city.split(",").slice(1).join(", ").trim() || "Global Coordinate Region"}
                      </p>
                    </div>
                    <span className="text-xs bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full font-bold uppercase tracking-widest border border-white/10">
                      Current
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-8">
                    <span className="text-7xl font-black tracking-tighter drop-shadow">
                      {formatTemp(weatherData.current.temp)}
                    </span>
                    <div className="border-l border-white/20 pl-4">
                      <p className="text-xl font-bold tracking-tight">
                        {currentDetails?.label || "Unspecified"}
                      </p>
                      <p className="text-xs opacity-75 mt-0.5">
                        Feels like {formatTemp(weatherData.current.feelsLike)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center text-xs opacity-80">
                    <span>Altitude Elevation: {weatherData.latitude.toFixed(2)}°, {weatherData.longitude.toFixed(2)}°</span>
                    <span className="font-semibold">
                      {new Date(weatherData.current.time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Climate Metric Card Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 flex flex-col justify-between shadow-lg hover:border-slate-800 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Wind Velocity
                    </span>
                    <Wind className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-3xl font-black text-white">
                      {weatherData.current.windSpeed.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">km/h</span>
                  </div>
                  <div className="w-full bg-slate-850 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div
                      className="bg-sky-500 h-full transition-all duration-500"
                      style={{ width: `${Math.min(weatherData.current.windSpeed * 2, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 flex flex-col justify-between shadow-lg hover:border-slate-800 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Relative Humidity
                    </span>
                    <Droplets className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-3xl font-black text-white">
                      {weatherData.current.humidity}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">%</span>
                  </div>
                  <div className="w-full bg-slate-850 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-500"
                      style={{ width: `${weatherData.current.humidity}%` }}
                    />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 flex flex-col justify-between shadow-lg hover:border-slate-800 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Precipitation
                    </span>
                    <CloudDrizzle className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-3xl font-black text-white">
                      {weatherData.current.precipitation.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">mm</span>
                  </div>
                  <div className="w-full bg-slate-850 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div
                      className="bg-teal-500 h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(weatherData.current.precipitation * 10, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 flex flex-col justify-between shadow-lg hover:border-slate-800 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      WMO Weather Code
                    </span>
                    <HelpCircle className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-3xl font-black text-white">
                      {weatherData.current.weatherCode}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">Class</span>
                  </div>
                  <div className="w-full bg-slate-850 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div
                      className="bg-purple-500 h-full transition-all duration-500"
                      style={{ width: `${Math.min((weatherData.current.weatherCode / 99) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Utility actions block */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex justify-between gap-2 shadow-lg">
                <button
                  onClick={downloadReport}
                  className="flex-1 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" /> Export JSON Report
                </button>
              </div>
            </div>

            {/* CENTER COLUMN (5 spans): Recommendation Engine & Data Visualizations */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Daily Planning AI Intelligence Panel */}
              <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                {isLoadingAI && (
                  <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-3">
                    <Sparkles className="w-8 h-8 text-sky-400 animate-spin" />
                    <p className="text-xs text-slate-400 font-medium">Generating Weather Intelligence plan...</p>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-200 tracking-tight text-sm">
                        Daily Planning Intelligence
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                        Cognitive Atmospheric Analysis
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={copyRecommendationToClipboard}
                      className="p-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-all"
                      title="Copy recommendation summary"
                    >
                      {copied ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {recommendation ? (
                  <div className="space-y-5">
                    {/* Atmospheric Summary Block */}
                    <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850">
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">
                        {recommendation.summary}
                      </p>
                    </div>

                    {/* Suitability Badges */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          Outdoor Run
                        </span>
                        <span
                          className={`text-xs font-black mt-1 ${
                            recommendation.outdoorSuitability.status === "Excellent" ||
                            recommendation.outdoorSuitability.status === "Good"
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}
                        >
                          {recommendation.outdoorSuitability.status}
                        </span>
                      </div>
                      <div className="text-center p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          Commute Hazard
                        </span>
                        <span className="text-xs font-black text-slate-300 mt-1">
                          {weatherData.current.precipitation > 2 ? "Moderate" : "Low"}
                        </span>
                      </div>
                      <div className="text-center p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          AI Confidence
                        </span>
                        <span className="text-xs font-black text-sky-400 mt-1">98%</span>
                      </div>
                    </div>

                    {/* Clothing intelligence */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Shirt className="w-3.5 h-3.5 text-sky-400" /> Layering & Wear Recommendation
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/30 p-3 rounded-2xl border border-slate-850/50">
                        <div>
                          <span className="text-slate-500 block font-medium">Upper Body:</span>
                          <span className="text-slate-300 font-bold">{recommendation.clothing.top}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-medium">Lower Body:</span>
                          <span className="text-slate-300 font-bold">{recommendation.clothing.bottom}</span>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-slate-850/60">
                          <span className="text-slate-500 block font-medium">Footwear suitability:</span>
                          <span className="text-slate-300 font-bold">{recommendation.clothing.footwear}</span>
                        </div>
                        {recommendation.clothing.accessories.length > 0 && (
                          <div className="col-span-2 pt-2 border-t border-slate-850/60">
                            <span className="text-slate-500 block font-medium">Accessories:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {recommendation.clothing.accessories.map((acc, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] bg-slate-800 text-slate-300 py-0.5 px-2 rounded-md font-semibold border border-slate-700/50"
                                >
                                  {acc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Daily schedule optimization */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Optimal Transit Schedule
                      </h4>
                      <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850/40">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide block">
                          Best Window for Outdoor Commuting
                        </span>
                        <p className="text-xs text-slate-300 font-bold mt-0.5">
                          {recommendation.scheduleOptimization.bestTimeForOutdoors}
                        </p>
                      </div>
                    </div>

                    {/* Direct health advice */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-rose-400" /> Thermal Health & Advisory
                      </h4>
                      <ul className="space-y-1">
                        {recommendation.healthAdvice.map((advice, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                            <span>{advice}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    <Info className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    No weather intelligence records.
                  </div>
                )}
              </div>

              {/* Data Visualization Trends */}
              <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-xl flex flex-col h-[320px]">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Meteorological Trends
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">7-Day Graphical Breakdown</p>
                  </div>
                  <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-850">
                    <button
                      onClick={() => setChartType("temperature")}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                        chartType === "temperature"
                          ? "bg-sky-500 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Temp
                    </button>
                    <button
                      onClick={() => setChartType("precipitation")}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                        chartType === "precipitation"
                          ? "bg-sky-500 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Rain %
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
                      <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        unit={chartType === "temperature" ? (unit === "C" ? "°C" : "°F") : "%"}
                        tickFormatter={(v) => {
                          if (chartType === "temperature" && unit === "F") {
                            return String(Math.round((v * 9) / 5 + 32));
                          }
                          return String(v);
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#1e293b",
                          borderRadius: "12px",
                          color: "#f8fafc",
                          fontSize: "12px",
                        }}
                        formatter={(val: any) => {
                          if (chartType === "temperature") {
                            return [formatTemp(Number(val)), "Temp"];
                          }
                          return [`${val}%`, "Precipitation Probability"];
                        }}
                      />
                      {chartType === "temperature" ? (
                        <>
                          <Area
                            type="monotone"
                            dataKey="tempMax"
                            stroke="#38bdf8"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorTemp)"
                            name="Max Temperature"
                          />
                          <Area
                            type="monotone"
                            dataKey="tempMin"
                            stroke="#64748b"
                            strokeWidth={1.5}
                            fillOpacity={0}
                            name="Min Temperature"
                          />
                        </>
                      ) : (
                        <Area
                          type="monotone"
                          dataKey="rainProbability"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorRain)"
                          name="Precipitation Probability"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (3 spans): 7-Day Interactive Extended Forecast */}
            <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
              <div className="flex justify-between items-center ml-2 mb-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Extended Forecast
                </h3>
                <span className="text-[10px] bg-slate-900 border border-slate-850 py-0.5 px-2 rounded-full text-slate-400 font-bold">
                  7 Days
                </span>
              </div>

              <div className="space-y-3">
                {weatherData.daily.dates.map((dateStr, idx) => {
                  const date = new Date(dateStr);
                  const isToday = idx === 0;
                  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
                  const dateFormatted = date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                  const isSelected = selectedDayIndex === idx;

                  return (
                    <motion.button
                      whileHover={{ x: 4 }}
                      onClick={() => setSelectedDayIndex(idx)}
                      key={dateStr}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border text-left ${
                        isSelected
                          ? "bg-slate-900 border-sky-500 shadow-md shadow-sky-500/5"
                          : "bg-slate-900 border-slate-850 hover:bg-slate-850/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-850">
                          {renderWeatherIcon(weatherData.daily.weatherCode[idx], "w-5 h-5")}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-200">
                            {dayName} {isToday && <span className="text-sky-400 text-[10px] ml-1">(Today)</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 font-semibold">{dateFormatted}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-200">
                            {formatTemp(weatherData.daily.tempMax[idx])}
                          </p>
                          <p className="text-[10px] text-slate-500 font-semibold">
                            {formatTemp(weatherData.daily.tempMin[idx])}
                          </p>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${isSelected ? "rotate-90 text-sky-400" : ""}`} />
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Dynamic day specifics detail overlay */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedDayIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-slate-900/60 border border-slate-850 rounded-2xl p-4 mt-1"
                >
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-sky-400" />
                    Focus Day Metrics: {new Date(weatherData.daily.dates[selectedDayIndex]).toLocaleDateString("en-US", { weekday: "long" })}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                    <div className="bg-slate-950/30 p-2 rounded-lg border border-slate-850/30">
                      <span className="text-[10px] text-slate-500 block font-medium">Daily Max Temp</span>
                      <span className="font-bold">{formatTemp(weatherData.daily.tempMax[selectedDayIndex])}</span>
                    </div>
                    <div className="bg-slate-950/30 p-2 rounded-lg border border-slate-850/30">
                      <span className="text-[10px] text-slate-500 block font-medium">Rain Probability</span>
                      <span className="font-bold text-sky-400">{weatherData.daily.precipitationProbability[selectedDayIndex]}%</span>
                    </div>
                    <div className="bg-slate-950/30 p-2 rounded-lg border border-slate-850/30">
                      <span className="text-[10px] text-slate-500 block font-medium">Precipitation Sum</span>
                      <span className="font-bold text-teal-400">{weatherData.daily.precipitationSum[selectedDayIndex]} mm</span>
                    </div>
                    <div className="bg-slate-950/30 p-2 rounded-lg border border-slate-850/30">
                      <span className="text-[10px] text-slate-500 block font-medium">WMO Code</span>
                      <span className="font-bold text-slate-400">{weatherData.daily.weatherCode[selectedDayIndex]}</span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-12">
            <Cloud className="w-16 h-16 text-slate-600 animate-pulse mb-4" />
            <p className="text-slate-400 font-medium">Select or search for a city to view climate intelligence models.</p>
          </div>
        )}

        {/* Global Security Alert / Weather Advisory Footer */}
        <div className="mt-8 bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col sm:flex-row items-center sm:justify-between gap-4 shadow-lg text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-300">Continuous Satellite Surveillance Sync</p>
              <p className="text-slate-500 font-semibold">Updated 5 minutes ago from live geocoding & forecast arrays</p>
            </div>
          </div>
          <span className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 font-black py-1 px-3 rounded-md">
            SYS ONLINE
          </span>
        </div>
      </main>
    </div>
  );
}