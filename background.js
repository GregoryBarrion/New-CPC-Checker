// popup.js - Version complète et corrigée
document.addEventListener('DOMContentLoaded', async () => {
  // Charger les données
  const data = await chrome.storage.local.get([
    'lastCheck', 
    'searchHtml',
    'messagesHtml',
    'unreadMessagesCount',
    'isLoggedIn', 
    'error'
  ]);
  
  const { config } = await chrome.storage.sync.get('config');
  const baseUrl = config.useHttps ? 'https://forum.canardpc.com' : 'http://forum.canardpc.com';
  
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
  
  if (data.error) {
    statusMessage.innerHTML = `
      <div class="error-box">
        <div class="error-icon">⚠️</div>
        <div class="error-content">
          <strong>Erreur</strong><br>
          ${data.error}
          <div class="login-actions">
            <a href="${baseUrl}/login.php" target="_blank" class="login-link">Se connecter</a>
            <button id="check-login" class="check-button">Vérifier la connexion</button>
          </div>
        </div>
      </div>
    `;
    statusMessage.classList.add('error');
  } else if (!data.isLoggedIn) {
    statusMessage.innerHTML = `
      <div class="error-box">
        <div class="error-icon">⚠️</div>
        <div class="error-content">
          <strong>Non connecté</strong><br>
          Vous n'êtes pas connecté au forum.
          <div class="login-actions">
            <a href="${baseUrl}/login.php" target="_blank" class="login-link">Se connecter</a>
            <button id="check-login" class="check-button">Vérifier la connexion</button>
          </div>
        </div>
      </div>
    `;
    statusMessage.classList.add('error');
  } else {
    const lastCheckDate = data.lastCheck ? new Date(data.lastCheck) : new Date();
    statusMessage.textContent = `Dernière vérification: ${lastCheckDate.toLocaleString()}`;
    statusMessage.classList.remove('error');
  }
  
  // Configurer le bouton de vérification de connexion si présent
  const checkLoginBtn = document.getElementById('check-login');
  if (checkLoginBtn) {
    checkLoginBtn.addEventListener('click', checkLoginStatus);
  }
  
  // Traiter le HTML avec DOMParser uniquement si on est connecté
  let privateMessages = [];
  let discussions = [];
  
  // Extraire les messages privés
  if (data.messagesHtml && data.isLoggedIn) {
    privateMessages = extractPrivateMessages(data.messagesHtml);
    console.log('Messages privés extraits:', privateMessages.length);
  }
  
  // Extraire les discussions non lues
  if (data.searchHtml && data.isLoggedIn) {
    discussions = extractUnreadTopics(data.searchHtml);
    console.log('Discussions non lues extraites:', discussions.length);
  }
  
  // Affichage des messages privés
  const privateMessagesList = document.getElementById('private-messages-list');
  const privateCount = document.getElementById('private-count');
  
  if (privateMessages && privateMessages.length > 0) {
    privateCount.textContent = privateMessages.length;
    privateMessagesList.innerHTML = '';
    
    privateMessages.forEach(message => {
      const li = document.createElement('li');
      li.className = 'new';
      li.innerHTML = `
        <div class="message-item">
          <a href="${message.url || `${baseUrl}/messagecenter/index`}" target="_blank" class="message-title">
            ${message.title}
          </a>
          <div class="message-info">
            <span class="message-sender">De: ${message.sender}</span>
            ${message.date ? `<span class="message-date">${message.date}</span>` : ''}
          </div>
        </div>
      `;
      privateMessagesList.appendChild(li);
    });
  } else if (data.unreadMessagesCount && data.unreadMessagesCount > 0) {
    // Fallback si nous avons juste le compteur sans détails
    privateCount.textContent = data.unreadMessagesCount;
    privateMessagesList.innerHTML = `
      <li class="empty">Vous avez ${data.unreadMessagesCount} message(s) non lu(s). 
      <a href="${baseUrl}/messagecenter/index" target="_blank">Voir les messages</a></li>
    `;
  } else {
    privateCount.textContent = '0';
    privateMessagesList.innerHTML = '<li class="empty">Aucun nouveau message privé</li>';
  }
  
  // Affichage des discussions
  const discussionsList = document.getElementById('discussions-list');
  const discussionsCount = document.getElementById('discussions-count');
  
  if (discussions && discussions.length > 0) {
    discussionsCount.textContent = discussions.length;
    discussionsList.innerHTML = '';
    
    discussions.forEach(discussion => {
      const li = document.createElement('li');
      li.className = 'new';
      
      const url = discussion.url || discussion.firstUnreadUrl || `${baseUrl}/showthread.php?t=${discussion.id}`;
      
      li.innerHTML = `
        <div class="discussion-item">
          ${discussion.prefix ? `<span class="discussion-prefix">${discussion.prefix}</span>` : ''}
          <a href="${url}" target="_blank" class="discussion-title">
            ${discussion.title}
          </a>
          ${discussion.forum ? `<div class="discussion-meta"><span class="discussion-forum">${discussion.forum}</span></div>` : ''}
          ${discussion.lastPostAuthor ? `
            <div class="discussion-last-post">
              <span>Par: ${discussion.lastPostAuthor}</span>
              ${discussion.lastPostDate ? `<span>${discussion.lastPostDate}</span>` : ''}
              ${discussion.lastPostUrl ? `<a href="${discussion.lastPostUrl}" class="go-to-last" target="_blank">»</a>` : ''}
            </div>
          ` : ''}
        </div>
      `;
      
      discussionsList.appendChild(li);
    });
  } else {
    discussionsCount.textContent = '0';
    discussionsList.innerHTML = '<li class="empty">Aucune discussion non lue</li>';
  }
  
  // Gestion des boutons d'action
  document.getElementById('refresh-now').addEventListener('click', async () => {
    statusMessage.textContent = 'Vérification en cours...';
    statusMessage.classList.remove('error');
    
    const refreshButton = document.getElementById('refresh-now');
    refreshButton.disabled = true;
    refreshButton.textContent = 'Vérification...';
    
    try {
      const result = await chrome.runtime.sendMessage({ action: 'checkNow' });
      
      if (result && result.success) {
        // Recharger la popup pour afficher les nouvelles données
        location.reload();
      } else {
        statusMessage.innerHTML = `
          <div class="error-box">
            <div class="error-icon">⚠️</div>
            <div class="error-content">
              <strong>Erreur</strong><br>
              ${result.error || 'Erreur lors de la vérification'}
              <button id="check-login" class="check-button">Vérifier la connexion</button>
            </div>
          </div>
        `;
        statusMessage.classList.add('error');
        refreshButton.disabled = false;
        refreshButton.textContent = 'Rafraîchir maintenant';
        
        // Ajouter le gestionnaire d'événement pour le nouveau bouton
        document.getElementById('check-login').addEventListener('click', checkLoginStatus);
      }
    } catch (error) {
      statusMessage.innerHTML = `
        <div class="error-box">
          <div class="error-icon">⚠️</div>
          <div class="error-content">
            <strong>Erreur</strong><br>
            ${error.message || 'Erreur inconnue'}
          </div>
        </div>
      `;
      statusMessage.classList.add('error');
      refreshButton.disabled = false;
      refreshButton.textContent = 'Rafraîchir maintenant';
    }
  });
  
  document.getElementById('mark-read').addEventListener('click', async () => {
    statusMessage.textContent = 'Marquage en cours...';
    statusMessage.classList.remove('error');
    
    const markButton = document.getElementById('mark-read');
    markButton.disabled = true;
    markButton.textContent = 'Marquage...';
    
    try {
      const result = await chrome.runtime.sendMessage({ action: 'markAllRead' });
      
      if (result && result.success) {
        // Recharger la popup pour afficher les nouvelles données
        location.reload();
      } else {
        statusMessage.innerHTML = `
          <div class="error-box">
            <div class="error-icon">⚠️</div>
            <div class="error-content">
              <strong>Erreur</strong><br>
              ${result.error || 'Erreur lors du marquage comme lu'}
            </div>
          </div>
        `;
        statusMessage.classList.add('error');
        markButton.disabled = false;
        markButton.textContent = 'Marquer tout comme lu';
      }
    } catch (error) {
      statusMessage.innerHTML = `
        <div class="error-box">
          <div class="error-icon">⚠️</div>
          <div class="error-content">
            <strong>Erreur</strong><br>
            ${error.message || 'Erreur inconnue'}
          </div>
        </div>
      `;
      statusMessage.classList.add('error');
      markButton.disabled = false;
      markButton.textContent = 'Marquer tout comme lu';
    }
  });
  
  document.getElementById('open-forum').addEventListener('click', () => {
    chrome.tabs.create({ url: baseUrl });
  });

  // Lien vers les discussions suivies
  document.getElementById('view-all-discussions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ 
      url: `${baseUrl}/search?searchJSON=%7B%22view%22%3A%22topic%22%2C%22sort%22%3A%7B%22lastcontent%22%3A%22desc%22%7D%2C%22exclude_type%22%3A%5B%22vBForum_PrivateMessage%22%5D%2C%22my_following%22%3A%221%22%7D` 
    });
  });

  // Ajouter le lien vers les messages privés s'il n'existe pas déjà
  const privateMessagesSection = document.getElementById('private-messages');
  if (privateMessagesSection && !privateMessagesSection.querySelector('.section-actions')) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'section-actions';
    actionsDiv.innerHTML = `
      <a href="${baseUrl}/messagecenter/index" target="_blank" class="action-link">Voir tous les messages</a>
    `;
    privateMessagesSection.appendChild(actionsDiv);
  }
  
  // Initialisation des autres onglets
  initConfigTab(config);
  initFavoritesTab();
  initSearchTab(config);
  initHelpTab();
});

