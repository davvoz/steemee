import { createEmbedPlaceholder } from '../embed-processor.js';

// Regex per rilevare i link Vimeo
const vimeoRegexes = {
  standard: /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)(?:[?&#].*)?/gi,
  player: /(?:https?:\/\/)?player\.vimeo\.com\/video\/(\d+)(?:[?&#].*)?/gi,
  embed: /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/embed\/(\d+)(?:[?&#].*)?/gi
};

export const vimeoPlugin = {
  /**
   * Processa il contenuto HTML cercando URL Vimeo
   */
  process(html) {
    const videos = new Set();
    const images = new Set();
    const links = new Set();
    const placeholders = [];
    
    // Clona il contenuto per l'elaborazione
    let processedHtml = html;
    
    // Funzione per elaborare un match
    const processMatch = (match, id, url) => {
      if (!id) return match;
      
      // Crea un placeholder per l'embed
      const placeholder = createEmbedPlaceholder(id, 'vimeo');
      
      // Aggiorna le collezioni
      videos.add({
        id,
        url,
        type: 'vimeo'
      });
      
      // Aggiungi thumbnail come immagine
      // Nota: Vimeo richiede API per ottenere thumbnail esatte
      const thumbnailUrl = `https://vumbnail.com/${id}.jpg`;
      images.add(thumbnailUrl);
      
      // Aggiungi URL originale ai link
      links.add(url);
      
      // Aggiungi ai placeholder per post-processing
      placeholders.push({
        id,
        type: 'vimeo',
        originalUrl: url,
        placeholder,
        thumbnailUrl
      });
      
      return placeholder;
    };
    
    // Processa ogni formato di URL
    Object.entries(vimeoRegexes).forEach(([type, regex]) => {
      regex.lastIndex = 0;
      processedHtml = processedHtml.replace(regex, (match, id) => {
        return processMatch(match, id, match);
      });
    });
    
    return {
      html: processedHtml,
      placeholders,
      videos: [...videos],
      images: [...images],
      links: [...links]
    };
  },
  
  /**
   * Renderizza un embed Vimeo
   */
  renderEmbed(id, startTime = 0, options = {}) {
    const width = options.width || '100%';
    const height = options.height || '480';
    
    const url = `https://player.vimeo.com/video/${id}`;
    
    return `<div class="video-embed vimeo-embed">
      <iframe 
        width="${width}" 
        height="${height}" 
        src="${url}" 
        frameborder="0" 
        allowfullscreen
        loading="lazy"
        allow="autoplay; fullscreen; picture-in-picture">
      </iframe>
    </div>`;
  }
};