// popup/popup.js
document.addEventListener('DOMContentLoaded', async () => {
    // Chargement des données
    const data = await chrome.storage.local.get(['lastCheck', 'privateMessages', 'discussions', 'isLoggedIn', 'error']);
    const { config } = await chrome.storage.sync.get('config');
    
    // Gestion des onglets
    const tabs = document.querySelectorAll('.tabs li');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });
    
    // Affichage du statut
    const statusMessage = document.getElementById('status-message');
    if (!data.isLoggedIn) {
      statusMessage.textContent = 'Vous n\'êtes pas connecté au forum. Veuillez vous connecter.';
      statusMessage.classList.add('error');
    } else if (data.error) {
      statusMessage.textContent = `Erreur: ${data.error}`;
      statusMessage.classList.add('error');
    } else {
      statusMessage.textContent = `Dernière vérification: ${new Date(data.lastCheck).toLocaleString()}`;
    }
    
    // Affichage des messages privés
    const privateMessagesList = document.getElementById('private-messages-list');
    const privateCount = document.getElementById('private-count');
    
    if (data.privateMessages && data.privateMessages.length > 0) {
      privateCount.textContent = data.privateMessages.length;
      
      data.privateMessages.forEach(message => {
        const li = document.createElement('li');
        li.innerHTML = `
          <a href="${config.forumUrl}/private.php?do=showpm&pmid=${message.id}" target="_blank">
            ${message.title} - par ${message.sender}
          </a>
        `;
        privateMessagesList.appendChild(li);
      });
    } else {
      privateCount.textContent = '0';
      privateMessagesList.innerHTML = '<li class="empty">Aucun nouveau message privé</li>';
    }
    
    // Affichage des discussions suivies
    const discussionsList = document.getElementById('discussions-list');
    const discussionsCount = document.getElementById('discussions-count');
    
    if (data.discussions && data.discussions.length > 0) {
      const newDiscussions = data.discussions.filter(d => d.hasNewMessages);
      discussionsCount.textContent = newDiscussions.length;
      
      data.discussions.forEach(discussion => {
        const li = document.createElement('li');
        li.className = discussion.hasNewMessages ? 'new' : '';
        li.innerHTML = `
          <a href="${config.forumUrl}/showthread.php?t=${discussion.id}" target="_blank">
            ${discussion.title} 
            ${discussion.hasNewMessages ? `<span class="badge">${discussion.newCount}</span>` : ''}
          </a>
        `;
        discussionsList.appendChild(li);
      });
    } else {
      discussionsCount.textContent = '0';
      discussionsList.innerHTML = '<li class="empty">Aucune discussion suivie</li>';
    }
    
    // Gestion des boutons d'action
    document.getElementById('refresh-now').addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'checkNow' });
      window.close(); // Option: recharger les données à la place
    });
    
    document.getElementById('mark-read').addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'markAllRead' });
      window.close();
    });
    
    document.getElementById('open-forum').addEventListener('click', () => {
      chrome.tabs.create({ url: config.forumUrl });
    });
    
    // Initialisation des autres onglets
    initConfigTab(config);
    initFavoritesTab();
    initSearchTab(config);
    initHelpTab();
  });
  
  // Fonctions pour initialiser les différents onglets
  function initConfigTab(config) {
    // Remplir les champs de configuration avec les valeurs actuelles
    document.querySelector('input[name="showAsPopup"]').checked = config.showAsPopup;
    document.querySelector('input[name="showAsTab"]').checked = !config.showAsPopup;
    document.getElementById('refresh-interval').value = config.refreshInterval;
    document.querySelector('input[name="httpAccess"]').checked = !config.useHttps;
    document.querySelector('input[name="httpsAccess"]').checked = config.useHttps;
    document.querySelector('input[name="hideIgnoredPosts"]').checked = config.hideIgnoredPosts;
    
    // Écouter les changements
    document.getElementById('config-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newConfig = {
        ...config,
        showAsPopup: document.querySelector('input[name="showAsPopup"]').checked,
        refreshInterval: parseInt(document.getElementById('refresh-interval').value),
        useHttps: document.querySelector('input[name="httpsAccess"]').checked,
        hideIgnoredPosts: document.querySelector('input[name="hideIgnoredPosts"]').checked,
        forumUrl: document.querySelector('input[name="httpsAccess"]').checked ? 
          'https://forum.canardpc.com' : 'http://forum.canardpc.com'
      };
      
      await chrome.storage.sync.set({ config: newConfig });
      await chrome.runtime.sendMessage({ action: 'updateConfig' });
      
      // Notification de sauvegarde
      const notification = document.createElement('div');
      notification.className = 'notification success';
      notification.textContent = 'Configuration sauvegardée';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    });
  }
  
