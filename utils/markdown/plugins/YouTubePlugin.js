import BasePlugin from '../BasePlugin.js';
import { REGEX_PATTERNS } from '../regex-config.js';

/**
 * YouTube plugin for embedding videos in markdown content
 * Handles all YouTube URL formats and provides responsive embeds
 */
export default class YouTubePlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'youtube';
    this.priority = 30; // Higher priority to process before other plugins
    
    // Include ALL YouTube URL patterns
    this.patterns = [
      REGEX_PATTERNS.YOUTUBE.MAIN,
      REGEX_PATTERNS.YOUTUBE.SHORT,
      REGEX_PATTERNS.YOUTUBE.EMBED
    ];
    
    this.placeholderPrefix = 'YOUTUBE_EMBED_';
    this.placeholderSuffix = '_YT_END';
  }
  
  /**
   * Check if this plugin can process the content
   * @param {string} content - Content to check
   * @returns {boolean} True if plugin can process this content
   */
  canProcess(content) {
    if (!content) return false;
    
    // Check if content contains any YouTube URL pattern
    return this.patterns.some(pattern => {
      const regex = new RegExp(pattern.source, 'i');
      return regex.test(content);
    });
  }
  
  /**
   * Extract YouTube videos from content
   * @param {string} content - Content to search for videos
   * @returns {Array<Object>} Extracted video information
   */
  extract(content) {
    if (!content) return [];
    
    console.log('Extracting YouTube videos');
    const videos = [];
    const seenIds = new Set(); // Prevent duplicates
    
    this.patterns.forEach(pattern => {
      // Create a new regex for each test to avoid lastIndex issues
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        const videoId = match[1];
        const originalUrl = match[0];
        
        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          
          // Parse URL to extract parameters
          const urlParams = this.extractUrlParameters(originalUrl);
          const embedParams = this.convertParamsForEmbed(urlParams);
          
          videos.push({
            id: videoId,
            originalUrl: this.normalizeUrl(originalUrl),
            placeholder: `${this.placeholderPrefix}${videoId}${this.placeholderSuffix}`,
            params: urlParams,
            embedUrl: `https://www.youtube.com/embed/${videoId}${embedParams}`
          });
        }
      }
    });
    
    console.log(`Found ${videos.length} YouTube videos`);
    return videos;
  }
  
  /**
   * Extract parameters from YouTube URL
   * @param {string} url - Original YouTube URL
   * @returns {object} URL parameters as an object
   */
  extractUrlParameters(url) {
    try {
      const params = {};
      
      // Extract everything after ? character
      if (url.includes('?')) {
        const queryString = url.substring(url.indexOf('?') + 1);
        const searchParams = new URLSearchParams(queryString);
        
        // Copy parameters to object
        for (const [key, value] of searchParams.entries()) {
          params[key] = value;
        }
      }
      
      // Handle youtu.be shortlinks with timestamp in path
      if (url.includes('youtu.be/') && url.includes('#t=')) {
        const timeParam = url.split('#t=')[1];
        if (timeParam) {
          params.t = timeParam;
        }
      }
      
      return params;
    } catch (e) {
      console.error('Error extracting YouTube URL parameters:', e);
      return {};
    }
  }
  
  /**
   * Convert YouTube URL parameters to embed parameters
   * @param {object} params - URL parameters
   * @returns {string} Formatted embed parameters
   */
  convertParamsForEmbed(params) {
    if (!params || Object.keys(params).length === 0) {
      return '';
    }
    
    const embedParams = new URLSearchParams();
    
    // Handle time parameter (convert to seconds for embed)
    if (params.t) {
      const seconds = this.parseTimeToSeconds(params.t);
      if (seconds > 0) {
        embedParams.append('start', seconds);
      }
    }
    
    // Handle autoplay
    if (params.autoplay === '1') {
      embedParams.append('autoplay', '1');
    }
    
    // Handle other common parameters
    if (params.loop === '1') {
      embedParams.append('loop', '1');
      // Loop requires a playlist parameter with the video ID
      if (!embedParams.has('playlist')) {
        embedParams.append('playlist', params.v || '');
      }
    }
    
    // Add mute parameter if autoplay is enabled (required for autoplay in most browsers)
    if (embedParams.has('autoplay')) {
      embedParams.append('mute', '1');
    }
    
    const paramString = embedParams.toString();
    return paramString ? `?${paramString}` : '';
  }
  
  /**
   * Parse time parameter to seconds
   * @param {string} time - Time parameter (e.g., '1h30m15s', '1:30:15', '90')
   * @returns {number} Time in seconds
   */
  parseTimeToSeconds(time) {
    if (!time) return 0;
    
    // Handle formats like '1h30m15s'
    if (typeof time === 'string' && (time.includes('h') || time.includes('m') || time.includes('s'))) {
      let seconds = 0;
      
      // Extract hours
      const hoursMatch = time.match(/(\d+)h/);
      if (hoursMatch) seconds += parseInt(hoursMatch[1]) * 3600;
      
      // Extract minutes
      const minutesMatch = time.match(/(\d+)m/);
      if (minutesMatch) seconds += parseInt(minutesMatch[1]) * 60;
      
      // Extract seconds
      const secondsMatch = time.match(/(\d+)s/);
      if (secondsMatch) seconds += parseInt(secondsMatch[1]);
      
      return seconds;
    }
    
    // Handle formats like '1:30:15' or '1:30'
    if (typeof time === 'string' && time.includes(':')) {
      const parts = time.split(':').map(part => parseInt(part));
      
      if (parts.length === 3) {
        // Format: hours:minutes:seconds
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        // Format: minutes:seconds
        return parts[0] * 60 + parts[1];
      }
    }
    
    // Try parsing as a direct number of seconds
    const seconds = parseInt(time);
    return isNaN(seconds) ? 0 : seconds;
  }
  
  /**
   * Replace YouTube URLs with placeholders
   * @param {string} content - Original content
   * @param {Array<Object>} videos - Extracted video information
   * @returns {string} Content with placeholders
   */
  createPlaceholders(content, videos) {
    if (!videos || videos.length === 0) return content;
    
    let processedContent = content;
    
    videos.forEach(video => {
      // Escape special characters for regex
      const escapedUrl = this.escapeRegExp(video.originalUrl);
      const urlRegex = new RegExp(escapedUrl, 'g');
      
      // Replace URL with placeholder
      processedContent = processedContent.replace(urlRegex, video.placeholder);
    });
    
    return processedContent;
  }
  
  /**
   * Restore YouTube placeholders with iframe embeds
   * @param {string} content - Content with placeholders
   * @param {Array<Object>} videos - Extracted video information
   * @param {Object} options - Rendering options
   * @returns {string} Content with YouTube embeds
   */
  restoreContent(content, videos, options = {}) {
    if (!videos || videos.length === 0) return content;
    
    const dimensions = options.videoDimensions || {
      width: '100%',
      height: '480px'
    };
    
    let processedContent = content;
    
    videos.forEach(video => {
      const embedHtml = this.generateEmbed(video, dimensions);
      const placeholderRegex = new RegExp(this.escapeRegExp(video.placeholder), 'g');
      
      processedContent = processedContent.replace(placeholderRegex, embedHtml);
    });
    
    return processedContent;
  }
  
  /**
   * Generate YouTube embed HTML
   * @param {Object} video - Video information
   * @param {Object} dimensions - Video dimensions
   * @returns {string} HTML for embedding the video
   */
  generateEmbed(video, dimensions) {
    return `<div class="youtube-embed-container responsive-video-container">
      <iframe 
        width="${dimensions.width}" 
        height="${dimensions.height}"
        src="${video.embedUrl}"
        title="YouTube video player"
        frameborder="0"
        allowfullscreen
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
      </iframe>
      <div class="video-info">
        <a href="${video.originalUrl}" target="_blank" rel="noopener" class="video-title">
          YouTube Video
        </a>
      </div>
    </div>`;
  }
  
  /**
   * Normalize YouTube URL to ensure it has proper protocol
   * @param {string} url - YouTube URL
   * @returns {string} Normalized URL
   */
  normalizeUrl(url) {
    if (!url) return '';
    
    if (url.startsWith('www.')) {
      return `https://${url}`;
    }
    
    if (url.startsWith('youtube.com/') || url.startsWith('youtu.be/')) {
      return `https://${url}`;
    }
    
    if (!url.match(/^https?:\/\//)) {
      return `https://${url}`;
    }
    
    return url;
  }
  
  /**
   * Helper to escape special characters in regex patterns
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}