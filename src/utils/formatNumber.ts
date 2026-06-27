/**
 * Number formatting utilities for consistent display across the application.
 *
 * Format conventions (Spanish locale):
 * - '.' as thousand separator
 * - ',' as decimal separator
 * - 2 decimal places by default (omitted if ,00)
 *
 * Examples:
 *   formatNumber(1234.56) → "1.234,56"
 *   formatNumber(1234.00) → "1.234"
 *   formatNumber(1234)    → "1.234"
 */

/**
 * Format a number with Spanish locale conventions.
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with '.' thousand separator and ',' decimal separator
 */
export function formatNumber(value: number, decimals: number = 2): string {
  const fixed = value.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');

  // Add thousand separators
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Check if decimals are all zeros - if so, omit them
  if (!decPart || parseInt(decPart) === 0) {
    return formattedInt;
  }

  return `${formattedInt},${decPart}`;
}

/**
 * Format a currency value (€)
 * @param value - The monetary value
 * @returns Formatted string like "1.234,56€" or "1.234€"
 */
export function formatCurrency(value: number): string {
  return `${formatNumber(value)}€`;
}

/**
 * Format a monthly cost (€/mes)
 * @param value - The monthly cost value
 * @returns Formatted string like "1.234,56€/mes" or "1.234€/mes"
 */
export function formatCurrencyPerMonth(value: number): string {
  return `${formatNumber(value)}€/mes`;
}

/**
 * Format power in kW
 * @param value - The power value
 * @returns Formatted string like "3,45 kW"
 */
export function formatPower(value: number): string {
  return `${formatNumber(value)} kW`;
}

/**
 * Format a percentage value
 * @param value - The percentage value (e.g., 21 for 21%)
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted string like "21%" or "5,11%"
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${formatNumber(value, decimals)}%`;
}
