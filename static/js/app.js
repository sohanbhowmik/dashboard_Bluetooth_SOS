document.addEventListener("DOMContentLoaded", () => {
  const GATEWAY = { lat: 37.7729, lon: -122.4164 }; // update to your real gateway phone's coords if tracked

  let activeRequests = [];
  let currentFilter = "ALL";
  let selectedId = null;

  const requestListEl = document.getElementById('request-list');
  const requestCountEl = document.getElementById('request-count');
  const wsStatusDot = document.getElementById('ws-status');
  const wsStatusText = document.getElementById('ws-text');
  const detailCard = document.getElementById('detail-card');

  window.MeshMap.init(GATEWAY);

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  async function fetchInitialData() {
    try {
      const res = await fetch('/api/sos');
      if (!res.ok) throw new Error("Failed to fetch data");
      activeRequests = await res.json();
      render();
    } catch (err) {
      console.error("Error fetching initial data:", err);
    }
  }

  function getFiltered() {
    return currentFilter === "ALL"
      ? activeRequests
      : activeRequests.filter(r => r.severity.toUpperCase() === currentFilter);
  }

  function updateCounts() {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    activeRequests.forEach(r => {
      const sev = r.severity.toUpperCase();
      if (counts[sev] !== undefined) counts[sev]++;
    });
    document.getElementById('count-all').textContent = activeRequests.length;
    document.getElementById('count-critical').textContent = counts.CRITICAL;
    document.getElementById('count-high').textContent = counts.HIGH;
    document.getElementById('count-medium').textContent = counts.MEDIUM;
    document.getElementById('count-low').textContent = counts.LOW;
    requestCountEl.textContent = `(${activeRequests.length})`;

    const allNodes = new Set();
    activeRequests.forEach(r => (r.hops || []).forEach(h => allNodes.add(h)));
    document.getElementById('mesh-nodes').textContent = allNodes.size;
    document.getElementById('mesh-signal').textContent = allNodes.size > 0 ? '●' : '○';
    document.getElementById('mesh-sync').textContent =
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function render() {
    activeRequests.sort((a, b) => b.original_timestamp - a.original_timestamp);
    updateCounts();

    const filtered = getFiltered();
    requestListEl.innerHTML = '';

    filtered.forEach(req => {
      const sev = req.severity.toUpperCase();
      const dateStr = new Date(req.original_timestamp * 1000)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const hops = req.hops || [];
      const trailHops = [...hops.map(escapeHtml), 'Gateway'];
      const trail = hops.length > 0
        ? `${hops.length} hop${hops.length > 1 ? 's' : ''}: ${trailHops.join(' → ')}`
        : 'Direct to gateway';

      const card = document.createElement('div');
      card.className = `request-card severity-${sev}`;
      card.id = `card-${req.message_id}`;
      card.innerHTML = `
        <div class="card-top">
          <span class="req-type">${escapeHtml(req.request_type)}</span>
          <span class="req-time">${dateStr}</span>
        </div>
        <div class="req-meta">
          <span>${escapeHtml(req.message_id)}</span>
          <span>TTL ${escapeHtml(req.ttl)}</span>
        </div>
        <div class="req-gps">${req.lat.toFixed(4)}, ${req.lon.toFixed(4)}</div>
        <div class="hop-trail">${trail}</div>
      `;
      card.onclick = () => selectRequest(req.message_id);
      requestListEl.appendChild(card);
    });

    window.MeshMap.renderMarkers(filtered, GATEWAY, selectRequest);
  }

  function selectRequest(id) {
    selectedId = id;
    const req = activeRequests.find(r => r.message_id === id);
    if (!req) return;
    window.MeshMap.drawRoute(GATEWAY, req);
    window.MeshMap.flyTo(req.lat, req.lon, 16);
    showDetail(req);
  }

  function showDetail(req) {
    detailCard.style.display = 'block';
    const tag = document.getElementById('detail-tag');
    tag.textContent = req.severity.toUpperCase();
    tag.style.color = window.MeshMap.severityColor(req.severity.toUpperCase());
    document.getElementById('detail-title').textContent = req.request_type;
    const hops = req.hops || [];
    const trail = hops.length ? [...hops, 'Gateway'].join(' → ') : 'Direct to gateway';
    document.getElementById('detail-sub').textContent =
      `ID ${req.message_id} · GPS ${req.lat.toFixed(4)}, ${req.lon.toFixed(4)} · TTL ${req.ttl} · ${trail}`;
    document.getElementById('detail-resolve').onclick = () => resolveRequest(req.message_id);
    document.getElementById('detail-close').onclick = () => {
      detailCard.style.display = 'none';
      window.MeshMap.drawRoute(null, null);
    };
  }

  async function resolveRequest(id) {
    try {
      const res = await fetch(`/api/sos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error("Failed to mark as completed");

      detailCard.style.display = 'none';
      window.MeshMap.drawRoute(null, null);

      // Remove locally right away as a safety net, in case the
      // WebSocket "removed" broadcast is delayed or dropped.
      activeRequests = activeRequests.filter(r => r.message_id !== id);
      if (selectedId === id) selectedId = null;
      render();
    } catch (err) {
      console.error("Failed to mark as completed:", err);
    }
  }

  document.querySelectorAll('#severity-filters li').forEach(li => {
    li.addEventListener('click', () => {
      document.querySelectorAll('#severity-filters li').forEach(x => x.classList.remove('active'));
      li.classList.add('active');
      currentFilter = li.dataset.filter;
      render();
    });
  });

  // Map controls
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomIn) btnZoomIn.addEventListener('click', () => window.MeshMap.zoomIn());
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => window.MeshMap.zoomOut());

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsStatusDot.className = "status-dot connected";
      wsStatusText.textContent = "Connected";
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "new") {
          payload.data.forEach(newReq => {
            if (!activeRequests.find(r => r.message_id === newReq.message_id)) {
              activeRequests.push(newReq);
            }
          });
          render();
        } else if (payload.type === "removed") {
          activeRequests = activeRequests.filter(r => r.message_id !== payload.message_id);
          if (selectedId === payload.message_id) {
            detailCard.style.display = 'none';
            window.MeshMap.drawRoute(null, null);
            selectedId = null;
          }
          render();
        }
      } catch (err) {
        console.error("Error parsing WebSocket message", err);
      }
    };

    ws.onclose = () => {
      wsStatusDot.className = "status-dot disconnected";
      wsStatusText.textContent = "Disconnected - Retrying...";
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      ws.close();
    };
  }

  (async () => {
    await fetchInitialData();
    connectWebSocket();
  })();
});