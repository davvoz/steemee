import eventEmitter from './EventEmitter.js';
import { mainNavItems, specialItems } from '../config/navigation.js';

class NavigationManager {
  constructor() {
    this.isMobile = window.innerWidth < 768;
    this.menuOpen = false;
    this.initElements();
    this.initEventListeners();
    this.renderNavigation();
  }
  
  initElements() {
    // Cache DOM elements
    this.app = document.getElementById('app');
    this.sideNav = document.querySelector('.side-nav');
    this.bottomNav = document.getElementById('bottom-navigation');
    this.navCenter = document.querySelector('.nav-center');
    this.overlay = this.createOverlay();
    document.body.appendChild(this.overlay);
  }
  
  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay hidden';
    overlay.addEventListener('click', () => this.toggleMobileMenu(false));
    return overlay;
  }
  
  initEventListeners() {
    // Handle window resize with debounce
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth < 768;
        
        if (wasMobile !== this.isMobile) {
          // Close mobile menu when switching to desktop
          if (!this.isMobile && this.menuOpen) {
            this.toggleMobileMenu(false);
          }
          this.switchNavigationMode();
        }
      }, 250);
    });
    
    // Handle route changes
    eventEmitter.on('route:changed', () => {
      this.highlightActiveMenuItem();
      // Close mobile menu on navigation
      if (this.isMobile && this.menuOpen) {
        this.toggleMobileMenu(false);
      }
    });
    
    // Initial setup
    this.switchNavigationMode();
  }
  
  renderNavigation() {
    // Render bottom navigation items based on config
    if (this.bottomNav) {
      this.bottomNav.innerHTML = '';

      // Create elements for left side items, center item, and right side items
      const leftContainer = document.createElement('div');
      leftContainer.className = 'bottom-nav-left';
      
      const centerContainer = document.createElement('div');
      centerContainer.className = 'bottom-nav-center';
      
      const rightContainer = document.createElement('div');
      rightContainer.className = 'bottom-nav-right';

      // Find special create button for center
      const createItem = specialItems.find(item => item.showInBottom && item.centerPosition);
      
      // Add center item (create button)
      if (createItem) {
        const createBtn = this.createNavItem(createItem, 'bottom');
        centerContainer.appendChild(createBtn);
      }

      // Get regular navigation items
      const regularItems = mainNavItems
        .filter(item => item.showInBottom && (!item.mobileOnly || this.isMobile));
      
      // For mobile with 5 buttons: 2 on left, center button, 2 on right
      if (this.isMobile && regularItems.length === 4) {
        // Extract first 2 items for left container (home, search)
        const leftItems = regularItems.slice(0, 2);
        
        // Extract last 2 items for right container (wallet, menu)
        const rightItems = regularItems.slice(2, 4);
        
        // Add left items
        leftItems.forEach(item => {
          const navItem = this.createNavItem(item, 'bottom');
          leftContainer.appendChild(navItem);
        });
        
        // Add right items
        rightItems.forEach(item => {
          const navItem = this.createNavItem(item, 'bottom');
          
          // Add click handler for menu button
          if (item.id === 'menu') {
            navItem.addEventListener('click', (e) => {
              e.preventDefault();
              this.toggleMobileMenu();
            });
          }
          
          rightContainer.appendChild(navItem);
        });
      } else {
        // Original distribution logic for non-5-button layouts
        const halfIndex = Math.ceil(regularItems.length / 2);
        const leftItems = regularItems.slice(0, halfIndex);
        const rightItems = regularItems.slice(halfIndex);
        
        // Add left items
        leftItems.forEach(item => {
          const navItem = this.createNavItem(item, 'bottom');
          leftContainer.appendChild(navItem);
        });
        
        // Add right items
        rightItems.forEach(item => {
          const navItem = this.createNavItem(item, 'bottom');
          
          // Add click handler for menu button
          if (item.id === 'menu') {
            navItem.addEventListener('click', (e) => {
              e.preventDefault();
              this.toggleMobileMenu();
            });
          }
          
          rightContainer.appendChild(navItem);
        });
      }
      
      // Append containers to bottom navigation
      this.bottomNav.appendChild(leftContainer);
      this.bottomNav.appendChild(centerContainer);
      this.bottomNav.appendChild(rightContainer);
      
      // Debug check to verify the button is in the DOM
      console.log('Center button added:', !!this.bottomNav.querySelector('.center-button'));
    }
  }
  
  createNavItem(item, type) {
    const navItem = document.createElement('a');
    navItem.href = item.path;
    navItem.className = type === 'bottom' ? 'bottom-nav-item' : 'menu-item';
    navItem.dataset.id = item.id; // Add data attribute for identification
    
    if (item.isAction) {
      navItem.classList.add('create-button');
    }
    
    if (item.centerPosition) {
      navItem.classList.add('center-button');
    }
    
    // Add basic icon and label
    navItem.innerHTML = `
      <span class="material-icons">${item.icon}</span>
      <span class="${type === 'bottom' ? 'bottom-nav-label' : 'label'}">${item.label}</span>
    `;
    
    // Add notification badge for notifications item
    if (item.id === 'notifications') {
      navItem.classList.add('notification-icon');
      
      // Create badge for unread count
      const badge = document.createElement('span');
      badge.className = 'notification-badge';
      badge.id = type === 'bottom' ? 'mobile-notification-badge' : 'notification-unread-badge';
      navItem.appendChild(badge);
      
      // Import at runtime to avoid circular dependencies
      import('../services/NotificationsService.js').then(module => {
        const notificationsService = module.default;
        
        // Initial badge update
        const unreadCount = notificationsService.getUnreadCount();
        this.updateNotificationBadge(badge, unreadCount);
        
        // Listen for updates to the unread count
        eventEmitter.on('notifications:unread_count_updated', (count) => {
          this.updateNotificationBadge(badge, count);
        });
      });
    }
    
    return navItem;
  }
  
  /**
   * Updates the notification badge count and visibility
   */
  updateNotificationBadge(badge, count) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.add('visible');
      
      // Add animation class to draw attention
      badge.classList.add('pulse');
      
      // Remove animation class after animation completes
      setTimeout(() => {
        badge.classList.remove('pulse');
      }, 1000);
    } else {
      badge.textContent = '';
      badge.classList.remove('visible');
    }
  }
  
  toggleMobileMenu(force) {
    // Toggle menu or set to specific state if force parameter provided
    this.menuOpen = force !== undefined ? force : !this.menuOpen;
    
    if (this.menuOpen) {
      this.sideNav.classList.add('visible');
      this.overlay.classList.remove('hidden');
      document.body.classList.add('menu-open');
    } else {
      this.sideNav.classList.remove('visible');
      this.overlay.classList.add('hidden');
      document.body.classList.remove('menu-open');
    }
  }
  
  switchNavigationMode() {
    // Add/remove CSS classes instead of directly manipulating style properties
    document.body.classList.toggle('mobile-view', this.isMobile);
    
    if (this.isMobile) {
      this.enableMobileMode();
    } else {
      this.enableDesktopMode();
    }
    
    this.highlightActiveMenuItem();
  }
  
  enableMobileMode() {
    if (this.sideNav) {
      this.sideNav.classList.add('mobile');
      this.sideNav.classList.add('hidden');
    }
    if (this.bottomNav) this.bottomNav.classList.remove('hidden');
    if (this.app) this.app.classList.add('mobile-layout');
    if (this.navCenter) this.navCenter.classList.add('hidden');
  }
  
  enableDesktopMode() {
    if (this.sideNav) {
      this.sideNav.classList.remove('mobile');
      this.sideNav.classList.remove('hidden');
      this.sideNav.classList.remove('visible');
    }
    if (this.bottomNav) this.bottomNav.classList.add('hidden');
    if (this.app) this.app.classList.remove('mobile-layout');
    if (this.navCenter) this.navCenter.classList.remove('hidden');
  }
  
  highlightActiveMenuItem() {
    // Handle both regular and hash-based routing
    let currentPath = window.location.pathname || '/';
    
    // Check if we're using hash-based routing (GitHub Pages redirect does this)
    if (window.location.hash && window.location.hash.startsWith('#')) {
      // Extract the path from the hash
      currentPath = window.location.hash.substring(1) || '/';
    }
    
    // Strip trailing slash if present (except for root '/')
    if (currentPath !== '/' && currentPath.endsWith('/')) {
      currentPath = currentPath.slice(0, -1);
    }
    
    console.log('Current path for menu highlighting:', currentPath);
    
    // Update side nav active state
    const sideMenuItems = document.querySelectorAll('.side-nav .menu-item');
    sideMenuItems.forEach(item => {
      const href = item.getAttribute('href');
      let compareHref = href;
      
      // If href starts with a hash, extract the path part for comparison
      if (compareHref && compareHref.startsWith('#')) {
        compareHref = compareHref.substring(1);
      }
      
      // Make all menu items non-active first
      item.classList.remove('active');
      
      // Special case for home button (href="/")
      if (compareHref === '/') {
        // Home button should only be active when path is exactly "/" or empty
        const isActive = currentPath === '/' || currentPath === '';
        if (isActive) {
          item.classList.add('active');
        }
      } else {
        // For other items, check if the current path matches or starts with href
        const isActive = currentPath === compareHref || 
                        (compareHref !== '/' && currentPath.startsWith(compareHref));
        if (isActive) {
          item.classList.add('active');
        }
      }
    });
    
    // Update bottom nav active state - similar logic as above
    const bottomMenuItems = document.querySelectorAll('.bottom-nav-item');
    bottomMenuItems.forEach(item => {
      const href = item.getAttribute('href');
      let compareHref = href;
      
      // If compareHref starts with a hash, extract the path part for comparison
      if (compareHref && compareHref.startsWith('#')) {
        compareHref = compareHref.substring(1);
      }
      
      const isAction = item.classList.contains('center-button') || item.dataset.id === 'menu'; // Don't highlight create button or menu
      
      // Make all items non-active first
      item.classList.remove('active');
      
      if (!isAction) {
        // Special case for home button
        if (compareHref === '/') {
          // Home button should only be active when path is exactly "/" or empty
          const isActive = currentPath === '/' || currentPath === '';
          if (isActive) {
            item.classList.add('active');
          }
        } else {
          // For other items
          const isActive = currentPath === compareHref || 
                          (compareHref !== '/' && currentPath.startsWith(compareHref));
          if (isActive) {
            item.classList.add('active');
          }
        }
      }
    });
  }
}

export default NavigationManager;