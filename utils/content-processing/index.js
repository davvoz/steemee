import { processMarkdown } from './markdown-processor.js';
import { processEmbeds } from './embed-processor.js';
import { optimizeImages } from './image-processor.js';
import { sanitizeHTML } from './sanitizer.js';
import { postProcess } from './post-processor.js';

/**
 * Elaboratore di contenuti principale che gestisce l'intera pipeline di rendering
 */
export class ContentProcessor {
  constructor(options = {}) {
    this.options = {
      enableImages: true,
      enableVideos: true,
      enableLinks: true,
      proxyImages: true,
      maxImageWidth: 800,
      allowHtml: false,
      debug: false,
      ...options
    };
    
    // Collezioni per tracciamento
    this.images = new Set();
    this.videos = new Set();
    this.links = new Set();
    this.mentions = new Set();
    this.tags = new Set();
  }
  
  /**
   * Elabora il contenuto attraverso l'intera pipeline
   * @param {string} content - Contenuto markdown o HTML da elaborare
   * @param {Object} metadata - Metadati opzionali del post
   * @returns {Object} Risultato dell'elaborazione
   */
  process(content, metadata = {}) {
    // Debug originale
    if (this.options.debug) {
      console.log('%c ------------- CONTENUTO ORIGINALE -------------', 'background: #333; color: #bada55');
      console.log(content);
    }
    
    if (!content) return { html: '', images: [], videos: [], links: [] };
    
    try {
      // Fase 1: Conversione da Markdown a HTML Base
      let html = processMarkdown(content, {
        allowHtml: this.options.allowHtml,
        breaks: true
      });
      
      if (this.options.debug) {
        console.log('%c ------------- DOPO MARKDOWN -------------', 'background: #333; color: #FFA500');
        console.log(html);
      }
      
      // Fase 2: Elaborazione Embed (YouTube, Vimeo, ecc.)
      const embedResult = processEmbeds(html, {
        enableVideos: this.options.enableVideos,
        enableVimeo: this.options.enableVideos,
        enableThreeSpeak: this.options.enableVideos
      });
      html = embedResult.html;
      
      // Aggiorna le collezioni
      this.mergeCollections(embedResult);
      
      if (this.options.debug) {
        console.log('%c ------------- DOPO EMBED -------------', 'background: #333; color: #FF6347');
        console.log(html);
        console.log('Placeholder trovati:', embedResult.placeholders?.length || 0);
      }
      
      // Fase 3: Ottimizzazione immagini
      const imageResult = optimizeImages(html, {
        proxyImages: this.options.proxyImages,
        maxWidth: this.options.maxImageWidth,
        enableImages: this.options.enableImages
      });
      html = imageResult.html;
      
      // Aggiorna le collezioni
      this.mergeCollections(imageResult);
      
      if (this.options.debug) {
        console.log('%c ------------- DOPO IMMAGINI -------------', 'background: #333; color: #4CAF50');
        console.log(html);
      }
      
      // Fase 4: Sanitizzazione HTML
      html = sanitizeHTML(html, {
        allowedTags: this.getAllowedTags(),
        allowedAttributes: this.getAllowedAttributes(),
        transformTags: this.getTagTransformers()
      });
      
      if (this.options.debug) {
        console.log('%c ------------- DOPO SANITIZE -------------', 'background: #333; color: #2196F3');
        console.log(html);
      }
      
      // Fase 5: Post-processing (sostituzione placeholder con embed effettivi)
      const finalResult = postProcess(html, {
        embedPlaceholders: embedResult.placeholders || []
      });
      html = finalResult.html;
      
      // Aggiorna le collezioni
      this.mergeCollections(finalResult);
      
      if (this.options.debug) {
        console.log('%c ------------- RISULTATO FINALE -------------', 'background: #333; color: #9C27B0');
        console.log(html);
      }
      
      // Crea elemento DOM
      const container = document.createElement('div');
      container.className = 'content-container markdown-body';
      container.innerHTML = html;
      
      // Migliora le immagini con interazioni avanzate
      this.enhanceImages(container);
      
      return {
        container,
        html,
        images: [...this.images],
        videos: [...this.videos],
        links: [...this.links],
        mentions: [...this.mentions],
        tags: [...this.tags]
      };
    } catch (error) {
      console.error('Errore nell\'elaborazione del contenuto:', error);
      const container = document.createElement('div');
      container.className = 'content-error';
      container.textContent = `Si è verificato un errore nell'elaborazione del contenuto: ${error.message}`;
      return {
        container,
        html: container.outerHTML,
        error,
        images: [],
        videos: [],
        links: []
      };
    }
  }
  
