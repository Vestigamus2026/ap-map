var BABShapes = [];

function Right(str, n) {
	if (n <= 0)
		return "";
	else if (n > String(str).length)
		return str;
	else {
		var iLen = String(str).length;
		return String(str).substring(iLen, iLen - n);
	}
};

function fill_routen(aktbab, aktbab_sub) {

	var result = [];

	/*
	 * Löschen der Auswahlen
	 */
	var autobahnauswahl = document.getElementById("bab");
	autobahnauswahl.innerHTML = "";
	autobahnauswahl = document.getElementById("bab_sub");
	autobahnauswahl.innerHTML = "";

	var g_bab_data = [];
	// für MultiLineString

	for (var key in BABMAP) {
		var name = key;
		var sort = BABMAP[key].asc;
		var desc = BABMAP[key].name;
		var offs = 1 * BABMAP[key].offset;
		var babname = 1 * BABMAP[key].bab;
		var tmp = decompress(BABMAP[key].shape, 6);
		var length = tmp.length;
		var index = 0;
		var aktroute = [];
		while (index < length) {
			aktroute.push([tmp[index + 1], tmp[index]]);
			index += 2;
		};
		result.push([name, sort, aktroute, offs, babname]);

		g_bab_data.push(aktroute);
	}

	/*
	 * Optionen ankleben
	 */

	$("#bab").empty();

	var babs = [];
	var babs_descriptions = [];

	for (var key in BABMAP) {
		babs_descriptions.push([key, BABMAP[key].name, BABMAP[key].bab]);
		if (babs.indexOf(1 * BABMAP[key].bab) == -1)
			babs.push(1 * BABMAP[key].bab);
	};

	var tmp = babs.sort(function(a, b) {
		return a - b;
	});
	babs = tmp;

	// falls keine Vorgabe

	aktbab = aktbab || babs[0];

	for (var i = 0, j = babs.length; i < j; i++) {
		if (babs[i] == aktbab) {
			$('#bab').append($('<option />').val(babs[i]).html("Bundesautobahn " + babs[i]).attr("selected", "selected"));
		} else {
			$('#bab').append($('<option />').val(babs[i]).html("Bundesautobahn " + babs[i]));
		};
	};

	for (var i = 0, j = babs_descriptions.length; i < j; i++) {
		if (babs_descriptions[i][2] == aktbab) {
			if (babs_descriptions[i][0] == aktbab_sub) {
				$('#bab_sub').append($('<option />').val(babs_descriptions[i][0]).html(babs_descriptions[i][1]).attr('class', babs_descriptions[i][2]).attr("selected", "selected"));
			} else {
				$('#bab_sub').append($('<option />').val(babs_descriptions[i][0]).html(babs_descriptions[i][1]).attr('class', babs_descriptions[i][2]));
			}
		}
	};

	g_bab.setCoordinates(g_bab_data);
	g_bab.transform("EPSG:4326", "EPSG:3857");
	source_bab.clear();
	source_bab.addFeature(new ol.Feature(g_bab, attr_bab));
	layer_bab.setvisible = true;

	return result;
};

$(function() {

	if (BABShapes.length < 1) {
		BABShapes = fill_routen();
	};

	$("#bab").change(function() {
		//alert(this.value);
		fill_routen(this.value);
	});

	$("#submitbab").click(function(e) {

		e.preventDefault();
		var x = this.className;
		if (x.indexOf("blueButton") >= 0) {
			var resulttext = document.getElementById("result");
			resulttext.innerHTML = "";
			document.getElementById("location").value = "";

			$("#submitplace").attr('class', 'redButton');
			$("#submitbab").value = "km wird ermittelt";
			$("#submitbab").attr('class', 'redButton');

			var zonentext = document.getElementById("result");
			zonentext.innerHTML = "";

			layer5.setvisible = false;
			source5.clear();
			layer6.setvisible = false;
			source6.clear();
			layer5.setvisible = false;
			source5.clear();
			layer6.setvisible = false;

			var babname = document.getElementById("bab_sub").value;

			var index = 0;
			var length = BABShapes.length;

			while (index < length && BABShapes[index][0] != babname) {
				index++;
			};

			if (BABShapes[index][0] == babname) {
				// shape liegt vor
				/*
				 * Richtung auswerten
				 */
				var akt_bab = [];
				var akt_route = [];

				if (!BABShapes[index][1]) {
					for (var counter = BABShapes[index][2].length - 1; counter >= 0; counter--) {
						akt_bab.push(BABShapes[index][2][counter]);
					};
				} else {
					akt_bab = BABShapes[index][2];
				};
				/*
				 * Autobahn malen

				 g99.setCoordinates(akt_bab);
				 g99.transform("EPSG:4326", "EPSG:3857");
				 source99.addFeature(new ol.Feature(g99, attr99));
				 layer99.setvisible = true;
				 */

				tmp = document.getElementById("km").value.replace(",", ".");

				var km = 1 * tmp;

				var wegstrecke = BABShapes[index][3];

				if (km || (km >= wegstrecke )) {

					for (var i = 0; (i < (akt_bab.length - 1) && wegstrecke < km); i++) {
						wegstrecke += berechneEntfernung(akt_bab[i], akt_bab[i + 1]);
					};

				};

				if (!km || (km <= BABShapes[index][3] ) || (i == (akt_bab.length - 1) && wegstrecke < km)) {

					showresult("kein passender Autobahnkilometer gefunden!");
					reaktiviere_suche();

				} else {

					var t = km;
					var t0 = wegstrecke - berechneEntfernung(akt_bab[i], akt_bab[i - 1]);
					var t1 = wegstrecke;
					var p0 = {
						x : akt_bab[i-1][1],
						y : akt_bab[i-1][0]
					};
					var p1 = {
						x : akt_bab[i][1],
						y : akt_bab[i][0]
					};
					var p = {
						x : 0,
						y : 0
					};

					dt = (t - t0) / (t1 - t0);
					// fraction of time elapsed between t0 & t1
					p.x = p0.x + (dt * (p1.x - p0.x) );
					// the point's x is that same fraction between x0 and x1
					p.y = p0.y + (dt * (p1.y - p0.y) );
					// ditto, y.

					/*
					 *

					 var p = {
					 x : akt_bab[i][1],
					 y : akt_bab[i][0]
					 };
					 */
					var pos = document.getElementById("location");
					pos.value = p.x.toFixed(6) + " " + p.y.toFixed(6);
					showresult("Autobahnkilometer " + km + " gefunden und in das Zielfeld eingetragen!", [p.x, p.y]);

					tmp = new ol.geom.Point([p.y, p.x]);
					tmp.transform("EPSG:4326", "EPSG:3857");

					akt_coordinates = [p.y, p.x];

					g_ziel.setCoordinates(tmp.getCoordinates());
					do_suche(false);
				}
			} else {
				reaktiviere_suche();
			};
		}
		return false;
	});
});