(function () {
  var cloudStorageKey = 'casa-cloud-account';
  var cloudBaseUrl = window.CASA_CLOUD_CONSOLE_URL || '/cloud';
  var pendingRequests = {};
  var socket = null;
  var pusherForm = document.querySelector('[data-pusher-form]');
  var pusherNote = document.querySelector('[data-pusher-note]');
  var runtimeAction = document.querySelector('[data-runtime-action]');
  var pusherTitle = document.querySelector('[data-pusher-title]');
  var pusherCopy = document.querySelector('[data-pusher-copy]');
  var pusherStatus = document.querySelector('[data-pusher-status]');
  var pusherSummary = document.querySelector('[data-pusher-summary]');
  var runtimeGang = document.querySelector('[data-runtime-gang]');
  var gangShort = document.querySelector('[data-gang-short]');
  var cloudSignupPanel = document.querySelector('[data-cloud-signup-panel]');
  var cloudManagePanel = document.querySelector('[data-cloud-manage-panel]');
  var cloudTitle = document.querySelector('[data-cloud-title]');
  var cloudCopy = document.querySelector('[data-cloud-copy]');
  var cloudName = document.querySelector('[data-cloud-name]');
  var cloudStatus = document.querySelector('[data-cloud-status]');
  var cloudOrganisation = document.querySelector('[data-cloud-organisation]');
  var cloudPlan = document.querySelector('[data-cloud-plan]');
  var cloudSignup = document.querySelector('[data-cloud-signup]');
  var cloudSignin = document.querySelector('[data-cloud-signin]');
  var cloudOpen = document.querySelector('[data-cloud-open]');
  var cloudSignout = document.querySelector('[data-cloud-signout]');
  var piImageDownload = document.querySelector('[data-pi-image-download]');
  var piImageNote = document.querySelector('[data-pi-image-note]');

  function setCloudLink(element, path) {
    if (element) {
      element.setAttribute('href', cloudBaseUrl.replace(/\/$/, '') + path);
    }
  }

  function getStoredCloudAccount() {
    var value;

    try {
      value = window.localStorage.getItem(cloudStorageKey);
    } catch (_error) {
      return null;
    }

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }

  function normaliseCloudAccount(value) {
    var account;

    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      account = {
        name: value,
        organisation: value
      };
    } else if (typeof value === 'object') {
      account = {
        name: String(value.name || value.account || value.organisation || '').trim(),
        organisation: String(value.organisation || value.name || '').trim(),
        plan: String(value.plan || '').trim(),
        consoleUrl: String(value.consoleUrl || '').trim()
      };
    } else {
      return null;
    }

    if (!account.name && !account.organisation) {
      return null;
    }

    if (!account.name) {
      account.name = account.organisation;
    }

    if (!account.organisation) {
      account.organisation = account.name;
    }

    return account;
  }

  function setPusherNote(message) {
    if (pusherNote) {
      pusherNote.textContent = message || '';
    }
  }

  function readPusherForm() {
    var formData = new FormData(pusherForm);

    return {
      appId: String(formData.get('appId') || '').trim(),
      key: String(formData.get('key') || '').trim(),
      secret: String(formData.get('secret') || '').trim(),
      cluster: String(formData.get('cluster') || '').trim()
    };
  }

  function renderPusher(config) {
    var configured = !!(config && config.configured);

    if (pusherTitle) {
      pusherTitle.textContent = configured ? 'Private remote access is configured.' : 'Add private remote access for this gang.';
    }

    if (pusherCopy) {
      pusherCopy.textContent = configured ?
        'Credentials are saved in this gang\'s private access service definition.' :
        'The free runtime uses your own access credentials to enable monitoring, support, and recovery.';
    }

    if (pusherStatus) {
      pusherStatus.textContent = configured ? 'Private remote access is configured.' : 'Private remote access is not configured.';
    }

    if (pusherSummary) {
      pusherSummary.textContent = configured ?
        'App ID ' + (config.appId || '-') + ', key ' + (config.key || '-') + ', cluster ' + (config.cluster || '-') + '. Restart the runtime after changes if the service is already running.' :
        'Private remote access is waiting for account details.';
    }

    if (runtimeAction) {
      runtimeAction.textContent = configured ? 'Open Runtime Console' : 'Configure Private Access';
      runtimeAction.setAttribute('href', configured ? '/webui/index.html' : '#remote-access');
    }

    if (pusherForm && configured) {
      pusherForm.elements.appId.value = config.appId || '';
      pusherForm.elements.key.value = config.key || '';
      pusherForm.elements.cluster.value = config.cluster || '';
      pusherForm.elements.secret.value = '';
      pusherForm.elements.secret.placeholder = config.secret ? 'configured' : 'app-secret';
    }
  }

  function renderGangName(gangName) {
    if (!gangName) {
      return;
    }

    if (runtimeGang) {
      runtimeGang.textContent = gangName;
      runtimeGang.setAttribute('title', gangName);
    }

    if (gangShort) {
      gangShort.textContent = gangName.length > 12 ? gangName.slice(0, 11) + '...' : gangName;
      gangShort.setAttribute('title', gangName);
    }

  }

  function renderCloudAccount(account) {
    var connected = !!account;

    if (cloudSignupPanel) {
      cloudSignupPanel.hidden = connected;
    }

    if (cloudManagePanel) {
      cloudManagePanel.hidden = !connected;
    }

    if (cloudTitle) {
      cloudTitle.textContent = connected ? 'Casa Cloud account is connected.' : 'Use Casa Cloud when one gang becomes many.';
    }

    if (cloudCopy) {
      cloudCopy.textContent = connected ?
        'Use the hosted cloud console for people, billing, monitoring, installers, and multi-gang management.' :
        'Create a paid cloud account when you want shared management across gangs, installers, relatives, monitoring users, and alerts.';
    }

    if (!connected) {
      return;
    }

    if (cloudName) {
      cloudName.textContent = account.name;
    }

    if (cloudStatus) {
      cloudStatus.textContent = 'Cloud account session is stored in this browser.';
    }

    if (cloudOrganisation) {
      cloudOrganisation.textContent = account.organisation || '-';
    }

    if (cloudPlan) {
      cloudPlan.textContent = account.plan || 'Cloud';
    }

    if (cloudOpen && account.consoleUrl) {
      cloudOpen.setAttribute('href', account.consoleUrl);
    }
  }

  function nextRequestId() {
    return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }

  function executeCommand(targetSocket, payload, callback) {
    var id = nextRequestId();

    pendingRequests[id] = callback;
    payload.id = id;
    targetSocket.emit('executeCommand', payload);
  }

  function loadRuntimeState() {
    if (typeof io !== 'function') {
      renderPusher(null);
      renderCloudAccount(normaliseCloudAccount(getStoredCloudAccount()));
      return;
    }

    socket = io('/webuiapi/io', {
      transports: ['websocket']
    });

    function loadCloudAccount() {
      renderCloudAccount(normaliseCloudAccount(getStoredCloudAccount()));
    }

    socket.on('connect', function () {
      socket.emit('getWebUiStatus', {});

      executeCommand(socket, {
        obj: ':',
        method: 'pusher',
        arguments: []
      }, function (payload) {
        if (payload && payload.ok && payload.result) {
          renderPusher(payload.result);
        } else {
          renderPusher(null);
        }

        loadCloudAccount();
      });
    });

    socket.on('webui-status', function (payload) {
      renderGangName(payload && payload.gangName ? payload.gangName : null);
    });

    socket.on('execute-output', function (payload) {
      var callback;

      if (!payload || !payload.id || !pendingRequests[payload.id]) {
        return;
      }

      callback = pendingRequests[payload.id];
      delete pendingRequests[payload.id];
      callback(payload);
    });

    socket.on('connect_error', function () {
      renderPusher(null);
      renderCloudAccount(normaliseCloudAccount(getStoredCloudAccount()));
    });
  }

  function submitPusherForm(event) {
    var values;

    event.preventDefault();
    values = readPusherForm();

    if (!values.appId || !values.key || !values.secret || !values.cluster) {
      setPusherNote('Enter all private access credentials.');
      return;
    }

    if (!socket || !socket.connected) {
      setPusherNote('Runtime API is not connected.');
      return;
    }

    setPusherNote('Saving private access details...');
    executeCommand(socket, {
      obj: ':',
      method: 'pusher',
      arguments: [
        'set',
        '--id', values.appId,
        '--key', values.key,
        '--secret', values.secret,
        '--cluster', values.cluster
      ]
    }, function (payload) {
      if (!payload || !payload.ok) {
        setPusherNote((payload && payload.error) ? String(payload.error) : 'Unable to save private access details.');
        return;
      }

      setPusherNote(payload.result && payload.result.restartRequired ? 'Saved. Restart the runtime for the running private access service to use the new credentials.' : 'Saved.');
      renderPusher(payload.result);
    });
  }

  function clearStoredCloudAccount() {
    try {
      window.localStorage.removeItem(cloudStorageKey);
    } catch (_error) {
      return;
    }

    renderCloudAccount(null);
  }

  setCloudLink(cloudSignup, '/signup');
  setCloudLink(cloudSignin, '/signin');
  setCloudLink(cloudOpen, '');
  setCloudLink(cloudSignout, '/signout');

  if (pusherForm) {
    pusherForm.addEventListener('submit', submitPusherForm);
  }

  if (cloudSignout) {
    cloudSignout.addEventListener('click', clearStoredCloudAccount);
  }

  if (piImageDownload) {
    piImageDownload.addEventListener('click', function (event) {
      event.preventDefault();

      if (piImageNote) {
        piImageNote.textContent = 'Pi image download will be added here.';
      }
    });
  }

  loadRuntimeState();
})();
