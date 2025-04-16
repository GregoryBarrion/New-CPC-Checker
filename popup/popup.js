// popup/popup.js - Version mise à jour pour traiter le HTML brut
document.addEventListener('DOMContentLoaded', async () => {
  // Charger les données
  const data = await chrome.storage.local.get([
    'lastCheck', 
    'rawHtml', 
    'searchHtml',
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
    statusMessage.textContent = data.error;
    statusMessage.classList.add('error');
  } else if (!data.isLoggedIn) {
    statusMessage.innerHTML = `
      Vous n'êtes pas connecté au forum. 
      <a href="${baseUrl}/login.php" target="_blank">Se connecter</a>
    `;
    statusMessage.classList.add('error');
  } else {
    const lastCheckDate = data.lastCheck ? new Date(data.lastCheck) : new Date();
    statusMessage.textContent = `Dernière vérification: ${lastCheckDate.toLocaleString()}`;
    statusMessage.classList.remove('error');
  }
  
  // Traiter le HTML avec DOMParser (disponible dans le popup)
  let privateMessages = [];
  let discussions = [];
  
  if (data.rawHtml && data.isLoggedIn) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.rawHtml, 'text/html');
    
    // Extraction des messages privés
    privateMessages = extractPrivateMessages(doc);
  }
  
  // Extraire les discussions non lues de la page de recherche
  if (data.searchHtml && data.isLoggedIn) {
    discussions = extractUnreadTopicsVb61(data.searchHtml);
  }
  
  // Affichage des messages privés (code existant)...
  
  // Affichage des discussions suivies
  const discussionsList = document.getElementById('discussions-list');
  const discussionsCount = document.getElementById('discussions-count');
  
  if (discussions && discussions.length > 0) {
    discussionsCount.textContent = discussions.length;
    discussionsList.innerHTML = '';
    
    discussions.forEach(discussion => {
      const li = document.createElement('li');
      li.className = 'new';
      
      // Créer le contenu HTML avec plus d'informations
      li.innerHTML = `
        <div class="discussion-item">
          ${discussion.prefix ? `<span class="discussion-prefix">${discussion.prefix}</span>` : ''}
          <a href="${discussion.firstUnreadUrl || discussion.url}" class="discussion-title" target="_blank">
            ${discussion.title}
          </a>
          <div class="discussion-meta">
            ${discussion.forum ? `<span class="discussion-forum">${discussion.forum}</span>` : ''}
            ${discussion.postsCount ? `<span class="discussion-count">${discussion.postsCount}</span>` : ''}
          </div>
          <div class="discussion-last-post">
            <span class="discussion-last-post-info">
              ${discussion.lastPostAuthor ? `par ${discussion.lastPostAuthor}` : ''}
              ${discussion.lastPostDate ? `- ${discussion.lastPostDate}` : ''}
            </span>
            ${discussion.lastPostUrl ? `<a href="${discussion.lastPostUrl}" class="go-to-last" target="_blank" title="Aller au dernier message">»</a>` : ''}
          </div>
        </div>
      `;
      
      discussionsList.appendChild(li);
    });
  } else {
    discussionsCount.textContent = '0';
    discussionsList.innerHTML = '<li class="empty">Aucune discussion non lue</li>';
  }

    // Ensuite afficher celles sans nouveaux messages (limité à 10)
    const readDiscussions = discussions
      .filter(d => !d.hasNewMessages)
      .slice(0, 10);
    
    readDiscussions.forEach(discussion => {
      const li = document.createElement('li');
      li.innerHTML = `
        <a href="${baseUrl}/showthread.php?t=${discussion.id}" target="_blank">
          ${discussion.title}
        </a>
      `;
      discussionsList.appendChild(li);
    });
    
    // Si aucune discussion suivie
    if (discussions.length === 0) {
      discussionsList.innerHTML = '<li class="empty">Aucune discussion suivie</li>';
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
        statusMessage.textContent = result.error || 'Erreur lors de la vérification';
        statusMessage.classList.add('error');
        refreshButton.disabled = false;
        refreshButton.textContent = 'Rafraîchir maintenant';
      }
    } catch (error) {
      statusMessage.textContent = `Erreur: ${error.message}`;
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
        statusMessage.textContent = result.error || 'Erreur lors du marquage comme lu';
        statusMessage.classList.add('error');
        markButton.disabled = false;
        markButton.textContent = 'Marquer tout comme lu';
      }
    } catch (error) {
      statusMessage.textContent = `Erreur: ${error.message}`;
      statusMessage.classList.add('error');
      markButton.disabled = false;
      markButton.textContent = 'Marquer tout comme lu';
    }
  });
  
  document.getElementById('open-forum').addEventListener('click', () => {
    chrome.tabs.create({ url: baseUrl });
  });

  document.getElementById('view-all-discussions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ 
      url: `${baseUrl}/search?searchJSON=%7B%22view%22%3A%22topic%22%2C%22sort%22%3A%7B%22lastcontent%22%3A%22desc%22%7D%2C%22exclude_type%22%3A%5B%22vBForum_PrivateMessage%22%5D%2C%22my_following%22%3A%221%22%7D` 
    });
  });
  
  // Initialisation des autres onglets
  initConfigTab(config);
  initFavoritesTab();
  initSearchTab(config);
  initHelpTab();
});

