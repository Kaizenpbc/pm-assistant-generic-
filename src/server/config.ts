import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1000).max(65535).default(3001),
  HOST: z.string().min(1).default('localhost'),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().min(1).default('rootpassword'),
  DB_NAME: z.string().min(1).default('pm_assistant_generic'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),

  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('debug'),
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
