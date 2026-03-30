(function () {
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
  var topologyLocalBowedEl = document.getElementById('topology-local-bowed');
  var topologyPeerBowedEl = document.getElementById('topology-peer-bowed');
  var topologyTotalBowedEl = document.getElementById('topology-total-bowed');
  var topologyBodyEl = document.getElementById('topology-body');
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
  var designerSelectedThingEl = document.getElementById('designer-selected-thing');
  var designerSummaryEl = document.getElementById('designer-summary');
  var designerDetailEl = document.getElementById('designer-detail');
  var latestTopology = null;
  var latestSourceTrees = null;
  var latestThingNodes = [];
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

  function renderCasas(payload) {
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
      designerTreeEl.innerHTML = '<div class="webui-empty">No active things found.</div>';
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

  function renderDesignerDetail(payload) {
    if (!payload || !payload.thing || !payload.thing.object) {
      designerSelectedThingEl.textContent = '-';
      designerSummaryEl.innerHTML = '<span class="webui-chip">thing: -</span>';
      designerDetailEl.innerHTML = '<div class="webui-empty">Select a thing to inspect.</div>';
      return;
    }

    designerSelectedThingEl.textContent = payload.thing.object.uName;
    designerSummaryEl.innerHTML = [
      'thing: ' + payload.thing.object.uName,
      'children: ' + (payload.children ? payload.children.length : 0),
      'properties: ' + (payload.properties ? payload.properties.length : 0),
      'events: ' + (payload.events ? payload.events.length : 0),
      'bowing: ' + (payload.thing.bowing ? 'yes' : 'no')
    ].map(function (label) {
      return '<span class="webui-chip">' + label + '</span>';
    }).join('');

    var parentLabel = payload.parent && payload.parent.object ? payload.parent.object.uName : 'none';
    var childList = payload.children && payload.children.length
      ? payload.children.map(function (child) { return '<span class="webui-chip">' + child.object.uName + '</span>'; }).join('')
      : '<div class="webui-empty">none</div>';

    designerDetailEl.innerHTML =
      '<section class="webui-designer-card">' +
        '<h4>Thing</h4>' +
        '<dl class="webui-designer-kv">' +
          '<dt>uName</dt><dd>' + payload.thing.object.uName + '</dd>' +
          '<dt>type</dt><dd>' + (payload.thing.object.type || '-') + '</dd>' +
          '<dt>owner casa</dt><dd>' + (payload.thing.object.ownerCasa || '-') + '</dd>' +
          '<dt>priority</dt><dd>' + (payload.thing.priority === null ? '-' : payload.thing.priority) + '</dd>' +
          '<dt>parent</dt><dd>' + parentLabel + '</dd>' +
        '</dl>' +
      '</section>' +
      '<section class="webui-designer-card">' +
        '<h4>Object propagation</h4>' +
        '<dl class="webui-designer-kv">' +
          '<dt>ignore parent</dt><dd>' + (payload.propagation.objectLevel.ignoreParent ? 'yes' : 'no') + '</dd>' +
          '<dt>ignore children</dt><dd>' + (payload.propagation.objectLevel.ignoreChildren ? 'yes' : 'no') + '</dd>' +
          '<dt>propagate to parent</dt><dd>' + (payload.propagation.objectLevel.propagateToParent ? 'yes' : 'no') + '</dd>' +
          '<dt>propagate to children</dt><dd>' + (payload.propagation.objectLevel.propagateToChildren ? 'yes' : 'no') + '</dd>' +
        '</dl>' +
      '</section>' +
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
             row.ownerCasa.toLowerCase().includes(search) ||
             row.type.toLowerCase().includes(search);
    });
  }

  function renderSources() {
    var rows = filteredSourceRows(sourceRowsFromTrees(latestSourceTrees));
    var hasSelectedRow = rows.some(function (row) { return row.sourceUName === selectedActiveSourceUName; });

    sourcesActiveCountEl.textContent = 'active: ' + rows.length;
    sourcesOwnedActiveCountEl.textContent = 'owned active: ' + rows.filter(function (row) { return row.providerType !== 'peercasa'; }).length;
    sourcesPeerActiveCountEl.textContent = 'peer active: ' + rows.filter(function (row) { return row.providerType === 'peercasa'; }).length;

    if (!rows.length) {
      selectedActiveSourceUName = '';
      renderSourceStateDetail(null);
      sourcesBodyEl.innerHTML = '<tr><td colspan="4" class="webui-empty-cell">No matching active sources.</td></tr>';
      return;
    }

    if (!selectedActiveSourceUName || !hasSelectedRow) {
      selectedActiveSourceUName = rows[0].sourceUName;
    }

    sourcesBodyEl.innerHTML = rows.map(function (row) {
      return '<tr class="' + (row.isPrivate ? 'webui-table-row-private ' : '') + (row.sourceUName === selectedActiveSourceUName ? 'webui-table-row-selected' : '') + '" data-source-u-name="' + escapeHtmlAttr(row.sourceUName) + '">' +
        '<td>' + row.sourceUName + '</td>' +
        '<td>' + row.ownerCasa + '</td>' +
        '<td>' + row.type + '</td>' +
        '<td>' + row.priority + '</td>' +
      '</tr>';
    }).join('');

    Array.from(sourcesBodyEl.querySelectorAll('[data-source-u-name]')).forEach(function (rowEl) {
      rowEl.addEventListener('click', function () {
        selectedActiveSourceUName = rowEl.getAttribute('data-source-u-name') || '';
        renderSources();
        requestDescribeSourceState();
      });
    });
  }

  function requestDescribeSourceState() {
    if (!socket.connected) {
      renderSourceStateDetail(null);
      return;
    }

    if (!selectedActiveSourceUName) {
      renderSourceStateDetail(null);
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
        return;
      }

      renderSourceStateDetail(payload.result);
    });
  }

  function getTopologyRowData(data, rowCasaName) {
    if (!data || !rowCasaName) {
      return null;
    }

    var rows = data.rows ? data.rows : [];
    return rows.find(function (row) {
      return row.casaName === rowCasaName;
    }) || null;
  }

  function renderTopology() {
    var data = latestTopology;
    var rows = data && data.rows ? data.rows : [];
    var connectedCasaCount = data && typeof data.connectedCasaCount === 'number' ? data.connectedCasaCount : 0;
    var casaCount = data && typeof data.casaCount === 'number' ? data.casaCount : rows.length;
    var ownedBowed = rows.reduce(function (count, row) {
      return count + (typeof row.ownedBowed === 'number' ? row.ownedBowed : 0);
    }, 0);
    var peerBowed = rows.reduce(function (count, row) {
      return count + (typeof row.peerBowed === 'number' ? row.peerBowed : 0);
    }, 0);
    var totalBowed = ownedBowed + peerBowed;

    topologyGangEl.textContent = 'gang: ' + (data && data.gangName ? data.gangName : '-');
    topologyLocalEl.textContent = 'casas: ' + casaCount;
    topologyConnectedPeersEl.textContent = 'connected: ' + connectedCasaCount + '/' + casaCount;
    topologyLocalBowedEl.textContent = 'owned bowed: ' + ownedBowed;
    topologyPeerBowedEl.textContent = 'peer bowed: ' + peerBowed;
    topologyTotalBowedEl.textContent = 'total bowed: ' + totalBowed;

    if (!data) {
      topologyBodyEl.innerHTML = '<tr><td colspan="8" class="webui-empty-cell">No topology loaded yet.</td></tr>';
      return;
    }

    topologyBodyEl.innerHTML = rows.map(function (row) {
      var rowClass = row.casaName === currentSelectedCasa ? ' class="webui-table-row-selected"' : '';

      return '<tr' + rowClass + '>' +
        '<td>' + row.casaName + '</td>' +
        '<td>' + row.active + '</td>' +
        '<td>' + row.owned + '</td>' +
        '<td>' + row.ownedActive + '</td>' +
        '<td>' + row.ownedBowed + '</td>' +
        '<td>' + row.peerActive + '</td>' +
        '<td>' + row.peerBowed + '</td>' +
        '<td>' + row.privateCount + '</td>' +
      '</tr>';
    }).join('');
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
      sourcesBodyEl.innerHTML = '<tr><td colspan="4" class="webui-empty-cell">Socket is not connected yet.</td></tr>';
      if (callback) {
        callback();
      }
      return;
    }

    sourcesBodyEl.innerHTML = '<tr><td colspan="4" class="webui-empty-cell">Loading active sources...</td></tr>';
    sendCommand({
      obj: ':',
      method: 'sourceTrees',
      arguments: []
    }, function (payload) {
      if (!payload.ok) {
        latestSourceTrees = null;
        selectedActiveSourceUName = '';
        renderSourceStateDetail(null);
        sourcesBodyEl.innerHTML = '<tr><td colspan="4" class="webui-empty-cell">' + payload.error + '</td></tr>';
        if (callback) {
          callback();
        }
        return;
      }

      latestSourceTrees = payload.result;
      latestThingNodes = collectThingNodes(latestSourceTrees && latestSourceTrees.activeTree ? latestSourceTrees.activeTree : null);
      if (!selectedThingUName || !treeContains(latestThingNodes, selectedThingUName)) {
        selectedThingUName = findFirstThingUName(latestThingNodes);
      }
      findThingPath(latestThingNodes, selectedThingUName).forEach(function (uName) {
        expandedThingNodes.add(uName);
      });
      renderDesignerTree();
      renderSources();
      requestDescribeThing(function () {
        requestDescribeSourceState();
      });
      if (callback) {
        callback();
      }
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
        designerSummaryEl.innerHTML = '<span class="webui-chip">thing: ' + selectedThingUName + '</span>';
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

  function requestTopology(callback) {
    if (!socket.connected) {
      topologyBodyEl.innerHTML = '<tr><td colspan="8" class="webui-empty-cell">Socket is not connected yet.</td></tr>';
      if (callback) {
        callback();
      }
      return;
    }

    topologyBodyEl.innerHTML = '<tr><td colspan="8" class="webui-empty-cell">Loading topology...</td></tr>';
    emitWithReply('getGangTopology', {}, function (payload) {
      if (!payload.ok) {
        latestTopology = null;
        topologyBodyEl.innerHTML = '<tr><td colspan="8" class="webui-empty-cell">' + payload.error + '</td></tr>';
        if (callback) {
          callback();
        }
        return;
      }

      latestTopology = payload.result;
      renderTopology();
      if (callback) {
        callback();
      }
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
    requestTopology(function () {
      requestSourceTrees();
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
  topologyRefreshButton.addEventListener('click', requestTopology);
  sourcesRefreshButton.addEventListener('click', requestSourceTrees);
  designerRefreshButton.addEventListener('click', function () {
    requestSourceTrees();
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
