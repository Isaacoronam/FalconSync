export interface UserDisplaySource {
  name: string;
  surname?: string | null;
}

export function userDisplayName(user: UserDisplaySource): string {
  return [user.name, user.surname]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function userInitials(user: UserDisplaySource): string {
  const parts = userDisplayName(user).split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'FS';
  }

  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : '';

  return `${first}${second}`.toUpperCase() || 'FS';
}
