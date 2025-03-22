import ContentRenderer from './ContentRenderer.js';

/**
 * Componente riutilizzabile per visualizzare elenchi di post
 */
class PostList {
  /**
   * Costruttore del componente PostList
   * @param {Object} options - Opzioni di configurazione
   * @param {HTMLElement} options.container - Elemento DOM contenitore
   * @param {Function} options.onPostClick - Callback quando un post viene cliccato
   * @param {boolean} options.showAuthor - Se mostrare l'autore (default: true)
   * @param {boolean} options.showCommunity - Se mostrare la community (default: true)
   * @param {number} options.excerptLength - Lunghezza dell'estratto (default: 150)
   */
  constructor(options = {}) {
    this.container = options.container;
    this.onPostClick = options.onPostClick || (() => {});
    this.showAuthor = options.showAuthor !== false;
    this.showCommunity = options.showCommunity !== false;
    this.excerptLength = options.excerptLength || 150;
    this.contentRenderer = new ContentRenderer({ isPreview: true });
  }

  /**
   * Aggiunge un array di post alla lista
   * @param {Array} posts - Array di oggetti post
   */
  addPosts(posts) {
    if (!Array.isArray(posts) || !posts.length) return;
    
    const fragment = document.createDocumentFragment();
    
    posts.forEach(post => {
      const postElement = this.createPostElement(post);
      fragment.appendChild(postElement);
    });
    
    this.container.appendChild(fragment);
  }

  /**
   * Crea un elemento DOM per un singolo post
   * @param {Object} post - Dati del post
   * @returns {HTMLElement} - Elemento DOM del post
   */
  createPostElement(post) {
    // Estrai informazioni dal post
    const { author, permlink, title, body, created, json_metadata } = post;
    const metadata = this.parseMetadata(json_metadata);
    const community = metadata?.community || post.category;
    
    // Calcola payout e voti
    const pendingPayout = parseFloat(post.pending_payout_value?.split(' ')[0] || 0);
    const totalPayout = parseFloat(post.total_payout_value?.split(' ')[0] || 0);
    const curatorPayout = parseFloat(post.curator_payout_value?.split(' ')[0] || 0);
    const totalValue = (pendingPayout + totalPayout + curatorPayout).toFixed(2);
    
    const netVotes = post.net_votes || 0;
    const childCount = post.children || 0;
    
    // Crea elemento post
    const postElement = document.createElement('div');
    postElement.className = 'post-item';
    postElement.dataset.author = author;
    postElement.dataset.permlink = permlink;
    
    // Crea struttura HTML del post
    postElement.innerHTML = `
      <div class="post-item-content">
        ${this.showAuthor ? `
          <div class="post-item-author">
            <img src="https://steemitimages.com/u/${author}/avatar" alt="${author}" class="post-author-avatar" />
            <a href="#/@${author}" class="post-author-name">@${author}</a>
            ${this.showCommunity && community ? `
              <span class="post-item-community">
                <span class="community-separator">in</span>
                <a href="#/community/${community.replace(/^hive-/, '')}" class="post-community-link">
                  <span class="material-icons community-icon-small">group</span>
                  ${community.startsWith('hive-') ? community : `hive-${community}`}
                </a>
              </span>
            ` : ''}
            <span class="post-item-date">${this.formatDate(created)}</span>
          </div>
        ` : ''}
        
        <h2 class="post-item-title">${this.escapeHTML(title)}</h2>
        
        <div class="post-item-excerpt"></div>
        
        <div class="post-item-meta">
          <span class="post-item-payout">
            <span class="material-icons">attach_money</span>
            ${totalValue} SBD
          </span>
          <span class="post-item-votes">
            <span class="material-icons">thumb_up</span>
            ${netVotes}
          </span>
          <span class="post-item-comments">
            <span class="material-icons">comment</span>
            ${childCount}
          </span>
        </div>
      </div>
    `;
    
    // Renderizza l'estratto del contenuto
    const excerptElement = postElement.querySelector('.post-item-excerpt');
    const excerpt = this.getExcerpt(body, this.excerptLength);
    this.contentRenderer.render(excerpt, excerptElement);
    
    // Aggiungi immagine di anteprima se disponibile
    const thumbnailUrl = this.getThumbnailUrl(metadata);
    if (thumbnailUrl) {
      const thumbnailContainer = document.createElement('div');
      thumbnailContainer.className = 'post-item-thumbnail';
      thumbnailContainer.innerHTML = `<img src="${thumbnailUrl}" alt="${this.escapeHTML(title)}" loading="lazy">`;
      postElement.insertBefore(thumbnailContainer, postElement.firstChild);
      postElement.classList.add('has-thumbnail');
    }
    
    // Aggiungi event listener per il click sul post
    postElement.addEventListener('click', (e) => {
      // Se il click è su un link, non fare nulla (lascia che il browser gestisca il link)
      if (e.target.tagName === 'A' || e.target.closest('a')) {
        return;
      }
      
      this.onPostClick(author, permlink);
    });
    
    return postElement;
  }

  /**
   * Ottiene un estratto del contenuto del post
   * @param {string} body - Contenuto completo
   * @param {number} length - Lunghezza massima
   * @returns {string} - Estratto del contenuto
   */
  getExcerpt(body, length) {
    // Rimuovi markdown e HTML
    let excerpt = body
      .replace(/!\[.*?\]\(.*?\)/g, '') // Rimuovi immagini markdown
      .replace(/\[.*?\]\(.*?\)/g, '$1') // Sostituisci link con testo
      .replace(/<.+?>/g, '') // Rimuovi tag HTML
      .replace(/\n+/g, ' ') // Sostituisci newline con spazi
      .trim();
    
    // Tronca alla lunghezza desiderata
    if (excerpt.length > length) {
      excerpt = excerpt.substring(0, length) + '...';
    }
    
    return excerpt;
  }

  /**
   * Ottiene URL della thumbnail dal metadata
   * @param {Object} metadata - Metadata del post
   * @returns {string|null} - URL della thumbnail o null
   */
  getThumbnailUrl(metadata) {
    if (!metadata) return null;
    
    // Prima prova ad ottenere l'immagine dal campo image
    if (metadata.image && metadata.image.length > 0) {
      return metadata.image[0];
    }
    
    // Poi prova a cercare nel campo json_metadata
    if (metadata.thumbnail) {
      return metadata.thumbnail;
    }
    
    return null;
  }

  /**
   * Analizza i metadati JSON
   * @param {string} json - Stringa JSON
   * @returns {Object} - Oggetto metadata
   */
  parseMetadata(json) {
    if (!json) return {};
    
    try {
      return typeof json === 'string' ? JSON.parse(json) : json;
    } catch (e) {
      console.error('Error parsing post metadata:', e);
      return {};
    }
  }

  /**
   * Formatta una data in formato leggibile
   * @param {string} dateString - Data ISO
   * @returns {string} - Data formattata
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Escape caratteri HTML
   * @param {string} html - Stringa con HTML
   * @returns {string} - Stringa sicura
   */
  escapeHTML(html) {
    if (!html) return '';
    
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Pulisce tutti i post dalla lista
   */
  clear() {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}

export default PostList;