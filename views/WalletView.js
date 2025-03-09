import View from './View.js';
import authService from '../services/AuthService.js';
import walletService from '../services/WalletService.js';
import eventEmitter from '../utils/EventEmitter.js';

class WalletView extends View {
  constructor(element, params) {
    super(element, params);
    this.title = 'Wallet | SteemGram';
    this.currentUser = authService.getCurrentUser()?.username;
    
    // Bind methods
    this.handleBalanceUpdate = this.handleBalanceUpdate.bind(this);
    this.handleTransferSubmit = this.handleTransferSubmit.bind(this);
    this.handlePowerUpSubmit = this.handlePowerUpSubmit.bind(this);
    this.handleDelegateSubmit = this.handleDelegateSubmit.bind(this);
    this.showTabContent = this.showTabContent.bind(this);
    
    // Subscribe to events (using the parent class method)
    this.subscribe('wallet:balances-updated', this.handleBalanceUpdate);
  }
  
  // Override the render method from parent class
  async render() {
    if (!this.currentUser) {
      this.renderLoginPrompt();
      return this.element;
    }
    
    this.renderWalletInterface();
    
    // Initialize data
    walletService.updateBalances();
    this.loadDelegations();
    this.loadTransactionHistory();
    this.loadRewards();
    this.loadPowerDownInfo();
    
    // Detect keychain
    this.detectKeychain();
    
    // Add event listeners
    this.attachEventListeners();
    
    return this.element;
  }
  
  renderLoginPrompt() {
    this.element.innerHTML = `
      <div class="content-card">
        <div class="login-prompt">
          <h2>Wallet Access</h2>
          <p>You need to log in to access your wallet.</p>
          <a href="/login?returnUrl=/wallet" class="btn btn-primary">Login</a>
        </div>
      </div>
    `;
  }
  
