import ImagePlugin from '../utils/markdown/plugins/ImagePlugin.js';

/**
 * Servizio centralizzato per la gestione delle immagini
 * Fornisce un'interfaccia unificata per tutte le operazioni sulle immagini
 */
class ImageService {
  constructor() {
    // Inizializza un'istanza di ImagePlugin da utilizzare per tutte le operazioni
    this.imagePlugin = new ImagePlugin();
    
    // Cache per immagini fallite
    this.failedImages = new Set();
    
    // Cache per URL ottimizzati
    this.optimizedUrlCache = new Map();

    // Configurazione predefinita per il rendering delle immagini
    this.defaultConfig = {
      cardSize: {
        width: 640,
        height: 0,
        quality: 95
      },
      postSize: {
        width: 800,
        height: 0,
        quality: 100
      },
      thumbnailSize: {
        width: 320,
        height: 0,
        quality: 90
      }
    };
  }
  
  /**
   * Estrae tutte le URL delle immagini dal contenuto
   * @param {string} content - Contenuto da cui estrarre le immagini
   * @returns {Array<string>} Array di URL di immagini
   */
  extractAllImageUrls(content) {
    const images = this.imagePlugin.extract(content);
    return images.map(img => img.url);
  }
  
  /**
   * Estrae la prima immagine dal contenuto
   * @param {string} post - Post o contenuto da cui estrarre l'immagine
   * @returns {string|null} URL della prima immagine o null
   */
  extractImageFromContent(post) {
    const content = post?.body || post;
    if (!content) return null;
    
    const images = this.imagePlugin.extract(content);
    return images.length > 0 ? images[0].url : null;
  }
  
  /**
   * Ottiene l'immagine migliore da un post in base a metadati e contenuto
   * @param {string} body - Corpo del post
   * @param {Object} metadata - Metadati del post
   * @returns {string|null} URL della migliore immagine o null
   */
  getBestImageUrl(body, metadata = {}) {
    // Prima controlla i metadati
    if (metadata && metadata.image && metadata.image.length > 0) {
      return metadata.image[0];
    }
    
    // Altrimenti estrai dal contenuto
    return this.extractImageFromContent(body);
  }
  
