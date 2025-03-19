/**
 * Content Renderer component for displaying Steem posts and previews
 * Provides consistent rendering across post view and create post preview
 */
class ContentRenderer {
  constructor(options = {}) {
    this.options = {
      extractImages: true,
      renderImages: true,
      imageClass: 'content-image',
      containerClass: 'markdown-content',
      useProcessBody: false,
      maxImageWidth: 800,
      enableYouTube: true,
      videoDimensions: { width: '100%', height: '480px' },
      useSteemContentRenderer: true,
      ...options
    };
    
    // Create dependencies on demand
    this.markdownConverter = null;
    this.youtubePlugin = null;
    this.initialized = false;
    
    // State tracking for library loading
    this.loadingMarkdown = false;
    this.markdownLoaded = false;
    
    // Initialize the renderer
    this.init();
  }
  
  /**
   * Initialize renderer and load dependencies
   */
  init() {
    if (this.initialized) return;
    
    try {
      // Load Markdown library if needed
      this.loadMarkdownLibrary();
      
      // Get markdown converter (will use fallback if library not ready)
      this.markdownConverter = this.getMarkdownConverter();
      
      // Load YouTube plugin if enabled
      if (this.options.enableYouTube) {
        import('../utils/markdown/plugins/YouTubePlugin.js')
          .then(module => {
            const YouTubePlugin = module.default;
            this.youtubePlugin = new YouTubePlugin();
          })
          .catch(err => {
            console.error('Error loading YouTube plugin:', err);
          });
      }
      
      // Load image service
      import('../services/ImageService.js')
        .then(module => {
          this.imageService = module.default;
        })
        .catch(err => {
          console.error('Error loading image service:', err);
        });
        
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing ContentRenderer:', error);
    }
  }
  
  /**
   * Load the markdown-it library from CDN if not available
   */
  loadMarkdownLibrary() {
    // Skip if already loading or loaded
    if (this.loadingMarkdown || this.markdownLoaded) return;
    
    // Check if library already exists
    if (typeof window.markdownit === 'function') {
      this.markdownLoaded = true;
      return;
    }
    
    this.loadingMarkdown = true;
    
    // Create script element to load the library
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js';
    script.async = true;
    
    script.onload = () => {
      console.log('Markdown-it library loaded successfully');
      this.loadingMarkdown = false;
      this.markdownLoaded = true;
      
      // Update the converter now that the library is available
      this.markdownConverter = this.getMarkdownConverter();
    };
    
    script.onerror = (err) => {
      console.error('Failed to load markdown-it library:', err);
      this.loadingMarkdown = false;
      // Keep using the fallback converter
    };
    
    document.head.appendChild(script);
  }
  