// Fonction pour vérifier l'état de connexion
async function checkLoginStatus() {
  const statusMessage = document.getElementById('status-message');
  statusMessage.textContent = 'Vérification de la connexion...';
  statusMessage.classList.remove('error', 'warning');
  
  try {
    document.getElementById('refresh-now').disabled = true;
    const checkLoginBtn = document.getElementById('check-login');
    if (checkLoginBtn) checkLoginBtn.disabled = true;
    
    const result = await chrome.runtime.sendMessage({ action: 'checkLoginStatus' });
    
    if (result && result.isLoggedIn) {
      statusMessage.textContent = 'Connecté! Récupération des données...';
      
      // Déclencher une vérification complète
      await chrome.runtime.sendMessage({ action: 'checkNow' });
      
      // Recharger la popup après une courte pause
      setTimeout(() => location.reload(), 1000);
    } else {
      const { config } = await chrome.storage.sync.get('config');
      const baseUrl = config.useHttps ? 'https://forum.canardpc.com' : 'http://forum.canardpc.com';
      
      statusMessage.innerHTML = `
        <div class="error-box">
          <div class="error-icon">⚠️</div>
          <div class="error-content">
            <strong>Non connecté</strong><br>
            Vous n'êtes pas connecté au forum.
            <div class="login-actions">
              <a href="${baseUrl}/login.php" target="_blank" class="login-link">Se connecter</a>
              <button id="check-login" class="check-button">Vérifier à nouveau</button>
            </div>
          </div>
        </div>
      `;
      statusMessage.classList.add('error');
      
      if (checkLoginBtn) checkLoginBtn.disabled = false;
      document.getElementById('check-login').addEventListener('click', checkLoginStatus);
    }
  } catch (error) {
    statusMessage.innerHTML = `
      <div class="error-box">
        <div class="error-icon">⚠️</div>
        <div class="error-content">
          <strong>Erreur</strong><br>
          ${error.message || 'Erreur inconnue'}
          <button id="check-login" class="check-button">Réessayer</button>
        </div>
      </div>
    `;
    statusMessage.classList.add('error');
    
    const checkLoginBtn = document.getElementById('check-login');
    if (checkLoginBtn) checkLoginBtn.disabled = false;
    document.getElementById('check-login').addEventListener('click', checkLoginStatus);
  } finally {
    document.getElementById('refresh-now').disabled = false;
  }
}

