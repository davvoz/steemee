import BasePlugin from '../BasePlugin.js';
import { REGEX_PATTERNS, SHARED_CACHE, REGEX_UTILS } from '../regex-config.js';

/**
 * Plugin per gestire immagini nel contenuto markdown
 * Incorpora funzionalità complete da ImageUtils
 */
export default class ImagePlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'image';
    this.priority = 30;
    
    // Tutti i pattern regex per le immagini
    this.patterns = Object.values(REGEX_PATTERNS.IMAGE);
    
    this.placeholderPrefix = 'IMAGE_PLACEHOLDER_';
    this.placeholderSuffix = '_IMG_END';
    
    // Opzioni di configurazione
    this.config = {
      lazyLoad: true,
      addZoomClass: true,
      optimizeUrls: true,
      responsiveImages: true,
      maxWidth: '100%',
      addLinkIndicator: true
    };
  }
  
  /**
   * Estrattore migliorato che include tutte le funzionalità di ImageUtils.extractAllImageUrls
   */
  extract(content) {
    if (!content) return [];
    
    const images = [];
    const seenUrls = new Set(); // Previene duplicati
    
    // 0. Prima elabora l'HTML che contiene markdown
    const contentAfterHtmlExtraction = this.extractHtmlWithMarkdown(content, images, seenUrls);
    
    // Continua con le altre estrazioni ma usa il contenuto già elaborato
    // 1. Poi estrai le immagini cliccabili (alta priorità)
    this.extractClickableImages(contentAfterHtmlExtraction, images, seenUrls);
    
    // 2. Poi estrai le immagini standard markdown
    this.extractMarkdownImages(contentAfterHtmlExtraction, images, seenUrls);
    
    // 3. Estrai immagini HTML
    this.extractHtmlImages(contentAfterHtmlExtraction, images, seenUrls);
    
    // 4. Estrai URL diretti di immagini (inclusi Discord)
    this.extractDirectImageUrls(contentAfterHtmlExtraction, images, seenUrls);
    
    // Prima di restituire le immagini, rimuovi i duplicati
    return this.removeDuplicateImages(images);
  }
  
  /**
   * Estrae immagini cliccabili (Markdown con link)
   * @private
   */
  extractClickableImages(content, images, seenUrls) {
    const clickableImageRegex = /\[\!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = clickableImageRegex.exec(content)) !== null) {
      const altText = match[1] || '';
      const imageUrl = match[2] || '';
      const linkUrl = match[3] || '';
      const originalText = match[0];
      
      // Verifica che l'URL dell'immagine sia valido
      const normalizedImgUrl = this.normalizeImageUrl(imageUrl);
      
      if (normalizedImgUrl && !seenUrls.has(normalizedImgUrl)) {
        seenUrls.add(normalizedImgUrl);
        
        const id = this.generateImageId(normalizedImgUrl);
        images.push({
          id,
          url: normalizedImgUrl,
          altText,
          originalText,
          isClickable: true,
          linkUrl: REGEX_UTILS.sanitizeUrl(linkUrl),
          isInvalidImage: !this.isValidImageUrl(normalizedImgUrl),
          placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
        });
      }
    }
  }
  
  /**
   * Estrae immagini standard markdown
   * @private
   */
  extractMarkdownImages(content, images, seenUrls) {
    const standardImageRegex = /!\[([^\]]*)\]\(([^)]+)\)(?!\()/g;
    let match;
    
    while ((match = standardImageRegex.exec(content)) !== null) {
      const altText = match[1] || '';
      const imageUrl = match[2] || '';
      const originalText = match[0];
      
      const normalizedImgUrl = this.normalizeImageUrl(imageUrl);
      
      if (normalizedImgUrl && !seenUrls.has(normalizedImgUrl)) {
        seenUrls.add(normalizedImgUrl);
        
        const id = this.generateImageId(normalizedImgUrl);
        images.push({
          id,
          url: normalizedImgUrl,
          altText,
          originalText,
          isClickable: false,
          isInvalidImage: !this.isValidImageUrl(normalizedImgUrl),
          placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
        });
      }
    }
  }
  
  /**
   * Estrae immagini da tag HTML
   * @private
   */
  extractHtmlImages(content, images, seenUrls) {
    // Per ogni pattern HTML di immagini
    [
      REGEX_PATTERNS.IMAGE.HTML_IMG_DOUBLE_QUOTES,
      REGEX_PATTERNS.IMAGE.HTML_IMG_SINGLE_QUOTES,
      REGEX_PATTERNS.IMAGE.HTML_IMG_NO_QUOTES
    ].forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(content)) !== null) {
        const imageUrl = match[1] || '';
        const originalText = match[0];
        
        // Estrai attributo alt se presente
        const altMatch = originalText.match(/alt=["']([^"']*)["']/i);
        const altText = altMatch ? altMatch[1] : '';
        
        const normalizedImgUrl = this.normalizeImageUrl(imageUrl);
        
        if (normalizedImgUrl && !seenUrls.has(normalizedImgUrl)) {
          seenUrls.add(normalizedImgUrl);
          
          const id = this.generateImageId(normalizedImgUrl);
          images.push({
            id,
            url: normalizedImgUrl,
            altText,
            originalText,
            isClickable: false,
            isInvalidImage: !this.isValidImageUrl(normalizedImgUrl),
            placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
          });
        }
      }
    });
  }
  
  /**
   * Estrae URL diretti di immagini
   * @private
   */
  extractDirectImageUrls(content, images, seenUrls) {
    const imageRegex = REGEX_PATTERNS.IMAGE.RAW_IMAGE_URL;
    let match;
    
    while ((match = imageRegex.exec(content)) !== null) {
      const imageUrl = match[1] || '';
      const originalText = match[0];
      
      const normalizedImgUrl = this.normalizeImageUrl(imageUrl);
      
      if (normalizedImgUrl && !seenUrls.has(normalizedImgUrl)) {
        seenUrls.add(normalizedImgUrl);
        
        const id = this.generateImageId(normalizedImgUrl);
        images.push({
          id,
          url: normalizedImgUrl,
          altText: 'Image',  // Default alt text
          originalText,
          isClickable: false,
          isInvalidImage: !this.isValidImageUrl(normalizedImgUrl),
          placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
        });
      }
    }
  }
  
  /**
   * Verifica se un URL è un'immagine valida
   * @param {string} url - URL da verificare
   * @returns {boolean} - True se è un'immagine valida
   */
  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Trim the URL
    url = url.trim();
    
    // Reject invalid URLs
    if (url.length < 10) return false;
    
    try {
      // Check for common image file extensions
      const hasImageExtension = /\.(jpe?g|png|gif|webp|bmp|svg)(?:\?.*)?$/i.test(url);
      
      // Check for common image hosting domains
      const isImageHost = /(imgur\.com|steemitimages\.com|cdn\.steemitimages\.com|ibb\.co)/i.test(url);
      
      // Check for steemit CDN image URLs
      const isSteemitCDN = /steemitimages\.com\/.*(?:0x0|[0-9]+x[0-9]+)\/.*/.test(url) ||
        /steemitimages\.com\/DQm.*/.test(url);
      
      // Check for IPFS content
      const isIPFS = /ipfs\.[^\/]+\/ipfs\/\w+/.test(url);
      
      return hasImageExtension || isImageHost || isSteemitCDN || isIPFS;
    } catch (e) {
      console.error('Error validating image URL:', e);
      return false;
    }
  }
  
  /**
   * Normalizza l'URL dell'immagine
   * @param {string} url - URL originale
   * @returns {string} - URL normalizzato
   */
  normalizeImageUrl(url) {
    if (!url) return '';
    
    // Rimuovi eventuali virgolette
    url = url.trim().replace(/^["']|["']$/g, '');
    
    // Pulisci l'URL
    return REGEX_UTILS.sanitizeUrl(url);
  }
  
  /**
   * Ottimizza l'URL dell'immagine
   * @param {string} url - URL originale
   * @param {Object} options - Opzioni di ottimizzazione
   * @returns {string} - URL ottimizzato
   */
  optimizeImageUrl(url, options = {}) {
    // Imposta un limite massimo di dimensione per le immagini grandi
    const { width = 800, height = 0, maxWidth = 1200 } = options;
    
    // Se viene richiesta una larghezza superiore al maxWidth, usa maxWidth
    const targetWidth = Math.min(width, maxWidth);
    
    if (!url) return this.getDataUrlPlaceholder('No Image');
    
    // Early return for placeholders and failed images
    if (url.startsWith('data:') ||
        url.includes('/placeholder.png') ||
        url.includes('/default-avatar') ||
        SHARED_CACHE.failedImageUrls.has(url)) {
      return this.getDataUrlPlaceholder('No Image');
    }
    
    try {
      // Check cache first
      const cacheKey = `${url}_${width}x${height}`;
      if (SHARED_CACHE.optimizedUrls.has(cacheKey)) {
        return SHARED_CACHE.optimizedUrls.get(cacheKey);
      }
      
      // Clean URL
      url = REGEX_UTILS.sanitizeUrl(url);
      
      // Special handling for specific domains
      let optimizedUrl;
      
      // Discord URLs
      if (url.includes('media.discordapp.net') || url.includes('cdn.discordapp.com')) {
        // Rimuovi parametri esistenti per utilizzare l'immagine originale
        optimizedUrl = url.split('?')[0];
        SHARED_CACHE.optimizedUrls.set(cacheKey, optimizedUrl);
        return optimizedUrl;
      }
      
      // peakd.com URLs - return as is
      if (url.includes('files.peakd.com')) {
        return url;
      }
      
      // DQm format URLs - return as is
      if (url.includes('steemitimages.com/DQm') || url.includes('cdn.steemitimages.com/DQm')) {
        return url;
      }
      
      // Handle imgur URLs
      if (url.includes('imgur.com')) {
        const imgurId = url.match(/imgur\.com\/([a-zA-Z0-9]+)/i);
        if (imgurId && imgurId[1]) {
          // Usa l'immagine originale invece della thumbnail
          optimizedUrl = `https://i.imgur.com/${imgurId[1]}.jpg`;
          SHARED_CACHE.optimizedUrls.set(cacheKey, optimizedUrl);
          return optimizedUrl;
        }
      }
      
      // IMPORTANTE: Usa sempre height=0 per preservare aspect ratio
      optimizedUrl = `https://steemitimages.com/${targetWidth}x0/${url}`;
      SHARED_CACHE.optimizedUrls.set(cacheKey, optimizedUrl);
      return optimizedUrl;
      
    } catch (error) {
      console.error('Error optimizing URL:', url, error);
      return url;
    }
  }
  
  /**
   * Genera un placeholder con SVG per immagini mancanti
   * @param {string} text - Testo da visualizzare
   * @returns {string} - Data URL con SVG
   */
  getDataUrlPlaceholder(text = 'No Image') {
    const safeText = String(text).replace(/[^\w\s-]/g, '');
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect fill="%23f0f0f0" width="200" height="150"/><text fill="%23999999" font-family="sans-serif" font-size="18" text-anchor="middle" x="100" y="75">${safeText}</text></svg>`;
  }
  
  /**
   * Genera HTML per un'immagine standard
   * @param {Object} image - Informazioni sull'immagine
   * @param {Object} options - Opzioni di rendering
   * @returns {string} - Tag HTML per l'immagine
   */
  generateImageHtml(image, options) {
    // Se l'immagine è invalida, mostra un placeholder
    if (image.isInvalidImage) {
      return `<div class="markdown-invalid-img">
        <img src="${this.getDataUrlPlaceholder(image.altText || 'Invalid Image')}" 
          alt="${this.escapeHtml(image.altText)}" 
          class="markdown-img invalid-image-placeholder">
        <span class="invalid-image-note">Invalid image URL</span>
      </div>`;
    }
    
    // Ottimizza l'URL dell'immagine se richiesto
    const imageUrl = options.optimizeUrls ? 
      this.optimizeImageUrl(image.url) : image.url;
    
    // Crea srcset per immagini responsive
    const srcset = options.responsiveImages ? this.createSrcSet(imageUrl) : '';
    
    // Costruisci le classi CSS
    let cssClasses = 'markdown-img';
    if (options.addZoomClass) cssClasses += ' medium-zoom-image';
    
    // Aggiungi attributi per lazy loading
    const lazyAttr = options.lazyLoad ? 'loading="lazy"' : '';
    
    // Crea attributo srcset se disponibile
    const srcsetAttr = srcset ? `srcset="${srcset}"` : '';
    
    // Attributo sizes per responsive images
    const sizesAttr = srcset ? `sizes="(max-width: 768px) 100vw, 800px"` : '';
    
    // Attributi width e height per prevenire layout shift
    const aspectAttr = `style="max-width:${options.maxWidth}; aspect-ratio: auto;"`;
    
    // Gestisci errori di caricamento
    // const onErrorFunc = `onerror="this.onerror=null; this.src='${this.getDataUrlPlaceholder('Error')}'; ${SHARED_CACHE.failedImageUrls.add(image.url)}"`;
    
    // Genera il tag img con aspect ratio preservato
    const tagImg = `<img src="${imageUrl}" 
      alt="${this.escapeHtml(image.altText)}" 
      class="${cssClasses}" 
      ${lazyAttr} 
      ${srcsetAttr}
      ${sizesAttr}
      ${aspectAttr}>`;
    console.log(tagImg);
    return tagImg;
  }
  
  /**
   * Genera HTML per un'immagine cliccabile (con link)
   * @param {Object} image - Informazioni sull'immagine cliccabile
   * @param {Object} options - Opzioni di rendering
   * @returns {string} - HTML per l'immagine cliccabile
   */
  generateClickableImageHtml(image, options) {
    // Per immagini non valide, genera un banner-link più visibile
    if (image.isInvalidImage) {
      return `<a href="${image.linkUrl}" class="markdown-external-link image-link" target="_blank" rel="noopener noreferrer">
        <div class="preview-banner">
          <img src="${image.linkUrl}" class="link-preview-icon">
          <h4>${this.escapeHtml(image.altText || "Link esterno")}</h4>
          <p class="preview-url">${this.escapeHtml(image.linkUrl)}</p>
          <div class="image-link-overlay">
            <span class="image-link-icon">🔗</span>
          </div>
        </div>
      </a>`;
    }
    
    // Ottimizza l'URL dell'immagine se richiesto
    const imageUrl = options.optimizeUrls ? 
      this.optimizeImageUrl(image.url) : image.url;
    
    // Crea srcset per immagini responsive
    const srcset = options.responsiveImages ? this.createSrcSet(imageUrl) : '';
    
    // Costruisci le classi CSS
    let imgClasses = 'markdown-img clickable-img';
    if (options.addZoomClass) imgClasses += ' medium-zoom-image';
    
    // Costruisci le classi per il container
    let cssClasses = 'markdown-img';
    if (options.addZoomClass) cssClasses += ' medium-zoom-image';
    
    // Aggiungi attributi per lazy loading
    const lazyAttr = options.lazyLoad ? 'loading="lazy"' : '';
    
    // Crea attributo srcset se disponibile
    const srcsetAttr = srcset ? `srcset="${srcset}"` : '';
    
    // Attributo sizes per responsive images
    const sizesAttr = srcset ? `sizes="(max-width: 768px) 100vw, 800px"` : '';
    
    // Attributi width e height per prevenire layout shift
    const aspectAttr = `style="max-width:${options.maxWidth}; aspect-ratio: auto;"`;
    
    // Gestisci errori di caricamento
    // const onErrorFunc = `onerror="this.onerror=null; this.src='${this.getDataUrlPlaceholder('Error')}'; ${SHARED_CACHE.failedImageUrls.add(image.url)}"`;
    
    // Genera il tag img all'interno di un tag a
    const imgTag = `<img src="${imageUrl}" 
      alt="${this.escapeHtml(image.altText)}" 
      class="${imgClasses}" 
      ${lazyAttr} 
      ${srcsetAttr}
      ${sizesAttr}
      ${aspectAttr}>`;
    
    // IMPORTANTE: Avvolgi l'immagine in un tag <a> per renderla cliccabile
    const clicable = `<a href="${image.linkUrl}" class="img-link-container" target="_blank" rel="noopener noreferrer">
      ${imgTag}
      <div class="img-link-indicator">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </a>`;
    console.log(clicable);
    return clicable;
  }
  
  /**
   * Crea valori srcset per immagini responsive
   * @param {string} url - URL dell'immagine
   * @returns {string} - Valori srcset
   */
  createSrcSet(url) {
    // Non creare srcset per URL che non sono di steemitimages o peakd
    if (!url.includes('steemitimages.com') && 
        !url.includes('cdn.steemitimages.com') &&
        !url.includes('files.peakd.com')) {
      return '';
    }
    
    let baseUrl = url;
    
    // Per le immagini steemitimages.com, ottimizza per diverse dimensioni
    if (url.includes('steemitimages.com') || url.includes('cdn.steemitimages.com')) {
      // Rimuovi dimensioni esistenti
      if (baseUrl.includes('steemitimages.com/0x0/')) {
        baseUrl = baseUrl.replace('0x0/', '');
      }
      
      // Crea versioni di diverse dimensioni
      const smallUrl = `https://steemitimages.com/400x0/${baseUrl}`;
      const mediumUrl = `https://steemitimages.com/800x0/${baseUrl}`;
      const largeUrl = `https://steemitimages.com/1200x0/${baseUrl}`;
      
      return `${smallUrl} 400w, ${mediumUrl} 800w, ${largeUrl} 1200w`;
    }
    
    return '';
  }
  
  /**
   * Sostituisci le immagini con placeholder
   * @param {string} content - Contenuto originale
   * @param {Array<Object>} images - Informazioni sulle immagini
   * @returns {string} - Contenuto con placeholder
   */
  createPlaceholders(content, images) {
    if (!images || images.length === 0) return content;
    
    let processedContent = content;
    
    images.forEach(image => {
      // Escape caratteri speciali per regex
      const escapedText = REGEX_UTILS.escapeRegExp(image.originalText);
      const textRegex = new RegExp(escapedText, 'g');
      
      // Sostituisci il testo originale con il placeholder
      processedContent = processedContent.replace(textRegex, image.placeholder);
    });
    
    return processedContent;
  }
  
  /**
   * Ripristina i placeholder con tag HTML immagine
   * @param {string} content - Contenuto con placeholder
   * @param {Array<Object>} images - Informazioni sulle immagini
   * @param {Object} options - Opzioni di rendering
   * @returns {string} - Contenuto con tag HTML immagine
   */
  restoreContent(content, images, options = {}) {
    if (!images || images.length === 0) return content;
    
    // Combina le opzioni predefinite con quelle passate
    const renderOptions = { ...this.config, ...options };
    
    let processedContent = content;
    
    images.forEach(image => {
      let imgHtml;
      
      // Gestisci le immagini in tag HTML
      if (image.isInHtmlTag) {
        imgHtml = this.generateHtmlWrappedImageHtml(image, renderOptions);
      } else if (image.isClickable) {
        imgHtml = this.generateClickableImageHtml(image, renderOptions);
      } else {
        imgHtml = this.generateImageHtml(image, renderOptions);
      }
      
      const placeholderRegex = new RegExp(REGEX_UTILS.escapeRegExp(image.placeholder), 'g');
      processedContent = processedContent.replace(placeholderRegex, imgHtml);
    });
    
    return processedContent;
  }
  
  /**
   * Genera un ID univoco per l'immagine basato sull'URL
   * @param {string} url - URL dell'immagine
   * @returns {string} - ID univoco
   */
  generateImageId(url) {
    // Crea un hash semplice dall'URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Converti in integer a 32 bit
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }
  
  /**
   * Escape caratteri HTML speciali
   * @param {string} html - Testo da sanitizzare
   * @returns {string} - Testo sanitizzato
   */
  escapeHtml(html) {
    return String(html)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Estrae tag HTML che contengono immagini markdown
   * @private
   */
  extractHtmlWithMarkdown(content, images, seenUrls) {
    // Cerca tag HTML comuni che possono contenere markdown
    const htmlTagRegex = /<(center|div|span|p)([^>]*)>([\s\S]*?)<\/\1>/gi;
    let processedContent = content;
    let match;
    
    while ((match = htmlTagRegex.exec(content)) !== null) {
      const tagName = match[1];
      const tagAttrs = match[2];
      const innerContent = match[3];
      const fullMatch = match[0];
      
      // Verifica se il contenuto interno contiene un'immagine cliccabile
      if (innerContent.includes('[![') && innerContent.includes(')](')) {
        const clickableImageRegex = /\[\!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g;
        let imgMatch;
        
        if ((imgMatch = clickableImageRegex.exec(innerContent)) !== null) {
          const altText = imgMatch[1] || '';
          const imageUrl = imgMatch[2] || '';
          const linkUrl = imgMatch[3] || '';
          const originalImgText = imgMatch[0];
          
          // Verifica che l'URL dell'immagine sia valido
          const normalizedImgUrl = this.normalizeImageUrl(imageUrl);
          
          if (normalizedImgUrl && !seenUrls.has(normalizedImgUrl)) {
            seenUrls.add(normalizedImgUrl);
            
            const id = this.generateImageId(normalizedImgUrl);
            
            // Costruisci un oggetto immagine che include l'HTML circostante
            images.push({
              id,
              url: normalizedImgUrl,
              altText,
              originalText: fullMatch, // Usa l'intero match HTML
              innerMarkdown: originalImgText,
              isClickable: true,
              isInHtmlTag: true,
              htmlTag: tagName,
              htmlAttrs: tagAttrs,
              linkUrl: REGEX_UTILS.sanitizeUrl(linkUrl),
              isInvalidImage: !this.isValidImageUrl(normalizedImgUrl),
              placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
            });
            
            // Non elaborare più questa immagine come immagine markdown normale
            // Sostituisci tutto il tag HTML con un placeholder
            const escapedMatch = REGEX_UTILS.escapeRegExp(fullMatch);
            const fullTagRegex = new RegExp(escapedMatch, 'g');
            processedContent = processedContent.replace(fullTagRegex, `${this.placeholderPrefix}${id}${this.placeholderSuffix}`);
          }
        }
      }
    }
    
    return processedContent;
  }

  /**
   * Genera HTML per un'immagine cliccabile dentro un tag HTML
   * @param {Object} image - Informazioni sull'immagine
   * @param {Object} options - Opzioni di rendering
   * @returns {string} - HTML completo
   */
  generateHtmlWrappedImageHtml(image, options) {
    // Genera prima l'immagine cliccabile interna
    const innerHtml = this.generateClickableImageHtml({
      ...image,
      originalText: image.innerMarkdown,
      isClickable: true
    }, options);
    
    // Avvolgi l'immagine nel tag HTML originale
    return `<${image.htmlTag}${image.htmlAttrs}>${innerHtml}</${image.htmlTag}>`;
  }

  /**
   * Trova le immagini duplicate nel contenuto
   * @param {Array<Object>} images - Array di oggetti immagine
   * @returns {Array<Object>} Immagini senza duplicati
   */
  removeDuplicateImages(images) {
    const uniqueUrls = new Set();
    return images.filter(img => {
      // Se l'URL è già stato visto, è un duplicato
      if (uniqueUrls.has(img.url)) {
        return false;
      }
      
      uniqueUrls.add(img.url);
      return true;
    });
  }
}