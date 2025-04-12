import commentService from '../services/CommentService.js';
import authService from '../services/AuthService.js';
import router from '../utils/Router.js';
import LoadingIndicator from '../components/LoadingIndicator.js';


export default class CommentController {
  constructor(view) {
    this.view = view;
    this.initialized = false;

    // Use MutationObserver instead of setTimeout for more reliable initialization
    this.observer = new MutationObserver(this.checkForCommentForm.bind(this));

    // Start observing the view element once it's available
    if (this.view.element) {
      this.startObserving();
    } else {
      // If view.element isn't available yet, wait for render
      const originalRender = this.view.renderComponents;
      this.view.renderComponents = async function (...args) {
        const result = await originalRender.apply(this, args);
        this.commentController.startObserving();
        return result;
      };
    }
  }

  /**
   * Start observing DOM changes to detect when comment form is added
   */
  startObserving() {
    if (!this.view.element) return;

    this.observer.observe(this.view.element, {
      childList: true,
      subtree: true
    });

    // Also try immediate initialization in case the form is already there
    this.checkForCommentForm();
  }

  /**
   * Check if comment form exists in the DOM and initialize if found
   */
  checkForCommentForm() {
    if (this.initialized) return;

    // Try various selectors to find the comment form and button
    const selectors = [
      '.comment-form .submit-comment',
      '.comments-section .submit-comment',
      'button.submit-comment',
      '.comments-section form button[type="submit"]'
    ];

    let submitButton = null;

    // Try each selector until we find a matching element
    for (const selector of selectors) {
      submitButton = this.view.element.querySelector(selector);
      if (submitButton) {
        console.log('Found comment submit button with selector:', selector);
        break;
      }
    }

    if (submitButton) {
      // Remove any existing listeners to prevent duplicates
      submitButton.removeEventListener('click', this.handleNewCommentClick);

      // Create bound handler to ensure correct 'this' context
      this.boundHandleClick = this.handleNewCommentClick.bind(this);

      // Add click event listener with proper binding
      submitButton.addEventListener('click', this.boundHandleClick);
      console.log('✅ Comment submit button listener attached successfully');

      this.initialized = true;

      // Stop observing once we've attached the listener
      this.observer.disconnect();
    }
  }

  /**
   * Handle click on the submit comment button
   * @param {Event} event - Click event
   */
  handleNewCommentClick(event) {
    event.preventDefault();
    console.log('Comment submit button clicked');
    this.handleNewComment();
  }

  /**
   * Handle the submission of a new comment on a post
   * @returns {Promise<void>}
   */
  async handleNewComment() {
    console.log('Handling new comment submission');

    const commentForm = this.findCommentForm();
    if (!commentForm) return;

    const textarea = commentForm.querySelector('textarea');
    if (!textarea) {
      console.error('Comment textarea not found');
      return;
    }

    const commentText = textarea.value.trim();
    console.log('Comment text:', commentText ? 'Found' : 'Empty');

    // Validate comment and check login
    if (!this.validateComment(commentText, textarea) || !this.checkLoggedIn()) {
      return;
    }

    const submitButton = this.findSubmitButton(commentForm);
    if (!submitButton) return;

    const postInfo = this.getPostInformation(commentForm);
    if (!postInfo.isValid) {
      this.view.emit('notification', {
        type: 'error',
        message: 'Error: Cannot identify the post to comment on'
      });
      return;
    }

    console.log('Commenting on post by:', postInfo.author, 'with permlink:', postInfo.permlink);

    // Set loading state
    const originalText = submitButton.textContent;
    this.setSubmitState(submitButton, textarea, true);

    try {
      await this.submitNewComment(postInfo, commentText, submitButton, textarea, originalText);
    } catch (error) {
      this.handleCommentError(error, submitButton, textarea, originalText);
    }
  }

