export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  country?: string;
  admin1?: string;
  country_code?: string;
}

export interface CurrentWeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  precipitation: number;
  isDay: boolean;
  time: string;
}

export interface DailyForecastData {
  dates: string[];
  tempMax: number[];
  tempMin: number[];
  weatherCode: number[];
  precipitationProbability: number[];
  precipitationSum: number[];
}

export interface WeatherData {
  city: string;
  latitude: number;
  longitude: number;
  current: CurrentWeatherData;
  daily: DailyForecastData;
}

export interface ClothingRecommendation {
  top: string;
  bottom: string;
  footwear: string;
  accessories: string[];
}

export interface OutdoorSuitability {
  status: string; // "Excellent", "Good", "Moderate", "Poor"
  reason: string;
  activities: string[];
}

export interface ScheduleOptimization {
  bestTimeForOutdoors: string;
  precautions: string[];
}

export interface WeatherRecommendation {
  clothing: ClothingRecommendation;
  outdoorSuitability: OutdoorSuitability;
  scheduleOptimization: ScheduleOptimization;
  healthAdvice: string[];
  summary: string;
}

export interface ChartDataPoint {
  day: string;
  date: string;
  tempMax: number;
  tempMin: number;
  rainProbability: number;
  rainSum: number;
  weatherCode: number;
}
