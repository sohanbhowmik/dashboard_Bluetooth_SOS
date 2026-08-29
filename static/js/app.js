document.addEventListener("DOMContentLoaded", () => {
    const DEMO_MODE = true;

    const DUMMY_REQUESTS = [
        { message_id: "demo-001", original_timestamp: Math.floor(Date.now() / 1000) - 60 * 40, lat: 13.0908, lon: 80.2214, gps_fix_age_seconds: 12, ttl: 4 },
        { message_id: "demo-002", original_timestamp: Math.floor(Date.now() / 1000) - 60 * 32, lat: 13.0339, lon: 80.2619, gps_fix_age_seconds: 210, ttl: 1 },
        { message_id: "demo-003", original_timestamp: Math.floor(Date.now() / 1000) - 60 * 25, lat: 13.0475, lon: 80.2154, gps_fix_age_seconds: 8, ttl: 6 },
        { message_id: "demo-004", original_timestamp: Math.floor(Date.now() / 1000) - 60 * 18, lat: 13.1067, lon: 80.2847, gps_fix_age_seconds: 45, ttl: 2 },
        { message_id: "demo-005", original_timestamp: Math.floor(Date.now() / 1000) - 60 * 11, lat: 13.0674, lon: 80.2376, gps_fix_age_seconds: 5, ttl: 5 },
        { message_id: "demo-006", original_timestamp: Math.floor(Date.now() / 1000) - 60 * 4, lat: 13.0827, lon: 80.2707, gps_fix_age_seconds: 300, ttl: 3 }
    ];

    window.MeshMap.init();

    let activeRequests = [];

    const requestListEl = document.getElementById('request-list');
    const requestCountEl = document.getElementById('request-count');
    const wsStatusDot = document.getElementById('ws-status');
    const wsStatusText = document.getElementById('ws-text');

    if (DEMO_MODE) {
        injectDemoBadge();
    }

    function injectDemoBadge() {
        const badge = document.createElement('div');
        badge.className = 'demo-badge';
        badge.textContent = 'Demo mode — local data only';
        document.body.appendChild(badge);
    }

    function formatRadius(radiusM) {
        return radiusM >= 1000 ? `${(radiusM / 1000).toFixed(1)} km` : `${Math.round(radiusM)} m`;
    }

    async function fetchInitialData() {
        if (DEMO_MODE) {
            activeRequests = JSON.parse(JSON.stringify(DUMMY_REQUESTS));
            renderUI();
            return;
        }

        try {
            const res = await fetch('/api/sos');
            if (!res.ok) throw new Error("Failed to fetch data");
            const data = await res.json();
            activeRequests = data;
            renderUI();
        } catch (err) {
            console.error("Error fetching initial data:", err);
        }
    }

    function renderUI() {
        // Ascending — first SOS received sits at the top of the queue.
        activeRequests.sort((a, b) => a.original_timestamp - b.original_timestamp);

        requestCountEl.textContent = activeRequests.length;
        requestListEl.innerHTML = '';

        if (activeRequests.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'request-list-empty';
            empty.textContent = 'No active signals.';
            requestListEl.appendChild(empty);
        }

        activeRequests.forEach((req, index) => {
            window.MeshMap.addMarker(req);

            const dateStr = new Date(req.original_timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const fixAge = req.gps_fix_age_seconds;
            const isStale = typeof fixAge === 'number' && fixAge > 90;
            const fixAgeLabel = typeof fixAge === 'number'
                ? (fixAge < 60 ? `${fixAge}s before send` : `${Math.round(fixAge / 60)}m before send`)
                : 'unknown';

            // Same estimate map.js uses for the circle, so sidebar and map
            // never disagree on the radius shown for the same signal.
            const radiusM = window.MeshMap.estimateRadiusMeters(fixAge);
            const radiusLabel = formatRadius(radiusM);

            const card = document.createElement('div');
            card.className = 'request-card';
            card.id = `card-${req.message_id}`;

            card.onclick = (e) => {
                if (e.target.type !== 'checkbox') {
                    window.MeshMap.flyToMarker(req.message_id);
                }
            };

            card.innerHTML = `
                <div class="card-queue-number">${index + 1}</div>
                <div class="card-checkbox">
                    <input type="checkbox" data-id="${req.message_id}" title="Mark as Completed">
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <span class="req-type">SOS Signal</span>
                        <span class="req-time">${dateStr}</span>
                    </div>
                    <div class="req-meta">ID ${req.message_id} · relayed ${req.ttl} hop${req.ttl === 1 ? '' : 's'}</div>
                    <div class="req-location">
                        <span class="loc-label">GPS</span>${req.lat.toFixed(4)}, ${req.lon.toFixed(4)}
                        <br>
                        <span class="loc-label">Fix captured</span><span class="${isStale ? 'loc-stale' : ''}">${fixAgeLabel}${isStale ? ' — may be stale' : ''}</span>
                        <br>
                        <span class="loc-label">Est. radius</span>~${radiusLabel} <span style="opacity:0.6">(worst-case, based on fix age)</span>
                    </div>
                </div>
            `;

            requestListEl.appendChild(card);
        });

        document.querySelectorAll('.card-checkbox input').forEach(box => {
            box.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    const msgId = e.target.getAttribute('data-id');
                    await markAsCompleted(msgId);
                }
            });
        });
    }

    async function markAsCompleted(messageId) {
        if (DEMO_MODE) {
            activeRequests = activeRequests.filter(r => r.message_id !== messageId);
            window.MeshMap.removeMarker(messageId);
            renderUI();
            return;
        }

        try {
            await fetch(`/api/sos/${messageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            console.error("Failed to mark as completed:", err);
            const checkbox = document.querySelector(`input[data-id="${messageId}"]`);
            if (checkbox) checkbox.checked = false;
        }
    }

    function connectWebSocket() {
        if (DEMO_MODE) {
            wsStatusDot.className = "status-dot connected";
            wsStatusText.textContent = "Connected (demo)";
            return;
        }

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
                    renderUI();
                } else if (payload.type === "removed") {
                    activeRequests = activeRequests.filter(r => r.message_id !== payload.message_id);
                    window.MeshMap.removeMarker(payload.message_id);
                    renderUI();
                }
            } catch (err) {
                console.error("Error parsing WebSocket message", err);
            }
        };

        ws.onclose = () => {
            wsStatusDot.className = "status-dot disconnected";
            wsStatusText.textContent = "Disconnected — retrying...";
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