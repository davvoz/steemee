import { createEmbedPlaceholder } from '../post-processor.js'; 

// Regex per vari formati di URL YouTube
const youtubeRegexes = {
  standard: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:[&?].*)?/gi,
  short: /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:[?].*)?/gi,
  embed: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:[?].*)?/gi
};

export const youtubePlugin = {
  /**
   * Processa il contenuto cercando URL di YouTube
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
      if (!id || id.length !== 11) return match;
      
      // Estrai il tempo di inizio, se presente
      const startMatch = url.match(/[?&]t=(\d+)s?/);
      const startTime = startMatch ? parseInt(startMatch[1], 10) : 0;
      
      // Crea un placeholder per l'embed
      const placeholder = createEmbedPlaceholder(id, 'youtube', startTime);
      
      // Aggiorna le collezioni
      videos.add({
        id,
        url,
        startTime,
        type: 'youtube'
      });
      
      // Aggiungi thumbnail come immagine
      const thumbnailUrl = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      images.add(thumbnailUrl);
      
      // Aggiungi URL originale ai link
      links.add(url);
      
      // Aggiungi ai placeholder per post-processing
      placeholders.push({
        id,
        type: 'youtube',
        startTime,
        originalUrl: url,
        thumbnailUrl
      });
      
      return placeholder;
    };
    
    // Processa ogni formato di URL
    Object.entries(youtubeRegexes).forEach(([type, regex]) => {
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
   * Renderizza un embed YouTube
   */
  renderEmbed(id, startTime = 0, options = {}) {
    const width = options.width || '100%';
    const height = options.height || '480';
    
    const url = startTime
      ? `https://www.youtube.com/embed/${id}?start=${startTime}`
      : `https://www.youtube.com/embed/${id}`;
    
    return `<div class="video-embed youtube-embed">
      <iframe 
        width="${width}" 
        height="${height}" 
        src="${url}" 
        frameborder="0" 
        allowfullscreen
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
      </iframe>
    </div>`;
  }
};