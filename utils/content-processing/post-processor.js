import { youtubePlugin } from './plugins/youtube-plugin.js';
import { vimeoPlugin } from './plugins/vimeo-plugin.js';
import { threeSpeakPlugin } from './plugins/threespeak-plugin.js';

/**
 * Sostituisce i placeholder con gli embed effettivi
 * @param {string} html - HTML con placeholder
 * @param {Object} options - Opzioni
 * @returns {Object} HTML elaborato e collezioni
 */
export function postProcess(html, options = {}) {
  const { 
    embedPlaceholders = [],
    videoWidth = '100%',
    videoHeight = 480
  } = options;
  
  const videos = new Set();
  const images = new Set();
  const links = new Set();
  
  try {
    // Clone dell'HTML per l'elaborazione
    let processedHtml = html;
    
    // Sostituisci ogni placeholder con l'embed appropriato
    embedPlaceholders.forEach(placeholder => {
      try {
        // Il pattern da cercare (deve corrispondere esattamente al formato creato da createEmbedPlaceholder)
        const placeholderPattern = `<div class="embed-placeholder" data-embed-type="${placeholder.type}" data-embed-id="${placeholder.id}"${placeholder.startTime ? ` data-start-time="${placeholder.startTime}"` : ''}></div>`;
        
        // Scegli il renderer appropriato in base al tipo
        let embedHtml = '';
        if (placeholder.type === 'youtube') {
          embedHtml = youtubePlugin.renderEmbed(placeholder.id, placeholder.startTime, {
            width: videoWidth,
            height: videoHeight
          });
          videos.add({
            id: placeholder.id,
            type: 'youtube',
            url: `https://www.youtube.com/watch?v=${placeholder.id}`,
            thumbnailUrl: `https://img.youtube.com/vi/${placeholder.id}/hqdefault.jpg`
          });
          images.add(`https://img.youtube.com/vi/${placeholder.id}/hqdefault.jpg`);
        } else if (placeholder.type === 'vimeo') {
          embedHtml = vimeoPlugin.renderEmbed(placeholder.id, placeholder.startTime, {
            width: videoWidth,
            height: videoHeight
          });
          videos.add({
            id: placeholder.id,
            type: 'vimeo',
            url: `https://vimeo.com/${placeholder.id}`
          });
        } else if (placeholder.type === 'threespeak') {
          embedHtml = threeSpeakPlugin.renderEmbed(placeholder.id, placeholder.startTime, {
            width: videoWidth,
            height: videoHeight
          });
          videos.add({
            id: placeholder.id,
            type: '3speak',
            url: `https://3speak.tv/watch?v=${placeholder.id}`
          });
        }
        
        // Sostituisci il placeholder con l'embed se abbiamo generato l'HTML
        if (embedHtml) {
          processedHtml = processedHtml.replace(placeholderPattern, embedHtml);
          links.add(placeholder.originalUrl);
        }
      } catch (error) {
        console.error(`Errore nel rendering del placeholder ${placeholder.type}:`, error);
      }
    });
    
    return {
      html: processedHtml,
      videos: [...videos],
      images: [...images],
      links: [...links]
    };
  } catch (error) {
    console.error('Errore generale nel post-processing:', error);
    return { html };
  }
}

/**
 * Crea un placeholder per un embed
 * @param {string} id - ID dell'embed
 * @param {string} type - Tipo di embed (youtube, vimeo, ...)
 * @param {number} startTime - Tempo di inizio opzionale
 * @returns {string} HTML placeholder
 */
export function createEmbedPlaceholder(id, type, startTime = 0) {
  return `<div class="embed-placeholder" data-embed-id="${id}" data-embed-type="${type}"${startTime ? ` data-start-time="${startTime}"` : ''}></div>`;
}