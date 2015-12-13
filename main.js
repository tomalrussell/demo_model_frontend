/**
 * Initial setup
 *
 */
window.app_state = {
	// data from model
	all_flows: [],	// array of arrays of from-to-sector-value flows (maintain history)
	all_gdps: [],	// array of objects of player country gdps (maintain history)

	// base data loaded at init: will not change
	countries: {},	// object map to lookup country data by iso3 code
	all_country_codes: "",	// string of country codes for all-country requests
	sectors: [],	// list of trade sectors
	globe: {},	// topojson

	// visualisation state data - change by controls
	globe_x: 0,	// angle -180:180
	globe_y: 0,	// angle -90:90

	// game state data - load/change each round
	player_1_country: "",
	player_1_country_index: undefined,	// index into topojson countries
	player_2_country: "",
	player_2_country_index: undefined,	// index into topojson countries

	turn: 0,
	max_turns: 3
};

function reset_app_state(){
	app_state.all_flows = [];
	app_state.all_gdps = [];
	app_state.player_1_country = "";
	app_state.player_1_country_index = undefined;
	app_state.player_2_country = "";
	app_state.player_2_country_index = undefined;
	app_state.turn = 0;
}

$('.max_turns').text(app_state.max_turns);

/**
 * Style select menus
 */
$('select').chosen();

/**
 * Get countries
 */
$.getJSON('./data/country-codes.json', function(data){
	// exclude countries that aren't covered by the model
	var exclude = ["UMI","PSE","ASM","CXR","AIA","ANTARCTICA","HMD","WLF","ESH","ATF","IOT","SGS","TKL","TMP","TCA","VGB","CYM"];
	data = _.indexBy(
		_.filter(data,function(item){
			return !_.contains(exclude,item.code);
		}),
		"code"
	);
	app_state.countries = data;
	app_state.all_country_codes = _.keys(app_state.countries).join();

	options = _.map(_.sortBy(data, 'name'), function(country, code){
		return "<option value=\""+country.code+"\">"+country.name+"</option>";
	});
	$('.select_country').html('<option value="">Select a country</option>' + options.join("")).trigger("chosen:updated");
});

/**
 * Get sectors
 */
d3.tsv('./data/sectors.tsv', function(data){
	app_state.sectors = data;

	var sliders = _.map(data,function(sector){
		var str = "<div class=\"input-block\">";
		str += "<input type=\"range\" min=\"0\" max=\"127\" step=\"1\" value=\"64\" id=\"sector_"+sector.sector_id+"\">";
		str += "<label>"+sector.name+"</label>";
		str += "</div>";
		return str;
	});
	$('form .sectors').append(sliders.join(""));
	$('form .sectors input').on("change",function(){
		var val = lerp_slider($(this).val());
		var sector = $(this).attr("id");
	});
});

/**
 * Event Handlers
 *
 */
var selectMIDI = null;
var midiAccess = null;
var midiIn = null;

