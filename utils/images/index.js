import { proxyImageUrl, sanitizeUrl, isImageUrl } from './proxy.js';
import { extractAllImageUrls, extractFeaturedImage } from './extract.js';
import { renderImage, createImagePlaceholder } from './render.js';

// Esporta tutte le funzionalità in un unico oggetto
export default {
  // Funzioni proxy
  proxyImageUrl,
  sanitizeUrl,
  isImageUrl,
  
  // Funzioni estrazione
  extractAllImageUrls,
  extractFeaturedImage,
  
  // Funzioni render
  renderImage,
  createImagePlaceholder
};

// Esporta anche le funzioni singolarmente per import named
export {
  proxyImageUrl,
  sanitizeUrl,
  isImageUrl,
  extractAllImageUrls,
  extractFeaturedImage,
  renderImage,
  createImagePlaceholder
};