  /**
   * Find the comment form in the DOM
   * @returns {HTMLElement|null} The comment form element or null if not found
   */
  findCommentForm() {
    const commentForm = this.view.element.querySelector('.comment-form') ||
      this.view.element.querySelector('form[class*="comment"]');

    if (!commentForm) {
      console.error('Comment form not found');
    }
    return commentForm;
  }

  /**
   * Find the submit button for the comment form
   * @param {HTMLElement} commentForm - The comment form element
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton(commentForm) {
    const submitButton = commentForm.querySelector('.submit-comment') ||
      commentForm.querySelector('button[type="submit"]');

    if (!submitButton) {
      console.error('Submit button not found');
    }
    return submitButton;
  }

  /**
   * Get post author and permlink information
   * @param {HTMLElement} commentForm - The comment form element
   * @returns {Object} Object containing author, permlink and isValid flag
   */
  getPostInformation(commentForm) {
    let postAuthor;
    let postPermlink;

    // Method 1: From view.post object
    if (this.view.post?.author && this.view.post?.permlink) {
      console.log('Found post info from view.post');
      postAuthor = this.view.post.author;
      postPermlink = this.view.post.permlink;
    }
    // Method 2: From data attributes on page elements
    else if (!postAuthor || !postPermlink) {
      const postContainer = this.view.element.querySelector('[data-author][data-permlink]') ||
        document.querySelector('[data-author][data-permlink]');

      if (postContainer) {
        console.log('Found post info from DOM data attributes');
        postAuthor = postContainer.dataset.author;
        postPermlink = postContainer.dataset.permlink;
      }
    }

    // Method 3: From URL path if following /@author/permlink pattern
    if (!postAuthor || !postPermlink) {
      const urlPath = window.location.pathname;
      const match = urlPath.match(/\/@([a-zA-Z0-9\-.]+)\/([a-zA-Z0-9\-]+)/);

      if (match && match.length >= 3) {
        console.log('Found post info from URL');
        postAuthor = match[1];
        postPermlink = match[2];
      }
    }

    // Method 4: Look for hidden inputs that might contain the data
    if (!postAuthor || !postPermlink) {
      const authorInput = commentForm.querySelector('input[name="parent_author"]');
      const permlinkInput = commentForm.querySelector('input[name="parent_permlink"]');

      if (authorInput && permlinkInput) {
        console.log('Found post info from hidden inputs');
        postAuthor = authorInput.value;
        postPermlink = permlinkInput.value;
      }
    }

    return {
      author: postAuthor,
      permlink: postPermlink,
      isValid: Boolean(postAuthor && postPermlink)
    };
  }

  /**
   * Submit a new comment to the blockchain
   * @param {Object} postInfo - Contains author and permlink of the parent post
   * @param {string} commentText - The comment text
   * @param {HTMLElement} submitButton - The submit button element
   * @param {HTMLElement} textarea - The textarea element
   * @param {string} originalText - Original button text
   * @returns {Promise<void>}
   */
  async submitNewComment(postInfo, commentText, submitButton, textarea, originalText) {
    const result = await commentService.createComment({
      parentAuthor: postInfo.author,
      parentPermlink: postInfo.permlink,
      body: commentText,
      metadata: {
        app: 'cur8.fun/1.0',
        format: 'markdown',
        tags: this.extractTags(commentText)
      }
    });

    // Success notification
    this.view.emit('notification', {
      type: 'success',
      message: 'Your comment was posted successfully'
    });

    // Success UI state
    this.setSuccessState(submitButton);

    // Reset and update UI
    setTimeout(() => {
      textarea.value = '';
      this.setSubmitState(submitButton, textarea, false, originalText);
      submitButton.classList.remove('success');

      // Add the new comment to the UI without refreshing the entire page
      this.addNewCommentToUI(result);
    }, 1000);
  }

