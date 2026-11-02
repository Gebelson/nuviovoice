(function() {
  var hasBooted = false;
  var bootTimer = null;

  function bindButtons() {
    var btnReload = document.getElementById('nuvio-btn-reload');
    if (btnReload && !btnReload._bound) {
      btnReload._bound = true;
      btnReload.addEventListener('click', function() {
        window.__nuvioRecover(false);
      });
    }
    var btnUpdate = document.getElementById('nuvio-btn-update');
    if (btnUpdate && !btnUpdate._bound) {
      btnUpdate._bound = true;
      btnUpdate.addEventListener('click', function() {
        window.__nuvioRecover(true);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButtons);
  } else {
    bindButtons();
  }

  window.__nuvioMarkBooted = function() {
    hasBooted = true;
    if (bootTimer) {
      clearTimeout(bootTimer);
      bootTimer = null;
    }
    var fallback = document.getElementById('nuvio-boot-fallback');
    if (fallback) {
      fallback.style.display = 'none';
    }
  };

  window.__nuvioShowFallback = function(customMsg, force) {
    if (hasBooted && !force) return;
    var root = document.getElementById('root');
    // If React has rendered content and not forced, do not show fallback
    if (!force && root && root.children.length > 0 && root.querySelector('.bg-surface-elevated, nav, main, form')) {
      hasBooted = true;
      return;
    }
    var fallback = document.getElementById('nuvio-boot-fallback');
    var msgEl = document.getElementById('nuvio-fallback-msg');
    if (customMsg && msgEl) {
      msgEl.textContent = customMsg;
    }
    if (fallback) {
      fallback.style.display = 'flex';
      bindButtons();
    }
  };

  window.__nuvioRecover = function(clearSwAndCache) {
    if (clearSwAndCache) {
      var tasks = [];
      if ('serviceWorker' in navigator) {
        tasks.push(
          navigator.serviceWorker.getRegistrations().then(function(regs) {
            return Promise.all(regs.map(function(r) { return r.unregister(); }));
          }).catch(function() {})
        );
      }
      if ('caches' in window) {
        tasks.push(
          caches.keys().then(function(keys) {
            return Promise.all(keys.map(function(k) { return caches.delete(k); }));
          }).catch(function() {})
        );
      }
      Promise.all(tasks).finally(function() {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  // Watchdog: If #root is still empty after 6.5 seconds, display fallback UI
  bootTimer = setTimeout(function() {
    window.__nuvioShowFallback('O carregamento dos recursos demorou mais que o esperado ou foi interrompido.');
  }, 6500);

  // Catch top-level JavaScript, module load errors, and script resource failures (useCapture: true)
  window.addEventListener('error', function(event) {
    if (!hasBooted) {
      var target = event.target || event.srcElement;
      if (target && target.tagName === 'SCRIPT') {
        var src = target.src || 'módulo';
        console.error('[Nuvio Boot Watchdog] Falha de recurso de script:', src);
        window.__nuvioShowFallback('Não foi possível carregar os scripts da aplicação: ' + src, true);
        return;
      }
      var err = event.error;
      var msg = (err && err.message) || event.message || 'Falha ao executar script';
      console.error('[Nuvio Boot Watchdog] Erro de execução detectado:', event);
      window.__nuvioShowFallback('Falha crítica ao executar módulo da aplicação: ' + msg, true);
    }
  }, true);

  // Catch unhandled promise rejections before mount
  window.addEventListener('unhandledrejection', function(event) {
    if (!hasBooted) {
      var reason = event.reason;
      var msg = (reason && (reason.message || reason.toString())) || 'Rejeição assíncrona';
      console.error('[Nuvio Boot Watchdog] Rejeição assíncrona antes do boot:', reason);
      if (typeof msg === 'string' && (msg.includes('module') || msg.includes('chunk') || msg.includes('import') || msg.includes('SyntaxError') || msg.includes('Failed to fetch') || msg.includes('404'))) {
        window.__nuvioShowFallback('Falha ao carregar componente da aplicação: ' + msg, true);
      }
    }
  });

  // Handle Vite dynamic import / preload failures
  window.addEventListener('vite:preloadError', function(event) {
    console.warn('[Nuvio Boot Watchdog] Vite preload error detectado:', event);
    var key = 'nuvio_last_preload_reload';
    var last = sessionStorage.getItem(key);
    var now = Date.now();
    if (!last || now - parseInt(last, 10) > 10000) {
      sessionStorage.setItem(key, String(now));
      window.location.reload();
    } else {
      window.__nuvioShowFallback('Uma nova versão do Nuvio foi implantada. Por favor, atualize o cache da aplicação.', true);
    }
  });
})();
