import pino from 'pino'

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'authorization',
      'cookie',
      'password',
      'fileKey',
      'docNumber',
      '*.authorization',
      '*.cookie',
    ],
    censor: '[REDACTED]',
  },
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, ignore: 'pid,hostname' },
    },
  }),
})