  /**
   * Adds a newly created comment to the UI without refreshing the page
   * @param {Object} commentResult - The result from createComment API call
   */
  addNewCommentToUI(commentResult) {
    if (!commentResult || !commentResult.success) {
      console.error('Invalid comment result:', commentResult);
      return;
    }

    try {
      console.log('Adding new comment to UI:', commentResult);

      // Aggiorna il modello dati nel view
      if (this.view.comments) {
        // Create a new comment object
        const newComment = {
          author: commentResult.author,
          permlink: commentResult.permlink,
          parent_author: this.view.post?.author || '',
          parent_permlink: this.view.post?.permlink || '',
          body: commentResult.body || 'New comment',
          created: new Date().toISOString(),
          net_votes: 0,
          active_votes: [],
          children: [],
          isNew: true
        };

        // Add to view's comments array
        this.view.comments.push(newComment);
      }

      // Usa solo il metodo diretto del componente CommentsSection (quando disponibile)
      if (this.view.commentsSectionComponent && typeof this.view.commentsSectionComponent.addNewComment === 'function') {
        this.view.commentsSectionComponent.addNewComment(commentResult);
      } else {
        // Fallback al metodo updateWithNewComment della view
        this.view.updateWithNewComment(commentResult);
      }

      // Aggiorna il contatore dei commenti nella UI (se disponibile)
      if (typeof this.view.updateCommentCount === 'function') {
        this.view.updateCommentCount();
      }
    } catch (error) {
      console.error('Error adding new comment to UI:', error);
    }
  }

  /**
   * Handle errors during comment submission
   * @param {Error} error - The error object
   * @param {HTMLElement} submitButton - The submit button element
   * @param {HTMLElement} textarea - The textarea element
   * @param {string} originalText - Original button text
   */
  handleCommentError(error, submitButton, textarea, originalText) {
    console.error('Error posting comment:', error);

    // Get appropriate error message
    const errorMessage = this.getErrorMessage(error);
    //Posting key not available. Please login again.
    // Check for expired posting key or authentication errors

    if (error.message.includes('Posting key not available. Please login again')) {

      this.showPostingErrorDialog(errorMessage);
    }
    if (error.message?.includes('posting') ||
      error.message?.includes('auth') ||
      error.message?.includes('signature') ||
      error.message?.includes('authority')) {
      // Show notification about need to re-login
      this.view.emit('notification', {
        type: 'error',
        message: 'Your authentication has expired. Please login again.'
      });

      // Store current URL to return after login
      const returnUrl = window.location.pathname + window.location.search;

      // Reset UI before navigation
      this.setSubmitState(submitButton, textarea, false, originalText);

      // Navigate to login page with return URL
      setTimeout(() => {
        router.navigate('/login', { returnUrl });
      }, 1000);

      return;
    }

    if (error.message?.includes('RC')) {
      // Show a more prominent error dialog for RC errors
      this.showRCErrorDialog(errorMessage);
    } else {
      // Regular notification for other errors
      this.view.emit('notification', {
        type: 'error',
        message: errorMessage
      });
    }

    // Reset UI
    this.setSubmitState(submitButton, textarea, false, originalText);
  }

  /**
   * Handle a reply to a comment
   * @param {Object} parentComment - The parent comment being replied to
   * @param {string} replyText - The text of the reply
   * @returns {Promise<void>}
   */
  async handleReply(parentComment, replyText) {
    console.log('Handling reply submission', parentComment);

    if (!this.validateReply(replyText) || !this.checkLoggedIn()) {
      return;
    }

    const commentElement = this.findCommentElement(parentComment);
    if (!commentElement) {
      this.showCommentNotFoundError();
      return;
    }

    const { replyForm, submitButton, textarea } = this.getReplyFormElements(commentElement);
    if (!replyForm || !submitButton || !textarea) {
      console.error('Reply form elements missing');
      return;
    }

    // Set loading state
    const originalText = submitButton.textContent;
    this.setSubmitState(submitButton, textarea, true);

    try {
      await this.submitReply(parentComment, replyText, submitButton, textarea, originalText, replyForm, commentElement);
    } catch (error) {
      this.handleReplyError(error, submitButton, textarea, originalText);
    }
  }

