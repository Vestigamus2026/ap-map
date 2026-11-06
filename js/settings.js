function save_settings() {

	var aSettings = [];

	$("#settingsform input[type=checkbox]").each(function() {
		aSettings.push([this.id, this.checked]);
	});

	var sSettings = aSettings.join(";");

	if ( typeof (localStorage) == 'undefined') {
		alert('Your browser does not support HTML5 localStorage. Try upgrading.');
	} else {
		try {
			localStorage.setItem("gebietskarte_settings", sSettings);
			//saves to the database, "key", "value"
		} catch (e) {
			if (e == QUOTA_EXCEEDED_ERR) {
				alert('Quota exceeded!');
				//data wasn't successfully saved due to quota exceed so throw an error
			}
		}
	}
};

function get_settings() {

	var settingsString, settings = [];

	if ( typeof (localStorage) == 'undefined') {
		alert('Your browser does not support HTML5 localStorage. Try upgrading.');
	} else {
		try {
			settingsString = localStorage.getItem("gebietskarte_settings");
		} catch (e) {
			settingstring = "";
		};
		if (settingsString && settingsString != "") {
			settings = settingsString.split(";");
			for (var i = 0, j = settings.length; i < j; i++) {
				var akt = settings[i].split(",");
				var akt_box = document.getElementById(akt[0]);
				akt_box.checked = (akt[1] == "true" );
			};
		};
	};
};

function hide_silly() {
	if (document.getElementById("shortest").checked)
		$("#onlyifshortest").show();
	else
		$("#onlyifshortest").hide();
	;
	if (document.getElementById("fastest").checked)
		$("#onlyiffastest").show();
	else
		$("#onlyiffastest").hide();
	;
	if (document.getElementById("show_bab").checked)
		$("#kmform").show();
	else
		$("#kmform").hide();
	;
	if (document.getElementById("show_gps").checked) {
		$(".gpsoff").hide();
		$(".gpson").show();
	} else {
		$(".gpsoff").show();
		$(".gpson").hide();
	};
};

$(function() {

	$('#settingsform').change(function() {
		hide_silly();
		save_settings();
		return false;
	});

	get_settings();
	hide_silly();

});
