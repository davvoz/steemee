// Router
import router from '../utils/Router.js';

// Components
import ContentRenderer from '../components/ContentRenderer.js';
import GridController from '../components/GridController.js';
import LoadingIndicator from '../components/LoadingIndicator.js';

// Utilities
import eventEmitter from '../utils/EventEmitter.js';

/**
 * Base class for views that display lists of posts
 * Shared by HomeView, TagView, and potentially other views
 */
class BasePostView {
  constructor(params = {}) {
    this.params = params;
    this.posts = [];
    this.loading = false;
    this.loadingIndicator = new LoadingIndicator();
    this.infiniteScroll = null;
    this.gridController = new GridController({
      targetSelector: '.posts-container'
    });
    
    // Track post IDs to prevent duplicates
    this.renderedPostIds = new Set();
    
    // Popular tags that will be shown in the tag selection bar
    this.popularTags = [
      'cur8', 'photography', 'art', 'travel', 
      'food', 'music', 'gaming', 'life', 'blockchain', 'crypto'
    ];
    
    // Initialize mobile detection and handling
    this.setupMobileResponsiveness();
    
    // Initialize SteemContentRenderer for image extraction
    this.initSteemRenderer();
  }
  
  /**
   * Setup mobile responsiveness
   */
  setupMobileResponsiveness() {
    // Apply mobile styling initially
    this.handleMobileLayout();
    
    // Update on window resize
    window.addEventListener('resize', () => {
      this.handleMobileLayout();
    });
  }
  
  /**
   * Check if the current device is mobile (based on screen width)
   */
  isMobileDevice() {
    return window.innerWidth < 768; // Common breakpoint for mobile devices
  }
  
  /**
   * Handle mobile layout adjustments
   */
  handleMobileLayout() {
    // Find all posts-container elements (there might be multiple in the app)
    const containers = document.querySelectorAll('.posts-container');
    
    if (this.isMobileDevice()) {
      // Add mobile class to enforce single column
      containers.forEach(container => {
        container.classList.add('mobile-view');
        
        // Force single column through inline style for immediate effect
        container.style.gridTemplateColumns = '1fr';
      });
    } else {
      // Remove mobile class on larger screens
      containers.forEach(container => {
        container.classList.remove('mobile-view');
        container.style.gridTemplateColumns = ''; // Remove inline style to let CSS take over
      });
    }
  }

  /**
   * Initialize SteemContentRenderer for image extraction
   */
  async initSteemRenderer() {
    try {
      await ContentRenderer.loadSteemContentRenderer();
      this.contentRenderer = new ContentRenderer({
        useSteemContentRenderer: true,
        extractImages: true,
        renderImages: true
      });
    } catch (error) {
      console.error('Failed to initialize SteemContentRenderer:', error);
      this.contentRenderer = null;
    }
  }

  /**
   * Load posts method to be implemented by child classes
   */
  async loadPosts(page = 1) {
    throw new Error('loadPosts method must be implemented by subclass');
  }

  /**
   * Handle load errors
   */
  handleLoadError() {
    eventEmitter.emit('notification', {
      type: 'error',
      message: 'Failed to load posts. Please try again later.'
    });
    
    const postsContainer = this.container?.querySelector('.posts-container');
    if (!postsContainer) return;
    
    this.clearContainer(postsContainer);
    const errorElement = this.createErrorElement();
    postsContainer.appendChild(errorElement);
  }
  
  /**
   * Create error element
   */
  createErrorElement() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-state';
    
    const errorHeading = document.createElement('h3');
    errorHeading.textContent = 'Failed to load posts';
    
    const errorMessage = document.createElement('p');
    errorMessage.textContent = 'There was an error connecting to the Steem blockchain.';
    
    const retryButton = document.createElement('button');
    retryButton.className = 'btn-primary retry-btn';
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', () => this.loadPosts());
    
