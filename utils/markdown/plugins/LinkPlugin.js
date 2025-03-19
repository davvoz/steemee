import BasePlugin from '../BasePlugin.js';
import { REGEX_PATTERNS, REGEX_UTILS } from '../regex-config.js';

export default class LinkPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'link';
    this.priority = 20; // Esegui prima del plugin immagini
    
    this.patterns = [
      REGEX_PATTERNS.LINKS.MARKDOWN_LINK,
      REGEX_PATTERNS.LINKS.PLAIN_URL
    ];
    
    this.placeholderPrefix = 'LINK_PLACEHOLDER_';
    this.placeholderSuffix = '_LINK_END';
  }
  
  extract(content) {
    if (!content) return [];
    
    const links = [];
    const seenUrls = new Set();
    
    // Estrai i link markdown formattati [testo](url)
    const markdownPattern = REGEX_PATTERNS.LINKS.MARKDOWN_LINK;
    let match;
    
    while ((match = markdownPattern.exec(content)) !== null) {
      const text = match[1];
      const url = REGEX_UTILS.sanitizeUrl(match[2]);
      
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        links.push({
          id: this.generateLinkId(url),
          text,
          url,
          originalText: match[0],
          type: 'markdown',
          placeholder: this.createPlaceholderId(url)
        });
      }
    }
    
    return links;
  }
  
  createPlaceholders(content, links) {
    if (!links || links.length === 0) return content;
    
    let processedContent = content;
    links.forEach(link => {
      const escapedText = REGEX_UTILS.escapeRegExp(link.originalText);
      const regex = new RegExp(escapedText, 'g');
      processedContent = processedContent.replace(regex, link.placeholder);
    });
    
    return processedContent;
  }
  
  restoreContent(content, links, options = {}) {
    if (!links || links.length === 0) return content;
    
    let processedContent = content;
    
    links.forEach(link => {
      const html = this.generateLinkHtml(link, options);
      const regex = new RegExp(REGEX_UTILS.escapeRegExp(link.placeholder), 'g');
      processedContent = processedContent.replace(regex, html);
    });
    
    return processedContent;
  }
  
  generateLinkHtml(link, options = {}) {
    const attrs = {
      href: link.url,
      class: 'markdown-link',
      rel: 'noopener noreferrer',
      target: '_blank',
      title: `Visit ${link.url}`
    };
    
    // Aggiungi attributi personalizzati dalle opzioni
    if (options.linkClass) {
      attrs.class += ` ${options.linkClass}`;
    }
    
    // Costruisci gli attributi HTML
    const attributes = Object.entries(attrs)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
    
    return `<a ${attributes}>${link.text}</a>`;
  }
  
  generateLinkId(url) {
    // Crea un ID univoco basato sull'URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash) + url.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }
  
  createPlaceholderId(url) {
    const id = this.generateLinkId(url);
    return `${this.placeholderPrefix}${id}${this.placeholderSuffix}`;
  }
}
