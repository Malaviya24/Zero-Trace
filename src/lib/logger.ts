import pino from 'pino';

// Production-ready structured logging
export const logger = pino({
  level: import.meta.env.PROD ? 'info' : 'debug',
  browser: {
    asObject: true,
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

// Typed logging helpers
export const log = {
  debug: (msg: string, data?: Record<string, unknown>) => logger.debug(data, msg),
  info: (msg: string, data?: Record<string, unknown>) => logger.info(data, msg),
  warn: (msg: string, data?: Record<string, unknown>) => logger.warn(data, msg),
  error: (msg: string, error?: Error | unknown, data?: Record<string, unknown>) => {
    if (error instanceof Error) {
      logger.error({ ...data, error: error.message, stack: error.stack }, msg);
    } else {
      logger.error({ ...data, error }, msg);
    }
  },
};