  /**
   * Validates the reply text
   * @param {string} replyText - The text to validate
   * @returns {boolean} Whether the reply is valid
   */
  validateReply(replyText) {
    const trimmedReply = replyText.trim();

    if (!trimmedReply) {
      return false;
    }

    if (trimmedReply.length < 3) {
      this.view.emit('notification', {
        type: 'error',
        message: 'Reply too short. Please write at least 3 characters.'
      });
      return false;
    }

    return true;
  }

  /**
   * Find the comment element in the DOM
   * @param {Object} parentComment - The parent comment data
   * @returns {HTMLElement|null} The comment element or null if not found
   */
  findCommentElement(parentComment) {
    let commentElement = null;

    // Try data attribute selector first (most reliable)
    const dataSelector = `[data-author="${parentComment.author}"][data-permlink="${parentComment.permlink}"]`;
    commentElement = this.view.element.querySelector(dataSelector);

    if (commentElement) {
      return commentElement;
    }

    // If data attribute selector fails, try finding by author name
    return this.findCommentElementByAuthor(parentComment.author);
  }

  /**
   * Find a comment element by author name
   * @param {string} authorName - The author name to look for
   * @returns {HTMLElement|null} The comment element or null if not found
   */
  findCommentElementByAuthor(authorName) {
    const allComments = this.view.element.querySelectorAll('.comment');

    for (const element of allComments) {
      const authorNames = element.querySelectorAll('.author-name');
      for (const name of authorNames) {
        if (name.textContent === `@${authorName}`) {
          return element;
        }
      }
    }

    return null;
  }

  /**
   * Shows an error notification when comment element isn't found
   */
  showCommentNotFoundError() {
    this.view.emit('notification', {
      type: 'error',
      message: 'Could not find the comment to reply to. Please try again.'
    });
  }

  /**
   * Gets the reply form, submit button, and textarea elements
   * @param {HTMLElement} commentElement - The parent comment element
   * @returns {Object} Object containing form elements
   */
  getReplyFormElements(commentElement) {
    const replyForm = commentElement.querySelector('.reply-form');
    const submitButton = replyForm?.querySelector('.submit-reply');
    const textarea = replyForm?.querySelector('textarea');

    return { replyForm, submitButton, textarea };
  }

  /**
   * Submits a reply to the blockchain and updates the UI
   * @param {Object} parentComment - The parent comment data
   * @param {string} replyText - The text of the reply
   * @param {HTMLElement} submitButton - The submit button element
   * @param {HTMLElement} textarea - The textarea element
   * @param {string} originalText - Original button text
   * @param {HTMLElement} replyForm - The reply form element
   * @param {HTMLElement} commentElement - The comment element
   * @returns {Promise<void>}
   */
  async submitReply(parentComment, replyText, submitButton, textarea, originalText, replyForm, commentElement) {
    const result = await commentService.createComment({
      parentAuthor: parentComment.author,
      parentPermlink: parentComment.permlink,
      body: replyText,
      metadata: {
        app: 'cur8.fun/1.0',
        format: 'markdown',
        tags: this.extractTags(replyText)
      }
    });

    this.view.emit('notification', {
      type: 'success',
      message: 'Your reply was posted successfully'
    });

    this.setSuccessState(submitButton);
    textarea.value = '';
    replyForm.style.display = 'none';

    this.addNewReplyToUI(result, commentElement, parentComment);

    setTimeout(() => {
      this.setSubmitState(submitButton, textarea, false, originalText);
      submitButton.classList.remove('success');
    }, 1000);
  }

