/**
 @author Sven Hering
 */

var offset = 44;
// Höhe Toolbar
var default_resolution;
// errechnet

var source5, source6, source_start, g_start;

g1 = new ol.geom.Polygon([z1]);
g1.transform("EPSG:4326", "EPSG:3857");
g2 = new ol.geom.Polygon([z2, z1]);
g2.transform("EPSG:4326", "EPSG:3857");
g3 = new ol.geom.Polygon([z3, z2]);
g3.transform("EPSG:4326", "EPSG:3857");
g_ziel = new ol.geom.Point([]);
g5 = new ol.geom.LineString([]);
g6 = new ol.geom.LineString([]);

g_start = new ol.geom.Point(z_start);
g_start.transform("EPSG:4326", "EPSG:3857");

g8 = new ol.geom.Point([]);

z1 = g1.getCoordinates()[0];
z2 = g2.getCoordinates()[0];
z3 = g3.getCoordinates()[0];
z_start = g_start.getCoordinates();

// z1[rand(0,z1.length-1)] als Test

g99 = new ol.geom.LineString([]);
g_bab = new ol.geom.MultiLineString([]);

var extent_of_g3 = g3.getExtent();
var center_of_g3 = [(extent_of_g3[0] + extent_of_g3[2]) / 2, (extent_of_g3[1] + extent_of_g3[3]) / 2];

style4 = new ol.style.Style({
	image : new ol.style.Icon({
		anchor : [0.333, 0.95],
		anchorXUnits : "fraction",
		anchorYUnits : "fraction",
		src : "img/finish_flag.png"
	}),
	zIndex : 100000
});
style5 = new ol.style.Style({
	stroke : new ol.style.Stroke({
		color : 'rgba(55, 158, 86, 0.6)',
		width : 12
	}),
	zIndex : 101
});
style6 = new ol.style.Style({
	stroke : new ol.style.Stroke({
		color : 'rgba(237, 26, 26, 0.6)',
		width : 12
	}),
	zIndex : 100
});
style_start = new ol.style.Style({
	image : new ol.style.Icon({
		anchor : [8, 1.0],
		anchorXUnits : "pixel",
		anchorYUnits : "fraction",
		src : "img/marker_start.png"
	}),
	zIndex : 100
});
style8 = new ol.style.Style({
	image : new ol.style.Icon({
		anchor : [14, 1.0],
		anchorXUnits : "pixel",
		anchorYUnits : "fraction",
		src : "img/marker_pos.png"
	}),
	zIndex : 100
});
style99 = new ol.style.Style({
	stroke : new ol.style.Stroke({
		color : 'rgba(0, 0, 128, 0.5)',
		width : 12
	}),
	zIndex : 10
});

style_bab = new ol.style.Style({
	stroke : new ol.style.Stroke({
		color : 'rgba(255, 128, 128, 0.2)',
		width : 6
	}),
	zIndex : 10
});

attr1 = {
	name : "Gebiet 1"
};
attr2 = {
	name : "Gebiet 2"
};
attr3 = {
	name : "Gebiet 3"
};
attr4 = {
	name : "Zielpunkt"
};
attr5 = {
	name : "kurze Route"
};
attr6 = {
	name : "schnellste Route"
};
attr_start = {
	name : "Startpunkt"
};
attr8 = {
	name : "GPS-Punkt"
};
attr99 = {
	name : "Autobahn"
};
attr_bab = {
	name : "Netz erfasster Autobahnen"
};

feat1 = new ol.Feature(g1, attr1);
feat2 = new ol.Feature(g2, attr2);
feat3 = new ol.Feature(g3, attr3);
f_ziel = new ol.Feature(g_ziel, attr4);
feat5 = new ol.Feature(g5, attr5);
feat6 = new ol.Feature(g6, attr6);
feat_start = new ol.Feature(g_start, attr_start);
feat8 = new ol.Feature(g8, attr8);
feat99 = new ol.Feature(g99, attr99);
feat_bab = new ol.Feature(g_bab, attr99);

