import { youtubePlugin } from './plugins/youtube-plugin.js';
import { vimeoPlugin } from './plugins/vimeo-plugin.js';
import { threeSpeakPlugin } from './plugins/threespeak-plugin.js';
// Importa altri plugin...

/**
 * Processa gli embed nel contenuto HTML
 */
export function processEmbeds(html, options = {}) {
  const {
    enableVideos = true,
    enableTwitch = true,
    enableVimeo = true,
    enableThreeSpeak = true
  } = options;
  
  // Collezioni per tracciamento
  const images = new Set();
  const videos = new Set();
  const links = new Set();
  const placeholders = [];
  
  try {
    // Processiamo il contenuto con ogni plugin abilitato
    let processedHtml = html;
    
    if (enableVideos) {
      const youtubeResult = youtubePlugin.process(processedHtml);
      processedHtml = youtubeResult.html;
      
      // Aggiungiamo i placeholder e aggiorniamo le collezioni
      placeholders.push(...youtubeResult.placeholders);
      youtubeResult.videos.forEach(v => videos.add(v));
      youtubeResult.images.forEach(i => images.add(i));
      youtubeResult.links.forEach(l => links.add(l));
    }
    
    if (enableVimeo) {
      const vimeoResult = vimeoPlugin.process(processedHtml);
      processedHtml = vimeoResult.html;
      
      // Aggiorna collezioni...
    }
    
    if (enableThreeSpeak) {
      const threeSpeakResult = threeSpeakPlugin.process(processedHtml);
      processedHtml = threeSpeakResult.html;
      
      // Aggiorna collezioni...
    }
    
    // Altri plugin di elaborazione...
    
    return {
      html: processedHtml,
      placeholders,
      images: [...images],
      videos: [...videos],
      links: [...links]
    };
  } catch (error) {
    console.error('Errore nell\'elaborazione embed:', error);
    return {
      html,
      placeholders: [],
      images: [],
      videos: [],
      links: []
    };
  }
}

// Funzioni di utility
export function createEmbedPlaceholder(id, type, startTime = 0) {
  return `~~~ embed:${id} ${type} ${startTime} ~~~`;
}

export function extractEmbedFromPlaceholder(placeholder) {
  const match = placeholder.match(/~~~ embed:([A-Za-z0-9\?\=\_\-\/\.]+) ([a-z]+)(?:\s(\d+))? ~~~/);
  if (!match) return null;
  
  return {
    id: match[1],
    type: match[2],
    startTime: match[3] ? parseInt(match[3], 10) : 0
  };
}