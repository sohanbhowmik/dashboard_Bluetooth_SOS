window.MeshMap = (function () {
    let map = null;
    const markers = {};
    const radiusCircles = {};

    // Assumptions used to turn "how old is this GPS fix" into an
    // approximate search radius. Both are roughly tunable:
    // - GPS_BASE_UNCERTAINTY_M: typical consumer GPS accuracy even on
    //   a fresh fix (worse indoors/under canopy, better in open sky).
    // - WALK_SPEED_MPS: assumed max movement speed since the fix was
    //   taken (~5 km/h, a normal walking pace). This is a upper-bound
    //   estimate, not a prediction of where the person actually is.
    const GPS_BASE_UNCERTAINTY_M = 25;
    const WALK_SPEED_MPS = 1.4;
    const MAX_RADIUS_M = 3000; // cap so a very old/missing fix doesn't draw an absurd circle

    function estimateRadiusMeters(gpsFixAgeSeconds) {
        const age = typeof gpsFixAgeSeconds === 'number' ? gpsFixAgeSeconds : 0;
        const radius = GPS_BASE_UNCERTAINTY_M + age * WALK_SPEED_MPS;
        return Math.min(radius, MAX_RADIUS_M);
    }

    function init() {
        map = L.map('map').setView([0, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }

    function blipIcon() {
        return L.divIcon({
            className: '',
            html: `<div class="blip-marker"><div class="ring"></div><div class="dot"></div></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            popupAnchor: [0, -9]
        });
    }

    function formatRadius(radiusM) {
        return radiusM >= 1000 ? `${(radiusM / 1000).toFixed(1)} km` : `${Math.round(radiusM)} m`;
    }

    function addMarker(request) {
        if (markers[request.message_id]) {
            return; // Already exists
        }

        const fixAge = request.gps_fix_age_seconds;
        const isStale = typeof fixAge === 'number' && fixAge > 90;
        const fixAgeLabel = typeof fixAge === 'number'
            ? (fixAge < 60 ? `${fixAge}s before send` : `${Math.round(fixAge / 60)}m before send`)
            : 'unknown';

        const radiusM = estimateRadiusMeters(fixAge);
        const radiusLabel = formatRadius(radiusM);

        const popupContent = `
            <div style="font-family: 'Inter', sans-serif; min-width: 200px;">
                <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">SOS Signal</div>
                <div style="font-size: 11px; opacity: 0.65; margin-bottom: 8px;">ID ${request.message_id}</div>
                <div style="font-size: 12px; font-family: 'JetBrains Mono', monospace; margin-bottom: 3px;">
                    ${request.lat.toFixed(4)}, ${request.lon.toFixed(4)}
                </div>
                <div style="font-size: 11px; opacity: 0.75;">
                    Fix captured ${fixAgeLabel}${isStale ? ' — may be stale' : ''}
                </div>
                <div style="font-size: 11px; opacity: 0.75; margin-top: 2px;">
                    Est. search radius: ~${radiusLabel}
                </div>
                <div style="font-size: 11px; opacity: 0.75; margin-top: 2px;">
                    Relayed ${request.ttl} hop${request.ttl === 1 ? '' : 's'}
                </div>
            </div>
        `;

        // Uncertainty circle first (so the marker draws on top of it)
        const circle = L.circle([request.lat, request.lon], {
            radius: radiusM,
            className: 'search-radius-circle'
        }).addTo(map);
        radiusCircles[request.message_id] = circle;

        const marker = L.marker([request.lat, request.lon], { icon: blipIcon() })
            .bindPopup(popupContent)
            .addTo(map);

        markers[request.message_id] = marker;

        if (Object.keys(markers).length === 1 && map.getZoom() === 2) {
            map.flyTo([request.lat, request.lon], 12);
        }
    }

    function removeMarker(messageId) {
        const marker = markers[messageId];
        if (marker) {
            map.removeLayer(marker);
            delete markers[messageId];
        }
        const circle = radiusCircles[messageId];
        if (circle) {
            map.removeLayer(circle);
            delete radiusCircles[messageId];
        }
    }

    function flyToMarker(messageId) {
        const marker = markers[messageId];
        const circle = radiusCircles[messageId];
        if (marker && circle) {
            // Fit the whole uncertainty circle in view, not just the point,
            // since the circle is the actually-useful search area.
            map.flyToBounds(circle.getBounds(), { duration: 1.2, padding: [40, 40] });
            marker.openPopup();
        } else if (marker) {
            map.flyTo(marker.getLatLng(), 15, { duration: 1.2 });
            marker.openPopup();
        }
    }

    return {
        init,
        addMarker,
        removeMarker,
        flyToMarker,
        estimateRadiusMeters // exposed so app.js can reuse the same estimate in the sidebar
    };
})();