/*
 *
 OSM Roads: http://korona.geog.uni-heidelberg.de:8001/tms_r.ashx?x=${x}&y=${y}&z=${z}
 Mapnik (de): http://{switch:a,b,c,d}.tile.openstreetmap.de/tiles/osmde/${z}/${x}/${y}.png

 baselayer = new ol.layer.Tile({
 source: new ol.source.Stamen({
 layer: 'toner'
 })
 });

 baselayer = new ol.layer.Tile({
 source : new ol.source.XYZ({
 attributions : [new ol.Attribution({
 html : "Uni Heidelberg"
 })],
 url : "http://korona.geog.uni-heidelberg.de:8001/tms_r.ashx?x={x}&y={y}&z={z}"
 })
 });
 baselayer = new ol.layer.Tile({
 source : new ol.source.XYZ({
 attributions : [new ol.Attribution({
 html : "OpenStreetmap"
 })],
 url : "http://{a-d}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png"
 })
 });

 baselayer = new ol.layer.Tile({
 source : new ol.source.TileWMS({
 url : 'http://demo.boundlessgeo.com/geoserver/wms',
 params : {
 'LAYERS' : 'ne:NE1_HR_LC_SR_W_DR'
 }
 })
 })

 baselayer = new ol.layer.Tile({
 source : new ol.source.MapQuest({
 layer : 'osm'
 })
 });

 baselayer = new ol.layer.Tile({
 source : new ol.source.XYZ({
 attributions : [new ol.Attribution({
 html : "OpenStreetmap"
 })],
 url : "http://{a-d}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png"
 })
 });

baselayer = new ol.layer.Tile({
	source : new ol.source.XYZ({
		attributions : [new ol.Attribution({
			html : "Kartendarstellung: © 2014 <a href=\"http://www.falk.de\" target=_blank >Falk</a> <img src=\"img/falk.svg\" />"
		})],
		//url : "http://ec2.cdn.ecmaps.de/WmsGateway.ashx.jpg?TileX={x}&TileY={y}&ZoomLevel={z}&Experience=falk&MapStyle=Falk%20Base"
		url : "http://ec2.cdn.ecmaps.de/WmsGateway.ashx.jpg?TileX={x}&TileY={y}&ZoomLevel={z}&Experience=falk&MapStyle=Falk%20OSM"
	})
});

 baselayer = new ol.layer.Tile({
 source : new ol.source.XYZ({
 attributions : [new ol.Attribution({
 html : "OpenStreetmap"
 })],
 url : "http://{a-d}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png"
 })
 });

 */

 baselayer = new ol.layer.Tile({
   source : new ol.source.XYZ({
   attributions : [new ol.Attribution({ html : 'Tile server sponsored by STRATO / <b>Europe only</b> / <a href="./germanstyle.html">About style</a>' })],
    url : "http://{a-c}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png"
 })
 });


/*
 *
 layer1 = new ol.layer.Vector({
 source : new ol.source.GeoJSON({
 projection : 'EPSG:3857',
 url : 'data/halle.geojson'
 }),
 style : style1
 });
 layer2 = new ol.layer.Vector({
 source : new ol.source.GeoJSON({
 projection : 'EPSG:3857',
 url : 'data/sachsen-anhalt.geojson'
 }),
 style : style2
 });
 layer3 = new ol.layer.Vector({
 source : new ol.source.GeoJSON({
 projection : 'EPSG:3857',
 url : 'data/saalekreis.geojson'
 }),
 style : style3
 });

 layer1 = new ol.layer.Vector({
 source : new ol.source.GPX({
 projection : 'EPSG:3857',
 url : 'data/negative.gpx'
 }),
 style : style1
 });

 //z1=layer1.getSource().getFeatures()[0].getGeometry().getCoordinates();

 layer2 = new ol.layer.Vector({
 source : new ol.source.GPX({
 projection : 'EPSG:3857',
 url : 'data/positive.gpx'
 }),
 style : style2
 });

 //z2=layer2.getSource().getFeatures()[0].getGeometry().getCoordinates();

 */

layer1 = new ol.layer.Vector({
	source : new ol.source.Vector({
		attributions : [new ol.Attribution({
			html : "<p>Programm: &copy; 2015</p><p><a href=\"http://www.klupea.de\" target=_blank >KLUPEA GmbH</a> <img src=\"img/klupea.png\" /></p>"
		})],
		features : [feat1]
	}),
	style : style1
});

layer2 = new ol.layer.Vector({
	source : new ol.source.Vector({
		features : [feat2]
	}),
	style : style2
});

layer3 = new ol.layer.Vector({
	source : new ol.source.Vector({
		features : [feat3]
	}),
	style : style3
});

layer_ziel = new ol.layer.Vector({
	source : new ol.source.Vector({
		attributions : [new ol.Attribution({
			html : "<p>Zonendaten: Januar 2015</p><p><a href=\"http://www.assistancepartner.de\" target=_blank >assistance partner GmbH & Co. KG.</a> <img src=\"img/apg_small.png\" /></p>"
		})],
		features : [f_ziel]
	}),
	style : style4
});