function midiMessageReceived( ev ) {
	var cmd = ev.data[0] >> 4;
	var channel = ev.data[0] & 0xf;
	var noteNumber = ev.data[1];
	var velocity = ev.data[2];
	console.log( "" + ev.data[0] + " " + ev.data[1] + " " + ev.data[2]);
	// nanoKontrol2 has note number:
	// 0-7 sliders
	// 16-21 knobs
	switch(noteNumber){
		case 0:
			// globeY
			$('#globe_y').val( velocity ).trigger("input");
			break;
		case 16:
			// globeX
			$('#globe_x').val( velocity ).trigger("input");
			break;
	}
}
function selectMIDIIn( ev ) {
	if (midiIn)
		midiIn.onmidimessage = null;
	var id = ev.target[ev.target.selectedIndex].value;
	if ((typeof(midiAccess.inputs) == "function"))	 //Old Skool MIDI inputs() code
		midiIn = midiAccess.inputs()[ev.target.selectedIndex];
	else
		midiIn = midiAccess.inputs.get(id);
	if (midiIn)
		midiIn.onmidimessage = midiMessageReceived;
}
function populateMIDIInSelect() {
	// clear the MIDI input select
	selectMIDI.options.length = 0;
	if (midiIn && midiIn.state=="disconnected")
		midiIn=null;
	var firstInput = null;

	var inputs=midiAccess.inputs.values();
	for ( var input = inputs.next(); input && !input.done; input = inputs.next()){
		input = input.value;
		if (!firstInput)
			firstInput=input;
		var str=input.name.toString();
		var preferred = !midiIn && ((str.indexOf("MPK") != -1)||(str.indexOf("Keyboard") != -1)||(str.indexOf("keyboard") != -1)||(str.indexOf("KEYBOARD") != -1));

		// if we're rebuilding the list, but we already had this port open, reselect it.
		if (midiIn && midiIn==input)
			preferred = true;

		selectMIDI.appendChild(new Option(input.name,input.id,preferred,preferred));
		if (preferred) {
			midiIn = input;
			midiIn.onmidimessage = midiMessageReceived;
		}
	}
	$(selectMIDI).trigger("chosen:updated");
	if (!midiIn) {
			midiIn = firstInput;
			if (midiIn)
				midiIn.onmidimessage = midiMessageReceived;
	}
}
function midiConnectionStateChange( e ) {
	console.log("connection: " + e.port.name + " " + e.port.connection + " " + e.port.state );
	populateMIDIInSelect();
}
function onMIDIInit( midi ) {
	midiAccess = midi;
	selectMIDI=document.getElementById("midiIn");
	midi.onstatechange = midiConnectionStateChange;
	populateMIDIInSelect();
	selectMIDI.onchange = selectMIDIIn;
}
function onMIDISystemError( msg ) {
	console.log( "Midi error encountered:" );
	console.log( msg );
}
//init: start up MIDI
window.addEventListener('load', function() {
	if(navigator.requestMIDIAccess) navigator.requestMIDIAccess().then( onMIDIInit, onMIDISystemError );
});

var lerp_angle = d3.scale.linear()
	.domain([0, 127])
	.range([-180,180]);

var lerp_half_angle = d3.scale.linear()
	.domain([0, 127])
	.range([-90,90]);

var lerp_slider = d3.scale.linear()
	.domain([0, 127])
	.range([-1,1]);

var x_throttled = _.throttle(function(){
	app_state.globe_x = lerp_angle($(this).val());
	window.requestAnimationFrame(drawGlobe);
}, 50);

$('#globe_x').on('input change', x_throttled);

var y_throttled = _.throttle(function(){
	app_state.globe_y = lerp_half_angle($(this).val());
	window.requestAnimationFrame(drawGlobe);
}, 50);

$('#globe_y').on('input change', y_throttled);

$('.toggle-settings').click(function(e){
	e.preventDefault();
	$('.settings').toggleClass('offscreen');
});

$('.select_country').on('change',function(){
	var $this = $(this);
	var id = $this.attr('id');
	var val = $this.val();

	$("#"+id+"_chosen").removeClass('error');

	app_state[id] = val;
	app_state[id+"_index"] = getTopoIndexFromCountryCode(val);
	drawGlobe();
});

$('.form_start').on('submit',function(e){
	e.preventDefault();
	$('.form_start .message').addClass('hide').text("");

	if(app_state.player_1_country && app_state.player_2_country){
		// begin game
		$('.start-screen').addClass('offscreen');
		getAllFlows();
		getAllGDPs();
		drawCountries();

	} else {
		// need to choose countries
		$('.form_start .message').removeClass('hide').text("Please select a country for both players.");
		if(!app_state.player_1_country){
			$("#player_1_country_chosen").addClass('error');
		}
		if(!app_state.player_2_country){
			$("#player_2_country_chosen").addClass('error');
		}
	}
});

