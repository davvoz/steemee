import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';

class WalletService {
  constructor() {
    this.currentUser = null;
    this.balances = {
      steem: '0.000',
      sbd: '0.000',
      steemPower: '0.000'
    };
    
    // Listen for auth changes
    eventEmitter.on('auth:changed', ({ user }) => {
      this.currentUser = user ? user.username : null;
      if (this.currentUser) {
        this.updateBalances();
      }
    });
    
    // Set initial user if already logged in
    const user = authService.getCurrentUser();
    if (user) {
      this.currentUser = user.username;
    }
  }
  
  /**
   * Convert vests to STEEM POWER (SP)
   */
  async vestsToSteem(vests) {
    try {
      const steem = await steemService.ensureLibraryLoaded();
      return new Promise((resolve, reject) => {
        steem.api.getDynamicGlobalProperties(function (err, result) {
          if (err) {
            reject(err);
            return;
          }
          const totalVests = parseFloat(result.total_vesting_shares.split(' ')[0]);
          const totalSteem = parseFloat(result.total_vesting_fund_steem.split(' ')[0]);
          const steemPerVest = totalSteem / totalVests;
          const steemPower = parseFloat(vests) * steemPerVest;
          resolve(steemPower);
        });
      });
    } catch (error) {
      console.error('Error converting vests:', error);
      throw error;
    }
  }
  
  /**
   * Convert STEEM POWER (SP) to vests
   */
  async steemToVests(steemPower) {
    try {
      const steem = await steemService.ensureLibraryLoaded();
      return new Promise((resolve, reject) => {
        steem.api.getDynamicGlobalProperties(function (err, result) {
          if (err) {
            reject(err);
            return;
          }
          const totalVests = parseFloat(result.total_vesting_shares.split(' ')[0]);
          const totalSteem = parseFloat(result.total_vesting_fund_steem.split(' ')[0]);
          const vestsPerSteem = totalVests / totalSteem;
          const vests = parseFloat(steemPower) * vestsPerSteem;
          resolve(vests.toFixed(6));
        });
      });
    } catch (error) {
      console.error('Error converting steem power to vests:', error);
      throw error;
    }
  }
  
  /**
   * Update user balances
   * @param {number} delayMs - Optional delay in milliseconds before updating
   */
  async updateBalances(delayMs = 15000) {
    if (!this.currentUser) return;
    
    // Add delay if specified
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    try {
      const account = await steemService.getUser(this.currentUser);
      
      if (account) {
        const steemBalance = parseFloat(account.balance).toFixed(3);
        const sbdBalance = parseFloat(account.sbd_balance).toFixed(3);
        
        // Extract vesting shares data 
        const vestingShares = parseFloat(account.vesting_shares);
        const delegatedVestingShares = parseFloat(account.delegated_vesting_shares);
        const receivedVestingShares = parseFloat(account.received_vesting_shares);
        
        // Calculate actual SP values
        const ownVestingShares = vestingShares - delegatedVestingShares;
        const ownSteemPower = await this.vestsToSteem(ownVestingShares);
        const delegatedOutSP = await this.vestsToSteem(delegatedVestingShares);
        const delegatedInSP = await this.vestsToSteem(receivedVestingShares);
        
        // Calculate effective STEEM Power (with delegations)
        const steemPower = await this.vestsToSteem(
          vestingShares - delegatedVestingShares + receivedVestingShares
        );
        
        this.balances = {
          steem: steemBalance,
          sbd: sbdBalance,
          steemPower: steemPower.toFixed(3),
          // Add detailed delegation information
          steemPowerDetails: {
            total: steemPower.toFixed(3),
            own: ownSteemPower.toFixed(3),
            delegatedOut: delegatedOutSP.toFixed(3),
            delegatedIn: delegatedInSP.toFixed(3),
            effective: (ownSteemPower + delegatedInSP).toFixed(3)
          }
        };
        
        // Notify listeners about balance update
        eventEmitter.emit('wallet:balances-updated', this.balances);
      }
    } catch (error) {
      console.error('Error updating balances:', error);
      eventEmitter.emit('notification', {
        type: 'error',
        message: 'Failed to update wallet balances'
      });
    }
  }
  
