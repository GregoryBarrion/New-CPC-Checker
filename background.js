// background.js - Version corrigée sans DOMParser

// Configuration par défaut
const DEFAULT_CONFIG = {
  refreshInterval: 5, // en minutes
  showAsPopup: true,
  protocol: 'http',
  useHttps: true,
  hideIgnoredPosts: false,
  useFavorites: true,
  syncFavorites: false,
  searchEngine: 'duckduckgo',
  showSearchBox: true,
  notifyPrivate: true,
  notifyDiscussions: true
};

// Initialisation
chrome.runtime.onInstalled.addListener(async () => {
  const config = await chrome.storage.sync.get('config');
  if (!config.config) {
    await chrome.storage.sync.set({ config: DEFAULT_CONFIG });
  }
  
  // Mise en place de l'alarme pour la vérification périodique
  setupAlarm();
  
  // Vérification initiale
  setTimeout(() => {
    checkForNewMessages();
  }, 2000);
});

// Configuration de l'alarme basée sur l'intervalle défini
async function setupAlarm() {
  const { config } = await chrome.storage.sync.get('config');
  
  // Suppression de l'alarme existante
  chrome.alarms.clear('checkMessages');
  
  // Création d'une nouvelle alarme
  chrome.alarms.create('checkMessages', {
    periodInMinutes: config.refreshInterval || 5
  });
  
  console.log(`Alarme configurée: vérification toutes les ${config.refreshInterval || 5} minutes`);
}

// Écoute des déclenchements d'alarme
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkMessages') {
    console.log('Déclenchement de l\'alarme: vérification des messages');
    await checkForNewMessages();
  }
});