// Fonction unifiée d'extraction des discussions non lues
function extractUnreadTopics(html) {
  // Créer un document temporaire pour parcourir le HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Trouver tous les éléments de discussion non lus
  const unreadTopics = doc.querySelectorAll('tr.topic-item.unread, .topic-item.unread, .topic.unread');
  console.log('Nombre d\'éléments de discussion trouvés:', unreadTopics.length);
  
  const discussions = [];
  
  unreadTopics.forEach(topic => {
    // Extraire le titre
    const titleElement = topic.querySelector('.topic-title, .title a, h3 a');
    if (!titleElement) return;
    
    const title = titleElement.textContent.trim();
    const url = titleElement.getAttribute('href');
    
    // Extraire d'autres informations si disponibles
    const prefixElement = topic.querySelector('.topic-prefix');
    const prefix = prefixElement ? prefixElement.textContent.trim() : '';
    
    const lastPostAuthorElement = topic.querySelector('.lastpost-by a, .last-post-by');
    const lastPostAuthor = lastPostAuthorElement ? lastPostAuthorElement.textContent.trim() : '';
    
    const lastPostDateElement = topic.querySelector('.post-date, .date');
    const lastPostDate = lastPostDateElement ? lastPostDateElement.textContent.trim() : '';
    
    const forumElement = topic.querySelector('.channel-info a, .forum-name');
    const forum = forumElement ? forumElement.textContent.trim() : '';
    
    // Liens pour premier message non lu et dernier message
    const firstUnreadLink = topic.querySelector('.go-to-first-unread, a[href*="goto=newpost"]');
    const firstUnreadUrl = firstUnreadLink ? firstUnreadLink.getAttribute('href') : null;
    
    const lastPostLink = topic.querySelector('.go-to-last-post, a[href*="p="]');
    const lastPostUrl = lastPostLink ? lastPostLink.getAttribute('href') : null;
    
    discussions.push({
      title: title,
      url: url,
      firstUnreadUrl: firstUnreadUrl,
      lastPostUrl: lastPostUrl,
      lastPostAuthor: lastPostAuthor,
      lastPostDate: lastPostDate,
      prefix: prefix,
      forum: forum,
      hasNewMessages: true
    });
  });
  
  // Si aucune discussion n'a été trouvée avec la méthode précise, utiliser une approche plus générale
  if (discussions.length === 0) {
    console.log('Pas de discussions trouvées avec la méthode spécifique, tentative avec approche générale');
    const allLinks = doc.querySelectorAll('a[href*="showthread.php"], a[href*="threads/"]');
    
    allLinks.forEach(link => {
      if (!link.closest('h3, .topic-title, .title') && !link.classList.contains('topic-title')) return;
      
      const title = link.textContent.trim();
      const url = link.getAttribute('href');
      
      // Vérifier si ce n'est pas un doublon
      const isDuplicate = discussions.some(d => d.title === title);
      if (isDuplicate) return;
      
      discussions.push({
        title: title,
        url: url,
        hasNewMessages: true
      });
    });
  }
  
  return discussions;
}

