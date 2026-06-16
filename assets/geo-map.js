/* ============================================================
   MINERVA — Visitor-location map (Web Statistics)
   A precise, pannable / zoomable world map (Leaflet + CARTO
   basemap), themed to the console's light / dark palette, with
   gold visit markers sized by volume. Falls back silently if
   Leaflet or the tiles are unavailable.
   Exposes: window.MinervaGeoMap.render(el, locations, isLight)
            window.MinervaGeoMap.destroy()
   ============================================================ */
(function () {
  'use strict';

  var _map = null;

  function tileUrl(light) {
    return light
      ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  }

  function destroy() {
    try { if (_map) { _map.remove(); _map = null; } } catch (e) {}
  }

  function render(el, locations, light) {
    if (!el || !window.L) return null;
    destroy();
    var L = window.L;

    var map = L.map(el, {
      worldCopyJump: true,
      minZoom: 1,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true
    });
    _map = map;

    L.tileLayer(tileUrl(light), {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    var pts = (locations || []).filter(function (l) { return l.lat != null && l.lng != null; });
    var maxC = pts.reduce(function (m, x) { return Math.max(m, x.count || 0); }, 0) || 1;
    var bounds = [];

    pts.forEach(function (l) {
      var r = 5 + Math.round((l.count || 0) / maxC * 14);
      var mk = L.circleMarker([l.lat, l.lng], {
        radius: r,
        color: '#c2a15a',
        weight: 1.5,
        fillColor: '#c2a15a',
        fillOpacity: 0.5
      }).addTo(map);
      mk.bindTooltip(String(l.label) + ' \u00b7 ' + (l.count || 0), { direction: 'top', offset: [0, -2] });
      bounds.push([l.lat, l.lng]);
    });

    if (bounds.length) {
      try { map.fitBounds(bounds, { padding: [34, 34], maxZoom: 5 }); }
      catch (e) { map.setView([20, 0], 2); }
    } else {
      map.setView([20, 0], 2);
    }

    // Leaflet needs a size re-measure once the flex/grid layout settles.
    setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 60);
    setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 320);
    return map;
  }

  window.MinervaGeoMap = { render: render, destroy: destroy, refresh: function () { try { if (_map) _map.invalidateSize(); } catch (e) {} } };
})();
