// =============================================================================
// External Data Provider Types
// Phase 1.3 - Data Provider Abstraction Layer
// =============================================================================

/**
 * Normalized weather forecast structure.
 * All providers map their responses to this unified format.
 */
export interface WeatherForecast {
  location: {
    lat: number;
    lon: number;
    name: string;
    region?: string;
  };
  current: {
    temperature: number;       // Celsius
    feelsLike: number;         // Celsius
    humidity: number;          // percentage (0-100)
    windSpeed: number;         // km/h
    condition: string;         // human-readable, e.g. 'Heavy Rain', 'Clear', 'Cloudy'
    conditionCode: string;     // normalized code for programmatic use
    precipitation: number;     // mm
    visibility: number;        // km
    uvIndex: number;
  };
  daily: Array<{
    date: string;              // ISO date (YYYY-MM-DD)
    tempMin: number;           // Celsius
    tempMax: number;           // Celsius
    condition: string;         // human-readable
    conditionCode: string;     // normalized code
    precipitationChance: number; // 0-100 percentage
    precipitationAmount: number; // mm
    windSpeed: number;         // km/h
    humidity: number;          // percentage (0-100)
  }>;
  fetchedAt: string;           // ISO timestamp
  expiresAt: string;           // ISO timestamp
}

/**
 * Generic data provider interface.
 * All external data sources implement this base contract.
 */
export interface DataProvider<T> {
  readonly name: string;
  readonly type: string;
  fetchData(params: Record<string, any>): Promise<T>;
  isConfigured(): boolean;
}

/**
 * Weather-specific provider interface.
 * Extends DataProvider with a typed getForecast method.
 */
export interface WeatherProvider extends DataProvider<WeatherForecast> {
  type: 'weather';
  getForecast(lat: number, lon: number, days?: number): Promise<WeatherForecast>;
}

/**
 * Cache entry wrapper for any cached data.
 */
export interface CacheEntry<T> {
  data: T;
  fetchedAt: Date;
  expiresAt: Date;
}

/**
 * Normalized weather condition codes.
 * Providers map their proprietary codes to these standardized values.
 */
export type WeatherConditionCode =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'overcast'
  | 'mist'
  | 'fog'
  | 'light-rain'
  | 'moderate-rain'
  | 'heavy-rain'
  | 'thunderstorm'
  | 'light-drizzle'
  | 'drizzle'
  | 'light-snow'
  | 'moderate-snow'
  | 'heavy-snow'
  | 'sleet'
  | 'hail'
  | 'blizzard'
  | 'tornado'
  | 'tropical-storm'
  | 'hurricane'
  | 'dust'
  | 'sand'
  | 'smoke'
  | 'haze'
  | 'unknown';