function extractUnreadTopics(doc) {
  const discussions = [];
  
  // Dans vBulletin 6.1.1, les résultats de recherche sont généralement dans une liste
  const searchResults = doc.querySelectorAll('.searchresult, .search-result, .topics-list > li, .b-topic');
  
  searchResults.forEach(result => {
    // Chercher le lien vers la discussion
    const titleLink = result.querySelector('a.title, .topic-title > a, h3 > a, .topic_title a');
    
    if (titleLink) {
      const title = titleLink.textContent.trim();
      const url = titleLink.href;
      
      // Informations supplémentaires
      let lastPost = '';
      const lastPostEl = result.querySelector('.lastpost, .latest-post, .topic_lastpost');
      if (lastPostEl) {
        lastPost = lastPostEl.textContent.trim();
      }
      
      discussions.push({
        title: title,
        url: url,
        lastPost: lastPost,
        hasNewMessages: true
      });
    }
  });
  
  // Si aucun résultat n'est trouvé avec la méthode ci-dessus, essayons une approche alternative
  if (discussions.length === 0) {
    // Recherche plus générique pour les titres de discussions
    const allThreadLinks = doc.querySelectorAll('a[href*="showthread.php"], a[href*="threads/"]');
    
    allThreadLinks.forEach(link => {
      // Vérifier si c'est un titre (généralement dans un h3, div.title, etc.)
      const isTitle = link.closest('h3, .title, .threadtitle, .topic-title') || 
                    link.classList.contains('title');
      
      if (isTitle) {
        const title = link.textContent.trim();
        const url = link.href;
        
        // Éviter les doublons
        const isDuplicate = discussions.some(d => d.title === title);
        
        if (!isDuplicate) {
          discussions.push({
            title: title,
            url: url,
            hasNewMessages: true
          });
        }
      }
    });
  }
  
  return discussions;
}

// Analyser le HTML pour extraire les données des messages privés
function extractPrivateMessages(doc) {
  const messages = [];
  
  // Méthode 1: recherche dans la section des messages privés (format standard vBulletin)
  const pmSection = doc.querySelector('#pmfolders, .pm-folder, .private-messages');
  
  if (pmSection) {
    const pmLinks = pmSection.querySelectorAll('a[href*="private.php"]');
    
    pmLinks.forEach(link => {
      if (link.href.includes('showpm')) {
        // Extraire l'ID à partir de l'URL
        const pmIdMatch = link.href.match(/pmid=(\d+)/);
        const pmId = pmIdMatch ? pmIdMatch[1] : '';
        
        // Titre du message (texte du lien)
        const title = link.textContent.trim();
        
        // Trouver l'expéditeur (peut être différent selon la structure HTML)
        let sender = '';
        const parentRow = link.closest('tr, li, .pm-row');
        if (parentRow) {
          const senderElement = parentRow.querySelector('.username, .sender, .from');
          if (senderElement) {
            sender = senderElement.textContent.trim();
          }
        }
        
        // Vérifier si c'est un nouveau message
        const isNew = parentRow ? (
          parentRow.classList.contains('unread') || 
          parentRow.querySelector('.unread, .new')
        ) : false;
        
        if (isNew && pmId) {
          messages.push({
            id: pmId,
            title: title,
            sender: sender || 'Inconnu'
          });
        }
      }
    });
  }
  
  // Si pas de messages trouvés avec la méthode standard, essayer une autre approche
  if (messages.length === 0) {
    // Recherche plus générale de messages privés non lus
    const unreadPMs = doc.querySelectorAll('.unread-pm, .pm-unread, tr.unread, li.unread');
    
    unreadPMs.forEach(item => {
      const link = item.querySelector('a[href*="private.php"]');
      if (link && link.href.includes('showpm')) {
        const pmIdMatch = link.href.match(/pmid=(\d+)/);
        const pmId = pmIdMatch ? pmIdMatch[1] : '';
        
        if (pmId) {
          const title = link.textContent.trim();
          let sender = 'Inconnu';
          
          const senderElement = item.querySelector('.username, .sender, .from');
          if (senderElement) {
            sender = senderElement.textContent.trim();
          }
          
          messages.push({
            id: pmId,
            title: title,
            sender: sender
          });
        }
      }
    });
  }
  
  return messages;
}