  renderWalletInterface() {
    this.element.innerHTML = `
      <h1 class="page-title">Wallet</h1>
      
      <div class="wallet-tabs">
        <button class="tab-button active" data-tab="dashboard">Dashboard</button>
        <button class="tab-button" data-tab="history">Transaction History</button>
      </div>
      
      <div id="dashboard-tab" class="tab-content active">
        <div class="wallet-content-grid">
          <div class="wallet-left-column">
            <div class="content-card">
              <h2 class="card-title">Balances</h2>
              
              <div class="balances-grid">
                <div class="balance-card">
                  <div class="balance-icon">
                    <span class="material-icons">account_balance_wallet</span>
                  </div>
                  <div class="balance-details">
                    <h3>STEEM</h3>
                    <div id="steem-balance" class="balance-amount">Loading...</div>
                  </div>
                </div>
                
                <div class="balance-card">
                  <div class="balance-icon">
                    <span class="material-icons">power</span>
                  </div>
                  <div class="balance-details">
                    <h3>STEEM POWER</h3>
                    <div id="steem-power-balance" class="balance-amount">Loading...</div>
                  </div>
                </div>
                
                <div class="balance-card">
                  <div class="balance-icon">
                    <span class="material-icons">monetization_on</span>
                  </div>
                  <div class="balance-details">
                    <h3>SBD</h3>
                    <div id="sbd-balance" class="balance-amount">Loading...</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="content-card rewards-card">
              <h2 class="card-title">Pending Rewards</h2>
              <div class="rewards-content">
                <div class="rewards-loading">Loading rewards...</div>
                <div class="rewards-data hidden">
                  <div class="rewards-grid">
                    <div class="reward-item">
                      <div class="reward-label">STEEM</div>
                      <div class="reward-value" id="reward-steem">0.000</div>
                    </div>
                    <div class="reward-item">
                      <div class="reward-label">SBD</div>
                      <div class="reward-value" id="reward-sbd">0.000</div>
                    </div>
                    <div class="reward-item">
                      <div class="reward-label">STEEM POWER</div>
                      <div class="reward-value" id="reward-sp">0.000</div>
                    </div>
                  </div>
                  <button id="claim-rewards-btn" class="btn btn-success btn-claim-rewards">Claim Rewards</button>
                </div>
                <div class="no-rewards hidden">
                  <p>No pending rewards available to claim</p>
                </div>
              </div>
            </div>
            
            <div class="content-card">
              <h2 class="card-title">Delegations</h2>
              <div class="delegations-container">
                <table class="delegations-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Amount (SP)</th>
                    </tr>
                  </thead>
                  <tbody id="delegations-list">
                    <tr>
                      <td colspan="2" class="loading-cell">Loading delegations...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="content-card power-down-card">
              <h2 class="card-title">Power Down Status</h2>
              <div class="power-down-content">
                <div class="power-down-loading">Loading power down info...</div>
                <div class="power-down-inactive hidden">
                  <p>You are not currently powering down.</p>
                  <div class="power-down-actions">
                    <button id="start-power-down-btn" class="btn btn-secondary">Start Power Down</button>
                  </div>
                </div>
                <div class="power-down-active hidden">
                  <div class="power-down-details">
                    <div class="detail-item">
                      <div class="detail-label">Weekly Rate:</div>
                      <div class="detail-value" id="power-down-rate">0.000 SP</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">Next Power Down:</div>
                      <div class="detail-value" id="power-down-next">-</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">Remaining:</div>
                      <div class="detail-value" id="power-down-remaining">-</div>
                    </div>
                  </div>
                  <div class="power-down-actions">
                    <button id="cancel-power-down-btn" class="btn btn-danger">Cancel Power Down</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="wallet-right-column">
            <div class="content-card">
              <h2 class="card-title">Transfer STEEM</h2>
              <form id="transfer-form" class="wallet-form">
                <div class="form-group">
                  <label for="recipient">Recipient</label>
                  <div class="input-with-icon">
                    <span class="material-icons">person</span>
                    <input type="text" id="recipient" placeholder="Username" required>
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="amount">Amount</label>
                  <div class="input-with-icon">
                    <span class="material-icons">toll</span>
                    <input type="number" id="amount" step="0.001" min="0.001" placeholder="0.000" required>
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="memo">Memo (optional)</label>
                  <div class="input-with-icon">
                    <span class="material-icons">message</span>
                    <input type="text" id="memo" placeholder="Add a memo">
                  </div>
                </div>
                
                <button type="submit" class="btn btn-primary">Send STEEM</button>
                <div id="transfer-message" class="form-message"></div>
              </form>
            </div>
            
            <div class="content-card">
              <h2 class="card-title">Power Up STEEM</h2>
              <form id="power-up-form" class="wallet-form">
                <div class="form-group">
                  <label for="power-amount">Amount to Power Up</label>
                  <div class="input-with-icon">
                    <span class="material-icons">power</span>
                    <input type="number" id="power-amount" step="0.001" min="0.001" placeholder="0.000" required>
                  </div>
                </div>
                
                <button type="submit" class="btn btn-primary">Power Up</button>
                <div id="power-up-message" class="form-message"></div>
              </form>
            </div>
            
            <div class="content-card">
              <h2 class="card-title">Delegate STEEM POWER</h2>
              <form id="delegate-form" class="wallet-form">
                <div class="form-group">
                  <label for="delegatee">Recipient Username</label>
                  <div class="input-with-icon">
                    <span class="material-icons">person</span>
                    <input type="text" id="delegatee" placeholder="Username" required>
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="delegate-amount">Steem Power Amount</label>
                  <div class="input-with-icon">
                    <span class="material-icons">toll</span>
                    <input type="number" id="delegate-amount" step="0.001" min="0.001" placeholder="0.000" required>
                  </div>
                </div>
                
                <button type="submit" class="btn btn-primary">Delegate</button>
                <div id="delegate-message" class="form-message"></div>
              </form>
            </div>
            
            <div class="content-card">
              <h2 class="card-title">Transfer SBD</h2>
              <form id="sbd-transfer-form" class="wallet-form">
                <div class="form-group">
                  <label for="sbd-recipient">Recipient</label>
                  <div class="input-with-icon">
                    <span class="material-icons">person</span>
                    <input type="text" id="sbd-recipient" placeholder="Username" required>
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="sbd-amount">Amount</label>
                  <div class="input-with-icon">
                    <span class="material-icons">toll</span>
                    <input type="number" id="sbd-amount" step="0.001" min="0.001" placeholder="0.000" required>
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="sbd-memo">Memo (optional)</label>
                  <div class="input-with-icon">
                    <span class="material-icons">message</span>
                    <input type="text" id="sbd-memo" placeholder="Add a memo">
                  </div>
                </div>
                
                <button type="submit" class="btn btn-primary">Send SBD</button>
                <div id="sbd-transfer-message" class="form-message"></div>
              </form>
            </div>
            
            <div id="keychain-message" class="keychain-warning hidden">
              <div class="warning-icon">
                <span class="material-icons">warning</span>
              </div>
              <div class="warning-content">
                <h3>Steem Keychain Not Detected</h3>
                <p>Keychain extension is needed for wallet operations. <a href="https://chrome.google.com/webstore/detail/steem-keychain/jhgnbkkipaallpehbohjmkbjofjdmeid" target="_blank">Install now</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div id="history-tab" class="tab-content">
        <div class="content-card">
          <h2 class="card-title">Transaction History</h2>
          <div id="transaction-history" class="transaction-list">
            <div class="loading">Loading transactions...</div>
          </div>
        </div>
      </div>
    `;
  }
  
