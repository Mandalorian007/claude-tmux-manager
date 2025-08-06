import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import path from 'path'
import os from 'os'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Expand tilde (~) in file paths to the user's home directory
 */
export function expandPath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    return inputPath
  }
  
  // Handle paths starting with ~/
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2))
  }
  
  // Handle standalone ~
  if (inputPath === '~') {
    return os.homedir()
  }
  
  // Return path unchanged if no expansion needed
  return inputPath
}