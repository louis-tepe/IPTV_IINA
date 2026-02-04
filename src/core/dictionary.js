/**
 * IINA IPTV Plugin - Shared Translation Dictionary
 * @module core/dictionary
 * 
 * SINGLE SOURCE OF TRUTH for all translations
 * Used by both backend (src/core/i18n.js) and frontend (src/ui/i18n-loader.js)
 */

'use strict';

const dictionaries = {
  fr: {
    // Navigation
    'nav.back': 'Retour',
    'nav.loading': 'Chargement...',
    'nav.noContent': 'Aucun contenu disponible',
    'nav.noCategories': 'Aucune catégorie trouvée',
    'nav.noItems': 'Aucun élément trouvé',
    'nav.error': 'Erreur',
    'nav.items': '{count} éléments',
    'nav.categories': '{count} catégories',
    'nav.seasons': '{count} Saison{plural}',
    'nav.live': 'En direct',
    'nav.vod': 'VOD',
    'nav.series': 'Séries',
    'nav.favorites': 'Favoris',
    'nav.history': 'Historique',

    // Series
    'series.seasons': 'Saisons',
    'series.season': 'Saison {num}',
    'series.episodes': 'Épisodes',
    'series.episode': 'Épisode {num}',
    'series.play': 'Commencer la série',
    'series.noSeasons': 'Aucune saison disponible',
    'series.noEpisodes': 'Aucun épisode disponible',

    // Resume
    'resume.message': 'Reprendre la lecture depuis {time} ({percent}% visionné)?\n\nCliquez OK pour reprendre, Annuler pour recommencer du début.',
    'resume.resume': 'Reprendre',
    'restart': 'Recommencer',

    // EPG
    'epg.loading': 'Chargement du guide des programmes...',
    'epg.error': 'Échec du chargement du guide des programmes',
    'epg.empty': 'Aucune information de programme disponible',
    'epg.title': 'Guide des programmes',
    'epg.unknownProgram': 'Programme inconnu',

    // Common
    'common.play': 'Lecture',
    'common.favorite': 'Favori',
    'common.search': 'Rechercher',
    'common.refresh': 'Actualiser',
    'common.disconnect': 'Déconnecter',
    'common.live': 'En direct',
    'common.confirm': 'Confirmer',
    'common.cancel': 'Annuler',
    'common.close': 'Fermer',
    'common.open': 'Ouvrir',
    'common.unknown': 'Inconnu',

    // Connection Form
    'connection.title': 'IPTV Player',
    'connection.server': 'URL du serveur',
    'connection.serverPlaceholder': 'http://example.com:8080',
    'connection.serverHint': 'Incluez le numéro de port (ex: :8080)',
    'connection.username': 'Nom d\'utilisateur',
    'connection.usernamePlaceholder': 'Votre nom d\'utilisateur',
    'connection.password': 'Mot de passe',
    'connection.passwordPlaceholder': 'Votre mot de passe',
    'connection.connect': 'Se connecter',
    'connection.connecting': 'Connexion...',
    'connection.error': 'Échec de la connexion.',
    'connection.allFields': 'Veuillez remplir tous les champs.',

    // Browser UI
    'browser.searchPlaceholder': 'Rechercher...',
    'browser.refresh': 'Actualiser',
    'browser.debugConsole': 'Console de débogage',
    'browser.clearLogs': 'Effacer les journaux',
    'browser.toggleMinimize': 'Réduire/Agrandir',
    'browser.msgs': 'Msgs',
    'browser.last': 'Dernier',
    'browser.connecting': 'Connexion',
    'browser.connected': 'Connecté',
    'browser.disconnected': 'Déconnecté',
  },

  en: {
    // Navigation
    'nav.back': 'Back',
    'nav.loading': 'Loading...',
    'nav.noContent': 'No content available',
    'nav.noCategories': 'No categories found',
    'nav.noItems': 'No items found',
    'nav.error': 'Error',
    'nav.items': '{count} items',
    'nav.categories': '{count} categories',
    'nav.seasons': '{count} Season{plural}',
    'nav.live': 'Live',
    'nav.vod': 'VOD',
    'nav.series': 'Series',
    'nav.favorites': 'Favorites',
    'nav.history': 'History',

    // Series
    'series.seasons': 'Seasons',
    'series.season': 'Season {num}',
    'series.episodes': 'Episodes',
    'series.episode': 'Episode {num}',
    'series.play': 'Start series',
    'series.noSeasons': 'No seasons available',
    'series.noEpisodes': 'No episodes available',

    // Resume
    'resume.message': 'Resume playback from {time} ({percent}% watched)?\n\nClick OK to resume, Cancel to start from beginning.',
    'resume.resume': 'Resume',
    'restart': 'Restart',

    // EPG
    'epg.loading': 'Loading program guide...',
    'epg.error': 'Failed to load program guide',
    'epg.empty': 'No program information available',
    'epg.title': 'Program Guide',
    'epg.unknownProgram': 'Unknown Program',

    // Common
    'common.play': 'Play',
    'common.favorite': 'Favorite',
    'common.search': 'Search',
    'common.refresh': 'Refresh',
    'common.disconnect': 'Disconnect',
    'common.live': 'Live',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.open': 'Open',
    'common.unknown': 'Unknown',

    // Connection Form
    'connection.title': 'IPTV Player',
    'connection.server': 'Server URL',
    'connection.serverPlaceholder': 'http://example.com:8080',
    'connection.serverHint': 'Include the port number (e.g., :8080)',
    'connection.username': 'Username',
    'connection.usernamePlaceholder': 'Your username',
    'connection.password': 'Password',
    'connection.passwordPlaceholder': 'Your password',
    'connection.connect': 'Connect',
    'connection.connecting': 'Connecting...',
    'connection.error': 'Connection failed.',
    'connection.allFields': 'Please fill in all fields.',

    // Browser UI
    'browser.searchPlaceholder': 'Search...',
    'browser.refresh': 'Refresh',
    'browser.debugConsole': 'Debug Console',
    'browser.clearLogs': 'Clear logs',
    'browser.toggleMinimize': 'Toggle minimize',
    'browser.msgs': 'Msgs',
    'browser.last': 'Last',
    'browser.connecting': 'Connecting',
    'browser.connected': 'Connected',
    'browser.disconnected': 'Disconnected',
  }
};

module.exports = dictionaries;
