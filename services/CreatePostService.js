import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';
import telegramService from './TelegramService.js';

/**
 * Service for creating and editing posts
 */
class CreatePostService {
  constructor() {
    this.isProcessing = false;
    // Configurazione del beneficiario predefinito
    this.defaultBeneficiary = {
      name: 'micro.cur8',
      weight: 500 // 5% della ricompensa (10000 = 100%)
    };
    
    // Limite massimo di beneficiari
    this.maxBeneficiaries = 8; // Massimo 8 beneficiari per post
    
    // Chiave per localStorage
    this.DRAFT_STORAGE_KEY = 'steemee_post_draft';
  }

  /**
   * Determine se siamo su un dispositivo mobile
   * @returns {boolean} true se il dispositivo è mobile
   */
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  async createPost(postData, options = {}) {
    if (this.isProcessing) {
      throw new Error('Another post is already being processed');
    }

    if (!authService.isAuthenticated()) {
      throw new Error('You must be logged in to create a post');
    }

    try {
      this.isProcessing = true;
      const { title } = postData;
      eventEmitter.emit('post:creation-started', { title });
      
      // Validate input data
      this.validatePostData(postData);
      await steemService.ensureLibraryLoaded();
      
      // Prepare post data
      const postDetails = this.preparePostDetails(postData, options);
      
      // Broadcast the post using available method
      const result = await this.broadcastUsingAvailableMethod(postDetails);
      
      // Rimuovi la bozza salvata dopo il successo
      this.clearDraft();
      
      this.emitSuccessEvent(postDetails);
      return result;
    } catch (error) {
      this.handlePostCreationError(error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  preparePostDetails(postData, options = {}) {
    const { title, body, tags, community, permlink: customPermlink } = postData;
    const currentUser = this.validateUserAuthentication();
    const username = currentUser.username;
    
    // Process beneficiary options
    const includeBeneficiary = options.includeBeneficiary !== false;
    
    // Prepara i beneficiari
    const beneficiaries = [];
    if (includeBeneficiary) {
      // Se ci sono beneficiari personalizzati forniti, usali
      if (options.beneficiaries && Array.isArray(options.beneficiaries) && options.beneficiaries.length > 0) {
        // Assicuriamoci di non superare il limite massimo di beneficiari
        const validBeneficiaries = options.beneficiaries
          .filter(b => b && b.account && b.weight > 0 && b.weight <= 10000)
          .slice(0, this.maxBeneficiaries);
          
        beneficiaries.push(...validBeneficiaries);
      }
      // Altrimenti usa il beneficiario predefinito con peso personalizzato se fornito
      else {
        beneficiaries.push({
          account: this.defaultBeneficiary.name,
          weight: options.beneficiaryWeight || this.defaultBeneficiary.weight
        });
      }
    }
    
    // Generate permlink or use the provided one
    const permlink = customPermlink || this.generatePermlink(title);
    
    // Process tags
    const processedTags = this.processTags(tags);
    
    // Determine parent permlink - use community if provided, otherwise first tag
    const parentPermlink = community 
      ? `hive-${community.replace(/^hive-/, '')}`
      : (processedTags[0] || 'steemee');
    
    // Prepare metadata
    const metadata = this.createPostMetadata(processedTags, community);
    
    return {
      username,
      title,
      body,
      permlink,
      parentPermlink,
      metadata,
      beneficiaries,
      community
    };
  }

  validateUserAuthentication() {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated. Please login again.');
    }
    return currentUser;
  }

  createPostMetadata(tags, community) {
    const metadata = {
      tags,
      app: 'steemee/1.0',
      format: 'markdown'
    };
    
    if (community) {
      metadata.community = community;
    }
    
    return metadata;
  }

  async broadcastUsingAvailableMethod(postDetails) {
    
    // Verifica il metodo di login dell'utente
    const user = authService.getCurrentUser();
    const loginMethod = user?.loginMethod;
    
    const postingKey = authService.getPostingKey();
    const hasKeychain = typeof window.steem_keychain !== 'undefined';
    const isMobile = this.isMobileDevice();
    
    // Verifica il metodo di login e usa solo quello (nessun fallback)
    if (loginMethod === 'keychain') {
        // Se l'utente è loggato con Keychain, deve usare solo Keychain
        if (!hasKeychain) {
            throw new Error('You are logged in with Keychain, but the extension is not available. Please install or enable Steem Keychain extension.');
        }
        
        if (isMobile && !window.steem_keychain) {
            throw new Error('Steem Keychain is not available on this mobile browser. Please use a desktop browser.');
        }
        
        return await this.broadcastPostWithKeychain(postDetails);
    } 
    else if (loginMethod === 'privateKey' || loginMethod === 'steemlogin') {
        // Se l'utente è loggato con chiave privata o steemlogin, deve avere una posting key
        if (!postingKey) {
            throw new Error('Posting key not available. Please log in again to refresh your credentials.');
        }
        
        return await this.broadcastPost({
            ...postDetails,
            postingKey
        });
    } 
    else {
        // Metodo di login sconosciuto o non specificato
        throw new Error(`Unsupported login method: ${loginMethod || 'unknown'}. Please log in with a supported method.`);
    }
  }

  emitSuccessEvent(postDetails) {
    // Send Telegram notification after successful post creation using the centralized service
    telegramService.sendPostNotification(postDetails)
      .catch(error => console.error('Error sending Telegram notification:', error));
    
    eventEmitter.emit('post:creation-completed', {
      success: true,
      author: postDetails.username,
      permlink: postDetails.permlink,
      title: postDetails.title,
      community: postDetails.community
    });
  }

  handlePostCreationError(error) {
    console.error('Error creating post:', error);
    
    let errorMessage = error.message || 'Unknown error occurred while creating post';
    
    if (error.message && (
        error.message.includes('cancel') || 
        error.message.includes('Cancel') ||
        error.message.includes('Request was canceled'))) {
      errorMessage = 'Operation was cancelled.';
    }
    
    eventEmitter.emit('post:creation-error', { error: errorMessage });
  }
  
  broadcastPostWithKeychain({ username, parentPermlink, title, body, permlink, metadata, beneficiaries = [] }) {
    return new Promise((resolve, reject) => {
      const jsonMetadata = JSON.stringify(metadata);
      
      // Create operations array
      const operations = [
        ['comment', {
          parent_author: '',
          parent_permlink: parentPermlink,
          author: username,
          permlink: permlink,
          title: title,
          body: body,
          json_metadata: jsonMetadata
        }]
      ];
      
      // Add comment_options operation with beneficiary if needed
      if (beneficiaries.length > 0) {
        // Per le opzioni standard del post
        const commentOptionsOperation = [
          'comment_options', 
          {
            author: username,
            permlink: permlink,
            max_accepted_payout: '1000000.000 SBD',
            percent_steem_dollars: 10000,
            allow_votes: true,
            allow_curation_rewards: true,
            extensions: [
              [0, {
                beneficiaries: beneficiaries
              }]
            ]
          }
        ];
        operations.push(commentOptionsOperation);
      }
      
      window.steem_keychain.requestBroadcast(
        username, 
        operations, 
        'posting', 
        response => {
          if (response.success) {
            resolve(response.result);
          } else {
            // Gestione migliorata dell'errore di keychain
            if (response.error && (
                response.error.includes('cancel') || 
                response.error.includes('Cancel') ||
                response.error === 'user_cancel')) {
              const cancelError = new Error('Operation cancelled by user');
              cancelError.isCancelled = true;
              reject(cancelError);
            } else {
              reject(new Error(response.message || response.error || 'Keychain broadcast failed'));
            }
          }
        }
      );
    });
  }
  
  validatePostData(postData) {
    const { title, body, tags } = postData;
    
    if (!title || title.trim().length === 0) {
      throw new Error('Post title is required');
    }
    
    if (title.length > 255) {
      throw new Error('Post title must be less than 255 characters');
    }
    
    if (!body || body.trim().length === 0) {
      throw new Error('Post content is required');
    }
    
    if (!tags || tags.length === 0) {
      throw new Error('At least one tag is required');
    }
    
    if (tags.length > 5) {
      throw new Error('Maximum 5 tags allowed. Please remove some tags to continue.');
    }
    
    // Validate individual tags
    tags.forEach(tag => {
      if (tag.length > 24) {
        throw new Error(`Tag '${tag}' is too long. Maximum length is 24 characters.`);
      }
      if (!/^[a-z0-9-]+$/.test(tag)) {
        throw new Error(`Tag '${tag}' contains invalid characters. Only lowercase letters, numbers, and hyphens are allowed.`);
      }
    });
  }
  

  generatePermlink(title) {
    // Create permlink from title - lowercase, replace spaces with hyphens
    let permlink = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Collapse multiple hyphens
      .trim();
      
    // Add random suffix to prevent duplicates
    const randomBytes = crypto.getRandomValues(new Uint8Array(3)); // Generate 3 random bytes
    const randomChars = Array.from(randomBytes, byte => ('0' + byte.toString(16)).slice(-2)).join(''); // Convert to a hex string
    permlink = `${permlink}-${randomChars}`;
    
    return permlink.substring(0, 255); // Ensure permlink isn't too long
  }
  
  processTags(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }
    
    // Filter out empty tags, convert to lowercase, limit to 24 chars
    return tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .map(tag => tag.replace(/[^a-z0-9-]/g, ''))
      .map(tag => tag.substring(0, 24))
      .filter((tag, index, self) => self.indexOf(tag) === index) // Remove duplicates
      .slice(0, 5); // Limit to 5 tags
  }
  
  async broadcastPost({ username, postingKey, parentPermlink, title, body, permlink, metadata, beneficiaries = [] }) {
    // Format JSON metadata
    const jsonMetadata = JSON.stringify(metadata);
    
    return new Promise((resolve, reject) => {
      // Prima, crea il post
      window.steem.broadcast.comment(
        postingKey,          // Posting key
        '',                  // Parent author (empty for new post)
        parentPermlink,      // Primary tag as parent permlink
        username,            // Author
        permlink,            // Permlink
        title,               // Title
        body,                // Body
        jsonMetadata,        // JSON metadata
        (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Se ci sono beneficiari, aggiungi le opzioni al post
          if (beneficiaries.length > 0) {
            window.steem.broadcast.commentOptions(
              postingKey,
              username,
              permlink,
              '1000000.000 SBD',  // max_accepted_payout
              10000,              // percent_steem_dollars (100%)
              true,               // allow_votes
              true,               // allow_curation_rewards
              [
                [0, { beneficiaries: beneficiaries }]
              ],
              (optErr, optResult) => {
                if (optErr) {
                  console.error('Failed to set beneficiaries:', optErr);
                  // Risolviamo comunque perché il post è stato creato
                  resolve(result);
                } else {
                  resolve(optResult);
                }
              }
            );
          } else {
            resolve(result);
          }
        }
      );
    });
  }
  
  async editPost(postData) {
    // Implement post editing functionality
    // Similar to createPost but uses existing permlink
    // Not fully implemented as the original code doesn't have this feature
    throw new Error('Edit post functionality not yet implemented');
  }

  /**
   * Salva una bozza del post nel localStorage
   * @param {Object} draftData - I dati della bozza (title, body, tags, community)
   * @returns {boolean} - true se il salvataggio è riuscito
   */
  saveDraft(draftData) {
    try {
      // Aggiungi timestamp al salvataggio
      const draft = {
        ...draftData,
        timestamp: new Date().toISOString(),
        username: authService.getCurrentUser()?.username || 'anonymous'
      };
      
      localStorage.setItem(this.DRAFT_STORAGE_KEY, JSON.stringify(draft));
      return true;
    } catch (error) {
      console.error('Failed to save draft:', error);
      return false;
    }
  }
  
  /**
   * Recupera la bozza salvata
   * @returns {Object|null} - La bozza salvata o null se non esiste
   */
  getDraft() {
    try {
      const draftJson = localStorage.getItem(this.DRAFT_STORAGE_KEY);
      if (!draftJson) return null;
      
      const draft = JSON.parse(draftJson);
      
      // Verifica che la bozza appartenga all'utente corrente
      const currentUser = authService.getCurrentUser()?.username;
      if (currentUser && draft.username !== currentUser) {
        return null;
      }
      
      // Verifica che la bozza non sia troppo vecchia (più di 7 giorni)
      const draftDate = new Date(draft.timestamp);
      const now = new Date();
      const daysOld = (now - draftDate) / (1000 * 60 * 60 * 24);
      
      if (daysOld > 7) {
        this.clearDraft();
        return null;
      }
      
      return draft;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  }
  
  /**
   * Verifica se esiste una bozza salvata
   * @returns {boolean} - true se esiste una bozza
   */
  hasDraft() {
    return this.getDraft() !== null;
  }
  
  /**
   * Cancella la bozza salvata
   */
  clearDraft() {
    try {
      localStorage.removeItem(this.DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }
  
  /**
   * Calcola l'età della bozza in un formato leggibile
   * @returns {string|null} - Età della bozza o null se non esiste
   */
  getDraftAge() {
    try {
      const draft = this.getDraft();
      if (!draft || !draft.timestamp) return null;
      
      const draftDate = new Date(draft.timestamp);
      const now = new Date();
      const diffMs = now - draftDate;
      
      // Meno di un'ora
      if (diffMs < 60 * 60 * 1000) {
        const mins = Math.floor(diffMs / (60 * 1000));
        return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
      }
      
      // Meno di un giorno
      if (diffMs < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diffMs / (60 * 60 * 1000));
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
      }
      
      // Più di un giorno
      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
      
    } catch (error) {
      console.error('Failed to calculate draft age:', error);
      return null;
    }
  }

  /**
   * Verifica che la percentuale totale dei beneficiari non superi il limite massimo
   * @param {Array} beneficiaries - Lista dei beneficiari
   * @returns {boolean} - True se la percentuale totale è valida
   */
  validateBeneficiaryPercentage(beneficiaries) {
    if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) {
      return true;
    }
    
    const totalWeight = beneficiaries.reduce((sum, beneficiary) => sum + (beneficiary.weight || 0), 0);
    
    // Il peso totale non dovrebbe superare il 90% (9000) per lasciare qualcosa all'autore
    return totalWeight <= 9000;
  }
}

// Create and export singleton instance
const createPostService = new CreatePostService();
export default createPostService;