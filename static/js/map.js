window.MeshMap = (function() {
    let map = null;
    const markers = {};

    // Initialize Map
    function init() {
        // Default center (can be customized)
        map = L.map('map').setView([0, 0], 2);

        // Load 100% free OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }

    // Add marker for a request
    function addMarker(request) {
        if (markers[request.message_id]) {
            return; // Already exists
        }

        const popupContent = `
            <div style="font-family: sans-serif;">
                <h3 style="margin: 0 0 5px 0;">${request.request_type}</h3>
                <p style="margin: 0 0 5px 0; font-size: 12px; color: #aaa;">ID: ${request.message_id}</p>
                <p style="margin: 0;"><strong>Severity:</strong> ${request.severity}</p>
                <p style="margin: 0;"><strong>Hops (TTL):</strong> ${request.ttl}</p>
            </div>
        `;

        const marker = L.marker([request.lat, request.lon])
            .bindPopup(popupContent)
            .addTo(map);

        markers[request.message_id] = marker;
        
        // Auto-center map on first marker if currently at global view
        if (Object.keys(markers).length === 1 && map.getZoom() === 2) {
            map.flyTo([request.lat, request.lon], 13);
        }
    }

    // Remove a marker by ID
    function removeMarker(messageId) {
        const marker = markers[messageId];
        if (marker) {
            map.removeLayer(marker);
            delete markers[messageId];
        }
    }

    // Fly to specific marker
    function flyToMarker(messageId) {
        const marker = markers[messageId];
        if (marker) {
            const latLng = marker.getLatLng();
            map.flyTo(latLng, 16, { duration: 1.5 });
            marker.openPopup();
        }
    }

    return {
        init,
        addMarker,
        removeMarker,
        flyToMarker
    };
})();