  /**
   * Get user delegations
   */
  async getDelegations() {
    try {
      const username = authService.getCurrentUser()?.username;
      if (!username) return [];
      
      const delegations = await new Promise((resolve, reject) => {
        window.steem.api.getVestingDelegations(username, null, 100, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      // Convert vests to SP for each delegation
      return Promise.all(delegations.map(async (delegation) => {
        const sp_amount = await this.vestsToSteem(delegation.vesting_shares);
        return {
          ...delegation,
          sp_amount: parseFloat(sp_amount).toFixed(3)
        };
      }));
    } catch (error) {
      console.error('Error fetching delegations:', error);
      return [];
    }
  }
  
  /**
   * Transfer STEEM to another account
   */
  async transferSteem(recipient, amount, memo = '') {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestTransfer(
          this.currentUser,
          recipient,
          parseFloat(amount).toFixed(3),
          memo,
          'STEEM',
          function(response) {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Transfer failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error transferring STEEM:', error);
      throw error;
    }
  }
  
  /**
   * Power up STEEM to STEEM POWER
   */
  async powerUp(amount) {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestPowerUp(
          this.currentUser,
          this.currentUser,
          parseFloat(amount).toFixed(3),
          function(response) {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Power up failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error powering up STEEM:', error);
      throw error;
    }
  }
  
  /**
   * Delegate STEEM POWER to another account
   */
  async delegateSteemPower(delegatee, amount) {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestDelegation(
          this.currentUser,
          delegatee,
          parseFloat(amount).toFixed(3),
          'SP',
          function(response) {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Delegation failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error delegating STEEM POWER:', error);
      throw error;
    }
  }
  
  /**
   * Get account transaction history
   */
  async getTransactionHistory(limit = 20) {
    if (!this.currentUser) return [];
    
    try {
      const steem = await steemService.ensureLibraryLoaded();
      
      const result = await new Promise((resolve, reject) => {
        steem.api.getAccountHistory(this.currentUser, -1, limit, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      return result;
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
  }

  /**
   * Get transaction history for any user (not just the logged-in user)
   * @param {string} username - Username to get history for
   * @param {number} limit - Number of transactions to retrieve
   * @return {Promise<Array>} Array of transactions
   */
  async getUserTransactionHistory(username, limit = 30) {
    if (!username) return [];
    
    try {
      const steem = await steemService.ensureLibraryLoaded();
      
      return new Promise((resolve, reject) => {
        steem.api.getAccountHistory(username, -1, limit, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    } catch (error) {
      console.error(`Error fetching transaction history for ${username}:`, error);
      return [];
    }
  }

  /**
   * Power down STEEM POWER
   */
  async powerDown(amount) {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestPowerDown(
          this.currentUser,
          this.currentUser,
          parseFloat(amount).toFixed(3),
          function(response) {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Power down failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error powering down STEEM:', error);
      throw error;
    }
  }

  /**
   * Cancel a STEEM POWER down
   */
  async cancelPowerDown() {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return this.powerDown('0.000'); // Setting to 0 cancels power down
    } catch (error) {
      console.error('Error canceling power down:', error);
      throw error;
    }
  }

  /**
   * Get power down schedule and current power down status
   */
  async getPowerDownInfo() {
    if (!this.currentUser) return null;
    
    try {
      const account = await steemService.getUser(this.currentUser);
      
      if (!account) return null;
      
      // Calculate next power down date
      const nextVestingWithdrawal = new Date(account.next_vesting_withdrawal + 'Z');
      const isWithdrawing = parseFloat(account.vesting_withdraw_rate) > 0;
      
      // Calculate weekly withdrawal rate in SP
      const withdrawRateVests = parseFloat(account.vesting_withdraw_rate);
      const withdrawRateSP = await this.vestsToSteem(withdrawRateVests);
      
      // Calculate remaining weeks (if powering down)
      let remainingWeeks = 0;
      if (isWithdrawing) {
        const totalVestingShares = parseFloat(account.vesting_shares);
        remainingWeeks = Math.ceil(totalVestingShares / withdrawRateVests);
      }
      
      return {
        isPoweringDown: isWithdrawing,
        nextPowerDown: isWithdrawing ? nextVestingWithdrawal : null,
        weeklyRate: isWithdrawing ? withdrawRateSP.toFixed(3) : '0.000',
        remainingWeeks
      };
    } catch (error) {
      console.error('Error getting power down info:', error);
      return null;
    }
  }

  /**
   * Transfer SBD to another account
   */
  async transferSBD(recipient, amount, memo = '') {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestTransfer(
          this.currentUser,
          recipient,
          parseFloat(amount).toFixed(3),
          memo,
          'SBD',
          function(response) {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Transfer failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error transferring SBD:', error);
      throw error;
    }
  }

  /**
   * Claim rewards (STEEM, STEEM POWER, SBD)
   */
  async claimRewards() {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      const account = await steemService.getUser(this.currentUser);
      
      if (!account) throw new Error('Failed to retrieve account information');
      
      const rewardSteem = account.reward_steem_balance;
      const rewardSBD = account.reward_sbd_balance;
      const rewardVests = account.reward_vesting_balance;
      
      // Check if there are rewards to claim
      if (parseFloat(rewardSteem) === 0 && 
          parseFloat(rewardSBD) === 0 && 
          parseFloat(rewardVests) === 0) {
        throw new Error('No rewards to claim');
      }
      
      // Use requestBroadcast with the claim_reward_balance operation
      return new Promise((resolve, reject) => {
        const operations = [
          ["claim_reward_balance", {
            account: this.currentUser,
            reward_steem: rewardSteem,
            reward_sbd: rewardSBD,
            reward_vests: rewardVests
          }]
        ];
        
        window.steem_keychain.requestBroadcast(
          this.currentUser,
          operations,
          "Active", // The key type needed for claiming rewards
          function(response) {
            console.log('Claim rewards response:', response);
            
            if (response.success) {
              resolve({ 
                success: true,
                rewards: {
                  steem: rewardSteem.split(' ')[0],
                  sbd: rewardSBD.split(' ')[0],
                  vests: rewardVests.split(' ')[0]
                }
              });
            } else {
              reject(new Error(response.message || 'Claim rewards failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error claiming rewards:', error);
      throw error;
    }
  }

  /**
   * Get available rewards to claim
   */
  async getAvailableRewards() {
    if (!this.currentUser) return { steem: '0.000', sbd: '0.000', vest: '0.000', sp: '0.000' };
    
    try {
      const account = await steemService.getUser(this.currentUser);
      
      if (!account) return { steem: '0.000', sbd: '0.000', vest: '0.000', sp: '0.000' };
      
      const rewardSteem = account.reward_steem_balance || '0.000 STEEM';
      const rewardSBD = account.reward_sbd_balance || '0.000 SBD';
      const rewardVests = account.reward_vesting_balance || '0.000 VESTS';
      
      // Convert vests to SP
      const vestAmount = parseFloat(rewardVests.split(' ')[0]);
      const sp = await this.vestsToSteem(vestAmount);
      
      return {
        steem: rewardSteem.split(' ')[0],
        sbd: rewardSBD.split(' ')[0],
        vest: rewardVests.split(' ')[0],
        sp: sp.toFixed(3)
      };
    } catch (error) {
      console.error('Error getting available rewards:', error);
      return { steem: '0.000', sbd: '0.000', vest: '0.000', sp: '0.000' };
    }
  }

  /**
   * Power up STEEM to STEEM POWER using Steem Keychain or private key
   * @param {string} amount - Amount to power up with 3 decimal places
   * @returns {Promise} Promise resolving to response object
   */
  powerUp(amount) {
    return new Promise(async (resolve, reject) => {
      try {
        const user = authService.getCurrentUser();
        const username = user?.username;
        
        if (!username) {
          return reject(new Error('User not logged in'));
        }
        
        console.log('PowerUp: Login method detected:', user.loginMethod);
        
        // Format the amount properly
        const formattedAmount = parseFloat(amount).toFixed(3) + ' STEEM';
        
        // Prepare the operation
        const operations = [
          ["transfer_to_vesting", {
            from: username,
            to: username, // Self power-up
            amount: formattedAmount
          }]
        ];
        
        // Prima verifichiamo se l'utente ha fatto login con chiave privata
        debugger
        if (user.loginMethod === 'privateKey') {
          // Usa la chiave privata dal localStorage
          try {
            console.log('PowerUp: Using private key authentication');
            
            // Carica la libreria Steem
            const steem = await steemService.ensureLibraryLoaded();
            
            // Ottieni la chiave attiva dallo storage
            const activeKey = authService.getActiveKey();
            console.log('PowerUp: Active key available:', activeKey ? 'YES' : 'NO');
            
            if (!activeKey) {
              throw new Error('Active key not available. Please login with active key permissions.');
            }
            
            // Effettua il broadcast della transazione usando la chiave privata
            steem.broadcast.send(
              { operations: operations, extensions: [] },
              { active: activeKey },
              (err, result) => {
                if (err) {
                  console.error('Power up error (private key):', err);
                  resolve({
                    success: false,
                    message: err.message || 'Transaction failed'
                  });
                } else {
                  console.log('Power up successful (private key):', result);
                  resolve({ 
                    success: true,
                    result: result
                  });
                  
                  // Aggiornamento dei saldi dopo transazione riuscita
                  setTimeout(() => this.updateBalances(), 3000);
                  
                  // Notifica di successo
                  eventEmitter.emit('notification', {
                    type: 'success',
                    message: `Successfully powered up ${parseFloat(amount).toFixed(3)} STEEM`
                  });
                }
              }
            );
          } catch (error) {
            console.error('Error broadcasting with private key:', error);
            reject(error);
          }
        }
        // Se l'utente ha fatto login con Keychain e Keychain è disponibile
        else if (user.loginMethod === 'keychain' && window.steem_keychain) {
          console.log('PowerUp: Using Keychain authentication');
          
          // Usa Keychain
          window.steem_keychain.requestBroadcast(
            username,
            operations,
            "Active",
            (response) => {
              console.log('Power up response (Keychain):', response);
              
              if (response.success) {
                resolve({ success: true });
                
                // Notifica di successo
                eventEmitter.emit('notification', {
                  type: 'success',
                  message: `Successfully powered up ${parseFloat(amount).toFixed(3)} STEEM`
                });
                
                // Aggiorna i saldi dopo l'operazione riuscita
                setTimeout(() => this.updateBalances(), 3000);
              } else {
                resolve({ 
                  success: false, 
                  message: response.message || 'Unknown error' 
                });
              }
            }
          );
        } else if (user.loginMethod === 'steemlogin') {
          // Gestione metodo SteemLogin
          console.log('PowerUp: SteemLogin not yet supported for power up');
          reject(new Error('SteemLogin power up is not implemented yet'));
        } else {
          // Fallback: tentiamo di usare chiave privata se disponibile
          const activeKey = authService.getActiveKey();
          if (activeKey) {
            console.log('PowerUp: Fallback to private key');
            
            // Carica la libreria Steem
            const steem = await steemService.ensureLibraryLoaded();
            
            // Effettua il broadcast della transazione usando la chiave privata
            steem.broadcast.send(
              { operations: operations, extensions: [] },
              { active: activeKey },
              (err, result) => {
                if (err) {
                  console.error('Power up error (fallback):', err);
                  resolve({
                    success: false,
                    message: err.message || 'Transaction failed'
                  });
                } else {
                  console.log('Power up successful (fallback):', result);
                  resolve({ 
                    success: true,
                    result: result
                  });
                  
                  // Aggiornamento dei saldi dopo transazione riuscita
                  setTimeout(() => this.updateBalances(), 3000);
                }
              }
            );
          } else {
            console.error('PowerUp: No suitable authentication method available');
            reject(new Error('No suitable authentication method available. Please login with active key or Keychain.'));
          }
        }
      } catch (error) {
        console.error('Power up error:', error);
        reject(error);
      }
    });
  }

  /**
   * Power down SP to STEEM using Steem Keychain
   * @param {string} amount - Amount to power down with 3 decimal places
   * @returns {Promise} Promise resolving to response object
   */
  powerDown(amount) {
    return new Promise((resolve, reject) => {
      try {
        const username = authService.getCurrentUser()?.username;
        
        if (!username) {
          return reject(new Error('User not logged in'));
        }
        
        if (!window.steem_keychain) {
          return reject(new Error('Steem Keychain not available'));
        }

        // Convert to vests first (required for withdraw_vesting operation)
        this.steemToVests(amount)
          .then(vests => {
            // Steem Keychain uses "withdraw_vesting" operation
            const operations = [
              ["withdraw_vesting", {
                account: username,
                vesting_shares: `${vests} VESTS` // Format must be "0.000000 VESTS"
              }]
            ];
            
            window.steem_keychain.requestBroadcast(
              username,      // Username
              operations,    // Operations array
              "Active",      // Key type required
              (response) => {
                console.log('Power down response:', response);
                
                if (response.success) {
                  resolve({ success: true });
                } else {
                  resolve({ 
                    success: false, 
                    message: response.message || 'Unknown error' 
                  });
                }
              }
            );
          })
          .catch(error => {
            console.error('Error converting SP to VESTS:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Power down error:', error);
        reject(error);
      }
    });
  }

  /**
   * Cancel an active power down using Steem Keychain
   * @returns {Promise} Promise resolving to response object
   */
  cancelPowerDown() {
    return new Promise((resolve, reject) => {
      try {
        const username = authService.getCurrentUser()?.username;
        
        if (!username) {
          return reject(new Error('User not logged in'));
        }
        
        if (!window.steem_keychain) {
          return reject(new Error('Steem Keychain not available'));
        }
        
        // To cancel power down, set vesting_shares to 0
        const operations = [
          ["withdraw_vesting", {
            account: username,
            vesting_shares: "0.000000 VESTS" // Zero vests to cancel power down
          }]
        ];
        
        window.steem_keychain.requestBroadcast(
          username,      // Username
          operations,    // Operations array
          "Active",      // Key type required
          (response) => {
            console.log('Cancel power down response:', response);
            
            if (response.success) {
              resolve({ success: true });
            } else {
              resolve({ 
                success: false, 
                message: response.message || 'Unknown error' 
              });
            }
          }
        );
      } catch (error) {
        console.error('Cancel power down error:', error);
        reject(error);
      }
    });
  }

  /**
   * Get power down information for current user
   * @returns {Promise} Promise resolving to power down info object
   */
  async getPowerDownInfo() {
    try {
      const username = authService.getCurrentUser()?.username;
      
      if (!username) {
        throw new Error('User not logged in');
      }
      
      // Get account information
      const account = await new Promise((resolve, reject) => {
        window.steem.api.getAccounts([username], (err, accounts) => {
          if (err) reject(err);
          else if (accounts && accounts.length > 0) resolve(accounts[0]);
          else reject(new Error('Account not found'));
        });
      });
      
      // Check if powering down
      const isPoweringDown = parseFloat(account.vesting_withdraw_rate) > 0.000001;
      
      if (!isPoweringDown) {
        return {
          isPoweringDown: false,
          weeklyRate: '0.000',
          nextPowerDown: null,
          remainingWeeks: 0
        };
      }
      
      // Calculate weekly rate
      const weeklyRate = await this.vestsToSteem(account.vesting_withdraw_rate.split(' ')[0]);
      
      // Calculate next power down time
      const nextPowerDown = new Date(account.next_vesting_withdrawal + 'Z');
      
      // Calculate remaining weeks - using 4 weeks as the total duration
      // and limiting the maximum displayed remaining weeks to 4
      let remainingWeeks = 0;
      if (parseFloat(account.to_withdraw) > 0) {
        const withdrawRate = parseFloat(account.vesting_withdraw_rate);
        if (withdrawRate > 0) {
          remainingWeeks = Math.min(
            Math.ceil(parseFloat(account.to_withdraw) / withdrawRate), 
            4 // Maximum of 4 weeks
          );
        }
      }
      
      // Format the weekly rate to 3 decimal places for display
      const formattedWeeklyRate = parseFloat(weeklyRate).toFixed(3);
      
      return {
        isPoweringDown: true,
        weeklyRate: formattedWeeklyRate,
        nextPowerDown,
        remainingWeeks
      };
      
    } catch (error) {
      console.error('Error getting power down info:', error);
      return {
        isPoweringDown: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate Annual Percentage Rate (APR) based on weekly rewards and vesting shares
   * @param {number} totalWeeklyRewards - Total weekly rewards in STEEM
   * @param {number} vestingShares - Total vesting shares (VESTS)
   * @returns {Promise<number>} Promise resolving to the calculated APR percentage
   */
  async calculateAPR(totalWeeklyRewards, vestingShares) {
    try {
      // Convert vesting shares to STEEM Power
      const totalVestingSteem = await this.vestsToSteem(vestingShares);
      
      // Calculate annual rewards (52 weeks in a year)
      const annualRewards = totalWeeklyRewards * 52;
      
      // Calculate APR as percentage: (annualRewards / totalVestingSteem) * 100
      const apr = (annualRewards / totalVestingSteem) * 100;
      
      // Return APR with 2 decimal places
      return parseFloat(apr.toFixed(2));
    } catch (error) {
      console.error('Error calculating APR:', error);
      throw error;
    }
  }
  
  /**
   * Calculate curation efficiency metrics for a user over a specific time period
   * @param {string} username - Steem username to analyze
   * @param {number} daysBack - Number of days to look back (default: 7)
   * @returns {Promise<Object>} Curation statistics, efficiency data and APR
   */
  async calculateCurationEfficiency(username = null, daysBack = 7) {
    try {
      // Use provided username or current user
      const curator = username || this.currentUser;
      
      if (!curator) {
        throw new Error('No username provided');
      }
      
      // Emit event to notify UI about calculation starting
      eventEmitter.emit('curation:calculation-started', { username: curator });
      
      let allResults = [];
      let lastId = -1;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      let isWithinTimeframe = true;
      let processedCount = 0;
      
      // Set a maximum time or operation count to prevent infinite loops
      const maxOperations = 5000;
      const startTime = Date.now();
      const maxTimeMs = 30000; // 30 seconds maximum
      const batchSize = 2000; // Increased batch size for account history
      
      // Get account data for later calculations
      const account = await steemService.getUser(curator);
      if (!account) {
        throw new Error('Account not found');
      }
      
      const curatorSP = parseFloat(account.vesting_shares) - 
                        parseFloat(account.delegated_vesting_shares) + 
                        parseFloat(account.received_vesting_shares);
      
      // Continue fetching history until we get data older than the cutoff date
      while (isWithinTimeframe) {
        // Check if we've exceeded time or operation limits
        if (processedCount > maxOperations || (Date.now() - startTime) > maxTimeMs) {
          console.warn(`Stopping curation calculation: reached limits (${processedCount} operations processed)`);
          break;
        }
        
        try {
          // Get account history in larger batches
          const accountHistory = await this._getAccountHistory(curator, lastId, batchSize);
          if (!accountHistory || accountHistory.length === 0) break;
          
          // Sort by ID in descending order
          accountHistory.sort((a, b) => b[0] - a[0]);
          
          // Filter only curation rewards within timeframe
          const curationRewards = accountHistory.filter(entry => {
            const [id, operation] = entry;
            if (operation.op[0] === 'curation_reward') {
              const timestamp = new Date(operation.timestamp + 'Z');
              lastId = id - 1; // Update last ID for next batch
              return timestamp >= cutoffDate;
            }
            return false;
          });
          
          // If we have found curation rewards, process them in parallel batches
          if (curationRewards.length > 0) {
            const batchPromises = [];
            const batchSize = 10; // Process 10 operations concurrently
            
            for (let i = 0; i < curationRewards.length; i += batchSize) {
              const batch = curationRewards.slice(i, i + batchSize);
              batchPromises.push(this._processCurationBatch(batch, curator, curatorSP));
            }
            
            // Wait for all batches to complete
            const batchResults = await Promise.all(batchPromises);
            const newResults = batchResults.flat().filter(Boolean); // Remove any nulls
            
            // Add new results
            if (newResults.length > 0) {
              allResults = [...allResults, ...newResults];
              processedCount += newResults.length;
              
              // Emit progress updates in larger increments
              eventEmitter.emit('curation:calculation-progress', {
                username: curator,
                processedCount,
                latestResults: allResults
              });
            }
          }
          
          // Check if we're still within timeframe by looking at last operation
          if (lastId < 0 || accountHistory.length < batchSize) {
            // We've processed all available history
            isWithinTimeframe = false;
          } else {
            // Check last operation time
            const lastOp = accountHistory[accountHistory.length - 1];
            if (lastOp && lastOp[1]) {
              const lastTimestamp = new Date(lastOp[1].timestamp + 'Z');
              if (lastTimestamp < cutoffDate) {
                isWithinTimeframe = false;
              }
            }
          }
          
        } catch (error) {
          console.error('Error retrieving account history:', error);
          // Continue processing despite errors
        }
      }
      
      // Handle cases with no results found
      if (allResults.length === 0) {
        const noResultsMessage = `No curation rewards found for ${curator} in the last ${daysBack} days`;
        console.log(noResultsMessage);
        
        // Emit completion event with no results
        eventEmitter.emit('curation:calculation-completed', {
          success: false,
          message: noResultsMessage,
          username: curator,
          timeframe: {
            days: daysBack,
            from: cutoffDate,
            to: new Date()
          },
          summary: {
            totalVotes: 0,
            totalRewards: '0.000',
            avgEfficiency: '0.00',
            highestReward: '0.000',
            apr: '0.00'
          },
          detailedResults: []
        });
        
        return {
          success: false,
          message: noResultsMessage,
          results: []
        };
      }
      
      // Calculate total rewards and statistics
      const totalRewards = allResults.reduce((sum, result) => sum + result.rewardSP, 0);
      const avgEfficiency = allResults.reduce((sum, result) => sum + result.efficiency, 0) / allResults.length;
      const highestReward = Math.max(...allResults.map(result => result.rewardSP));
      const mostEfficientVote = allResults.reduce((best, current) => 
        (current.efficiency > best.efficiency) ? current : best, allResults[0]);
      
      // Calculate APR based on rewards and vesting shares
      let apr = 0;
      try {
        const delegatedVestingShares = parseFloat(account.delegated_vesting_shares.split(' ')[0]);
        const vestingShares = parseFloat(account.vesting_shares.split(' ')[0]);
        const receivedVestingShares = parseFloat(account.received_vesting_shares.split(' ')[0]);
        const totalVestingShares = vestingShares + receivedVestingShares - delegatedVestingShares;
        
        // Calculate APR
        apr = await this.calculateAPR(totalRewards, totalVestingShares);
      } catch (error) {
        console.warn('Error calculating APR:', error);
      }
      
      // Build result object
      const results = {
        success: true,
        username: curator,
        timeframe: {
          days: daysBack,
          from: cutoffDate,
          to: new Date()
        },
        summary: {
          totalVotes: allResults.length,
          totalRewards: totalRewards.toFixed(3),
          avgEfficiency: avgEfficiency.toFixed(2),
          highestReward: highestReward.toFixed(3),
          mostEfficientVote: {
            post: mostEfficientVote.post,
            efficiency: mostEfficientVote.efficiency.toFixed(2),
            reward: mostEfficientVote.rewardSP.toFixed(3)
          },
          apr: apr.toFixed(2)
        },
        detailedResults: allResults
      };
      
      // Emit completion event with results
      eventEmitter.emit('curation:calculation-completed', results);
      
      return results;
    } catch (error) {
      console.error('Error calculating curation efficiency:', error);
      
      // Emit error event
      eventEmitter.emit('curation:calculation-error', {
        error: error.message || 'Unknown error'
      });
      
      throw error;
    }
  }

  /**
   * Process a batch of curation rewards in parallel
   * @private
   * @param {Array} curationBatch - Array of curation reward operations
   * @param {string} curator - Username of the curator
   * @param {number} curatorSP - Curator's effective SP
   * @returns {Promise<Array>} Array of processed curation results
   */
  async _processCurationBatch(curationBatch, curator, curatorSP) {
    try {
      // Process all curation rewards in parallel
      const promises = curationBatch.map(async ([id, operation]) => {
        try {
          const opData = operation.op[1];
          
          // Extract operation data
          const comment_author = opData.comment_author || opData.author;
          const comment_permlink = opData.comment_permlink || opData.permlink;
          const reward = opData.reward;
          
          if (!comment_author || !comment_permlink || !reward) {
            return null;
          }
          
          const postIdentifier = `@${comment_author}/${comment_permlink}`;
          
          // Get post and vote details
          const { post, votes } = await this._getPostDetails(comment_author, comment_permlink);
          const curatorVote = votes.find(v => v.voter === curator);
          
          if (!curatorVote) return null;
          
          // Parse reward amount
          const reward_vests = parseFloat(reward.split(' ')[0]);
          
          // Calculate vote metrics
          const percent = curatorVote.percent / 100;
          const vote_time = new Date(curatorVote.time + 'Z');
          const created_time = new Date(post.created + 'Z');
          const voteAgeMins = Math.floor((vote_time - created_time) / (1000 * 60));
          
          // Calculate vote value
          const voteValueResult = await this.calculateVoteValue(percent, curatorSP);
          const calculatedVoteValue = voteValueResult.steemValue || 0;
          
          // Convert to STEEM Power
          const effective_reward_sp = await this.vestsToSteem(reward_vests);
          const estimated_reward = calculatedVoteValue;
          const vote_power_sp = estimated_reward * 2; // Full vote value
          
          // Calculate efficiency percentage
          const efficiency = (effective_reward_sp / estimated_reward) * 100;
          
          return {
            post: postIdentifier,
            rewardSP: effective_reward_sp,
            voteValue: vote_power_sp, 
            expectedReward: estimated_reward,
            efficiency: efficiency,
            percent: percent,
            time: curatorVote.time,
            voteAgeMins: voteAgeMins
          };
        } catch (error) {
          console.warn(`Error processing curation reward:`, error);
          return null;
        }
      });
      
      return (await Promise.all(promises)).filter(Boolean);
    } catch (error) {
      console.error('Error processing curation batch:', error);
      return [];
    }
  }

  /**
   * Helper method to get account history from Steem API
   * @private
   */
  async _getAccountHistory(username, from = -1, limit = 1000) {
    try {
      const steem = await steemService.ensureLibraryLoaded();
      
      return new Promise((resolve, reject) => {
        steem.api.getAccountHistory(username, from, limit, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    } catch (error) {
      console.error('Error loading Steem library:', error);
      throw error;
    }
  }
  
  /**
   * Helper method to get post and votes details
   * @private
   */
  async _getPostDetails(author, permlink) {
    try {
      const steem = await steemService.ensureLibraryLoaded();
      
      return new Promise((resolve, reject) => {
        steem.api.getContent(author, permlink, (err, post) => {
          if (err) reject(err);
          else {
            // Get voters on this post
            steem.api.getActiveVotes(author, permlink, (voteErr, votes) => {
              if (voteErr) reject(voteErr);
              else resolve({ post, votes });
            });
          }
        });
      });
    } catch (error) {
      console.error('Error loading Steem library:', error);
      throw error;
    }
  }

 /**
 * Calculate vote value using the official Steem formula
 * @param {number} votePercent - Vote percentage (-100 to 100)
 * @param {number} effectiveVests - User's effective vesting shares (including delegations)
 * @param {number} votingPower - Voting power (default: 10000 = 100%)
 * @returns {Promise<Object>} Estimated vote value in SBD and STEEM
 */
async calculateVoteValue(votePercent, effectiveVests = null, votingPower = 10000) {
  try {
    const steem = await steemService.ensureLibraryLoaded();
    
    // Step 1: Get dynamic global properties
    const props = await new Promise((resolve, reject) => {
      steem.api.getDynamicGlobalProperties((error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    
    // Step 2: Calculate SP/VESTS ratio
    const totalVestingFundSteem = parseFloat(props.total_vesting_fund_steem.split(' ')[0]);
    const totalVestingShares = parseFloat(props.total_vesting_shares.split(' ')[0]);
    const steemPerVests = totalVestingFundSteem / totalVestingShares;
    
    // Step 3: If no vesting shares provided, use current user's
    let vestingShares = effectiveVests;
    if (!vestingShares) {
      const account = await steemService.getUser(this.currentUser);
      if (!account) throw new Error('Unable to get account info');
      
      const accountVests = parseFloat(account.vesting_shares.split(' ')[0]);
      const delegatedOut = parseFloat(account.delegated_vesting_shares.split(' ')[0]);
      const receivedVests = parseFloat(account.received_vesting_shares.split(' ')[0]);
      vestingShares = accountVests - delegatedOut + receivedVests;
    }
    
    // Step 4: Convert vests to Steem Power
    const sp = vestingShares * steemPerVests;
    
    // Step 5: Calculate 'r' (SP/spv ratio)
    const r = sp / steemPerVests;
    
    // Step 6: Calculate 'p' (voting power)
    const weight = Math.abs(votePercent) * 100; // Convert percentage to weight (100% = 10000)
    const p = (votingPower * weight / 10000 + 49) / 50;
    
    // Step 7: Get reward fund
    const rewardFund = await new Promise((resolve, reject) => {
      steem.api.getRewardFund('post', (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    
    // Step 8: Calculate rbPrc
    const recentClaims = parseFloat(rewardFund.recent_claims);
    const rewardBalance = parseFloat(rewardFund.reward_balance.split(' ')[0]);
    const rbPrc = rewardBalance / recentClaims;
    
    // Step 9: Get median price from Steem API
    const priceInfo = await new Promise((resolve, reject) => {
      steem.api.getCurrentMedianHistoryPrice((error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    
    const baseAmount = parseFloat(priceInfo.base.split(' ')[0]);
    const quoteAmount = parseFloat(priceInfo.quote.split(' ')[0]);
    const steemToSbdRate = baseAmount / quoteAmount;
    
    // Step 10: Apply the official Steem formula
    // result = r * p * 100 * rbPrc
    const steemValue = r * p * 100 * rbPrc;
    
    // Convert STEEM to USD/SBD using the median price
    const usdValue = steemValue * steemToSbdRate;
    
    // Log calculated values for debugging
    console.log(`Vote Value Calculation:
      - SP: ${sp.toFixed(3)}
      - Vote Weight: ${weight}
      - Voting Power: ${votingPower}
      - Price ratio: ${steemToSbdRate.toFixed(4)}
      - Result: ${steemValue.toFixed(4)} STEEM ($${usdValue.toFixed(4)})`);
    
    return {
      steemValue: parseFloat(steemValue.toFixed(4)),
      sbdValue: parseFloat(usdValue.toFixed(4)),
      formula: {
        r: r,
        p: p,
        rbPrc: rbPrc,
        media: steemToSbdRate
      }
    };
  } catch (error) {
    console.error('Error calculating vote value:', error);
    return {
      steemValue: 0,
      sbdValue: 0,
      error: error.message
    };
  }
}

/**
 * Get resource credits (RC) data for a user
 * @param {string} username - The username to get RC data for
 * @returns {Promise<Object>} RC data including percentage
 */
async getResourceCredits(username) {
  try {
    const user = username || this.currentUser;
    if (!user) throw new Error('No username provided');
    
    // Fetch RC data using Steem API
    const response = await fetch('https://api.steemit.com', {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'rc_api.find_rc_accounts',
        params: { accounts: [user] },
        id: 1
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) throw new Error('Failed to fetch RC data');
    
    const data = await response.json();
    
    if (!data.result || !data.result.rc_accounts || !data.result.rc_accounts[0]) {
      throw new Error('Invalid RC data response');
    }
    
    const rcAccount = data.result.rc_accounts[0];
    const currentMana = parseInt(rcAccount.rc_manabar.current_mana);
    const maxMana = parseInt(rcAccount.max_rc); // Max mana from account
    
    // If max_rc is missing, we need to calculate it
    let maxRc = maxMana;
    if (!maxRc || maxRc === 0) {
      // Calculate max RC based on account VESTS
      const account = await steemService.getUser(user);
      if (account) {
        const vestingShares = parseFloat(account.vesting_shares);
        // Approximation - in real app you'd use a more accurate calculation
        maxRc = vestingShares * 1000000;
      }
    }
    
    // Calculate RC percentage
    const rcPercentage = Math.min(100, Math.floor((currentMana / maxRc) * 100));
    
    return {
      currentMana,
      maxMana: maxRc,
      percentage: rcPercentage
    };
  } catch (error) {
    console.error('Error fetching RC data:', error);
    return {
      currentMana: 0,
      maxMana: 0,
      percentage: 0,
      error: error.message
    };
  }
}

/**
 * Get account resource usage (voting power, RC)
 * @param {string} username - Username to get resources for
 * @returns {Promise<Object>} Resource usage data
 */
async getAccountResources(username) {
  try {
    const user = username || this.currentUser;
    if (!user) throw new Error('No username provided');
    
    const account = await steemService.getUser(user);
    if (!account) throw new Error('Account not found');
    
    // Calculate voting power
    const votingPower = this.calculateVotingPower(account);
    
    // Get RC data
    const rc = await this.getResourceCredits(user);
    
    return {
      voting: votingPower,
      rc: rc.percentage
    };
  } catch (error) {
    console.error('Error fetching account resources:', error);
    return {
      voting: 0,
      rc: 0,
      error: error.message
    };
  }
}

/**
 * Calculate current voting power based on account data
 * @param {Object} account - The account data object
 * @returns {number} Current voting power as percentage (0-100)
 */
calculateVotingPower(account) {
  // Voting Power calculation
  const lastVoteTime = new Date(account.last_vote_time + 'Z').getTime();
  const secondsPassedSinceLastVote = (new Date().getTime() - lastVoteTime) / 1000;
  const regeneratedVotingPower = secondsPassedSinceLastVote * (10000 / (5 * 24 * 60 * 60));
  const currentVotingPower = Math.min(10000, account.voting_power + regeneratedVotingPower) / 100;
    
  return Math.floor(currentVotingPower);
}

/**
 * Fetch current STEEM and SBD prices from CoinGecko API
 * @returns {Promise<Object>} Current prices in USD
 */
async getCryptoPrices() {
  try {
    // Fetch STEEM and SBD price data from CoinGecko API
    const coingeckoResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=steem,steem-dollars&vs_currencies=usd');
    
    if (!coingeckoResponse.ok) {
      throw new Error('Failed to fetch prices from CoinGecko API');
    }
    
    const coingeckoData = await coingeckoResponse.json();
    
    // Extract prices from CoinGecko response
    let steemPrice = 0;
    let sbdPrice = 1; // Default SBD price to 1 USD (as it's a stablecoin)
    
    if (coingeckoData && coingeckoData.steem && coingeckoData.steem.usd) {
      steemPrice = parseFloat(coingeckoData.steem.usd);
      console.log('Current STEEM price from CoinGecko:', steemPrice);
    }
    
    if (coingeckoData && coingeckoData['steem-dollars'] && coingeckoData['steem-dollars'].usd) {
      sbdPrice = parseFloat(coingeckoData['steem-dollars'].usd);
      console.log('Current SBD price from CoinGecko:', sbdPrice);
    }
    
    // If CoinGecko doesn't return price data, fallback to Steemit API
    if (steemPrice === 0) {
      console.warn('Could not extract STEEM price from CoinGecko API response', coingeckoData);
      
      // Fallback to Steemit API
      const fallbackResponse = await fetch('https://api.steemit.com', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'market_history_api.get_ticker',
          id: 1
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.result && fallbackData.result.latest) {
          steemPrice = parseFloat(fallbackData.result.latest);
          console.log('Using fallback STEEM price:', steemPrice);
        }
      }
    }
    
    return {
      steem: steemPrice,
      sbd: sbdPrice
    };
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    // Try fallback to Steemit API if CoinGecko API fails
    try {
      const fallbackResponse = await fetch('https://api.steemit.com', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'market_history_api.get_ticker',
          id: 1
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.result && fallbackData.result.latest) {
          const steemPrice = parseFloat(fallbackData.result.latest);
          console.log('Using fallback STEEM price after error:', steemPrice);
          return {
            steem: steemPrice,
            sbd: 1
          };
        }
      }
    } catch (fallbackError) {
      console.error('Fallback price fetch also failed:', fallbackError);
    }
    
    return {
      steem: 0,
      sbd: 1 // Default to 1 USD for SBD as it's a stablecoin
    };
  }
}

/**
 * Get user's wallet balances
 * @param {string} username - Username to get balances for
 * @returns {Promise<Object>} User's balances
 */
async getUserBalances(username) {
  try {
    const user = username || this.currentUser;
    if (!user) throw new Error('No username provided');

    // Get account data
    const account = await steemService.getUser(user);
    if (!account) throw new Error('Failed to load account data');

    // Extract balances
    const steemBalance = parseFloat(account.balance).toFixed(3);
    const sbdBalance = parseFloat(account.sbd_balance).toFixed(3);

    // Calculate STEEM Power
    const vestingShares = parseFloat(account.vesting_shares);
    const delegatedVestingShares = parseFloat(account.delegated_vesting_shares);
    const receivedVestingShares = parseFloat(account.received_vesting_shares);

    const ownVestingShares = vestingShares - delegatedVestingShares;
    const ownSteemPower = await this.vestsToSteem(ownVestingShares);
    const delegatedOutSP = await this.vestsToSteem(delegatedVestingShares);
    const delegatedInSP = await this.vestsToSteem(receivedVestingShares);

    const steemPower = await this.vestsToSteem(
        vestingShares - delegatedVestingShares + receivedVestingShares
    );

    // Fetch current prices
    const prices = await this.getCryptoPrices();

    // Calculate USD values
    const steemUsdValue = (parseFloat(steemBalance) * prices.steem).toFixed(2);
    const sbdUsdValue = (parseFloat(sbdBalance) * prices.sbd).toFixed(2);
    const spUsdValue = (parseFloat(steemPower) * prices.steem).toFixed(2);

    // Calculate total USD value
    const totalUsdValue = (
        parseFloat(steemUsdValue) + 
        parseFloat(sbdUsdValue) + 
        parseFloat(spUsdValue)
    ).toFixed(2);

    return {
        steem: steemBalance,
        sbd: sbdBalance,
        steemPower: steemPower.toFixed(3),
        steemPowerDetails: {
            total: steemPower.toFixed(3),
            own: ownSteemPower.toFixed(3),
            delegatedOut: delegatedOutSP.toFixed(3),
            delegatedIn: delegatedInSP.toFixed(3),
            effective: (ownSteemPower + delegatedInSP).toFixed(3)
        },
        prices: {
            steem: prices.steem,
            sbd: prices.sbd
        },
        usdValues: {
            steem: steemUsdValue,
            sbd: sbdUsdValue,
            steemPower: spUsdValue,
            total: totalUsdValue
        },
        account // Include the full account for advanced usage
    };
  } catch (error) {
    console.error('Error fetching user balances:', error);
    throw error;
  }
}
}

// Create and export singleton instance
const walletService = new WalletService();
export default walletService;