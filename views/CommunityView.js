import View from './View.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import PostList from '../components/PostList.js';
import communityService from '../services/CommunityService.js';
import steemService from '../services/SteemService.js';
import authService from '../services/AuthService.js';
import eventEmitter from '../utils/EventEmitter.js';

class CommunityView extends View {
  constructor(params) {
    super(params);
    this.title = 'Community';
    this.communityId = params.id;
    this.community = null;
    this.posts = [];
    this.isLoading = false;
    this.isSubscribed = false;
    this.isSubscriptionLoading = false;
    this.isLoadingPosts = false;
    this.sortOrder = 'trending'; // Default: trending (altri: created, hot)
    this.currentPage = 1;
    this.postsPerPage = 10;
    this.hasMorePosts = true;
    this.loadingIndicator = null;
    this.postList = null;
    this.currentUser = authService.getCurrentUser();

    // Elementi DOM
    this.communityHeader = null;
    this.postsContainer = null;
    this.loadMoreButton = null;
    this.errorMessage = null;
  }

  /**
   * Renderizza la vista community
   */
  async render(element) {
    this.element = element;

    // Clear container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    // Struttura principale
    const container = document.createElement('div');
    container.className = 'community-view-container';

    // Header con info community (placeholder iniziale)
    const headerPlaceholder = document.createElement('div');
    headerPlaceholder.className = 'community-header-placeholder';
    container.appendChild(headerPlaceholder);

    // Contenitore per i controlli
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'community-controls';

    // Selettore di ordinamento
    const sortContainer = document.createElement('div');
    sortContainer.className = 'community-sort-container';

    const sortLabel = document.createElement('span');
    sortLabel.className = 'sort-label';
    sortLabel.textContent = 'Sort by:';
    sortContainer.appendChild(sortLabel);

    const sortOptions = [
      { value: 'trending', label: 'Trending' },
      { value: 'created', label: 'New' },
      { value: 'hot', label: 'Hot' }
    ];

    const sortSelect = document.createElement('select');
    sortSelect.className = 'sort-select';
    sortSelect.addEventListener('change', (e) => {
      this.sortOrder = e.target.value;
      this.resetPosts();
      this.loadPosts();
    });

    sortOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      optionElement.selected = this.sortOrder === option.value;
      sortSelect.appendChild(optionElement);
    });

    sortContainer.appendChild(sortSelect);
    controlsContainer.appendChild(sortContainer);

    // Pulsante per creare un nuovo post nella community
    if (this.currentUser) {
      const newPostButton = document.createElement('a');
      newPostButton.href = '#/create-post';
      newPostButton.className = 'btn primary-btn new-post-btn';
      newPostButton.innerHTML = '<span class="material-icons">add</span> Create Post';
      newPostButton.addEventListener('click', (e) => {
        // Salva la community come preferenza per il form di creazione
        this.setCreatePostCommunity();
      });
      controlsContainer.appendChild(newPostButton);
    }

    container.appendChild(controlsContainer);

    // Contenitore per i post
    const postsContainer = document.createElement('div');
    postsContainer.className = 'community-posts-container';
    this.postsContainer = postsContainer;
    container.appendChild(postsContainer);

    // Messaggio di errore
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message hidden';
    this.errorMessage = errorMessage;
    container.appendChild(errorMessage);

    // Pulsante carica altri post
    const loadMoreButton = document.createElement('button');
    loadMoreButton.className = 'btn secondary-btn load-more-btn hidden';
    loadMoreButton.textContent = 'Load More Posts';
    loadMoreButton.addEventListener('click', () => this.loadMorePosts());
    this.loadMoreButton = loadMoreButton;
    container.appendChild(loadMoreButton);

    // Aggiungi il container principale alla pagina
    this.element.appendChild(container);

    // Inizializza loading indicator
    this.loadingIndicator = new LoadingIndicator('spinner');

    // Inizializza la lista dei post
    this.postList = new PostList({
      container: this.postsContainer,
      onPostClick: (author, permlink) => {
        window.location.href = `#/@${author}/${permlink}`;
      }
    });

    // Carica i dati della community
    await this.loadCommunityData();
  }

  /**
   * Carica i dati della community
   */
  async loadCommunityData() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.loadingIndicator.show(this.element, 'Loading community...');

    try {
      // Carica i dettagli della community
      this.community = await communityService.getCommunityDetails(this.communityId);
      
      if (!this.community) {
        throw new Error(`Community "${this.communityId}" not found`);
      }

      // Imposta il titolo della pagina
      this.title = this.community.title || `Community: ${this.community.name}`;
      document.title = `${this.title} - Steemee`;

      // Renderizza l'header della community
      this.renderCommunityHeader();

      // Controlla se l'utente è iscritto
      if (this.currentUser) {
        this.checkSubscriptionStatus();
      }

      // Carica i post
      await this.loadPosts();
    } catch (error) {
      console.error('Error loading community data:', error);
      this.showError(`Error loading community: ${error.message}`);
    } finally {
      this.isLoading = false;
      this.loadingIndicator.hide();
    }
  }

  /**
   * Renderizza l'header della community con tutte le informazioni
   */
  renderCommunityHeader() {
    if (!this.community) return;

    // Rimuovi il placeholder
    const placeholder = this.element.querySelector('.community-header-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    // Crea l'header
    const header = document.createElement('div');
    header.className = 'community-header';

    // Banner della community (se disponibile)
    if (this.community.banner_url) {
      const banner = document.createElement('div');
      banner.className = 'community-banner';
      banner.style.backgroundImage = `url(${this.community.banner_url})`;
      header.appendChild(banner);
    }

    // Contenitore principale info
    const infoContainer = document.createElement('div');
    infoContainer.className = 'community-info-wrapper';

    // Avatar community
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'community-avatar-container';

    if (this.community.avatar_url) {
      const avatar = document.createElement('img');
      avatar.src = this.community.avatar_url;
      avatar.alt = this.community.title || this.community.name;
      avatar.className = 'community-avatar';
      avatarContainer.appendChild(avatar);
    } else {
      // Avatar testuale se immagine non disponibile
      const textAvatar = document.createElement('div');
      textAvatar.className = 'community-text-avatar';
      
      // Prima lettera come avatar
      const initial = (this.community.title || this.community.name).charAt(0).toUpperCase();
      textAvatar.textContent = initial;
      
      // Colore basato sul nome
      const hue = Math.abs(this.community.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360);
      textAvatar.style.backgroundColor = `hsl(${hue}, 65%, 50%)`;
      
      avatarContainer.appendChild(textAvatar);
    }

    infoContainer.appendChild(avatarContainer);

    // Dettagli community
    const detailsContainer = document.createElement('div');
    detailsContainer.className = 'community-details';

    // Titolo e nome
    const titleContainer = document.createElement('div');
    titleContainer.className = 'community-title-container';

    const title = document.createElement('h1');
    title.className = 'community-title';
    title.textContent = this.community.title || this.community.name;
    titleContainer.appendChild(title);

    const name = document.createElement('div');
    name.className = 'community-name';
    name.textContent = `@${this.community.name}`;
    titleContainer.appendChild(name);

    detailsContainer.appendChild(titleContainer);

    // Descrizione
    if (this.community.about) {
      const description = document.createElement('div');
      description.className = 'community-description';
      description.textContent = this.community.about;
      detailsContainer.appendChild(description);
    }

    // Statistiche
    const statsContainer = document.createElement('div');
    statsContainer.className = 'community-stats';

    const subscribers = document.createElement('div');
    subscribers.className = 'community-stat';
    subscribers.innerHTML = `<span class="material-icons">people</span> <span class="stat-value">${this.community.subscribers || 0}</span> subscribers`;
    statsContainer.appendChild(subscribers);

    const posts = document.createElement('div');
    posts.className = 'community-stat';
    posts.innerHTML = `<span class="material-icons">article</span> <span class="stat-value">${this.community.num_pending || 0}</span> posts`;
    statsContainer.appendChild(posts);

    detailsContainer.appendChild(statsContainer);

    infoContainer.appendChild(detailsContainer);

    // Azioni (pulsante subscribe/unsubscribe)
    if (this.currentUser) {
      const actionContainer = document.createElement('div');
      actionContainer.className = 'community-actions';

      const subscribeBtn = document.createElement('button');
      subscribeBtn.className = 'btn subscription-btn';
      subscribeBtn.id = 'community-subscribe-btn';
      subscribeBtn.disabled = true; // Disabilitato finché non verifichiamo lo stato dell'iscrizione
      subscribeBtn.innerHTML = '<span class="spinner small"></span>';
      
      subscribeBtn.addEventListener('click', () => this.toggleSubscription());
      
      actionContainer.appendChild(subscribeBtn);
      infoContainer.appendChild(actionContainer);
      
      // Salva il riferimento al pulsante
      this.subscribeButton = subscribeBtn;
    }

    header.appendChild(infoContainer);

    // Aggiungi l'header al container principale (prima dei controlli)
    const controlsContainer = this.element.querySelector('.community-controls');
    if (controlsContainer) {
      this.element.insertBefore(header, controlsContainer);
    } else {
      this.element.appendChild(header);
    }

    this.communityHeader = header;
  }

  /**
   * Controlla se l'utente è iscritto alla community
   */
  async checkSubscriptionStatus() {
    if (!this.currentUser || !this.community) return;
    
    this.isSubscriptionLoading = true;
    
    try {
      const subscriptions = await communityService.getSubscribedCommunities(this.currentUser.username);
      
      // Trova se questa community è nella lista delle iscrizioni
      this.isSubscribed = subscriptions.some(subscription => 
        subscription.name === this.community.name ||
        subscription.name === `hive-${this.community.name.replace(/^hive-/, '')}`
      );
      
      // Aggiorna il pulsante
      this.updateSubscribeButton();
    } catch (error) {
      console.error('Error checking subscription status:', error);
      // Aggiorna comunque il pulsante per consentire l'iscrizione
      this.updateSubscribeButton();
    } finally {
      this.isSubscriptionLoading = false;
    }
  }

  /**
   * Aggiorna il pulsante subscribe/unsubscribe in base allo stato
   */
  updateSubscribeButton() {
    if (!this.subscribeButton) return;
    
    this.subscribeButton.disabled = false;
    
    if (this.isSubscribed) {
      this.subscribeButton.innerHTML = '<span class="material-icons">notifications_active</span> Unsubscribe';
      this.subscribeButton.className = 'btn secondary-btn subscription-btn';
    } else {
      this.subscribeButton.innerHTML = '<span class="material-icons">notifications</span> Subscribe';
      this.subscribeButton.className = 'btn primary-btn subscription-btn';
    }
  }

  /**
   * Gestisce l'iscrizione/disiscrizione dalla community
   */
  async toggleSubscription() {
    if (!this.currentUser || !this.community || this.isSubscriptionLoading) return;
    
    this.isSubscriptionLoading = true;
    
    // Aggiorna il pulsante per mostrare lo stato di caricamento
    this.subscribeButton.disabled = true;
    this.subscribeButton.innerHTML = '<span class="spinner small"></span> ' + 
                                   (this.isSubscribed ? 'Unsubscribing...' : 'Subscribing...');
    
    try {
      const communityName = this.community.name.replace(/^hive-/, '');
      
      if (this.isSubscribed) {
        // Disiscrizione
        await communityService.unsubscribeFromCommunity(
          this.currentUser.username, 
          communityName
        );
        this.isSubscribed = false;
      } else {
        // Iscrizione
        await communityService.subscribeToCommunity(
          this.currentUser.username, 
          communityName
        );
        this.isSubscribed = true;
      }
      
      // Aggiorna il numero di iscritti e il pulsante
      if (this.isSubscribed) {
        this.community.subscribers = (this.community.subscribers || 0) + 1;
      } else if (this.community.subscribers > 0) {
        this.community.subscribers -= 1;
      }
      
      // Aggiorna il contatore nella UI
      const subscribersEl = this.element.querySelector('.community-stats .stat-value');
      if (subscribersEl) {
        subscribersEl.textContent = this.community.subscribers || 0;
      }
      
      // Aggiorna il pulsante
      this.updateSubscribeButton();
      
      // Mostra un messaggio di conferma
      this.showNotification(
        this.isSubscribed 
          ? `Successfully subscribed to ${this.community.title || this.community.name}` 
          : `Successfully unsubscribed from ${this.community.title || this.community.name}`
      );
    } catch (error) {
      console.error('Error toggling subscription:', error);
      this.showError(`Failed to ${this.isSubscribed ? 'unsubscribe from' : 'subscribe to'} community: ${error.message}`);
      
      // Ripristina lo stato originale del pulsante
      this.updateSubscribeButton();
    } finally {
      this.isSubscriptionLoading = false;
    }
  }

  /**
   * Carica i post della community
   */
  async loadPosts() {
    if (this.isLoadingPosts) return;
    
    this.isLoadingPosts = true;
    
    // Mostra il loader nella sezione post
    const loadingEl = document.createElement('div');
    loadingEl.className = 'posts-loading';
    loadingEl.innerHTML = '<div class="spinner"></div><p>Loading posts...</p>';
    this.postsContainer.appendChild(loadingEl);
    
    try {
      // Parametri di ricerca
      const params = {
        sort: this.sortOrder,
        limit: this.postsPerPage,
        community: this.community.name.replace(/^hive-/, '')
      };
      
      // Se è una pagina successiva, aggiungi parametro start_author e start_permlink
      if (this.currentPage > 1 && this.posts.length > 0) {
        const lastPost = this.posts[this.posts.length - 1];
        params.start_author = lastPost.author;
        params.start_permlink = lastPost.permlink;
      }
      
      // Carica i post
      const newPosts = await steemService.getDiscussionsByBlog(params);
      
      // Rimuovi il loader
      loadingEl.remove();
      
      // Gestisci caso in cui non ci sono nuovi post
      if (newPosts.length === 0) {
        this.hasMorePosts = false;
        
        // Se è la prima pagina e non ci sono post, mostra messaggio
        if (this.currentPage === 1) {
          const emptyMessage = document.createElement('div');
          emptyMessage.className = 'empty-posts-message';
          emptyMessage.innerHTML = `
            <span class="material-icons">article_off</span>
            <p>No posts in this community yet.</p>
            ${this.currentUser ? '<p>Be the first to write something!</p>' : ''}
          `;
          this.postsContainer.appendChild(emptyMessage);
        }
        
        this.loadMoreButton.classList.add('hidden');
      } else {
        // Aggiungi i nuovi post all'array e alla vista
        this.posts = [...this.posts, ...newPosts];
        
        // Aggiorna la lista dei post
        this.postList.addPosts(newPosts);
        
        // Mostra il pulsante "Load More" se ci sono probabilmente altri post
        if (newPosts.length >= this.postsPerPage) {
          this.loadMoreButton.classList.remove('hidden');
        } else {
          this.hasMorePosts = false;
          this.loadMoreButton.classList.add('hidden');
        }
        
        // Incrementa la pagina
        this.currentPage++;
      }
    } catch (error) {
      console.error('Error loading community posts:', error);
      
      // Rimuovi il loader
      loadingEl.remove();
      
      // Mostra errore
      const errorEl = document.createElement('div');
      errorEl.className = 'posts-error';
      errorEl.textContent = `Error loading posts: ${error.message}`;
      this.postsContainer.appendChild(errorEl);
    } finally {
      this.isLoadingPosts = false;
    }
  }

  /**
   * Carica più post (pulsante "Load More")
   */
  loadMorePosts() {
    if (!this.hasMorePosts || this.isLoadingPosts) return;
    this.loadPosts();
  }

  /**
   * Resetta la lista dei post (usato quando cambia l'ordinamento)
   */
  resetPosts() {
    this.posts = [];
    this.currentPage = 1;
    this.hasMorePosts = true;
    this.postsContainer.innerHTML = '';
    this.loadMoreButton.classList.add('hidden');
  }

  /**
   * Salva la community selezionata per il form di creazione post
   */
  setCreatePostCommunity() {
    if (!this.community) return;
    
    try {
      sessionStorage.setItem('selectedCommunity', JSON.stringify({
        name: this.community.name,
        title: this.community.title,
        avatar_url: this.community.avatar_url
      }));
    } catch (error) {
      console.error('Error saving selected community:', error);
    }
  }

  /**
   * Mostra un messaggio di errore
   */
  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.className = 'error-message';
    
    // Nascondi dopo 5 secondi
    setTimeout(() => {
      this.errorMessage.className = 'error-message hidden';
    }, 5000);
  }

  /**
   * Mostra una notifica
   */
  showNotification(message) {
    // Crea un elemento di notifica o usa uno esistente
    let notification = document.getElementById('community-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'community-notification';
      notification.className = 'notification hidden';
      document.body.appendChild(notification);
    }
    
    // Imposta il messaggio e mostra la notifica
    notification.textContent = message;
    notification.className = 'notification';
    
    // Nascondi dopo 3 secondi
    setTimeout(() => {
      notification.className = 'notification hidden';
    }, 3000);
  }

  /**
   * Cleanup alla chiusura della vista
   */
  unmount() {
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
    }
    
    // Rimuovi eventualmente la notifica
    const notification = document.getElementById('community-notification');
    if (notification) {
      notification.remove();
    }
    
    super.unmount();
  }
}

export default CommunityView;