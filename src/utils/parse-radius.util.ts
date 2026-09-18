export function parseRadiusToMiles(input: any): number {
  if (typeof input === 'number') return input;
  if (!input || typeof input !== 'string') return 50;
  
  const lower = input.toLowerCase();
  
  // If user says "X hours", assume roughly 60mph
  if (lower.includes('hour') || lower.includes('hr')) {
    const num = parseFloat(lower.replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) {
      return num * 60;
    }
  }
  
  // Otherwise parse the number (e.g., "50 miles" -> 50)
  const num = parseFloat(lower.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 50 : num;
}