    errorDiv.append(errorHeading, errorMessage, retryButton);
    return errorDiv;
  }

  /**
   * Render posts
   */
  renderPosts(append = false) {
    const postsContainer = this.container?.querySelector('.posts-container');
    
    if (!postsContainer) return;
    
    if (!append) {
      this.clearContainer(postsContainer);
      this.renderedPostIds.clear();
    }

    // Calculate which posts to render
    let postsToRender = [];
    if (append) {
      // When appending, get only the new posts
      const currentPostCount = postsContainer.querySelectorAll('.post-card').length;
      postsToRender = this.posts.slice(currentPostCount);
    } else {
      // When not appending (fresh render), get all posts
      postsToRender = this.posts;
    }
    
    console.log(`Rendering ${postsToRender.length} posts (append: ${append})`);
    
    // Filter out any duplicates that might have slipped through
    const uniquePostsToRender = postsToRender.filter(post => {
      const postId = `${post.author}_${post.permlink}`;
      if (this.renderedPostIds.has(postId)) {
        return false;
      }
      this.renderedPostIds.add(postId);
      return true;
    });

    console.log(`Rendering ${uniquePostsToRender.length} unique posts`);
    
    // Show no posts message if needed
    if (uniquePostsToRender.length === 0 && this.posts.length === 0) {
      this.renderNoPostsMessage(postsContainer);
      return;
    }
    
    // Render each post
    uniquePostsToRender.forEach(post => this.renderPostCard(post, postsContainer));
  }

  /**
   * Show a message when no posts are found
   */
  renderNoPostsMessage(container) {
    // Do nothing - we don't want to show any message
    // The container will simply remain empty
  }

  /**
   * Clear a container element
   */
  clearContainer(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  /**
   * Renders a post card
   */
  renderPostCard(post, container) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    
    // Parse metadata to extract better images and tags
    const metadata = this.parseMetadata(post.json_metadata);
    
    // Get the best available image
    const imageUrl = this.getBestImage(post, metadata);
    
    // 1. Add header (author info) - Always at the top
    postCard.appendChild(this.createPostHeader(post));
    
    // 2. Main content - can be vertical or horizontal depending on layout
    const mainContent = document.createElement('div');
    mainContent.className = 'post-main-content';
    
    // 2a. Add image preview
    mainContent.appendChild(this.createPostImage(imageUrl, post.title));
    
    // 2b. Wrapper for text content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'post-content-wrapper';
    
    // Middle section with title, excerpt, tags
    const contentMiddle = document.createElement('div');
    contentMiddle.className = 'post-content-middle';
    
    // Title
    contentMiddle.appendChild(this.createPostTitle(post.title));
    
    // Excerpt for list layout
    if (post.body) {
      const excerpt = document.createElement('div');
      excerpt.className = 'post-excerpt';
      const textExcerpt = this.createExcerpt(post.body);
      // Make sure all links are completely removed from the excerpt
      excerpt.textContent = textExcerpt.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
      contentMiddle.appendChild(excerpt);
    }
    
    // Tags
    if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      contentMiddle.appendChild(this.createPostTags(metadata.tags.slice(0, 2)));
    }
    
    contentWrapper.appendChild(contentMiddle);
    
    // Actions (votes, comments, payout)
    contentWrapper.appendChild(this.createPostActions(post));
    
    // Add text content to main content
    mainContent.appendChild(contentWrapper);
    
    // Add main content to card
    postCard.appendChild(mainContent);
    
    // Click event - Navigate to post
    postCard.addEventListener('click', (e) => {
      e.preventDefault();
      const postUrl = `/@${post.author}/${post.permlink}`;
      router.navigate(postUrl);
    });
    
    container.appendChild(postCard);
  }

  /**
   * Extract the best image from a post
   */
  getBestImage(post, metadata) {
    // If we have SteemContentRenderer available, use it for rendering a snippet and extracting image
    if (this.contentRenderer) {
      try {
        // Render a small portion of the content to extract images
        const renderedContent = this.contentRenderer.render({
          body: post.body.substring(0, 1500) // Only render the first part for performance
        });
        
        // Check if any images were extracted
        if (renderedContent.images && renderedContent.images.length > 0) {
          // Return the first image URL
          return renderedContent.images[0].src;
        }
      } catch (error) {
        console.error('Error using SteemContentRenderer for image extraction:', error);
        // Fall back to old methods if SteemContentRenderer fails
      }
    }
    
    // Fallback method 1: Check if metadata contains an image
    if (metadata && metadata.image && metadata.image.length > 0) {
      return metadata.image[0];
    }
    
    // Fallback method 2: Simple regex extraction of first image
    const imgRegex = /https?:\/\/[^\s'"<>]+?\.(jpg|jpeg|png|gif|webp)(\?[^\s'"<>]+)?/i;
    const match = post.body.match(imgRegex);
    if (match) {
      return match[0];
    }
    
    // Return placeholder if no image is found
    return './assets/img/placeholder.png';
  }

  /**
   * Optimize an image URL for display
   */
  optimizeImageUrl(url) {
    // Use SteemContentRenderer's proxy if available
    if (this.contentRenderer && this.contentRenderer.steemRenderer) {
      try {
        // Format URL for proper sizing with Steem's proxy
        return `https://steemitimages.com/640x0/${url}`;
      } catch (error) {
        console.error('Error using SteemContentRenderer for image optimization:', error);
      }
    }
    
    // Fallback to direct URL with proper formatting
    if (url && url.startsWith('http')) {
      // Simple proxy URL construction
      return `https://steemitimages.com/640x0/${url}`;
    }
    
    return url;
  }

  /**
   * Sanitize an image URL
   */
  sanitizeImageUrl(url) {
    if (!url) return '';
    
    // Remove query parameters and fragments
    let cleanUrl = url.split('?')[0].split('#')[0];
    
    // Ensure URL is properly encoded
    try {
      cleanUrl = new URL(cleanUrl).href;
    } catch (e) {
      // If URL is invalid, return original
      return url;
    }
    
    return cleanUrl;
  }

  /**
   * Parse post metadata
   */
  parseMetadata(jsonMetadata) {
    try {
      if (typeof jsonMetadata === 'string') {
        return JSON.parse(jsonMetadata);
      }
      return jsonMetadata || {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Create post header with author info
   */
  createPostHeader(post) {
    const header = document.createElement('div');
    header.className = 'post-header';
    
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'avatar-container';
    
    const avatar = document.createElement('img');
    avatar.alt = post.author;
    avatar.className = 'avatar';
    avatar.loading = 'lazy';
    
    // Add retry mechanism for avatars too
    let retryCount = 0;
    
    const loadAvatar = () => {
      // Try multiple sources in sequence
      const avatarSources = [
        `https://steemitimages.com/u/${post.author}/avatar`,
      ];
      
      let currentSourceIndex = 0;
      
      const tryNextSource = () => {
        if (currentSourceIndex >= avatarSources.length) {
          // We've tried all sources, use default
          avatar.src = './assets/img/default-avatar.png';
          return;
        }
        
        const currentSource = avatarSources[currentSourceIndex];
        currentSourceIndex++;
        
        avatar.onerror = () => {
          // Try next source after a short delay
          setTimeout(tryNextSource, 300);
        };
        
        // Add cache busting only for retries on same source
        if (retryCount > 0 && !currentSource.includes('default-avatar')) {
          avatar.src = `${currentSource}?retry=${Date.now()}`;
        } else {
          avatar.src = currentSource;
        }
      };
      
      // Start the loading process
      tryNextSource();
    };
    
    loadAvatar();
    
    avatarContainer.appendChild(avatar);
    
    const info = document.createElement('div');
    info.className = 'post-info';
    
    const author = document.createElement('div');
    author.className = 'post-author';
    author.textContent = `@${post.author}`;
    
    const date = document.createElement('div');
    date.className = 'post-date';
    const postDate = new Date(post.created);
    date.textContent = postDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    info.append(author, date);
    header.append(avatarContainer, info);
    
    return header;
  }

  /**
   * Create post image container
   */
  createPostImage(imageUrl, title) {
    const content = document.createElement('div');
    content.className = 'post-image-container';
    content.classList.add('loading');
    
    const image = document.createElement('img');
    image.alt = title || 'Post image';
    image.loading = 'lazy';
    image.decoding = 'async';
    
    // Check if we have a valid image URL before attempting to load
    if (!imageUrl || imageUrl === './assets/img/placeholder.png') {
      // Skip the loading process entirely and use placeholder immediately
      content.classList.remove('loading');
      content.classList.add('error');
      image.src = './assets/img/placeholder.png';
      content.appendChild(image);
      return content;
    }
    
    // Enforce a clean URL before we start
    imageUrl = this.sanitizeImageUrl(imageUrl);
    
    // Determine current card size AND layout from container classes
    const { size: cardSize, layout } = this.getCardConfig();
    
    // Use different image sizes based on card size setting AND layout
    const sizesToTry = this.getImageSizesToTry( layout);
    
    let currentSizeIndex = 0;
    let isLoadingPlaceholder = false;
    
    const loadNextSize = () => {
      if (currentSizeIndex >= sizesToTry.length || isLoadingPlaceholder) {
        loadPlaceholder();
        return;
      }
      
      const sizeOption = sizesToTry[currentSizeIndex++];
      let url;
      
      if (sizeOption.direct) {
        url = imageUrl;
      } else {
        url = `https://${sizeOption.cdn}/${sizeOption.size}x0/${imageUrl}`;
      }
      
      loadImage(url);
    };
    
    const loadImage = (url) => {
      if (isLoadingPlaceholder) return;
      
      const timeoutId = setTimeout(() => {
        if (!image.complete) {
          console.log(`Image load timeout: ${url.substring(0, 50)}...`);
          tryNextOption("Timeout");
        }
      }, 5000);
      
      image.onload = () => {
        clearTimeout(timeoutId);
        content.classList.remove('loading', 'error');
        content.classList.add('loaded');
      };
      
      image.onerror = () => {
        clearTimeout(timeoutId);
        console.log(`Image load error: ${url.substring(0, 50)}...`);
        tryNextOption("Failed to load");
      };
      
      image.src = url;
    };
    
    const tryNextOption = (errorReason) => {
      if (isLoadingPlaceholder) return;
      loadNextSize();
    };
    
    const loadPlaceholder = () => {
      if (isLoadingPlaceholder) return;
      
      isLoadingPlaceholder = true;
      content.classList.remove('loading');
      content.classList.add('error');
      
      // Use placeholder image
      image.src = './assets/img/placeholder.png';
    };
    
    // Start loading with first size option
    loadNextSize();
    
    content.appendChild(image);
    return content;
  }

  /**
   * Get current card size AND layout setting from container classes
   */
  getCardConfig() {
    if (!this.container) return { size: 'medium', layout: 'grid' };
    
    const postsContainer = this.container.querySelector('.posts-container');
    if (!postsContainer) return { size: 'medium', layout: 'grid' };
    
    // We only care about layout now, but keep size for backward compatibility
    let size = 'medium';
    
    // Determine layout type
    let layout = 'grid';
    if (postsContainer.classList.contains('grid-layout-list')) layout = 'list';
    if (postsContainer.classList.contains('grid-layout-compact')) layout = 'compact';
    
    return { size, layout };
  }

  /**
   * Get appropriate image sizes based only on layout
   */
  getImageSizesToTry( layout) {
    // Simplify image sizes based only on layout type
    switch(layout) {
      case 'list':
        return [
          {size: 800, cdn: 'steemitimages.com'}, // Higher quality for list layout
          {size: 640, cdn: 'steemitimages.com'}, // Medium-high quality
          {size: 400, cdn: 'steemitimages.com'}, // Medium quality fallback
          {direct: true} // Direct URL as last resort
        ];
      case 'compact':
        return [
          {size: 320, cdn: 'steemitimages.com'}, // Smaller size for compact layout
          {size: 200, cdn: 'steemitimages.com'}, // Even smaller fallback
          {direct: true} // Direct URL as last resort
        ];
      case 'grid':
      default:
        return [
          {size: 640, cdn: 'steemitimages.com'}, // Standard quality for grid
          {size: 400, cdn: 'steemitimages.com'}, // Medium quality
          {size: 200, cdn: 'steemitimages.com'}, // Lower quality as fallback
          {direct: true} // Direct URL as last resort
        ];
    }
  }

  /**
   * Create post title element
   */
  createPostTitle(title) {
    const element = document.createElement('div');
    element.className = 'post-title';
    element.textContent = title;
    return element;
  }
  
  /**
   * Create post tags container
   */
  createPostTags(tags) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'post-tags';
    
    // Show max 2 tags to avoid crowding the UI
    const displayTags = tags.slice(0, 2);
    
    displayTags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'post-tag';
      tagElement.textContent = tag;
      tagsContainer.appendChild(tagElement);
    });
    
    return tagsContainer;
  }

  /**
   * Get vote count from post
   */
  getVoteCount(post) {
    // Try different properties that might contain vote count
    if (typeof post.net_votes === 'number') {
      return post.net_votes;
    }
    if (typeof post.active_votes === 'object' && Array.isArray(post.active_votes)) {
      return post.active_votes.length;
    }
    if (typeof post.vote_count === 'number') {
      return post.vote_count;
    }
    // Default to 0 if no valid vote count is found
    return 0;
  }

  /**
   * Create post actions bar
   */
  createPostActions(post) {
    const actions = document.createElement('div');
    actions.className = 'post-actions';
    
    const voteCount = this.getVoteCount(post);
    const voteAction = this.createActionItem('thumb_up', voteCount);
    voteAction.classList.add('vote-action');
    
    const commentAction = this.createActionItem('chat', post.children || 0);
    commentAction.classList.add('comment-action');
    
    const payoutAction = this.createActionItem('attach_money', parseFloat(post.pending_payout_value || 0).toFixed(2));
    payoutAction.classList.add('payout-action');
    
    actions.append(voteAction, commentAction, payoutAction);
    
    return actions;
  }

  /**
   * Create an action item for the post actions bar
   */
  createActionItem(iconName, text) {
    const actionItem = document.createElement('div');
    actionItem.className = 'action-item';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = iconName;
    
    actionItem.appendChild(icon);
    actionItem.append(document.createTextNode(` ${text}`));
    
    return actionItem;
  }

  /**
   * Create excerpt from post body
   */
  createExcerpt(body, maxLength = 150) {
    if (!body) return '';
    
    // Remove markdown and html more effectively
    const plainText = body
        .replace(/!\[.*?\]\(.*?\)/g, '') // remove markdown images
        .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // remove markdown links keeping the text
        .replace(/<a.*?href=["'](.+?)["'].*?>(.+?)<\/a>/gi, '$2') // remove HTML links keeping text
        .replace(/https?:\/\/\S+/g, '') // remove all URLs
        .replace(/<\/?[^>]+(>|$)/g, '') // remove html tags
        .replace(/#{1,6}\s/g, '') // remove headings (1-6 hashes)
        .replace(/(\*\*|__)(.*?)(\*\*|__)/g, '$2') // convert bold to normal text
        .replace(/(\*|_)(.*?)(\*|_)/g, '$2') // convert italic to normal text
        .replace(/~~(.*?)~~/g, '$1') // convert strikethrough to normal text
        .replace(/>\s*(.*?)(\n|$)/g, '') // remove blockquotes
        .replace(/```[\s\S]*?```/g, '') // remove code blocks with triple backticks
        .replace(/`[^`]*`/g, '') // remove inline code with single backticks
        .replace(/~~~[\s\S]*?~~~/g, '') // remove code blocks with triple tildes
        .replace(/\n\n/g, ' ') // replace double newlines with space
        .replace(/\n/g, ' ') // replace single newlines with space
        .replace(/\s+/g, ' ') // replace multiple spaces with a single space
        .trim();
    
    // Truncate and add ellipsis if necessary
    if (plainText.length <= maxLength) {
        return plainText;
    }
    
    return plainText.substring(0, maxLength) + '...';
  }

  /**
   * Create the tag selection bar
   */
  createTagSelectionBar() {
    const tagBarContainer = document.createElement('div');
    tagBarContainer.className = 'tag-selection-bar';
    
    // Create scrollable tag list container
    const tagListContainer = document.createElement('div');
    tagListContainer.className = 'tag-list-container';
    
    // Create the actual scrollable list
    const tagList = document.createElement('div');
    tagList.className = 'tag-list';
    
    // Add popular tags to the scrollable list
    this.popularTags.forEach(tag => {
      const tagItem = this.createTagItem(tag);
      tagList.appendChild(tagItem);
    });
    
    // Add the list to the container
    tagListContainer.appendChild(tagList);
    
    // Add tag list to the main container
    tagBarContainer.appendChild(tagListContainer);
    
    // Scroll active tag into view
    setTimeout(() => {
      const activeTag = tagList.querySelector('.tag-item.active');
      if (activeTag) {
        activeTag.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 100);
    
    return tagBarContainer;
  }
  
  /**
   * Creates a tag item for the scrollable list
   */
  createTagItem(tag) {
    const item = document.createElement('div');
    item.className = 'tag-item';
    
    // Highlight the active tag
    if (tag === this.getCurrentTag()) {
      item.classList.add('active');
    }
    
    item.textContent = this.formatTagName(tag);
    
    // Add click handler to navigate to tag
    item.addEventListener('click', () => {
      this.navigateToTag(tag);
    });
    
    return item;
  }

  /**
   * Get the current tag (to be implemented by subclasses)
   */
  getCurrentTag() {
    throw new Error('getCurrentTag method must be implemented by subclass');
  }
  
  /**
   * Navigate to a specific tag
   */
  navigateToTag(tag) {
    if (!tag) return;
    
    // Ensure the tag is properly formatted - lowercase and trimmed
    const formattedTag = tag.trim().toLowerCase();
    
    if (formattedTag === 'trending' || formattedTag === 'hot' || 
        formattedTag === 'new' || formattedTag === 'promoted') {
      router.navigate(`/${formattedTag}`);
    } else {
      router.navigate(`/tag/${formattedTag}`);
    }
  }
  
  /**
   * Format tag name for display (capitalize first letter)
   */
  formatTagName(tag) {
    return tag.charAt(0).toUpperCase() + tag.slice(1);
  }

  /**
   * Render method to be implemented by child classes
   */
  render(container) {
    throw new Error('render method must be implemented by subclass');
  }

  /**
   * Base render implementation that can be called by subclasses
   */
  renderBaseView(container, title) {
    this.container = container;
    
    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';

    // Create header area with title and grid controls
    const headerArea = document.createElement('div');
    headerArea.className = 'header-area';
    
    // Create heading
    const heading = document.createElement('h1');
    heading.textContent = title;
    headerArea.appendChild(heading);
    
    // Create grid controller container
    const gridControllerContainer = document.createElement('div');
    gridControllerContainer.className = 'grid-controller-container';
    headerArea.appendChild(gridControllerContainer);
    
    contentWrapper.appendChild(headerArea);
    
    // Create tag selection bar
    const tagSelectionBar = this.createTagSelectionBar();
    contentWrapper.appendChild(tagSelectionBar);

    // Create posts container
    const postsContainer = document.createElement('div');
    postsContainer.className = 'posts-container';

    // Add to content wrapper
    contentWrapper.appendChild(postsContainer);

    // Add to container
    container.appendChild(contentWrapper);
    
    // Initialize grid controller
    this.gridController.render(gridControllerContainer);
    
    // Show loading indicator while posts are loading
    this.loadingIndicator.show(postsContainer);
    
    return { postsContainer };
  }

  /**
   * Unmount view and clean up resources
   */
  unmount() {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    if (this.gridController) {
      this.gridController.unmount();
    }
  }
}

export default BasePostView;
