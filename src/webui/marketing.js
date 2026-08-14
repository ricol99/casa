(function () {
  var storageKey = 'casa-webui-organisation';
  var pendingRequests = {};
  var form = document.querySelector('[data-organisation-form]');
  var note = document.querySelector('[data-form-note]');
  var createPanel = document.querySelector('[data-create-panel]');
  var managePanel = document.querySelector('[data-manage-panel]');
  var organisationAction = document.querySelector('[data-organisation-action]');
  var organisationTitle = document.querySelector('[data-organisation-title]');
  var organisationCopy = document.querySelector('[data-organisation-copy]');
  var organisationName = document.querySelector('[data-organisation-name]');
  var organisationStatus = document.querySelector('[data-organisation-status]');
  var organisationSlug = document.querySelector('[data-organisation-slug]');
  var piImageDownload = document.querySelector('[data-pi-image-download]');
  var piImageNote = document.querySelector('[data-pi-image-note]');

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function getOrganisation() {
    var value;

    try {
      value = window.localStorage.getItem(storageKey);
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

  function normaliseOrganisation(value) {
    var organisation;

    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      organisation = {
        name: value,
        slug: slugify(value)
      };
    } else if (typeof value === 'object') {
      organisation = {
        name: String(value.name || value.organisation || '').trim(),
        slug: String(value.slug || '').trim(),
        pusher: value.pusher || null
      };
    } else {
      return null;
    }

    if (!organisation.name) {
      return null;
    }

    if (!organisation.slug) {
      organisation.slug = slugify(organisation.name);
    }

    return organisation;
  }

  function getStoredOrganisation() {
    return normaliseOrganisation(getOrganisation());
  }

  function saveOrganisation(organisation) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(organisation));
    } catch (_error) {
      return false;
    }

    return true;
  }

  function readForm() {
    var formData = new FormData(form);
    var name = String(formData.get('name') || '').trim();

    return {
      name: name,
      slug: slugify(name),
      pusher: {
        appId: String(formData.get('appId') || '').trim(),
        key: String(formData.get('key') || '').trim(),
        secret: String(formData.get('secret') || '').trim(),
        cluster: String(formData.get('cluster') || '').trim()
      }
    };
  }

  function setNote(message) {
    if (note) {
      note.textContent = message || '';
    }
  }

  function render(organisation, source) {

    if (arguments.length === 0) {
      organisation = getStoredOrganisation();
    }

    var hasOrganisation = !!organisation;

    if (createPanel) {
      createPanel.hidden = hasOrganisation;
    }

    if (managePanel) {
      managePanel.hidden = !hasOrganisation;
    }

    if (organisationTitle) {
      organisationTitle.textContent = hasOrganisation ? 'Organisation is defined.' : 'Start by defining the organisation.';
    }

    if (organisationCopy) {
      organisationCopy.textContent = hasOrganisation ?
        'This gang is already attached to one organisation. Management opens the console for this gang.' :
        'The organisation owns the management context and transport credentials.';
    }

    if (organisationAction) {
      organisationAction.textContent = hasOrganisation ? 'Manage ' + organisation.name : 'Create Organisation';
      organisationAction.setAttribute('href', hasOrganisation ? '/webui/index.html' : '#organisation');
    }

    if (!hasOrganisation) {
      return;
    }

    if (organisationName) {
      organisationName.textContent = organisation.name;
    }

    if (organisationStatus) {
      organisationStatus.textContent = source === 'gang' ?
        'Management context is defined for this gang.' :
        'Management context is defined for this browser.';
    }

    if (organisationSlug) {
      organisationSlug.textContent = organisation.slug || '-';
    }
  }

  function nextRequestId() {
    return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }

  function executeCommand(socket, payload, callback) {
    var id = nextRequestId();

    pendingRequests[id] = callback;
    payload.id = id;
    socket.emit('executeCommand', payload);
  }

  function loadGangOrganisation() {
    var socket;

    if (typeof io !== 'function') {
      render();
      return;
    }

    socket = io('/webuiapi/io', {
      transports: ['websocket']
    });

    socket.on('connect', function () {
      executeCommand(socket, {
        obj: ':',
        method: 'organisation',
        arguments: []
      }, function (payload) {
        var organisation = null;

        if (payload && payload.ok && payload.result) {
          organisation = normaliseOrganisation(payload.result.organisation);
        }

        render(organisation, 'gang');
      });
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
      render();
    });
  }

  function submitForm(event) {
    var organisation;

    event.preventDefault();
    organisation = readForm();

    if (!organisation.name) {
      setNote('Enter the organisation name.');
      return;
    }

    if (!organisation.slug) {
      setNote('Use at least one letter or number in the organisation name.');
      return;
    }

    if (!saveOrganisation(organisation)) {
      setNote('Unable to save organisation in this browser.');
      return;
    }

    setNote('');
    render(organisation);
  }

  if (form) {
    form.addEventListener('submit', submitForm);
  }

  if (piImageDownload) {
    piImageDownload.addEventListener('click', function (event) {
      event.preventDefault();

      if (piImageNote) {
        piImageNote.textContent = 'Pi image download will be added here.';
      }
    });
  }

  loadGangOrganisation();
})();
