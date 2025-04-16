// Configuration par défaut
const DEFAULT_CONFIG = {
    refreshInterval: 5, // en minutes
    showAsPopup: true,
    forumUrl: 'http://forum.canardpc.com',
    useHttps: false,
    hideIgnoredPosts: false,
    useFavorites: true,
    syncFavorites: false,
    searchEngine: 'duckduckgo',
    showSearchBox: true
  };
  
  // Initialisation
  chrome.runtime.onInstalled.addListener(async () => {
    const config = await chrome.storage.sync.get('config');
    if (!config.config) {
      await chrome.storage.sync.set({ config: DEFAULT_CONFIG });
    }
    
    // Mise en place de l'alarme pour la vérification périodique
    setupAlarm();
  });
  
  // Configuration de l'alarme basée sur l'intervalle défini
  async function setupAlarm() {
    const { config } = await chrome.storage.sync.get('config');
    
    // Suppression de l'alarme existante
    chrome.alarms.clear('checkMessages');
    
    // Création d'une nouvelle alarme
    chrome.alarms.create('checkMessages', {
      periodInMinutes: config.refreshInterval
    });
  }
  
  // Écoute des déclenchements d'alarme
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'checkMessages') {
      await checkForNewMessages();
    }
  });
  
  // Vérification des nouveaux messages
  async function checkForNewMessages() {
    const { config } = await chrome.storage.sync.get('config');
    const baseUrl = config.useHttps ? 'https://forum.canardpc.com' : 'http://forum.canardpc.com';
    
    try {
      // Récupération du tableau de bord
      const response = await fetch(`${baseUrl}/usercp.php`, {
        credentials: 'include',
      });
      
      // Vérifier si l'utilisateur est connecté
      if (response.url.includes('login.php')) {
        updateBadge('?', '#888888'); // Non connecté
        return;
      }
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Analyse du HTML pour extraire les informations
      const newPrivateMessages = extractPrivateMessages(doc);
      const followedDiscussions = extractFollowedDiscussions(doc);
      
      // Vérification des nouveaux messages
      const totalNew = newPrivateMessages.length + followedDiscussions.filter(d => d.hasNewMessages).length;
      
      // Mise à jour du badge et stockage des données
      if (totalNew > 0) {
        updateBadge(totalNew.toString(), '#FF0000');
        showNotification(newPrivateMessages, followedDiscussions);
      } else {
        updateBadge('', '');
      }
      
      // Stockage des données pour l'affichage dans le popup
      await chrome.storage.local.set({
        lastCheck: new Date().toISOString(),
        privateMessages: newPrivateMessages,
        discussions: followedDiscussions,
        isLoggedIn: true
      });
      
    } catch (error) {
      console.error('Erreur lors de la vérification des messages:', error);
      updateBadge('!', '#FF0000');
      await chrome.storage.local.set({
        isLoggedIn: false,
        error: error.message
      });
    }
  }
  
  // Mise à jour du badge sur l'icône
  function updateBadge(text, color) {
    chrome.action.setBadgeText({ text });
    if (color) {
      chrome.action.setBadgeBackgroundColor({ color });
    }
  }
  
  // Affichage des notifications
  function showNotification(privateMessages, discussions) {
    const { config } = chrome.storage.sync.get('config');
    const newDiscussions = discussions.filter(d => d.hasNewMessages);
    
    if (privateMessages.length > 0) {
      chrome.notifications.create('privateMessages', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Nouveaux messages privés',
        message: `Vous avez ${privateMessages.length} nouveau(x) message(s) privé(s)`
      });
    }
    
    if (newDiscussions.length > 0) {
      chrome.notifications.create('newDiscussions', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Nouvelles discussions',
        message: `Vous avez ${newDiscussions.length} discussion(s) avec de nouveaux messages`
      });
    }
  }