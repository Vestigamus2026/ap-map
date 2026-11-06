/**
 @author Sven Hering
 */

/*
 * Globales
 */

var my_key = "zg07Y2iPZdMCU198k6nUvFOof3O9K34U";
// "Fmjtd%7Cluu821u22g%2C8g%3Do5-94al14";
// Fmjtd%7Cluu8290bnh%2Cb5%3Do5-94751a

var akt_zone;

//suche nur einmal notwendig
/*
 *	Zonensuche
 */
function lookupZone(mypoint) {
	/*
	 * Teste ob der Punkt in einem der Polygone ist (beginne mit dem kleinsten!)
	 */
	var result = 0;
	var zone1, zone2, zone3;

	if (!zone3) {
		if (layer3.getSource().getFeatures()[0].getGeometry().getType() == "Polygon") {
			zone3 = [layer3.getSource().getFeatures()[0].getGeometry().getCoordinates()[0]];
		} else if (layer3.getSource().getFeatures()[0].getGeometry().getType() == "MultiPolygon") {
			var tmp = layer3.getSource().getFeatures()[0].getGeometry().getPolygons();
			zone3 = [];
			for (var i = 0, j = tmp.length; i < j; i++) {
				zone3.push(tmp[i].getCoordinates()[0]);
			};
		}
	}

	if (isPointInPoly(z1, mypoint)) {
		result = 1;
	} else {
		if (isPointInPoly(z2, mypoint)) {
			result = 2;
		} else {
			for (var i = 0, j = zone3.length; i < j; i++) {
				if (isPointInPoly(zone3[i], mypoint)) {
					result = 3;
				};
			};
		};
	};
	return result;
};

/*
 * Suche nach Postion
 */

function do_suche(doReverse) {

	/*
	 * Argument: doreserve .. soll genau (false) oder mit Näherung (true) gesucht werden?
	 */

	doReverse = ( typeof doReverse === 'undefined') ? true : doReverse;

	var location;

	layer5.setvisible = false;
	source5.clear();
	layer6.setvisible = false;
	source6.clear();
	layer5.setvisible = false;
	source5.clear();
	layer6.setvisible = false;

	$("#submitplace").text("Warten ... Adresse wird gesucht");
	$("#submitplace").attr('class', 'grayButton');
	$("#submitbab").text("Warten ... Adresse wird gesucht");
	$("#submitbab").attr('class', 'grayButton');

	location = document.getElementById("location").value;

	if (location != "") {
		/*
		 * Ort vorhanden
		 */

		/*
		 * Wir suchen gleich mal die kürzeste Strecke, spart einen Schritt gegenüber einer Adresssuche!
		 */

		var myoptions = {
			routeType : "SHORTEST",
			unit : "K",
			narrativeType : "none",
			locale : "de_DE",
			avoids : "Ferry,Limited Access",
			drivingStyle : "cautious",
			manmaps : false,
			destinationManeuverDisplay : false,
			enhancedNarrative : false,
			thumbMaps : false,
			maxResults : 1,
			countryBoundaryDisplay : false,
			doReverseGeocode : doReverse,
			shapeFormat : "raw",
			inShapeFormat : "raw",
			outShapeFormat : "raw",
			fullShape : "true",
			generalize : 0,
			boundingBox : {
				"ul" : {
					"lat" : prefered_extent[0][0],
					"lng" : prefered_extent[0][1]
				},
				"lr" : {
					"lat" : prefered_extent[1][0],
					"lng" : prefered_extent[1][1]
				}
			}
		};

		var mylocation, mysuccess;

		if (doReverse) {
			mylocation = [get_location_object(g_start), {
				street : location
			}];
			mysuccess = function(data, textStatus, jqXHR) {
				renderAdressResult(data, true);
			};
		} else {
			mylocation = [get_location_object(g_start), get_location_object(g_ziel)];
			mysuccess = function(data, textStatus, jqXHR) {
				renderAdressResult(data, false);
			};
		};

		$.ajax({
			url : "http://www.mapquestapi.com/directions/v2/route?key=" + my_key,
			dataType : 'json',
			cors: true,
//		        contentType:'application/json',
		        headers: {
		            'Access-Control-Allow-Origin': '*',
		        },
			crossDomain : true,
			type : 'POST',
			contentType : 'json',
			data : JSON.stringify({
				"locations" : mylocation,
				"options" : myoptions
			}),
			success : mysuccess,
			error : function(data, textStatus, jqXHR) {
				showresult('error occurred - ' + data + "/" + textStatus + "/" + jqXHR);
			}
		});
	} else {
		/*
		 * Leerer Ort
		 */
		showresult("Bitte Ort prüfen!");
		reaktiviere_suche();
	};
}

