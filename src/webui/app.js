(function () {
  var shellEl = document.querySelector('.webui-shell');
  var contextLabelEl = document.getElementById('webui-context-label');
  var pageTitleEl = document.getElementById('webui-page-title');
  var socketStatusEl = document.getElementById('socket-status');
  var selectedCasaLabelEl = document.getElementById('selected-casa-label');
  var casaListEl = document.getElementById('casa-list');
  var tabButtons = Array.from(document.querySelectorAll('[data-tab]'));
  var tabPanels = Array.from(document.querySelectorAll('[data-tab-panel]'));
  var consoleScopeLabelEl = document.getElementById('console-scope-label');
  var consolePromptLabelEl = document.getElementById('console-prompt-label');
  var consoleLineEl = document.getElementById('console-line');
  var consoleRunButton = document.getElementById('console-run-button');
  var consoleHintsEl = document.getElementById('console-hints');
  var consoleTranscriptEl = document.getElementById('console-transcript');
  var topologyRefreshButton = document.getElementById('topology-refresh-button');
  var topologyGangEl = document.getElementById('topology-gang');
  var topologyLocalEl = document.getElementById('topology-local');
  var topologyConnectedPeersEl = document.getElementById('topology-connected-peers');
  var topologyConnectivityLabelEl = document.getElementById('topology-connectivity-label');
  var topologyAgreementEl = document.getElementById('topology-agreement');
  var topologyAgreementLabelEl = document.getElementById('topology-agreement-label');
  var topologyTotalBowedEl = document.getElementById('topology-total-bowed');
  var topologyBowingLabelEl = document.getElementById('topology-bowing-label');
  var topologyLocalPrivateEl = document.getElementById('topology-local-private');
  var topologyPrivateLabelEl = document.getElementById('topology-private-label');
  var globalThingsBodyEl = document.getElementById('global-things-body');
  var globalConflictsBodyEl = document.getElementById('global-conflicts-body');
  var globalDetailHeadingEl = document.getElementById('global-detail-heading');
  var globalSelectedThingEl = document.getElementById('global-selected-thing');
  var globalDetailSummaryEl = document.getElementById('global-detail-summary');
  var globalDetailBodyEl = document.getElementById('global-detail-body');
  var sourcesRefreshButton = document.getElementById('sources-refresh-button');
  var sourcesPrefixEl = document.getElementById('sources-prefix');
  var sourcesTypeEl = document.getElementById('sources-type');
  var sourcesSearchEl = document.getElementById('sources-search');
  var sourcesActiveCountEl = document.getElementById('sources-active-count');
  var sourcesOwnedActiveCountEl = document.getElementById('sources-owned-active-count');
  var sourcesPeerActiveCountEl = document.getElementById('sources-peer-active-count');
  var sourcesBodyEl = document.getElementById('sources-body');
  var sourcesSelectedSourceEl = document.getElementById('sources-selected-source');
  var sourcesSummaryEl = document.getElementById('sources-summary');
  var sourcesDetailEl = document.getElementById('sources-detail');
  var designerRefreshButton = document.getElementById('designer-refresh-button');
  var designerTreeEl = document.getElementById('designer-tree');
  var designerDetailHeadingEl = document.getElementById('designer-detail-heading');
  var designerSelectedThingEl = document.getElementById('designer-selected-thing');
  var designerSummaryEl = document.getElementById('designer-summary');
  var designerDetailEl = document.getElementById('designer-detail');
  var latestWebUiStatus = null;
  var latestGlobalThings = null;
  var latestGlobalThingDetail = null;
  var latestGlobalThingRuntime = null;
  var latestSourceTrees = null;
  var latestConfiguredTree = null;
  var latestThingNodes = [];
  var selectedGlobalThingUName = '';
  var selectedActiveSourceUName = '';
  var selectedThingUName = '';
  var expandedThingNodes = new Set();
  var pendingRequests = {};
  var currentScope = ':';
  var currentSelectedCasa = '-';
  var activeTab = 'topology';
  var consoleHistory = [];
  var consoleHistoryIndex = -1;
  var consoleDraftLine = '';
  var consoleEntries = [
    { kind: 'system', text: 'Console is ready.' }
  ];
  var activeConsoleEntryId = null;

  function escapeHtmlAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }

  function setActiveTab(tabName) {
    activeTab = tabName;

    if (shellEl) {
      shellEl.setAttribute('data-active-tab', tabName);
    }

    if (contextLabelEl && pageTitleEl) {
      if (tabName === 'topology') {
        contextLabelEl.textContent = 'Gang Collective';
        pageTitleEl.textContent = 'Global Things';
      }
      else {
        contextLabelEl.textContent = 'Casa Context';
        pageTitleEl.textContent = 'Casa Detail';
      }
    }

    tabButtons.forEach(function (button) {
      var isActive = button.getAttribute('data-tab') === tabName;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    tabPanels.forEach(function (panel) {
      panel.classList.toggle('is-active', panel.getAttribute('data-tab-panel') === tabName);
    });
  }

  function setSocketStatus(state, label) {
    if (!socketStatusEl) {
      return;
    }

    socketStatusEl.dataset.state = state;
    socketStatusEl.textContent = label;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getConsolePrompt() {
    return '[' + (currentSelectedCasa || '-') + '] ' + currentScope + ' >';
  }

  function renderConsolePrompt() {
    consolePromptLabelEl.textContent = getConsolePrompt();
  }

  function renderConsoleTranscript() {
    if (!consoleEntries.length) {
      consoleTranscriptEl.innerHTML = '<div class="webui-console-line webui-console-line-system">Console is ready.</div>';
      return;
    }

    consoleTranscriptEl.innerHTML = consoleEntries.map(function (entry) {
      if (entry.kind === 'command') {
        var outputLines = entry.output && entry.output.length
          ? entry.output.map(function (line) {
              return '<div class="webui-console-line webui-console-line-output">' + escapeHtml(line) + '</div>';
            }).join('')
          : '';

        return '<div class="webui-console-entry">' +
          '<div class="webui-console-line webui-console-line-command">' +
            '<span class="webui-console-prompt-text">' + escapeHtml(entry.prompt) + '</span>' +
            '<span class="webui-console-command-text">' + escapeHtml(entry.line) + '</span>' +
          '</div>' +
          outputLines +
        '</div>';
      }

      return '<div class="webui-console-line webui-console-line-system">' + escapeHtml(entry.text) + '</div>';
    }).join('');

    consoleTranscriptEl.scrollTop = consoleTranscriptEl.scrollHeight;
  }

  function addConsoleSystemLine(value) {
    consoleEntries.push({ kind: 'system', text: String(value) });
    renderConsoleTranscript();
  }

  function beginConsoleCommand(line) {
    var id = nextRequestId();
    consoleEntries.push({
      id: id,
      kind: 'command',
      prompt: getConsolePrompt(),
      line: line,
      output: []
    });
    activeConsoleEntryId = id;
    renderConsoleTranscript();
    return id;
  }

  function appendConsoleCommandOutput(value) {
    var text = String(value);

    if (!activeConsoleEntryId) {
      addConsoleSystemLine(text);
      return;
    }

    for (var i = consoleEntries.length - 1; i >= 0; --i) {
      if (consoleEntries[i].id === activeConsoleEntryId) {
        consoleEntries[i].output.push(text);
        renderConsoleTranscript();
        return;
      }
    }

    addConsoleSystemLine(text);
  }

  function setConsoleScope(scope) {
    currentScope = scope || ':';
    consoleScopeLabelEl.textContent = currentScope;
    renderConsolePrompt();
  }

  function setConsoleHints(matches) {
    if (!matches || !matches.length) {
      consoleHintsEl.dataset.empty = 'true';
      consoleHintsEl.textContent = '';
      return;
    }

    consoleHintsEl.dataset.empty = 'false';
    consoleHintsEl.textContent = matches.join('   ');
  }

  function nextRequestId() {
    var id = String(Date.now()) + '-' + Math.random().toString(16).slice(2);
    return id;
  }

  function emitWithReply(eventName, payload, callback) {
    var id = nextRequestId();
    pendingRequests[id] = callback;
    payload.id = id;
    socket.emit(eventName, payload);
  }

  function sendCommand(payload, callback) {
    emitWithReply('executeCommand', {
      targetCasa: payload && payload.targetCasa ? payload.targetCasa : null,
      obj: payload.obj,
      method: payload.method,
      arguments: payload.arguments || []
    }, callback);
  }

  function setSelectedCasaLabel(name) {
    currentSelectedCasa = name || '-';
    selectedCasaLabelEl.textContent = currentSelectedCasa;
    renderConsolePrompt();
  }

  function clearSourceFilters() {
    sourcesPrefixEl.value = '';
    sourcesTypeEl.value = '';
    sourcesSearchEl.value = '';
  }

  function drillIntoCasaSource(casaName, sourceUName) {
    if (!casaName || !sourceUName || !socket.connected) {
      return;
    }

    clearSourceFilters();
    selectedActiveSourceUName = sourceUName;
    setActiveTab('sources');
    setSelectedCasaLabel(casaName);
    sourcesDetailEl.innerHTML = '<div class="webui-empty">Opening ' + escapeHtml(sourceUName) + ' on ' + escapeHtml(casaName) + '...</div>';
    socket.emit('setSelectedCasa', { selectedCasa: casaName });
  }

  function renderCasas(payload) {
    latestWebUiStatus = payload || null;

    var casas = payload && payload.casas ? payload.casas : [];
    var selectedCasa = payload ? payload.selectedCasa : null;

    casaListEl.innerHTML = '';

    if (!casas.length) {
      casaListEl.innerHTML = '<span class="webui-empty">No connected casas yet.</span>';
      setSelectedCasaLabel(selectedCasa);
      return;
    }

    casas.forEach(function (casa) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'webui-casa-chip';
      button.dataset.selected = String(casa.name === selectedCasa);
      button.innerHTML = '<span>' + casa.name + '</span><small>' + (casa.connected ? 'connected' : 'disconnected') + '</small>';
      button.addEventListener('click', function () {
        socket.emit('setSelectedCasa', { selectedCasa: casa.name });
      });
      casaListEl.appendChild(button);
    });

    setSelectedCasaLabel(selectedCasa);
  }

  function collectThingNodes(node) {
    if (!node || !node.myNamedObjects) {
      return [];
    }

    var rows = [];

    Object.values(node.myNamedObjects).forEach(function (child) {
      if (!child) {
        return;
      }

      if (child.superType === 'thing' && child.uName) {
        rows.push({
          uName: child.uName,
          name: child.name || child.uName,
          type: child.type || 'thing',
          ignoreParent: !!child.ignoreParent,
          ignoreChildren: !!child.ignoreChildren,
          propagateToParent: !!child.propagateToParent,
          propagateToChildren: !!child.propagateToChildren,
          topLevelThing: !!child.topLevelThing,
          children: collectThingNodes(child)
        });
        return;
      }

      rows = rows.concat(collectThingNodes(child));
    });

    rows.sort(function (a, b) {
      return a.uName.localeCompare(b.uName);
    });

    return rows;
  }

  function findThingPath(nodes, targetUName) {
    for (var i = 0; i < nodes.length; ++i) {
      var node = nodes[i];

      if (node.uName === targetUName) {
        return [node.uName];
      }

      var childPath = findThingPath(node.children, targetUName);
      if (childPath.length) {
        return [node.uName].concat(childPath);
      }
    }

    return [];
  }

  function treeContains(nodes, targetUName) {
    return findThingPath(nodes, targetUName).length > 0;
  }

  function findFirstThingUName(nodes) {
    if (!nodes.length) {
      return '';
    }

    return nodes[0].uName;
  }

  function branchLaneState(offered, blocked) {
    if (!offered) {
      return 'offered';
    }

    return blocked ? 'blocked' : 'open';
  }

  function branchConnectorMarkup(parentNode, childNode, isLastChild) {
    var downState = branchLaneState(parentNode.propagateToChildren, childNode.ignoreParent);
    var upState = branchLaneState(childNode.propagateToParent, parentNode.ignoreChildren);
    var width = 76;
    var height = 54;
    var trunkX = 10;
    var rightX = 73;
    var topY = 18;
    var bottomY = 36;
    var middleY = 27;
    var openLineStart = 10;
    var openLineEnd = 70;
    var childSideStart = 32;
    var parentOfferedEnd = 32;
    var parentBlockX = 18;

    function laneClass(state) {
      return 'webui-designer-branch-svg-lane webui-designer-branch-svg-lane-' + state;
    }

    function arrowHead(direction, x, y, className) {
      var points = direction === 'right'
        ? x + ',' + y + ' ' + (x - 7) + ',' + (y - 5) + ' ' + (x - 7) + ',' + (y + 5)
        : x + ',' + y + ' ' + (x + 7) + ',' + (y - 5) + ' ' + (x + 7) + ',' + (y + 5);
      return '<polygon points="' + points + '" class="' + className + '"></polygon>';
    }

    function blockMark(x, y, className) {
      return '<g class="' + className + '">' +
        '<line x1="' + (x - 4) + '" y1="' + (y - 4) + '" x2="' + (x + 4) + '" y2="' + (y + 4) + '"></line>' +
        '<line x1="' + (x - 4) + '" y1="' + (y + 4) + '" x2="' + (x + 4) + '" y2="' + (y - 4) + '"></line>' +
      '</g>';
    }

    return '<svg class="webui-designer-branch-svg" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true" preserveAspectRatio="none">' +
      '<line class="webui-designer-branch-svg-trunk" x1="' + trunkX + '" y1="0" x2="' + trunkX + '" y2="' + (isLastChild ? middleY : height) + '"></line>' +
      '<line class="' + laneClass(downState) + '" x1="' + trunkX + '" y1="' + topY + '" x2="' + ((downState === 'open' || downState === 'blocked') ? openLineEnd : parentOfferedEnd) + '" y2="' + topY + '"></line>' +
      (downState === 'open' ? arrowHead('right', rightX, topY, laneClass(downState)) : '') +
      (downState === 'blocked' ? blockMark(rightX - 2, topY, laneClass(downState)) : '') +
      '<line class="' + laneClass(upState) + '" x1="' + (upState === 'open' ? openLineStart : upState === 'blocked' ? parentBlockX : childSideStart) + '" y1="' + bottomY + '" x2="' + rightX + '" y2="' + bottomY + '"></line>' +
      (upState === 'open' ? arrowHead('left', trunkX, bottomY, laneClass(upState)) : '') +
      (upState === 'blocked' ? blockMark(parentBlockX - 6, bottomY, laneClass(upState)) : '') +
    '</svg>';
  }

  function renderThingTreeNodes(nodes, parentNode, isLastChild) {
    return nodes.map(function (node) {
      var isSelected = node.uName === selectedThingUName;
      var hasChildren = node.children.length > 0;
      var isExpanded = expandedThingNodes.has(node.uName);
      var childRows = hasChildren && isExpanded
        ? '<div class="webui-designer-tree-children">' +
            node.children.map(function (childNode, index) {
              return '<div class="webui-designer-child-branch">' +
                renderThingTreeNodes([childNode], node, index === node.children.length - 1) +
              '</div>';
            }).join('') +
          '</div>'
        : '';

      return '<div class="webui-designer-tree-node">' +
        '<div class="' + (parentNode ? 'webui-designer-tree-row' : 'webui-designer-tree-row webui-designer-tree-row-root') + '">' +
          '<div class="' + (parentNode ? 'webui-designer-tree-row-main webui-designer-tree-row-main-child' : 'webui-designer-tree-row-main webui-designer-tree-row-main-root') + '">' +
            (hasChildren
              ? '<button type="button" class="webui-designer-tree-toggle" data-toggle-u-name="' + node.uName + '" aria-label="' + (isExpanded ? 'Collapse ' : 'Expand ') + node.name + '">' + (isExpanded ? '−' : '+') + '</button>'
              : '<span class="webui-designer-tree-toggle-spacer"></span>') +
            (parentNode
              ? branchConnectorMarkup(parentNode, node, !!isLastChild)
              : '<span class="webui-designer-tree-branch-spacer"></span>') +
            '<button type="button" class="webui-designer-tree-item' + (isSelected ? ' is-selected' : '') + '" data-thing-u-name="' + node.uName + '">' +
              '<span class="webui-designer-tree-main"><span>' + node.name + '</span><span class="webui-designer-tree-type">' + node.type + '</span></span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        childRows +
      '</div>';
    }).join('');
  }

  function renderDesignerTree() {
    if (!latestThingNodes.length) {
      designerTreeEl.innerHTML = '<div class="webui-empty">No configured things found.</div>';
      return;
    }

    designerTreeEl.innerHTML = renderThingTreeNodes(latestThingNodes, null);

    Array.from(designerTreeEl.querySelectorAll('[data-thing-u-name]')).forEach(function (button) {
      button.addEventListener('click', function () {
        selectedThingUName = button.getAttribute('data-thing-u-name') || '';
        var selectedPath = findThingPath(latestThingNodes, selectedThingUName);
        selectedPath.forEach(function (uName) {
          expandedThingNodes.add(uName);
        });
        renderDesignerTree();
        requestDescribeThing();
      });
    });

    Array.from(designerTreeEl.querySelectorAll('[data-toggle-u-name]')).forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        var uName = button.getAttribute('data-toggle-u-name') || '';

        if (expandedThingNodes.has(uName)) {
          expandedThingNodes.delete(uName);
        }
        else {
          expandedThingNodes.add(uName);
        }

        renderDesignerTree();
      });
    });
  }

  function renderSourceStateDetail(payload) {
    if (!payload) {
      sourcesSelectedSourceEl.textContent = '-';
      sourcesSummaryEl.innerHTML = '<span class="webui-chip">source: -</span>';
      sourcesDetailEl.innerHTML = '<div class="webui-empty">Select an active source to inspect.</div>';
      return;
    }

    sourcesSelectedSourceEl.textContent = payload.uName || '-';
    sourcesSummaryEl.innerHTML = [
      'type: ' + (payload.type || payload.superType || '-'),
      'owner: ' + (payload.ownerCasa || '-'),
      'priority: ' + ((payload.priority === null || payload.priority === undefined) ? '-' : payload.priority),
      payload.local ? 'private' : 'shared',
      payload.fromPeer ? 'peer-backed' : 'owned here'
    ].map(function (label) {
      return '<span class="webui-chip">' + label + '</span>';
    }).join('');

    var propertyRows = (payload.properties || []).map(function (entry) {
      var separatorIndex = entry.indexOf('=');
      var name = separatorIndex === -1 ? entry : entry.slice(0, separatorIndex);
      var value = separatorIndex === -1 ? '' : entry.slice(separatorIndex + 1);

      return '<tr>' +
        '<td>' + escapeHtml(name) + '</td>' +
        '<td>' + escapeHtml(value) + '</td>' +
      '</tr>';
    }).join('');

    var eventRows = (payload.events || []).map(function (eventName) {
      return '<tr><td>' + escapeHtml(eventName) + '</td></tr>';
    }).join('');

    sourcesDetailEl.innerHTML =
      '<section class="webui-designer-card">' +
        '<h4>Runtime</h4>' +
        '<dl class="webui-designer-kv">' +
          '<dt>uName</dt><dd>' + escapeHtml(payload.uName || '-') + '</dd>' +
          '<dt>Name</dt><dd>' + escapeHtml(payload.name || '-') + '</dd>' +
          '<dt>Type</dt><dd>' + escapeHtml(payload.type || payload.superType || '-') + '</dd>' +
          '<dt>Owner Casa</dt><dd>' + escapeHtml(payload.ownerCasa || '-') + '</dd>' +
        '</dl>' +
      '</section>' +
      '<section class="webui-designer-card">' +
        '<h4>Properties</h4>' +
        ((payload.properties && payload.properties.length)
          ? '<div class="webui-table-wrap">' +
              '<table class="webui-table webui-table-compact">' +
                '<thead><tr><th>name</th><th>value</th></tr></thead>' +
                '<tbody>' + propertyRows + '</tbody>' +
              '</table>' +
            '</div>'
          : '<div class="webui-empty">none</div>') +
      '</section>' +
      '<section class="webui-designer-card">' +
        '<h4>Events</h4>' +
        ((payload.events && payload.events.length)
          ? '<div class="webui-table-wrap">' +
              '<table class="webui-table webui-table-compact">' +
                '<thead><tr><th>name</th></tr></thead>' +
                '<tbody>' + eventRows + '</tbody>' +
              '</table>' +
            '</div>'
          : '<div class="webui-empty">none</div>') +
      '</section>';
  }

  function inheritanceLabel(member) {
    if (member.inherited && member.inherited.parent) {
      return 'parent';
    }

    if (member.inherited && member.inherited.child) {
      return 'child';
    }

    return 'local';
  }

  function renderMemberTable(title, members) {
    if (!members || !members.length) {
      return '<section class="webui-designer-card"><h4>' + title + '</h4><div class="webui-empty">none</div></section>';
    }

    return '<section class="webui-designer-card">' +
      '<h4>' + title + '</h4>' +
      '<div class="webui-table-wrap">' +
        '<table class="webui-table webui-table-compact">' +
          '<thead><tr><th>name</th><th>type</th><th>inheritance</th><th>listeners</th></tr></thead>' +
          '<tbody>' +
            members.map(function (member) {
              return '<tr>' +
                '<td>' + member.name + '</td>' +
                '<td>' + (member.type || '-') + '</td>' +
                '<td>' + inheritanceLabel(member) + '</td>' +
                '<td>' + member.sourceListenerCount + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>' +
    '</section>';
  }

  function renderExternalList(title, members, empty) {
    if (!members || !members.length) {
      return '<section class="webui-designer-card"><h4>' + title + '</h4><div class="webui-empty">' + empty + '</div></section>';
    }

    return '<section class="webui-designer-card">' +
      '<h4>' + title + '</h4>' +
      '<div class="webui-chip-row">' +
        members.map(function (member) {
          var via = member.viaThingName ? ' via ' + member.viaThingName : '';
          return '<span class="webui-chip"><strong>' + member.name + '</strong>&nbsp;' + (member.type || '-') + via + '</span>';
        }).join('') +
      '</div>' +
    '</section>';
  }

  function renderDesignerConfig(payload) {
    if (payload === null || payload === undefined) {
      return '<section class="webui-designer-card"><h4>Additional Config</h4><div class="webui-empty">none</div></section>';
    }

    return '<section class="webui-designer-card">' +
      '<h4>Additional Config</h4>' +
      '<pre class="webui-designer-code">' + escapeHtml(JSON.stringify(payload, null, 2)) + '</pre>' +
    '</section>';
  }

  function renderDesignerDetail(payload) {
    if (!payload || !payload.thing || !payload.thing.object) {
      designerDetailHeadingEl.textContent = 'Thing detail';
      designerSelectedThingEl.textContent = '-';
      designerSummaryEl.innerHTML = '<span class="webui-chip">uName: -</span>';
      designerDetailEl.innerHTML = '<div class="webui-empty">Select a thing to inspect.</div>';
      return;
    }

    var detailType = payload.thing.object.type || payload.thing.object.superType || 'Thing';
    designerSelectedThingEl.textContent = payload.thing.object.uName;
    designerDetailHeadingEl.textContent = String(detailType).toUpperCase() + ' detail';
    designerSummaryEl.innerHTML = [
      'uName: ' + payload.thing.object.uName,
      'children: ' + (payload.children ? payload.children.length : 0),
      'properties: ' + (payload.properties ? payload.properties.length : 0),
      'events: ' + (payload.events ? payload.events.length : 0)
    ].map(function (label) {
      return '<span class="webui-chip">' + label + '</span>';
    }).join('');

    var parentLabel = payload.parent && payload.parent.object ? payload.parent.object.uName : 'none';
    var childList = payload.children && payload.children.length
      ? payload.children.map(function (child) { return '<span class="webui-chip">' + child.object.uName + '</span>'; }).join('')
      : '<div class="webui-empty">none</div>';

    designerDetailEl.innerHTML =
      '<section class="webui-designer-card">' +
        '<dl class="webui-designer-kv">' +
          '<dt>name</dt><dd>' + (payload.thing.object.name || '-') + '</dd>' +
          '<dt>display name</dt><dd>' + (payload.thing.object.displayName || '-') + '</dd>' +
          '<dt>private</dt><dd>' + (payload.thing.local ? 'yes' : 'no') + '</dd>' +
          '<dt>priority</dt><dd>' + (payload.thing.priority === null ? '-' : payload.thing.priority) + '</dd>' +
          '<dt>parent</dt><dd>' + parentLabel + '</dd>' +
          '<dt>ignore parent</dt><dd>' + (payload.propagation.objectLevel.ignoreParent ? 'yes' : 'no') + '</dd>' +
          '<dt>ignore children</dt><dd>' + (payload.propagation.objectLevel.ignoreChildren ? 'yes' : 'no') + '</dd>' +
          '<dt>propagate to parent</dt><dd>' + (payload.propagation.objectLevel.propagateToParent ? 'yes' : 'no') + '</dd>' +
          '<dt>propagate to children</dt><dd>' + (payload.propagation.objectLevel.propagateToChildren ? 'yes' : 'no') + '</dd>' +
        '</dl>' +
      '</section>' +
      renderDesignerConfig(payload.config) +
      '<section class="webui-designer-card">' +
        '<h4>Children</h4>' +
        '<div class="webui-chip-row">' + childList + '</div>' +
      '</section>' +
      renderMemberTable('Properties', payload.properties || []) +
      renderMemberTable('Events', payload.events || []) +
      renderExternalList('Blocked from parent', payload.inheritance && payload.inheritance.blocked ? payload.inheritance.blocked.fromParent.properties.concat(payload.inheritance.blocked.fromParent.events) : [], 'none') +
      renderExternalList('Blocked from children', payload.inheritance && payload.inheritance.blocked ? payload.inheritance.blocked.fromChildren.properties.concat(payload.inheritance.blocked.fromChildren.events) : [], 'none');
  }

  function completeConsoleLine() {
    if (!socket.connected) {
      setConsoleHints(['Socket is not connected yet.']);
      return;
    }

    emitWithReply('autoComplete', {
      line: consoleLineEl.value
    }, function (payload) {
      var matches = payload && payload.result && payload.result.matches ? payload.result.matches : [];

      if (matches.length === 1) {
        consoleLineEl.value = matches[0];
        setConsoleHints([]);
      }
      else {
        setConsoleHints(matches);
      }
    });
  }

  function resetConsoleHistoryNavigation() {
    consoleHistoryIndex = -1;
    consoleDraftLine = '';
  }

  function rememberConsoleLine(line) {
    if (!line) {
      return;
    }

    if (!consoleHistory.length || consoleHistory[consoleHistory.length - 1] !== line) {
      consoleHistory.push(line);
    }

    resetConsoleHistoryNavigation();
  }

  function moveConsoleHistory(direction) {
    if (!consoleHistory.length) {
      return;
    }

    if (direction < 0) {
      if (consoleHistoryIndex === -1) {
        consoleDraftLine = consoleLineEl.value;
        consoleHistoryIndex = consoleHistory.length - 1;
      }
      else if (consoleHistoryIndex > 0) {
        consoleHistoryIndex = consoleHistoryIndex - 1;
      }
    }
    else {
      if (consoleHistoryIndex === -1) {
        return;
      }

      if (consoleHistoryIndex < consoleHistory.length - 1) {
        consoleHistoryIndex = consoleHistoryIndex + 1;
      }
      else {
        consoleHistoryIndex = -1;
        consoleLineEl.value = consoleDraftLine;
        return;
      }
    }

    consoleLineEl.value = consoleHistory[consoleHistoryIndex];
  }

  function runConsoleLine() {
    if (!socket.connected) {
      addConsoleSystemLine('Socket is not connected yet.');
      return;
    }

    var line = consoleLineEl.value.trim();

    if (!line) {
      return;
    }

    rememberConsoleLine(line);
    beginConsoleCommand(line);

    emitWithReply('executeConsoleLine', {
      line: line
    }, function (payload) {
      if (payload && payload.result && payload.result.currentScope) {
        setConsoleScope(payload.result.currentScope);
      }

      if (!payload.ok) {
        appendConsoleCommandOutput(String(payload.error || 'Unknown console error'));
        activeConsoleEntryId = null;
        return;
      }

      if (!payload.result || !payload.result.scopeChanged) {
        if (payload.result && payload.result.output !== null && payload.result.output !== undefined) {
        var output = (typeof payload.result.output === 'object')
          ? JSON.stringify(payload.result.output, null, 2)
          : String(payload.result.output);
        appendConsoleCommandOutput(output);
        }
      }

      activeConsoleEntryId = null;
      consoleLineEl.value = '';
      setConsoleHints([]);
    });
  }

  function collectActiveSourceRows(node, fallbackCasaName, rows) {
    if (!node || !rows) {
      return;
    }

    if (node.uName && (node.superType === 'thing' || node.type === 'peersource')) {
      rows.push({
        sourceUName: node.uName,
        ownerCasa: node.ownerCasa || fallbackCasaName,
        type: node.type || node.superType || 'unknown',
        priority: node.priority || 0,
        providerType: node.providerType || 'casa',
        isPrivate: !!node.local
      });
    }

    Object.values(node.myNamedObjects || {}).forEach(function (child) {
      if (child) {
        collectActiveSourceRows(child, fallbackCasaName, rows);
      }
    });
  }

  function sourceRowsFromTrees(payload) {
    var rows = [];

    if (!payload) {
      return rows;
    }

    collectActiveSourceRows(payload.activeTree, payload.casaName, rows);

    rows.sort(function (a, b) {
      if (a.sourceUName === b.sourceUName) {
        return a.ownerCasa.localeCompare(b.ownerCasa);
      }

      return a.sourceUName.localeCompare(b.sourceUName);
    });

    return rows;
  }

  function filteredSourceRows(rows) {
    var prefix = (sourcesPrefixEl.value || '').trim();
    var typeFilter = (sourcesTypeEl.value || '').trim().toLowerCase();
    var search = (sourcesSearchEl.value || '').trim().toLowerCase();

    return rows.filter(function (row) {
      if (prefix) {
        var normalisedPrefix = prefix.charAt(0) === ':' ? prefix : ':' + prefix;

        if (row.sourceUName.indexOf(normalisedPrefix) !== 0) {
          return false;
        }
      }

      if (typeFilter && row.type.toLowerCase().indexOf(typeFilter) === -1) {
        return false;
      }

      if (!search) {
        return true;
      }

      return row.sourceUName.toLowerCase().includes(search) ||
             row.type.toLowerCase().includes(search);
    });
  }

  function visibleSourceRows(rows) {
    var casaName = latestSourceTrees && latestSourceTrees.casaName ? latestSourceTrees.casaName : currentSelectedCasa;

    return rows.filter(function (row) {
      return row.isPrivate || row.ownerCasa === casaName;
    });
  }

  function sourceRowMarkup(row) {
    return '<tr class="' + (row.isPrivate ? 'webui-table-row-private ' : '') + (row.sourceUName === selectedActiveSourceUName ? 'webui-table-row-selected' : '') + '" data-source-u-name="' + escapeHtmlAttr(row.sourceUName) + '">' +
      '<td>' + escapeHtml(row.sourceUName) + '</td>' +
      '<td>' + escapeHtml(row.type) + '</td>' +
      '<td>' + escapeHtml(row.priority) + '</td>' +
    '</tr>';
  }

  function sourceSectionMarkup(label, rows, emptyLabel) {
    return '<tr class="webui-table-section-row"><td colspan="3">' +
        '<span class="webui-table-section-title">' + escapeHtml(label) + '</span>' +
        '<span class="webui-table-section-count">' + rows.length + '</span>' +
      '</td></tr>' +
      (rows.length
        ? rows.map(sourceRowMarkup).join('')
        : '<tr class="webui-table-empty-row"><td colspan="3" class="webui-empty-cell">' + escapeHtml(emptyLabel) + '</td></tr>');
  }

  function renderSources() {
    var rows = filteredSourceRows(visibleSourceRows(sourceRowsFromTrees(latestSourceTrees)));
    var sharedRows = rows.filter(function (row) { return !row.isPrivate; });
    var localRows = rows.filter(function (row) { return row.isPrivate; });
    var hasSelectedRow = rows.some(function (row) { return row.sourceUName === selectedActiveSourceUName; });

    sourcesActiveCountEl.textContent = 'active: ' + rows.length;
    sourcesOwnedActiveCountEl.textContent = 'global: ' + sharedRows.length;
    sourcesPeerActiveCountEl.textContent = 'local: ' + localRows.length;

    if (!rows.length) {
      selectedActiveSourceUName = '';
      renderSourceStateDetail(null);
      sourcesBodyEl.innerHTML = '<tr><td colspan="3" class="webui-empty-cell">No matching active sources.</td></tr>';
      return;
    }

    if (!selectedActiveSourceUName || !hasSelectedRow) {
      selectedActiveSourceUName = rows[0].sourceUName;
    }

    sourcesBodyEl.innerHTML =
      sourceSectionMarkup('Global', sharedRows, 'No global active sources owned by this casa.') +
      sourceSectionMarkup('Local', localRows, 'No local active sources.');

    Array.from(sourcesBodyEl.querySelectorAll('[data-source-u-name]')).forEach(function (rowEl) {
      rowEl.addEventListener('click', function () {
        selectedActiveSourceUName = rowEl.getAttribute('data-source-u-name') || '';
        renderSources();
        requestDescribeSourceState();
      });
    });
  }

  function requestDescribeSourceState(callback) {
    if (!socket.connected) {
      renderSourceStateDetail(null);
      if (callback) {
        callback();
      }
      return;
    }

    if (!selectedActiveSourceUName) {
      renderSourceStateDetail(null);
      if (callback) {
        callback();
      }
      return;
    }

    sourcesDetailEl.innerHTML = '<div class="webui-empty">Loading source detail...</div>';
    sendCommand({
      obj: selectedActiveSourceUName,
      method: 'describeSourceState',
      arguments: []
    }, function (payload) {
      if (!payload.ok) {
        sourcesSelectedSourceEl.textContent = selectedActiveSourceUName;
        sourcesSummaryEl.innerHTML = '<span class="webui-chip">source: ' + selectedActiveSourceUName + '</span>';
        sourcesDetailEl.innerHTML = '<div class="webui-empty">' + payload.error + '</div>';
        if (callback) {
          callback();
        }
        return;
      }

      renderSourceStateDetail(payload.result);
      if (callback) {
        callback();
      }
    });
  }

  function formatList(values, emptyLabel) {
    return values && values.length ? values.map(escapeHtml).join(', ') : emptyLabel;
  }

  function chipMarkup(label, className) {
    return '<span class="' + (className || 'webui-chip') + '">' + escapeHtml(label) + '</span>';
  }

  function findGlobalThing(uName) {
    var things = latestGlobalThings && latestGlobalThings.things ? latestGlobalThings.things : [];

    return things.find(function (thing) {
      return thing.uName === uName;
    }) || null;
  }

  function activeOwnerLinkMarkup(casaName, sourceUName) {
    if (!casaName || casaName === '-' || !sourceUName) {
      return escapeHtml(casaName || '-');
    }

    return '<button type="button" class="webui-inline-link" data-drilldown-casa="' + escapeHtmlAttr(casaName) + '" data-drilldown-source="' + escapeHtmlAttr(sourceUName) + '">' +
      escapeHtml(casaName) +
    '</button>';
  }

  function bindDrilldownLinks(rootEl) {
    Array.from(rootEl.querySelectorAll('[data-drilldown-casa][data-drilldown-source]')).forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        drillIntoCasaSource(button.getAttribute('data-drilldown-casa') || '', button.getAttribute('data-drilldown-source') || '');
      });
    });
  }

  function appendUnique(array, value) {
    if (value !== undefined && value !== null && array.indexOf(value) === -1) {
      array.push(value);
    }
  }

  function sortNames(values) {
    values.sort(function (a, b) {
      return String(a).localeCompare(String(b));
    });
    return values;
  }

  function preferredGlobalType(rows, ownerCasa) {
    var best = null;

    rows.forEach(function (row) {
      if (best) {
        return;
      }

      if (row.state === 'active' && row.ownerCasa === ownerCasa && row.providerType === 'casa') {
        best = row;
      }
    });

    rows.forEach(function (row) {
      if (!best && row.state === 'active') {
        best = row;
      }
    });

    return best ? best.type : '-';
  }

  function isGlobalThingExportNode(node) {
    return node &&
      node.uName &&
      !node.local &&
      (node.superType === 'thing' || node.type === 'peersource');
  }

  function isLocalThingExportNode(node) {
    return node &&
      node.uName &&
      !!node.local &&
      (node.superType === 'thing' || node.type === 'peersource');
  }

  function collectGlobalThingRows(node, state, viewCasaName, rows, origin) {
    if (!node) {
      return;
    }

    if (isGlobalThingExportNode(node)) {
      rows.push({
        uName: node.uName,
        state: state,
        viewCasaName: viewCasaName,
        ownerCasa: node.ownerCasa ? node.ownerCasa : viewCasaName,
        providerType: node.providerType ? node.providerType : 'casa',
        type: node.type ? node.type : (node.superType ? node.superType : 'thing'),
        priority: node.priority !== undefined ? node.priority : 0,
        name: node.name || node.uName,
        displayName: node.displayName || '',
        origin: origin
      });
    }

    Object.keys(node.myNamedObjects || {}).forEach(function (childName) {
      collectGlobalThingRows(node.myNamedObjects[childName], state, viewCasaName, rows, origin);
    });
  }

  function countLocalThingExportNodes(node) {
    var count = 0;

    if (!node) {
      return count;
    }

    if (isLocalThingExportNode(node)) {
      count += 1;
    }

    Object.keys(node.myNamedObjects || {}).forEach(function (childName) {
      count += countLocalThingExportNodes(node.myNamedObjects[childName]);
    });

    return count;
  }

  function mergeGlobalThings(casaNames, responses) {
    var rows = [];
    var connectedCasaCount = 0;
    var localOnlyTotal = 0;

    responses.forEach(function (response) {
      if (!response.ok || !response.result) {
        return;
      }

      connectedCasaCount += 1;
      var sourceTrees = response.result;
      var viewCasaName = sourceTrees.casaName || response.casaName || '-';

      collectGlobalThingRows(sourceTrees.activeTree, 'active', viewCasaName, rows, 'activeTree');
      collectGlobalThingRows(sourceTrees.localBowedTree, 'bowed', viewCasaName, rows, 'localBowedTree');

      (sourceTrees.peerTrees || []).forEach(function (peerTree) {
        collectGlobalThingRows(peerTree.tree, 'bowed', viewCasaName, rows, 'peerTree:' + peerTree.casaName);
      });

      localOnlyTotal += countLocalThingExportNodes(sourceTrees.activeTree) + countLocalThingExportNodes(sourceTrees.localBowedTree);
    });

    var byName = {};
    rows.forEach(function (row) {
      if (!byName[row.uName]) {
        byName[row.uName] = [];
      }

      byName[row.uName].push(row);
    });

    var things = [];
    var conflicts = [];

    Object.keys(byName).sort(function (a, b) {
      return a.localeCompare(b);
    }).forEach(function (uName) {
      var thingRows = byName[uName];
      var activeOwners = [];
      var bowedOwners = [];
      var seenBy = [];

      thingRows.forEach(function (row) {
        appendUnique(seenBy, row.viewCasaName);

        if (row.state === 'active') {
          appendUnique(activeOwners, row.ownerCasa);
        }
        else if (row.state === 'bowed') {
          appendUnique(bowedOwners, row.ownerCasa);
        }
      });

      sortNames(activeOwners);
      sortNames(bowedOwners);
      sortNames(seenBy);

      var missingFrom = casaNames.filter(function (casaName) {
        return seenBy.indexOf(casaName) === -1;
      });
      var activeOwner = activeOwners.length === 1 ? activeOwners[0] : null;
      var conflict = activeOwners.length !== 1 || missingFrom.length > 0;

      var thing = {
        uName: uName,
        activeOwnerCasa: activeOwner,
        activeOwners: activeOwners,
        bowedOwners: bowedOwners,
        seenBy: seenBy,
        missingFrom: missingFrom,
        type: preferredGlobalType(thingRows, activeOwner),
        name: thingRows.length ? thingRows[0].name : uName,
        displayName: thingRows.length ? thingRows[0].displayName : '',
        priority: thingRows.length ? thingRows[0].priority : 0,
        rows: thingRows,
        conflict: conflict
      };

      things.push(thing);

      if (conflict) {
        conflicts.push({
          uName: thing.uName,
          reason: activeOwners.length !== 1 ? 'active-owner-conflict' : 'missing-from-casa',
          activeOwners: activeOwners,
          bowedOwners: bowedOwners,
          seenBy: seenBy,
          missingFrom: missingFrom
        });
      }
    });

    return {
      gangName: latestWebUiStatus && latestWebUiStatus.gangName ? latestWebUiStatus.gangName : '-',
      casaCount: casaNames.length,
      connectedCasaCount: connectedCasaCount,
      localOnlyTotal: localOnlyTotal,
      globalThingCount: things.length,
      conflictCount: conflicts.length,
      things: things,
      conflicts: conflicts
    };
  }

  function renderGlobalThings() {
    var data = latestGlobalThings;
    var things = data && data.things ? data.things : [];
    var conflicts = data && data.conflicts ? data.conflicts : [];
    var connectedCasaCount = data && typeof data.connectedCasaCount === 'number' ? data.connectedCasaCount : 0;
    var casaCount = data && typeof data.casaCount === 'number' ? data.casaCount : 0;
    var localOnlyTotal = data && typeof data.localOnlyTotal === 'number' ? data.localOnlyTotal : 0;
    var globalThingCount = data && typeof data.globalThingCount === 'number' ? data.globalThingCount : things.length;
    var bowedThingCount = things.reduce(function (count, thing) {
      return count + (thing.bowedOwners && thing.bowedOwners.length ? 1 : 0);
    }, 0);
    var disconnectedCasaCount = Math.max(0, casaCount - connectedCasaCount);

    topologyGangEl.textContent = data && data.gangName ? data.gangName : '-';
    topologyLocalEl.textContent = globalThingCount + (globalThingCount === 1 ? ' global thing' : ' global things');
    topologyConnectedPeersEl.textContent = connectedCasaCount + '/' + casaCount;
    topologyConnectivityLabelEl.textContent = disconnectedCasaCount === 0
      ? 'all casas connected'
      : disconnectedCasaCount + (disconnectedCasaCount === 1 ? ' casa unavailable' : ' casas unavailable');
    topologyAgreementEl.textContent = conflicts.length === 0 ? 'Aligned' : conflicts.length;
    topologyAgreementLabelEl.textContent = conflicts.length === 0
      ? 'no different global views'
      : 'global difference' + (conflicts.length === 1 ? ' needs' : 's need') + ' attention';
    topologyTotalBowedEl.textContent = bowedThingCount;
    topologyBowingLabelEl.textContent = bowedThingCount === 1 ? 'thing has bowed contenders' : 'things have bowed contenders';
    topologyLocalPrivateEl.textContent = localOnlyTotal;
    topologyPrivateLabelEl.textContent = localOnlyTotal === 1 ? 'private source' : 'private sources';

    if (!data) {
      selectedGlobalThingUName = '';
      latestGlobalThingDetail = null;
      latestGlobalThingRuntime = null;
      globalThingsBodyEl.innerHTML = '<tr><td colspan="6" class="webui-empty-cell">No global things loaded yet.</td></tr>';
      globalConflictsBodyEl.innerHTML = '<tr><td colspan="5" class="webui-empty-cell">No conflicts loaded yet.</td></tr>';
      renderGlobalThingDetail();
      return;
    }

    if (!things.length) {
      selectedGlobalThingUName = '';
      latestGlobalThingDetail = null;
      latestGlobalThingRuntime = null;
      globalThingsBodyEl.innerHTML = '<tr><td colspan="6" class="webui-empty-cell">No global things found.</td></tr>';
      renderGlobalThingDetail();
    }
    else {
      if (!selectedGlobalThingUName || !findGlobalThing(selectedGlobalThingUName)) {
        selectedGlobalThingUName = things[0].uName;
        latestGlobalThingDetail = null;
        latestGlobalThingRuntime = null;
      }

      globalThingsBodyEl.innerHTML = things.map(function (thing) {
        var statusClass = thing.conflict ? 'webui-state-pill webui-state-pill-warn' : 'webui-state-pill webui-state-pill-ok';
        var statusLabel = thing.conflict ? 'conflict' : 'aligned';
        var rowClass = thing.uName === selectedGlobalThingUName ? ' class="webui-table-row-selected"' : '';

        return '<tr' + rowClass + ' data-global-thing-u-name="' + escapeHtmlAttr(thing.uName) + '">' +
          '<td><strong>' + escapeHtml(thing.uName) + '</strong></td>' +
          '<td>' + escapeHtml(thing.type || '-') + '</td>' +
          '<td>' + (thing.activeOwnerCasa ? activeOwnerLinkMarkup(thing.activeOwnerCasa, thing.uName) : 'conflict') + '</td>' +
          '<td>' + formatList(thing.bowedOwners, '-') + '</td>' +
          '<td>' + (thing.seenBy ? thing.seenBy.length : 0) + '/' + casaCount + '</td>' +
          '<td><span class="' + statusClass + '">' + statusLabel + '</span></td>' +
        '</tr>';
      }).join('');

      Array.from(globalThingsBodyEl.querySelectorAll('[data-global-thing-u-name]')).forEach(function (row) {
        row.addEventListener('click', function () {
          selectedGlobalThingUName = row.getAttribute('data-global-thing-u-name') || '';
          latestGlobalThingDetail = null;
          latestGlobalThingRuntime = null;
          renderGlobalThings();
          requestDescribeGlobalThing();
        });
      });
      bindDrilldownLinks(globalThingsBodyEl);

      renderGlobalThingDetail();
    }

    if (!conflicts.length) {
      globalConflictsBodyEl.innerHTML = '<tr><td colspan="5" class="webui-empty-cell">No global conflicts detected.</td></tr>';
    }
    else {
      globalConflictsBodyEl.innerHTML = conflicts.map(function (conflict) {
        return '<tr>' +
          '<td><strong>' + escapeHtml(conflict.uName) + '</strong></td>' +
          '<td>' + escapeHtml(conflict.reason) + '</td>' +
          '<td>' + formatList(conflict.activeOwners, '-') + '</td>' +
          '<td>' + formatList(conflict.bowedOwners, '-') + '</td>' +
          '<td>' + formatList(conflict.missingFrom, '-') + '</td>' +
        '</tr>';
      }).join('');
    }
  }

  function propertyValueRows(properties) {
    return (properties || []).map(function (entry) {
      var separatorIndex = String(entry).indexOf('=');
      var name = separatorIndex === -1 ? entry : String(entry).slice(0, separatorIndex);
      var value = separatorIndex === -1 ? '' : String(entry).slice(separatorIndex + 1);

      return '<tr>' +
        '<td>' + escapeHtml(name) + '</td>' +
        '<td>' + escapeHtml(value) + '</td>' +
      '</tr>';
    }).join('');
  }

  function simpleNameRows(values) {
    return (values || []).map(function (value) {
      return '<tr><td>' + escapeHtml(value) + '</td></tr>';
    }).join('');
  }

  function renderGlobalRuntimeCard(runtime) {
    if (!runtime) {
      return '<section class="webui-designer-card"><h4>Values</h4><div class="webui-empty">Loading authoritative values...</div></section>';
    }

    var propertyRows = propertyValueRows(runtime.properties || []);
    var eventRows = simpleNameRows(runtime.events || []);

    return '<section class="webui-designer-card">' +
      '<h4>Values</h4>' +
      ((runtime.properties && runtime.properties.length)
        ? '<div class="webui-table-wrap">' +
            '<table class="webui-table webui-table-compact">' +
              '<thead><tr><th>property</th><th>value</th></tr></thead>' +
              '<tbody>' + propertyRows + '</tbody>' +
            '</table>' +
          '</div>'
        : '<div class="webui-empty">no properties reported</div>') +
      '</section>' +
      '<section class="webui-designer-card">' +
        '<h4>Events</h4>' +
        ((runtime.events && runtime.events.length)
          ? '<div class="webui-table-wrap">' +
              '<table class="webui-table webui-table-compact">' +
                '<thead><tr><th>event</th></tr></thead>' +
                '<tbody>' + eventRows + '</tbody>' +
              '</table>' +
            '</div>'
          : '<div class="webui-empty">none</div>') +
      '</section>';
  }

  function renderGlobalStructureCard(detail) {
    if (!detail || !detail.thing || !detail.thing.object) {
      return '<section class="webui-designer-card"><h4>Structure</h4><div class="webui-empty">Loading active owner detail...</div></section>';
    }

    var children = detail.children || [];
    var propertyCount = detail.properties ? detail.properties.length : 0;
    var eventCount = detail.events ? detail.events.length : 0;
    var childList = children.length
      ? children.map(function (child) { return chipMarkup(child.object.uName); }).join('')
      : '<div class="webui-empty">none</div>';

    return '<section class="webui-designer-card">' +
      '<h4>Structure</h4>' +
      '<dl class="webui-designer-kv">' +
        '<dt>display name</dt><dd>' + escapeHtml(detail.thing.object.displayName || '-') + '</dd>' +
        '<dt>children</dt><dd>' + children.length + '</dd>' +
        '<dt>properties</dt><dd>' + propertyCount + '</dd>' +
        '<dt>events</dt><dd>' + eventCount + '</dd>' +
        '<dt>thing priority</dt><dd>' + escapeHtml(detail.thing.priority === null ? '-' : detail.thing.priority) + '</dd>' +
        '<dt>private</dt><dd>' + (detail.thing.local ? 'yes' : 'no') + '</dd>' +
      '</dl>' +
      '</section>' +
      '<section class="webui-designer-card">' +
        '<h4>Children</h4>' +
        '<div class="webui-chip-row">' + childList + '</div>' +
      '</section>' +
      renderMemberTable('Configured Properties', detail.properties || []) +
      renderMemberTable('Configured Events', detail.events || []);
  }

  function renderGlobalThingDetail() {
    var thing = selectedGlobalThingUName ? findGlobalThing(selectedGlobalThingUName) : null;

    if (!thing) {
      globalDetailHeadingEl.textContent = 'Thing detail';
      globalSelectedThingEl.textContent = '-';
      globalDetailSummaryEl.innerHTML = chipMarkup('uName: -');
      globalDetailBodyEl.innerHTML = '<div class="webui-empty">Select a global thing to inspect.</div>';
      return;
    }

    var statusLabel = thing.conflict ? 'different view' : 'aligned';
    var activeOwner = thing.activeOwnerCasa || '-';
    var detailReady = !!(latestGlobalThingDetail || latestGlobalThingRuntime);
    var canResolve = !!thing.activeOwnerCasa && !thing.conflict;

    globalDetailHeadingEl.textContent = String(thing.type || 'thing').toUpperCase() + ' detail';
    globalSelectedThingEl.textContent = thing.uName;
    globalDetailSummaryEl.innerHTML = [
      chipMarkup('uName: ' + thing.uName),
      chipMarkup('type: ' + (thing.type || '-')),
      chipMarkup('active owner: ' + activeOwner),
      chipMarkup(statusLabel, thing.conflict ? 'webui-chip webui-chip-warn' : 'webui-chip')
    ].join('');

    var missingList = thing.missingFrom && thing.missingFrom.length
      ? thing.missingFrom.map(function (name) { return chipMarkup(name, 'webui-chip webui-chip-warn'); }).join('')
      : '<div class="webui-empty">none</div>';
    var bowedList = thing.bowedOwners && thing.bowedOwners.length
      ? thing.bowedOwners.map(function (name) { return chipMarkup(name); }).join('')
      : '<div class="webui-empty">none</div>';
    var seenList = thing.seenBy && thing.seenBy.length
      ? thing.seenBy.map(function (name) { return chipMarkup(name); }).join('')
      : '<div class="webui-empty">none</div>';

    var body =
      '<section class="webui-designer-card">' +
        '<h4>Identity</h4>' +
        '<dl class="webui-designer-kv">' +
          '<dt>uName</dt><dd>' + escapeHtml(thing.uName) + '</dd>' +
          '<dt>Name</dt><dd>' + escapeHtml(thing.name || '-') + '</dd>' +
          '<dt>Display name</dt><dd>' + escapeHtml(thing.displayName || '-') + '</dd>' +
          '<dt>Type</dt><dd>' + escapeHtml(thing.type || '-') + '</dd>' +
        '</dl>' +
      '</section>' +
      '<section class="webui-designer-card">' +
        '<h4>Standing</h4>' +
        '<dl class="webui-designer-kv">' +
          '<dt>Active owner</dt><dd>' + activeOwnerLinkMarkup(thing.activeOwnerCasa, thing.uName) + '</dd>' +
          '<dt>Seen by</dt><dd>' + escapeHtml((thing.seenBy ? thing.seenBy.length : 0) + '/' + (latestGlobalThings ? latestGlobalThings.casaCount : 0)) + '</dd>' +
          '<dt>Status</dt><dd>' + escapeHtml(statusLabel) + '</dd>' +
        '</dl>' +
        '<div class="webui-detail-subsection"><h5>Bowed owners</h5><div class="webui-chip-row">' + bowedList + '</div></div>' +
        '<div class="webui-detail-subsection"><h5>Seen by Casas</h5><div class="webui-chip-row">' + seenList + '</div></div>' +
        '<div class="webui-detail-subsection"><h5>Missing from Casas</h5><div class="webui-chip-row">' + missingList + '</div></div>' +
      '</section>';

    if (!canResolve) {
      body += '<section class="webui-designer-card"><h4>Values</h4><div class="webui-empty">Authoritative values need one aligned active owner.</div></section>';
    }
    else if (!detailReady) {
      body += '<section class="webui-designer-card"><h4>Values</h4><div class="webui-empty">Loading authoritative values from ' + escapeHtml(thing.activeOwnerCasa) + '...</div></section>';
    }
    else {
      body += renderGlobalRuntimeCard(latestGlobalThingRuntime);
      body += renderGlobalStructureCard(latestGlobalThingDetail);
    }

    globalDetailBodyEl.innerHTML = body;
    bindDrilldownLinks(globalDetailBodyEl);
  }

  var socket = io('/webuiapi/io', {
    transports: ['websocket']
  });

  function requestCasaInfo() {
    if (!socket.connected) {
      return;
    }

    socket.emit('getWebUiStatus', {});
  }

  function requestSourceTrees(callback) {
    if (!socket.connected) {
      renderSourceStateDetail(null);
      sourcesBodyEl.innerHTML = '<tr><td colspan="3" class="webui-empty-cell">Socket is not connected yet.</td></tr>';
      if (callback) {
        callback();
      }
      return;
    }

    sourcesBodyEl.innerHTML = '<tr><td colspan="3" class="webui-empty-cell">Loading active sources...</td></tr>';
    sendCommand({
      obj: ':',
      method: 'sourceTrees',
      arguments: []
    }, function (payload) {
      if (!payload.ok) {
        latestSourceTrees = null;
        selectedActiveSourceUName = '';
        renderSourceStateDetail(null);
        sourcesBodyEl.innerHTML = '<tr><td colspan="3" class="webui-empty-cell">' + payload.error + '</td></tr>';
        if (callback) {
          callback();
        }
        return;
      }

      latestSourceTrees = payload.result;
      renderSources();
      requestDescribeSourceState(callback);
    });
  }

  function requestConfiguredSourceTree(callback) {
    if (!socket.connected) {
      latestConfiguredTree = null;
      latestThingNodes = [];
      selectedThingUName = '';
      renderDesignerTree();
      renderDesignerDetail(null);
      if (callback) {
        callback();
      }
      return;
    }

    designerTreeEl.innerHTML = '<div class="webui-empty">Loading configured tree...</div>';
    sendCommand({
      obj: ':',
      method: 'configuredSourceTree',
      arguments: []
    }, function (payload) {
      if (!payload.ok) {
        latestConfiguredTree = null;
        latestThingNodes = [];
        selectedThingUName = '';
        renderDesignerTree();
        designerDetailEl.innerHTML = '<div class="webui-empty">' + payload.error + '</div>';
        if (callback) {
          callback();
        }
        return;
      }

      latestConfiguredTree = payload.result;
      latestThingNodes = collectThingNodes(latestConfiguredTree);
      if (!selectedThingUName || !treeContains(latestThingNodes, selectedThingUName)) {
        selectedThingUName = findFirstThingUName(latestThingNodes);
      }
      findThingPath(latestThingNodes, selectedThingUName).forEach(function (uName) {
        expandedThingNodes.add(uName);
      });
      renderDesignerTree();
      requestDescribeThing(function () {
        if (callback) {
          callback();
        }
      });
    });
  }

  function requestDescribeThing(callback) {
    if (!socket.connected) {
      renderDesignerDetail(null);
      if (callback) {
        callback();
      }
      return;
    }

    if (!selectedThingUName) {
      renderDesignerDetail(null);
      if (callback) {
        callback();
      }
      return;
    }

    designerDetailEl.innerHTML = '<div class="webui-empty">Loading thing detail...</div>';
    sendCommand({
      obj: selectedThingUName,
      method: 'describeThing',
      arguments: []
    }, function (payload) {
      if (!payload.ok) {
        designerSelectedThingEl.textContent = selectedThingUName;
        designerSummaryEl.innerHTML = '<span class="webui-chip">uName: ' + selectedThingUName + '</span>';
        designerDetailEl.innerHTML = '<div class="webui-empty">' + payload.error + '</div>';
        if (callback) {
          callback();
        }
        return;
      }

      renderDesignerDetail(payload.result);
      if (callback) {
        callback();
      }
    });
  }

  function requestDescribeGlobalThing(callback) {
    var thing = selectedGlobalThingUName ? findGlobalThing(selectedGlobalThingUName) : null;

    latestGlobalThingDetail = null;
    latestGlobalThingRuntime = null;
    renderGlobalThingDetail();

    if (!socket.connected || !thing || !thing.activeOwnerCasa || thing.conflict) {
      if (callback) {
        callback();
      }
      return;
    }

    var requestedUName = thing.uName;

    sendCommand({
      targetCasa: thing.activeOwnerCasa,
      obj: thing.uName,
      method: 'describeSourceState',
      arguments: []
    }, function (payload) {
      if (selectedGlobalThingUName === requestedUName && payload && payload.ok) {
        latestGlobalThingRuntime = payload.result;
        renderGlobalThingDetail();
      }

      sendCommand({
        targetCasa: thing.activeOwnerCasa,
        obj: thing.uName,
        method: 'describeThing',
        arguments: []
      }, function (detailPayload) {
        if (selectedGlobalThingUName === requestedUName && detailPayload && detailPayload.ok) {
          latestGlobalThingDetail = detailPayload.result;
          renderGlobalThingDetail();
        }

        if (callback) {
          callback();
        }
      });
    });
  }

  function requestGlobalThings(callback) {
    var statusCasas = latestWebUiStatus && latestWebUiStatus.casas ? latestWebUiStatus.casas : [];
    var casaNames = statusCasas.map(function (casa) {
      return casa.name;
    }).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var connectedCasas = statusCasas.filter(function (casa) {
      return casa.connected;
    });

    if (!socket.connected) {
      globalThingsBodyEl.innerHTML = '<tr><td colspan="6" class="webui-empty-cell">Socket is not connected yet.</td></tr>';
      globalConflictsBodyEl.innerHTML = '<tr><td colspan="5" class="webui-empty-cell">Socket is not connected yet.</td></tr>';
      if (callback) {
        callback();
      }
      return;
    }

    globalThingsBodyEl.innerHTML = '<tr><td colspan="6" class="webui-empty-cell">Loading global things...</td></tr>';
    globalConflictsBodyEl.innerHTML = '<tr><td colspan="5" class="webui-empty-cell">Loading conflicts...</td></tr>';
    latestGlobalThingDetail = null;
    latestGlobalThingRuntime = null;
    renderGlobalThingDetail();

    if (!connectedCasas.length) {
      latestGlobalThings = mergeGlobalThings(casaNames, []);
      renderGlobalThings();
      if (callback) {
        callback();
      }
      return;
    }

    var responses = [];
    var pending = connectedCasas.length;

    connectedCasas.forEach(function (casa) {
      sendCommand({
        targetCasa: casa.name,
        obj: ':',
        method: 'sourceTrees',
        arguments: []
      }, function (payload) {
        if (payload) {
          payload.casaName = casa.name;
        }

        responses.push(payload || {
          ok: false,
          error: 'No response from ' + casa.name
        });

        pending -= 1;

        if (pending > 0) {
          return;
        }

        latestGlobalThings = mergeGlobalThings(casaNames, responses);
        renderGlobalThings();
        requestDescribeGlobalThing(callback);
      });
    });
  }

  socket.on('connect', function () {
    setSocketStatus('connected', 'connected');
    requestCasaInfo();
  });

  socket.on('disconnect', function () {
    setSocketStatus('error', 'disconnected');
    casaDbEl.textContent = '-';
    gangDbEl.textContent = '-';
    addConsoleSystemLine('Local runtime socket disconnected.');
  });

  socket.on('connect_error', function (error) {
    setSocketStatus('error', 'error');
    addConsoleSystemLine('Unable to connect to local runtime: ' + (error && error.message ? error.message : 'unknown error'));
  });

  socket.on('webui-status', function (payload) {
    renderCasas(payload);
    setConsoleScope(payload && payload.currentScope ? payload.currentScope : ':');
    requestGlobalThings(function () {
      requestSourceTrees(function () {
        requestConfiguredSourceTree();
      });
    });
  });

  function handleReply(payload, fallback) {
    var callback = payload && payload.id ? pendingRequests[payload.id] : null;

    if (payload && payload.id && pendingRequests[payload.id]) {
      delete pendingRequests[payload.id];
    }

    if (callback) {
      callback(payload);
      return;
    }

    fallback(payload);
  }

  socket.on('execute-output', function (payload) {
    handleReply(payload, function () {
    });
  });

  socket.on('gang-topology-output', function (payload) {
    handleReply(payload, function () {
    });
  });

  socket.on('auto-complete-output', function (payload) {
    handleReply(payload, function () {
      setConsoleHints([]);
    });
  });

  socket.on('console-line-output', function (payload) {
    handleReply(payload, function (reply) {
      appendConsoleCommandOutput(JSON.stringify(reply, null, 2));
    });
  });

  socket.on('output', function (payload) {
    var line = payload && payload.result !== undefined ? String(payload.result) : '';

    if (line) {
      appendConsoleCommandOutput(line);
    }
  });

  consoleRunButton.addEventListener('click', runConsoleLine);
  consoleLineEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      runConsoleLine();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      completeConsoleLine();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveConsoleHistory(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveConsoleHistory(1);
    }
  });
  consoleLineEl.addEventListener('input', function () {
    if (consoleHistoryIndex === -1) {
      consoleDraftLine = consoleLineEl.value;
    }
  });
  topologyRefreshButton.addEventListener('click', requestGlobalThings);
  sourcesRefreshButton.addEventListener('click', requestSourceTrees);
  designerRefreshButton.addEventListener('click', function () {
    requestConfiguredSourceTree();
  });
  sourcesPrefixEl.addEventListener('input', renderSources);
  sourcesTypeEl.addEventListener('input', renderSources);
  sourcesSearchEl.addEventListener('input', renderSources);
  tabButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setActiveTab(button.getAttribute('data-tab'));
    });
  });
  setActiveTab(activeTab);
  renderConsolePrompt();
  setConsoleHints([]);
  renderConsoleTranscript();
})();
