import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const animateValue = (
  start: number,
  end: number,
  duration: number,
  onUpdate: (arg0: any) => void,
) => {
  let current = start;
  const range = end - start;
  const increment = end > start ? 1 : -1;
  const stepTime = Math.abs(Math.floor(duration / range));
  const timer = setInterval(() => {
    current += increment;
    onUpdate(current);
    if (current === end) {
      clearInterval(timer);
    }
  }, stepTime);
};
