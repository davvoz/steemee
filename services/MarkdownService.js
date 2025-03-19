import ContentRenderer from '../components/ContentRenderer.js';

/**
 * Centralized service for handling markdown rendering throughout the application
 * Ensures consistent rendering between post creation preview and post viewing
 */
class MarkdownService {
  constructor() {
    // Default configuration for standard post viewing
    this.defaultOptions = {
      containerClass: 'markdown-content',
      imageClass: 'content-image',
      useProcessBody: true,
      maxImageWidth: 800,
      enableYouTube: true,
      videoDimensions: { width: '100%', height: '480px' },
      allowIframes: true
    };
    
    // Create a shared content renderer instance with default options
    this.sharedRenderer = new ContentRenderer(this.defaultOptions);
  }
  
  /**
   * Get a ContentRenderer instance with specific options
   * @param {Object} options - Override default options
   * @returns {ContentRenderer} A content renderer instance
   */
  getRenderer(options = {}) {
    // For specific configurations, create a new renderer with merged options
    if (Object.keys(options).length > 0) {
      return new ContentRenderer({
        ...this.defaultOptions,
        ...options
      });
    }
    
    // Otherwise use the shared instance
    return this.sharedRenderer;
  }
  
  /**
   * Render markdown content to HTML
   * @param {Object} data - Content data to render
   * @param {Object} options - Rendering options
   * @returns {Object} Rendered content result
   */
  render(data, options = {}) {
    const renderer = this.getRenderer(options);
    return renderer.render(data);
  }
  
  /**
   * Create a preview of markdown content
   * @param {string} markdown - Markdown content
   * @param {string} title - Optional title
   * @param {Object} options - Preview options
   * @returns {HTMLElement} Preview element
   */
  createPreview(markdown, title = '', options = {}) {
    const previewOptions = {
      containerClass: 'content-preview',
      ...options
    };
    
    const renderer = this.getRenderer(previewOptions);
    return renderer.createPreview(markdown, {
      title,
      ...previewOptions
    });
  }
  
  /**
   * Update an existing preview with new content
   * @param {HTMLElement} previewElement - Existing preview element
   * @param {string} markdown - New markdown content
   * @param {string} title - Optional new title
   * @param {Object} options - Preview options
   */
  updatePreview(previewElement, markdown, title = '', options = {}) {
    const renderer = this.getRenderer(options);
    renderer.updatePreview(previewElement, markdown, {
      title,
      ...options
    });
  }
}

// Export a singleton instance
const markdownService = new MarkdownService();
export default markdownService;
