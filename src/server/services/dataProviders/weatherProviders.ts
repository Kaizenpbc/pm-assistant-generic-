// =============================================================================
// Weather Provider Implementations
// Phase 1.3 - Data Provider Abstraction Layer
// =============================================================================

import axios, { AxiosError } from 'axios';
import { config } from '../../config';
import {
  WeatherProvider,
  WeatherForecast,
  WeatherConditionCode,
} from './types';

// =============================================================================
// Helper Utilities
// =============================================================================

/**
 * Build ISO date string (YYYY-MM-DD) from a Date object.
 */
function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Build ISO timestamp string from a Date object.
 */
function toISOTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Compute cache expiry timestamp based on configured TTL.
 */
function computeExpiresAt(fetchedAt: Date): string {
  const expiresAt = new Date(fetchedAt.getTime() + config.WEATHER_CACHE_MINUTES * 60 * 1000);
  return toISOTimestamp(expiresAt);
}

// =============================================================================
// OpenWeatherMap Provider
// =============================================================================

/**
 * Maps OpenWeatherMap weather condition IDs to normalized condition codes.
 * Reference: https://openweathermap.org/weather-conditions
 */
function mapOWMConditionCode(id: number): WeatherConditionCode {
  if (id === 800) return 'clear';
  if (id === 801) return 'partly-cloudy';
  if (id === 802) return 'cloudy';
  if (id === 803 || id === 804) return 'overcast';
  if (id >= 200 && id < 300) return 'thunderstorm';
  if (id >= 300 && id < 400) return 'drizzle';
  if (id === 500) return 'light-rain';
  if (id === 501) return 'moderate-rain';
  if (id >= 502 && id < 510) return 'heavy-rain';
  if (id === 511) return 'sleet';
  if (id >= 520 && id < 532) return 'moderate-rain';
  if (id === 600) return 'light-snow';
  if (id === 601) return 'moderate-snow';
  if (id >= 602 && id < 700) return 'heavy-snow';
  if (id === 701 || id === 721) return 'mist';
  if (id === 741) return 'fog';
  if (id === 711) return 'smoke';
  if (id === 731 || id === 761) return 'dust';
  if (id === 751) return 'sand';
  if (id === 762) return 'haze';
  if (id === 771) return 'tropical-storm';
  if (id === 781) return 'tornado';
  return 'unknown';
}

/**
 * Provider adapter for the OpenWeatherMap One Call API 3.0.
 *
 * API docs: https://openweathermap.org/api/one-call-3
 * Endpoint: GET https://api.openweathermap.org/data/3.0/onecall
 */
