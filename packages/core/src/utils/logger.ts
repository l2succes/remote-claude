// Logger utility
export const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
};

// Logger class for compatibility
export class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  info(message: string, ...args: any[]) {
    console.log(`[${this.prefix}] [INFO] ${message}`, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[${this.prefix}] [ERROR] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[${this.prefix}] [WARN] ${message}`, ...args);
  }

  debug(message: string, ...args: any[]) {
    console.debug(`[${this.prefix}] [DEBUG] ${message}`, ...args);
  }
}