/**
 * Simple logger utility for Remote Claude
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export class Logger {
  private name: string;
  private level: LogLevel;

  constructor(name: string, level: LogLevel = LogLevel.INFO) {
    this.name = name;
    this.level = process.env.LOG_LEVEL ? 
      LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO : 
      level;
  }

  error(message: string, data?: any): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[${new Date().toISOString()}] [ERROR] [${this.name}] ${message}`, data || '');
    }
  }

  warn(message: string, data?: any): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[${new Date().toISOString()}] [WARN] [${this.name}] ${message}`, data || '');
    }
  }

  info(message: string, data?: any): void {
    if (this.level >= LogLevel.INFO) {
      console.log(`[${new Date().toISOString()}] [INFO] [${this.name}] ${message}`, data || '');
    }
  }

  debug(message: string, data?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`[${new Date().toISOString()}] [DEBUG] [${this.name}] ${message}`, data || '');
    }
  }
}