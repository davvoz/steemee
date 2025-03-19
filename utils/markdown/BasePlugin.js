/**
 * Base class for all markdown plugins
 * Provides common functionality and interface for plugins
 */
export default class BasePlugin {
  constructor() {
    this.name = 'base';
    this.priority = 0;
    this.patterns = [];
  }
  
  /**
   * Check if this plugin can handle the given content
   * @param {string} content - Content to check
   * @returns {boolean} True if plugin can process this content
   */
  canProcess(content) {
    if (!content) return false;
    return this.patterns.some(pattern => pattern.test(content));
  }
  
  /**
   * Extract items from content based on patterns
   * @param {string} content - Content to process
   * @returns {Array} Extracted items
   */
  extract(content) {
    return [];
  }
  
  /**
   * Replace extracted items with placeholders
   * @param {string} content - Original content
   * @param {Array} items - Items to replace
   * @returns {string} Content with placeholders
   */
  createPlaceholders(content, items) {
    return content;
  }
  
  /**
   * Restore placeholders with processed content
   * @param {string} content - Content with placeholders
   * @param {Array} items - Items to restore
   * @param {Object} options - Options for restoration
   * @returns {string} Final processed content
   */
  restoreContent(content, items, options) {
    return content;
  }
  
  /**
   * Process the content with this plugin
   * @param {string} content - Content to process
   * @param {Object} options - Processing options
   * @returns {Object} Processed content and extracted items
   */
  process(content, options = {}) {
    // Extract items
    const items = this.extract(content);
    
    // Replace with placeholders
    const processedContent = this.createPlaceholders(content, items);
    
    // Return both for later restoration
    return {
      content: processedContent,
      items
    };
  }
}