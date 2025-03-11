/**
 * Processa il contenuto markdown in HTML
 */
export function processMarkdown(text, options = {}) {
  if (!text) return '';
  
  const {
    allowHtml = false,
    breaks = true,
    // Rimuovi headerIds dalle opzioni predefinite
  } = options;
  
  try {
    // Usa marked.js (assumendo che sia caricato globalmente)
    const renderer = createCustomRenderer();
    
    // Configura marked con le opzioni appropriate
    marked.setOptions({
      renderer,
      gfm: true,
      tables: true,
      breaks,
      pedantic: false,
      smartLists: true,
      smartypants: false,
      headerIds: false,  // Disabilita headerIds per risolvere il warning
      mangle: false      // Mantieni anche questa opzione disabilitata
    });
    
    // Rendering del markdown
    const html = marked.parse(text);
    
    // Se non si vuole permettere HTML, esegui sanitizzazione esterna
    if (!allowHtml) {
      return sanitizeHtmlBasic(html);
    }
    
    return html;
  } catch (error) {
    console.error('Errore nel processing markdown:', error);
    return `<div class="error-content">Errore nel rendering: ${error.message}</div>`;
  }
}

/**
 * Funzione di sanitizzazione base per rimuovere script e altri elementi pericolosi
 * Nota: per un'applicazione in produzione, usa DOMPurify o sanitize-html
 */
function sanitizeHtmlBasic(html) {
  if (typeof DOMPurify !== 'undefined') {
    // Se DOMPurify è disponibile, usalo
    return DOMPurify.sanitize(html);
  }
  
  // Altrimenti usa una soluzione di base (non completa)
  // Rimuovi tag script
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Rimuovi attributi on* (onclick, onload, ecc.)
  html = html.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  
  return html;
}

/**
 * Crea un renderer custom per marked
 */
function createCustomRenderer() {
  const renderer = new marked.Renderer();
  
  // Personalizza il renderer per il link
  renderer.link = (href, title, text) => {
    const isLocalLink = href.startsWith('/') || href.startsWith('#');
    const target = isLocalLink ? '' : ' target="_blank" rel="nofollow noopener"';
    const titleAttr = title ? ` title="${title}"` : '';
    
    return `<a href="${href}"${target}${titleAttr}>${text}</a>`;
  };
  
  // Personalizza il renderer per l'immagine
  renderer.image = (href, title, text) => {
    const titleAttr = title ? ` title="${title}"` : '';
    const altAttr = text ? ` alt="${text}"` : '';
    
    return `<img src="${href}"${altAttr}${titleAttr} class="content-image" loading="lazy">`;
  };
  
  // Altri personalizzazioni...
  
  return renderer;
}