import ImageUtils from '../process-body/ImageUtils.js';

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
    lazyLoad = true,
    extractAll = true
  } = options;
  
  // Se le immagini sono disabilitate, restituisci l'HTML originale
  if (!enableImages) {
    return {
      html,
      images: []
    };
  }
  
  const images = new Set();
  let processedHtml = html;
  
  try {
    // Crea DOM temporaneo per elaborare le immagini
    const tempDoc = document.implementation.createHTMLDocument('');
    const container = tempDoc.createElement('div');
    container.innerHTML = html;
    
    // Raccogli ed elabora tutte le immagini
    const imageElements = container.querySelectorAll('img');
    
    imageElements.forEach(img => {
      try {
        // Ottieni src dell'immagine
        const originalSrc = img.getAttribute('src');
        if (!originalSrc) return;
        
        // Aggiungi alla collezione delle immagini trovate
        images.add(originalSrc);
        
        // Se l'immagine è già stata proxata, non farlo di nuovo
        if (proxyImages && !originalSrc.includes('steemitimages.com')) {
          // Ottimizza URL tramite ImageUtils
          const optimizedUrl = ImageUtils.optimizeImageUrl(originalSrc, { 
            width: maxWidth, 
            height: 0 
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
        
        // Aggiunta di data-original-src per riferimento originale
        img.setAttribute('data-original-src', originalSrc);
        
        // Rimuovi width/height inline per permettere responsività
        if (img.hasAttribute('width') && img.getAttribute('width') !== '100%') {
          img.removeAttribute('width');
        }
        if (img.hasAttribute('height')) {
          img.removeAttribute('height');
        }
        
        // Aggiungi classe per lo styling
        img.classList.add('content-image');
      } catch (imgError) {
        console.warn('Errore nella processazione immagine:', imgError);
      }
    });
    
    // Estrai anche immagini che non sono in tag img
    if (extractAll) {
      try {
        const extractedUrls = ImageUtils.extractAllImageUrls(html);
        if (Array.isArray(extractedUrls)) {
          extractedUrls
            .filter(url => !Array.from(images).includes(url))
            .forEach(url => {
              // Aggiungi solo URL validi
              if (url && typeof url === 'string' && url.startsWith('http')) {
                images.add(url);
              }
            });
        }
      } catch (extractError) {
        console.warn('Errore nell\'estrazione immagini aggiuntive:', extractError);
      }
    }
    
    // Ottieni l'HTML elaborato
    processedHtml = container.innerHTML;
    
    return {
      html: processedHtml,
      images: [...images]
    };
  } catch (error) {
    console.error('Errore nell\'ottimizzazione immagini:', error);
    return {
      html,
      images: [...images],
      error
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
    const imgMatches = [
      // Markdown image
      content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/i),
      // HTML img tag
      content.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i),
      // Raw URL immagine
      content.match(/(https?:\/\/\S+\.(?:jpe?g|png|gif))/i)
    ];
    
    // Usa il primo match valido
    for (const match of imgMatches) {
      if (match && match[1]) {
        return match[1];
      }
    }
    
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
    return /\.(jpe?g|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url);
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