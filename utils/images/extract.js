import { MARKDOWN_IMAGE_REGEX, HTML_IMAGE_REGEX, IMAGE_URL_REGEX } from '../regex.js';

/**
 * Estrae gli URL delle immagini da un contenuto
 * @param {string} content - Contenuto da cui estrarre le immagini
 * @returns {string[]} Array di URL immagini
 */
export function extractAllImageUrls(content) {
  if (!content) return [];
  
  const images = new Set();
  
  try {
    // Trova immagini in formato markdown
    let match;
    MARKDOWN_IMAGE_REGEX.lastIndex = 0;
    while ((match = MARKDOWN_IMAGE_REGEX.exec(content)) !== null) {
      if (match[1]) images.add(match[1]);
    }
    
    // Trova immagini in tag HTML
    HTML_IMAGE_REGEX.lastIndex = 0;
    while ((match = HTML_IMAGE_REGEX.exec(content)) !== null) {
      if (match[1]) images.add(match[1]);
    }
    
    // Trova URL di immagini dirette
    IMAGE_URL_REGEX.lastIndex = 0;
    while ((match = IMAGE_URL_REGEX.exec(content)) !== null) {
      if (match[1]) images.add(match[1]);
    }
    
    return [...images];
  } catch (error) {
    console.error('Errore nell\'estrazione immagini:', error);
    return [];
  }
}

/**
 * Trova l'immagine principale da un contenuto
 * @param {string} content - Contenuto
 * @param {Object} metadata - Metadati opzionali 
 * @returns {string|null} URL dell'immagine principale
 */
export function extractFeaturedImage(content, metadata = {}) {
  if (!content) return null;
  
  try {
    // Prima controlla nei metadati
    if (metadata && metadata.image && metadata.image.length) {
      return metadata.image[0];
    }
    
    // Poi cerca la prima immagine nel contenuto
    const images = extractAllImageUrls(content);
    if (images.length > 0) {
      return images[0];
    }
    
    return null;
  } catch (error) {
    console.error('Errore nell\'estrazione immagine principale:', error);
    return null;
  }
}