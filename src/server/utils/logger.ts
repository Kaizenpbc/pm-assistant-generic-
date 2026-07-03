import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { getRequestId } from '../middleware/requestContext';

const addRequestId = winston.format((info) => {
  const requestId = getRequestId();
  if (requestId) {
    info.requestId = requestId;
  }
  return info;
});

// Rotating file transport — keeps 14 days, max 20MB per file
const rotateTransport = new DailyRotateFile({
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  zippedArchive: true,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    addRequestId(),
    winston.format.json(),
  ),
});

const errorRotateTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  zippedArchive: true,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    addRequestId(),
    winston.format.json(),
  ),
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    addRequestId(),
    winston.format.json()
  ),
  defaultMeta: { service: 'pm-assistant-generic' },
  transports: [
    rotateTransport,
    errorRotateTransport,
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export const requestLogger = (request: any, reply: any, done: any) => {
  logger.info('Request received', {
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent']
  });
  done();
};

export const responseLogger = (request: any, reply: any, done: any) => {
  const durationMs = Math.round(reply.elapsedTime || 0);
  logger.info('Response sent', {
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    durationMs,
    ip: request.ip,
  });
  done();
};

export const errorLogger = logger;
export const auditLogger = logger;
export default logger;