// Analyser le HTML pour extraire les données des discussions suivies
function extractFollowedDiscussions(doc) {
  const discussions = [];
  
  // Recherche dans la section des abonnements (plusieurs formats possibles)
  const subscriptionsSection = doc.querySelector('#subscriptions, .subscriptionlist, .subscription-list');
  
  if (subscriptionsSection) {
    // Trouver toutes les lignes de discussions
    const threadRows = subscriptionsSection.querySelectorAll('tr, li, .thread-item');
    
    threadRows.forEach(row => {
      // Trouver le lien vers la discussion
      const threadLink = row.querySelector('a[href*="showthread.php"]');
      
      if (threadLink) {
        // Extraire l'ID de la discussion
        const threadIdMatch = threadLink.href.match(/t=(\d+)/);
        const threadId = threadIdMatch ? threadIdMatch[1] : '';
        
        if (threadId) {
          // Titre de la discussion
          const title = threadLink.textContent.trim();
          
          // Vérifier s'il y a de nouveaux messages
          const hasNewPosts = row.classList.contains('unread') || 
                           row.querySelector('.unread, .new-posts, .new');
          
          // Nombre de nouveaux messages (si disponible)
          let newCount = 0;
          const countElement = row.querySelector('.new-count, .unread-count');
          if (countElement) {
            const countMatch = countElement.textContent.trim().match(/\d+/);
            if (countMatch) {
              newCount = parseInt(countMatch[0], 10);
            }
          }
          
          discussions.push({
            id: threadId,
            title: title,
            hasNewMessages: !!hasNewPosts,
            newCount: newCount || (hasNewPosts ? 1 : 0)
          });
        }
      }
    });
  }
  
  // Si aucune discussion n'a été trouvée, essayer une approche plus générale
  if (discussions.length === 0) {
    // Chercher dans toute la page pour les discussions suivies
    const allThreadLinks = doc.querySelectorAll('a[href*="showthread.php"]');
    
    allThreadLinks.forEach(link => {
      // Ne garder que les liens qui semblent être des titres de discussion
      const isTitle = link.closest('h3, .title, .threadtitle') || 
                     (link.parentElement && link.parentElement.tagName.toLowerCase() === 'td');
      
      if (isTitle) {
        const threadIdMatch = link.href.match(/t=(\d+)/);
        const threadId = threadIdMatch ? threadIdMatch[1] : '';
        
        if (threadId) {
          const title = link.textContent.trim();
          const parentRow = link.closest('tr, li, .thread-item');
          
          const hasNewPosts = parentRow ? (
            parentRow.classList.contains('unread') || 
            parentRow.querySelector('.unread, .new-posts, .new')
          ) : false;
          
          discussions.push({
            id: threadId,
            title: title,
            hasNewMessages: hasNewPosts,
            newCount: hasNewPosts ? 1 : 0
          });
        }
      }
    });
  }
  
  return discussions;
}

