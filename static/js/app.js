document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Map
    window.MeshMap.init();

    // Application State
    let activeRequests = [];

    // DOM Elements
    const requestListEl = document.getElementById('request-list');
    const requestCountEl = document.getElementById('request-count');
    const wsStatusDot = document.getElementById('ws-status');
    const wsStatusText = document.getElementById('ws-text');

    // 2. Fetch Initial State (Pending Requests)
    async function fetchInitialData() {
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

    // 3. Render UI (Sidebar & Map)
    function renderUI() {
        // Sort descending by original_timestamp (newest first)
        activeRequests.sort((a, b) => b.original_timestamp - a.original_timestamp);
        
        // Update Count
        requestCountEl.textContent = activeRequests.length;
        
        // Clear current list
        requestListEl.innerHTML = '';
        
        activeRequests.forEach(req => {
            // Render map marker
            window.MeshMap.addMarker(req);

            // Create sidebar card
            const dateStr = new Date(req.original_timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
            
            const card = document.createElement('div');
            card.className = `request-card severity-${req.severity.toUpperCase()}`;
            card.id = `card-${req.message_id}`;
            
            // Allow clicking the card body to fly to marker
            card.onclick = (e) => {
                // Prevent trigger if clicking the checkbox
                if(e.target.type !== 'checkbox') {
                    window.MeshMap.flyToMarker(req.message_id);
                }
            };

            card.innerHTML = `
                <div class="card-checkbox">
                    <input type="checkbox" data-id="${req.message_id}" title="Mark as Completed">
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <span class="req-type">${req.request_type}</span>
                        <span class="req-time">${dateStr}</span>
                    </div>
                    <div class="req-meta">
                        <span>ID: ${req.message_id}</span>
                        <span>TTL: ${req.ttl}</span>
                    </div>
                </div>
            `;
            
            requestListEl.appendChild(card);
        });

        // Attach event listeners to checkboxes
        document.querySelectorAll('.card-checkbox input').forEach(box => {
            box.addEventListener('change', async (e) => {
                const isChecked = e.target.checked;
                if (isChecked) {
                    const msgId = e.target.getAttribute('data-id');
                    await markAsCompleted(msgId);
                }
            });
        });
    }

    // 4. Handle Completion (PATCH)
    async function markAsCompleted(messageId) {
        try {
            // We only send the PATCH. We let the WebSocket broadcast handle actual removal.
            await fetch(`/api/sos/${messageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            console.error("Failed to mark as completed:", err);
            // If failed, uncheck the box visually
            const checkbox = document.querySelector(`input[data-id="${messageId}"]`);
            if (checkbox) checkbox.checked = false;
        }
    }

    // 5. Establish WebSocket Connection
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
                    // Add new requests, ensuring we don't duplicate existing ones
                    payload.data.forEach(newReq => {
                        if (!activeRequests.find(r => r.message_id === newReq.message_id)) {
                            activeRequests.push(newReq);
                        }
                    });
                    renderUI();
                } 
                else if (payload.type === "removed") {
                    // Remove from active array
                    activeRequests = activeRequests.filter(r => r.message_id !== payload.message_id);
                    
                    // Remove from Map
                    window.MeshMap.removeMarker(payload.message_id);
                    
                    // Re-render UI
                    renderUI();
                }
            } catch (err) {
                console.error("Error parsing WebSocket message", err);
            }
        };

        ws.onclose = () => {
            wsStatusDot.className = "status-dot disconnected";
            wsStatusText.textContent = "Disconnected - Retrying...";
            // Reconnect after 3 seconds
            setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            ws.close(); // Triggers onclose and reconnection logic
        };
    }

    // Start App
    fetchInitialData();
    connectWebSocket();
});