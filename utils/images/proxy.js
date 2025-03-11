import { IMAGE_REGEX, IMAGE_EXTENSION_REGEX } from '../regex.js';

/**
 * Genera un URL proxy per un'immagine utilizzando steemitimages.com
 * @param {string} url - URL originale dell'immagine
 * @param {Object} options - Opzioni di ridimensionamento
 * @returns {string} URL proxy ottimizzato
 */
export function proxyImageUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return '';
  
  // Ignora URL che sono già proxy
  if (url.includes('steemitimages.com')) return url;
  
  const { width = 0, height = 0 } = options;
  
  try {
    // Sanitizza URL
    url = sanitizeUrl(url);
    
    // Costruisci URL del proxy
    if (width || height) {
      return `https://steemitimages.com/${width}x${height}/${url}`;
    }
    return `https://steemitimages.com/0x0/${url}`;
  } catch (error) {
    console.error('Errore nella generazione URL proxy:', error);
    return url;
  }
}

/**
 * Sanitizza un URL per l'uso nel proxy
 */
export function sanitizeUrl(url) {
  if (!url) return '';
  
  // Rimuove spazi e caratteri non validi
  url = url.trim().replace(/[^\x20-\x7E]/g, '');
  
  // Assicura che l'URL abbia il protocollo
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  
  // Codifica caratteri speciali nell'URL
  return encodeURI(url);
}

/**
 * Verifica se un URL è un'immagine
 */
export function isImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return IMAGE_EXTENSION_REGEX.test(url) || IMAGE_REGEX.test(url);
}