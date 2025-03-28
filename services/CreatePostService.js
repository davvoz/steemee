import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';

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
      const postDetails = await this.preparePostDetails(postData, options);
      
      // Broadcast the post using available method
      const result = await this.broadcastUsingAvailableMethod(postDetails);
      
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
    const { title, body, tags, community } = postData;
    const currentUser = this.validateUserAuthentication();
    const username = currentUser.username;
    
    // Process beneficiary options
    const includeBeneficiary = options.includeBeneficiary !== false;
    const beneficiaryWeight = options.beneficiaryWeight || this.defaultBeneficiary.weight;
    
    // Generate permlink and process tags
    const permlink = this.generatePermlink(title);
    const processedTags = this.processTags(tags);
    
    // Determine parent permlink
    const parentPermlink = community 
      ? `hive-${community.replace(/^hive-/, '')}`
      : (processedTags[0] || 'steemee');
    
    // Prepare metadata
    const metadata = this.createPostMetadata(processedTags, community);
    
    // Prepare beneficiaries
    const beneficiaries = [];
    if (includeBeneficiary) {
      beneficiaries.push({
        account: this.defaultBeneficiary.name,
        weight: beneficiaryWeight
      });
    }
    
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
    
    const postingKey = authService.getPostingKey();
    const hasKeychain = typeof window.steem_keychain !== 'undefined';
    const isMobile = this.isMobileDevice();
    
    let result;
    
    if (postingKey) {
      result = await this.broadcastPost({
        ...postDetails,
        postingKey
      });
    } 
    else if (hasKeychain) {
      if (isMobile && !window.steem_keychain) {
        throw new Error('Steem Keychain is not available on this mobile browser. Please use a desktop browser or log in with your posting key.');
      }
      
      result = await this.broadcastPostWithKeychain(postDetails);
    }
    else {
      throw new Error('No valid posting credentials available. Please login with your posting key or install Steem Keychain.');
    }
    
   
    
    return result;
  }

  emitSuccessEvent(postDetails) {
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
      throw new Error('Maximum 5 tags allowed');
    }
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
    const randomChars = Math.random().toString(36).substring(2, 8);
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
}

// Create and export singleton instance
const createPostService = new CreatePostService();
export default createPostService;