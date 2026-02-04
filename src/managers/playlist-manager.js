/**
 * Playlist Manager
 * Handles playlist creation and management for IINA
 */

export class PlaylistManager {
  constructor() {
    this.currentPlaylist = [];
    this.currentIndex = -1;
  }

  /**
   * Set the current playlist
   */
  setPlaylist(items, type) {
    this.currentPlaylist = items.map((item, index) => ({
      ...item,
      type,
      playlistIndex: index
    }));
    this.currentIndex = -1;
    iina.console.log(`[Playlist] Set ${this.currentPlaylist.length} items`);
  }

  /**
   * Get current playlist
   */
  getPlaylist() {
    return this.currentPlaylist;
  }

  /**
   * Get current item
   */
  getCurrentItem() {
    if (this.currentIndex >= 0 && this.currentIndex < this.currentPlaylist.length) {
      return this.currentPlaylist[this.currentIndex];
    }
    return null;
  }

  /**
   * Set current index
   */
  setCurrentIndex(index) {
    if (index >= 0 && index < this.currentPlaylist.length) {
      this.currentIndex = index;
    }
  }

  /**
   * Get next item
   */
  getNextItem() {
    if (this.currentIndex + 1 < this.currentPlaylist.length) {
      return this.currentPlaylist[this.currentIndex + 1];
    }
    return null;
  }

  /**
   * Get previous item
   */
  getPreviousItem() {
    if (this.currentIndex > 0) {
      return this.currentPlaylist[this.currentIndex - 1];
    }
    return null;
  }

  /**
   * Move to next item
   */
  next() {
    if (this.currentIndex + 1 < this.currentPlaylist.length) {
      this.currentIndex++;
      return this.getCurrentItem();
    }
    return null;
  }

  /**
   * Move to previous item
   */
  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.getCurrentItem();
    }
    return null;
  }

  /**
   * Clear playlist
   */
  clear() {
    this.currentPlaylist = [];
    this.currentIndex = -1;
  }

  /**
   * Get playlist length
   */
  get length() {
    return this.currentPlaylist.length;
  }

  /**
   * Check if has next
   */
  hasNext() {
    return this.currentIndex + 1 < this.currentPlaylist.length;
  }

  /**
   * Check if has previous
   */
  hasPrevious() {
    return this.currentIndex > 0;
  }

  /**
   * Shuffle playlist
   */
  shuffle() {
    const current = this.getCurrentItem();
    
    // Fisher-Yates shuffle
    for (let i = this.currentPlaylist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.currentPlaylist[i], this.currentPlaylist[j]] = 
        [this.currentPlaylist[j], this.currentPlaylist[i]];
    }
    
    // Find current item's new index
    if (current) {
      this.currentIndex = this.currentPlaylist.findIndex(
        item => item.stream_id === current.stream_id
      );
    }
  }

  /**
   * Add item to playlist
   */
  add(item, type) {
    this.currentPlaylist.push({
      ...item,
      type,
      playlistIndex: this.currentPlaylist.length
    });
  }

  /**
   * Remove item from playlist by index
   */
  remove(index) {
    if (index >= 0 && index < this.currentPlaylist.length) {
      this.currentPlaylist.splice(index, 1);
      
      // Adjust current index if needed
      if (index < this.currentIndex) {
        this.currentIndex--;
      } else if (index === this.currentIndex) {
        // Current item removed, stay at same index (next item)
        if (this.currentIndex >= this.currentPlaylist.length) {
          this.currentIndex = this.currentPlaylist.length - 1;
        }
      }
      
      // Update playlist indices
      this.currentPlaylist.forEach((item, idx) => {
        item.playlistIndex = idx;
      });
    }
  }
}
