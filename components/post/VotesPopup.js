class VotesPopup {
  constructor(post) {
    this.post = post;
    this.isMobile = window.innerWidth < 768; // Check if device is mobile
  }

  getPendingPayout(post) {
    const pending = parseFloat(post.pending_payout_value?.split(' ')[0] || 0);
    const total = parseFloat(post.total_payout_value?.split(' ')[0] || 0);
    const curator = parseFloat(post.curator_payout_value?.split(' ')[0] || 0);
    return (pending + total + curator).toFixed(2);
  }

  show() {
    const { overlay, popup } = this.createPopupStructure();
    const content = this.createPopupContent();
    
    popup.appendChild(this.createPopupHeader(overlay, popup));
    popup.appendChild(content);
    
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
  }
  
  createPopupStructure() {
    const popup = this.createElement('div', 'votes-popup', {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'var(--background-light)',
      color: 'var(--text-color)',
      padding: this.isMobile ? 'var(--space-sm)' : 'var(--space-lg)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--popup-box-shadow)',
      zIndex: 'var(--z-modal)',
      maxHeight: '80vh',
      overflow: 'auto',
      width: this.isMobile ? '90%' : null,
      maxWidth: this.isMobile ? '100%' : '90%',
      minWidth: this.isMobile ? 'auto' : '500px'
    });
    
    const overlay = this.createElement('div', 'popup-overlay', {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 'calc(var(--z-modal) - 1)'
    });
    
    const closePopup = () => {
      document.body.removeChild(overlay);
      document.body.removeChild(popup);
    };
    
    overlay.addEventListener('click', closePopup);
    
    return { overlay, popup, closePopup };
  }
  
  createPopupHeader(overlay, popup) {
    const header = this.createElement('div', 'votes-popup-header', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid var(--border-color)',
      paddingBottom: 'var(--space-sm)',
      marginBottom: 'var(--space-md)'
    });
    
    const title = this.createElement('h3', '', {
      color: 'var(--text-heading)',
      margin: 'var(--space-sm) 0'
    });
    title.textContent = 'Vote Details';
    
    const closeBtn = this.createElement('button', 'close-popup-btn', {
      backgroundColor: 'var(--background-lighter)',
      color: 'var(--text-color)',
      border: 'none',
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
      padding: 'var(--space-xs) var(--space-sm)',
      fontSize: '1.5rem'
    });
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      document.body.removeChild(popup);
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    return header;
  }
  
  createPopupContent() {
    const content = this.createElement('div', 'votes-popup-content');
    
    if (!this.post.active_votes || this.post.active_votes.length === 0) {
      content.appendChild(this.createNoVotesMessage());
      return content;
    }
    
    const totalPayoutValue = this.getPendingPayout(this.post);
    const totalVotingPower = this.calculateTotalVotingPower();
    const votesList = this.createVotesList(totalPayoutValue, totalVotingPower);
    
    content.appendChild(votesList);
    return content;
  }
  
  createNoVotesMessage() {
    return this.createElement('p', 'no-votes', {
      color: 'var(--text-muted)',
      textAlign: 'center',
      padding: 'var(--space-md)'
    }, 'No votes on this post yet.');
  }
  
  calculateTotalVotingPower() {
    return this.post.active_votes.reduce((sum, vote) => {
      return sum + Math.abs(vote.percent);
    }, 0);
  }
  
  createVotesList(totalPayoutValue, totalVotingPower) {
    const votesList = this.createElement('ul', 'votes-list', {
      listStyle: 'none',
      padding: '0',
      margin: '0'
    });
    
    const sortedVotes = [...this.post.active_votes].sort((a, b) => 
      Math.abs(b.percent) - Math.abs(a.percent)
    );
    
    sortedVotes.forEach(vote => {
      votesList.appendChild(this.createVoteItem(vote, totalPayoutValue, totalVotingPower));
    });
    
    votesList.appendChild(this.createSummaryItem(totalPayoutValue));
    
    return votesList;
  }
  
  createVoteItem(vote, totalPayoutValue, totalVotingPower) {
    const voteItem = this.createElement('li', 'vote-item', {
      display: 'flex',
      flexWrap: this.isMobile ? 'wrap' : 'nowrap',
      justifyContent: 'space-between',
      alignItems: this.isMobile ? 'flex-start' : 'center',
      padding: this.isMobile ? 'var(--space-xs)' : 'var(--space-sm)',
      borderBottom: '1px solid var(--border-color)',
      transition: 'var(--transition-fast)'
    });
    
    const percentage = (vote.percent / 100).toFixed(2);
    const voteValue = this.calculateVoteValue(vote.percent, totalVotingPower, totalPayoutValue);
    const formattedValue = voteValue.toFixed(3);
    
    const voterWrapper = this.createVoterWrapper(vote.voter);
    
    if (this.isMobile) {
      const infoTimeRow = this.createMobileInfoTimeRow(percentage, formattedValue, vote);
      voteItem.appendChild(voterWrapper);
      voteItem.appendChild(infoTimeRow);
    } else {
      const voteInfoWrapper = this.createVoteInfoWrapper(percentage, formattedValue, false);
      const timeWrapper = this.createTimeWrapper(vote.time, false);
      
      voteItem.appendChild(voterWrapper);
      voteItem.appendChild(voteInfoWrapper);
      voteItem.appendChild(timeWrapper);
    }
    
    this.addHoverEffect(voteItem);
    
    return voteItem;
  }
  
  createVoterWrapper(voter) {
    const voterWrapper = this.createElement('div', '', {
      display: 'flex',
      alignItems: 'center',
      flex: '1',
      minWidth: this.isMobile ? '100%' : 'auto',
      marginBottom: this.isMobile ? 'var(--space-xs)' : null
    });
    
    const avatarWrapper = this.createElement('div', '', {
      marginRight: 'var(--space-sm)'
    });
    
    const avatar = this.createElement('img', 'voter-avatar', {
      width: this.isMobile ? '24px' : '32px',
      height: this.isMobile ? '24px' : '32px',
      borderRadius: 'var(--radius-pill)',
      border: '2px solid var(--primary-color)',
      objectFit: 'cover',
      backgroundColor: 'var(--background-lighter)'
    });
    
    avatar.src = `https://steemitimages.com/u/${voter}/avatar`;
    avatar.alt = `${voter}'s avatar`;
    avatar.onerror = function() {
      this.src = 'https://steemitimages.com/u/default/avatar';
      this.onerror = null;
    };
    
    const voterName = this.createElement('span', 'voter-name', {
      color: 'var(--primary-color)',
      fontWeight: 'bold',
      textDecoration: 'none',
      cursor: 'pointer'
    }, voter);
    
    this.addProfileLinkBehavior(voterName, voter);
    
    avatarWrapper.appendChild(avatar);
    voterWrapper.appendChild(avatarWrapper);
    voterWrapper.appendChild(voterName);
    
    return voterWrapper;
  }
  
  addProfileLinkBehavior(element, username) {
    element.addEventListener('click', () => {
      window.open(`/profile/@${username}`, '_self');
    });
    
    element.addEventListener('mouseover', () => {
      element.style.textDecoration = 'underline';
    });
    
    element.addEventListener('mouseout', () => {
      element.style.textDecoration = 'none';
    });
  }
  
  createVoteInfoWrapper(percentage, formattedValue, isMobile) {
    const voteInfoWrapper = this.createElement('div', '', {
      display: 'flex',
      flexDirection: isMobile ? 'row' : 'column',
      alignItems: isMobile ? 'center' : 'flex-end',
      justifyContent: isMobile ? 'flex-start' : 'center',
      minWidth: isMobile ? 'auto' : '100px',
      marginRight: isMobile ? 'var(--space-md)' : '0'
    });
    
    const isPositive = parseFloat(percentage) >= 0;
    const votePercentage = this.createElement('span', 'vote-percentage', {
      color: isPositive ? 'var(--secondary-color)' : 'var(--text-muted)'
    }, `${percentage}%`);
    
    const voteValueElem = this.createElement('span', 'vote-value', {
      color: 'var(--primary-light)',
      fontSize: '0.85em',
      marginLeft: isMobile ? 'var(--space-sm)' : null
    }, `${formattedValue} USD`);
    
    voteInfoWrapper.appendChild(votePercentage);
    voteInfoWrapper.appendChild(voteValueElem);
    
    return voteInfoWrapper;
  }
  
  createTimeWrapper(voteTime, isMobile) {
    const timeWrapper = this.createElement('div', '', {
      minWidth: isMobile ? 'auto' : '140px',
      textAlign: isMobile ? 'left' : 'right',
      paddingLeft: isMobile ? '0' : 'var(--space-md)',
      fontSize: isMobile ? '0.8em' : null,
      color: isMobile ? 'var(--text-muted)' : null
    });
    
    const voteDate = new Date(voteTime);
    const formattedDate = isMobile ? 
      this.formatDateForMobile(voteDate) : 
      voteDate.toLocaleString();
    
    const timeElement = this.createElement('span', 'vote-time', {
      color: 'var(--text-secondary)',
      fontSize: isMobile ? '0.9em' : '0.9em'
    }, formattedDate);
    
    timeWrapper.appendChild(timeElement);
    return timeWrapper;
  }
  
  createMobileInfoTimeRow(percentage, formattedValue, vote) {
    const infoTimeRow = this.createElement('div', '', {
      display: 'flex',
      width: '100%',
      justifyContent: 'space-between',
      alignItems: 'center'
    });
    
    const voteInfoWrapper = this.createVoteInfoWrapper(percentage, formattedValue, true);
    const timeWrapper = this.createTimeWrapper(vote.time, true);
    
    infoTimeRow.appendChild(voteInfoWrapper);
    infoTimeRow.appendChild(timeWrapper);
    
    return infoTimeRow;
  }
  
  createSummaryItem(totalPayoutValue) {
    const summaryItem = this.createElement('li', 'vote-summary', {
      padding: this.isMobile ? 'var(--space-sm)' : 'var(--space-md)',
      display: 'flex',
      justifyContent: 'space-between',
      borderTop: '2px solid var(--border-color)',
      marginTop: 'var(--space-sm)',
      fontWeight: 'bold'
    });
    
    const summaryLabel = this.createElement('span', '', {
      color: 'var(--text-heading)'
    }, 'Total Payout:');
    
    const summaryValue = this.createElement('span', '', {
      color: 'var(--primary-color)'
    }, `${totalPayoutValue} USD`);
    
    summaryItem.appendChild(summaryLabel);
    summaryItem.appendChild(summaryValue);
    
    return summaryItem;
  }
  
  calculateVoteValue(votePercent, totalVotingPower, totalPayoutValue) {
    if (totalVotingPower <= 0) {
      return 0;
    }
    return (Math.abs(votePercent) / totalVotingPower) * totalPayoutValue;
  }
  
  addHoverEffect(element) {
    element.addEventListener('mouseover', () => {
      element.style.backgroundColor = 'var(--background-lighter)';
    });
    
    element.addEventListener('mouseout', () => {
      element.style.backgroundColor = 'transparent';
    });
  }
  
  createElement(tagName, className = '', styles = {}, textContent = '') {
    const element = document.createElement(tagName);
    
    if (className) {
      element.className = className;
    }
    
    Object.entries(styles).forEach(([property, value]) => {
      if (value !== null) {
        element.style[property] = value;
      }
    });
    
    if (textContent) {
      element.textContent = textContent;
    }
    
    return element;
  }
  
  // New helper method to format dates on mobile
  formatDateForMobile(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) {
      return `${diffSecs}s ago`;
    }
    
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
      return `${diffDays}d ago`;
    }
    
    // For older dates, show the date in short format
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
}

export default VotesPopup;