  /**
   * Get markdown converter instance
   * @returns {Object} Markdown converter
   */
  getMarkdownConverter() {
    if (this.markdownConverter) return this.markdownConverter;
    
    // Check if markdown-it is available
    if (typeof window.markdownit === 'function') {
      try {
        // Use markdown-it with standard configuration
        return window.markdownit({
          html: false,
          linkify: true,
          typographer: true,
          breaks: true
        });
      } catch (error) {
        console.error('Error creating markdown converter:', error);
        // Fall through to the fallback
      }
    }
    
    // Return simple fallback if markdown-it isn't available
    console.log('Using fallback markdown converter');
    return {
      render: (text) => {
        if (!text) return '';
        
        // Simple markdown-to-HTML conversion for common elements
        return text
          // Escape HTML
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          
          // Headers
          .replace(/^# (.*$)/gm, '<h1>$1</h1>')
          .replace(/^## (.*$)/gm, '<h2>$1</h2>')
          .replace(/^### (.*$)/gm, '<h3>$1</h3>')
          
          // Bold and italic
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          
          // Lists
          .replace(/^\s*\* (.*$)/gm, '<ul><li>$1</li></ul>')
          .replace(/^\s*\d+\. (.*$)/gm, '<ol><li>$1</li></ol>')
          
          // Links
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
          
          // Images
          .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
          
          // Line breaks
          .replace(/\n/g, '<br>');
      }
    };
  }

  /**
   * Main render method - processes content and returns rendered HTML elements
   * @param {Object} data - Content data to render
   * @param {string} data.title - Post title
   * @param {string} data.body - Post body content (markdown)
   * @param {Object} options - Override default options
   * @returns {Object} Rendered elements (container, title, content, images)
   */
  render(data, options = {}) {
    // Merge options
    const renderOptions = { ...this.options, ...options };
    const { title, body } = data;
    
    // Create container element
    const container = document.createElement('div');
    container.className = renderOptions.containerClass;
    
    // Process content
    const processedBody = this.processContent(body, renderOptions);
    
    // Title element (if provided and renderTitle non è false)
    let titleElement = null;
    if (title && title.trim() && renderOptions.renderTitle !== false) {
      titleElement = document.createElement('h1');
      titleElement.className = 'content-title';
      titleElement.textContent = title;
      container.appendChild(titleElement);
    }
    
    // Content element with processed HTML
    const contentElement = document.createElement('div');
    contentElement.className = 'content-body';
    contentElement.innerHTML = processedBody.html;
    container.appendChild(contentElement);
    
    // Return both the container element and the extracted data
    return {
      container,
      title: titleElement,
      content: contentElement,
      images: processedBody.images || [],
      videos: processedBody.videos || []
    };
  }
  
  /**
   * Process content for rendering
   * @param {string} content - Raw content to process
   * @param {Object} options - Rendering options
   * @returns {Object} Processed content with HTML and extracted resources
   */
  processContent(content, options = {}) {
    if (!content) return { html: '', images: [] };
    
    let processedContent = content;
    let extractedImages = [];
    let extractedVideos = [];
    
    // Extract YouTube videos if enabled
    if (options.enableYouTube && this.youtubePlugin) {
      extractedVideos = this.youtubePlugin.extract(processedContent);
      processedContent = this.youtubePlugin.createPlaceholders(processedContent, extractedVideos);
    }
    
    // Extract images if enabled
    if (options.extractImages && this.imageService) {
      extractedImages = this.imageService.extractAllImageUrls(processedContent);
    }
    
    // Convert markdown to HTML
    // Get the converter again in case it was loaded after initialization
    if (!this.markdownConverter || this.loadingMarkdown) {
      this.markdownConverter = this.getMarkdownConverter();
    }
    
    let html = this.markdownConverter ? this.markdownConverter.render(processedContent) : processedContent;
    
    // Restore YouTube videos with embeds
    if (options.enableYouTube && this.youtubePlugin && extractedVideos.length > 0) {
      html = this.youtubePlugin.restoreContent(html, extractedVideos, {
        videoDimensions: options.videoDimensions
      });
    }
    
    // Enhance images with responsive classes if needed
    if (options.renderImages && extractedImages.length > 0) {
      html = this.enhanceImages(html, options);
    }
    
    return {
      html,
      images: extractedImages,
      videos: extractedVideos
    };
  }
  
  /**
   * Enhance images with responsive classes
   * @param {string} html - HTML content with images
   * @param {Object} options - Rendering options
   * @returns {string} Enhanced HTML
   */
  enhanceImages(html, options) {
    if (!html) return html;
    
    // Simple regex-based approach (could be improved with DOM parsing)
    const imgRegex = /<img[^>]*src="([^"]*)"[^>]*>/gi;
    
    return html.replace(imgRegex, (match, src) => {
      // Optimize image URL if image service is available
      const optimizedSrc = this.imageService ? 
        this.imageService.optimizeImageUrl(src, {
          width: options.maxImageWidth
        }) : src;
      
      // Replace with enhanced image
      return `<img src="${optimizedSrc}" class="${options.imageClass}" loading="lazy" alt="" />`;
    });
  }
  
  /**
   * Create a preview of content for real-time editing
   * @param {string} markdown - Markdown content to preview
   * @param {Object} options - Preview options
   * @returns {HTMLElement} Preview element
   */
  createPreview(markdown, options = {}) {
    const previewOptions = {
      containerClass: 'content-preview',
      ...this.options,
      ...options
    };
    
    // Render preview with temporary title
    const preview = this.render({
      title: options.title || '',
      body: markdown
    }, previewOptions);
    
    // Add preview-specific class
    preview.container.classList.add('live-preview');
    
    return preview.container;
  }
  
  /**
   * Update an existing preview element with new content
   * @param {HTMLElement} previewElement - Existing preview element 
   * @param {string} markdown - New markdown content
   * @param {Object} options - Preview options
   */
  updatePreview(previewElement, markdown, options = {}) {
    if (!previewElement) return;
    
    const previewOptions = {
      ...this.options,
      ...options
    };
    
    // Process new content
    const processed = this.processContent(markdown, previewOptions);
    
    // Find or create content body element
    let contentBody = previewElement.querySelector('.content-body');
    if (!contentBody) {
      contentBody = document.createElement('div');
      contentBody.className = 'content-body';
      previewElement.appendChild(contentBody);
    }
    
    // Update content
    contentBody.innerHTML = processed.html;
    
    // Update title if provided
    if (options.title) {
      let titleElement = previewElement.querySelector('.content-title');
      if (!titleElement) {
        titleElement = document.createElement('h1');
        titleElement.className = 'content-title';
        previewElement.insertBefore(titleElement, previewElement.firstChild);
      }
      titleElement.textContent = options.title;
    }
  }
}

export default ContentRenderer;