$('.form_change_relationship').on('submit',function(e){
	e.preventDefault();

	var data = {
		change_type: 2, // change_type 2 is trade relationship, 1 is export attractiveness
		country1: $('#change_1').val(),
		country2: $('#change_2').val(),
		slider_value: 1,
		sector_id: 0
	};

	$('.disable-while-loading').addClass('loading');
	$.post("http://localhost:5000/change/", data, function(reponse,status,xhr){
		if(status == "success"){
			nextTurn();
			getAllFlows();
			getAllGDPs();
		} else {
			onUpdateError();
		}
	}).fail(onUpdateError);
});

$('.form_change_export').on('submit',function(e){
	e.preventDefault();

	var data = {
		change_type: 1, // change_type 2 is trade relationship, 1 is export attractiveness
		country1: $('#change_export_country').val(),
		slider_value: lerp_slider( $('#export_attractiveness').val() ),
		sector_id: 0
	};

$('.disable-while-loading').addClass('loading');
	$.post("http://localhost:5000/change/", data, function(reponse,status,xhr){
		if(status == "success"){
			nextTurn();
			getAllFlows();
			getAllGDPs();
		} else {
			onUpdateError();
		}
	}).fail(onUpdateError);
});

$('.form_end').on('submit',function(e){
	e.preventDefault();
	reset_app_state();
	$(".select_country").val('').trigger("chosen:updated");
	$('.start-screen').removeClass('offscreen');
});

function onUpdateError(){
	alert("Something went wrong - couldn't update the model.");
	$('.disable-while-loading').removeClass('loading');
}

function nextTurn(){
	app_state.turn++;
	drawCountries();
}

function getAllFlows(){
	var imports_url = [
		"http://localhost:5000/flows?from=",
		app_state.all_country_codes,
		"&to=",
		app_state.player_1_country,
		",",
		app_state.player_2_country
	].join("");

	var exports_url = [
		"http://localhost:5000/flows?from=",
		app_state.player_1_country,
		",",
		app_state.player_2_country,
		"&to=",
		app_state.all_country_codes
	].join("");

	d3.csv(imports_url, parseFlows, function(imports_data){
		d3.csv(exports_url, parseFlows, function(exports_data){
			app_state.all_flows.push(imports_data.concat(exports_data));
			drawCountries();
			$('.disable-while-loading').removeClass('loading');
		});
	});
}

function getAllGDPs(){
	var url = [
		"http://localhost:5000/attributes?country=",
		app_state.player_1_country,
		",",
		app_state.player_2_country
	].join("");

	d3.csv(url, parseAttributes, function(error, data){
		if(error){
			// likely because the model server has no data for one of the countries
			// work around by excluding the country from the options initially loaded
			alert("Something went wrong - couldn't load the country GDPs");
			console.log(error);
		} else {
			var to_store = {};
			to_store[app_state.player_1_country] = _.findWhere(data, {country: app_state.player_1_country}).value;
			to_store[app_state.player_2_country] = _.findWhere(data, {country: app_state.player_2_country}).value;

			app_state.all_gdps.push(to_store);
			$('.disable-while-loading').removeClass('loading');
			drawCountries();
		}
	});
}

function parseFlows(row){
	var result = {
		from_country: row.from_country,
		to_country: row.to_country,
		sector: parseInt(row.sector),
		value: parseFloat(row.value)
	};
	return result;
}

function parseAttributes(row){
	var result = {
		country: row.country,
		key: row.key,
		value: parseFloat(row.value)
	};
	return result;
}

function getTopoIndexFromCountryCode(code){
	return _.findIndex(app_state.globe.objects.countries.geometries, {id: code});
}


/**
 * Globe vis
 *
 */
var diameter = 960 / 2,
	radius = diameter >> 1,
	velocity = 0.01;

var projection,
	mercator = false;

if(!mercator){
	projection = d3.geo.orthographic()
		.scale(radius - 2)
		.translate([radius, radius])
		.clipAngle(90)
		.precision(0);
} else {
	projection = d3.geo.mercator()
		.scale((diameter + 1) / 2 / Math.PI)
		.translate([radius, radius])
		.clipExtent([[0, 0], [diameter, 4*diameter/5]])
		.precision(0.1);
}