var renderAdressResult = function(data, doReverse) {
	/*
	 * Rückgabe der Ortssuche auswerten
	 */
	var lat, lng, tmp, layers, lastlayer, quality, qualityText, adminArea1;

	/*
	 * Fehlerbehandlung falls Ergebnis offensichtlich falsch
	 */
	if ((data.info.statuscode != 0) || data.route.locations[1].adminArea1 == "US" || data.route.locations[1].geocodeQuality == "COUNTRY") {
		showresult("Bitte Ort prüfen!");
		g_ziel.setCoordinates([]);
		reaktiviere_suche();
	} else {

		/*
		 * Okay : ein Ort wurde gefunden
		 */
		akt_adress = data.route.locations[1];

		lat = data.route.locations[1].latLng.lat;
		lng = data.route.locations[1].latLng.lng;

		akt_coordinates = [lng, lat];
		// dopplung, notwenig wegen GPS (liefert Koodinaten direkt)

		tmp = new ol.geom.Point([lng, lat]);
		tmp.transform("EPSG:4326", "EPSG:3857");
		akt_coordinates_karte = tmp.getCoordinates();

		// document.getElementById("result").innerHTML = "lat:" + lat + " lng:" + lng;
		g_ziel.setCoordinates(akt_coordinates_karte);

		// Kartenzoom optimieren

		tmp = new ol.geom.LineString([akt_coordinates_karte, g_start.getCoordinates()]);
		size = [document.documentElement.clientWidth, document.documentElement.clientHeight - offset];
		view.fitGeometry(tmp, size, {
			padding : [50, 50, 50, 50],
			constrainResolution : false
		});
		if (view.getResolution() < default_resolution) {
			view.setResolution(default_resolution);
		};

		layer_ziel.setVisible(true);

		/*
		 * Ermittle die Zone und zeige sie hübsch an.
		 */
		var result = "Diese Position befindet sich ";
		akt_zone = lookupZone(akt_coordinates_karte);
		if (akt_zone > 0) {
			result += "in Zone " + akt_zone + ".";
		} else {
			result += "außerhalb aller Zonen.";
		};

		showresult(result, akt_coordinates);

		/*
		 * Anzeigen der Details auf Verlangen (checkbox)
		 */

		if (document.getElementById("details").checked) {

			quality = data.route.locations[1].geocodeQualityCode;
			qualityText = data.route.locations[1].geocodeQuality;

			var txt = loc2txt(data.route.locations[1]);

			showresult(txt + " Ergebnisqualität:" + quality + " (" + qualityText + "),", akt_coordinates);

			if (akt_adress == "") {
				akt_adress = data.route.locations[1];
			}

		};

		/*
		 * Suche nach nächster One-Way-Straße (Autobahnen)
		 */

		if (doReverse && document.getElementById("show_bab").checked) {

			var one_way_point_karte = g_bab.getClosestPoint(akt_coordinates_karte);
			var one_way_point = coordinate_from_karte(one_way_point_karte);

			var one_way_point_dist = 1000 * berechneEntfernung_karte(one_way_point_karte, akt_coordinates_karte);

			// showresult(" Abstand zum nächsten One-Way-Point: " + one_way_point_dist + " m", one_way_point);

			if (one_way_point_dist < 100) {
				/*
				 * Scheinbar liegen wir auf / neben der Autobahn
				 */

				/*
				 * Zerlegen des Netzes in Einzelheiten
				 */
				var strecken = g_bab.getLineStrings();
				var testcoor, entf, linebegin, lineend;

				for (var i = 0, j = strecken.length; i < j; i++) {
					testcoor = strecken[i].getClosestPoint(one_way_point_karte);
					entf = berechneEntfernung_simple(testcoor, one_way_point_karte);
					if (entf < 0.1) {
						/*
						 * Welch zufall
						 */
						linebegin = strecken[i].getFirstCoordinate();
						lineend = strecken[i].getLastCoordinate();
						i = j;
						//abbruch
					}
				};
				if (linebegin) {
					tmp = new ol.geom.Point(linebegin);
					tmp.transform("EPSG:3857", "EPSG:4326");
					linebegin = tmp.getCoordinates();
					tmp = new ol.geom.Point(lineend);
					tmp.transform("EPSG:3857", "EPSG:4326");
					lineend = tmp.getCoordinates();

					linebegin = [1 * linebegin[0].toFixed(6), 1 * linebegin[1].toFixed(6)];
					lineend = [1 * lineend[0].toFixed(6), 1 * lineend[1].toFixed(6)];

					//showresult("Verdächtige Strecke fängt an bei:", linebegin);
					//showresult("Verdächtige Strecke hört auf bei:", lineend);

					for (var i = 0, j = BABShapes.length; i < j; i++) {

						/*
						 * Nachsehen ob die Strecke auch da aufhört und anfängt wo wir glauben
						 */
						if ((berechneEntfernung_simple(linebegin, BABShapes[i][2][0]) < 0.1) && (berechneEntfernung_simple(lineend, BABShapes[i][2][BABShapes[i][2].length - 1]) < 0.1)) {

							// showresult("Verdächtige Strecke ist die:" + BABShapes[i][0], BABShapes[i][2][0]);

							autobahnnr = BABShapes[i][0].split("_")[0];

							/*
							 * Optionen neu kleben
							 */

							fill_routen(BABShapes[i][4], BABShapes[i][0]);

							var tmp = BABShapes[i][2];

							// Umwandeln in Array und sortieren

							var akt_bab = [];
							if (BABShapes[i][1]) {
								for (var i1 = 0, j1 = tmp.length; i1 < j1; i1++) {
									akt_bab.push(tmp[i1]);
								};
							} else {
								for (var i1 = tmp.length - 1; i1 >= 0; i1--) {
									akt_bab.push(tmp[i1]);
								};
							}

							var wegstrecke = BABShapes[i][3];
							var old_delta = berechneEntfernung(akt_bab[0], one_way_point);
							var akt_delta;

							for (var i1 = 0; (i1 < (akt_bab.length - 1)); i1++) {
								akt_delta = berechneEntfernung(akt_bab[i1], one_way_point);

								/*
								 * Debugbereich
								 if (wegstrecke > 100 && wegstrecke < 110) {
								 alert(wegstrecke+" "+old_delta+" "+akt_delta);
								 }
								 */

								if (old_delta < 2 && akt_delta > old_delta) {
									// wir entfernen uns also wieder... also zurückrudern :)
									i1 = akt_bab.length;
									wegstrecke -= akt_delta;
								} else {
									wegstrecke += berechneEntfernung(akt_bab[i1], akt_bab[i1 + 1]);
									old_delta = akt_delta;
								}

							};

							document.getElementById("km").value = Math.floor(wegstrecke * 10 + 0.5) / 10;

							showresult('<span style="color: Blue">Punkt auf der Autobahn ' + autobahnnr + '! Kilometer und Autobahn eingetragen.</span>', akt_coordinates);

							i = j;
						}
					}
				}
			}

		};

		/*
		 * Luftlinienabstand zu Zone 3 (auf Verlangen)
		 */

		if (document.getElementById("closest").checked && akt_zone == 0) {

			var tmp = layer3.getSource().getFeatures()[0].getGeometry();

			var closest_karte = tmp.getClosestPoint(g_ziel.getCoordinates());
			var distance = berechneEntfernung_karte(closest_karte, akt_coordinates_karte);
			showresult('Entfernung zu Zone 3<ul id="showdirect" style="color: black; background-color: lightgray"><li>Luftlinie ' + km_hervorheben(distance) + "</li></ul>", false);
			closest = coordinate_from_karte(closest_karte);
			showresult('', closest, "showdirect");

			/*
			 * Rückwärtsauflösung nur nötig wenn Endpunkte anzuzeigen sind, die Entfernung wissen wir ja schon (indirekt)
			 */

			if (document.getElementById("show_endpoints").checked) {

				$.ajax({
					url : "http://open.mapquestapi.com/geocoding/v1/reverse?key=" + my_key,
					dataType : 'json',
					type : 'POST',
					contentType : 'json',
					data : JSON.stringify({
						"location" : {
							"latLng" : {
								"lat" : closest[1],
								"lng" : closest[0]
							}
						},
						options : {
							thumbMaps : false,
							boundingBox : {
								"ul" : {
									"lat" : prefered_extent[0][0],
									"lng" : prefered_extent[0][1]
								},
								"lr" : {
									"lat" : prefered_extent[1][0],
									"lng" : prefered_extent[1][1]
								}
							}
						}
					}),
					success : function(data) {
						renderEndClosest(data);
					},
					error : function(data) {
						showresult('error occurred - ' + data);
					}
				});

			}
		};
		/*
		 * Kürzeste Strecke auswerten
		 */
		if (document.getElementById("shortest").checked) {
			if (data.route.distance) {

				var wegstrecke, wegpunkte, tmp, aktpunkt, aktpunkt1, lastpunkt, aktzone;
				wegpunkte = data.route.shape.shapePoints;

				var aktroute = [];

				for (var i = 0; i < wegpunkte.length; i += 2) {
					aktroute.push([wegpunkte[i + 1], wegpunkte[i]]);
				};

				g5.setCoordinates(aktroute);
				g5.transform("EPSG:4326", "EPSG:3857");

				/*
				 * Route malen
				 */

				if (document.getElementById("route_shortest").checked) {

					source5.addFeature(new ol.Feature(g5, attr5));
					//layer5.setSource(source5);
					layer5.setvisible = true;
				}

				/*
				 * Geben wir das aus was wir wissen...
				 */
				showresult('Kürzeste Verbindung:</span><ul id="showshortest" style="color: black; background-color:' + style5.getStroke().getColor() + '"><li>' + km_hervorheben(data.route.distance) + '</li></ul>', false);

				if (document.getElementById("show_times").checked)
					showresult("Fahrzeit " + data.route.formattedTime + " h", false, "showshortest");

				/*
				 * Soll die Außenstrecke behandelt werden?
				 */

				if (document.getElementById("overhead_shortest").checked && akt_zone == 0) {
					/*
					 * Init es gibt noch keinen letzten Punkt :)
					 */
					var aktroute_transformed = g5.getCoordinates();
					//brauchen wir gleich zum Testen der Zonen
					/*
					 * Wir testen vom Ziel an...
					 */
					aktroute.reverse();
					aktroute_transformed.reverse();

					lastpunkt = aktroute[0];
					wegstrecke = 0;
					/*
					 * Jetzt gehen wir alle Punkte durch....
					 */
					var length = aktroute.length;
					for (var i = 0; i < length; i++) {

						aktpunkt = aktroute[i];

						aktzone = lookupZone(aktroute_transformed[i]);
						if (aktzone == 0) {// aha! wir sind noch draussen also weitersuchen
							wegstrecke += berechneEntfernung(aktpunkt, lastpunkt);
							lastpunkt = aktpunkt;
						} else
							i = aktroute.length;
						/*
						 * hier evtl. Feinberechnung (closestPoint Z3 addieren entfernung zum letzen Punkt)
						 */
					};

					showresult(" davon außerhalb Zone 3: " + km_hervorheben(wegstrecke), false, "showshortest");
					showresult('', aktpunkt, "showshortest");

					/*
					 * Reverse Lookup für den letzten Punkt in einer Zone nur bei Bedarf! und dann holen wir gleich die Route wegen der Fahrzeit
					 */

					if ((document.getElementById("show_endpoints").checked)) {

						$.ajax({
							url : "http://open.mapquestapi.com/directions/v2/route?key=" + my_key,
							dataType : 'json',
							type : 'POST',
							contentType : 'json',
							data : JSON.stringify({
								locations : [{
									"latLng" : {
										"lat" : lastpunkt[1],
										"lng" : lastpunkt[0]
									}
								}, {
									latLng : {
										"lat" : akt_coordinates[1],
										"lng" : akt_coordinates[0]
									}
								}],
								options : {
									routeType : "SHORTEST",
									unit : "K",
									narrativeType : "none",
									locale : "de_DE",
									avoids : "Ferry,Limited Access",
									drivingStyle : "cautious",
									manmaps : false,
									destinationManeuverDisplay : false,
									enhancedNarrative : false,
									thumbMaps : false,
									maxResults : 1,
									countryBoundaryDisplay : false,
									doReverseGeocode : true,
									shapeFormat : "simple"
								}
							}),
							success : function(data) {
								renderEndZoneShortest(data);
							},
							error : function(data) {
								showresult('error occurred - ' + data);
							}
						});
					} ;
				};
			};
		};
		/*
		 * Test der schnellsten Verbindung nur falls angeklickt
		 */
		if (document.getElementById("fastest").checked) {
			$.ajax({
				url : "http://open.mapquestapi.com/directions/v2/route?key=" + my_key,
				dataType : 'json',
				type : 'POST',
				contentType : 'json',
				data : JSON.stringify({
					locations : [get_location_object(g_start), get_location_object(g_ziel)],
					options : {
						routeType : "FASTEST",
						unit : "K",
						narrativeType : "none",
						locale : "de_DE",
						avoids : "Ferry,Limited Access",
						drivingStyle : "cautious",
						manmaps : false,
						destinationManeuverDisplay : false,
						enhancedNarrative : false,
						thumbMaps : false,
						maxResults : 1,
						countryBoundaryDisplay : false,
						doReverseGeocode : doReverse,
						shapeFormat : "raw",
						inShapeFormat : "raw",
						outShapeFormat : "raw",
						fullShape : "true",
						generalize : 0
					}
				}),
				success : function(data) {
					render_fastest(data);
				},
				error : function(data) {
					showresult('error occurred - ' + data);
				}
			});
		} else {
			reaktiviere_suche();
		}
	};
};

