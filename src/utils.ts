import { WeatherRecommendation, WeatherData } from "./types";

export interface WeatherCodeDetails {
  label: string;
  icon: string; // Lucide icon name matching
  bgClass: string;
  textClass: string;
}

export function getWeatherCodeDetails(code: number, isDay: boolean = true): WeatherCodeDetails {
  switch (code) {
    case 0:
      return {
        label: "Clear Sky",
        icon: isDay ? "Sun" : "Moon",
        bgClass: isDay ? "from-amber-50 to-orange-100" : "from-slate-900 to-indigo-950",
        textClass: isDay ? "text-amber-600" : "text-indigo-300",
      };
    case 1:
    case 2:
    case 3:
      return {
        label: code === 1 ? "Mainly Clear" : code === 2 ? "Partly Cloudy" : "Overcast",
        icon: code === 1 ? "CloudSun" : "Cloud",
        bgClass: isDay ? "from-sky-50 to-blue-100" : "from-slate-800 to-slate-900",
        textClass: isDay ? "text-blue-500" : "text-slate-300",
      };
    case 45:
    case 48:
      return {
        label: "Foggy",
        icon: "CloudFog",
        bgClass: "from-zinc-100 to-zinc-200",
        textClass: "text-zinc-500",
      };
    case 51:
    case 53:
    case 55:
      return {
        label: "Drizzle",
        icon: "CloudDrizzle",
        bgClass: "from-teal-50 to-teal-100",
        textClass: "text-teal-600",
      };
    case 56:
    case 57:
      return {
        label: "Freezing Drizzle",
        icon: "CloudSnow",
        bgClass: "from-cyan-50 to-blue-150",
        textClass: "text-cyan-600",
      };
    case 61:
    case 63:
    case 65:
      return {
        label: code === 61 ? "Light Rain" : code === 63 ? "Moderate Rain" : "Heavy Rain",
        icon: "CloudRain",
        bgClass: "from-blue-50 to-blue-200",
        textClass: "text-blue-600",
      };
    case 66:
    case 67:
      return {
        label: "Freezing Rain",
        icon: "CloudRain",
        bgClass: "from-cyan-100 to-sky-200",
        textClass: "text-cyan-700",
      };
    case 71:
    case 73:
    case 75:
      return {
        label: code === 71 ? "Light Snow" : code === 73 ? "Moderate Snow" : "Heavy Snow",
        icon: "Snowflake",
        bgClass: "from-violet-50 to-violet-100",
        textClass: "text-violet-600",
      };
    case 77:
      return {
        label: "Snow Grains",
        icon: "Snowflake",
        bgClass: "from-indigo-50 to-slate-100",
        textClass: "text-indigo-600",
      };
    case 80:
    case 81:
    case 82:
      return {
        label: "Rain Showers",
        icon: "CloudRainWind",
        bgClass: "from-sky-100 to-blue-250",
        textClass: "text-sky-700",
      };
    case 85:
    case 86:
      return {
        label: "Snow Showers",
        icon: "CloudSnow",
        bgClass: "from-slate-100 to-blue-100",
        textClass: "text-slate-600",
      };
    case 95:
    case 96:
    case 99:
      return {
        label: "Thunderstorm",
        icon: "CloudLightning",
        bgClass: "from-purple-100 to-indigo-200",
        textClass: "text-purple-700",
      };
    default:
      return {
        label: "Unknown Weather",
        icon: "Cloud",
        bgClass: "from-gray-50 to-gray-100",
        textClass: "text-gray-600",
      };
  }
}

