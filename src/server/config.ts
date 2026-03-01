import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1000).max(65535).default(3001),
  HOST: z.string().min(1).default('0.0.0.0'),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().min(1).default('rootpassword'),
  DB_NAME: z.string().min(1).default('pm_assistant_generic'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('debug'),

  // AI Configuration
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().default('claude-sonnet-4-5-20250929'),
  AI_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.3),
  AI_MAX_TOKENS: z.coerce.number().min(100).max(8192).default(4096),
  AI_ENABLED: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean().default(false)),

  // Email Configuration (Resend)
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM_EMAIL: z.string().default('noreply@kpbc.ca'),
  APP_URL: z.string().default('http://localhost:5173'),

  // Stripe Configuration
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_PRO_PRICE_ID: z.string().optional().default(''),

  // Weather Configuration
  WEATHER_API_PROVIDER: z.enum(['openweathermap', 'weatherapi', 'accuweather', 'mock']).default('mock'),
  WEATHER_API_KEY: z.string().optional().default(''),
  WEATHER_CACHE_MINUTES: z.coerce.number().min(1).max(1440).default(30),

  // Agent Configuration
  AGENT_ENABLED: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean().default(false)),
  AGENT_CRON_SCHEDULE: z.string().default('0 2 * * *'),
  AGENT_DELAY_THRESHOLD_DAYS: z.coerce.number().min(1).default(3),
  AGENT_BUDGET_CPI_THRESHOLD: z.coerce.number().min(0).max(2).default(0.9),
  AGENT_BUDGET_OVERRUN_THRESHOLD: z.coerce.number().min(0).max(100).default(50),
  AGENT_MC_CONFIDENCE_LEVEL: z.coerce.number().min(1).max(99).default(80),
  AGENT_OVERDUE_SCAN_MINUTES: z.coerce.number().min(1).max(1440).default(15),

  // Embedding / RAG Configuration
  OPENAI_API_KEY: z.string().optional().default(''),
  EMBEDDING_ENABLED: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean().default(false)),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().min(256).max(3072).default(1536),
  RAG_TOP_K: z.coerce.number().min(1).max(50).default(5),
  RAG_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.3),

  // File Upload Configuration
  UPLOAD_DIR: z.string().default(process.env['HOME'] || process.env['USERPROFILE'] ? `${process.env['HOME'] || process.env['USERPROFILE']}/uploads/pm-assistant` : './uploads/pm-assistant'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().min(1).max(100).default(10),
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
      RESEND_API_KEY: process.env['RESEND_API_KEY'],
      RESEND_FROM_EMAIL: process.env['RESEND_FROM_EMAIL'],
      APP_URL: process.env['APP_URL'],
      STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY'],
      STRIPE_PUBLISHABLE_KEY: process.env['STRIPE_PUBLISHABLE_KEY'],
      STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET'],
      STRIPE_PRO_PRICE_ID: process.env['STRIPE_PRO_PRICE_ID'],
      WEATHER_API_PROVIDER: process.env['WEATHER_API_PROVIDER'],
      WEATHER_API_KEY: process.env['WEATHER_API_KEY'],
      WEATHER_CACHE_MINUTES: process.env['WEATHER_CACHE_MINUTES'],
      AGENT_ENABLED: process.env['AGENT_ENABLED'],
      AGENT_CRON_SCHEDULE: process.env['AGENT_CRON_SCHEDULE'],
      AGENT_DELAY_THRESHOLD_DAYS: process.env['AGENT_DELAY_THRESHOLD_DAYS'],
      AGENT_BUDGET_CPI_THRESHOLD: process.env['AGENT_BUDGET_CPI_THRESHOLD'],
      AGENT_BUDGET_OVERRUN_THRESHOLD: process.env['AGENT_BUDGET_OVERRUN_THRESHOLD'],
      AGENT_MC_CONFIDENCE_LEVEL: process.env['AGENT_MC_CONFIDENCE_LEVEL'],
      AGENT_OVERDUE_SCAN_MINUTES: process.env['AGENT_OVERDUE_SCAN_MINUTES'],
      OPENAI_API_KEY: process.env['OPENAI_API_KEY'],
      EMBEDDING_ENABLED: process.env['EMBEDDING_ENABLED'],
      EMBEDDING_MODEL: process.env['EMBEDDING_MODEL'],
      EMBEDDING_DIMENSIONS: process.env['EMBEDDING_DIMENSIONS'],
      RAG_TOP_K: process.env['RAG_TOP_K'],
      RAG_SIMILARITY_THRESHOLD: process.env['RAG_SIMILARITY_THRESHOLD'],
      UPLOAD_DIR: process.env['UPLOAD_DIR'],
      MAX_UPLOAD_SIZE_MB: process.env['MAX_UPLOAD_SIZE_MB'],
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
