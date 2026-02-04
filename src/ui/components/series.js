/**
 * IINA IPTV Plugin - Series Component
 * v8.0.0
 * 
 * Series rendering with seasons and episodes
 */

'use strict';

/**
 * Parse episode.info field - handles both JSON string and object formats
 * ENHANCED: Better error handling and more robust JSON parsing
 * @param {Object} episode - Episode data from API
 * @returns {Object|null} Parsed episode info or null
 */
function parseEpisodeInfo(episode) {
  if (!episode.info) {
    return null;
  }
  
  let episodeInfo = null;
  
  if (typeof episode.info === 'string') {
    try {
      // Clean up common JSON encoding issues
      let cleaned = episode.info;
      
      // Handle escaped quotes and special characters
      cleaned = cleaned
        .replace(/\\"/g, '"')        // Unescape escaped quotes
        .replace(/\\n/g, ' ')         // Replace escaped newlines
        .replace(/\\t/g, ' ')         // Replace escaped tabs
        .replace(/\\r/g, '')          // Remove carriage returns
        .trim();
      
      // Try parsing the cleaned string
      episodeInfo = JSON.parse(cleaned);
    } catch (e) {
      // Try a more aggressive cleanup as fallback
      try {
        // Remove all non-printable characters except common whitespace
        let aggressiveClean = episode.info.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
        episodeInfo = JSON.parse(aggressiveClean);
      } catch (e2) {
        episodeInfo = null;
      }
    }
  } else if (typeof episode.info === 'object' && episode.info !== null) {
    episodeInfo = episode.info;
  }
  
  return episodeInfo;
}

/**
 * Extract episode metadata with comprehensive fallback chain
 * ENHANCED: More field options and better null handling
 * @param {Object} episode - Episode data from API
 * @param {Object|null} episodeInfo - Parsed episode.info object
 * @returns {Object} Extracted metadata
 */
function extractEpisodeMetadata(episode, episodeInfo) {
  // Thumbnail extraction - Xtream API common fields in priority order
  const thumbnail = episodeInfo?.movie_image ||        
                    episodeInfo?.cover_big ||           
                    episodeInfo?.cover ||               
                    episodeInfo?.poster ||              
                    episodeInfo?.thumbnail ||           
                    episodeInfo?.backdrop ||            
                    episodeInfo?.backdrop_path ||       
                    episodeInfo?.poster_path ||         
                    episodeInfo?.stream_icon ||         
                    episodeInfo?.fanart ||              
                    episodeInfo?.logo ||                
                    episodeInfo?.banner ||              
                    episode.movie_image ||              
                    episode.cover ||
                    episode.poster ||
                    episode.thumbnail ||
                    episode.stream_icon ||
                    episode.backdrop ||
                    '';  

  // Description/plot extraction
  const plot = episodeInfo?.plot ||                  
              episodeInfo?.overview ||               
              episodeInfo?.description ||           
              episodeInfo?.summary ||                
              episodeInfo?.synopsis ||               
              episode.plot ||
              episode.overview ||
              episode.description ||
              episode.summary ||
              '';

  // Duration extraction
  const duration = episodeInfo?.duration_secs ||       
                   episodeInfo?.duration ||            
                   episodeInfo?.runtime ||             
                   episodeInfo?.length ||              
                   episodeInfo?.duration_mins ||       
                   episode.duration ||
                   episode.runtime ||
                   episode.length ||
                   '';

  // Quality extraction with sanitization for [object Object] bug
  let qualityRaw = episodeInfo?.video ||                
                   episodeInfo?.video_quality ||       
                   episodeInfo?.quality ||             
                   episodeInfo?.resolution ||          
                   episodeInfo?.rating ||              
                   episodeInfo?.bitrate ||             
                   episodeInfo?.quality_type ||        
                   episode.quality ||
                   episode.video_quality ||
                   episode.resolution ||
                   '';
  
  // SANITIZATION: Fix for [object Object] bug
  let quality = '';
  if (typeof qualityRaw === 'object' && qualityRaw !== null) {
    if (qualityRaw.height) {
      quality = qualityRaw.height + 'p';
    } else if (qualityRaw.name) {
      quality = String(qualityRaw.name);
    } else if (qualityRaw.id) {
      quality = ''; 
    } else if (qualityRaw.width && qualityRaw.height) {
      quality = qualityRaw.height + 'p';
    } else {
      quality = '';
    }
  } else {
    quality = String(qualityRaw || '');
  }

  // Additional metadata
  const releasedate = episodeInfo?.releasedate || 
                      episodeInfo?.release_date ||
                      episodeInfo?.air_date ||
                      episode.releasedate ||
                      '';
  
  const tmdbId = episodeInfo?.tmdb_id || 
                 episodeInfo?.tmdbId ||
                 episodeInfo?.id_tmdb ||
                 '';
  
  const audio = episodeInfo?.audio || 
                episodeInfo?.audio_language ||
                episodeInfo?.audio_codec ||
                '';
  
  const bitrate = episodeInfo?.bitrate || 
                  episodeInfo?.bit_rate ||
                  '';

  const rating = episodeInfo?.rating || 
                 episodeInfo?.vote_average ||
                 episodeInfo?.score ||
                 episodeInfo?.rating_5stars ||
                 '';

  return { thumbnail, plot, duration, quality, releasedate, tmdbId, audio, bitrate, rating };
}

/**
 * Render episodes list for a season - ENHANCED VERSION
 * @param {Array} episodes - Episodes array
 * @param {string} [seriesCover] - Series cover image URL to use as fallback
 * @param {Function} escapeHtml - Escape HTML function
 * @param {Function} t - Translation function
 * @param {string} seriesId - Current series ID
 * @param {Function} playEpisodeCallback - Callback to play episode
 */
function renderEpisodesList(episodes, seriesCover, escapeHtml, t, seriesId, playEpisodeCallback) {
  const episodesList = document.querySelector('.episodes-list');
  if (!episodesList) {
    console.error('episodesList element not found in DOM');
    return;
  }
  
  episodesList.innerHTML = '';
  
  if (!episodes || episodes.length === 0) {
    episodesList.innerHTML = '<p class="no-episodes">' + t('series.noEpisodes') + '</p>';
    return;
  }
  
  // Animation: Trigger fade-in
  episodesList.classList.remove('animate-fade-in');
  void episodesList.offsetWidth; // Force reflow
  episodesList.classList.add('animate-fade-in');
  
  const fragment = document.createDocumentFragment();
  let renderedCount = 0;
  
  episodes.forEach((episode, index) => {
    const epNum = episode.episode_num || episode.num || (index + 1);
    const title = episode.title || t('series.episode', {num: epNum});
    const streamId = episode.id || episode.stream_id || episode.episode_id;
    const ext = episode.container_extension || 'mp4';
    
    // Validate stream ID
    if (!streamId) {
      return;
    }
    
    // Parse episode.info with enhanced error handling
    const episodeInfo = parseEpisodeInfo(episode);
    
    // Extract metadata with comprehensive fallback
    const metadata = extractEpisodeMetadata(episode, episodeInfo);
    const { thumbnail, plot, duration, quality, releasedate, rating } = metadata;
    
    // Build thumbnail HTML with Play Overlay
    let thumbnailHtml;
    if (thumbnail) {
      thumbnailHtml = `
        <img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="episode-thumbnail-placeholder" style="display:none;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
      `;
    } else {
      thumbnailHtml = `
        <div class="episode-thumbnail-placeholder">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
      `;
    }
    
    // Add Play Overlay
    thumbnailHtml += `
      <div class="episode-play-overlay">
        <div class="play-icon-circle">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>
    `;
    
    // Add Badges to thumbnail
    thumbnailHtml += `<span class="episode-number">${epNum}</span>`;
    if (duration) {
      thumbnailHtml += `<span class="episode-duration-badge">${escapeHtml(duration)}</span>`;
    }
    
    // Create episode card
    const card = document.createElement('div');
    card.className = 'episode-card';
    card.setAttribute('data-stream-id', String(streamId));
    card.setAttribute('data-ext', ext);
    card.setAttribute('data-title', escapeHtml(title));
    
    card.innerHTML = `
      <div class="episode-thumbnail">
        ${thumbnailHtml}
      </div>
      <div class="episode-info">
        <div class="episode-header">
           <div class="episode-title">${escapeHtml(title)}</div>
        </div>
        ${plot ? `<div class="episode-plot">${escapeHtml(plot)}</div>` : ''}
        ${rating ? `<div class="episode-rating">★ ${escapeHtml(rating)}</div>` : ''}
        ${quality ? `<div class="episode-quality-badge">${escapeHtml(quality)}</div>` : ''}
        ${releasedate ? `<div class="episode-releasedate">${escapeHtml(releasedate)}</div>` : ''}
      </div>
    `;
    
    // Add click handler
    card.addEventListener('click', () => {
      playEpisodeCallback(streamId, ext, title, seriesId);
    });

    fragment.appendChild(card);
    renderedCount++;
  });
  
  episodesList.appendChild(fragment);
  
  console.log(`Rendered ${renderedCount}/${episodes.length} episodes`);
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseEpisodeInfo,
    extractEpisodeMetadata,
    renderEpisodesList
  };
}