var canvas = d3.select("#map").selectAll("canvas")
	.data(d3.range(1))
	.enter().append("canvas")
	.attr("width", diameter)
	.attr("height", diameter);

var path = d3.geo.path()
	.projection(projection);

d3.json("./data/topo/world-10m.json", function(error, globe) {
	if (error) throw error;

	app_state.globe = globe;
	app_state.globe_x = 0;
	app_state.globe_y = 0;
	app_state.country_index = undefined;

	drawGlobe();
});

function drawGlobe(){
	if(!app_state.globe || !app_state.globe.objects) return;

	var world = app_state.globe,
		x = app_state.globe_x,
		y = app_state.globe_y,
		player_1_country_index = app_state.player_1_country_index,
		player_2_country_index = app_state.player_2_country_index,
		land = topojson.feature(world, world.objects.land),
		path_opts = {type: "Sphere"};

	canvas.each(function(i) {
		var rotate = [x, y, 0], context = this.getContext("2d");

		projection.rotate(rotate);
		context.clearRect(0, 0, diameter, diameter);

		path.context(context);	// need to do path.context on first call

		context.fillStyle =	"#bbb";
		context.beginPath();
		path(land);
		context.fill();

		if (typeof(player_1_country_index) !== "undefined" && player_1_country_index !== -1){
			country = topojson.feature(world, world.objects.countries.geometries[player_1_country_index]);

			context.fillStyle = "#222";
			context.beginPath();
			path.context(context)(country);
			context.fill();
		}
		if (typeof(player_2_country_index) !== "undefined" && player_2_country_index !== -1){
			country = topojson.feature(world, world.objects.countries.geometries[player_2_country_index]);

			context.fillStyle = "#222";
			context.beginPath();
			path.context(context)(country);
			context.fill();
		}

		var a, a_ctr, max, max_val, flow, b, b_ctr, b_index;
		// if(app_state.from_country_flows && app_state.from_country_flows.length){
		if(app_state.to_country_flows && app_state.to_country_flows.length){
			a = topojson.feature(world, world.objects.countries.geometries[country_index]);
			a_ctr = d3.geo.centroid(a);
			max = 5;

			max_val = _.max(_.map(app_state.to_country_flows, function(item){return item.value;}));

			for (var j = 0; j <= max; j++) {
			// for (var j = app_state.to_country_flows.length - 1; j >= 0; j--) {
				flow = app_state.to_country_flows[j];
				b_index = getTopoIndexFromCountryCode(flow.from_country);
				if(b_index && b_index !== -1){
					b = topojson.feature(world, world.objects.countries.geometries[b_index]);
					b_ctr = d3.geo.centroid(b);

					context.strokeStyle = "rgba(255,0,0,"+flow.value / max_val+")";
					// context.lineWidth = Math.log(flow.value);
					context.beginPath();
					path.context(context)({
						type: "LineString",
						coordinates: [a_ctr,b_ctr]
					});
					context.stroke();
				}
			}
		}
		if(app_state.from_country_flows && app_state.from_country_flows.length){
			a = topojson.feature(world, world.objects.countries.geometries[country_index]);
			a_ctr = d3.geo.centroid(a);
			max = 5;

			max_val = _.max(_.map(app_state.from_country_flows, function(item){return item.value;}));

			for (var k = 0; k <= max; k++) {
			// for (var k = app_state.from_country_flows.length - 1; k >= 0; k--) {
				flow = app_state.from_country_flows[k];
				b_index = getTopoIndexFromCountryCode(flow.to_country);
				if(b_index && b_index !== -1){
					b = topojson.feature(world, world.objects.countries.geometries[b_index]);
					b_ctr = d3.geo.centroid(b);

					context.strokeStyle = "rgba(0,0,255,"+flow.value / max_val+")";
					context.beginPath();
					path.context(context)({
						type: "LineString",
						coordinates: [a_ctr,b_ctr]
					});
					context.stroke();
				}
			}
		}

	});
}

/**
 * Player countries
 *
 */