// Fonction unifiée d'extraction des messages privés
function extractPrivateMessages(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const messages = [];
  
  // Rechercher les messages non lus
  const unreadMessages = doc.querySelectorAll('.unread-message, .message-row.unread, tr.unread, .message-item.unread, .message.unread');
  console.log('Nombre de messages privés trouvés:', unreadMessages.length);
  
  unreadMessages.forEach(message => {
    // Extraire les informations de base
    const titleElement = message.querySelector('.message-title, .title a, .subject a, a[href*="messagecenter"], a[href*="private.php"]');
    if (!titleElement) return;
    
    const title = titleElement.textContent.trim();
    const url = titleElement.getAttribute('href');
    
    const senderElement = message.querySelector('.message-sender, .sender, .username, .from');
    const sender = senderElement ? senderElement.textContent.trim() : 'Inconnu';
    
    const dateElement = message.querySelector('.message-date, .date, .lastpost, .sent-date');
    const date = dateElement ? dateElement.textContent.trim() : '';
    
    messages.push({
      title: title,
      url: url,
      sender: sender,
      date: date,
      isUnread: true
    });
  });
  
  // Si aucun message trouvé, tentative avec une méthode plus générale
  if (messages.length === 0) {
    console.log('Pas de messages trouvés avec la méthode spécifique, tentative avec approche générale');
    const allLinks = doc.querySelectorAll('a[href*="messagecenter"], a[href*="private.php"]');
    
    allLinks.forEach(link => {
      const parentRow = link.closest('tr, .message-row, .message-item');
      if (!parentRow || !parentRow.classList.contains('unread')) return;
      
      const title = link.textContent.trim();
      const url = link.getAttribute('href');
      
      // Éviter les doublons
      const isDuplicate = messages.some(m => m.title === title);
      if (isDuplicate) return;
      
      messages.push({
        title: title,
        url: url,
        sender: 'Inconnu',
        isUnread: true
      });
    });
  }
  
  return messages;
}

