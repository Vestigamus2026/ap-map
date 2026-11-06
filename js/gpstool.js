$(function() {

	var geolocation = new ol.Geolocation({
		// take the projection to use from the map's view
		projection : view.getProjection(),
		tracking : false
	});

	$("#gps_reset").click(function(e) {

		e.preventDefault();

		// Stop position tracking
		geolocation.setTracking(false);

		$("#gps_setpos").show();
		$("#gps_getpos").show();
		$("#gps_follow").show();

		$("#gps_follow0").hide();
		$("#gps_cancel").hide();

		document.getElementById("gpsinfo").innerHTML = "";

		showresult("Werte zurückgesetzt", false, "gpsinfo");
		source_start.clear();
		g_start.setCoordinates(z_start);
		source_start.addFeature(new ol.Feature(g_start, attr_start));
		//layer_start.setSource(source5);
		layer_start.setVisible(true);

		/*
		 *
		 var x3 = "lat,lng<br />";
		 var x = layer3.getSource().getFeatures()[0].getGeometry();
		 x.transform("EPSG:3857", "EPSG:4326");
		 var x1 = x.getCoordinates()[0];
		 x.transform("EPSG:4326", "EPSG:3857");

		 var x2 = [];
		 for (var i = 0, j = x1.length; i < j; i++) {
		 x2.push(x1[i][1]);
		 x2.push(x1[i][0]);
		 x3 += x1[i][1].toFixed(6) + "," + x1[i][0].toFixed(6) + "<br />";
		 };

		 // var x3 = compress(x2,6);
		 showresult(x3, false, "gpsinfo");

		 x = layer2.getSource().getFeatures()[0].getGeometry();
		 x.transform("EPSG:3857", "EPSG:4326");
		 var x1 = x.getCoordinates();
		 var x2 = [];
		 for (var i = 0, j = x1.length; i < j; i++) {
		 x2.push(x1[i][1]);
		 x2.push(x1[i][0]);
		 };
		 var x3 = compress(x2, 6);
		 showresult(x3, false, "gpsinfo");
		 */
	});

	$("#gps_cancel").click(function(e) {

		e.preventDefault();

		// Stop position tracking
		geolocation.setTracking(false);

		$("#gps_setpos").show();
		$("#gps_getpos").show();
		$("#gps_follow").show();

		$("#gps_follow0").hide();
		$("#gps_cancel").hide();

		showresult("Tracking beendet", false, "gpsinfo");
	});

	$("#gps_getpos").click(function(e) {

		e.preventDefault();

		$("#gps_getpos").hide();
		$("#gps_setpos").hide();
		$("#gps_follow").hide();
		$("#gps_follow0").hide();
		$("#gps_cancel").show();

		geolocation.once('change', function(evt) {

			var mypos = (geolocation.getPosition());

			// Stop position tracking
			geolocation.setTracking(false);

			view.setCenter(mypos);
			g_ziel.setCoordinates(mypos);

			// Zwischenspeicher löschen Adresse muss ja neu ermitelt werden

			akt_adress = "";

			var zonentext = document.getElementById("result");
			zonentext.innerHTML = "";

			/*
			 * Position des GPS ermitteln
			 */

			akt_coordinates_karte = mypos;
			akt_coordinates = coordinate_from_karte(mypos);

			/*
			 * Anzeigen in Adresseingabefeld
			 */

			var position = document.getElementById("location");
			position.value = akt_coordinates[1].toFixed(6) + " " + akt_coordinates[0].toFixed(6);

			$("#gps_setpos").show();
			$("#gps_getpos").show();
			$("#gps_follow").show();

			$("#gps_follow0").hide();
			$("#gps_cancel").hide();

			showresult("Ziel-Position gesetzt", mypos, "gpsinfo");
			do_suche(false);
		});

		// Start position tracking
		geolocation.setTracking(true);
	});

	$("#gps_setpos").click(function(e) {

		e.preventDefault();

		$("#gps_getpos").hide();
		$("#gps_setpos").hide();
		$("#gps_follow").hide();
		$("#gps_follow0").hide();

		$("#gps_cancel").show();

		geolocation.once('change', function(evt) {

			var mypos = (geolocation.getPosition());

			/*
			 * Funktion 2 -> GPS Position wird neue Startadresse
			 */

			geolocation.setTracking(false);

			/*
			 * Mal mal den Start hier
			 */

			source_start.clear();
			g_start.setCoordinates(mypos);
			source_start.addFeature(new ol.Feature(g_start, attr_start));
			//layer_start.setSource(source5);
			layer_start.setVisible(true);

			$("#gps_setpos").show();
			$("#gps_getpos").show();
			$("#gps_follow").show();

			$("#gps_follow0").hide();
			$("#gps_cancel").hide();

			showresult("Start-Position gesetzt", coordinate_from_karte(mypos), "gpsinfo");
			do_suche(false);
		});

		// Start position tracking
		geolocation.setTracking(true);
	});

	$("#gps_follow").click(function(e) {

		e.preventDefault();

		$("#gps_getpos").hide();
		$("#gps_setpos").hide();
		$("#gps_follow").hide();
		$("#gps_follow0").show();
		$("#gps_cancel").show();

		geolocation.on('change', function(evt) {

			var mypos = (geolocation.getPosition());

			/*
			* Funktion 3 -> GPS Position wird nachgeführt
			*/

			/*
			* TEST
			*/
			//mypos = z1[rand(0, z1.length - 1)];

			/*
			 * Mal mal den truck hier
			 */
			source8.clear();
			g8.setCoordinates(mypos);
			source8.addFeature(new ol.Feature(g8, attr8));
			layer8.setVisible(true);
			// view.setCenter(mypos);
			// view.setZoom(19);
		});

		// Start position tracking
		geolocation.setTracking(true);

		showresult("Tracking angeschalten", false, "gpsinfo");
	});
});
