import { createLogger, format, transports } from 'winston';
import { Syslog } from 'winston-syslog';
import os from 'os';

import { config } from './config';

// Only adding the timestamp if running locally. Otherwise the timestamp is little redundant when can be added in supplementary fashion outside of the message itself.
const consoleFormat = config.NODE_ENV === 'local'
  ? format.combine(
    format.colorize(),
    format.timestamp({
      format: 'HH:mm.ss.SSS'
    }),
    format.printf(info => {
      return `${info.timestamp} ${info.level}: ${info.message}`;
    })
  )
  : format.combine(
    format.printf(info => {
      return `${info.level}: ${info.message}`;
    })
  );

// Note using NPM default log levels: https://github.com/winstonjs/winston#logging-levels
const logTransports = [
  new transports.Console({
    level: config.LOG_LEVEL || 'debug',
    format: consoleFormat
  })
];

// Configure the Winston logger. For the complete documentation see https://github.com/winstonjs/winston
const logger = createLogger({
  format: format.combine(
    format.splat(),
    format.errors({ stack: true })
  ),
  transports: logTransports,
  silent: config.NODE_ENV === 'test'
});

export default logger;
