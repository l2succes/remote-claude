import inquirer from 'inquirer';

// Re-export inquirer for use in other packages
export { inquirer };

export interface PromptOptions {
  message: string;
  default?: string | boolean | number;
}

export const confirm = async (options: PromptOptions | string): Promise<boolean> => {
  const opts = typeof options === 'string' ? { message: options } : options;
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: opts.message,
      default: opts.default ?? false,
    },
  ]);
  return confirmed;
};

export const input = async (options: PromptOptions | string): Promise<string> => {
  const opts = typeof options === 'string' ? { message: options } : options;
  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message: opts.message,
      default: opts.default,
    },
  ]);
  return value;
};

export const password = async (message: string): Promise<string> => {
  const { value } = await inquirer.prompt([
    {
      type: 'password',
      name: 'value',
      message,
    },
  ]);
  return value;
};

export const select = async <T = string>(
  message: string,
  choices: Array<{ name: string; value: T }>
): Promise<T> => {
  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message,
      choices,
    },
  ]);
  return selected;
};