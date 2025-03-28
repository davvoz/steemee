import VotesPopup from './VotesPopup.js';

class PostActions {
  constructor(post, upvoteCallback, commentCallback, shareCallback) {
    this.post = post;
    this.upvoteCallback = upvoteCallback;
    this.commentCallback = commentCallback;
    this.shareCallback = shareCallback;
  }

  render() {
    const postActions = document.createElement('div');
    postActions.className = 'post-actions';

    const upvoteBtn = this.createActionButton('upvote-btn', 'thumb_up', this.post.net_votes || 0);
    const commentBtn = this.createActionButton('comment-btn', 'chat', this.post.children || 0);
    const shareBtn = this.createActionButton('share-btn', 'share', 'Share');
    // Add new vote details button
    const votesDetailsBtn = this.createActionButton('votes-details-btn', 'how_to_vote', 'Votes');

    const payoutInfo = document.createElement('div');
    payoutInfo.className = 'payout-info';
    payoutInfo.textContent = `$${this.getPendingPayout(this.post)}`;

    postActions.appendChild(upvoteBtn);
    postActions.appendChild(commentBtn);
    postActions.appendChild(shareBtn);
    postActions.appendChild(votesDetailsBtn); // Add the new button
    postActions.appendChild(payoutInfo);

    // Add event listeners
    if (this.upvoteCallback) {
      upvoteBtn.addEventListener('click', this.upvoteCallback);
    }
    
    if (this.commentCallback) {
      commentBtn.addEventListener('click', this.commentCallback);
    }
    
    if (this.shareCallback) {
      shareBtn.addEventListener('click', this.shareCallback);
    }
    
    // Add event listener for votes details button
    votesDetailsBtn.addEventListener('click', () => {
      const votesPopup = new VotesPopup(this.post);
      votesPopup.show();
    });

    return postActions;
  }

  createActionButton(className, icon, countOrText) {
    const button = document.createElement('button');
    button.className = `action-btn ${className}`;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-icons';
    iconSpan.textContent = icon;
    button.appendChild(iconSpan);

    const countSpan = document.createElement('span');
    if (typeof countOrText === 'number') {
      countSpan.className = 'count';
      countSpan.textContent = countOrText;
    } else {
      countSpan.textContent = countOrText;
    }
    button.appendChild(countSpan);

    return button;
  }

  getPendingPayout(post) {
    const pending = parseFloat(post.pending_payout_value?.split(' ')[0] || 0);
    const total = parseFloat(post.total_payout_value?.split(' ')[0] || 0);
    const curator = parseFloat(post.curator_payout_value?.split(' ')[0] || 0);
    return (pending + total + curator).toFixed(2);
  }

  unmount() {
    // Clean up any event listeners if necessary
  }
}

export default PostActions;
