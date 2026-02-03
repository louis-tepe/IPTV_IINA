/**
 * History Manager
 * Tracks viewing history and resume positions
 */

export class HistoryManager {
  constructor(storage, maxItems = 100) {
    this.storage = storage;
    this.maxItems = maxItems;
    this.history = [];
    this.resumePositions = new Map();
    this.load();
  }

  /**
   * Load history from storage
   */
  load() {
    this.history = this.storage.get('history', []);
    const resumeData = this.storage.get('resume_positions', {});
    this.resumePositions = new Map(Object.entries(resumeData));
    iina.console.log(`[History] Loaded ${this.history.length} items`);
  }

  /**
   * Save history to storage
   */
  save() {
    this.storage.set('history', this.history);
    this.storage.set('resume_positions', Object.fromEntries(this.resumePositions));
  }

  /**
   * Add item to history
   */
  async add(item) {
    // Remove existing entry for same item
    const streamId = item.stream_id || item.series_id;
    this.history = this.history.filter(h => 
      (h.stream_id || h.series_id) !== streamId
    );
    
    // Add to beginning
    this.history.unshift({
      ...item,
      playedAt: Date.now()
    });
    
    // Trim to max items
    if (this.history.length > this.maxItems) {
      this.history = this.history.slice(0, this.maxItems);
    }
    
    this.save();
  }

  /**
   * Get all history
   */
  getAll() {
    return this.history;
  }

  /**
   * Get recent items
   */
  getRecent(count = 20) {
    return this.history.slice(0, count);
  }

  /**
   * Get history by type
   */
  getByType(type) {
    return this.history.filter(item => item.type === type);
  }

  /**
   * Update resume position for an item
   */
  updateResumePosition(streamId, position) {
    this.resumePositions.set(String(streamId), {
      position,
      updatedAt: Date.now()
    });
    this.save();
  }

  /**
   * Get resume position for an item
   */
  getResumePosition(streamId) {
    const data = this.resumePositions.get(String(streamId));
    return data?.position || 0;
  }

  /**
   * Check if item has a resume position
   */
  hasResumePosition(streamId) {
    return this.resumePositions.has(String(streamId));
  }

  /**
   * Clear resume position
   */
  clearResumePosition(streamId) {
    this.resumePositions.delete(String(streamId));
    this.save();
  }

  /**
   * Clear all history
   */
  clear() {
    this.history = [];
    this.resumePositions.clear();
    this.save();
  }

  /**
   * Remove specific item from history
   */
  remove(streamId) {
    this.history = this.history.filter(h => 
      (h.stream_id || h.series_id) !== streamId
    );
    this.resumePositions.delete(String(streamId));
    this.save();
  }

  /**
   * Get history count
   */
  count() {
    return this.history.length;
  }
}