// Fallback algorithm that designs highly precise weather daily planners
export function generateLocalRecommendation(data: WeatherData): WeatherRecommendation {
  const currentTemp = data.current.temp;
  const currentCode = data.current.weatherCode;
  const isRainy = currentCode >= 51 && currentCode <= 67 || currentCode >= 80 && currentCode <= 82 || currentCode >= 95;
  const isSnowy = currentCode >= 71 && currentCode <= 77 || currentCode >= 85 && currentCode <= 86;
  const isWindy = data.current.windSpeed > 25;

  // 1. Clothing
  let top = "Lightweight cotton t-shirt";
  let bottom = "Breathable shorts or light chinos";
  let footwear = "Comfortable walking sneakers";
  const accessories: string[] = [];

  if (currentTemp >= 28) {
    top = "Breathable linen shirt or t-shirt";
    bottom = "Lightweight shorts or athletic wear";
    footwear = "Sandals or ultra-lightweight mesh shoes";
    accessories.push("UV-blocking sunglasses", "Wide-brimmed sun hat");
  } else if (currentTemp >= 18) {
    top = "Comfortable t-shirt or polo shirt";
    bottom = "Lightweight jeans, chinos, or skirts";
    footwear = "Casual sneakers or loafers";
    accessories.push("Light sunglasses");
  } else if (currentTemp >= 10) {
    top = "Long-sleeve shirt with a light sweater or denim jacket";
    bottom = "Jeans or trousers";
    footwear = "Standard sneakers or leather boots";
    accessories.push("Light jacket or windbreaker");
  } else if (currentTemp >= 0) {
    top = "Warm wool sweater layered under a thick winter coat";
    bottom = "Warm corduroy pants or thermal-lined jeans";
    footwear = "Insulated waterproof winter boots";
    accessories.push("Thermal knit beanie", "Wind-resistant winter gloves", "Warm scarf");
  } else {
    top = "Double-layered thermals under a heavy insulated down parka";
    bottom = "Fleece-lined pants or snow trousers over thermals";
    footwear = "Heavy insulated snow boots with wool socks";
    accessories.push("Thick wool beanie", "Thermal gloves", "Fleece neck gaiter", "Hand warmers");
  }

  if (isRainy) {
    accessories.push("Compact windproof umbrella", "Waterproof rain shell");
    footwear = currentTemp > 15 ? "Water-resistant sneakers" : "Waterproof rain boots";
  }
  if (isSnowy) {
    accessories.push("Moisture-wicking snow gloves");
  }

  // 2. Outdoor Suitability
  let status = "Excellent";
  let reason = "The current weather is highly favorable for outdoor plans and physical activities.";
  let activities = ["Outdoor jogging", "Afternoon picnic", "Cycling", "Nature walk", "Photography trail"];

  if (currentTemp >= 35) {
    status = "Poor";
    reason = "Extreme heat warning. Extended exposure increases risks of dehydration and heat exhaustion.";
    activities = ["Indoor treadmill run", "Visiting air-conditioned museums", "Swimming in shaded pools", "Board games at home"];
  } else if (isRainy) {
    status = "Poor";
    reason = "Precipitation and wet terrain present slipping risks and reduced visibility.";
    activities = ["Indoor library session", "Café study", "Home workout", "Art gallery tour", "Cinema visit"];
  } else if (isSnowy) {
    status = "Moderate";
    reason = "Snowy conditions are beautiful but present cold temperatures and slick surfaces.";
    activities = ["Snowball fight", "Skiing or sledding", "Cosy indoor fireplace reading", "Hot chocolate tasting"];
  } else if (isWindy) {
    status = "Moderate";
    reason = "Gusty winds may hamper flight-sensitive activities, cycling, or picnics.";
    activities = ["Gym cardio sessions", "Indoor climbing", "Café meeting", "Baking at home"];
  } else if (currentTemp < 5) {
    status = "Moderate";
    reason = "Chilly conditions. Great for crisp fresh-air walks but requires thorough layering.";
    activities = ["Crisp brisk walk", "Sledding or ice skating", "Indoor shopping", "Visiting local libraries"];
  }

  // 3. Schedule Optimization
  let bestTimeForOutdoors = "Between 10:00 AM and 4:00 PM for optimal warmth and sunlight.";
  const precautions: string[] = [];

  if (currentTemp >= 32) {
    bestTimeForOutdoors = "Early morning (6:00 AM - 8:30 AM) or late evening after sunset (7:30 PM).";
    precautions.push("Avoid outdoor physical labor or running during peak UV intensity (11:00 AM - 3:00 PM).");
  } else if (currentTemp <= 5) {
    bestTimeForOutdoors = "Midday (12:00 PM - 2:00 PM) when the sun provides the most warmth.";
    precautions.push("Limit consecutive outdoor hours to prevent finger and toe numbness.");
  } else {
    bestTimeForOutdoors = "Anytime during daylight hours. Early afternoon features peak comfort.";
  }

  if (isRainy) {
    precautions.push("Watch for slick walkways, pooled rainwater, and decreased vehicle braking distances.");
  }
  if (isWindy) {
    precautions.push("Secure loose patio items and avoid standing directly underneath large tree limbs or scaffolding.");
  }

  // 4. Health Advice
  const healthAdvice: string[] = [];
  if (currentTemp >= 30) {
    healthAdvice.push("Apply SPF 30+ sunscreen liberally every 2 hours.");
    healthAdvice.push("Drink at least 3 liters of water to avoid thermal dehydration.");
    healthAdvice.push("Replenish electrolytes if engaging in heavy physical exertion.");
  } else if (currentTemp <= 5) {
    healthAdvice.push("Apply moisturizing lotion to protect skin against cold windburn.");
    healthAdvice.push("Layer your clothing to trap warm air and prevent heat dissipation.");
  } else {
    healthAdvice.push("Enjoy the highly balanced weather! Stay hydrated as normal.");
  }

  if (data.current.humidity > 80 && currentTemp > 25) {
    healthAdvice.push("High humidity reduces sweat evaporation; monitor your body temperature closely.");
  }

  if (isRainy) {
    healthAdvice.push("Wear reflective or high-visibility layers when walking near traffic in low-light rain.");
  }

  // 5. Summary
  let summary = `Today's weather in ${data.city} features comfortable temperatures hovering around ${currentTemp}°C under ${getWeatherCodeDetails(currentCode).label.toLowerCase()} conditions. Ideal for a balanced work-life mix.`;
  if (isRainy) {
    summary = `A wet day is expected for ${data.city} with persistent ${getWeatherCodeDetails(currentCode).label.toLowerCase()} and temperatures around ${currentTemp}°C. Perfect for concentrating on indoor goals or having a cozy indoor relaxing evening.`;
  } else if (currentTemp >= 30) {
    summary = `A hot, high-energy day in ${data.city} with temperatures reaching ${currentTemp}°C. Keep cool, stay hydrated, and plan your high-intensity activities for cooler parts of the day.`;
  } else if (currentTemp <= 5) {
    summary = `Brace for cold conditions in ${data.city} with a temperature of ${currentTemp}°C. Bundle up fully with thermal gears if heading out, and keep warm indoors.`;
  }

  return {
    clothing: { top, bottom, footwear, accessories },
    outdoorSuitability: { status, reason, activities },
    scheduleOptimization: { bestTimeForOutdoors, precautions },
    healthAdvice,
    summary,
  };
}
