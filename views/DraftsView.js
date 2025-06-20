import View from './View.js';
import router from '../utils/Router.js';
import authService from '../services/AuthService.js';
import createPostService from '../services/CreatePostService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';

/**
 * View for displaying user drafts and scheduled posts
 */
class DraftsView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'Drafts | cur8.fun';
    this.currentUser = authService.getCurrentUser();
    this.loadingIndicator = new LoadingIndicator();
    this.drafts = [];
  }

  /**
   * Render the drafts view
   * @param {HTMLElement} container - Container element to render into
   */  async render(container) {
    this.container = container;
    
    // Check authentication
    if (!this.currentUser) {
      this.renderLoginPrompt();
      return;
    }

    // Clear container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    // Create main wrapper with drafts-view class instead of applying to container
    const draftsViewWrapper = document.createElement('div');
    draftsViewWrapper.className = 'drafts-view';

    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';

    // Create page header
    const pageHeader = this.createPageHeader();
    contentWrapper.appendChild(pageHeader);

    // Create drafts container
    const draftsContainer = document.createElement('div');
    draftsContainer.className = 'drafts-container';
    contentWrapper.appendChild(draftsContainer);

    // Add content wrapper to drafts view wrapper
    draftsViewWrapper.appendChild(contentWrapper);

    // Show loading while fetching drafts
    this.loadingIndicator.show(draftsContainer);

    // Add drafts view wrapper to main container
    this.container.appendChild(draftsViewWrapper);

    // Load and render drafts
    await this.loadDrafts(draftsContainer);
  }

  /**
   * Create page header with title and actions
   */
  createPageHeader() {
    const header = document.createElement('div');
    header.className = 'page-header';

    const titleSection = document.createElement('div');
    titleSection.className = 'title-section';

    const title = document.createElement('h1');
    title.textContent = 'My Drafts';
    titleSection.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Manage your saved drafts and scheduled posts';
    subtitle.className = 'page-subtitle';
    titleSection.appendChild(subtitle);

    header.appendChild(titleSection);

    // Add action buttons
    const actionsSection = document.createElement('div');
    actionsSection.className = 'header-actions';

    const newPostBtn = document.createElement('a');
    newPostBtn.href = '/create';
    newPostBtn.className = 'primary-btn create-new-btn';
    newPostBtn.innerHTML = `
      <span class="material-icons">add</span>
      <span>New Post</span>
    `;
    actionsSection.appendChild(newPostBtn);

    header.appendChild(actionsSection);

    return header;
  }

  /**
   * Load drafts from the service
   */
  async loadDrafts(container) {
    try {
      // Get all drafts for the current user
      const allDrafts = this.getAllUserDrafts();
      
      // Hide loading indicator
      this.loadingIndicator.hide();

      if (allDrafts.length === 0) {
        this.renderEmptyState(container);
      } else {
        this.renderDrafts(container, allDrafts);
      }

    } catch (error) {
      console.error('Error loading drafts:', error);
      this.loadingIndicator.hide();
      this.renderErrorState(container, error);
    }
  }  /**
   * Get all drafts for the current user using the improved draft system
   */
  getAllUserDrafts() {
    try {
      // Use the improved draft system from CreatePostService
      return createPostService.getAllUserDrafts();
    } catch (error) {
      console.error('Error getting user drafts:', error);
      return [];
    }
  }
  /**
   * Get word count for content
   */
  getWordCount(content) {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get draft age in human readable format
   */
  getDraftAge(timestamp) {
    const now = Date.now();
    const ageMs = now - timestamp;
    const ageMinutes = Math.floor(ageMs / (1000 * 60));
    
    if (ageMinutes < 1) return 'Just now';
    if (ageMinutes < 60) return `${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''} ago`;
    
    const ageHours = Math.floor(ageMinutes / 60);
    if (ageHours < 24) return `${ageHours} hour${ageHours !== 1 ? 's' : ''} ago`;
    
    const ageDays = Math.floor(ageHours / 24);
    if (ageDays < 7) return `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`;
    
    const ageWeeks = Math.floor(ageDays / 7);
    return `${ageWeeks} week${ageWeeks !== 1 ? 's' : ''} ago`;
  }
  /**
   * Render drafts list with improved functionality
   */
  renderDrafts(container, drafts) {
    container.innerHTML = '';

    // Add stats header
    const statsHeader = document.createElement('div');
    statsHeader.className = 'drafts-stats';
    statsHeader.innerHTML = `
      <div class="stat-item">
        <span class="stat-number">${drafts.length}</span>
        <span class="stat-label">Draft${drafts.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${drafts.filter(d => d.isCurrent).length}</span>
        <span class="stat-label">Current</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${drafts.filter(d => !d.isCurrent).length}</span>
        <span class="stat-label">Saved</span>
      </div>
    `;
    container.appendChild(statsHeader);

    // Add actions bar
    const actionsBar = document.createElement('div');
    actionsBar.className = 'drafts-actions-bar';
    actionsBar.innerHTML = `
      <button class="outline-btn cleanup-btn" title="Clean up expired drafts">
        <span class="material-icons">cleaning_services</span>
        Clean Up
      </button>
      <button class="outline-btn export-btn" title="Export drafts">
        <span class="material-icons">download</span>
        Export
      </button>
    `;
    container.appendChild(actionsBar);

    // Add event listeners for action buttons
    const cleanupBtn = actionsBar.querySelector('.cleanup-btn');
    const exportBtn = actionsBar.querySelector('.export-btn');

    cleanupBtn.addEventListener('click', () => this.cleanupExpiredDrafts());
    exportBtn.addEventListener('click', () => this.exportDrafts(drafts));

    // Create drafts grid
    const draftsGrid = document.createElement('div');
    draftsGrid.className = 'drafts-grid';
    
    drafts.forEach(draft => {
      const draftCard = this.createDraftCard(draft);
      draftsGrid.appendChild(draftCard);
    });

    container.appendChild(draftsGrid);
  }  /**
   * Create a draft card with enhanced functionality
   */
  createDraftCard(draft) {
    const card = document.createElement('div');
    card.className = `draft-card ${draft.isCurrent ? 'current-draft' : ''}`;
    
    // Add click handler to edit draft
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking on action buttons
      if (!e.target.closest('.draft-actions')) {
        this.editDraft(draft);
      }
    });

    // Calculate additional metadata
    const wordCount = this.getWordCount(draft.body || '');
    const age = this.getDraftAge(draft.lastModified);

    card.innerHTML = `
      <div class="draft-header">
        ${draft.isCurrent ? '<div class="current-draft-badge">Current Draft</div>' : ''}
        <h3 class="draft-title" title="${this.escapeHtml(draft.title || 'Untitled Draft')}">
          ${this.escapeHtml(draft.title || 'Untitled Draft')}
        </h3>
        <div class="draft-meta">
          <span class="draft-age">${age}</span>
          <span class="draft-words">${wordCount} words</span>
        </div>
      </div>
      
      <div class="draft-content">
        <div class="draft-excerpt">
          ${this.createExcerpt(draft.body || '')}
        </div>
        
        ${draft.tags && draft.tags.length > 0 ? `
          <div class="draft-tags">
            ${draft.tags.slice(0, 3).map(tag => 
              `<span class="draft-tag">${this.escapeHtml(tag)}</span>`
            ).join('')}
            ${draft.tags.length > 3 ? `<span class="draft-tag-more">+${draft.tags.length - 3}</span>` : ''}
          </div>
        ` : ''}
      </div>
      
      <div class="draft-footer">
        <div class="draft-info">
          ${draft.community ? `
            <span class="draft-community">
              <span class="material-icons">groups</span>
              ${this.escapeHtml(draft.community)}
            </span>
          ` : ''}
        </div>
        
        <div class="draft-actions">
          <button class="draft-action-btn edit-btn" title="Edit draft">
            <span class="material-icons">edit</span>
          </button>
          ${!draft.isCurrent ? `
            <button class="draft-action-btn duplicate-btn" title="Duplicate draft">
              <span class="material-icons">content_copy</span>
            </button>
            <button class="draft-action-btn load-current-btn" title="Load as current draft">
              <span class="material-icons">open_in_new</span>
            </button>
          ` : `
            <button class="draft-action-btn save-as-btn" title="Save as new draft">
              <span class="material-icons">save_as</span>
            </button>
          `}
          <button class="draft-action-btn delete-btn" title="Delete draft">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </div>
    `;

    // Add event listeners for action buttons
    const editBtn = card.querySelector('.edit-btn');
    const deleteBtn = card.querySelector('.delete-btn');
    const duplicateBtn = card.querySelector('.duplicate-btn');
    const loadCurrentBtn = card.querySelector('.load-current-btn');
    const saveAsBtn = card.querySelector('.save-as-btn');

    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.editDraft(draft);
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteDraft(draft);
    });

    if (duplicateBtn) {
      duplicateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.duplicateDraft(draft);
      });
    }

    if (loadCurrentBtn) {
      loadCurrentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadDraftAsCurrent(draft);
      });
    }

    if (saveAsBtn) {
      saveAsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.saveCurrentDraftAsNew();
      });
    }

    return card;
  }

  /**
   * Create excerpt from content
   */
  createExcerpt(content, maxLength = 150) {
    if (!content) return 'No content';
    
    // Remove markdown formatting and get plain text
    const plainText = content
      .replace(/[#*_`~\[\]()]/g, '') // Remove markdown characters
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    if (plainText.length <= maxLength) return plainText;
    
    // Find the last space before the limit to avoid cutting words
    const lastSpaceIndex = plainText.lastIndexOf(' ', maxLength);
    const cutIndex = lastSpaceIndex > maxLength * 0.8 ? lastSpaceIndex : maxLength;
    
    return plainText.substring(0, cutIndex) + '...';
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }  /**
   * Edit a draft using the improved system
   */
  editDraft(draft) {
    if (draft.isCurrent) {
      // For current draft, just navigate to create view
      router.navigate('/create');
    } else {
      // For saved drafts, load as current and navigate
      const success = createPostService.loadDraftAsCurrent(draft.id);
      if (success) {
        router.navigate('/create');
      } else {
        this.showToast('Failed to load draft', 'error');
      }
    }
  }

  /**
   * Delete a draft with confirmation
   */
  deleteDraft(draft) {
    // Create confirmation modal
    const modal = this.createConfirmationModal(
      'Delete Draft',
      `Are you sure you want to delete "${draft.title || 'Untitled Draft'}"? This action cannot be undone.`,
      () => {
        // Confirm delete
        this.performDeleteDraft(draft);
        this.closeModal(modal);
      },
      () => {
        // Cancel
        this.closeModal(modal);
      }
    );
    
    document.body.appendChild(modal);
  }

  /**
   * Actually delete the draft using the improved system
   */
  performDeleteDraft(draft) {
    try {
      const success = createPostService.deleteDraftById(draft.id);
      
      if (success) {
        this.showToast('Draft deleted successfully', 'success');
        // Reload the view
        this.render(this.container);
      } else {
        this.showToast('Failed to delete draft', 'error');
      }
      
    } catch (error) {
      console.error('Error deleting draft:', error);
      this.showToast('Failed to delete draft', 'error');
    }
  }

  /**
   * Duplicate a draft
   */
  duplicateDraft(draft) {
    try {
      const result = createPostService.duplicateDraft(draft.id);
      
      if (result.success) {
        this.showToast('Draft duplicated successfully', 'success');
        // Reload the view to show the new draft
        this.render(this.container);
      } else {
        this.showToast(result.error || 'Failed to duplicate draft', 'error');
      }
    } catch (error) {
      console.error('Error duplicating draft:', error);
      this.showToast('Failed to duplicate draft', 'error');
    }
  }

  /**
   * Load a draft as the current draft
   */
  loadDraftAsCurrent(draft) {
    try {
      const success = createPostService.loadDraftAsCurrent(draft.id);
      
      if (success) {
        this.showToast('Draft loaded as current', 'success');
        // Navigate to create view
        router.navigate('/create');
      } else {
        this.showToast('Failed to load draft', 'error');
      }
    } catch (error) {
      console.error('Error loading draft as current:', error);
      this.showToast('Failed to load draft', 'error');
    }
  }

  /**
   * Save current draft as a new saved draft
   */
  saveCurrentDraftAsNew() {
    try {
      const result = createPostService.moveCurrentDraftToSaved();
      
      if (result.success) {
        this.showToast('Current draft saved', 'success');
        // Reload the view to show the new saved draft
        this.render(this.container);
      } else {
        this.showToast(result.error || 'Failed to save draft', 'error');
      }
    } catch (error) {
      console.error('Error saving current draft as new:', error);
      this.showToast('Failed to save draft', 'error');
    }
  }

  /**
   * Clean up expired drafts
   */
  cleanupExpiredDrafts() {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return;

      createPostService.cleanupExpiredDrafts(currentUser.username);
      this.showToast('Expired drafts cleaned up', 'success');
      
      // Reload the view
      this.render(this.container);
    } catch (error) {
      console.error('Error cleaning up drafts:', error);
      this.showToast('Failed to clean up drafts', 'error');
    }
  }

  /**
   * Export drafts as JSON
   */
  exportDrafts(drafts) {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        user: this.currentUser.username,
        drafts: drafts.map(draft => ({
          id: draft.id,
          title: draft.title,
          body: draft.body,
          tags: draft.tags,
          community: draft.community,
          timestamp: draft.timestamp,
          isCurrent: draft.isCurrent
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `steemee-drafts-${this.currentUser.username}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showToast('Drafts exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting drafts:', error);
      this.showToast('Failed to export drafts', 'error');
    }
  }  /**
   * Actually delete the draft using the improved system
   */
  performDeleteDraft(draft) {
    try {
      const success = createPostService.deleteDraftById(draft.id);
      
      if (success) {
        this.showToast('Draft deleted successfully', 'success');
        // Reload the view
        this.render(this.container);
      } else {
        this.showToast('Failed to delete draft', 'error');
      }
      
    } catch (error) {
      console.error('Error deleting draft:', error);
      this.showToast('Failed to delete draft', 'error');
    }
  }

  /**
   * Crea un dialog di conferma robusto, centrato, con overlay e animazione
   */
  createConfirmationModal(title, message, onConfirm, onCancel) {
    // Rimuovi eventuali altri modali
    const existing = document.getElementById('drafts-confirm-modal');
    if (existing) existing.remove();

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'drafts-confirm-modal';
    overlay.className = 'drafts-modal-overlay';
    overlay.tabIndex = -1;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.right = 0;
    overlay.style.bottom = 0;
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.zIndex = 9999;
    overlay.style.opacity = 0;
    overlay.style.transition = 'opacity 0.25s cubic-bezier(.4,0,.2,1)';

    // Dialog
    const dialog = document.createElement('div');
    dialog.className = 'drafts-modal-content';
    dialog.style.background = 'var(--surface-color, #fff)';
    dialog.style.padding = '2rem 1.5rem 1.5rem 1.5rem';
    dialog.style.borderRadius = '16px';
    dialog.style.maxWidth = '95vw';
    dialog.style.width = '100%';
    dialog.style.maxWidth = '400px';
    dialog.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)';
    dialog.style.transform = 'translateY(40px) scale(0.98)';
    dialog.style.opacity = 0;
    dialog.style.transition = 'all 0.25s cubic-bezier(.4,0,.2,1)';
    dialog.setAttribute('role', 'document');

    dialog.innerHTML = `
      <div class="modal-header" style="margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1.25rem;">${this.escapeHtml(title)}</h3>
      </div>
      <div class="modal-body" style="margin-bottom:1.5rem;">
        <p style="margin:0;">${this.escapeHtml(message)}</p>
      </div>
      <div class="modal-footer" style="display:flex;gap:0.75rem;justify-content:flex-end;">
        <button class="outline-btn cancel-btn" type="button">Cancel</button>
        <button class="danger-btn confirm-btn" type="button">Delete</button>
      </div>
    `;

    // Append dialog to overlay
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Forza animazione
    setTimeout(() => {
      overlay.style.opacity = 1;
      dialog.style.opacity = 1;
      dialog.style.transform = 'translateY(0) scale(1)';
    }, 10);

    // Focus management
    dialog.focus();
    setTimeout(() => {
      const btn = dialog.querySelector('.confirm-btn');
      if (btn) btn.focus();
    }, 100);

    // Event listeners
    const cancelBtn = dialog.querySelector('.cancel-btn');
    const confirmBtn = dialog.querySelector('.confirm-btn');

    cancelBtn.addEventListener('click', () => closeModal(false));
    confirmBtn.addEventListener('click', () => closeModal(true));

    // Chiudi su overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(false);
    });
    // Chiudi su ESC
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal(false);
    };
    document.addEventListener('keydown', escHandler);

    // Funzione di chiusura con animazione
    function closeModal(confirmed) {
      overlay.style.opacity = 0;
      dialog.style.opacity = 0;
      dialog.style.transform = 'translateY(40px) scale(0.98)';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', escHandler);
        if (confirmed) onConfirm();
        else if (onCancel) onCancel();
      }, 220);
    }

    return overlay;
  }

  /**
   * Close modal
   */
  closeModal(modal) {
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add to page
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);

    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Render empty state when no drafts
   */
  renderEmptyState(container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <span class="material-icons">draft</span>
        </div>
        <h3>No drafts yet</h3>
        <p>Your saved drafts will appear here. Start writing your first post!</p>
        <a href="/create" class="primary-btn">
          <span class="material-icons">add</span>
          Create New Post
        </a>
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderErrorState(container, error) {
    container.innerHTML = `
      <div class="error-state">
        <div class="error-state-icon">
          <span class="material-icons">error</span>
        </div>
        <h3>Failed to load drafts</h3>
        <p>There was an error loading your drafts. Please try again.</p>
        <button class="primary-btn retry-btn">
          <span class="material-icons">refresh</span>
          Try Again
        </button>
      </div>
    `;

    const retryBtn = container.querySelector('.retry-btn');
    retryBtn.addEventListener('click', () => {
      this.render(this.container);
    });
  }

  /**
   * Render login prompt for unauthenticated users
   */
  renderLoginPrompt() {
    this.container.innerHTML = `
      <div class="auth-required">
        <div class="auth-required-icon">
          <span class="material-icons">login</span>
        </div>
        <h2>Login Required</h2>
        <p>You need to be logged in to view your drafts.</p>
        <a href="/login" class="primary-btn">
          <span class="material-icons">login</span>
          Login
        </a>
      </div>
    `;
  }

  /**
   * Clean up resources when view is unmounted
   */
  unmount() {
    super.unmount();
    
    // Hide loading indicator if still showing
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
    }
    
    // Remove any remaining modals
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    });
  }
}

export default DraftsView;
