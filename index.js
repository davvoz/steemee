import router from './utils/Router.js';
import HomeView from './views/HomeView.js';
import PostView from './views/PostView.js';
import LoginView from './views/LoginView.js';
import ProfileView from './views/ProfileView.js';
import CreatePostView from './views/CreatePostView.js';
import NotFoundView from './views/NotFoundView.js';
import WalletView from './views/WalletView.js';
import eventEmitter from './utils/EventEmitter.js';
import authService from './services/AuthService.js';
import NavigationManager from './utils/NavigationManager.js';



// Setup routes with proper handlers
router
  .addRoute('/', HomeView, { tag: 'trending' })
  .addRoute('/login', LoginView)
  .addRoute('/create', CreatePostView, { requiresAuth: true })
  .addRoute('/trending', HomeView, { tag: 'trending' })
  .addRoute('/hot', HomeView, { tag: 'hot' })
  .addRoute('/new', HomeView, { tag: 'created' })
  .addRoute('/promoted', HomeView, { tag: 'promoted' }) 
  .addRoute('/wallet', WalletView, { requiresAuth: true }) // Add this line
  .addRoute('/@:username', ProfileView)
  .addRoute('/@:author/:permlink', PostView)
  .setNotFound(NotFoundView);

// Auth guard middleware
router.beforeEach((to, next) => {
  if (to.options?.requiresAuth && !authService.getCurrentUser()) {
    router.navigate('/login', { returnUrl: to.path });
    return;
  }
  next();
});

// Initialize app structure
function initApp() {
  const app = document.getElementById('app');
  if (!app) return;

  // Crea istanza del NavigationManager
  const navManager = new NavigationManager();
  
  // Attiva la navigazione standard
  initNavigation();
  
  // Inizializzazione del router
  router.init();
}

function initNavigation() {
  // Initial update
  updateNavigation();
  
  // Subscribe to events that require nav updates
  eventEmitter.on('auth:changed', updateNavigation);
  eventEmitter.on('route:changed', updateNavigation);
}

function updateNavigation() {
  updateNavigationMenu();
  // Remove the call to highlightActiveMenuItem as it's now handled by NavigationManager
  // highlightActiveMenuItem();
}

function updateNavigationMenu() {
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;
  
  // Clear existing content
  navRight.innerHTML = '';
  
  const currentUser = authService.getCurrentUser();
  
  if (currentUser) {
    renderAuthenticatedNav(navRight, currentUser);
  } else {
    renderUnauthenticatedNav(navRight);
  }
}

function renderAuthenticatedNav(container, user) {
  const navActions = document.createElement('div');
  navActions.className = 'nav-actions';
  
  // Create Post button
  navActions.appendChild(createCreatePostButton());
  
  // Notifications button
  navActions.appendChild(createNotificationsButton());
  
  // User menu
  navActions.appendChild(createUserMenu(user));
  
  container.appendChild(navActions);
}

function renderUnauthenticatedNav(container) {
  const loginBtn = document.createElement('a');
  loginBtn.href = '/login';
  loginBtn.className = 'login-btn';
  loginBtn.textContent = 'Login';
  container.appendChild(loginBtn);
}

function createCreatePostButton() {
  const btn = document.createElement('a');
  btn.href = '/create';
  btn.className = 'create-post-btn';
  
  const icon = document.createElement('span');
  icon.className = 'material-icons';
  icon.textContent = 'add';
  btn.appendChild(icon);
  btn.appendChild(document.createTextNode('Create'));
  
  return btn;
}

function createNotificationsButton() {
  const link = document.createElement('a');
  link.href = '/notifications';
  link.className = 'nav-icon';
  
  const icon = document.createElement('span');
  icon.className = 'material-icons';
  icon.textContent = 'notifications';
  link.appendChild(icon);
  
  return link;
}

function createUserMenu(user) {
  const userMenu = document.createElement('div');
  userMenu.className = 'user-menu';
  
  // Avatar
  const avatar = document.createElement('img');
  avatar.src = `https://steemitimages.com/u/${user.username}/avatar`;
  avatar.alt = user.username;
  avatar.className = 'avatar';
  userMenu.appendChild(avatar);
  
  // Dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown';
  
  // Profile link
  const profileLink = document.createElement('a');
  profileLink.href = `/@${user.username}`;
  profileLink.textContent = 'Profile';
  dropdown.appendChild(profileLink);
  
  // Logout button
  const logoutBtn = document.createElement('a');
  logoutBtn.href = '#';
  logoutBtn.className = 'logout-btn';
  logoutBtn.textContent = 'Logout';
  dropdown.appendChild(logoutBtn);
  
  // Add logout handler
  logoutBtn.addEventListener('click', handleLogout);
  
  userMenu.appendChild(dropdown);
  return userMenu;
}

function handleLogout(e) {
  e.preventDefault();
  authService.logout();
  eventEmitter.emit('auth:changed', { user: null });
  eventEmitter.emit('notification', {
    type: 'info',
    message: 'You have been logged out'
  });
  router.navigate('/');
}

document.addEventListener('DOMContentLoaded', initApp);

//Per aggiungere una nuova route ,
//aggiungere una nuova riga al metodo addRoute di router.js
//router.addRoute('/example', ExampleView);
//poi creare il file ExampleView.js in views
