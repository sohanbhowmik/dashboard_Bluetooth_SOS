window.MeshMap = (function() {
    let map = null;
    let gatewayLocation = null;
    const markers = {};

    const SEVERITY_COLORS = {
        CRITICAL: '#ffffff',
        HIGH: '#d4d4d4',
        MEDIUM: '#999999',
        LOW: '#5c5c5c'
    };

    function severityColor(sev) {
        return SEVERITY_COLORS[sev] || '#999999';
    }

    function init(gateway) {
        gatewayLocation = gateway || null;
        map = L.map('map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
    }

    // Rebuilds all markers from the current filtered list.
    // onClickCallback(messageId) fires when a marker is clicked.
    function renderMarkers(requests, gateway, onClickCallback) {
        // Remove markers that no longer exist in the filtered list
        const currentIds = new Set(requests.map(r => r.message_id));
        Object.keys(markers).forEach(id => {
            if (!currentIds.has(id)) {
                map.removeLayer(markers[id]);
                delete markers[id];
            }
        });

        let firstNewMarker = null;

        requests.forEach(req => {
            if (markers[req.message_id]) return; // already on map

            const sev = req.severity.toUpperCase();
            const popupContent = `
                <div style="font-family: sans-serif;">
                    <h3 style="margin: 0 0 5px 0;">${req.request_type}</h3>
                    <p style="margin: 0 0 5px 0; font-size: 12px; color: #aaa;">ID: ${req.message_id}</p>
                    <p style="margin: 0;"><strong>Severity:</strong> ${req.severity}</p>
                    <p style="margin: 0;"><strong>TTL:</strong> ${req.ttl}</p>
                </div>
            `;

            const marker = L.marker([req.lat, req.lon])
                .bindPopup(popupContent)
                .addTo(map);

            marker.on('click', () => {
                if (onClickCallback) onClickCallback(req.message_id);
            });

            markers[req.message_id] = marker;
            if (!firstNewMarker) firstNewMarker = req;
        });

        if (Object.keys(markers).length > 0 && map.getZoom() === 2 && firstNewMarker) {
            map.flyTo([firstNewMarker.lat, firstNewMarker.lon], 13);
        }
    }

    function removeMarker(messageId) {
        const marker = markers[messageId];
        if (marker) {
            map.removeLayer(marker);
            delete markers[messageId];
        }
    }

    function flyTo(lat, lon, zoom) {
        map.flyTo([lat, lon], zoom || 16, { duration: 1.5 });
        const marker = Object.values(markers).find(
            m => m.getLatLng().lat === lat && m.getLatLng().lng === lon
        );
        if (marker) marker.openPopup();
    }

    // Route line intentionally does nothing — no line is ever drawn.
    function drawRoute(gateway, request) {
        return;
    }

    return {
        init,
        renderMarkers,
        removeMarker,
        flyTo,
        drawRoute,
        severityColor
    };
})();