source5 = new ol.source.Vector({
	features : [feat5]
});

layer5 = new ol.layer.Vector({
	source : source5,
	style : style5
});

source6 = new ol.source.Vector({
	features : [feat6]
});

layer6 = new ol.layer.Vector({
	source : source6,
	style : style6
});

source_start = new ol.source.Vector({
	features : [feat_start]
});

layer_start = new ol.layer.Vector({
	source : source_start,
	style : style_start
});

source8 = new ol.source.Vector({
	features : [feat8]
});

layer8 = new ol.layer.Vector({
	source : source8,
	style : style8
});

source99 = new ol.source.Vector({
	features : [feat99]
});

layer99 = new ol.layer.Vector({
	source : source99,
	style : style99
});

source_bab = new ol.source.Vector({
	features : [feat_bab]
});

layer_bab = new ol.layer.Vector({
	source : source_bab,
	style : style_bab
});

view = new ol.View({
	center : center_of_g3,
	//zoom : myzoom,
	zoom : 10,
	maxZoom : 16,
	minZoom : 5
});

//
// Define rotate to north control.
//

/**
 * @constructor
 * @extends {ol.control.Control}
 * @param {Object=} opt_options Control options.
 */
RotateNorthControl = function(opt_options) {

	var options = opt_options || {};

	var anchor = document.createElement('a');
	anchor.href = '#rotate-north';
	anchor.innerHTML = 'N';

	var this_ = this;
	var handleRotateNorth = function(e) {
		// prevent #rotate-north anchor from getting appended to the url
		e.preventDefault();
		var polygon = /** @type {ol.geom.SimpleGeometry} */(feat3.getGeometry());
		var size = /** @type {ol.Size} */(map.getSize());
		view.fitGeometry(polygon, size, {
			padding : [20, 20, 20, 20],
			constrainResolution : false
		});
		this_.getMap().getView().setCenter(center_of_g3);
		//this_.getMap().getView().setZoom(myzoom);

	};

	anchor.addEventListener('click', handleRotateNorth, false);
	anchor.addEventListener('touchstart', handleRotateNorth, false);

	var element = document.createElement('div');
	element.className = 'rotate-north ol-unselectable';
	element.appendChild(anchor);

	ol.control.Control.call(this, {
		element : element,
		target : options.target
	});

};
ol.inherits(RotateNorthControl, ol.control.Control);

$(function() {

	document.title = appname;

	map = new ol.Map({
		target : "map",
		//		controls : [new ol.control.Zoom(), new ol.control.ScaleLine()],
		controls : ol.control.defaults({
			attributionOptions : /** @type {olx.control.AttributionOptions} */( {
				collapsible : true
			})
		}).extend([new RotateNorthControl()]),

		//layers : [baselayer, layer_land1, layer_land2, layer_bab, layer99, layer3, layer2, layer1, layer5, layer6, layer_ziel, layer_start, layer8],
		layers : [baselayer, layer3, layer2, layer1, layer5, layer6, layer_ziel, layer_start, layer8],
		//layers : [baselayer, layer_bab, layer99, layer3, layer2, layer1, layer5, layer6, layer_ziel, layer_start, layer8],
		//layers : [baselayer, layer3, layer2, layer1, layer5, layer6, layer_ziel, layer_start, layer8],
		//layers : [baselayer, layer1, layer5, layer6],
		//layers : [layer3, layer2, layer1, layer_ziel],

		//layers : [baselayer,layer3, layer2, layer1, layer_ziel],
		view : view
	});

	map.addControl(new ol.control.ScaleLine());

	function resize_map() {
		$("canvas").show();
		document.getElementById('map').style.width = document.documentElement.clientWidth + 'px';
		document.getElementById('map').style.height = document.documentElement.clientHeight - offset + 'px';
		map.updateSize();
	};
	/*
	 * Wenn karte wieder eingeblendet wird
	 */
	$('#show_map').on('pageAnimationEnd', function(e, data) {
		if (data.direction === 'in') {
			resize_map();
		}
	});
	/*
	 * Wenn Festergrößen sich ändern (kippen etc.)
	 */
	$(window).on('resize', function() {
		resize_map();
	});
	/*
	 * Startinitialisierung nach erstem Laden
	 */
	resize_map();
	polygon = (feat3.getGeometry());
	size = [document.documentElement.clientWidth, document.documentElement.clientHeight - offset];
	view.fitGeometry(polygon, size, {
		padding : [20, 20, 20, 20],
		constrainResolution : false
	});
	default_resolution = view.getResolution();
});
