// options.js
document.addEventListener('DOMContentLoaded', async () => {
    // Charger la configuration actuelle
    const { config = {} } = await chrome.storage.sync.get('config');
    const { favorites = { bookmarks: [], lastUpdated: 0 } } = await chrome.storage.sync.get('favorites');
    
    // Définir les valeurs par défaut si nécessaire
    const defaultConfig = {
      displayMode: 'popup',
      interval: 5,
      notifyPrivate: true,
      notifyDiscussions: true,
      clickBehavior: 'open',
      protocol: 'http',
      clearCookies: false,
      useFavorites: true,
      syncFavorites: false,
      quickFavorites: true,
      hideIgnored: false,
      theme: 'light',
      discussionFormat: 'compact',
      showSearch: true,
      searchEngine: 'duckduckgo',
      searchInTitles: true,
      openInNewTab: true,
      debugMode: false
    };
    
    // Fusionner les configurations
    const mergedConfig = { ...defaultConfig, ...config };
    
    // Appliquer le thème
    document.body.setAttribute('data-theme', mergedConfig.theme);
    
    // Remplir le formulaire général
    document.querySelector(`input[name="displayMode"][value="${mergedConfig.displayMode}"]`).checked = true;
    document.getElementById('interval').value = mergedConfig.interval;
    document.getElementById('interval-value').textContent = `${mergedConfig.interval} minutes`;
    document.querySelector('input[name="notifyPrivate"]').checked = mergedConfig.notifyPrivate;
    document.querySelector('input[name="notifyDiscussions"]').checked = mergedConfig.notifyDiscussions;
    document.querySelector(`input[name="clickBehavior"][value="${mergedConfig.clickBehavior}"]`).checked = true;
    
    // Remplir le formulaire de connexion
    document.querySelector(`input[name="protocol"][value="${mergedConfig.protocol}"]`).checked = true;
    document.querySelector('input[name="clearCookies"]').checked = mergedConfig.clearCookies;
    
    // Remplir le formulaire des favoris
    document.querySelector(`input[name="useFavorites"][value="${mergedConfig.useFavorites ? 'yes' : 'no'}"]`).checked = true;
    document.querySelector(`input[name="syncFavorites"][value="${mergedConfig.syncFavorites ? 'yes' : 'no'}"]`).checked = true;
    document.getElementById('favorites-backup').value = JSON.stringify(favorites, null, 2);
    document.querySelector('input[name="quickFavorites"]').checked = mergedConfig.quickFavorites;
    
    // Remplir le formulaire d'apparence
    document.querySelector('input[name="hideIgnored"]').checked = mergedConfig.hideIgnored;
    document.querySelector(`input[name="theme"][value="${mergedConfig.theme}"]`).checked = true;
    document.querySelector(`input[name="discussionFormat"][value="${mergedConfig.discussionFormat}"]`).checked = true;
    
    // Remplir le formulaire de recherche
    document.querySelector(`input[name="showSearch"][value="${mergedConfig.showSearch ? 'yes' : 'no'}"]`).checked = true;
    document.querySelector(`input[name="searchEngine"][value="${mergedConfig.searchEngine}"]`).checked = true;
    document.querySelector('input[name="searchInTitles"]').checked = mergedConfig.searchInTitles;
    document.querySelector('input[name="openInNewTab"]').checked = mergedConfig.openInNewTab;
    
    // Remplir le formulaire avancé
    document.querySelector('input[name="debugMode"]').checked = mergedConfig.debugMode;
    
    // Event listeners
    
    // Mise à jour dynamique de l'affichage de l'intervalle
    document.getElementById('interval').addEventListener('input', (e) => {
      document.getElementById('interval-value').textContent = `${e.target.value} minutes`;
    });
    
    // Formulaire général
    document.getElementById('general-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const newConfig = {
        ...mergedConfig,
        displayMode: formData.get('displayMode'),
        interval: parseInt(formData.get('interval')),
        notifyPrivate: formData.get('notifyPrivate') === 'on',
        notifyDiscussions: formData.get('notifyDiscussions') === 'on',
        clickBehavior: formData.get('clickBehavior')
      };
      
      await saveConfig(newConfig);
      showNotification('Paramètres généraux sauvegardés');
    });
    
    // Formulaire de connexion
    document.getElementById('connection-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const newConfig = {
        ...mergedConfig,
        protocol: formData.get('protocol'),
        clearCookies: formData.get('clearCookies') === 'on'
      };
      
      await saveConfig(newConfig);
      showNotification('Paramètres de connexion sauvegardés');
    });
    
    // Formulaire des favoris
    document.getElementById('favorites-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const newConfig = {
        ...mergedConfig,
        useFavorites: formData.get('useFavorites') === 'yes',
        syncFavorites: formData.get('syncFavorites') === 'yes',
        quickFavorites: formData.get('quickFavorites') === 'on'
      };
      
      await saveConfig(newConfig);
      showNotification('Paramètres des favoris sauvegardés');
    });
    
    // Formulaire d'apparence
    document.getElementById('appearance-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const newConfig = {
        ...mergedConfig,
        hideIgnored: formData.get('hideIgnored') === 'on',
        theme: formData.get('theme'),
        discussionFormat: formData.get('discussionFormat')
      };
      
      await saveConfig(newConfig);
      document.body.setAttribute('data-theme', newConfig.theme);
      showNotification('Paramètres d\'apparence sauvegardés');
    });
    
    // Formulaire de recherche
    document.getElementById('search-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const newConfig = {
        ...mergedConfig,
        showSearch: formData.get('showSearch') === 'yes',
        searchEngine: formData.get('searchEngine'),
        searchInTitles: formData.get('searchInTitles') === 'on',
        openInNewTab: formData.get('openInNewTab') === 'on'
      };
      
      await saveConfig(newConfig);
      showNotification('Paramètres de recherche sauvegardés');
    });
    
    // Boutons de gestion des favoris
    document.getElementById('copy-favorites').addEventListener('click', () => {
      const textarea = document.getElementById('favorites-backup');
      textarea.select();
      document.execCommand('copy');
      showNotification('Contenu copié dans le presse-papier');
    });
    
    document.getElementById('paste-favorites').addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        document.getElementById('favorites-backup').value = text;
      } catch (error) {
        showNotification('Erreur lors de la lecture du presse-papier', 'error');
      }
    });
    
    document.getElementById('save-favorites').addEventListener('click', async () => {
      try {
        const favoritesText = document.getElementById('favorites-backup').value;
        const favoritesData = JSON.parse(favoritesText);
        
        await chrome.storage.sync.set({ favorites: favoritesData });
        showNotification('Favoris sauvegardés avec succès');
      } catch (error) {
        showNotification('Erreur: Format JSON invalide', 'error');
      }
    });
    
    // Boutons avancés
    document.getElementById('clear-cache').addEventListener('click', async () => {
      await chrome.storage.local.clear();
      showNotification('Cache vidé avec succès');
    });
    
    document.getElementById('reset-settings').addEventListener('click', async () => {
      if (confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres ?')) {
        await chrome.storage.sync.set({ config: defaultConfig });
        location.reload();
      }
    });
  });
  
  // Fonction utilitaire pour enregistrer la configuration
  async function saveConfig(newConfig) {
    await chrome.storage.sync.set({ config: newConfig });
    
    // Notifier le service worker du changement
    chrome.runtime.sendMessage({ action: 'configUpdated' });
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