// Fonctions pour initialiser les différents onglets
// (conserver les fonctions du code précédent)
  
  // Fonctions pour initialiser les différents onglets
  function initConfigTab(config) {
    // Remplir les champs de configuration avec les valeurs actuelles
    document.querySelector('input[name="showAsPopup"]').checked = config.showAsPopup;
    document.getElementById('refresh-interval').value = config.refreshInterval;
    document.querySelector('input[name="httpAccess"]').checked = !config.useHttps;
    document.querySelector('input[name="hideIgnoredPosts"]').checked = config.hideIgnoredPosts;
    
    // Écouter les changements
    document.getElementById('config-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newConfig = {
        ...config,
        showAsPopup: document.querySelector('input[name="showAsPopup"]').checked,
        refreshInterval: parseInt(document.getElementById('refresh-interval').value),
        useHttps: document.querySelector('input[name="httpsAccess"]').value,
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

  // Ajouter ces fonctions à votre popup.js existant

// Initialisation de l'onglet de recherche
function initSearchTab(config) {
    // Récupérer les éléments du formulaire
    const searchForm = document.getElementById('forum-search-form');
    const searchInput = document.getElementById('search-query');
    const titlesOnly = document.getElementById('search-titles-only');
    const engineOptions = document.querySelectorAll('.search-engine-option');
    const showSearchYes = document.querySelector('input[name="showSearch"][value="yes"]');
    const showSearchNo = document.querySelector('input[name="showSearch"][value="no"]');
    const engineRadios = document.querySelectorAll('input[name="searchEngine"]');
    
    // Définir le moteur actif
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
    
    // Initialiser les valeurs du formulaire d'options
    showSearchYes.checked = config.showSearch;
    showSearchNo.checked = !config.showSearch;
    
    document.querySelector(`input[name="searchEngine"][value="${config.searchEngine}"]`).checked = true;
    
    // Charger les recherches récentes
    loadRecentSearches();
    
    // Listener pour le formulaire de recherche
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const query = searchInput.value.trim();
      if (!query) return;
      
      const activeEngine = document.querySelector('.search-engine-option.active').dataset.engine;
      const titlesOnlyChecked = titlesOnly.checked;
      
      // Construire l'URL de recherche
      const searchUrl = buildSearchUrl(query, activeEngine, titlesOnlyChecked);
      
      // Sauvegarder dans l'historique des recherches
      saveSearchToHistory(query);
      
      // Ouvrir la recherche dans un nouvel onglet
      chrome.tabs.create({ url: searchUrl });
    });
    
    // Listener pour sauvegarder les options de recherche
    document.getElementById('save-search-options').addEventListener('click', async () => {
      const newConfig = {
        ...config,
        showSearch: showSearchYes.checked,
        searchEngine: document.querySelector('input[name="searchEngine"]:checked').value
      };
      
      await chrome.storage.sync.set({ config: newConfig });
      
      // Notifier le service worker
      chrome.runtime.sendMessage({ action: 'configUpdated' });
      
      // Afficher une notification
      const notification = document.createElement('div');
      notification.className = 'notification success';
      notification.textContent = 'Options de recherche sauvegardées';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    });
    
    // Listener pour effacer l'historique des recherches
    document.getElementById('clear-search-history').addEventListener('click', async () => {
      await chrome.storage.local.remove('recentSearches');
      document.getElementById('recent-searches').innerHTML = '';
    });
  }
  
  // Construire l'URL de recherche
  function buildSearchUrl(query, engine, titlesOnly) {
    const sitePrefix = titlesOnly ? 'intitle:' : '';
    const searchTerm = `${sitePrefix}site:forum.canardpc.com ${query}`;
    
    switch (engine) {
      case 'duckduckgo':
        return `https://duckduckgo.com/?q=${encodeURIComponent(searchTerm)}`;
      case 'qwant':
        return `https://www.qwant.com/?q=${encodeURIComponent(searchTerm)}`;
      case 'google':
        return `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`;
      default:
        return `https://duckduckgo.com/?q=${encodeURIComponent(searchTerm)}`;
    }
  }
  
  // Sauvegarder une recherche dans l'historique
  async function saveSearchToHistory(query) {
    const { recentSearches = [] } = await chrome.storage.local.get('recentSearches');
    
    // Ne pas dupliquer les recherches
    if (!recentSearches.includes(query)) {
      // Limiter à 10 recherches récentes
      const updatedSearches = [query, ...recentSearches.slice(0, 9)];
      await chrome.storage.local.set({ recentSearches: updatedSearches });
    }
  }
  
  // Charger les recherches récentes
  async function loadRecentSearches() {
    const { recentSearches = [] } = await chrome.storage.local.get('recentSearches');
    const recentSearchesList = document.getElementById('recent-searches');
    
    recentSearchesList.innerHTML = '';
    
    if (recentSearches.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'empty-list';
      emptyItem.textContent = 'Aucune recherche récente';
      recentSearchesList.appendChild(emptyItem);
      return;
    }
    
    recentSearches.forEach(search => {
      const li = document.createElement('li');
      li.className = 'recent-search-item';
      
      const searchLink = document.createElement('a');
      searchLink.textContent = search;
      searchLink.href = '#';
      searchLink.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('search-query').value = search;
      });
      
      li.appendChild(searchLink);
      recentSearchesList.appendChild(li);
    });
  }
  
  // Initialisation de l'onglet des favoris
  function initFavoritesTab() {
    // À implémenter si nécessaire
  }
  
  // Initialisation de l'onglet d'aide
  function initHelpTab() {
    // Pas besoin de logique particulière, juste afficher le contenu statique
  }

  function extractUnreadTopicsVb61(html) {
    const discussions = [];
    
    // Créer un document temporaire pour parcourir le HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Trouver tous les éléments de discussion non lus
    // D'après le HTML, chaque ligne est un <tr class="topic-item unread...">
    const unreadTopics = doc.querySelectorAll('tr.topic-item.unread');
    
    unreadTopics.forEach(topic => {
      // Extraire le titre et l'URL
      const titleElement = topic.querySelector('.topic-title');
      if (!titleElement) return;
      
      const title = titleElement.textContent.trim();
      const url = titleElement.getAttribute('href');
      
      // Extraire le lien vers le premier message non lu
      const firstUnreadLink = topic.querySelector('.go-to-first-unread');
      const firstUnreadUrl = firstUnreadLink ? firstUnreadLink.getAttribute('href') : null;
      
      // Extraire le lien vers le dernier message
      const lastPostLink = topic.querySelector('.go-to-last-post');
      const lastPostUrl = lastPostLink ? lastPostLink.getAttribute('href') : null;
      
      // Extraire les informations sur le dernier message
      const lastPostAuthor = topic.querySelector('.lastpost-by a');
      const lastPostDate = topic.querySelector('.post-date');
      
      // Extraire le nombre de réponses
      const postsCountElement = topic.querySelector('.posts-count');
      const postsCount = postsCountElement ? postsCountElement.textContent.trim() : '';
      
      // Préfixe (Important, etc.)
      const prefixElement = topic.querySelector('.topic-prefix');
      const prefix = prefixElement ? prefixElement.textContent.trim() : '';
      
      // Informations sur le forum
      const forumElement = topic.querySelector('.channel-info a');
      const forum = forumElement ? forumElement.textContent.trim() : '';
      
      discussions.push({
        title: title,
        url: url,
        firstUnreadUrl: firstUnreadUrl,
        lastPostUrl: lastPostUrl,
        lastPostAuthor: lastPostAuthor ? lastPostAuthor.textContent.trim() : '',
        lastPostDate: lastPostDate ? lastPostDate.textContent.trim() : '',
        postsCount: postsCount,
        prefix: prefix,
        forum: forum,
        hasNewMessages: true
      });
    });
    
    return discussions;
  }

  document.getElementById('view-all-subscriptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ 
      url: `${baseUrl}/search?searchJSON=%7B%22view%22%3A%22topic%22%2C%22sort%22%3A%7B%22lastcontent%22%3A%22desc%22%7D%2C%22exclude_type%22%3A%5B%22vBForum_PrivateMessage%22%5D%2C%22my_following%22%3A%221%22%7D` 
    });
  });
  
  document.getElementById('view-unread-subscriptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ 
      url: `${baseUrl}/search?searchJSON=%7B%22view%22%3A%22topic%22%2C%22unread_only%22%3A1%2C%22sort%22%3A%7B%22lastcontent%22%3A%22desc%22%7D%2C%22exclude_type%22%3A%5B%22vBForum_PrivateMessage%22%5D%2C%22my_following%22%3A%221%22%7D` 
    });
  });