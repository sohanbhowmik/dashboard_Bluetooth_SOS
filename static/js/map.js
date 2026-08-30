window.MeshMap = (function() {
    let map = null;
    let gatewayLocation = null;
    const markers = {};

    // Kept in sync with the --sev-* CSS variables in style.css
    const SEVERITY_COLORS = {
        CRITICAL: '#ff5c5c',
        HIGH: '#ffb35c',
        MEDIUM: '#ffe45c',
        LOW: '#5cffb0'
    };

    function severityColor(sev) {
        return SEVERITY_COLORS[sev] || '#999999';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function severityIcon(sev) {
        return L.divIcon({
            className: '',
            html: `<div class="severity-marker" style="background:${severityColor(sev)}"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            popupAnchor: [0, -10]
        });
    }

    function init(gateway) {
        gatewayLocation = gateway || null;
        map = L.map('map', { zoomControl: false }).setView(
            gatewayLocation ? [gatewayLocation.lat, gatewayLocation.lon] : [0, 0],
            gatewayLocation ? 12 : 2
        );

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
            const sev = req.severity.toUpperCase();

            if (markers[req.message_id]) {
                // Already on the map - just make sure severity/icon is current
                markers[req.message_id].setIcon(severityIcon(sev));
                return;
            }

            const popupContent = `
                <div style="font-family: sans-serif; min-width: 160px;">
                    <h3 style="margin: 0 0 5px 0;">${escapeHtml(req.request_type)}</h3>
                    <p style="margin: 0 0 5px 0; font-size: 12px; color: #aaa;">ID: ${escapeHtml(req.message_id)}</p>
                    <p style="margin: 0;"><strong>Severity:</strong> ${escapeHtml(req.severity)}</p>
                    <p style="margin: 0;"><strong>TTL:</strong> ${escapeHtml(req.ttl)}</p>
                </div>
            `;

            const marker = L.marker([req.lat, req.lon], { icon: severityIcon(sev) })
                .bindPopup(popupContent)
                .addTo(map);

            marker.on('click', () => {
                if (onClickCallback) onClickCallback(req.message_id);
            });

            markers[req.message_id] = marker;
            if (!firstNewMarker) firstNewMarker = req;
        });

        if (Object.keys(markers).length > 0 && map.getZoom() <= 2 && firstNewMarker) {
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

    // Flies to a location and opens the popup for a specific request,
    // identified by messageId (not by lat/lng, since two requests can
    // share identical coordinates). The popup is opened only after the
    // flyTo animation finishes, so it doesn't fight the pan and jitter.
    function flyTo(lat, lon, zoom, messageId) {
        map.flyTo([lat, lon], zoom || 16, { duration: 1.5 });

        const marker = messageId ? markers[messageId] : null;
        if (!marker) return;

        map.once('moveend', () => marker.openPopup());
    }

    // Route line intentionally disabled — kept as a no-op so existing
    // calls from app.js don't need to change.
    function drawRoute(gateway, request) {
        return;
    }

    function zoomIn() {
        if (map) map.zoomIn();
    }

    function zoomOut() {
        if (map) map.zoomOut();
    }

    // Fits the map view to every visible marker plus the gateway location.
    function fitAll() {
        if (!map) return;
        const points = Object.values(markers).map(m => m.getLatLng());
        if (gatewayLocation) points.push(L.latLng(gatewayLocation.lat, gatewayLocation.lon));

        if (points.length === 0) return;
        if (points.length === 1) {
            map.flyTo(points[0], 14);
            return;
        }
        map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    }

    return {
        init,
        renderMarkers,
        removeMarker,
        flyTo,
        drawRoute,
        zoomIn,
        zoomOut,
        fitAll,
        severityColor
    };
})();