// Vérification des nouveaux messages
async function checkForNewMessages() {
  console.log('Vérification des nouveaux messages...');
  const { config } = await chrome.storage.sync.get('config');
  const baseUrl = config.useHttps ? 'https://forum.canardpc.com' : 'http://forum.canardpc.com';
  
  try {
    // 1. Vérifier d'abord la connexion via usercp.php (pour les messages privés)
    console.log(`Requête vers ${baseUrl}/settings/profile`);
    const response = await fetch(`${baseUrl}/settings/profile`, {
      credentials: 'include',
      cache: 'no-store'
    });

    const finalUrl = response.url;
    console.log(`URL finale: ${finalUrl}`);

    const html = await response.text();
    
    // Méthodes multiples pour détecter la déconnexion
    const isLoggedOut = 
      html.includes('logged-out') || 
      html.includes('Impossible d\'accéder aux options du profil en tant qu\'invité') ||
      html.includes('data-username=\'Invité\'') ||
      html.includes('data-userid=\'0\'') ||
      !html.includes('auth/logout');
    
    if (isLoggedOut) {
      console.log('Utilisateur non connecté - Plusieurs indicateurs trouvés');
      handleDisconnectedState('Non connecté - Veuillez vous connecter au forum');
      return { success: false, error: 'Non connecté' };
    }
    
    // L'utilisateur est connecté, récupérer le HTML de la page pour les messages privés
    console.log('Utilisateur connecté, récupération du HTML');
    
    // 2. Récupérer les abonnements non lus via l'URL de recherche spécifique
    console.log('Récupération des abonnements non lus');
    const searchUrl = `${baseUrl}/search?searchJSON=%7B%22view%22%3A%22topic%22%2C%22unread_only%22%3A1%2C%22sort%22%3A%7B%22lastcontent%22%3A%22desc%22%7D%2C%22exclude_type%22%3A%5B%22vBForum_PrivateMessage%22%5D%2C%22my_following%22%3A%221%22%7D`;
    
    const searchResponse = await fetch(searchUrl, {
      credentials: 'include',
      cache: 'no-store'
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Erreur HTTP lors de la récupération des abonnements: ${searchResponse.status}`);
    }
    
    const searchHtml = await searchResponse.text();

    const messagesResult = await fetchPrivateMessages();
    
    // 3. Stocker les deux pages HTML pour traitement dans le popup
    await chrome.storage.local.set({
      rawHtml: html,
      searchHtml: searchHtml,
      isLoggedIn: true,
      lastCheck: new Date().toISOString(),
      error: null
    });

    
    // Traitement rapide pour le badge et les notifications
    // Messages privés (recherche basique)
    const privateMessagesMatch = html.match(/Vous avez (\d+) nouveau/i) || html.match(/(\d+) message.+priv/i);
    
    // Discussions non lues (compter à partir des résultats de recherche)
    // Pour vBulletin 6.1.1, on compte les éléments topic-item unread
    const newDiscussionsCount = (searchHtml.match(/class=\"topic-item.*unread/g) || []).length;
    
    let privateMessagesCount = 0;
    
    // Récupérer les données de messages existantes pour la comparaison
    const { messagesHtml } = await chrome.storage.local.get('messagesHtml');
    
    if (messagesHtml) {
      // Rechercher le compteur de messages non lus
      const unreadMatch = messagesHtml.match(/(\d+)\s*message.*non lu/i);
      if (unreadMatch) {
        privateMessagesCount = parseInt(unreadMatch[1], 10);
      } else {
        // Méthode alternative : compter les lignes de messages avec la classe "unread"
        privateMessagesCount = (messagesHtml.match(/class="message-row.*unread/g) || []).length;
      }
    }
    
    console.log(`Messages privés: ${privateMessagesCount}, Discussions non lues: ${newDiscussionsCount}`);
    
    // Nombre total de nouveaux éléments
    const totalNew = privateMessagesCount + newDiscussionsCount;
    
    // Mise à jour du badge et de l'icône
    if (totalNew > 0) {
      console.log(`Total nouveaux éléments: ${totalNew}`);
      updateBadge(totalNew.toString(), '#FF0000');
      updateIcon('new-messages');
      
      // Notifications
      if (config.notifyPrivate && privateMessagesCount > 0) {
        showNotification('privateMessages', { count: privateMessagesCount });
      }
      
      if (config.notifyDiscussions && newDiscussionsCount > 0) {
        showNotification('newDiscussions', { count: newDiscussionsCount });
      }
    } else {
      console.log('Aucun nouvel élément');
      updateBadge('', '');
      updateIcon('connected');
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('Erreur lors de la vérification des messages:', error);
    handleDisconnectedState(`Erreur: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Mise à jour du badge sur l'icône
function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  if (color) {
    chrome.action.setBadgeBackgroundColor({ color });
  }
}

// Mise à jour de l'icône en fonction de l'état
function updateIcon(state) {
  const iconName = state || 'connected';
  const iconPaths = {
    16: `icons/${iconName}16.png`,
    48: `icons/${iconName}48.png`,
    128: `icons/${iconName}128.png`
  };
  
  chrome.action.setIcon({ path: iconPaths });
}

// Affichage des notifications
function showNotification(type, data) {
  const { config } = chrome.storage.sync.get('config') || { config: { } };
  
  if (type === 'privateMessages' && data.count > 0) {
    chrome.notifications.create('cpc_private_messages', {
      type: 'basic',
      iconUrl: 'icons/new-messages128.png',
      title: 'Nouveaux messages privés',
      message: `Vous avez ${data.count} nouveau(x) message(s) privé(s)`,
      priority: 2,
      buttons: [
        { title: 'Voir les messages' }
      ]
    });
    
    // Ajouter un gestionnaire de clic sur la notification
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
      if (notificationId === 'cpc_private_messages' && buttonIndex === 0) {
        const baseUrl = config.useHttps ? 'https://forum.canardpc.com' : 'http://forum.canardpc.com';
        chrome.tabs.create({ url: `${baseUrl}/messagecenter/index` });
      }
    });
  }
  
  if (type === 'newDiscussions' && data.count > 0) {
    chrome.notifications.create('cpc_new_discussions', {
      type: 'basic',
      iconUrl: 'icons/new-thread128.png',
      title: 'Discussions suivies',
      message: `Vous avez ${data.count} discussion(s) avec de nouveaux messages`,
      priority: 2,
      buttons: [
        { title: 'Voir les discussions' }
      ]
    });
    
    // Ajouter un gestionnaire de clic sur la notification
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
      if (notificationId === 'cpc_new_discussions' && buttonIndex === 0) {
        const baseUrl = config.useHttps ? 'https://forum.canardpc.com' : 'http://forum.canardpc.com';
        chrome.tabs.create({ 
          url: `${baseUrl}/search?searchJSON=%7B%22view%22%3A%22topic%22%2C%22unread_only%22%3A1%2C%22sort%22%3A%7B%22lastcontent%22%3A%22desc%22%7D%2C%22exclude_type%22%3A%5B%22vBForum_PrivateMessage%22%5D%2C%22my_following%22%3A%221%22%7D` 
        });
      }
    });
  }
}

