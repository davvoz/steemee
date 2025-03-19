/**
 * Central plugin system for markdown content processing
 */
export default class PluginSystem {
  constructor() {
    this.plugins = [];
    this.extractedItems = new Map(); // Plugin name -> extracted items
  }
  
  /**
   * Register a new plugin
   * @param {BasePlugin} plugin - Plugin instance
   */
  registerPlugin(plugin) {
    if (!plugin || typeof plugin.name !== 'string') {
      console.error('Invalid plugin registration attempt');
      return;
    }
    
    this.plugins.push(plugin);
    // Sort by priority (highest first)
    this.plugins.sort((a, b) => b.priority - a.priority);
    
    // Initialize extracted items storage for this plugin
    this.extractedItems.set(plugin.name, []);
  }
  
  /**
   * Get a plugin by its name
   * @param {string} name - Plugin name
   * @returns {BasePlugin|null} Plugin instance or null if not found
   */
  getPluginByName(name) {
    return this.plugins.find(plugin => plugin.name === name) || null;
  }
  
  /**
   * Process content through all the registered plugins
   * @param {string} content - Original markdown content
   * @param {Object} options - Processing options
   * @returns {string} Processed content with placeholders
   */
  preProcess(content, options = {}) {
    if (!content) return '';
    
    let processedContent = content;
    
    // Clear previous extractions
    this.extractedItems.clear();
    
    // Process plugins in priority order
    this.plugins.forEach(plugin => {
      try {
        // Only process if plugin reports it can handle the content
        if (plugin.canProcess(processedContent)) {
          const extractedItems = plugin.extract(processedContent);
          
          if (extractedItems && extractedItems.length > 0) {
            // Store extracted items
            this.extractedItems.set(plugin.name, extractedItems);
            
            // Replace with placeholders
            processedContent = plugin.createPlaceholders(
              processedContent, 
              extractedItems
            );
          }
        }
      } catch (error) {
        console.error(`Error in plugin ${plugin.name} during preprocessing:`, error);
      }
    });
    
    return processedContent;
  }
  
  /**
   * Restore placeholders with rich content
   * @param {string} content - Content with placeholders
   * @param {Object} options - Rendering options
   * @returns {Promise<string>} Final content with rich elements
   */
  async postProcess(content, options = {}) {
    if (!content) return '';
    
    let processedContent = content;
    
    // Process plugins in order (based on priority)
    for (const plugin of this.plugins) {
      try {
        const items = this.extractedItems.get(plugin.name) || [];
        
        if (items.length > 0) {
          // Support both async and sync plugins
          if (plugin.restoreContent.constructor.name === 'AsyncFunction') {
            processedContent = await plugin.restoreContent(
              processedContent,
              items,
              options
            );
          } else {
            processedContent = plugin.restoreContent(
              processedContent,
              items,
              options
            );
          }
        }
      } catch (error) {
        console.error(`Error in plugin ${plugin.name} during postprocessing:`, error);
      }
    }
    
    return processedContent;
  }
}