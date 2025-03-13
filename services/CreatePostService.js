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
   * Create a new post on the Steem blockchain
   * 
   * @param {Object} postData - Post data
   * @param {string} postData.title - Post title
   * @param {string} postData.body - Post body in markdown format
   * @param {Array<string>} postData.tags - Post tags (max 5)
   * @param {Object} options - Additional options
   * @param {boolean} options.includeBeneficiary - Whether to include the beneficiary (default: true)
   * @param {number} options.beneficiaryWeight - Weight for beneficiary (default: 500 = 5%)
   * @returns {Promise<Object>} - Result from the blockchain operation
   */
  async createPost(postData, options = {}) {
    if (this.isProcessing) {
      throw new Error('Another post is already being processed');
    }

    if (!authService.isAuthenticated()) {
      throw new Error('You must be logged in to create a post');
    }

    const { title, body, tags } = postData;
    
    // Opzioni per il beneficiario
    const includeBeneficiary = options.includeBeneficiary !== false; // true di default
    const beneficiaryWeight = options.beneficiaryWeight || this.defaultBeneficiary.weight;
    
    // Validate post data
    this.validatePostData(postData);
    
    try {
      this.isProcessing = true;
      eventEmitter.emit('post:creation-started', { title });
      
      // Ensure Steem library is loaded
      await steemService.ensureLibraryLoaded();
      
      // Get necessary user data
      const currentUser = authService.getCurrentUser();
      const username = currentUser.username;
      
      let postingKey;
      
      if (currentUser.loginMethod === 'keychain' && window.steem_keychain) {
        postingKey = null; // Non serve la chiave, usiamo keychain
      } else {
        postingKey = localStorage.getItem(`${username}_posting_key`);
      }
      
      // Generate a permlink from the title
      const permlink = this.generatePermlink(title);
      
      // Prepare tags - first tag is the main category
      const processedTags = this.processTags(tags);
      const primaryTag = processedTags[0] || 'steemee';
      
      // Prepare JSON metadata
      const metadata = {
        tags: processedTags,
        app: 'steemee/1.0',
        format: 'markdown'
      };
      
      // Prepare beneficiaries array
      const beneficiaries = [];
      if (includeBeneficiary) {
        beneficiaries.push({
          account: this.defaultBeneficiary.name,
          weight: beneficiaryWeight
        });
      }
      
      // Broadcast to the blockchain
      let result;
      
      if (currentUser.loginMethod === 'keychain' && window.steem_keychain) {
        // Usa Keychain per firmare la transazione
        result = await this.broadcastPostWithKeychain({
          username,
          parentPermlink: primaryTag,
          title,
          body,
          permlink,
          metadata,
          beneficiaries
        });
      } else if (postingKey) {
        // Usa la chiave privata per firmare la transazione
        result = await this.broadcastPost({
          username,
          postingKey,
          parentPermlink: primaryTag,
          title,
          body,
          permlink,
          metadata,
          beneficiaries
        });
      } else {
        throw new Error('Posting key not available. You may need to login again.');
      }
      
      // Emit success event
      eventEmitter.emit('post:creation-completed', {
        success: true,
        author: username,
        permlink: permlink,
        title: title
      });
      
      return result;
    } catch (error) {
      console.error('Error creating post:', error);
      
      // Emit error event
      eventEmitter.emit('post:creation-error', {
        error: error.message || 'Unknown error occurred while creating post'
      });
      
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Broadcast post using Steem Keychain
   * 
   * @param {Object} options - Post options
   * @returns {Promise<Object>} - Blockchain result
   * @private
   */
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
            reject(new Error(response.message || 'Keychain broadcast failed'));
          }
        }
      );
    });
  }
  
  /**
   * Validate post data
   * 
   * @param {Object} postData - Post data to validate
   * @throws {Error} If validation fails
   */
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
  
  /**
   * Generate a permlink from post title
   * 
   * @param {string} title - Post title
   * @returns {string} - Permlink
   */
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
  
  /**
   * Process tags - sanitize, validate, etc.
   * 
   * @param {Array<string>} tags - Raw tags
   * @returns {Array<string>} - Processed tags
   */
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
  
  /**
   * Broadcast post to the blockchain
   * 
   * @param {Object} options - Post options
   * @returns {Promise<Object>} - Blockchain result
   * @private
   */
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
  
  /**
   * Edit an existing post
   * 
   * @param {Object} postData - Post data
   * @param {string} postData.author - Original author
   * @param {string} postData.permlink - Original permlink
   * @param {string} postData.title - New title
   * @param {string} postData.body - New body content
   * @param {Array<string>} postData.tags - New tags
   * @returns {Promise<Object>} - Result from blockchain operation
   */
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