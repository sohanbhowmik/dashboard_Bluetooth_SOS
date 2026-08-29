window.MeshMap = (function() {
  let map = null;
  let markersLayer = null;
  let routeLine = null;
  const GATEWAY = null; // set via setGateway() once you know the gateway's real coords

  function init() {
    map = L.map('map', { zoomControl: false }).setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    document.getElementById('btn-zoom-in').onclick = () => map.zoomIn();
    document.getElementById('btn-zoom-out').onclick = () => map.zoomOut();
    document.getElementById('btn-locate').onclick = () => {
      if (markersLayer.getLayers().length) map.fitBounds(markersLayer.getBounds().pad(0.2));
    };
  }

  function severityColor(s) {
    return { CRITICAL: '#ff6a3d', HIGH: '#ffb347', MEDIUM: '#e8e8e8', LOW: '#6c7078' }[s] || '#e8e8e8';
  }

  function renderMarkers(requests, onClick) {
    markersLayer.clearLayers();
    requests.forEach((req, i) => {
      const marker = L.marker([req.lat, req.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div class="sos-marker" style="background:${severityColor(req.severity)}">${i + 1}</div>`,
          iconSize: [30, 30]
        })
      }).addTo(markersLayer);
      marker.bindPopup(`
        <div style="font-family: sans-serif;">
          <h3 style="margin:0 0 5px 0;">${req.request_type}</h3>
          <p style="margin:0 0 5px 0; font-size:12px; color:#aaa;">ID: ${req.message_id}</p>
          <p style="margin:0;"><strong>Severity:</strong> ${req.severity}</p>
          <p style="margin:0;"><strong>TTL:</strong> ${req.ttl}</p>
        </div>
      `);
      marker.on('click', () => onClick(req.message_id));
      if (i === 0 && requests.length === 1) map.flyTo([req.lat, req.lon], 14);
    });
  }

  function drawRoute(gatewayLatLng, req) {
    if (routeLine) map.removeLayer(routeLine);
    if (!req || !gatewayLatLng) return;
    routeLine = L.polyline([gatewayLatLng, [req.lat, req.lon]], {
      color: '#ff6a3d', weight: 3, dashArray: '2 8', lineCap: 'round'
    }).addTo(map);
  }

  function flyTo(lat, lon, zoom = 16) {
    map.flyTo([lat, lon], zoom, { duration: 1.2 });
  }

  return { init, renderMarkers, drawRoute, flyTo, get map() { return map; } };
})();