function renderEndClosest(data) {
	/*
	 * Ausstiegspunkt Zone 3 Luftlinie
	 */
	if (data.info.statuscode && (response.info.statuscode != 0)) {
		var text = "Whoops!  There was an error during the request:\n";
		if (data.info.messages) {
			for ( i = 0; i < data.info.messages.length; i++) {
				text += data.info.messages[i] + "\n";
			}
		}
		alert(text);
		reaktiviere_suche();
		return;
	};

	showresult(loc2txt(data.results[0].locations[0]), false, "showdirect");
};

function renderEndZoneShortest(data) {
	/*
	 * Ausstiegspunkt Zone 3 auf der kürzesten Route
	 */

	if (data.info.statuscode && (response.info.statuscode != 0)) {
		var text = "Whoops!  There was an error during the request:\n";
		if (data.info.messages) {
			for ( i = 0; i < data.info.messages.length; i++) {
				text += data.info.messages[i] + "\n";
			}
		}
		alert(text);
		reaktiviere_suche();
		return;
	};

	var tmp = loc2txt(data.route.locations[0]);

	showresult(tmp, false, "showshortest");

	/*
	 * Reststrecke außerhalb Zone 3 auswerten für Fahrzeiten!
	 */
	if (data.route.distance) {
		if (document.getElementById("show_times").checked) {
			tmp = " Fahrzeit von dort noch " + data.route.formattedTime + " h";
			showresult(tmp, false, "showshortest");
		};
	};
};

