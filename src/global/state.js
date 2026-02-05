export const state = {
  api: null,
  isConnected: false,
  credentials: null,
  favorites: {},
  history: [],
  resumePositions: {},
  cache: {
    liveCategories: { data: null, timestamp: 0 },
    vodCategories: { data: null, timestamp: 0 },
    seriesCategories: { data: null, timestamp: 0 },
    streams: {}
  },
  searchDebounceTimer: null
};
