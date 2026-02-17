import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1000).max(65535).default(3001),
  HOST: z.string().min(1).default('localhost'),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default('root'),
  // SECURITY: In production, DB_PASSWORD must be set via environment variable.
  // The 'rootpassword' default is only used in development/test.
  DB_PASSWORD: z.string().min(1).default(
    process.env['NODE_ENV'] === 'production' ? '' : 'rootpassword'
  ),
  DB_NAME: z.string().min(1).default('pm_assistant_generic'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),

  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('debug'),

  // AI Configuration
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().default('claude-sonnet-4-5-20250929'),
  AI_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.3),
  AI_MAX_TOKENS: z.coerce.number().min(100).max(8192).default(4096),
  AI_ENABLED: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean().default(false)),
  AI_DAILY_TOKEN_BUDGET: z.coerce.number().min(0).default(500000),
  AI_PER_REQUEST_MAX_TOKENS: z.coerce.number().min(100).max(16384).default(4096),
  AI_MAX_REQUESTS_PER_USER_PER_HOUR: z.coerce.number().min(1).max(1000).default(60),

  // Weather Configuration
  WEATHER_API_PROVIDER: z.enum(['openweathermap', 'weatherapi', 'accuweather', 'mock']).default('mock'),
  WEATHER_API_KEY: z.string().optional().default(''),
  WEATHER_CACHE_MINUTES: z.coerce.number().min(1).max(1440).default(30),
}).refine((data) => {
  if (data.JWT_SECRET === data.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }
  if (data.JWT_SECRET === data.COOKIE_SECRET) {
    throw new Error('JWT_SECRET and COOKIE_SECRET must be different');
  }
  if (data.JWT_REFRESH_SECRET === data.COOKIE_SECRET) {
    throw new Error('JWT_REFRESH_SECRET and COOKIE_SECRET must be different');
  }
  return true;
}, { message: 'Security secrets must be unique' });

export function validateConfiguration() {
  try {
    const rawConfig = {
      NODE_ENV: process.env['NODE_ENV'],
      PORT: process.env['PORT'],
      HOST: process.env['HOST'],
      DB_HOST: process.env['DB_HOST'],
      DB_PORT: process.env['DB_PORT'],
      DB_USER: process.env['DB_USER'],
      DB_PASSWORD: process.env['DB_PASSWORD'],
      DB_NAME: process.env['DB_NAME'],
      JWT_SECRET: process.env['JWT_SECRET'],
      JWT_REFRESH_SECRET: process.env['JWT_REFRESH_SECRET'],
      COOKIE_SECRET: process.env['COOKIE_SECRET'],
      CORS_ORIGIN: process.env['CORS_ORIGIN'],
      LOG_LEVEL: process.env['LOG_LEVEL'],
      ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
      AI_MODEL: process.env['AI_MODEL'],
      AI_TEMPERATURE: process.env['AI_TEMPERATURE'],
      AI_MAX_TOKENS: process.env['AI_MAX_TOKENS'],
      AI_ENABLED: process.env['AI_ENABLED'],
      AI_DAILY_TOKEN_BUDGET: process.env['AI_DAILY_TOKEN_BUDGET'],
      AI_PER_REQUEST_MAX_TOKENS: process.env['AI_PER_REQUEST_MAX_TOKENS'],
      AI_MAX_REQUESTS_PER_USER_PER_HOUR: process.env['AI_MAX_REQUESTS_PER_USER_PER_HOUR'],
      WEATHER_API_PROVIDER: process.env['WEATHER_API_PROVIDER'],
      WEATHER_API_KEY: process.env['WEATHER_API_KEY'],
      WEATHER_CACHE_MINUTES: process.env['WEATHER_CACHE_MINUTES'],
    };

    console.log('Validating configuration...');

    const requiredVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'COOKIE_SECRET'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    const validatedConfig = configSchema.parse(rawConfig);
    console.log('Configuration validation successful');
    return validatedConfig;
  } catch (error) {
    console.error('Configuration validation failed:');

    if (error instanceof z.ZodError) {
      error.issues.forEach((issue: z.ZodIssue, index: number) => {
        const path = issue.path.length ? issue.path.join('.') : '(root)';
        console.error(`  ${index + 1}. ${path}: ${issue.message}`);
      });
    } else {
      console.error(`  ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    throw new Error('Configuration validation failed');
  }
}

export const config = validateConfiguration();
