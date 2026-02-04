/**
 * Favorites Manager
 * Handles saving and loading favorite channels, movies, and series
 */

export class FavoritesManager {
  constructor(storage) {
    this.storage = storage;
    this.favorites = new Map();
    this.load();
  }

  /**
   * Load favorites from storage
   */
  load() {
    const data = this.storage.get('favorites', {});
    this.favorites = new Map(Object.entries(data));
    iina.console.log(`[Favorites] Loaded ${this.favorites.size} favorites`);
  }

  /**
   * Save favorites to storage
   */
  save() {
    const data = Object.fromEntries(this.favorites);
    this.storage.set('favorites', data);
    iina.console.log(`[Favorites] Saved ${this.favorites.size} favorites`);
  }

  /**
   * Add an item to favorites
   */
  async add(key, item) {
    this.favorites.set(key, {
      ...item,
      addedAt: Date.now()
    });
    this.save();
  }

  /**
   * Remove an item from favorites
   */
  async remove(key) {
    this.favorites.delete(key);
    this.save();
  }

  /**
   * Check if item is in favorites
   */
  has(key) {
    return this.favorites.has(key);
  }

  /**
   * Get a favorite item
   */
  get(key) {
    return this.favorites.get(key);
  }

  /**
   * Get all favorites
   */
  getAll() {
    return Array.from(this.favorites.values());
  }

  /**
   * Get favorites by type
   */
  getByType(type) {
    return this.getAll().filter(item => item.type === type);
  }

  /**
   * Get favorites count
   */
  count() {
    return this.favorites.size;
  }

  /**
   * Clear all favorites
   */
  clear() {
    this.favorites.clear();
    this.save();
  }

  /**
   * Toggle favorite status
   */
  async toggle(key, item) {
    if (this.has(key)) {
      await this.remove(key);
      return false;
    } else {
      await this.add(key, item);
      return true;
    }
  }
}
