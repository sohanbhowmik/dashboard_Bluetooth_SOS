window.MeshMap = (function() {
  let map = null;
  let markersLayer = null;
  let routeLine = null;

  function severityColor(s) {
    return { CRITICAL: '#ff6a3d', HIGH: '#ffb347', MEDIUM: '#cfd2d6', LOW: '#5a5d61' }[s] || '#cfd2d6';
  }

  function severityRadius(s) {
    // meters — rough "search/relay radius" around each SOS ping
    return { CRITICAL: 450, HIGH: 300, MEDIUM: 200, LOW: 120 }[s] || 200;
  }

  function init(gateway) {
    map = L.map('map', { zoomControl: false }).setView([gateway.lat, gateway.lon], 14);
    // Plain OpenStreetMap tiles — free, no API key required, ever.
    // Dark look comes from a CSS filter on the tile pane (see style.css).
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    document.getElementById('btn-locate').onclick = () => {
      if (markersLayer.getLayers().length) map.fitBounds(markersLayer.getBounds().pad(0.3));
    };
    document.getElementById('btn-zoom-in').onclick = () => map.zoomIn();
    document.getElementById('btn-zoom-out').onclick = () => map.zoomOut();
  }

  function renderMarkers(requests, gateway, onClick) {
    markersLayer.clearLayers();

    requests.forEach((req, i) => {
      const color = severityColor(req.severity);

      L.circle([req.lat, req.lon], {
        radius: severityRadius(req.severity),
        color: color,
        weight: 1,
        opacity: 0.6,
        fillColor: color,
        fillOpacity: 0.08
      }).addTo(markersLayer);

      const marker = L.marker([req.lat, req.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div class="sos-marker" style="background:${color}">${i + 1}</div>`,
          iconSize: [28, 28]
        })
      }).addTo(markersLayer);

      marker.bindPopup(`
        <div style="font-family: sans-serif;">
          <h3 style="margin:0 0 5px 0;">${req.request_type}</h3>
          <p style="margin:0 0 5px 0; font-size:12px; color:#aaa;">ID: ${req.message_id}</p>
          <p style="margin:0;"><strong>Severity:</strong> ${req.severity}</p>
          <p style="margin:0;"><strong>GPS:</strong> ${req.lat.toFixed(4)}, ${req.lon.toFixed(4)}</p>
          <p style="margin:0;"><strong>TTL:</strong> ${req.ttl}</p>
        </div>
      `);
      marker.on('click', () => onClick(req.message_id));
    });
  }

  function drawRoute(gateway, req) {
    if (routeLine) map.removeLayer(routeLine);
    if (!req || !gateway) return;
    routeLine = L.polyline([[gateway.lat, gateway.lon], [req.lat, req.lon]], {
      color: '#ff6a3d', weight: 3, dashArray: '2 8', lineCap: 'round'
    }).addTo(map);
  }

  function flyTo(lat, lon, zoom = 16) {
    map.flyTo([lat, lon], zoom, { duration: 1.1 });
  }

  function fitAll() {
    if (markersLayer.getLayers().length) map.fitBounds(markersLayer.getBounds().pad(0.3));
  }

  return { init, renderMarkers, drawRoute, flyTo, fitAll, severityColor, get map() { return map; } };
})();