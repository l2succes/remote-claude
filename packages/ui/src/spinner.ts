import ora, { Ora } from 'ora';
import { colors } from './colors';

// Re-export ora for use in other packages
export { ora };

export class Spinner {
  private spinner: Ora;

  constructor(text: string) {
    this.spinner = ora({
      text,
      color: 'cyan',
    });
  }

  start(text?: string): void {
    if (text) {
      this.spinner.text = text;
    }
    this.spinner.start();
  }

  succeed(text?: string): void {
    this.spinner.succeed(text);
  }

  fail(text?: string): void {
    this.spinner.fail(text);
  }

  warn(text?: string): void {
    this.spinner.warn(text);
  }

  info(text?: string): void {
    this.spinner.info(text);
  }

  stop(): void {
    this.spinner.stop();
  }

  text(text: string): void {
    this.spinner.text = text;
  }
}

export const createSpinner = (text: string): Spinner => new Spinner(text);