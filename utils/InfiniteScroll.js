export default class InfiniteScroll {
  constructor({
    container,
    loadMore,
    threshold = '200px',
    initialPage = 1,
    loadingMessage = 'Loading more...',
    endMessage = 'No more posts to load',
    errorMessage = 'Error loading content. Please try again.'
  }) {
    this.container = container;
    this.loadMore = loadMore;
    this.threshold = threshold;
    this.currentPage = initialPage;
    this.isLoading = false;
    this.hasMore = true;
    this.observer = null;
    this.observerTarget = null;
    this.loadingMessage = loadingMessage;
    this.endMessage = endMessage;
    this.errorMessage = errorMessage;
    
    console.log('InfiniteScroll initialized with container:', container);
    this.setupObserver();
  }

  setupObserver() {
    // Remove any existing observer target
    if (this.observerTarget) {
      this.observerTarget.remove();
    }
    
    // Create and add new observer target
    this.observerTarget = document.createElement('div');
    this.observerTarget.className = 'observer-target';
    this.observerTarget.style.height = '20px';
    this.observerTarget.style.width = '100%';
    this.observerTarget.style.margin = '20px 0';
    this.container.appendChild(this.observerTarget);
    
    console.log('Observer target added to container:', this.observerTarget);

    // Clean up any existing observer
    if (this.observer) {
      this.observer.disconnect();
    }

    // Create new intersection observer
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.isLoading && this.hasMore) {
          console.log('Observer target is intersecting, loading more items');
          this.loadNextPage();
        }
      },
      { 
        rootMargin: this.threshold,
        threshold: 0.1 
      }
    );

    this.observer.observe(this.observerTarget);
    console.log('IntersectionObserver started observing target');
  }

  async loadNextPage() {
    if (this.isLoading || !this.hasMore) return;
    
    try {
      console.log(`Loading page ${this.currentPage+1}`);
      this.isLoading = true;
      
      // Create loading indicator
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'loading-indicator';
      loadingIndicator.textContent = this.loadingMessage;
      loadingIndicator.style.textAlign = 'center';
      loadingIndicator.style.padding = '10px';
      this.container.appendChild(loadingIndicator);
      
      // Load more content
      const hasMoreItems = await this.loadMore(this.currentPage + 1);
      console.log(`Loaded page ${this.currentPage+1}, has more: ${hasMoreItems}`);
      
      // Remove loading indicator
      if (loadingIndicator.parentNode) {
        loadingIndicator.remove();
      }
      
      // Update state
      this.hasMore = Boolean(hasMoreItems);
      if (this.hasMore) {
        this.currentPage++;
        
        // Reposition the observer target at the end of the container
        if (this.observerTarget && this.observerTarget.parentNode) {
          this.container.appendChild(this.observerTarget);
        }
      } else {
        console.log('No more items to load');
        
        // Check if we already have an end message
        const existingEndMessage = this.container.querySelector('.end-message');
        if (!existingEndMessage) {
          // Show end message
          const endMessage = document.createElement('div');
          endMessage.className = 'end-message';
          endMessage.textContent = this.endMessage;
          endMessage.style.textAlign = 'center';
          endMessage.style.padding = '20px';
          this.container.appendChild(endMessage);
        }
        
        // Remove observer target since we don't need it anymore
        if (this.observerTarget && this.observerTarget.parentNode) {
          this.observerTarget.remove();
        }
      }
    } catch (error) {
      console.error('Error loading more items:', error);
      
      // Show error message
      const errorElement = document.createElement('div');
      errorElement.className = 'infinite-scroll-error';
      errorElement.textContent = this.errorMessage;
      errorElement.style.textAlign = 'center';
      errorElement.style.padding = '10px';
      errorElement.style.color = 'red';
      this.container.appendChild(errorElement);
      
      // Add retry button
      const retryButton = document.createElement('button');
      retryButton.textContent = 'Retry';
      retryButton.style.marginLeft = '10px';
      retryButton.addEventListener('click', () => {
        errorElement.remove();
        this.loadNextPage();
      });
      errorElement.appendChild(retryButton);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Forza un caricamento manuale per la pagina specificata
   * @param {number} page - Pagina da caricare
   * @returns {Promise<boolean>} - Restituisce true se ci sono più pagine da caricare
   */
  async forceLoadPage(page) {
    if (!this.loadMore) return false;
    
    try {
        console.log(`Triggering load more for page ${page}`);
        
        // Store currentPage before calling loadMore to avoid duplicate calls
        this.currentPage = page;
        
        // Call loadMore callback and get the result
        const hasMore = await this.loadMore(page);
        
        // Update current page only if we have more to load, otherwise keep as is
        if (!hasMore) {
            this.noMorePages = true;
            console.log('No more pages to load, disabling infinite scroll');
        }
        
        return hasMore;
    } catch (error) {
        console.error(`Error in forceLoadPage (page ${page}):`, error);
        return false;
    }
  }

  destroy() {
    console.log('Destroying infinite scroll');
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.observerTarget && this.observerTarget.parentNode) {
      this.observerTarget.remove();
      this.observerTarget = null;
    }
  }

  reset(initialPage = 1) {
    console.log('Resetting infinite scroll');
    this.currentPage = initialPage;
    this.hasMore = true;
    this.isLoading = false;
    
    // Remove any existing end messages
    const endMessages = this.container.querySelectorAll('.end-message');
    endMessages.forEach(msg => msg.remove());
    
    // Remove any error messages
    const errorMessages = this.container.querySelectorAll('.infinite-scroll-error');
    errorMessages.forEach(msg => msg.remove());
    
    this.setupObserver();
  }
  
  updateContainer(newContainer) {
    if (this.container !== newContainer) {
      this.container = newContainer;
      this.setupObserver();
    }
  }
}
