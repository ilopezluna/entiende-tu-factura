/**
 * CNMC URL Validator
 * Handles validation of CNMC comparator URLs and related energy provider URLs
 */

/**
 * Validates if a URL is from the CNMC comparator
 * @param url - The URL to validate
 * @returns True if the URL is a valid CNMC comparator URL
 */
export function isCNMCUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.protocol === 'https:' &&
      urlObj.hostname === 'comparador.cnmc.gob.es' &&
      urlObj.pathname.startsWith('/comparador/QRE')
    );
  } catch {
    return false;
  }
}
