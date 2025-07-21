import chalk from 'chalk';

// Re-export chalk for use in other packages
export { chalk };

export const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.gray,
  primary: chalk.cyan,
  secondary: chalk.magenta,
} as const;

export const statusColors = {
  running: chalk.blue,
  completed: chalk.green,
  failed: chalk.red,
  cancelled: chalk.gray,
  queued: chalk.yellow,
  pending: chalk.yellow,
} as const;

export const formatStatus = (status: string): string => {
  const color = statusColors[status.toLowerCase() as keyof typeof statusColors] || chalk.white;
  return color(status.toUpperCase());
};