  /**
   * Handle errors during reply submission
   * @param {Error} error - The error object
   * @param {HTMLElement} submitButton - The submit button element
   * @param {HTMLElement} textarea - The textarea element
   * @param {string} originalText - Original button text
   */
  handleReplyError(error, submitButton, textarea, originalText) {
    console.error('Error posting reply:', error);

    const errorMessage = this.getErrorMessage(error);

    // Check for expired posting key
    if (error.message?.includes('Posting key not available. Please login again')) {
      this.showPostingErrorDialog(errorMessage);
    }

    // Check for authentication errors
    if (error.message?.includes('posting') ||
        error.message?.includes('auth') ||
        error.message?.includes('signature') ||
        error.message?.includes('authority')) {
      
      // Show notification about need to re-login
      this.view.emit('notification', {
        type: 'error',
        message: 'Your authentication has expired. Please login again.'
      });

      // Store current URL to return after login
      const returnUrl = window.location.pathname + window.location.search;

      // Reset UI before navigation
      this.setSubmitState(submitButton, textarea, false, originalText);

      // Navigate to login page with return URL
      setTimeout(() => {
        router.navigate('/login', { returnUrl });
      }, 1000);

      return;
    }

    // Check for RC errors
    if (error.message?.includes('RC')) {
      this.showRCErrorDialog(errorMessage);
    } else {
      // Regular notification for other errors
      this.view.emit('notification', {
        type: 'error',
        message: errorMessage
      });
    }

    // Reset UI
    this.setSubmitState(submitButton, textarea, false, originalText);
  }

  /**
   * Adds a new reply to the UI without refreshing the page
   * @param {Object} result - The result from createComment API call
   * @param {HTMLElement} commentElement - The parent comment element
   * @param {Object} parentComment - The parent comment data
   */
  addNewReplyToUI(result, commentElement, parentComment) {
    if (!result || !commentElement || !parentComment) {
      console.error('Missing required parameters for adding reply to UI');
      return;
    }

    try {
      console.log('Adding new reply to UI:', result);

      const repliesContainer = this.getOrCreateRepliesContainer(commentElement);
      const repliesWrapper = this.getOrCreateRepliesWrapper(repliesContainer);

      // Construct a new comment object
      const newReply = this.createReplyObject(result, parentComment);

      this.appendReplyToUI(newReply, repliesWrapper);
      this.updateReplyCountBadge(commentElement);
      this.updateDataModels(newReply, parentComment);

    } catch (error) {
      console.error('Error adding new reply to UI:', error);
      this.attemptFallbackRefresh();
    }
  }

  /**
   * Gets existing or creates new replies container
   * @param {HTMLElement} commentElement - The parent comment element
   * @returns {HTMLElement} The replies container
   */
  getOrCreateRepliesContainer(commentElement) {
    let repliesContainer = commentElement.querySelector('.replies');

    if (!repliesContainer) {
      repliesContainer = document.createElement('div');
      repliesContainer.className = 'replies';

      const threadLine = document.createElement('div');
      threadLine.className = 'thread-line';
      threadLine.setAttribute('aria-hidden', 'true');

      repliesContainer.appendChild(threadLine);
      commentElement.appendChild(repliesContainer);
    }

    return repliesContainer;
  }

  /**
   * Gets existing or creates new replies wrapper
   * @param {HTMLElement} repliesContainer - The replies container
   * @returns {HTMLElement} The replies wrapper
   */
  getOrCreateRepliesWrapper(repliesContainer) {
    let repliesWrapper = repliesContainer.querySelector('.replies-wrapper');

    if (!repliesWrapper) {
      repliesWrapper = document.createElement('div');
      repliesWrapper.className = 'replies-wrapper';

      repliesContainer.appendChild(repliesWrapper);
    }

    return repliesWrapper;
  }

  /**
   * Creates a reply object from API result
   * @param {Object} result - The API result
   * @param {Object} parentComment - The parent comment
   * @returns {Object} The formatted reply object
   */
  createReplyObject(result, parentComment) {
    return {
      author: result.author,
      permlink: result.permlink,
      parent_author: parentComment.author,
      parent_permlink: parentComment.permlink,
      body: result.body,
      created: new Date().toISOString(),
      net_votes: 0,
      active_votes: [],
      children: [],
      depth: (parentComment.depth || 0) + 1,
      isNew: true // Mark as new for highlighting
    };
  }