  /**
   * Ottimizza l'URL di un'immagine per le diverse dimensioni e CDN
   * @param {string} url - URL dell'immagine da ottimizzare
   * @param {Object} options - Opzioni di ottimizzazione
   * @returns {string} URL ottimizzato
   */
  optimizeImageUrl(url, options = {}) {
    if (!url) return '';
    
    // Sanitizza l'URL prima di iniziare
    url = this.sanitizeUrl(url);
    
    // Se l'URL è già stato ottimizzato, restituiscilo direttamente dalla cache
    if (this.optimizedUrlCache.has(url)) {
      return this.optimizedUrlCache.get(url);
    }
    
    const { width = 800, height = 0, mode = 'fit' } = options;
    
    // NON modificare gli URL che sono già ottimizzati o quelli diretti di Steemit
    if (url.includes('/DQm') && (
        url.includes('steemitimages.com') || 
        url.includes('cdn.steemitimages.com'))) {
      this.optimizedUrlCache.set(url, url);
      return url;
    }
    
    // NON modificare gli URL che hanno già un proxy di dimensioni
    if (url.match(/steemitimages\.com\/[0-9]+x[0-9]+\//)) {
      this.optimizedUrlCache.set(url, url);
      return url;
    }
    
    // Ottimizza gli URL per il CDN di Steemit
    let optimizedUrl = url;
    
    // Aggiungi il proxy per ottimizzare le dimensioni SOLO se necessario
    if (width > 0 && !url.includes('steemitimages.com/')) {
      optimizedUrl = `https://steemitimages.com/${width}x${height}/${url}`;
    }
    
    // Memorizza l'URL ottimizzato in cache
    this.optimizedUrlCache.set(url, optimizedUrl);
    
    return optimizedUrl;
  }
  
  /**
   * Segna un'immagine come fallita per evitare futuri tentativi di caricamento
   * @param {string} url - URL dell'immagine fallita
   */
  markImageAsFailed(url) {
    this.failedImages.add(url);
  }
  
  /**
   * Verifica se un'immagine è stata segnata come fallita
   * @param {string} url - URL dell'immagine da verificare
   * @returns {boolean} true se l'immagine è fallita
   */
  isImageFailed(url) {
    return this.failedImages.has(url);
  }
  
  /**
   * Genera un placeholder per immagini non disponibili
   * @param {string} text - Testo da mostrare nel placeholder
   * @returns {string} Data URL con SVG placeholder
   */
  getDataUrlPlaceholder(text = 'No Image') {
    return this.imagePlugin.getDataUrlPlaceholder(text);
  }
  
  /**
   * Sanitizza un URL di immagine
   * @param {string} url - URL da sanitizzare
   * @returns {string} URL sanitizzato
   */
  sanitizeUrl(url) {
    // Usa il REGEX_UTILS dal plugin se disponibile
    if (this.imagePlugin.normalizeImageUrl) {
      return this.imagePlugin.normalizeImageUrl(url);
    }
    
    // Implementazione di fallback
    if (!url || url.startsWith('data:')) return url;
    
    try {
      // Fix double slashes (except after protocol)
      url = url.replace(/:\/\/+/g, '://').replace(/([^:])\/+/g, '$1/');
      
      // Fix missing protocol
      if (url.startsWith('//')) {
        url = 'https:' + url;
      }
      
      return url;
    } catch (e) {
      console.error('Error sanitizing URL:', e);
      return url;
    }
  }

  /**
   * Processa un'immagine per la visualizzazione in card (HomeView)
   */
  processCardImage(url, layout = 'grid') {
    if (!url) return this.getDataUrlPlaceholder('No Image');
    
    // Usa la cache esistente
    const cacheKey = `card_${layout}_${url}`;
    if (this.optimizedUrlCache.has(cacheKey)) {
      return this.optimizedUrlCache.get(cacheKey);
    }

    // Seleziona dimensioni appropriate in base al layout
    const sizes = {
      grid: { width: 640, height: 0 },
      list: { width: 800, height: 0 },
      compact: { width: 320, height: 0 }
    };
    
    const size = sizes[layout] || this.defaultConfig.cardSize;
    const optimizedUrl = this.optimizeImageUrl(url, size);
    
    this.optimizedUrlCache.set(cacheKey, optimizedUrl);
    return optimizedUrl;
  }

  /**
   * Processa un'immagine per la visualizzazione nel post (ContentRenderer)
   */
  processPostImage(url, options = {}) {
    if (!url) return this.getDataUrlPlaceholder('No Image');
    
    const cacheKey = `post_${url}`;
    if (this.optimizedUrlCache.has(cacheKey)) {
      return this.optimizedUrlCache.get(cacheKey);
    }

    const size = { ...this.defaultConfig.postSize, ...options };
    const optimizedUrl = this.optimizeImageUrl(url, size);
    
    this.optimizedUrlCache.set(cacheKey, optimizedUrl);
    return optimizedUrl;
  }

  /**
   * Processa un'immagine e crea un set di sorgenti responsive
   */
  createResponsiveSrcSet(url) {
    if (!url) return '';
    if (!this.isOptimizableUrl(url)) return '';

    const cacheKey = `srcset_${url}`;
    if (this.optimizedUrlCache.has(cacheKey)) {
      return this.optimizedUrlCache.get(cacheKey);
    }

    const sizes = [
      { width: 400, suffix: '400w' },
      { width: 800, suffix: '800w' },
      { width: 1200, suffix: '1200w' }
    ];

    const srcset = sizes
      .map(size => `${this.optimizeImageUrl(url, { width: size.width })} ${size.suffix}`)
      .join(', ');

    this.optimizedUrlCache.set(cacheKey, srcset);
    return srcset;
  }

  /**
   * Verifica se un URL può essere ottimizzato (steemit, peakd, etc.)
   */
  isOptimizableUrl(url) {
    return url.includes('steemitimages.com') || 
           url.includes('cdn.steemitimages.com') ||
           url.includes('files.peakd.com');
  }
}

// Esporta un'istanza singleton per utilizzarla in tutta l'applicazione
const imageService = new ImageService();
export default imageService;
