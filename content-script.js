(function() {
    // Ne s'exécute que sur les pages du forum CanardPC
    if (!window.location.hostname.includes('forum.canardpc.com')) {
      return;
    }
    
    // Détection de l'état de connexion
    function checkLoginStatus() {
      const welcomeBox = document.querySelector('.welcomelink, .welcome-box, .userinfo');
      const isLoggedIn = !!welcomeBox;
      
      // Informer l'extension de l'état de connexion
      chrome.runtime.sendMessage({
        action: 'updateLoginStatus',
        isLoggedIn: isLoggedIn
      });
      
      return isLoggedIn;
    }
    
    // Ajouter des boutons d'action rapide
    function addQuickActions() {
      // Vérifier si nous sommes sur la page de suivi des discussions
      if (window.location.href.includes('subscription.php')) {
        const actionBar = document.querySelector('.actionbar, .threadlist-actions, .subscription-controls');
        
        if (actionBar) {
          // Ajouter un bouton pour mettre à jour l'extension
          const updateButton = document.createElement('button');
          updateButton.className = 'cpc-checker-button';
          updateButton.textContent = 'Mettre à jour CPC Checker';
          updateButton.title = 'Mettre à jour les informations dans CPC Checker';
          
          updateButton.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'checkNow' });
          });
          
          actionBar.appendChild(updateButton);
        }
      }
    }
    
    // Ajouter un style CSS pour les éléments de l'extension
    function addStyles() {
      const style = document.createElement('style');
      style.textContent = `
        .cpc-checker-button {
          margin-left: 10px;
          padding: 3px 8px;
          background-color: #f0f0f0;
          border: 1px solid #ccc;
          border-radius: 3px;
          cursor: pointer;
        }
        
        .cpc-checker-button:hover {
          background-color: #e0e0e0;
        }
        
        .cpc-checker-status {
          display: inline-block;
          margin-left: 5px;
          padding: 2px 5px;
          border-radius: 3px;
          font-size: 11px;
          background-color: #e8f5e9;
          color: #388e3c;
        }
      `;
      
      document.head.appendChild(style);
    }
    
    // Initialisation
    function init() {
      const isLoggedIn = checkLoginStatus();
      
      if (isLoggedIn) {
        addStyles();
        addQuickActions();
      }
      
      // Signaler que la page est prête
      chrome.runtime.sendMessage({
        action: 'pageReady',
        url: window.location.href
      });
    }
    
    // Attendre que la page soit chargée
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();