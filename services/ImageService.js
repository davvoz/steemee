import PluginSystem from '../utils/markdown/PluginSystem.js';
import ImagePlugin from '../utils/markdown/plugins/ImagePlugin.js';

/**
 * Servizio centralizzato per la gestione delle immagini
 * Incorpora le funzionalità precedentemente in ImageUtils
 */
class ImageService {
  constructor() {
    // Sistema di plugin per l'elaborazione delle immagini
    this.pluginSystem = new PluginSystem();
    this.imagePlugin = new ImagePlugin();
    this.pluginSystem.registerPlugin(this.imagePlugin);
    
    // Cache per URL falliti e ottimizzati
    this.failedImageUrls = new Set();
    this.cachedUrls = new Map();
  }

  /**
   * Estrae la prima immagine dal contenuto
   * @param {Object} post - Post da cui estrarre l'immagine
   * @returns {string|null} URL dell'immagine estratta o null
   */
  extractImageFromContent(post) {
    if (!post || !post.body) return null;

    try {
      // Utilizziamo il plugin per estrarre le immagini
      const images = this.imagePlugin.extract(post.body);
      
      // Restituisce il primo URL immagine valido
      if (images && images.length > 0) {
        return this.sanitizeUrl(images[0].url);
      }

      // Fallback ai metodi standard
      // Prova a trovare immagine Markdown
      const markdownMatch = post.body.match(/!\[.*?\]\((.*?)\)/);
      if (markdownMatch) return this.sanitizeUrl(markdownMatch[1]);

      // Prova a trovare immagine HTML
      const htmlMatch = post.body.match(/<img[^>]+src="([^">]+)"/);
      if (htmlMatch) return this.sanitizeUrl(htmlMatch[1]);

      // Prova a trovare href con link immagine
      const htmlMatch2 = post.body.match(/href="([^"]+\.(?:jpg|png|jpeg|gif|webp)[^"]*)"[^>]*>/i);
      if (htmlMatch2) return this.sanitizeUrl(htmlMatch2[1]);
      
      // Prova a trovare URL raw
      const urlMatch = post.body.match(/(https?:\/\/[^\s<>"']*\.(?:jpg|png|jpeg|gif|webp)(\?[^\s<>"']*)?)/i);
      if (urlMatch) return this.sanitizeUrl(urlMatch[1]);

      return null;
    } catch (error) {
      console.warn('Failed to extract image from content:', error);
      return null;
    }
  }

  /**
   * Ottiene l'immagine migliore per un post
   * @param {string} content - Contenuto del post
   * @param {object} metadata - Metadati del post
   * @returns {string|null} - Miglior URL immagine o null
   */
  getBestImageUrl(content, metadata) {
    // Crea un array per memorizzare tutte le potenziali URL con priorità
    const candidates = [];

    // 1. Controlla prima i metadati (priorità più alta)
    if (metadata) {
      // Campo immagine standard
      if (metadata.image && metadata.image.length > 0) {
        candidates.push({ url: metadata.image[0], priority: 10 });
      }

      // Campo thumbnail
      if (metadata.thumbnail) {
        candidates.push({ url: metadata.thumbnail, priority: 9 });
      }

      // Formato Steemit/Condenser nei metadati
      if (metadata.links && Array.isArray(metadata.links)) {
        metadata.links.forEach(link => {
          if (this.isValidImageUrl(link)) {
            candidates.push({ url: link, priority: 8 });
          }
        });
      }
    }

    // 2. Estrai URL immagini dal contenuto
    const contentImages = this.imagePlugin.extract(content);

    // Aggiungi immagini estratte ai candidati con priorità più bassa
    contentImages.forEach((image, index) => {
      // La prima immagine ha priorità più alta
      const priority = 7 - Math.min(index, 6);
      candidates.push({ url: image.url, priority });
    });

    // Ordina candidati per priorità (più alta prima)
    candidates.sort((a, b) => b.priority - a.priority);

    // Restituisci l'URL con priorità più alta o null se non trovato
    return candidates.length > 0 ? this.sanitizeUrl(candidates[0].url) : null;
  }

  /**
   * Ottimizza l'URL dell'immagine specificamente per Steem
   */
  optimizeImageUrl(url, options = {}) {
    // Default per immagini di qualità superiore (640px di larghezza)
    const { width = 640, height = 0 } = options;

    if (!url) return this.getDataUrlPlaceholder();

    // Return anticipato per placeholder e immagini fallite
    if (url.startsWith('data:') ||
      url.includes('/placeholder.png') ||
      url.includes('/default-avatar') ||
      this.failedImageUrls.has(url)) {
      return this.getDataUrlPlaceholder();
    }

    try {
      // Controllo prima la cache URL
      const cacheKey = `${url}_${width}x${height}`;
      if (this.cachedUrls.has(cacheKey)) {
        return this.cachedUrls.get(cacheKey);
      }

      // Passo 1: Pulisci l'URL
      url = this.sanitizeUrl(url);
      
      // Gestione speciale per URL peakd.com - restituisci così com'è
      if (url.includes('files.peakd.com')) {
        this.cachedUrls.set(cacheKey, url);
        return url;
      }
      
      // Gestione speciale per URL in formato DQm da steemitimages.com
      if (url.includes('steemitimages.com/DQm') || url.includes('cdn.steemitimages.com/DQm')) {
        this.cachedUrls.set(cacheKey, url);
        return url;
      }

      // Passo 2: Elabora URL steemitimages
      if (url.includes('steemitimages.com') || url.includes('cdn.steemitimages.com')) {
        let result = null;

        // Gestisci URL già proxy
        if (url.match(/steemitimages\.com\/\d+x\d+\//)) {
          // Estrai la parte URL originale
          const matches = url.match(/steemitimages\.com\/\d+x\d+\/(.*)/i);
          if (matches && matches[1]) {
            // Usa ridimensionamento di qualità superiore
            result = `https://steemitimages.com/${width}x${height}/${matches[1]}`;
          }
        }
        // Gestisci URL steemitimages diretti
        else {
          // Estrai parte del percorso
          const matches = url.match(/https?:\/\/[^\/]+(\/.*)/i);
          if (matches && matches[1]) {
            result = `https://steemitimages.com/${width}x${height}${matches[1]}`;
          } else {
            result = `https://steemitimages.com/${width}x${height}/${url}`;
          }
        }

        // Salva in cache e restituisci
        if (result) {
          this.cachedUrls.set(cacheKey, result);
          return result;
        }
      }

      // Passo 3: Per URL imgur, usa formato diretto con qualità migliore
      if (url.includes('imgur.com')) {
        const imgurId = url.match(/imgur\.com\/([a-zA-Z0-9]+)/i);
        if (imgurId && imgurId[1]) {
          // Usa dimensione grande (l) invece di medium (m) per qualità migliore
          const imgurUrl = `https://i.imgur.com/${imgurId[1]}l.jpg`;
          this.cachedUrls.set(cacheKey, imgurUrl);
          return imgurUrl;
        }
      }

      // Passo 4: Per tutti gli altri URL, usa proxy Steem
      const optimizedUrl = `https://steemitimages.com/${width}x${height}/${url}`;
      this.cachedUrls.set(cacheKey, optimizedUrl);
      return optimizedUrl;

    } catch (error) {
      console.error('Error optimizing URL:', url, error);
      return url;
    }
  }

  /**
   * Sanitizzatore URL migliorato
   */
  sanitizeUrl(url) {
    if (!url) return url;

    try {
      // Assicurati che sia una stringa
      url = String(url).trim();

      // Risolvi problemi di protocollo
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (!url.startsWith('http')) {
        // Se nessun protocollo, presumi https
        url = 'https://' + url;
      }

      // Risolvi doppi slash dopo il dominio (ma preserva // del protocollo)
      url = url.replace(/(https?:\/\/)([^\/]+)\/+/g, '$1$2/');

      // Rimuovi slash aggiuntivi nel resto dell'URL
      const urlParts = url.split('://');
      if (urlParts.length > 1) {
        const protocol = urlParts[0];
        let path = urlParts[1];
        path = path.replace(/([^:])\/+/g, '$1/');
        url = protocol + '://' + path;
      }

      // Risolvi entity HTML comuni
      url = url.replace(/&amp;/g, '&');

      // Gestisci caratteri URL encoded
      if (url.includes('%')) {
        // Non fare double-decode
        if (/%[0-9A-F]{2}/.test(url)) {
          try {
            url = decodeURIComponent(url);
          } catch (e) {
            // Ignora errori di decode
          }
        }
      }

      return url;
    } catch (e) {
      console.warn('Error sanitizing URL:', e);
      return url;
    }
  }

  /**
   * Validazione più completa per URL immagini
   */
  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // Taglia l'URL
    url = url.trim();

    // Rifiuta URL non validi
    if (url.length < 10) return false;

    try {
      // Controlla estensioni file immagine comuni
      const hasImageExtension = /\.(jpe?g|png|gif|webp|bmp|svg)(?:\?.*)?$/i.test(url);

      // Controlla domini hosting immagini comuni
      const isImageHost = /(imgur\.com|steemitimages\.com|cdn\.steemitimages\.com|ibb\.co)/i.test(url);

      // Controlla URL immagini CDN steemit (formato DQm...)
      const isSteemitCDN = /steemitimages\.com\/.*(?:0x0|[0-9]+x[0-9]+)\/.*/.test(url) ||
        /steemitimages\.com\/DQm.*/.test(url);

      // Controlla identificatori contenuti IPFS diretti
      const isIPFS = /ipfs\.[^\/]+\/ipfs\/\w+/.test(url);

      return hasImageExtension || isImageHost || isSteemitCDN || isIPFS;
    } catch (e) {
      console.error('Error validating image URL:', e);
      return false;
    }
  }

  /**
   * Metodo per tracciare URL immagini fallite per evitare di riprovare
   */
  markImageAsFailed(url) {
    if (url && typeof url === 'string') {
      this.failedImageUrls.add(url);
    }
  }

  /**
   * Semplice placeholder data URL
   */
  getDataUrlPlaceholder(text = 'No Image') {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect fill="%23f0f0f0" width="200" height="150"/><text fill="%23999999" font-family="sans-serif" font-size="18" text-anchor="middle" x="100" y="75">${text}</text></svg>`;
  }
}

// Esporta un'istanza singleton
export default new ImageService();
