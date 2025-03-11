import { extractAllImageUrls, proxyImageUrl } from '../images/index.js';
import { IMAGE_REGEX, MARKDOWN_IMAGE_REGEX, HTML_IMAGE_REGEX, IMAGE_EXTENSION_REGEX } from '../regex.js';

/**
 * Processa e ottimizza le immagini nel contenuto HTML
 * @param {string} html - HTML da elaborare
 * @param {Object} options - Opzioni di elaborazione
 * @returns {Object} Risultato dell'elaborazione con immagini ottimizzate
 */
export function optimizeImages(html, options = {}) {
  const {
    proxyImages = true,
    maxWidth = 800,
    enableImages = true
  } = options;
  
  if (!enableImages) return { html, images: [] };
  
  // Usa l'approccio del modulo di estrazione
  const allImageUrls = extractAllImageUrls(html);
  
  // Crea un set di immagini trovate
  const images = new Set(allImageUrls);
  
  try {
    // Usa l'elaborazione DOM per sostituire gli attributi src
    const tempDoc = document.implementation.createHTMLDocument('');
    const container = tempDoc.createElement('div');
    container.innerHTML = html;
    
    // Elabora le immagini trovate in DOM
    const imageElements = container.querySelectorAll('img');
    imageElements.forEach(img => {
      try {
        const originalSrc = img.getAttribute('src');
        if (!originalSrc) return;
        
        // Aggiungi all'elenco generale
        images.add(originalSrc);
        
        // Converti URL solo se necessario
        if (proxyImages) {
          // Usa funzione dal nostro nuovo modulo
          const optimizedUrl = proxyImageUrl(originalSrc, { 
            width: maxWidth
          });
          img.setAttribute('src', optimizedUrl);
        }
        
        // Aggiungi attributi per migliorare le immagini
        if (!img.hasAttribute('alt')) {
          img.setAttribute('alt', 'Content image');
        }
        
        img.setAttribute('loading', 'lazy');
        img.setAttribute('data-original-src', originalSrc);
        img.classList.add('content-image');
      } catch (error) {
        console.warn('Errore elaborazione immagine:', error);
      }
    });
    
    return {
      html: container.innerHTML,
      images: [...images]
    };
  } catch (error) {
    console.error('Errore processo immagini:', error);
    return {
      html,
      images: [...images]
    };
  }
}

/**
 * Estrae l'immagine principale/copertina dal contenuto
 * @param {string} content - Contenuto da cui estrarre l'immagine
 * @param {Object} metadata - Metadati opzionali del post
 * @returns {string|null} URL dell'immagine principale o null
 */
export function extractFeaturedImage(content, metadata = {}) {
  if (!content) return null;
  
  try {
    // Prima cerca nell'utility ImageUtils
    if (typeof ImageUtils.getBestImageUrl === 'function') {
      const bestImage = ImageUtils.getBestImageUrl(content, metadata);
      if (bestImage) return bestImage;
    }
    
    // Fallback alla logica standard
    const markdownMatch = content.match(MARKDOWN_IMAGE_REGEX);
    if (markdownMatch && markdownMatch[1]) return markdownMatch[1];
    
    const htmlMatch = content.match(HTML_IMAGE_REGEX);
    if (htmlMatch && htmlMatch[1]) return htmlMatch[1];
    
    const urlMatch = content.match(IMAGE_REGEX);
    if (urlMatch && urlMatch[1]) return urlMatch[1];
    
    return null;
  } catch (error) {
    console.error('Errore nell\'estrazione dell\'immagine principale:', error);
    return null;
  }
}

/**
 * Crea un placeholder per un'immagine
 * @param {string} type - Tipo di placeholder
 * @returns {string} Data URL SVG per il placeholder
 */
export function createImagePlaceholder(type = 'image') {
  let text, color, bgColor;
  
  switch (type) {
    case 'error':
      text = 'Image Error';
      color = '#d32f2f';
      bgColor = '#ffebee';
      break;
    case 'nsfw':
      text = 'NSFW Content';
      color = '#f57c00';
      bgColor = '#fff3e0';
      break;
    case 'loading':
      text = 'Loading...';
      color = '#1976d2';
      bgColor = '#e3f2fd';
      break;
    default:
      text = 'No Image';
      color = '#757575';
      bgColor = '#f5f5f5';
  }
  
  // Crea SVG placeholder come data URL
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect fill="${bgColor}" width="200" height="150"/><text fill="${color}" font-family="sans-serif" font-size="14" text-anchor="middle" x="100" y="75">${text}</text></svg>`;
}

/**
 * Verifica se un URL è un'immagine
 * @param {string} url - URL da verificare
 * @returns {boolean} true se l'URL è un'immagine
 */
export function isImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    return ImageUtils.isValidImageUrl(url);
  } catch (error) {
    // Fallback con verifica semplice dell'estensione
    return IMAGE_EXTENSION_REGEX.test(url);
  }
}

/**
 * Ottiene un URL ottimizzato per un'immagine
 * @param {string} url - URL immagine originale
 * @param {Object} options - Opzioni di ottimizzazione
 * @returns {string} URL ottimizzato
 */
export function getOptimizedImageUrl(url, options = {}) {
  if (!url) return createImagePlaceholder();
  
  try {
    return ImageUtils.optimizeImageUrl(url, options);
  } catch (error) {
    console.warn('Errore nell\'ottimizzazione URL:', error);
    return url;
  }
}