chrome.notifications.onClicked.addListener((notificationId) => {
  const { config } = chrome.storage.sync.get('config') || { config: { } };
  const baseUrl = config.useHttps ? 'https://forum.canardpc.com' : 'http://forum.canardpc.com';
  
  if (notificationId === 'cpc_private_messages') {
    chrome.tabs.create({ url: `${baseUrl}/messagecenter/index` });
  } else if (notificationId === 'cpc_new_discussions') {
    chrome.tabs.create({ 
      url: `${baseUrl}/search?searchJSON=%7B%22view%22%3A%22topic%22%2C%22unread_only%22%3A1%2C%22sort%22%3A%7B%22lastcontent%22%3A%22desc%22%7D%2C%22exclude_type%22%3A%5B%22vBForum_PrivateMessage%22%5D%2C%22my_following%22%3A%221%22%7D` 
    });
  }

// Action pour marquer tout comme lu
// Mise à jour de la fonction markAllAsRead dans background.js

async function markAllAsRead() {
  const { config } = await chrome.storage.sync.get('config');
  const baseUrl = config.useHttps ? 'https://forum.canardpc.com' : 'http://forum.canardpc.com';
  
  try {
    // 1. Marquer toutes les discussions comme lues
    const markReadUrl = `${baseUrl}/markread`;
    
    await fetch(markReadUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'do=markread&securitytoken=guest'
    });
    
    // 2. Marquer également les abonnements
    const subsUrl = `${baseUrl}/subscription.php?do=markread&markreadhash=all`;
    await fetch(subsUrl, {
      method: 'GET',
      credentials: 'include'
    });
    
    // 3. Marquer les messages privés comme lus (nouveau)
    // Cette URL peut varier, vérifiez si elle est correcte pour votre forum
    const messagesUrl = `${baseUrl}/messagecenter/markunread`;
    await fetch(messagesUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'action=markread&securitytoken=guest'
    });
    
    // Mettre à jour l'interface
    updateBadge('', '');
    updateIcon('connected');
    
    // Effacer les données pour forcer une nouvelle vérification
    await chrome.storage.local.set({
      searchHtml: null,
      messagesHtml: null,
      lastCheck: new Date().toISOString()
    });
    
    // Vérifier à nouveau après un court délai
    setTimeout(() => {
      checkForNewMessages();
    }, 1000);
    
    return { success: true };
  } catch (error) {
    console.error('Erreur lors du marquage comme lu:', error);
    return { success: false, error: error.message };
  }
}

// Écouter les messages du popup ou des content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message reçu:', message);
  
  switch (message.action) {
    case 'checkNow':
      console.log('Vérification immédiate demandée');
      checkForNewMessages().then(result => {
        console.log('Résultat de la vérification:', result);
        sendResponse(result);
      });
      return true; // Indique que la réponse sera envoyée de manière asynchrone
      
    case 'markAllRead':
      console.log('Marquage comme lu demandé');
      markAllAsRead().then(result => {
        console.log('Résultat du marquage comme lu:', result);
        sendResponse(result);
      });
      return true;
      
    case 'configUpdated':
      console.log('Configuration mise à jour, reconfiguration de l\'alarme');
      setupAlarm().then(() => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'getStatus':
      console.log('Demande de statut reçue');
      chrome.storage.local.get(['isLoggedIn', 'lastCheck', 'rawHtml', 'error'], data => {
        console.log('Envoi du statut actuel');
        sendResponse(data);
      });
      return true;
      
    case 'openTab':
      console.log('Ouverture d\'un nouvel onglet:', message.url);
      chrome.tabs.create({ url: message.url });
      sendResponse({ success: true });
      return false;

    case 'checkLoginStatus':
      checkLoginStatus().then(isLoggedIn => {
        sendResponse({ isLoggedIn: isLoggedIn });
      });
      return true;
  }
});

function handleDisconnectedState(errorMessage) {
  console.log('Gestion de l\'état déconnecté:', errorMessage);
  updateBadge('?', '#888888');
  updateIcon('disconnected');
  
  chrome.storage.local.set({
    isLoggedIn: false,
    rawHtml: null,
    searchHtml: null,
    lastCheck: new Date().toISOString(),
    error: errorMessage
  });
}

async function fetchPrivateMessages() {
  console.log('Récupération des messages privés...');
  const { config } = await chrome.storage.sync.get('config');
  const baseUrl = config.useHttps ? 'https://forum.canardpc.com' : 'http://forum.canardpc.com';
  
  try {
    // Requête vers le centre de messages
    const response = await fetch(`${baseUrl}/messagecenter/index`, {
      credentials: 'include',
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.log('Erreur lors de la récupération des messages privés:', response.status);
      return { success: false, error: `Erreur HTTP: ${response.status}` };
    }
    
    // Vérifier si l'utilisateur est redirigé (déconnecté)
    if (response.url.includes('login.php')) {
      console.log('Utilisateur non connecté lors de la récupération des messages privés');
      return { success: false, error: 'Non connecté' };
    }
    
    // Récupérer le HTML
    const html = await response.text();
    
    // Stocker le HTML brut pour traitement dans le popup
    await chrome.storage.local.set({
      messagesHtml: html,
      lastMessageCheck: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la récupération des messages privés:', error);
    return { success: false, error: error.message };
  }
}