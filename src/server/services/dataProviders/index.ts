// =============================================================================
// Data Provider Manager
// Phase 1.3 - External Data Provider Abstraction Layer
// =============================================================================
//
// Central entry point for all external data providers. Currently supports
// weather data with a pluggable provider architecture. New provider types
// (e.g. economic data, GIS, news) can be added by extending the manager.
// =============================================================================

import { config } from '../../config';
import { createServiceLogger } from '../../utils/logger';
import {
  WeatherProvider,
  WeatherForecast,
  CacheEntry,
} from './types';
import {
  OpenWeatherMapProvider,
  WeatherAPIProvider,
  MockWeatherProvider,
} from './weatherProviders';

const log = createServiceLogger('data-provider');

// Re-export all types for convenient single-import usage
export * from './types';
export { OpenWeatherMapProvider, WeatherAPIProvider, MockWeatherProvider } from './weatherProviders';

/**
 * DataProviderManager is the primary interface for fetching external data.
 *
 * It manages provider selection (based on config), response caching, and
 * error handling with automatic fallback to the mock provider when a
 * configured provider fails or is unavailable.
 *
 * Usage:
 *   import { dataProviderManager } from './services/dataProviders';
 *   const weather = await dataProviderManager.getWeather(40.71, -74.01, 7);
 */
export class DataProviderManager {
  private weatherProvider: WeatherProvider;
  private cache: Map<string, CacheEntry<any>>;
  private cacheTTLMinutes: number;
  private cacheHits: number;
  private cacheMisses: number;

  constructor() {
    this.cache = new Map();
    this.cacheTTLMinutes = config.WEATHER_CACHE_MINUTES;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.weatherProvider = this.resolveWeatherProvider();
  }

  /**
   * Select the appropriate weather provider based on configuration.
   * Falls back to MockWeatherProvider if the configured provider cannot be instantiated.
   */
  private resolveWeatherProvider(): WeatherProvider {
    const providerName = config.WEATHER_API_PROVIDER;

    switch (providerName) {
      case 'openweathermap': {
        const provider = new OpenWeatherMapProvider();
        if (provider.isConfigured()) {
          log.info({ provider: provider.name }, 'Weather provider initialized');
          return provider;
        }
        log.warn('OpenWeatherMap selected but WEATHER_API_KEY is not set — falling back to mock provider');
        return new MockWeatherProvider();
      }

      case 'weatherapi': {
        const provider = new WeatherAPIProvider();
        if (provider.isConfigured()) {
          log.info({ provider: provider.name }, 'Weather provider initialized');
          return provider;
        }
        log.warn('WeatherAPI selected but WEATHER_API_KEY is not set — falling back to mock provider');
        return new MockWeatherProvider();
      }

      case 'accuweather': {
        // AccuWeather provider not yet implemented; fall back to mock
        log.warn('AccuWeather provider is not yet implemented — falling back to mock provider');
        return new MockWeatherProvider();
      }

      case 'mock':
      default: {
        const provider = new MockWeatherProvider();
        log.info({ provider: provider.name }, 'Weather provider initialized');
        return provider;
      }
    }
  }

  /**
   * Fetch a weather forecast for the given coordinates.
   *
   * Returns cached data if available and not expired, otherwise fetches
   * fresh data from the configured provider. On provider failure, attempts
   * fallback to the mock provider rather than throwing.
   *
   * @param lat  Latitude (-90 to 90)
   * @param lon  Longitude (-180 to 180)
   * @param days Number of forecast days (1-14, default 7)
   * @returns    Normalized WeatherForecast
   */
  async getWeather(lat: number, lon: number, days: number = 7): Promise<WeatherForecast> {
    // Validate inputs
    if (lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
    }
    if (lon < -180 || lon > 180) {
      throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180.`);
    }
    days = Math.max(1, Math.min(14, Math.round(days)));

    // Round coordinates to 2 decimal places for cache key consistency
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    const cacheKey = `weather:${roundedLat}:${roundedLon}:${days}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      this.cacheHits++;
      return cached.data as WeatherForecast;
    }

    // Cache miss or expired -- remove stale entry
    if (cached) {
      this.cache.delete(cacheKey);
    }
    this.cacheMisses++;

    try {
      const forecast = await this.weatherProvider.getForecast(roundedLat, roundedLon, days);

      // Store in cache
      const now = new Date();
      this.cache.set(cacheKey, {
        data: forecast,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + this.cacheTTLMinutes * 60 * 1000),
      });

      return forecast;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error({ err: error }, 'Weather fetch failed');

      // If the active provider is not already the mock, fall back to mock
      if (!(this.weatherProvider instanceof MockWeatherProvider)) {
        log.warn('Falling back to mock weather provider for this request');
        try {
          const mockProvider = new MockWeatherProvider();
          const fallbackForecast = await mockProvider.getForecast(roundedLat, roundedLon, days);

          // Cache the fallback result with a shorter TTL (25% of normal)
          const now = new Date();
          const reducedTTL = Math.max(1, Math.floor(this.cacheTTLMinutes / 4));
          this.cache.set(cacheKey, {
            data: fallbackForecast,
            fetchedAt: now,
            expiresAt: new Date(now.getTime() + reducedTTL * 60 * 1000),
          });

          return fallbackForecast;
        } catch (fallbackError) {
          // This should never happen since MockWeatherProvider is deterministic,
          // but handle it defensively.
          const fbMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw new Error(
            `[DataProviderManager] Weather fetch failed and fallback also failed. ` +
            `Primary: ${errorMessage}. Fallback: ${fbMsg}`
          );
        }
      }

      // If even the mock provider failed (should not happen), re-throw
      throw new Error(`[DataProviderManager] Weather fetch failed: ${errorMessage}`);
    }
  }

  /**
   * Clear all cached data across all providers.
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    log.info('Cache cleared');
  }

  /**
   * Get cache statistics for monitoring and diagnostics.
   */
  getCacheStats(): { entries: number; hitRate: number; hits: number; misses: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      entries: this.cache.size,
      hitRate: total > 0 ? Math.round((this.cacheHits / total) * 10000) / 100 : 0,
      hits: this.cacheHits,
      misses: this.cacheMisses,
    };
  }

  /**
   * Get the name of the currently active weather provider.
   */
  getActiveWeatherProviderName(): string {
    return this.weatherProvider.name;
  }

  /**
   * Evict expired entries from the cache.
   * Can be called periodically to prevent unbounded memory growth.
   */
  pruneExpiredEntries(): number {
    const now = new Date();
    let pruned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        pruned++;
      }
    }
    if (pruned > 0) {
      log.debug({ pruned }, 'Pruned expired cache entries');
    }
    return pruned;
  }
}

/**
 * Singleton instance of the DataProviderManager.
 * Import this for application-wide usage.
 */
export const dataProviderManager = new DataProviderManager();