  /**
   * Appends the reply to the UI
   * @param {Object} newReply - The reply object
   * @param {HTMLElement} repliesWrapper - The container to append to
   */
  appendReplyToUI(newReply, repliesWrapper) {
    if (this.view.commentsSectionComponent) {
      const replyElement = this.view.commentsSectionComponent.createCommentElement(newReply);
      repliesWrapper.appendChild(replyElement);
    }
  }

  /**
   * Updates the reply count badge on the comment
   * @param {HTMLElement} commentElement - The parent comment element
   */
  updateReplyCountBadge(commentElement) {
    const replyCountBadge = commentElement.querySelector('.replies-count');

    if (replyCountBadge) {
      const currentCount = parseInt(replyCountBadge.textContent, 10) || 0;
      const newCount = currentCount + 1;
      replyCountBadge.textContent = `${newCount} ${newCount === 1 ? 'reply' : 'replies'}`;
    } else {
      this.createNewReplyCountBadge(commentElement);
    }
  }

  /**
   * Creates a new reply count badge when none exists
   * @param {HTMLElement} commentElement - The parent comment element
   */
  createNewReplyCountBadge(commentElement) {
    const authorContainer = commentElement.querySelector('.author-container');
    if (authorContainer && !authorContainer.querySelector('.replies-count')) {
      const replyCountBadge = document.createElement('span');
      replyCountBadge.className = 'replies-count';
      replyCountBadge.textContent = '1 reply';
      authorContainer.appendChild(replyCountBadge);
    }
  }

  /**
   * Updates the data models with the new reply
   * @param {Object} newReply - The reply object
   * @param {Object} parentComment - The parent comment
   */
  updateDataModels(newReply, parentComment) {
    // Update parent comment's children array
    if (parentComment.children) {
      parentComment.children.push(newReply);
    } else {
      parentComment.children = [newReply];
    }

    // Update view's comments array if it exists
    if (this.view.comments) {
      this.view.comments.push(newReply);
    }

    // Update comment count in PostView if applicable
    if (typeof this.view.updateCommentCount === 'function') {
      this.view.updateCommentCount();
    }
  }

  /**
   * Attempts to refresh comments as fallback when adding reply fails
   */
  attemptFallbackRefresh() {
    setTimeout(() => {
      const component = this.view.commentsSectionComponent;
      if (component && typeof component.quickRefreshReplies === 'function') {
        component.quickRefreshReplies()
          .then(() => component.renderComments())
          .catch(err => console.error('Failed to refresh comments:', err));
      }
    }, 1500);
  }

