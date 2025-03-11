import { createEmbedPlaceholder } from '../embed-processor.js';

// Regex per rilevare i link ThreeSpeak
const threeSpeakRegexes = {
  standard: /(?:https?:\/\/)?(?:www\.)?3speak\.(?:online|tv|co)\/watch\?v=([^\/&]+)\/([^\/&]+)(?:[?&].*)?/gi,
  embed: /(?:https?:\/\/)?(?:www\.)?3speak\.(?:online|tv|co)\/embed\?v=([^\/&]+)\/([^\/&]+)(?:[?&].*)?/gi,
  shorthand: /(?:https?:\/\/)?(?:www\.)?3speak\.(?:online|tv|co)\/v\/([^\/&]+)\/([^\/&]+)(?:[?&].*)?/gi
};

export const threeSpeakPlugin = {
  /**
   * Processa il contenuto HTML cercando URL ThreeSpeak
   */
  process(html) {
    const videos = new Set();
    const images = new Set();
    const links = new Set();
    const placeholders = [];
    
    // Clona il contenuto per l'elaborazione
    let processedHtml = html;
    
    // Funzione per elaborare un match
    const processMatch = (match, user, videoId, url) => {
      if (!user || !videoId) return match;
      
      const fullId = `${user}/${videoId}`;
      
      // Crea un placeholder per l'embed
      const placeholder = createEmbedPlaceholder(fullId, 'threespeak');
      
      // Aggiorna le collezioni
      videos.add({
        id: fullId,
        userId: user,
        videoId: videoId,
        url,
        type: 'threespeak'
      });
      
      // Aggiungi thumbnail come immagine
      // Formato URL thumbnail di 3Speak
      const thumbnailUrl = `https://img.3speakcontent.co/${videoId}/thumbnails/poster.png`;
      images.add(thumbnailUrl);
      
      // Aggiungi URL originale ai link
      links.add(url);
      
      // Aggiungi ai placeholder per post-processing
      placeholders.push({
        id: fullId,
        type: 'threespeak',
        userId: user,
        videoId: videoId,
        originalUrl: url,
        placeholder,
        thumbnailUrl
      });
      
      return placeholder;
    };
    
    // Processa ogni formato di URL
    Object.entries(threeSpeakRegexes).forEach(([type, regex]) => {
      regex.lastIndex = 0;
      processedHtml = processedHtml.replace(regex, (match, user, videoId) => {
        return processMatch(match, user, videoId, match);
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
   * Renderizza un embed ThreeSpeak
   */
  renderEmbed(id, startTime = 0, options = {}) {
    const width = options.width || '100%';
    const height = options.height || '480';
    
    // Supporta sia il formato "user/id" che il formato diretto "id"
    const embedUrl = id.includes('/')
      ? `https://3speak.tv/embed?v=${id}`
      : `https://3speak.tv/embed?v=threespeak/${id}`;
    
    return `<div class="video-embed threespeak-embed">
      <iframe 
        width="${width}" 
        height="${height}" 
        src="${embedUrl}" 
        frameborder="0" 
        allowfullscreen
        loading="lazy"
        allow="autoplay; fullscreen">
      </iframe>
    </div>`;
  }
};