  attachEventListeners() {
    // Tab switching
    const tabButtons = this.element.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        this.showTabContent(tabName);
      });
    });
    
    // Form submissions
    const transferForm = this.element.querySelector('#transfer-form');
    if (transferForm) {
      transferForm.addEventListener('submit', this.handleTransferSubmit);
    }
    
    const powerUpForm = this.element.querySelector('#power-up-form');
    if (powerUpForm) {
      powerUpForm.addEventListener('submit', this.handlePowerUpSubmit);
    }
    
    const delegateForm = this.element.querySelector('#delegate-form');
    if (delegateForm) {
      delegateForm.addEventListener('submit', this.handleDelegateSubmit);
    }
    
    // Add SBD transfer form handler
    const sbdTransferForm = this.element.querySelector('#sbd-transfer-form');
    if (sbdTransferForm) {
      sbdTransferForm.addEventListener('submit', this.handleSBDTransferSubmit.bind(this));
    }
    
    // Claim rewards button
    const claimRewardsBtn = this.element.querySelector('#claim-rewards-btn');
    if (claimRewardsBtn) {
      claimRewardsBtn.addEventListener('click', this.handleClaimRewards.bind(this));
    }
    
    // Power down buttons
    const startPowerDownBtn = this.element.querySelector('#start-power-down-btn');
    if (startPowerDownBtn) {
      startPowerDownBtn.addEventListener('click', this.handleStartPowerDown.bind(this));
    }
    
    const cancelPowerDownBtn = this.element.querySelector('#cancel-power-down-btn');
    if (cancelPowerDownBtn) {
      cancelPowerDownBtn.addEventListener('click', this.handleCancelPowerDown.bind(this));
    }
  }
  
  showTabContent(tabName) {
    // Update button states
    const tabButtons = this.element.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.classList.toggle('active', button.getAttribute('data-tab') === tabName);
    });
    
    // Show selected tab content
    const tabContents = this.element.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    // Load data for the selected tab
    if (tabName === 'history') {
      this.loadTransactionHistory();
    }
  }
  
  detectKeychain() {
    const keychainWarning = this.element.querySelector('#keychain-message');
    if (!keychainWarning) return;
    
    // Check if keychain is available
    if (typeof window.steem_keychain === 'undefined') {
      keychainWarning.classList.remove('hidden');
    } else {
      keychainWarning.classList.add('hidden');
    }
  }
  
  handleBalanceUpdate(balances) {
    // Update the balance displays
    const steemBalanceEl = this.element.querySelector('#steem-balance');
    const steemPowerBalanceEl = this.element.querySelector('#steem-power-balance');
    const sbdBalanceEl = this.element.querySelector('#sbd-balance');
    
    if (steemBalanceEl) steemBalanceEl.textContent = `${balances.steem} STEEM`;
    if (steemPowerBalanceEl) steemPowerBalanceEl.textContent = `${balances.steemPower} SP`;
    if (sbdBalanceEl) sbdBalanceEl.textContent = `${balances.sbd} SBD`;
  }
  
  async loadDelegations() {
    const delegationsList = this.element.querySelector('#delegations-list');
    if (!delegationsList) return;
    
    try {
      const delegations = await walletService.getDelegations();
      
      if (delegations.length === 0) {
        delegationsList.innerHTML = `
          <tr>
            <td colspan="2" class="empty-cell">No active delegations</td>
          </tr>
        `;
        return;
      }
      
      let html = '';
      delegations.forEach(delegation => {
        html += `
          <tr>
            <td>@${delegation.delegatee}</td>
            <td>${delegation.steem_power} SP</td>
          </tr>
        `;
      });
      
      delegationsList.innerHTML = html;
    } catch (error) {
      delegationsList.innerHTML = `
        <tr>
          <td colspan="2" class="error-cell">Failed to load delegations</td>
        </tr>
      `;
      console.error('Error loading delegations:', error);
    }
  }
  
  async loadTransactionHistory() {
    const historyContainer = this.element.querySelector('#transaction-history');
    if (!historyContainer || !this.element.querySelector('#history-tab').classList.contains('active')) return;
    
    try {
      const transactions = await walletService.getTransactionHistory(20);
      
      if (transactions.length === 0) {
        historyContainer.innerHTML = '<div class="empty-state">No transactions found</div>';
        return;
      }
      
      let html = '<ul class="transaction-list">';
      transactions.forEach(([id, transaction]) => {
        const op = transaction.op;
        const type = op[0];
        const data = op[1];
        const timestamp = new Date(transaction.timestamp + 'Z').toLocaleString();
        
        html += `
          <li class="transaction-item">
            <div class="transaction-icon ${type}">
              ${this.getTransactionIcon(type)}
            </div>
            <div class="transaction-details">
              <div class="transaction-title">${this.formatTransactionType(type)}</div>
              <div class="transaction-meta">
                <span class="transaction-date">${timestamp}</span>
                <span class="transaction-memo">${this.formatTransactionData(type, data)}</span>
              </div>
            </div>
          </li>
        `;
      });
      html += '</ul>';
      
      historyContainer.innerHTML = html;
    } catch (error) {
      historyContainer.innerHTML = '<div class="error-state">Failed to load transactions</div>';
      console.error('Error loading transaction history:', error);
    }
  }
  
  getTransactionIcon(type) {
    let icon = 'receipt_long';
    
    switch (type) {
      case 'transfer':
        icon = 'swap_horiz';
        break;
      case 'vote':
        icon = 'thumb_up';
        break;
      case 'comment':
        icon = 'comment';
        break;
      case 'claim_reward_balance':
        icon = 'redeem';
        break;
      case 'account_update':
        icon = 'manage_accounts';
        break;
      case 'custom_json':
        icon = 'code';
        break;
      case 'delegate_vesting_shares':
        icon = 'share';
        break;
    }
    
    return `<span class="material-icons">${icon}</span>`;
  }
  
  formatTransactionType(type) {
    // Convert snake_case to Title Case
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  formatTransactionData(type, data) {
    switch (type) {
      case 'transfer':
        return `${data.amount} from @${data.from} to @${data.to}`;
      case 'vote':
        return `@${data.voter} voted on @${data.author}'s post`;
      case 'comment':
        return `@${data.author} ${data.parent_author ? 'replied to @' + data.parent_author : 'posted'}`;
      case 'delegate_vesting_shares':
        return `@${data.delegator} delegated ${data.vesting_shares} to @${data.delegatee}`;
      default:
        return JSON.stringify(data).substring(0, 100) + '...';
    }
  }
  
  async handleTransferSubmit(event) {
    event.preventDefault();
    
    const recipientEl = this.element.querySelector('#recipient');
    const amountEl = this.element.querySelector('#amount');
    const memoEl = this.element.querySelector('#memo');
    const messageEl = this.element.querySelector('#transfer-message');
    
    const recipient = recipientEl.value;
    const amount = amountEl.value;
    const memo = memoEl.value;
    
    messageEl.textContent = 'Processing transfer...';
    messageEl.className = 'form-message info';
    
    try {
      await walletService.transferSteem(recipient, amount, memo);
      
      messageEl.textContent = `Successfully transferred ${amount} STEEM to @${recipient}`;
      messageEl.className = 'form-message success';
      
      // Reset form and update balances
      recipientEl.value = '';
      amountEl.value = '';
      memoEl.value = '';
      
      walletService.updateBalances();
      
    } catch (error) {
      messageEl.textContent = `Transfer failed: ${error.message}`;
      messageEl.className = 'form-message error';
    }
  }
  
  async handlePowerUpSubmit(event) {
    event.preventDefault();
    
    const amountEl = this.element.querySelector('#power-amount');
    const messageEl = this.element.querySelector('#power-up-message');
    
    const amount = amountEl.value;
    
    messageEl.textContent = 'Processing power up...';
    messageEl.className = 'form-message info';
    
    try {
      await walletService.powerUp(amount);
      
      messageEl.textContent = `Successfully powered up ${amount} STEEM`;
      messageEl.className = 'form-message success';
      
      // Reset form and update balances
      amountEl.value = '';
      
      walletService.updateBalances();
      
    } catch (error) {
      messageEl.textContent = `Power up failed: ${error.message}`;
      messageEl.className = 'form-message error';
    }
  }
  
  async handleDelegateSubmit(event) {
    event.preventDefault();
    
    const delegateeEl = this.element.querySelector('#delegatee');
    const amountEl = this.element.querySelector('#delegate-amount');
    const messageEl = this.element.querySelector('#delegate-message');
    
    const delegatee = delegateeEl.value;
    const amount = amountEl.value;
    
    messageEl.textContent = 'Processing delegation...';
    messageEl.className = 'form-message info';
    
    try {
      await walletService.delegateSteemPower(delegatee, amount);
      
      messageEl.textContent = `Successfully delegated ${amount} SP to @${delegatee}`;
      messageEl.className = 'form-message success';
      
      // Reset form and update balances
      delegateeEl.value = '';
      amountEl.value = '';
      
      walletService.updateBalances();
      this.loadDelegations();
      
    } catch (error) {
      messageEl.textContent = `Delegation failed: ${error.message}`;
      messageEl.className = 'form-message error';
    }
  }
  
  async handleSBDTransferSubmit(event) {
    event.preventDefault();
    
    const recipientEl = this.element.querySelector('#sbd-recipient');
    const amountEl = this.element.querySelector('#sbd-amount');
    const memoEl = this.element.querySelector('#sbd-memo');
    const messageEl = this.element.querySelector('#sbd-transfer-message');
    
    const recipient = recipientEl.value;
    const amount = amountEl.value;
    const memo = memoEl.value;
    
    messageEl.textContent = 'Processing transfer...';
    messageEl.className = 'form-message info';
    
    try {
      await walletService.transferSBD(recipient, amount, memo);
      
      messageEl.textContent = `Successfully transferred ${amount} SBD to @${recipient}`;
      messageEl.className = 'form-message success';
      
      // Reset form and update balances
      recipientEl.value = '';
      amountEl.value = '';
      memoEl.value = '';
      
      walletService.updateBalances();
      
    } catch (error) {
      messageEl.textContent = `Transfer failed: ${error.message}`;
      messageEl.className = 'form-message error';
    }
  }
  
  async handleClaimRewards() {
    const rewardsData = this.element.querySelector('.rewards-data');
    const claimBtn = this.element.querySelector('#claim-rewards-btn');
    
    if (!rewardsData || !claimBtn) return;
    
    // Add loading state
    claimBtn.disabled = true;
    claimBtn.textContent = 'Claiming...';
    
    try {
      await walletService.claimRewards();
      
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.className = 'success-message';
      successMessage.textContent = 'Rewards claimed successfully!';
      rewardsData.appendChild(successMessage);
      
      // Reset button
      claimBtn.textContent = 'Claimed';
      
      // Refresh data
      setTimeout(() => {
        walletService.updateBalances();
        this.loadRewards();
      }, 3000);
      
    } catch (error) {
      console.error('Error claiming rewards:', error);
      
      // Show error message
      const errorMessage = document.createElement('div');
      errorMessage.className = 'error-message';
      errorMessage.textContent = `Failed to claim rewards: ${error.message}`;
      rewardsData.appendChild(errorMessage);
      
      // Reset button
      claimBtn.disabled = false;
      claimBtn.textContent = 'Claim Rewards';
    }
  }
  
  async handleStartPowerDown() {
    // Show power down dialog
    const dialogHTML = `
      <div class="power-down-dialog">
        <h3>Start Power Down</h3>
        <p>Enter the amount of STEEM POWER to power down:</p>
        <form id="power-down-form">
          <div class="form-group">
            <label for="power-down-amount">Amount (SP)</label>
            <input type="number" id="power-down-amount" min="0.001" step="0.001" required>
            <small>Available: ${walletService.balances.steemPower} SP</small>
          </div>
          <div class="power-down-info">
            <p>Power downs occur over 13 weeks. You will receive approximately 1/13 of the total amount each week.</p>
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" id="cancel-dialog-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">Start Power Down</button>
          </div>
        </form>
      </div>
    `;
    
    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = dialogHTML;
    document.body.appendChild(dialog);
    
    // Focus input when dialog opens
    setTimeout(() => {
      dialog.querySelector('#power-down-amount').focus();
    }, 100);
    
    // Handle form submission
    const form = dialog.querySelector('#power-down-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const amount = form.querySelector('#power-down-amount').value;
      
      try {
        await walletService.powerDown(amount);
        
        // Close dialog and show success message
        document.body.removeChild(dialog);
        
        // Show toast notification
        this.showToast('Power down started successfully!', 'success');
        
        // Update power down info
        setTimeout(() => {
          this.loadPowerDownInfo();
          walletService.updateBalances();
        }, 3000);
        
      } catch (error) {
        console.error('Error starting power down:', error);
        
        // Show error in dialog
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.textContent = `Failed to start power down: ${error.message}`;
        form.prepend(errorMsg);
      }
    });
    
    // Handle cancel button
    dialog.querySelector('#cancel-dialog-btn').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
  }
  
  async handleCancelPowerDown() {
    if (!confirm('Are you sure you want to cancel your power down?')) return;
    
    try {
      await walletService.cancelPowerDown();
      
      // Show success message
      this.showToast('Power down canceled successfully!', 'success');
      
      // Update power down info
      setTimeout(() => {
        this.loadPowerDownInfo();
        walletService.updateBalances();
      }, 3000);
      
    } catch (error) {
      console.error('Error canceling power down:', error);
      this.showToast(`Failed to cancel power down: ${error.message}`, 'error');
    }
  }
  
  showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentNode) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    });
    
    toast.appendChild(closeBtn);
    toastContainer.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentNode) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }
  
  async loadRewards() {
    const rewardsLoading = this.element.querySelector('.rewards-loading');
    const rewardsData = this.element.querySelector('.rewards-data');
    const noRewards = this.element.querySelector('.no-rewards');
    
    if (!rewardsLoading || !rewardsData || !noRewards) return;
    
    try {
      const rewards = await walletService.getAvailableRewards();
      
      // Update rewards values
      this.element.querySelector('#reward-steem').textContent = rewards.steem;
      this.element.querySelector('#reward-sbd').textContent = rewards.sbd;
      this.element.querySelector('#reward-sp').textContent = rewards.sp;
      
      // Show appropriate section
      rewardsLoading.classList.add('hidden');
      
      if (parseFloat(rewards.steem) > 0 || parseFloat(rewards.sbd) > 0 || parseFloat(rewards.sp) > 0) {
        rewardsData.classList.remove('hidden');
        noRewards.classList.add('hidden');
      } else {
        rewardsData.classList.add('hidden');
        noRewards.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error loading rewards:', error);
      rewardsLoading.classList.add('hidden');
      rewardsData.classList.add('hidden');
      noRewards.classList.remove('hidden');
      noRewards.innerHTML = '<p class="error-text">Error loading rewards</p>';
    }
  }
  
  async loadPowerDownInfo() {
    const powerDownLoading = this.element.querySelector('.power-down-loading');
    const powerDownActive = this.element.querySelector('.power-down-active');
    const powerDownInactive = this.element.querySelector('.power-down-inactive');
    
    if (!powerDownLoading || !powerDownActive || !powerDownInactive) return;
    
    try {
      const powerDownInfo = await walletService.getPowerDownInfo();
      
      powerDownLoading.classList.add('hidden');
      
      if (powerDownInfo && powerDownInfo.isPoweringDown) {
        // User is powering down - show active state
        powerDownActive.classList.remove('hidden');
        powerDownInactive.classList.add('hidden');
        
        // Update power down details
        this.element.querySelector('#power-down-rate').textContent = `${powerDownInfo.weeklyRate} SP`;
        this.element.querySelector('#power-down-next').textContent = new Date(powerDownInfo.nextPowerDown).toLocaleDateString();
        this.element.querySelector('#power-down-remaining').textContent = `${powerDownInfo.remainingWeeks} weeks`;
      } else {
        // User is not powering down - show inactive state
        powerDownActive.classList.add('hidden');
        powerDownInactive.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error loading power down info:', error);
      powerDownLoading.classList.add('hidden');
      powerDownActive.classList.add('hidden');
      powerDownInactive.classList.remove('hidden');
      powerDownInactive.innerHTML = '<p class="error-text">Error loading power down info</p>';
    }
  }
  
  // Cleanup when view is destroyed
  destroy() {
    eventEmitter.off('wallet:balances-updated', this.handleBalanceUpdate);
  }
  
  // Override the unmount method
  unmount() {
    // Unsubscribe from events (using the parent class functionality)
    super.unmount();
  }
}

export default WalletView;