  /**
   * Creates a loading overlay element for transitions
   * @returns {HTMLElement} The loading overlay element
   */
  createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10;
    `;

    // Use the LoadingIndicator component instead of creating a custom spinner
    const loadingIndicator = new LoadingIndicator('spinner');

    // Get the loading text element and update the message
    const loadingText = loadingIndicator.element.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = 'Loading comments...';
    }

    overlay.appendChild(loadingIndicator.element);
    return overlay;
  }

  validateComment(commentText, textarea) {
    if (!commentText) {
      textarea.classList.add('error-input');
      setTimeout(() => textarea.classList.remove('error-input'), 1500);
      return false;
    }

    if (commentText.length < 3) {
      this.view.emit('notification', {
        type: 'error',
        message: 'Comment too short. Please write at least 3 characters.'
      });
      return false;
    }

    return true;
  }

  checkLoggedIn() {
    const user = authService.getCurrentUser();
    if (!user) {
      this.view.emit('notification', {
        type: 'error',
        message: 'You need to log in to comment'
      });
      router.navigate('/login', { returnUrl: window.location.pathname + window.location.search });
      return false;
    }
    return true;
  }

  setSubmitState(button, textarea, isSubmitting, text = null) {
    if (isSubmitting) {
      button.disabled = true;
      button.innerHTML = '<span class="material-icons loading">refresh</span> Posting...';
      button.classList.add('processing');
      textarea.disabled = true;
    } else {
      button.disabled = false;
      if (text) button.textContent = text;
      button.classList.remove('processing');
      textarea.disabled = false;
    }
  }

  setSuccessState(button) {
    button.classList.remove('processing');
    button.classList.add('success');
    button.innerHTML = '<span class="material-icons">check_circle</span> Posted!';
  }

  getErrorMessage(error) {
    console.log('Processing error:', error);

    if (!error) return 'Unknown error occurred';

    const errorMessage = error.message || '';

    // Define error types and their corresponding handlers
    const errorHandlers = {
      resourceCredits: {
        condition: () => errorMessage.includes('RC') && errorMessage.includes('needs') && errorMessage.includes('has'),
        handler: () => this.getResourceCreditsErrorMessage(errorMessage)
      },
      keychain: {
        condition: () => errorMessage.includes('Keychain'),
        handler: () => this.getKeychainErrorMessage(errorMessage)
      },
      postingKey: {
        condition: () => errorMessage.includes('posting key'),
        handler: () => 'Invalid posting key. Please login again.'
      },
      invalidParams: {
        condition: () => errorMessage === 'i',
        handler: () => 'Invalid comment parameters. Please try again with different text.'
      },
      permlink: {
        condition: () => errorMessage.includes('permlink'),
        handler: () => 'Invalid permlink format. Please try again.'
      },
      commentInterval: {
        condition: () => errorMessage.includes('STEEM_MIN_ROOT_COMMENT_INTERVAL'),
        handler: () => 'Please wait a while before posting another comment.'
      }
    };

    // Find the first matching error handler
    for (const [errorType, { condition, handler }] of Object.entries(errorHandlers)) {
      if (condition()) {
        return handler();
      }
    }

    // Default error message
    return `Error: ${errorMessage || 'Failed to post comment'}`;
  }

  /**
   * Formats a user-friendly message for Resource Credits errors
   * @param {string} errorMessage - The original error message
   * @returns {string} A user-friendly error message
   */
  getResourceCreditsErrorMessage(errorMessage) {
    try {
      // Try to extract the values from the error message using regex
      const rcMatch = errorMessage.match(/has\s+(\d+)\s+RC,\s+needs\s+(\d+)\s+RC/);

      if (rcMatch && rcMatch.length === 3) {
        const availableRC = parseInt(rcMatch[1]);
        const requiredRC = parseInt(rcMatch[2]);
        const percentAvailable = Math.round((availableRC / requiredRC) * 100);

        return `You don't have enough Resource Credits to perform this action (${percentAvailable}% available). 
                Please wait a few hours for your RC to regenerate or power up more STEEM.`;
      }

      // Fallback if we can't parse the exact values
      return 'You don\'t have enough Resource Credits (RC) to perform this action. Please wait a few hours for your RC to regenerate or power up more STEEM.';
    } catch (e) {
      // If there's any error parsing, return a generic message
      return 'Insufficient Resource Credits. Please try again later or power up more STEEM.';
    }
  }

  getKeychainErrorMessage(errorMessage) {
    const errorMap = {
      'user canceled': 'You cancelled the operation',
      'not installed': 'Steem Keychain extension not detected',
      'transaction': 'Transaction rejected by the blockchain'
    };

    // Find the first matching error key in the map
    const matchedErrorKey = Object.keys(errorMap).find(key =>
      errorMessage.includes(key)
    );

    // Return the mapped message or a default message
    return matchedErrorKey
      ? errorMap[matchedErrorKey]
      : 'Keychain error: ' + errorMessage;
  }

  extractTags(text) {
    const tags = [];

    // Extract hashtags
    const hashtagMatches = text.match(/#[\w-]+/g);
    if (hashtagMatches) {
      hashtagMatches.forEach(tag => {
        const cleanTag = tag.substring(1).toLowerCase();
        if (!tags.includes(cleanTag) && cleanTag.length >= 3) {
          tags.push(cleanTag);
        }
      });
    }

    return tags.slice(0, 5); // Limit to 5 tags
  }

  cleanup() {
    // Stop observer
    if (this.observer) {
      this.observer.disconnect();
    }

    // Remove event listeners with proper reference
    if (this.boundHandleClick) {
      const submitButton = this.view.element.querySelector('.submit-comment');
      if (submitButton) {
        submitButton.removeEventListener('click', this.boundHandleClick);
      }
    }

    this.initialized = false;
  }

  /**
   * Show a more prominent error dialog for Resource Credits errors
   * @param {string} message - The error message to display
   */
  showRCErrorDialog(message) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'rc-error-overlay';

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'rc-error-dialog';

    // Create dialog content
    const title = document.createElement('h3');
    title.className = 'rc-error-dialog-title';
    title.textContent = 'Not Enough Resource Credits';

    // Add icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'rc-error-icon';
    iconContainer.innerHTML = '<span class="material-icons">error_outline</span>';

    // Add message
    const messageEl = document.createElement('p');
    messageEl.className = 'rc-error-message';
    messageEl.textContent = message;

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'rc-error-buttons';

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'rc-error-close-btn';
    closeBtn.textContent = 'Close';

    // Close dialog function
    const closeDialog = () => {
      document.body.removeChild(overlay);
      document.body.removeChild(dialog);
    };

    // Add event listeners
    closeBtn.addEventListener('click', closeDialog);
    overlay.addEventListener('click', closeDialog);

    // Add elements to dialog
    buttonsContainer.appendChild(closeBtn);
    
    dialog.appendChild(title);
    dialog.appendChild(iconContainer);
    dialog.appendChild(messageEl);
    dialog.appendChild(buttonsContainer);

    // Add to body
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    // Also emit a regular notification
    this.view.emit('notification', {
      type: 'error',
      message: 'Not enough Resource Credits to complete this action'
    });
  }

  /**
   * Show a dialog for posting key errors
   * @param {string} message - The error message to display
   */
  showPostingErrorDialog() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'posting-error-overlay';

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'posting-error-dialog';
    dialog.style.left = '50%';
    dialog.style.top = '50%';

    // Create dialog content
    const title = document.createElement('h3');
    title.className = 'posting-error-dialog-title';
    title.textContent = 'Session Expired';

    // Add icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'posting-error-icon';
    iconContainer.innerHTML = '<span class="material-icons">info</span>';

    // Add message
    const messageEl = document.createElement('p');
    messageEl.className = 'posting-error-message';
    messageEl.innerHTML = 'Your login session has expired for security reasons.<br>This helps keep your account safe by requiring periodic re-authentication.';

    // Add additional explanation
    const explainEl = document.createElement('p');
    explainEl.className = 'posting-error-explanation';
    explainEl.textContent = 'Please log in again to continue posting your comment.';

    // Add login button
    const loginBtn = document.createElement('button');
    loginBtn.className = 'posting-error-login-btn';
    loginBtn.textContent = 'Login Again';

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'posting-error-close-btn';
    closeBtn.textContent = 'Close';

    // Store current URL to return after login
    const returnUrl = window.location.pathname + window.location.search;

    // Login function
    const goToLogin = () => {
      closeDialog();
      setTimeout(() => {
        router.navigate('/login', { returnUrl });
      }, 100);
    };

    // Close dialog function
    const closeDialog = () => {
      document.body.removeChild(overlay);
      document.body.removeChild(dialog);
    };

    // Add event listeners
    loginBtn.addEventListener('click', goToLogin);
    closeBtn.addEventListener('click', closeDialog);
    overlay.addEventListener('click', closeDialog);

    // Add elements to dialog
    dialog.appendChild(title);
    dialog.appendChild(iconContainer);
    dialog.appendChild(messageEl);
    dialog.appendChild(explainEl);
    dialog.appendChild(loginBtn);
    dialog.appendChild(closeBtn);

    // Add to body
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    // Also emit a regular notification
    this.view.emit('notification', {
      type: 'info',
      message: 'Your session has expired. Please login again to continue.'
    });
  }
}
