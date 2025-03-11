import { ContentProcessor } from '../utils/content-processing/index.js';

/**
 * ContentRenderer migliorato con nuova architettura
 */
class ContentRenderer {
  constructor(options = {}) {
    this.options = {
      containerClass: 'content-container',
      imageClass: 'content-image',
      videoClass: 'video-embed',
      useProcessBody: true,
      enableYouTube: true,
      enableImages: true,
      ...options
    };
    
    // Inizializza il processore di contenuti
    this.processor = new ContentProcessor({
      enableVideos: this.options.enableYouTube,
      enableImages: this.options.enableImages,
      proxyImages: true,
      maxImageWidth: this.options.maxImageWidth || 800
    });
  }
  
  /**
   * Renderizza il contenuto
   */
  render(data, options = {}) {
    const renderOptions = { ...this.options, ...options };
    
    try {
      // Fallback per backward compatibility
      if (renderOptions.useProcessBody && typeof generatePostContent === 'function') {
        return this.renderWithLegacyProcessor(data);
      }
      
      // Usa la nuova pipeline di elaborazione
      const result = this.processor.process(data.body, data);
      
      // Crea container principale
      const container = document.createElement('div');
      container.className = renderOptions.containerClass;
      
      // Aggiungi titolo se presente
      let titleElement = null;
      if (data.title) {
        titleElement = document.createElement('h1');
        titleElement.className = 'content-title';
        titleElement.textContent = data.title;
        container.appendChild(titleElement);
      }
      
      // Aggiungi il contenuto elaborato
      container.appendChild(result.container);
      
      return {
        container,
        titleElement,
        contentElement: result.container,
        images: result.images,
        videos: result.videos,
        links: result.links
      };
    } catch (error) {
      console.error('Errore nel rendering del contenuto:', error);
      
      // Fallback per errori
      const container = document.createElement('div');
      container.className = renderOptions.containerClass + ' error';
      
      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.textContent = `Si è verificato un errore nel rendering: ${error.message}`;
      
      container.appendChild(errorMsg);
      
      return { container, error };
    }
  }
  
  /**
   * Compatibilità con il vecchio processore
   */
  renderWithLegacyProcessor(data) {
    try {
      const html = generatePostContent(data.body);
      
      // Crea container
      const container = document.createElement('div');
      container.className = this.options.containerClass;
      
      // Aggiungi titolo se presente
      let titleElement = null;
      if (data.title) {
        titleElement = document.createElement('h1');
        titleElement.className = 'content-title';
        titleElement.textContent = data.title;
        container.appendChild(titleElement);
      }
      
      // Aggiungi il contenuto
      const contentElement = document.createElement('div');
      contentElement.className = 'content-body';
      contentElement.innerHTML = html;
      container.appendChild(contentElement);
      
      return {
        container,
        titleElement,
        contentElement
      };
    } catch (error) {
      console.error('Errore nel rendering legacy:', error);
      return this.render(data, { useProcessBody: false });
    }
  }
}

export default ContentRenderer;