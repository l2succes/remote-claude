import { colors, statusColors } from './colors';

export const divider = (length: number = 80, char: string = '─'): string => {
  return colors.muted(char.repeat(length));
};

export const header = (text: string, emoji?: string): void => {
  console.log();
  if (emoji) {
    console.log(colors.primary(`${emoji} ${text}`));
  } else {
    console.log(colors.primary(text));
  }
  console.log(divider());
};

export const section = (title: string, content: () => void): void => {
  console.log();
  console.log(colors.info(title));
  content();
};

export const listItem = (label: string, value: string | number, indent: number = 2): void => {
  const spaces = ' '.repeat(indent);
  console.log(`${spaces}${label}: ${colors.success(value.toString())}`);
};

export const error = (message: string, error?: Error): void => {
  console.error(colors.error(`❌ ${message}`));
  if (error) {
    console.error(colors.muted(error.message));
  }
};

export const success = (message: string): void => {
  console.log(colors.success(`✅ ${message}`));
};

export const warning = (message: string): void => {
  console.log(colors.warning(`⚠️  ${message}`));
};

export const info = (message: string): void => {
  console.log(colors.info(`ℹ️  ${message}`));
};