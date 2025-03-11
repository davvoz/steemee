import { 
  IMAGE_REGEX, 
  IMAGE_URL_REGEX,
  MARKDOWN_IMAGE_REGEX,
  HTML_IMAGE_REGEX,
  STEEM_CDN_HASH_REGEX  // Aggiungi questa importazione
} from '../regex.js';

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
    enableImages = true,
    lazyLoad = true
  } = options;
  
  if (!enableImages) return { html, images: [] };
  
  // Estrai tutte le immagini dal contenuto
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
        
        // Converti URL solo se necessario e se non è già un URL CDN Steem
        if (proxyImages && !isSteemCdnImage(originalSrc)) {
          const optimizedUrl = proxyImageUrl(originalSrc, { 
            width: maxWidth
          });
          img.setAttribute('src', optimizedUrl);
        }
        
        // Aggiungi attributi per migliorare le immagini
        if (!img.hasAttribute('alt')) {
          img.setAttribute('alt', 'Content image');
        }
        
        if (lazyLoad && !img.hasAttribute('loading')) {
          img.setAttribute('loading', 'lazy');
        }
        
        // Salva l'URL originale
        img.setAttribute('data-original-src', originalSrc);
        
        // Aggiungi classe
        img.classList.add('content-image');
        
        // Crea wrapper per l'immagine con pulsante di apertura
        wrapImageWithContainer(img);
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
 * Avvolge un elemento immagine in un container con pulsante di apertura
 * @param {HTMLImageElement} img - Elemento immagine da avvolgere
 */
function wrapImageWithContainer(img) {
  const originalSrc = img.getAttribute('data-original-src') || img.getAttribute('src');
  
  // Crea il wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'img-container';
  wrapper.style.position = 'relative';
  wrapper.style.margin = '1rem 0';
  
  // Crea il pulsante di apertura
  const openButton = document.createElement('button');
  openButton.className = 'open-image-button';
  openButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"></path></svg>';
  openButton.setAttribute('title', 'Open image in new tab');
  openButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background-color: rgba(255, 255, 255, 0.8);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `;
  
  // Aggiungi onclick per aprire l'immagine
  openButton.setAttribute('onclick', `window.open('${originalSrc}', '_blank')`);
  
  // Inserisci il wrapper al posto dell'immagine
  const parent = img.parentNode;
  parent.insertBefore(wrapper, img);
  wrapper.appendChild(img);
  wrapper.appendChild(openButton);
}

/**
 * Verifica se un URL è già un'immagine CDN Steem
 * @param {string} url - URL da verificare
 * @returns {boolean} True se è già un URL CDN Steem
 */
function isSteemCdnImage(url) {
  return url && (
    url.includes('steemitimages.com') || 
    url.includes('cdn.steemitimages.com') ||
    url.includes('images.hive.blog')
  );
}

/**
 * Genera URL proxy per un'immagine
 * @param {string} url - URL originale
 * @param {Object} options - Opzioni di ridimensionamento
 * @returns {string} URL proxy
 */
export function proxyImageUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return '';
  
  // Se è già un URL di steemitimages, non modificarlo
  if (isSteemCdnImage(url)) return url;
  
  const { width = 0, height = 0 } = options;
  
  try {
    // Sanitize URL
    url = url.trim().replace(/[^\x20-\x7E]/g, '');
    
    // Assicurati che l'URL abbia il protocollo
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    // Costruisci URL proxy
    if (width || height) {
      return `https://steemitimages.com/${width}x${height}/${encodeURI(url)}`;
    }
    return `https://steemitimages.com/0x0/${encodeURI(url)}`;
  } catch (error) {
    console.error('Errore generazione URL proxy:', error);
    return url;
  }
}

/**
 * Estrae tutti gli URL immagine da un contenuto
 */
export function extractAllImageUrls(content) {
  if (!content) return [];
  
  const images = new Set();
  
  try {
    // Array di tutte le regex da controllare
    const regexesToCheck = [
      MARKDOWN_IMAGE_REGEX,
      HTML_IMAGE_REGEX,
      IMAGE_URL_REGEX,
      STEEM_CDN_HASH_REGEX, // Aggiungi la nuova regex
    ];
    
    // Controlla ogni regex
    regexesToCheck.forEach(regex => {
      regex.lastIndex = 0; // Reset regex
      let match;
      while ((match = regex.exec(content)) !== null) {
        // Prendi il primo gruppo di cattura se esiste, altrimenti l'intero match
        const url = match[1] || match[0];
        if (url) images.add(url);
      }
    });
    
    // Controlla anche i link che contengono immagini
    const anchorRegex = /<a[^>]+href=["'](https?:\/\/[^"']+\.(?:jpe?g|png|gif|webp|svg))["'][^>]*>.*?<\/a>/gi;
    anchorRegex.lastIndex = 0;
    let anchorMatch;
    while ((anchorMatch = anchorRegex.exec(content)) !== null) {
      if (anchorMatch[1]) images.add(anchorMatch[1]);
    }
    
    // Crea array da Set
    return [...images];
  } catch (error) {
    console.error('Errore estrazione immagini:', error);
    return [];
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