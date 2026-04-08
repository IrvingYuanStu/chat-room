import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  logDir: string;
  logLevel: LogLevel;
  module: string;
}

export class Logger {
  private logger: pino.Logger;
  private logDir: string;
  private logFilePath: string;

  constructor(options: LoggerOptions) {
    this.logDir = options.logDir;

    // Ensure log directory exists
    this.ensureLogDir();

    // Generate log filename with timestamp
    const now = new Date();
    const filename = `chat-room-${this.formatDate(now)}-${this.formatTime(now)}.log`;
    this.logFilePath = path.join(this.logDir, filename);

    // Create file stream for writing logs (with proper error handling)
    let fileStream: fs.WriteStream;
    try {
      fileStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    } catch (err) {
      // Fallback: ensure dir exists and retry
      this.ensureLogDir();
      fileStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    }

    // Handle stream errors gracefully
    fileStream.on('error', () => {
      // Suppress write errors during teardown
    });

    // Configure pino with dual output (console + file)
    this.logger = pino({
      level: options.logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
      base: {
        module: options.module,
      },
    }, fileStream);
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}${minutes}${seconds}`;
  }

  debug(message: string, ...args: unknown[]): void {
    this.logger.debug(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.logger.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.logger.error(message, ...args);
  }

  // Expose log file path for testing
  getLogFilePath(): string {
    return this.logFilePath;
  }

  // Flush and close the logger
  close(): void {
    this.logger.flush();
  }
}

// Default logger instance for application-wide use
let defaultLogger: Logger | null = null;

export function initLogger(options: LoggerOptions): Logger {
  defaultLogger = new Logger(options);
  return defaultLogger;
}

export function getLogger(): Logger {
  if (!defaultLogger) {
    throw new Error('Logger not initialized. Call initLogger() first.');
  }
  return defaultLogger;
}