export class OpenWeatherMapProvider implements WeatherProvider {
  readonly name = 'OpenWeatherMap';
  readonly type = 'weather' as const;
  private readonly baseUrl = 'https://api.openweathermap.org/data/3.0/onecall';
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = config.WEATHER_API_KEY;
  }

  isConfigured(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  async fetchData(params: Record<string, any>): Promise<WeatherForecast> {
    const lat = params['lat'] as number;
    const lon = params['lon'] as number;
    const days = (params['days'] as number) || 7;
    return this.getForecast(lat, lon, days);
  }

  async getForecast(lat: number, lon: number, days: number = 7): Promise<WeatherForecast> {
    if (!this.isConfigured()) {
      throw new Error(
        `[${this.name}] Provider is not configured. Set WEATHER_API_KEY in your environment.`
      );
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: 'metric',
          exclude: 'minutely,hourly,alerts',
        },
        timeout: 10000,
      });

      const data = response.data;
      const fetchedAt = new Date();

      const current = data.current;
      const currentWeather = current.weather?.[0] || {};

      const dailyForecasts = (data.daily || [])
        .slice(0, days)
        .map((day: any) => {
          const dayWeather = day.weather?.[0] || {};
          return {
            date: toISODate(new Date(day.dt * 1000)),
            tempMin: Math.round(day.temp.min * 10) / 10,
            tempMax: Math.round(day.temp.max * 10) / 10,
            condition: dayWeather.description || dayWeather.main || 'Unknown',
            conditionCode: mapOWMConditionCode(dayWeather.id || 0),
            precipitationChance: Math.round((day.pop || 0) * 100),
            precipitationAmount: Math.round(((day.rain || 0) + (day.snow || 0)) * 10) / 10,
            windSpeed: Math.round((day.wind_speed || 0) * 3.6 * 10) / 10, // m/s -> km/h
            humidity: day.humidity || 0,
          };
        });

      return {
        location: {
          lat: data.lat,
          lon: data.lon,
          name: `${data.lat.toFixed(2)}, ${data.lon.toFixed(2)}`,
          region: data.timezone || undefined,
        },
        current: {
          temperature: Math.round(current.temp * 10) / 10,
          feelsLike: Math.round(current.feels_like * 10) / 10,
          humidity: current.humidity || 0,
          windSpeed: Math.round((current.wind_speed || 0) * 3.6 * 10) / 10, // m/s -> km/h
          condition: currentWeather.description || currentWeather.main || 'Unknown',
          conditionCode: mapOWMConditionCode(currentWeather.id || 0),
          precipitation: Math.round(((current.rain?.['1h'] || 0) + (current.snow?.['1h'] || 0)) * 10) / 10,
          visibility: Math.round((current.visibility || 10000) / 100) / 10, // m -> km
          uvIndex: current.uvi || 0,
        },
        daily: dailyForecasts,
        fetchedAt: toISOTimestamp(fetchedAt),
        expiresAt: computeExpiresAt(fetchedAt),
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        throw new Error(
          `[${this.name}] API request failed (HTTP ${status || 'unknown'}): ${message}`
        );
      }
      throw new Error(
        `[${this.name}] Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// =============================================================================
// WeatherAPI.com Provider
// =============================================================================

/**
 * Maps WeatherAPI.com condition codes to normalized condition codes.
 * Reference: https://www.weatherapi.com/docs/weather_conditions.json
 */
function mapWeatherAPIConditionCode(code: number): WeatherConditionCode {
  // Clear / Sunny
  if (code === 1000) return 'clear';
  // Partly cloudy
  if (code === 1003) return 'partly-cloudy';
  // Cloudy
  if (code === 1006) return 'cloudy';
  // Overcast
  if (code === 1009) return 'overcast';
  // Mist
  if (code === 1030) return 'mist';
  // Fog / Freezing fog
  if (code === 1135 || code === 1147) return 'fog';
  // Light drizzle / freezing drizzle
  if (code === 1150 || code === 1153 || code === 1168) return 'light-drizzle';
  // Heavy freezing drizzle / drizzle
  if (code === 1171) return 'drizzle';
  // Patchy light rain / Light rain
  if (code === 1063 || code === 1180 || code === 1183) return 'light-rain';
  // Moderate rain / moderate rain at times
  if (code === 1186 || code === 1189) return 'moderate-rain';
  // Heavy rain / heavy rain at times
  if (code === 1192 || code === 1195) return 'heavy-rain';
  // Light freezing rain
  if (code === 1198) return 'light-rain';
  // Moderate/heavy freezing rain
  if (code === 1201) return 'heavy-rain';
  // Light rain shower
  if (code === 1240) return 'light-rain';
  // Moderate/heavy rain shower
  if (code === 1243) return 'heavy-rain';
  // Torrential rain shower
  if (code === 1246) return 'heavy-rain';
  // Patchy light snow / light snow
  if (code === 1066 || code === 1210 || code === 1213) return 'light-snow';
  // Patchy moderate snow / moderate snow
  if (code === 1216 || code === 1219) return 'moderate-snow';
  // Patchy heavy snow / heavy snow / blizzard
  if (code === 1222 || code === 1225) return 'heavy-snow';
  if (code === 1117) return 'blizzard';
  // Sleet
  if (code === 1069 || code === 1204 || code === 1207 || code === 1249 || code === 1252) return 'sleet';
  // Ice pellets
  if (code === 1237 || code === 1261 || code === 1264) return 'hail';
  // Thunderstorm
  if (code === 1087 || code === 1273 || code === 1276 || code === 1279 || code === 1282) return 'thunderstorm';
  // Snow showers
  if (code === 1255) return 'light-snow';
  if (code === 1258) return 'heavy-snow';

  return 'unknown';
}

/**
 * Provider adapter for WeatherAPI.com.
 *
 * API docs: https://www.weatherapi.com/docs/
 * Endpoint: GET https://api.weatherapi.com/v1/forecast.json
 */
export class WeatherAPIProvider implements WeatherProvider {
  readonly name = 'WeatherAPI';
  readonly type = 'weather' as const;
  private readonly baseUrl = 'https://api.weatherapi.com/v1/forecast.json';
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = config.WEATHER_API_KEY;
  }

  isConfigured(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  async fetchData(params: Record<string, any>): Promise<WeatherForecast> {
    const lat = params['lat'] as number;
    const lon = params['lon'] as number;
    const days = (params['days'] as number) || 7;
    return this.getForecast(lat, lon, days);
  }

  async getForecast(lat: number, lon: number, days: number = 7): Promise<WeatherForecast> {
    if (!this.isConfigured()) {
      throw new Error(
        `[${this.name}] Provider is not configured. Set WEATHER_API_KEY in your environment.`
      );
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          key: this.apiKey,
          q: `${lat},${lon}`,
          days: Math.min(days, 14), // WeatherAPI.com supports up to 14-day forecast
          aqi: 'no',
          alerts: 'no',
        },
        timeout: 10000,
      });

      const data = response.data;
      const fetchedAt = new Date();

      const current = data.current;
      const location = data.location;
      const forecastDays = data.forecast?.forecastday || [];

      const dailyForecasts = forecastDays.slice(0, days).map((day: any) => {
        const dayData = day.day;
        const conditionCode = dayData.condition?.code || 0;
        return {
          date: day.date, // WeatherAPI returns YYYY-MM-DD already
          tempMin: Math.round(dayData.mintemp_c * 10) / 10,
          tempMax: Math.round(dayData.maxtemp_c * 10) / 10,
          condition: dayData.condition?.text || 'Unknown',
          conditionCode: mapWeatherAPIConditionCode(conditionCode),
          precipitationChance: dayData.daily_chance_of_rain || 0,
          precipitationAmount: Math.round((dayData.totalprecip_mm || 0) * 10) / 10,
          windSpeed: Math.round((dayData.maxwind_kph || 0) * 10) / 10,
          humidity: dayData.avghumidity || 0,
        };
      });

      const currentConditionCode = current.condition?.code || 0;

      return {
        location: {
          lat: location.lat,
          lon: location.lon,
          name: location.name,
          region: location.region || undefined,
        },
        current: {
          temperature: Math.round(current.temp_c * 10) / 10,
          feelsLike: Math.round(current.feelslike_c * 10) / 10,
          humidity: current.humidity || 0,
          windSpeed: Math.round((current.wind_kph || 0) * 10) / 10,
          condition: current.condition?.text || 'Unknown',
          conditionCode: mapWeatherAPIConditionCode(currentConditionCode),
          precipitation: Math.round((current.precip_mm || 0) * 10) / 10,
          visibility: Math.round((current.vis_km || 10) * 10) / 10,
          uvIndex: current.uv || 0,
        },
        daily: dailyForecasts,
        fetchedAt: toISOTimestamp(fetchedAt),
        expiresAt: computeExpiresAt(fetchedAt),
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const apiError = error.response?.data?.error;
        const message = apiError?.message || error.message;
        throw new Error(
          `[${this.name}] API request failed (HTTP ${status || 'unknown'}): ${message}`
        );
      }
      throw new Error(
        `[${this.name}] Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// =============================================================================
// Mock Weather Provider
// =============================================================================

/**
 * Deterministic hash for seeding pseudo-random values.
 * Produces a number between 0 and 1 from a string seed.
 */
function seededRandom(seed: string): () => number {
  // Simple but adequate hash: djb2
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  // Use the hash as a seed for a linear congruential generator
  let state = Math.abs(hash);
  return () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Determine the climate zone based on latitude.
 * Returns 'tropical', 'temperate', or 'cold'.
 */
function getClimateZone(lat: number): 'tropical' | 'temperate' | 'cold' {
  const absLat = Math.abs(lat);
  if (absLat <= 23.5) return 'tropical';
  if (absLat <= 60) return 'temperate';
  return 'cold';
}

/**
 * Mock weather provider for development and testing.
 *
 * Generates realistic weather data adapted to the latitude-based climate zone:
 *
 * - Tropical (lat -23.5 to 23.5): 25-34 C, high humidity, wet/dry seasons
 * - Temperate (lat 23.5-60 / -23.5 to -60): 0-30 C (seasonal), 4 seasons
 * - Cold (lat > 60 / < -60): -20 to 15 C, low humidity
 *
 * Uses deterministic seeding so the same coordinates produce consistent
 * results within a cache period.
 */
export class MockWeatherProvider implements WeatherProvider {
  readonly name = 'MockWeather';
  readonly type = 'weather' as const;

  isConfigured(): boolean {
    return true;
  }

  async fetchData(params: Record<string, any>): Promise<WeatherForecast> {
    const lat = params['lat'] as number;
    const lon = params['lon'] as number;
    const days = (params['days'] as number) || 7;
    return this.getForecast(lat, lon, days);
  }

  async getForecast(lat: number, lon: number, days: number = 7): Promise<WeatherForecast> {
    const fetchedAt = new Date();
    // Seed based on coordinates and the current hour (consistent within cache window)
    const cacheWindow = Math.floor(fetchedAt.getTime() / (config.WEATHER_CACHE_MINUTES * 60 * 1000));
    const seed = `${lat.toFixed(4)}_${lon.toFixed(4)}_${cacheWindow}`;
    const rng = seededRandom(seed);

    const now = new Date();
    const month = now.getMonth(); // 0-indexed
    const climate = getClimateZone(lat);

    // Southern hemisphere has inverted seasons
    const isSouthernHemisphere = lat < 0;

    // Determine season characteristics based on climate zone
    const { baseTemp, tempVariation, baseHumidity, baseWindSpeed, basePrecipChance, isWetSeason } =
      this.getClimateParams(climate, month, isSouthernHemisphere, rng);

    const locationName = `Location ${lat.toFixed(2)}, ${lon.toFixed(2)}`;

    // Pick current condition based on climate and randomness
    const currentCondition = this.pickCondition(rng(), climate, isWetSeason);

    const currentTemp = Math.round((baseTemp + (rng() - 0.5) * tempVariation) * 10) / 10;
    const feelsLikeOffset = climate === 'tropical'
      ? 1 + rng() * 3    // heat index: feels warmer in tropics
      : climate === 'cold'
        ? -(2 + rng() * 4) // wind chill: feels colder in cold climates
        : (rng() - 0.5) * 4; // variable in temperate
    const currentFeelsLike = Math.round((currentTemp + feelsLikeOffset) * 10) / 10;

    const currentPrecip = currentCondition.code === 'clear' || currentCondition.code === 'partly-cloudy'
      ? 0
      : Math.round(rng() * (isWetSeason ? 15 : 5) * 10) / 10;

    const dailyForecasts = [];
    for (let i = 0; i < Math.min(days, 14); i++) {
      const dayDate = new Date(now);
      dayDate.setDate(dayDate.getDate() + i);

      // Each day gets its own slight variation
      const dayRng = seededRandom(`${seed}_day${i}`);
      const dayCondition = this.pickCondition(dayRng(), climate, isWetSeason);
      const dayTempMin = Math.round((baseTemp - tempVariation / 2 + (dayRng() - 0.5) * 2) * 10) / 10;
      const dayTempMax = Math.round((dayTempMin + tempVariation + dayRng() * 2) * 10) / 10;
      const dayPrecipChance = Math.min(100, Math.max(0, Math.round(basePrecipChance + (dayRng() - 0.5) * 30)));
      const dayPrecipAmount = dayPrecipChance > 40
        ? Math.round(dayRng() * (isWetSeason ? 25 : 10) * 10) / 10
        : Math.round(dayRng() * 2 * 10) / 10;
      const dayWindSpeed = Math.round((baseWindSpeed + (dayRng() - 0.5) * 8) * 10) / 10;
      const dayHumidity = Math.min(100, Math.max(
        climate === 'cold' ? 20 : 40,
        Math.round(baseHumidity + (dayRng() - 0.5) * 15)
      ));

      dailyForecasts.push({
        date: toISODate(dayDate),
        tempMin: dayTempMin,
        tempMax: dayTempMax,
        condition: dayCondition.label,
        conditionCode: dayCondition.code,
        precipitationChance: dayPrecipChance,
        precipitationAmount: dayPrecipAmount,
        windSpeed: Math.max(0, dayWindSpeed),
        humidity: dayHumidity,
      });
    }

    return {
      location: {
        lat,
        lon,
        name: locationName,
        region: undefined,
      },
      current: {
        temperature: currentTemp,
        feelsLike: currentFeelsLike,
        humidity: Math.round(baseHumidity),
        windSpeed: Math.round(baseWindSpeed * 10) / 10,
        condition: currentCondition.label,
        conditionCode: currentCondition.code,
        precipitation: currentPrecip,
        visibility: currentCondition.code === 'fog' || currentCondition.code === 'heavy-rain'
          ? Math.round((2 + rng() * 4) * 10) / 10
          : currentCondition.code === 'heavy-snow' || currentCondition.code === 'blizzard'
            ? Math.round((1 + rng() * 3) * 10) / 10
            : Math.round((8 + rng() * 7) * 10) / 10,
        uvIndex: currentCondition.code === 'clear'
          ? climate === 'tropical'
            ? Math.round((8 + rng() * 4) * 10) / 10
            : Math.round((5 + rng() * 4) * 10) / 10
          : Math.round((2 + rng() * 4) * 10) / 10,
      },
      daily: dailyForecasts,
      fetchedAt: toISOTimestamp(fetchedAt),
      expiresAt: computeExpiresAt(fetchedAt),
    };
  }

  /**
   * Get climate parameters based on zone, month, and hemisphere.
   */
  private getClimateParams(
    climate: 'tropical' | 'temperate' | 'cold',
    month: number,
    isSouthernHemisphere: boolean,
    rng: () => number
  ): {
    baseTemp: number;
    tempVariation: number;
    baseHumidity: number;
    baseWindSpeed: number;
    basePrecipChance: number;
    isWetSeason: boolean;
  } {
    // Adjust month for southern hemisphere (invert seasons)
    const effectiveMonth = isSouthernHemisphere ? (month + 6) % 12 : month;

    switch (climate) {
      case 'tropical': {
        // Wet months: May(4)-Jul(6) and Nov(10)-Jan(0)
        const isWetSeason =
          (effectiveMonth >= 4 && effectiveMonth <= 6) || effectiveMonth >= 10 || effectiveMonth === 0;

        return {
          baseTemp: 27 + rng() * 4,                           // 27-31 C
          tempVariation: 2 + rng() * 2,                        // 2-4 C daily swing
          baseHumidity: isWetSeason ? 78 + rng() * 17 : 62 + rng() * 18, // 78-95 or 62-80
          baseWindSpeed: 5 + rng() * 15,                       // 5-20 km/h
          basePrecipChance: isWetSeason ? 50 + rng() * 40 : 10 + rng() * 30,
          isWetSeason,
        };
      }

      case 'temperate': {
        // 4 seasons: Winter(Dec-Feb), Spring(Mar-May), Summer(Jun-Aug), Autumn(Sep-Nov)
        const isWinter = effectiveMonth >= 11 || effectiveMonth <= 1;
        const isSpring = effectiveMonth >= 2 && effectiveMonth <= 4;
        const isSummer = effectiveMonth >= 5 && effectiveMonth <= 7;
        // const isAutumn = effectiveMonth >= 8 && effectiveMonth <= 10;

        let baseTemp: number;
        let baseHumidity: number;
        let basePrecipChance: number;
        let isWetSeason: boolean;

        if (isWinter) {
          baseTemp = 0 + rng() * 6;             // 0-6 C
          baseHumidity = 65 + rng() * 20;        // 65-85
          basePrecipChance = 30 + rng() * 30;    // 30-60
          isWetSeason = true;
        } else if (isSpring) {
          baseTemp = 8 + rng() * 10;            // 8-18 C
          baseHumidity = 50 + rng() * 20;        // 50-70
          basePrecipChance = 25 + rng() * 30;    // 25-55
          isWetSeason = false;
        } else if (isSummer) {
          baseTemp = 20 + rng() * 10;           // 20-30 C
          baseHumidity = 45 + rng() * 25;        // 45-70
          basePrecipChance = 15 + rng() * 25;    // 15-40
          isWetSeason = false;
        } else {
          // Autumn
          baseTemp = 8 + rng() * 10;            // 8-18 C
          baseHumidity = 55 + rng() * 25;        // 55-80
          basePrecipChance = 30 + rng() * 30;    // 30-60
          isWetSeason = true;
        }

        return {
          baseTemp,
          tempVariation: 4 + rng() * 6,         // 4-10 C daily swing
          baseHumidity,
          baseWindSpeed: 8 + rng() * 20,         // 8-28 km/h
          basePrecipChance,
          isWetSeason,
        };
      }

      case 'cold': {
        // Cold climate: long winters, short cool summers
        const isWinter = effectiveMonth >= 10 || effectiveMonth <= 3;
        const isSummer = effectiveMonth >= 5 && effectiveMonth <= 7;
        const isWetSeason = isWinter;

        let baseTemp: number;
        if (isWinter) {
          baseTemp = -20 + rng() * 10;          // -20 to -10 C
        } else if (isSummer) {
          baseTemp = 5 + rng() * 10;            // 5-15 C
        } else {
          // Transition months
          baseTemp = -5 + rng() * 10;           // -5 to 5 C
        }

        return {
          baseTemp,
          tempVariation: 3 + rng() * 5,         // 3-8 C daily swing
          baseHumidity: 30 + rng() * 25,         // 30-55
          baseWindSpeed: 10 + rng() * 25,        // 10-35 km/h
          basePrecipChance: isWinter ? 25 + rng() * 30 : 15 + rng() * 25,
          isWetSeason,
        };
      }
    }
  }

  /**
   * Pick a weather condition weighted by climate zone and season.
   */
  private pickCondition(
    roll: number,
    climate: 'tropical' | 'temperate' | 'cold',
    isWetSeason: boolean
  ): { label: string; code: WeatherConditionCode } {
    switch (climate) {
      case 'tropical':
        return this.pickTropicalCondition(roll, isWetSeason);
      case 'temperate':
        return this.pickTemperateCondition(roll, isWetSeason);
      case 'cold':
        return this.pickColdCondition(roll, isWetSeason);
    }
  }

  /**
   * Tropical conditions: rain-heavy in wet season, clear in dry season.
   */
  private pickTropicalCondition(
    roll: number,
    isWetSeason: boolean
  ): { label: string; code: WeatherConditionCode } {
    if (isWetSeason) {
      if (roll < 0.10) return { label: 'Clear', code: 'clear' };
      if (roll < 0.22) return { label: 'Partly Cloudy', code: 'partly-cloudy' };
      if (roll < 0.32) return { label: 'Cloudy', code: 'cloudy' };
      if (roll < 0.40) return { label: 'Overcast', code: 'overcast' };
      if (roll < 0.50) return { label: 'Light Rain', code: 'light-rain' };
      if (roll < 0.65) return { label: 'Moderate Rain', code: 'moderate-rain' };
      if (roll < 0.80) return { label: 'Heavy Rain', code: 'heavy-rain' };
      if (roll < 0.90) return { label: 'Thunderstorm', code: 'thunderstorm' };
      if (roll < 0.95) return { label: 'Light Drizzle', code: 'light-drizzle' };
      return { label: 'Mist', code: 'mist' };
    } else {
      if (roll < 0.30) return { label: 'Clear', code: 'clear' };
      if (roll < 0.50) return { label: 'Partly Cloudy', code: 'partly-cloudy' };
      if (roll < 0.65) return { label: 'Cloudy', code: 'cloudy' };
      if (roll < 0.75) return { label: 'Overcast', code: 'overcast' };
      if (roll < 0.82) return { label: 'Light Rain', code: 'light-rain' };
      if (roll < 0.90) return { label: 'Moderate Rain', code: 'moderate-rain' };
      if (roll < 0.95) return { label: 'Heavy Rain', code: 'heavy-rain' };
      return { label: 'Thunderstorm', code: 'thunderstorm' };
    }
  }

  /**
   * Temperate conditions: 4-season mix including snow in winter.
   */
  private pickTemperateCondition(
    roll: number,
    isWetSeason: boolean
  ): { label: string; code: WeatherConditionCode } {
    if (isWetSeason) {
      // Winter/Autumn: overcast, rain, snow possible
      if (roll < 0.08) return { label: 'Clear', code: 'clear' };
      if (roll < 0.18) return { label: 'Partly Cloudy', code: 'partly-cloudy' };
      if (roll < 0.30) return { label: 'Cloudy', code: 'cloudy' };
      if (roll < 0.42) return { label: 'Overcast', code: 'overcast' };
      if (roll < 0.52) return { label: 'Light Rain', code: 'light-rain' };
      if (roll < 0.62) return { label: 'Moderate Rain', code: 'moderate-rain' };
      if (roll < 0.70) return { label: 'Heavy Rain', code: 'heavy-rain' };
      if (roll < 0.78) return { label: 'Light Snow', code: 'light-snow' };
      if (roll < 0.84) return { label: 'Moderate Snow', code: 'moderate-snow' };
      if (roll < 0.88) return { label: 'Sleet', code: 'sleet' };
      if (roll < 0.93) return { label: 'Fog', code: 'fog' };
      if (roll < 0.97) return { label: 'Drizzle', code: 'drizzle' };
      return { label: 'Thunderstorm', code: 'thunderstorm' };
    } else {
      // Spring/Summer: more sun, occasional rain
      if (roll < 0.25) return { label: 'Clear', code: 'clear' };
      if (roll < 0.45) return { label: 'Partly Cloudy', code: 'partly-cloudy' };
      if (roll < 0.58) return { label: 'Cloudy', code: 'cloudy' };
      if (roll < 0.68) return { label: 'Overcast', code: 'overcast' };
      if (roll < 0.78) return { label: 'Light Rain', code: 'light-rain' };
      if (roll < 0.86) return { label: 'Moderate Rain', code: 'moderate-rain' };
      if (roll < 0.92) return { label: 'Heavy Rain', code: 'heavy-rain' };
      if (roll < 0.97) return { label: 'Thunderstorm', code: 'thunderstorm' };
      return { label: 'Haze', code: 'haze' };
    }
  }

  /**
   * Cold conditions: snow-dominant, blizzards, limited clear days.
   */
  private pickColdCondition(
    roll: number,
    isWetSeason: boolean
  ): { label: string; code: WeatherConditionCode } {
    if (isWetSeason) {
      // Winter: heavy snow, blizzards, very cold
      if (roll < 0.05) return { label: 'Clear', code: 'clear' };
      if (roll < 0.12) return { label: 'Partly Cloudy', code: 'partly-cloudy' };
      if (roll < 0.22) return { label: 'Cloudy', code: 'cloudy' };
      if (roll < 0.35) return { label: 'Overcast', code: 'overcast' };
      if (roll < 0.50) return { label: 'Light Snow', code: 'light-snow' };
      if (roll < 0.65) return { label: 'Moderate Snow', code: 'moderate-snow' };
      if (roll < 0.78) return { label: 'Heavy Snow', code: 'heavy-snow' };
      if (roll < 0.88) return { label: 'Blizzard', code: 'blizzard' };
      if (roll < 0.94) return { label: 'Sleet', code: 'sleet' };
      return { label: 'Fog', code: 'fog' };
    } else {
      // Summer: cool, some rain, occasional clear
      if (roll < 0.15) return { label: 'Clear', code: 'clear' };
      if (roll < 0.30) return { label: 'Partly Cloudy', code: 'partly-cloudy' };
      if (roll < 0.45) return { label: 'Cloudy', code: 'cloudy' };
      if (roll < 0.58) return { label: 'Overcast', code: 'overcast' };
      if (roll < 0.68) return { label: 'Light Rain', code: 'light-rain' };
      if (roll < 0.78) return { label: 'Moderate Rain', code: 'moderate-rain' };
      if (roll < 0.86) return { label: 'Light Snow', code: 'light-snow' };
      if (roll < 0.93) return { label: 'Drizzle', code: 'drizzle' };
      return { label: 'Fog', code: 'fog' };
    }
  }
}