  /**
   * Aggiunge interazioni avanzate alle immagini
   */
  enhanceImages(container) {
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      // Salva l'URL originale
      const originalSrc = img.getAttribute('src');
      const originalAlt = img.getAttribute('alt') || 'Image';
      
      // Crea il wrapper container
      const wrapper = document.createElement('div');
      wrapper.className = 'img-container';
      wrapper.style.position = 'relative';
      wrapper.style.margin = '1rem 0';
      wrapper.style.maxWidth = '100%';
      
      // Sostituisci l'immagine con una versione migliorata
      img.className = 'content-image';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = '0 auto';
      img.style.borderRadius = '4px';
      
      // Aggiungi i dati originali per riferimento futuro
      img.setAttribute('data-original-src', originalSrc);
      
      // Aggiungi il pulsante di apertura
      const openButton = document.createElement('button');
      openButton.className = 'open-image-button';
      openButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"></path></svg>';
      openButton.style.position = 'absolute';
      openButton.style.top = '8px';
      openButton.style.right = '8px';
      openButton.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
      openButton.style.border = 'none';
      openButton.style.borderRadius = '50%';
      openButton.style.width = '32px';
      openButton.style.height = '32px';
      openButton.style.cursor = 'pointer';
      openButton.style.display = 'flex';
      openButton.style.alignItems = 'center';
      openButton.style.justifyContent = 'center';
      openButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      openButton.title = 'Open image in new tab';
      
      // Evento click
      openButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(originalSrc, '_blank');
      });
      
      // Assembla il wrapper
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      wrapper.appendChild(openButton);
    });
  }
  
  /**
   * Unisce le collezioni provenienti dalle varie fasi di elaborazione
   */
  mergeCollections(result) {
    if (!result) return;
    
    const collectionsMap = {
      'images': this.images,
      'videos': this.videos,
      'links': this.links,
      'mentions': this.mentions,
      'tags': this.tags
    };
    
    Object.entries(collectionsMap).forEach(([key, collection]) => {
      const resultCollection = result[key];
      if (!resultCollection) return;
      
      if (Array.isArray(resultCollection)) {
        resultCollection.forEach(item => collection.add(item));
      } else if (resultCollection instanceof Set) {
        resultCollection.forEach(item => collection.add(item));
      }
    });
  }
  
  /**
   * Ottiene la configurazione whitelist per i tag consentiti
   */
  getAllowedTags() {
    return [
      'div', 'iframe', 'del', 'a', 'p', 'b', 'i', 'q', 'br', 'ul', 'li', 'ol', 'img', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'blockquote', 'pre', 'code', 'em', 
      'strong', 'center', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'strike', 'sup', 'sub'
    ];
  }
  
  /**
   * Ottiene la configurazione whitelist per gli attributi consentiti
   */
  getAllowedAttributes() {
    return {
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'class', 'data-original-src'],
      a: ['href', 'title', 'target', 'rel', 'class'],
      div: ['class', 'style', 'data-embed-id', 'data-embed-type', 'data-start-time'],
      iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'class', 'allow', 'loading'],
      td: ['style', 'colspan', 'rowspan'],
      th: ['style', 'colspan', 'rowspan']
    };
  }
  
  /**
   * Ottiene i trasformatori tag per la sanitizzazione
   */
  getTagTransformers() {
    return {
      a: (tagName, attribs) => {
        const href = attribs.href || '#';
        const attys = { ...attribs, href };
        
        // Se non è un link interno, aggiungi target e rel
        if (!/^(\/|\#)/.test(href)) {
          attys.target = '_blank';
          attys.rel = 'nofollow noopener';
          
          // Controlla per link potenzialmente pericolosi
          if (this.isPotentialPhishingLink(href)) {
            attys.href = '#';
            attys.title = 'Link potenzialmente pericoloso rimosso';
            attys['data-original-href'] = href;
            attys.class = (attys.class || '') + ' phishy-link';
          }
        }
        
        return {
          tagName,
          attribs: attys
        };
      }
    };
  }
  
  /**
   * Controlla se un URL è potenzialmente pericoloso
   */
  isPotentialPhishingLink(url) {
    const phishingDomains = [
      'steemit.com.com',
      'steemit.com.co',
      'wallet.steeemit.com',
      'steeemit.com'
    ];
    
    try {
      return phishingDomains.some(domain => url.includes(domain));
    } catch (e) {
      return false;
    }
  }
}

// Esporta anche funzioni singole
export { processMarkdown, processEmbeds, optimizeImages, sanitizeHTML, postProcess };