function renderEndZoneFastest(data) {
	/*
	 * Ausstiegspunkt Zone 3 auf der kürzesten Route
	 */

	if (data.info.statuscode && (response.info.statuscode != 0)) {
		var text = "Whoops!  There was an error during the request:\n";
		if (data.info.messages) {
			for ( i = 0; i < data.info.messages.length; i++) {
				text += data.info.messages[i] + "\n";
			}
		}
		alert(text);
		reaktiviere_suche();
		return;
	};

	var tmp = loc2txt(data.route.locations[0]);

	showresult(tmp, false, "showfastest");

	/*
	 * Reststrecke außerhalb Zone 3 auswerten für Fahrzeiten!
	 */
	if (data.route.distance) {
		if (document.getElementById("show_times").checked) {
			tmp = " Fahrzeit von dort noch " + data.route.formattedTime + " h";
			showresult(tmp, false, "showfastest");
		};
	};
	reaktiviere_suche();
};

function render_fastest(data) {
	/*
	 * Schnellste Strecke auswerten
	 */
	if (data.route.distance) {

		var wegstrecke, wegpunkte, tmp, aktpunkt, aktpunkt1, lastpunkt, aktzone;
		wegpunkte = data.route.shape.shapePoints;

		var aktroute = [];

		for (var i = 0; i < wegpunkte.length; i += 2) {
			aktroute.push([wegpunkte[i + 1], wegpunkte[i]]);
		};

		g6.setCoordinates(aktroute);
		g6.transform("EPSG:4326", "EPSG:3857");

		/*
		 * Route malen
		 */

		if (document.getElementById("route_fastest").checked) {

			source6.addFeature(new ol.Feature(g6, attr6));
			//layer5.setSource(source6);
			layer6.setvisible = true;
		}

		/*
		 * Geben wir das aus was wir wissen...
		 */
		showresult('Schnellste Verbindung:</span><ul id="showfastest" style="color: black; background-color:' + style6.getStroke().getColor() + '"><li>' + km_hervorheben(data.route.distance) + '</li></ul>', false);
		if (document.getElementById("show_times").checked)
			showresult("Fahrzeit " + data.route.formattedTime + " h", false, "showfastest");

		/*
		 * Soll die Außenstrecke behandelt werden?
		 */

		if (document.getElementById("overhead_fastest").checked && akt_zone == 0) {
			/*
			 * Init es gibt noch keinen letzten Punkt :)
			 */
			var aktroute_transformed = g6.getCoordinates();
			//brauchen wir gleich zum Testen der Zonen
			/*
			 * Wir testen vom Ziel an...
			 */
			aktroute.reverse();
			aktroute_transformed.reverse();

			lastpunkt = aktroute[0];
			wegstrecke = 0;
			/*
			 * Jetzt gehen wir alle Punkte durch....
			 */
			var length = aktroute.length;
			for (var i = 0; i < length; i++) {

				aktpunkt = aktroute[i];

				aktzone = lookupZone(aktroute_transformed[i]);
				if (aktzone == 0) {// aha! wir sind noch draussen also weitersuchen
					wegstrecke += berechneEntfernung(aktpunkt, lastpunkt);
					lastpunkt = aktpunkt;
				} else
					i = aktroute.length;
				/*
				 * hier evtl. Feinberechnung (closestPoint Z3 addieren entfernung zum letzen Punkt)
				 */
			};

			showresult(" davon außerhalb Zone 3: " + km_hervorheben(wegstrecke), false, "showfastest");
			showresult('', aktpunkt, "showfastest");

			/*
			 * Reverse Lookup für den letzten Punkt in einer Zone nur bei Bedarf! und dann holen wir gleich die Route wegen der Fahrzeit
			 */

			if ((document.getElementById("show_endpoints").checked)) {

				$.ajax({
					url : "http://open.mapquestapi.com/directions/v2/route?key=" + my_key,
					dataType : 'json',
					type : 'POST',
					contentType : 'json',
					data : JSON.stringify({
						locations : [{
							"latLng" : {
								"lat" : lastpunkt[1],
								"lng" : lastpunkt[0]
							}
						}, {
							latLng : {
								lat : akt_coordinates[1],
								lng : akt_coordinates[0]
							}
						}],
						options : {
							routeType : "FASTEST",
							unit : "K",
							narrativeType : "none",
							locale : "de_DE",
							avoids : "Ferry,Limited Access",
							drivingStyle : "cautious",
							manmaps : false,
							destinationManeuverDisplay : false,
							enhancedNarrative : false,
							thumbMaps : false,
							maxResults : 1,
							countryBoundaryDisplay : false,
							doReverseGeocode : true,
							shapeFormat : "simple"
						}
					}),
					success : function(data) {
						renderEndZoneFastest(data);
					},
					error : function(data) {
						showresult('error occurred - ' + data);
					}
				});
			} else {
				reaktiviere_suche();
			} ;
		} else {
			reaktiviere_suche();
		};
	} else {
		showresult("Keine Daten erhalten :(");
	};
}

/*
 * Alles wieder erlauben
 */

function reaktiviere_suche() {
	$("#submitplace").text("Absenden");
	$("#submitplace").attr('class', 'blueButton');
	$("#submitbab").text("Diesen Kilometer suchen");
	$("#submitbab").attr('class', 'blueButton');
};

$(function() {

	/*
	 *	Suchbutton angeklickt
	 */

	$("#submitplace").click(function(e) {
		e.preventDefault();
		var x = this.className;
		if (x.indexOf("blueButton") >= 0) {
			var resulttext = document.getElementById("result");
			resulttext.innerHTML = "";
			document.getElementById("km").value = "";
			do_suche(true);
		}
		return false;
	});
});