function drawCountries(){

	if(app_state.turn >= app_state.max_turns){
		$('.form_end').addClass('active');
		$('.form_change_export, .form_change_relationship').addClass('disabled');
	} else {
		$('.form_end').removeClass('active');
		$('.form_change_export, .form_change_relationship').removeClass('disabled');
		$('.turn_count').text(app_state.turn+1);
	}

	var country_codes = [app_state.player_1_country, app_state.player_2_country];

	var container = d3.select('.country_info_wrap');
	var blocks = container.selectAll('.country_info').data(country_codes);

	// handle new data
	blocks.enter().append('div').classed('country_info col-1-2', true).each(function(){
		var block = d3.select(this);
		block.append('h2').classed('name',true);
		block.append('p').classed('gdp',true);
		block.append('div').classed('top_partners',true);
	});

	// update
	blocks.select('.name').text(function(d){
		if(d){
			return app_state.countries[d].name;
		}
	});

	var gdp_format = d3.format(",.3r");
	blocks.select('.gdp').text(function(d){
		if(d && app_state.all_gdps[app_state.turn]){
			var next = app_state.all_gdps[app_state.turn][d];
			var text = "GDP: " + gdp_format(next) + " million USD";
			// diff
			if(app_state.all_gdps.length > 1 && app_state.turn > 0){
				var prev = app_state.all_gdps[app_state.turn-1][d];
				text += " (change: "+ gdp_format(next-prev) + " million USD)";
			}
			return text;
		}
	});
	var partners = blocks.select('.top_partners').each(function(d){
		var top_to_here = top_n_grouped("to_country", "from_country", d, 5);
		barChart(d3.select(this), top_to_here, "from_country");

		var top_from_here = top_n_grouped("from_country", "to_country", d, 5);
		barChart(d3.select(this), top_from_here, "to_country");
	});

}

function top_n_grouped(field, alt_field, country, n){
	var lookup = {};
	lookup[field] = country;
	return _.take(
		_.sortBy(
			_.map(
				_.groupBy(
					_.where(app_state.all_flows[app_state.turn], lookup),
					function(item){ return item[alt_field]; }
				),
				function(item){
					return {
						from_country: item[0].from_country,
						to_country: item[0].to_country,
						value: _.reduce(item, function(memo, item){ return memo+item.value; },0),
						by_sector: item
					};
				}
			),
			function(item){return -item.value;}
		),
		n
	);
}

function barChart(el,data,nameField){
	var margin = {top: 20, right: 20, bottom: 150, left: 40},
		width = $(el[0][0]).width() - margin.left - margin.right,
		height = 4*width/5 - margin.top - margin.bottom;

	var x = d3.scale.ordinal()
		.rangeRoundBands([0, width], 0.1);

	var y = d3.scale.linear()
		.range([height, 0]);

	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom");

	var svg = el.select("svg."+nameField);
	var inner = svg.select("g");
	x.domain(data.map(function(d) { return getName(d); }));
	y.domain([0, d3.max(data, function(d) { return d.value; })]);

	if(!svg[0][0]){
		el.append('svg').classed(nameField,true);
		svg = el.select("svg."+nameField);

		inner = svg.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		inner.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + height + ")");

		inner.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", "-1em")
			.attr("style","text-anchor: end")
			.text(function(d){
				return (nameField == "from_country")? "Imports from":"Exports to";
			});
	}

	inner.selectAll(".x.axis")
		.call(xAxis)
		.selectAll("text")
		.attr("style", "text-anchor: end")
		.attr("transform", function(){
			return "rotate(-45)";
		});

	var bars = inner.selectAll(".bar")
		.data(data);

	bars.enter().append("rect")
		.attr("class", "bar")
		.attr("x", function(d) { return x(getName(d)); })
		.attr("width", x.rangeBand())
		.attr("y", function(d) { return y(d.value); })
		.attr("height", function(d) { return height - y(d.value); });

	bars.exit().remove();

	function getName(d){
		return app_state.countries[d[nameField]].name;
	}
}