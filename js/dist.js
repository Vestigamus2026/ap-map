/*
 * http://andreknieriem.de/javascript-genaue-latlon-geokoordinaten-entfernungen-errechnen/
 * Autor: André Knieriem
 */

function Deg2Rad(deg) {
	return deg * Math.PI / 180;
}

function PythagorasEquirectangular(lat1, lon1, lat2, lon2) {
	lat1 = Deg2Rad(lat1);
	lat2 = Deg2Rad(lat2);
	lon1 = Deg2Rad(lon1);
	lon2 = Deg2Rad(lon2);
	var R = 6371;
	// 6371 km 6378.388
	var x = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2);
	var y = (lat2 - lat1);
	var d = Math.sqrt(x * x + y * y) * R;
	return d;
}

function berechneEntfernung(a, b) {
	return PythagorasEquirectangular(a[1], a[0], b[1], b[0]);
};

function berechneEntfernung_karte(a_karte, b_karte) {
	var result, tmp, a,b;
	tmp = new ol.geom.Point(a_karte);
	tmp.transform("EPSG:3857", "EPSG:4326");
	a = tmp.getCoordinates();
	tmp.setCoordinates(b_karte);
	tmp.transform("EPSG:3857", "EPSG:4326");
	b = tmp.getCoordinates();
	tmp = "";
	return PythagorasEquirectangular(a[1], a[0], b[1], b[0]);
};

function berechneEntfernung_simple(a, b) {
	dx = a[1] - b[1];
	dy = a[0] - b[0];
	dist = Math.sqrt(dx * dx + dy * dy);
	return dist;
};
