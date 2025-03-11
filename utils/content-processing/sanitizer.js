/**
 * Sanitizza HTML usando DOMPurify
 */
export function sanitizeHTML(html, options = {}) {
  if (!html) return '';
  
  const {
    allowedTags = [],
    allowedAttributes = {},
    transformTags = {}
  } = options;
  
  try {
    // Assicuriamoci che DOMPurify sia disponibile (caricato via CDN)
    if (typeof DOMPurify === 'undefined') {
      console.warn('DOMPurify non è disponibile. Utilizzando escape HTML di base.');
      return escapeHTML(html);
    }
    
    // Configurazione DOMPurify
    DOMPurify.setConfig({
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: Object.keys(allowedAttributes).reduce((acc, tag) => {
        return acc.concat(allowedAttributes[tag] || []);
      }, []),
      ADD_TAGS: ['iframe'],  // Consenti iframe per video
      FORBID_TAGS: ['script', 'style'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick']
    });
    
    // Applica trasformazioni personalizzate
    if (Object.keys(transformTags).length) {
      DOMPurify.addHook('uponSanitizeElement', (node, data) => {
        if (!transformTags[data.tagName]) return;
        
        try {
          const transformer = transformTags[data.tagName];
          const attribs = {};
          
          // Converti node.attributes in un oggetto semplice
          for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            attribs[attr.name] = attr.value;
          }
          
          const result = transformer(data.tagName, attribs);
          
          // Applica le trasformazioni
          if (result && result.attribs) {
            Object.entries(result.attribs).forEach(([key, value]) => {
              if (typeof key === 'string' && key !== '') {
                try {
                  node.setAttribute(key, value);
                } catch (e) {
                  console.warn(`Errore nell'impostazione dell'attributo ${key}:`, e);
                }
              }
            });
          }
        } catch (e) {
          console.error('Errore durante la trasformazione tag:', e);
        }
      });
    }
    
    return DOMPurify.sanitize(html);
  } catch (error) {
    console.error('Errore durante la sanitizzazione HTML:', error);
    return escapeHTML(html);
  }
}

// Fallback di base per escape HTML
function escapeHTML(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}