// Fonctions pour initialiser les différents onglets
function initConfigTab(config) {
  // Remplir les champs de configuration avec les valeurs actuelles
  const showAsPopupYes = document.querySelector('input[name="showAsPopup"][value="yes"]');
  const showAsPopupNo = document.querySelector('input[name="showAsPopup"][value="no"]');
  
  if (showAsPopupYes && showAsPopupNo) {
    showAsPopupYes.checked = config.showAsPopup;
    showAsPopupNo.checked = !config.showAsPopup;
  }
  
  const refreshInterval = document.getElementById('refresh-interval');
  if (refreshInterval) {
    refreshInterval.value = config.refreshInterval || 5;
  }
  
  const refreshValue = document.getElementById('refresh-value');
  if (refreshValue) {
    refreshValue.textContent = `${config.refreshInterval || 5} minutes`;
  }
  
  const httpAccess = document.querySelector('input[name="httpAccess"][value="false"]');
  const httpsAccess = document.querySelector('input[name="httpAccess"][value="true"]');
  
  if (httpAccess && httpsAccess) {
    httpAccess.checked = !config.useHttps;
    httpsAccess.checked = config.useHttps;
  }
  
  const hideIgnoredPosts = document.querySelector('input[name="hideIgnoredPosts"]');
  if (hideIgnoredPosts) {
    hideIgnoredPosts.checked = config.hideIgnoredPosts;
  }
  
  // Mettre à jour dynamiquement l'affichage de l'intervalle
  if (refreshInterval && refreshValue) {
    refreshInterval.addEventListener('input', (e) => {
      refreshValue.textContent = `${e.target.value} minutes`;
    });
  }
  
  // Écouter les changements
  const configForm = document.getElementById('config-form');
  if (configForm) {
    configForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newConfig = {
        ...config,
        showAsPopup: showAsPopupYes ? showAsPopupYes.checked : true,
        refreshInterval: refreshInterval ? parseInt(refreshInterval.value) : 5,
        useHttps: httpsAccess ? httpsAccess.checked : true,
        hideIgnoredPosts: hideIgnoredPosts ? hideIgnoredPosts.checked : false
      };
      
      await chrome.storage.sync.set({ config: newConfig });
      await chrome.runtime.sendMessage({ action: 'configUpdated' });
      
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
}

// Initialisation de l'onglet des favoris
function initFavoritesTab() {
  chrome.storage.sync.get(['config', 'favorites'], (data) => {
    const config = data.config || {};
    const favorites = data.favorites || { bookmarks: [], lastUpdated: 0 };
    
    const useFavoritesYes = document.querySelector('input[name="useFavorites"][value="yes"]');
    const useFavoritesNo = document.querySelector('input[name="useFavorites"][value="no"]');
    const syncFavoritesYes = document.querySelector('input[name="syncFavorites"][value="yes"]');
    const syncFavoritesNo = document.querySelector('input[name="syncFavorites"][value="no"]');
    const favoritesTextarea = document.getElementById('favorites-json');
    
    // Si les éléments existent, initialiser leurs valeurs
    if (useFavoritesYes && useFavoritesNo) {
      useFavoritesYes.checked = config.useFavorites !== false;
      useFavoritesNo.checked = config.useFavorites === false;
    }
    
    if (syncFavoritesYes && syncFavoritesNo) {
      syncFavoritesYes.checked = config.syncFavorites === true;
      syncFavoritesNo.checked = config.syncFavorites !== true;
    }
    
    if (favoritesTextarea) {
      favoritesTextarea.value = JSON.stringify(favorites, null, 2);
      
      // Sauvegarde des favoris
      const saveFavoritesBtn = document.getElementById('save-favorites');
      if (saveFavoritesBtn) {
        saveFavoritesBtn.addEventListener('click', async () => {
          try {
            const favoritesData = JSON.parse(favoritesTextarea.value);
            await chrome.storage.sync.set({ favorites: favoritesData });
            
            // Mise à jour de la config
            const newConfig = {
              ...config,
              useFavorites: useFavoritesYes ? useFavoritesYes.checked : true,
              syncFavorites: syncFavoritesYes ? syncFavoritesYes.checked : false
            };
            await chrome.storage.sync.set({ config: newConfig });
            
            // Message de confirmation
            showNotification('Favoris sauvegardés avec succès', 'success');
          } catch (error) {
            showNotification('Erreur: Format JSON invalide', 'error');
          }
        });
      }
      
      // Copier/coller
      const copyFavoritesBtn = document.getElementById('copy-favorites');
      if (copyFavoritesBtn) {
        copyFavoritesBtn.addEventListener('click', () => {
          favoritesTextarea.select();
          document.execCommand('copy');
          showNotification('Contenu copié dans le presse-papier', 'success');
        });
      }
      
      const pasteFavoritesBtn = document.getElementById('paste-favorites');
      if (pasteFavoritesBtn) {
        pasteFavoritesBtn.addEventListener('click', async () => {
          try {
            const text = await navigator.clipboard.readText();
            favoritesTextarea.value = text;
            showNotification('Contenu collé depuis le presse-papier', 'success');
          } catch (error) {
            showNotification('Erreur lors de la lecture du presse-papier', 'error');
          }
        });
      }
    }
  });
}

// Initialisation de l'onglet de recherche
function initSearchTab(config) {
  const searchForm = document.getElementById('forum-search-form');
  const searchQuery = document.getElementById('search-query');
  const searchTitlesOnly = document.getElementById('search-titles-only');
  const engineOptions = document.querySelectorAll('.search-engine-option');
  
  if (!searchForm || !searchQuery || !engineOptions.length) return;
  
  // Sélectionner le moteur actif
  engineOptions.forEach(option => {
    if (option.dataset.engine === config.searchEngine) {
      option.classList.add('active');
    }
    
    // Ajouter le listener pour changer de moteur
    option.addEventListener('click', () => {
      engineOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
    });
  });
  
  // Définir les options de recherche depuis la config
  if (searchTitlesOnly) {
    searchTitlesOnly.checked = config.searchInTitles !== false;
  }
  
  // Remplir le formulaire d'options
  const searchEngineRadios = document.querySelectorAll('input[name="searchEngine"]');
  if (searchEngineRadios.length) {
    searchEngineRadios.forEach(radio => {
      radio.checked = radio.value === config.searchEngine;
    });
  }
  
  // Soumission du formulaire de recherche
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const query = searchQuery.value.trim();
      if (!query) return;
      
      const activeEngine = document.querySelector('.search-engine-option.active');
      
      if (!activeEngine) return;
      
      const engineName = activeEngine.dataset.engine;
      const titlesOnlyChecked = searchTitlesOnly ? searchTitlesOnly.checked : false;
      
      // Construction de l'URL de recherche
      const sitePrefix = titlesOnlyChecked ? 'intitle:' : '';
      const searchTerm = `${sitePrefix}site:forum.canardpc.com ${query}`;
      
      let searchUrl;
      switch (engineName) {
        case 'qwant':
          searchUrl = `https://www.qwant.com/?q=${encodeURIComponent(searchTerm)}`;
          break;
        case 'google':
          searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`;
          break;
        case 'duckduckgo':
        default:
          searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchTerm)}`;
          break;
      }
      
      // Ouvrir dans un nouvel onglet
      chrome.tabs.create({ url: searchUrl });
      
      // Sauvegarder dans l'historique des recherches récentes
      saveSearchToHistory(query);
    });
  }
  
  // Sauvegarde des options de recherche
  const saveSearchOptionsBtn = document.getElementById('save-search-options');
  if (saveSearchOptionsBtn) {
    saveSearchOptionsBtn.addEventListener('click', async () => {
      const activeEngine = document.querySelector('.search-engine-option.active');
      const engineName = activeEngine ? activeEngine.dataset.engine : 'duckduckgo';
      
      const newConfig = {
        ...config,
        searchEngine: engineName,
        searchInTitles: searchTitlesOnly ? searchTitlesOnly.checked : true
      };
      
      await chrome.storage.sync.set({ config: newConfig });
      chrome.runtime.sendMessage({ action: 'configUpdated' });
      
      showNotification('Options de recherche sauvegardées', 'success');
    });
  }
}

// Sauvegarder une recherche dans l'historique
async function saveSearchToHistory(query) {
  if (!query) return;
  
  const { recentSearches = [] } = await chrome.storage.local.get('recentSearches');
  
  // Ne pas dupliquer les recherches
  if (!recentSearches.includes(query)) {
    // Limiter à 10 recherches récentes
    const updatedSearches = [query, ...recentSearches.slice(0, 9)];
    await chrome.storage.local.set({ recentSearches: updatedSearches });
  }
}

// Fonction pour afficher une notification
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Supprimer après l'animation
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Initialisation de l'onglet d'aide
function initHelpTab() {
  // Cet onglet est purement statique, pas besoin de code particulier
}