import { pricingConfigRepository, PricingConfigRecord, TierFeatureRecord } from '../database/PricingConfigRepository';
import { redisService } from './RedisService';
import logger from '../utils/logger';

const CACHE_KEY_TIERS = 'pricing:config';
const CACHE_KEY_FEATURES = 'pricing:features';
const CACHE_TTL = 300; // 5 minutes

class PricingConfigService {
  async getAllTiers(): Promise<PricingConfigRecord[]> {
    const cached = await redisService.get(CACHE_KEY_TIERS);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fall through */ }
    }

    const tiers = await pricingConfigRepository.findAllActive();
    redisService.set(CACHE_KEY_TIERS, JSON.stringify(tiers), CACHE_TTL).catch(() => {});
    return tiers;
  }

  async getTierConfig(tier: string): Promise<PricingConfigRecord | null> {
    const tiers = await this.getAllTiers();
    return tiers.find(t => t.tier === tier) ?? null;
  }

  async isFeatureEnabled(tier: string, featureKey: string): Promise<boolean> {
    const features = await this.getAllFeatures();
    const match = features.find(f => f.tier === tier && f.featureKey === featureKey);
    if (!match) return false;
    return match.enabled;
  }

  async getViewerLimit(tier: string): Promise<number> {
    const config = await this.getTierConfig(tier);
    if (!config) return 0;
    return config.viewerLimit;
  }

  async getAIBudget(tier: string): Promise<number> {
    const config = await this.getTierConfig(tier);
    if (!config) return 0;
    return config.aiTokensMonthly;
  }

  async getAllFeatures(): Promise<TierFeatureRecord[]> {
    const cached = await redisService.get(CACHE_KEY_FEATURES);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fall through */ }
    }

    const features = await pricingConfigRepository.getAllFeatures();
    redisService.set(CACHE_KEY_FEATURES, JSON.stringify(features), CACHE_TTL).catch(() => {});
    return features;
  }

  async invalidateCache(): Promise<void> {
    await redisService.del(CACHE_KEY_TIERS);
    await redisService.del(CACHE_KEY_FEATURES);
    logger.info('Pricing config cache invalidated');
  }
}

export const pricingConfigService = new PricingConfigService();
