import { proxyImageUrl } from './proxy.js';

/**
 * Prepara l'HTML di un'immagine con eventuali attributi e wrapper
 * @param {string} url - URL dell'immagine
 * @param {Object} options - Opzioni di rendering
 * @returns {string} HTML dell'immagine
 */
export function renderImage(url, options = {}) {
  const {
    alt = '',
    title = '',
    lazy = true,
    proxy = true,
    maxWidth = 800,
    cssClass = 'content-image',
    wrapper = true,
    openButton = true
  } = options;
  
  // Evita URL vuoti
  if (!url) return '';
  
  // Crea URL proxy se necessario
  const displayUrl = proxy ? proxyImageUrl(url, { width: maxWidth }) : url;
  const lazyAttr = lazy ? ' loading="lazy"' : '';
  const titleAttr = title ? ` title="${title}"` : '';
  const altAttr = ` alt="${alt || 'Image'}"`;
  const classAttr = cssClass ? ` class="${cssClass}"` : '';
  const dataOriginalSrc = ` data-original-src="${url}"`;
  
  const imgTag = `<img src="${displayUrl}"${altAttr}${titleAttr}${lazyAttr}${classAttr}${dataOriginalSrc}>`;
  
  // Se non serve il wrapper, ritorna solo l'immagine
  if (!wrapper) return imgTag;
  
  // Altrimenti crea un wrapper con pulsante per apertura
  const openButtonHtml = openButton ? 
    `<button class="open-image-button" title="Open image in new tab" onclick="window.open('${url}', '_blank')">
      <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"></path></svg>
    </button>` : '';
  
  return `<div class="img-container">
    ${imgTag}
    ${openButtonHtml}
  </div>`;
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
    default:
      text = 'No Image';
      color = '#757575';
      bgColor = '#f5f5f5';
  }
  
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect fill="${bgColor}" width="200" height="150"/><text fill="${color}" font-family="sans-serif" font-size="14" text-anchor="middle" x="100" y="75">${text}</text></svg>`;
}