// Partie du popup.js pour la gestion des favoris
function initFavoritesTab() {
    const { config } = chrome.storage.sync.get('config');
    const useFavoritesYes = document.querySelector('input[name="useFavorites"][value="yes"]');
    const useFavoritesNo = document.querySelector('input[name="useFavorites"][value="no"]');
    const syncFavoritesYes = document.querySelector('input[name="syncFavorites"][value="yes"]');
    const syncFavoritesNo = document.querySelector('input[name="syncFavorites"][value="no"]');
    const favoritesTextarea = document.getElementById('favorites-json');
    
    // Initialisation depuis la configuration
    useFavoritesYes.checked = config.useFavorites;
    useFavoritesNo.checked = !config.useFavorites;
    syncFavoritesYes.checked = config.syncFavorites;
    syncFavoritesNo.checked = !config.syncFavorites;
    
    // Chargement des favoris
    chrome.storage.sync.get('favorites', (data) => {
      if (data.favorites) {
        favoritesTextarea.value = JSON.stringify(data.favorites, null, 2);
      } else {
        // Structure par défaut
        favoritesTextarea.value = JSON.stringify({
          "bookmarks": [],
          "lastUpdated": 0
        });
      }
    });
    
    // Sauvegarde des favoris
    document.getElementById('save-favorites').addEventListener('click', async () => {
      try {
        const favoritesData = JSON.parse(favoritesTextarea.value);
        await chrome.storage.sync.set({ favorites: favoritesData });
        
        // Mise à jour de la config
        const newConfig = {
          ...config,
          useFavorites: useFavoritesYes.checked,
          syncFavorites: syncFavoritesYes.checked
        };
        await chrome.storage.sync.set({ config: newConfig });
        
        // Message de confirmation
        showNotification('Favoris sauvegardés avec succès', 'success');
      } catch (error) {
        showNotification('Erreur: Format JSON invalide', 'error');
      }
    });
  }

  // Partie du popup.js pour la recherche
function initSearchTab(config) {
    const showSearchYes = document.querySelector('input[name="showSearch"][value="yes"]');
    const showSearchNo = document.querySelector('input[name="showSearch"][value="no"]');
    const searchEngineDuckDuckGo = document.querySelector('input[name="searchEngine"][value="duckduckgo"]');
    const searchEngineQwant = document.querySelector('input[name="searchEngine"][value="qwant"]');
    const searchEngineGoogle = document.querySelector('input[name="searchEngine"][value="google"]');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    
    // Initialisation depuis la configuration
    showSearchYes.checked = config.showSearchBox;
    showSearchNo.checked = !config.showSearchBox;
    
    // Sélection du moteur de recherche
    switch (config.searchEngine) {
      case 'duckduckgo':
        searchEngineDuckDuckGo.checked = true;
        break;
      case 'qwant':
        searchEngineQwant.checked = true;
        break;
      case 'google':
        searchEngineGoogle.checked = true;
        break;
      default:
        searchEngineDuckDuckGo.checked = true;
    }
    
    // Sauvegarde des préférences de recherche
    document.getElementById('save-search').addEventListener('click', async () => {
      const newConfig = {
        ...config,
        showSearchBox: showSearchYes.checked,
        searchEngine: document.querySelector('input[name="searchEngine"]:checked').value
      };
      
      await chrome.storage.sync.set({ config: newConfig });
      showNotification('Préférences de recherche sauvegardées', 'success');
    });
    
    // Soumission du formulaire de recherche
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const query = searchInput.value.trim();
      if (!query) return;
      
      let searchUrl;
      const forumQuery = `site:forum.canardpc.com ${query}`;
      
      switch (config.searchEngine) {
        case 'duckduckgo':
          searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(forumQuery)}`;
          break;
        case 'qwant':
          searchUrl = `https://www.qwant.com/?q=${encodeURIComponent(forumQuery)}`;
          break;
        case 'google':
          searchUrl = `https://www.google.com/search?q=${encodeURIComponent(forumQuery)}`;
          break;
        default:
          searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(forumQuery)}`;
      }
      
      chrome.tabs.create({ url: searchUrl });
    });
  }

  // Extraction des informations du HTML du forum
function extractPrivateMessages(doc) {
    const messages = [];
    const pmContainer = doc.querySelector('.private-messages');
    
    if (!pmContainer) return messages;
    
    const pmLinks = pmContainer.querySelectorAll('a');
    
    pmLinks.forEach(link => {
      if (link.href.includes('showpm')) {
        // Extraction de l'ID du message
        const pmId = new URL(link.href).searchParams.get('pmid');
        // Extraction du titre et de l'expéditeur
        const title = link.textContent.trim();
        const senderEl = link.closest('.pm-item').querySelector('.sender');
        const sender = senderEl ? senderEl.textContent.trim() : 'Inconnu';
        
        messages.push({
          id: pmId,
          title: title,
          sender: sender
        });
      }
    });
    
    return messages;
  }
  
  function extractFollowedDiscussions(doc) {
    const discussions = [];
    const subscriptionsContainer = doc.querySelector('.subscriptions');
    
    if (!subscriptionsContainer) return discussions;
    
    const threadRows = subscriptionsContainer.querySelectorAll('.thread-row');
    
    threadRows.forEach(row => {
      const linkEl = row.querySelector('a.thread-title');
      if (!linkEl) return;
      
      // Extraction de l'ID de la discussion
      const href = linkEl.href;
      const threadId = new URL(href).searchParams.get('t');
      
      // Vérification des nouveaux messages
      const hasNew = row.classList.contains('has-new');
      const newCountEl = row.querySelector('.new-count');
      const newCount = newCountEl ? parseInt(newCountEl.textContent.trim()) : 0;
      
      discussions.push({
        id: threadId,
        title: linkEl.textContent.trim(),
        hasNewMessages: hasNew,
        newCount: newCount
      });
    });
    
    return discussions;
  }