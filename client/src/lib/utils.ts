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

    // Check if current has reached or surpassed the end value
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      clearInterval(timer);
      onUpdate(end); // Ensure final update is the end value
    }
  }, stepTime);

  // Handle case when start is 0 separately
  if (start === 0 && end < 0) {
    current = 0;
    while (current >= end) {
      onUpdate(current);
      current += increment;
    }
    onUpdate(end); // Ensure final update is the end value
  }
};
