import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const combinedSlug = (name: string, maxLen = 80): string => {
  const base = name;
  if (!base) return 'Untitled';
  let s = base
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
  if (!s) s = 'Untitled';
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}
