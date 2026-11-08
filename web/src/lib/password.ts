export const DEFAULT_PASSWORD_SUFFIX = '000000';

export function defaultPassword(username: string): string {
  return `${username}${DEFAULT_PASSWORD_SUFFIX}`;
}

export function isDefaultPassword(username: string, password: string): boolean {
  return password === defaultPassword(username);
}
