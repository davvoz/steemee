import BasePlugin from '../BasePlugin.js';
import { REGEX_PATTERNS } from './regex-config.js';

/**
 * Image plugin for handling image extraction and optimization
 */
export default class ImagePlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'image';
    this.priority = 10;
    
    // Image URL patterns
    this.patterns = [
      REGEX_PATTERNS.IMAGE
    ];
    
    this.placeholderPrefix = 'IMAGE_EMBED_';
    this.placeholderSuffix = '_IMG_END';
    
    // Recognized image hosting services
    this.imageHosts = {
      steemit: 'steemitimages.com',
      discord: 'media.discordapp.net',
      ipfs: ['ipfs.io', 'gateway.pinata.cloud', 'cloudflare-ipfs.com', 'ipfs.infura.io']
    };
  }
  
  /**
   * Extract image URLs from content
   * @param {string} content - Content to search for images
   * @returns {Array<Object>} Extracted image information
   */
  extract(content) {
    if (!content) return [];
    
    const images = [];
    const seenUrls = new Set(); // Prevent duplicates
    
    // Use the image pattern from REGEX_PATTERNS
    const regex = new RegExp(REGEX_PATTERNS.IMAGE.source, REGEX_PATTERNS.IMAGE.flags);
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const imageUrl = match[1];
      const originalUrl = match[0];
      
      if (imageUrl && !seenUrls.has(imageUrl)) {
        seenUrls.add(imageUrl);
        images.push({
          url: this.normalizeImageUrl(imageUrl),
          originalUrl: originalUrl,
          placeholder: `${this.placeholderPrefix}${images.length}${this.placeholderSuffix}`
        });
      }
    }
    
    return images;
  }
  
  /**
   * Replace image URLs with placeholders
   * @param {string} content - Original content
   * @param {Array<Object>} images - Extracted image information
   * @returns {string} Content with placeholders
   */
  createPlaceholders(content, images) {
    if (!images || images.length === 0) return content;
    
    let processedContent = content;
    
    images.forEach(image => {
      // Escape special characters for regex
      const escapedUrl = this.escapeRegExp(image.originalUrl);
      const urlRegex = new RegExp(escapedUrl, 'g');
      
      // Replace URL with placeholder
      processedContent = processedContent.replace(urlRegex, image.placeholder);
    });
    
    return processedContent;
  }
  
  /**
   * Restore image placeholders with responsive image elements
   * @param {string} content - Content with placeholders
   * @param {Array<Object>} images - Extracted image information
   * @param {Object} options - Rendering options
   * @returns {string} Content with responsive images
   */
  restoreContent(content, images, options = {}) {
    if (!images || images.length === 0) return content;
    
    let processedContent = content;
    
    images.forEach(image => {
      const optimizedUrl = this.optimizeImageUrl(image.url, options);
      const imageHtml = this.generateImageHtml(optimizedUrl, options);
      const placeholderRegex = new RegExp(this.escapeRegExp(image.placeholder), 'g');
      
      processedContent = processedContent.replace(placeholderRegex, imageHtml);
    });
    
    return processedContent;
  }
  
  /**
   * Optimize an image URL for different sizes/dimensions
   * @param {string} url - Original image URL
   * @param {Object} options - Options for optimization
   * @returns {string} Optimized URL
   */
  optimizeImageUrl(url, options = {}) {
    if (!url) return url;
    
    const normalizedUrl = this.normalizeImageUrl(url);
    const width = options.width || 800;
    
    // Handle Steem/Hive proxy
    if (normalizedUrl.includes(this.imageHosts.steemit)) {
      return `https://steemitimages.com/${width}x0/${normalizedUrl}`;
    }
    
    // Handle Discord images - they support width and height parameters
    if (normalizedUrl.includes(this.imageHosts.discord)) {
      // Discord URLs already include size, check if we should modify it
      if (normalizedUrl.includes('?')) {
        // If URL already has parameters, add or update width
        if (normalizedUrl.includes('width=') || normalizedUrl.includes('height=')) {
          return normalizedUrl.replace(/width=\d+/g, `width=${width}`);
        } else {
          return `${normalizedUrl}&width=${width}`;
        }
      } else {
        // If no parameters, add width
        return `${normalizedUrl}?width=${width}`;
      }
    }
    
    // Handle IPFS images
    for (const ipfsGateway of this.imageHosts.ipfs) {
      if (normalizedUrl.includes(ipfsGateway)) {
        // IPFS gateways don't typically support resizing directly
        // Just return the normalized URL
        return normalizedUrl;
      }
    }
    
    return normalizedUrl;
  }
  
  /**
   * Normalize image URL to ensure it has proper protocol
   * @param {string} url - Image URL
   * @returns {string} Normalized URL
   */
  normalizeImageUrl(url) {
    if (!url) return url;
    
    // Fix double slashes (except after protocol)
    url = url.replace(/:\/\/+/g, '://').replace(/([^:])\/+/g, '$1/');
    
    // Fix missing protocol
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }
    
    // Handle IPFS URIs (ipfs:// protocol)
    if (url.startsWith('ipfs://')) {
      const ipfsHash = url.replace('ipfs://', '');
      return `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    
    return url;
  }
  
  /**
   * Generate HTML for responsive image
   * @param {string} url - Image URL
   * @param {Object} options - Image options
   * @returns {string} HTML for image
   */
  generateImageHtml(url, options = {}) {
    const className = options.imageClass || 'content-image';
    return `<img src="${url}" class="${className}" loading="lazy" alt="" />`;
  }
  
  /**
   * Generate a data URL placeholder for missing images
   * @param {string} text - Text to display in placeholder
   * @returns {string} Data URL string
   */
  getDataUrlPlaceholder(text = 'No Image') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120">
      <rect fill="#eee" width="200" height="120"/>
      <text fill="#888" font-family="sans-serif" font-size="14" dy="10" font-weight="bold" x="50%" y="50%" text-anchor="middle">${text}</text>
    </svg>`;
    
    const encoded = encodeURIComponent(svg)
      .replace(/'/g, '%27')
      .replace(/"/g, '%22');
    
    return `data:image/svg+xml,${encoded}`;
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