/**
 @author Sven Hering
 */

/*
 * Tools zum Umrechnen
 */

inverseMercator = function(x) {
	var lat, lon;
	lon = (x[0] / 20015086.7960206) * 180;
	lat = (x[1] / 20015086.7960206) * 180;
	lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
	return [lon, lat];
};

fix_MapNGuide = function(x) {
	var returnarray = inverseMercator(x);
	return returnarray;
};

fix_MapNGuide_array = function(x) {
	var i = 0, returnarray = [];
	while (i < x.length) {
		returnarray.push(inverseMercator(x[i]));
		++i;
	}
	return returnarray;
};

function decompress(encoded, precision) {
	precision = Math.pow(10, -precision);
	var len = encoded.length, index = 0, lat = 0, lng = 0, array = [];
	while (index < len) {
		var b, shift = 0, result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
		lat += dlat;
		shift = 0;
		result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
		lng += dlng;
		array.push(lat * precision);
		array.push(lng * precision);
	}
	return array;
};

function compress(points, precision) {
	var oldLat = 0, oldLng = 0, len = points.length, index = 0;
	var encoded = '';
	precision = Math.pow(10, precision);
	while (index < len) {
		//  Round to N decimal places
		var lat = Math.round(points[index++] * precision);
		var lng = Math.round(points[index++] * precision);

		//  Encode the differences between the points
		encoded += encodeNumber(lat - oldLat);
		encoded += encodeNumber(lng - oldLng);

		oldLat = lat;
		oldLng = lng;
	}
	return encoded;
};

function encodeNumber(num) {
	var num = num << 1;
	if (num < 0) {
		num = ~(num);
	}
	var encoded = '';
	while (num >= 0x20) {
		encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
		num >>= 5;
	}
	encoded += String.fromCharCode(num + 63);
	return encoded;
};

/*
 *  Ausgabe Tools 
 */

function km_hervorheben(km, color) {
	var result = "";

	if (color)
		result += '<span class="distance" style="color:' + color + ';">' + km.toFixed(1) + ' km</span>';
	else
		result += '<span class="distance">' + km.toFixed(1) + ' km</span>';
	return result;
};

/*
 * Eine mapquest location vernünftig ausgeben
 */

function loc2txt(location) {
	
	result = "";
	
	if (location.street)
				result += location.street + " ";
			if (location.postalCode)
				result += location.postalCode + " ";
			if (location.adminArea6)
				result += location.adminArea6 + " ";
			if (location.adminArea5)
				result += "( " + location.adminArea5 + " ";
			else
				result += "(";
			if (location.adminArea4)
				result += ", " + location.adminArea4;
			if (location.adminArea3)
				result += ", " + location.adminArea3;
			if (location.adminArea1)
				result += ", " + location.adminArea1;
			result += ")";
			
			return result;
};
			

/*
 *	Ergebnisausgabe
 */

function showresult(text, punkt, ziel) {
	/*
	 * Ergebnis in die Seite einkleben
	 */

	/*
	 * Defaults Target ID / keine Koordinaten
	 */
	ziel = ziel || "result";
	punkt = punkt || false;

	var result = text;
	if (document.getElementById("show_coordinaten").checked && punkt && punkt[0] && punkt[1])
		result += " [" + punkt[1].toFixed(6) + " " + punkt[0].toFixed(6) + "]";

	if (result.length > 0) {
		var zonentext = document.getElementById(ziel);
		var listItem = document.createElement('li');
		listItem.innerHTML = result;
		zonentext.appendChild(listItem);
	};
};


/*
 * Mathematische Tools
 */

function swap(a) {
	return ([a[1], a[0]]);
};

/*
 * Checks whether a point is inside a polygon. Adapted from: [http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html] Created: 2008.03.14
 //+ Jonas Raoni Soares Silva
 //@ http://jsfromhell.com/math/is-point-in-poly [rev. #0]
 */

function isPointInPoly(poly, pt) {
	for (var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
		((poly[i][1] <= pt[1] && pt[1] < poly[j][1]) || (poly[j][1] <= pt[1] && pt[1] < poly[i][1])) && (pt[0] < (poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) && ( c = !c);
	return c;
};

function rand(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

function get_location_object(point) {
	var result, tmp, tmp_coordinaten;
	tmp = new ol.geom.Point(point.getCoordinates());
	tmp.transform("EPSG:3857", "EPSG:4326");
	tmp_coordinaten = tmp.getCoordinates();

	result = {
		latLng : {
			lat : tmp_coordinaten[1],
			lng : tmp_coordinaten[0]
		}
	};

	return result;
};

function coordinate_from_karte(a_karte) {;
	var tmp = new ol.geom.Point(a_karte);
	tmp.transform("EPSG:3857", "EPSG:4326");
	var result = tmp.getCoordinates();
	tmp = "";
	return result;
};