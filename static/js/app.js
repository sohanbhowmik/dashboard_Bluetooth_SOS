document.addEventListener("DOMContentLoaded", () => {
  // Real gateway coords — replace with the actual gateway phone's location once tracked
  const GATEWAY = { lat: 37.7729, lon: -122.4164 };

  // Dummy data — remove once fetchInitialData() below is pulling real data
  const MOCK_DATA = [
    { message_id: "sos-9f21", lat: 37.7749, lon: -122.4194, severity: "CRITICAL", request_type: "Medical", ttl: 4, hops: ["node-A3", "node-B7"], original_timestamp: Math.floor(Date.now() / 1000) - 120 },
    { message_id: "sos-7ab0", lat: 37.7799, lon: -122.4294, severity: "HIGH", request_type: "Shelter", ttl: 6, hops: ["node-C1"], original_timestamp: Math.floor(Date.now() / 1000) - 600 },
    { message_id: "sos-3e88", lat: 37.7699, lon: -122.4094, severity: "MEDIUM", request_type: "Water", ttl: 3, hops: [], original_timestamp: Math.floor(Date.now() / 1000) - 1500 },
    { message_id: "sos-1c44", lat: 37.7825, lon: -122.4012, severity: "LOW", request_type: "Supplies", ttl: 2, hops: ["node-D9", "node-E2", "node-F5"], original_timestamp: Math.floor(Date.now() / 1000) - 3000 },
  ];

  let activeRequests = [...MOCK_DATA];
  let currentFilter = "ALL";
  let selectedId = null;

  const requestListEl = document.getElementById('request-list');
  const requestCountEl = document.getElementById('request-count');
  const wsStatusDot = document.getElementById('ws-status');
  const wsStatusText = document.getElementById('ws-text');
  const detailCard = document.getElementById('detail-card');

  window.MeshMap.init(GATEWAY);

  // ---- Uncomment to pull real data instead of MOCK_DATA ----
  // async function fetchInitialData() {
  //   try {
  //     const res = await fetch('/api/sos');
  //     if (!res.ok) throw new Error("Failed to fetch data");
  //     activeRequests = await res.json();
  //     render();
  //   } catch (err) {
  //     console.error("Error fetching initial data:", err);
  //   }
  // }

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
      const trail = hops.length > 0
        ? `${hops.length} hop${hops.length > 1 ? 's' : ''}: ${[...hops, 'Gateway'].join(' → ')}`
        : 'Direct to gateway';

      const card = document.createElement('div');
      card.className = `request-card severity-${sev}`;
      card.id = `card-${req.message_id}`;
      card.innerHTML = `
        <div class="card-top">
          <span class="req-type">${req.request_type}</span>
          <span class="req-time">${dateStr}</span>
        </div>
        <div class="req-meta">
          <span>${req.message_id}</span>
          <span>TTL ${req.ttl}</span>
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

  function resolveRequest(id) {
    // Real version: PATCH /api/sos/{id}, then let the WebSocket "removed" event handle it
    activeRequests = activeRequests.filter(r => r.message_id !== id);
    detailCard.style.display = 'none';
    render();
  }

  document.querySelectorAll('#severity-filters li').forEach(li => {
    li.addEventListener('click', () => {
      document.querySelectorAll('#severity-filters li').forEach(x => x.classList.remove('active'));
      li.classList.add('active');
      currentFilter = li.dataset.filter;
      render();
    });
  });

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
          if (selectedId === payload.message_id) detailCard.style.display = 'none';
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

  // ---- boot ----
  render(); // using MOCK_DATA for now
  setTimeout(() => {
    wsStatusDot.className = 'status-dot connected';
    wsStatusText.textContent = 'Connected';
  }, 900);

  // When ready to go live, swap the two lines above for:
  // fetchInitialData().then(connectWebSocket);
})();