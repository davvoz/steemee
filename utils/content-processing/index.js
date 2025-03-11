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
    if (!content) return { html: '', images: [], videos: [], links: [] };
    
    try {
      // Fase 1: Conversione da Markdown a HTML Base
      let html = processMarkdown(content, {
        allowHtml: this.options.allowHtml,
        breaks: true
      });
      
      // Fase 2: Elaborazione Embed
      const embedResult = processEmbeds(html, {
        enableVideos: this.options.enableVideos
      });
      html = embedResult.html;
      
      // Aggiorna le collezioni con i risultati degli embed
      this.mergeCollections(embedResult);
      
      // Fase 3: Ottimizzazione immagini
      const imageResult = optimizeImages(html, {
        proxyImages: this.options.proxyImages,
        maxWidth: this.options.maxImageWidth,
        enableImages: this.options.enableImages
      });
      html = imageResult.html;
      
      // Aggiorna le collezioni con i risultati delle immagini
      this.mergeCollections(imageResult);
      
      // Fase 4: Sanitizzazione HTML
      html = sanitizeHTML(html, {
        allowedTags: this.getAllowedTags(),
        allowedAttributes: this.getAllowedAttributes(),
        transformTags: this.getTagTransformers()
      });
      
      // Fase 5: Post-processing
      const finalResult = postProcess(html, {
        embedPlaceholders: embedResult.placeholders || []
      });
      html = finalResult.html;
      
      // Aggiorna le collezioni
      this.mergeCollections(finalResult);
      
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
    
    if (result.images) {
      if (Array.isArray(result.images)) {
        result.images.forEach(img => this.images.add(img));
      } else if (typeof result.images === 'object' && result.images.forEach) {
        result.images.forEach(img => this.images.add(img));
      }
    }
    
    if (result.videos) {
      if (Array.isArray(result.videos)) {
        result.videos.forEach(vid => this.videos.add(vid));
      } else if (typeof result.videos === 'object' && result.videos.forEach) {
        result.videos.forEach(vid => this.videos.add(vid));
      }
    }
    
    if (result.links) {
      if (Array.isArray(result.links)) {
        result.links.forEach(link => this.links.add(link));
      } else if (typeof result.links === 'object' && result.links.forEach) {
        result.links.forEach(link => this.links.add(link));
      }
    }
    
    if (result.mentions) {
      if (Array.isArray(result.mentions)) {
        result.mentions.forEach(m => this.mentions.add(m));
      } else if (typeof result.mentions === 'object' && result.mentions.forEach) {
        result.mentions.forEach(m => this.mentions.add(m));
      }
    }
    
    if (result.tags) {
      if (Array.isArray(result.tags)) {
        result.tags.forEach(tag => this.tags.add(tag));
      } else if (typeof result.tags === 'object' && result.tags.forEach) {
        result.tags.forEach(tag => this.tags.add(tag));
      }
    }
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
      // Configurazione attributi sicuri
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'class', 'data-original-src'],
      a: ['href', 'title', 'target', 'rel', 'class'],
      div: ['class', 'style'],
      iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'class'],
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