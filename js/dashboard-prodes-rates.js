var utils = {
	config:{},
	printWindow:null,
	statusPrint:false,
	cssDefault:true,
	setConfig: function(config) {
		utils.config=config;
	},
	onResize:function(event) {
		clearTimeout(utils.config.resizeTimeout);
		utils.config.resizeTimeout = setTimeout(utils.rebuildAll, 200);
	},
	updateDimensions: function() {
		var d={ w: window.innerWidth,
				h: window.innerHeight};
		graph.setDimensions(d);
	},
	setDinamicTexts: function() {
		var startYear=graph.yearDimension.bottom(1),
		endYear=graph.yearDimension.top(1);
		var yearRange = document.getElementById('year-range');
		yearRange.innerText=startYear[0].year+" - "+endYear[0].year;
	},
	totalRateCalculator: function() {
		var itens=graph.ufRateGroup.top(Infinity);
		var t=0;
		itens.forEach(function(d){
			t+=d.value;
		});
		return t;
	},
	rebuildAll: function() {
		utils.updateDimensions();
		graph.build();
	},
	addGenerationDate: function() {
		var footer_page=document.getElementById("footer_page");
		var footer_print=document.getElementById("footer_print");
		if(!footer_page || !footer_print) {
			return;
		}
		var h=( (window.document.body.clientHeight>window.innerHeight)?(window.document.body.clientHeight):(window.innerHeight - 20) );
		//footer_page.style.top=h+"px";
		footer_print.style.width=window.innerWidth+"px";
		var now=new Date();
		var footer=Translation[Lang.language].footer1+' '+now.toLocaleString()+' '+Translation[Lang.language].footer2;
		footer_page.innerHTML=footer;
		footer_print.innerHTML=footer;
	},
	/**
	 * Apply configurations to UI
	 * - Enable or disable the information about rates estimate.
	 * - Enable or disable the panel swap button.
	 */
	applyConfigurations: function() {
		document.getElementById("warning-msg").style.display=( (graph.displayInfo)?(''):('none') );
		document.getElementById("panel_swap").style.display=( (graph.displaySwapPanelButton)?(''):('none') );
	},
	changeCss: function(bt) {
		utils.cssDefault=!utils.cssDefault;
		document.getElementById('stylesheet_dash').href='./css/dashboard-prodes-rates'+((utils.cssDefault)?(''):('-dark'))+'.css';
		bt.style.display='none';
		setTimeout(bt.style.display='',200);
	}
};

var graph={

	barRateByYear: null,
	lineRateStatesByYear: null,
	pieTotalizedByState: null,
	ratesDataTable: null,
	relativeRatesDataTable: null,

	yearDimension: null,
	ufDimension: null,
	ufYearDimension: null,
	stateYearDimension: null,

	yearRateGroup: null,
	ufRateGroup: null,
	stateYearRateGroup: null,

	data:null,
	data_all:null,

	winWidth: window.innerWidth,
	winHeight: window.innerHeight,

	histogramColor: "#ffd700",
	pallet: ["#FF0000","#FF6A00","#FF8C00","#FFA500","#FFD700","#FFFF00","#DA70D6","#BA55D3","#7B68EE"],
	displayInfo: false,
	displaySwapPanelButton: false,

	loadConfigurations: function() {
		
		d3.json("config/config.json", function(error, conf) {
			if (error) {
				console.log("Didn't load config file. Using default options.");
			}
			if(conf) {
				graph.pallet=conf.pallet?conf.pallet:graph.pallet;
				graph.histogramColor=conf.histogramColor?conf.histogramColor:graph.histogramColor;
				graph.displayInfo=conf.displayInfo?conf.displayInfo:graph.displayInfo;
				graph.displaySwapPanelButton=conf.displaySwapPanelButton?conf.displaySwapPanelButton:graph.displaySwapPanelButton;
			}
			utils.applyConfigurations();
		});
		
	},
	setDimensions: function(dim) {
		this.winWidth=dim.w;
		this.winHeight=dim.h;
	},
	setChartReferencies: function() {

		this.barRateByYear = dc.barChart("#chart-by-year");
		this.lineRateStatesByYear = dc.seriesChart("#chart-by-year-state");
		this.pieTotalizedByState = dc.pieChart("#chart-by-state");
		this.ratesDataTable = dataTable("rates-data-table");
		this.relativeRatesDataTable = dataTable("relative-rates-data-table");
	},
	loadData: function() {
		// download data in CSV format from PRODES WFS service.
		// var url="http://terrabrasilis.info/fip-service/fip-project-prodes/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=fip-project-prodes:prodes_rates_d&outputFormat=csv";
		// d3.csv(url, graph.processData);
		
		// load data from CSV file
		d3.csv("data/prodes_rates_d.csv", graph.processData);
		
		// download data in JSON format from PRODES WFS service.
		// var url="http://terrabrasilis.info/prodes-data/PRODES/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=PRODES:prodes_rates_d&outputFormat=application%2Fjson";
		// d3.json(url, graph.processData);
		
		// load data from JSON file
		// var url="data/prodes_rates.json";
		// d3.json(url, graph.processData);
	},
	processData: function(error, data) {
		if (error) throw error;

		var o=[],t=[];
		for (var j = 0, n = data.length; j < n; ++j) {
			var obj={
				uf:data[j].state,
				year:data[j].year,
				rate:+data[j].rate,
				ufYear:data[j].state + "/" + data[j].year
			};
			if(data[j].state=='AMZ') {
				t.push(obj);
			}else{
				o.push(obj);
			}
		}
		data = o;
		graph.data_all = t;
		graph.registerDataOnCrossfilter(data);
		graph.build();
	},
	registerDataOnCrossfilter: function(data) {
		graph.data=data;
		var ndx = crossfilter(data);

		this.yearDimension = ndx.dimension(function(d) {
			return d.year;
		});
		this.ufDimension = ndx.dimension(function(d) {
			return d.uf;
		});
		this.ufYearDimension = ndx.dimension(function(d) {
			return d.ufYear;
		});
		this.stateYearDimension = ndx.dimension(function(d) {
			return [d.uf, +d.year];
		});

		this.yearRateGroup = this.yearDimension.group().reduceSum(function(d) {
			return +d.rate;
		});
		this.yearGroup = this.yearDimension.group().reduceSum(function(d) {
			return +d.year;
		});
		this.ufRateGroup = this.ufDimension.group().reduceSum(function(d) {
			return +d.rate;
		});
		this.stateYearRateGroup = this.stateYearDimension.group().reduceSum(function(d) {
			return +d.rate;
		});
	},
	buildDataTable: function() {
		var data2Table=[], yearFilter=[], total=[], ufList=[];
		graph.ufYearDimension.bottom(Infinity).forEach(
			function (y) {
				if(!total[y.uf]) {
					total[y.uf]=0;
					ufList.push(y.uf);
				}
				total[y.uf]+=y.rate;
				data2Table.push({
					uf:y.uf,
					year:y.year,
					rate:localeBR.numberFormat(',1f')(y.rate),
					originalRate:y.rate
				});
				if(yearFilter.indexOf(y.year) < 0) {
					yearFilter.push(y.year);
				}
			}
		);
		graph.data_all.forEach(function(da){
			if(yearFilter.indexOf(da.year) >= 0) {
				if(!total[da.uf]) {
					total[da.uf]=0;
					ufList.push(da.uf);
				}
				total[da.uf]+=da.rate;
				data2Table.push({
					uf:da.uf,
					year:da.year,
					rate:localeBR.numberFormat(',1f')(da.rate),
					originalRate:da.rate
				});
			}
		});
		graph.data2csv=jQuery.extend(true, [], data2Table);
		graph.buildVariationRatesDataTable(data2Table);
		ufList.forEach(function(uf){

			data2Table.push({
				uf:uf,
				year:Translation[Lang.language].cumulate,
				rate:localeBR.numberFormat(',1f')(total[uf])
			});
		});
		graph.ratesDataTable.init(data2Table);
		graph.ratesDataTable.redraw();
		utils.addGenerationDate();
	},
	buildVariationRatesDataTable: function(d) {
		var data2Table=[], l=d.length;
		for(var i=0;i<l;i++) {
			if(d[i+1] && d[i].uf==d[i+1].uf) {
				var rr=(d[i].originalRate>0)?( ( (100 - (d[i+1].originalRate*100/d[i].originalRate)) * (-1) ).toFixed(0) + '%'):('');
				data2Table.push({
					uf:d[i].uf,
					year:d[i].year+'-'+d[i+1].year,
					rate:rr
				});
			}
		}
		graph.relativeRatesDataTable.init(data2Table);
		graph.relativeRatesDataTable.redraw();
	},
	build: function() {
		var w=parseInt(this.winWidth - (this.winWidth * 0.05)),
		h=parseInt(this.winHeight * 0.3);

		this.setChartReferencies();
		utils.setDinamicTexts();

		var fw=parseInt(w),
		fh=parseInt((this.winHeight - h) * 0.6);

		var years=graph.yearDimension.group().all();

		this.barRateByYear
			.height(fh)
			.width(parseInt( (fw/4) * 3))
			.margins({top: 0, right: 10, bottom: 45, left: 45})
			.yAxisLabel(Translation[Lang.language].barYAxis)
			.xAxisLabel(Translation[Lang.language].barXAxis + years[0].key + " - " + years[years.length-1].key)
			.dimension(this.yearDimension)
			.group(this.yearRateGroup)
			.title(function(d) {
				return Translation[Lang.language].area + localeBR.numberFormat(',1f')(Math.abs(+(d.value.toFixed(1)))) + " km²";
			})
			.label(function(d) {
				var t=Math.abs((d.data.value/1000).toFixed(1));
				t=(t<1?localeBR.numberFormat(',1f')(parseInt(d.data.value)):localeBR.numberFormat(',1f')(t)+"k");
				return t;
			})
			.elasticY(true)
			.clipPadding(10)
			.yAxisPadding('10%')
			.x(d3.scale.ordinal())
	        .xUnits(dc.units.ordinal)
	        .barPadding(0.3)
			.outerPadding(0.1)
			.renderHorizontalGridLines(true)
			.ordinalColors([graph.histogramColor]);

		this.barRateByYear
			.on("renderlet.a",function (chart) {
				// rotate x-axis labels
				chart.selectAll('g.x text')
					.attr('transform', 'translate(-15,7) rotate(315)');
			});

		var auxYears=[],auxRates=[];
		graph.yearGroup.all().forEach(function(y){
			auxYears.push(+y.key);
			auxRates.push(y.value);
		});
		var xScale = d3.scale.linear()
			.domain([auxYears[0] -1,auxYears[auxYears.length-1]+1])
			.range([auxRates[0],auxRates[auxRates.length-1]]);
		
		this.lineRateStatesByYear
			.width(fw)
			.height(fh)
			.margins({top: 0, right: 10, bottom: 45, left: 45})
			.chart(function(c) { return dc.lineChart(c).interpolate('default'); })
			.x(xScale)
			.brushOn(false)
			.yAxisLabel(Translation[Lang.language].lineYAxis)
			.xAxisLabel(Translation[Lang.language].lineXAxis + years[0].key + " - " + years[years.length-1].key)
			.renderHorizontalGridLines(true)
			.renderVerticalGridLines(true)
			.title(function(d) {
				return Translation[Lang.language].state + d.key[0] + "\n" +
				Translation[Lang.language].year + d.key[1] + "\n" +
				Translation[Lang.language].area + localeBR.numberFormat(',1f')(Math.abs(+(d.value.toFixed(2)))) + " km²";
			})
			.elasticY(true)
			.yAxisPadding('10%')
			.dimension(this.stateYearDimension)
			.group(this.stateYearRateGroup)
			.mouseZoomable(false)
			.seriesAccessor(function(d) {
				return d.key[0];
			})
			.keyAccessor(function(d) {
				return +d.key[1];
			})
			.valueAccessor(function(d) {
				return +d.value;
			})
			.ordinalColors(graph.pallet)
			.seriesSort(function(a,b) {
				var rank=graph.ufRateGroup.top(Infinity);
				var sr=[];
				rank.forEach(function(d){
					sr[d.key]=+d.value;
				});
				return d3.descending(sr[a], sr[b]);
			})
			.legend(dc.legend().x(fw - graph.lineRateStatesByYear.margins().right - 40).y(5).itemHeight(13).gap(7).horizontal(0).legendWidth(50).itemWidth(40));

		this.lineRateStatesByYear.xAxis().ticks(auxYears.length);
		this.lineRateStatesByYear.xAxis().tickFormat(function(d) {
			return d+"";
		});
		
		this.lineRateStatesByYear
			.on("renderlet.a",function (chart) {
				// rotate x-axis labels
				chart.selectAll('g.x text')
					.attr('transform', 'translate(-15,7) rotate(315)');
			});

		this.pieTotalizedByState
			.height(fh)
			.width(parseInt(fw/4))
			.innerRadius(10)
			.externalRadiusPadding(30)
			.dimension(this.ufDimension)
			.group(this.ufRateGroup)
			.title(function(d) {
				var t=utils.totalRateCalculator();
				t = Translation[Lang.language].percent + localeBR.numberFormat(',1f')((d.value * 100 / t).toFixed(1)) + " %";
				t = Translation[Lang.language].state + d.key + "\n" + t + "\n";
				return t + Translation[Lang.language].area + localeBR.numberFormat(',1f')(Math.abs(+(d.value.toFixed(2)))) + " km²";
			})			
			.label(function(d) {
				var filters = graph.pieTotalizedByState.filters();
				var localized = false;
				
				for(var f = 0; f < filters.length; f++){
					if(filters[f] === d.key) localized = true; 
				}
				
				var t = utils.totalRateCalculator();

				if(filters.length == 0){
					return d.key + ":" + localeBR.numberFormat(',1f')((d.value * 100 / t).toFixed(1)) + " %";
				} else {
					return localized === true ? d.key + ":" + localeBR.numberFormat(',1f')((d.value * 100 / t).toFixed(1)) + " %" : "";
				}
			})
			.ordinalColors(graph.pallet)
			.legend(dc.legend().x(1).y(5).itemHeight(13).gap(7).horizontal(0).legendWidth(50).itemWidth(40));
		
		this.pieTotalizedByState.on("postRedraw", this.buildDataTable);
		
		dc.renderAll();
		this.buildDataTable();
		this.prepareTools();
	},
	init: function() {
		window.onresize=utils.onResize;
		this.loadConfigurations();
		try{
			this.loadData();
		}catch (e) {
			// TODO: handle exception
			
		}
	},
	/*
	 * Called from the UI controls to clear one specific filter.
	 */
	resetFilter: function(who) {
		if(who=='year'){
			graph.barRateByYear.filterAll();
		}else if(who=='state'){
			graph.pieTotalizedByState.filterAll();
		}
		dc.redrawAll();
	},
	prepareTools: function() {
		// build download data
		d3.select('#downloadTableBtn')
	    .on('click', function() {
	    	var ufs=[],years=[],rates=[];
	    	
	    	graph.data2csv.forEach(function(d) {
	    		if(ufs.indexOf(d.uf)<0){
	    			ufs.push(d.uf);
	    			rates[d.uf]=[]
	    		}
	    		if(years.indexOf(d.year)<0){
	    			years.push(d.year);
	    		}
	    		
    			rates[d.uf][d.year]=d.originalRate;
			});
	    	var csv=[],aux={};
	    	ufs.forEach(function(u) {
		    	years.forEach(function(y) {
		    		if(aux[y]) {
		    			c=aux[y];
		    		}else{
		    			var c={};
		    			c['year']=y;
		    			aux[y]=c;
		    		}
		    		c[u]=rates[u][y];
		    	});
	    	});
	    	for(var c in aux){if (aux.hasOwnProperty(c)) {csv.push(aux[c]);} }

	        var blob = new Blob([d3.csv.format(csv)], {type: "text/csv;charset=utf-8"});
	        var dt=new Date();
	    	dt=dt.getDate() + "_" + dt.getMonth() + "_" + dt.getFullYear() + "_" + dt.getTime();
	        saveAs(blob, 'prodes_rates_'+dt+'.csv');
	    });
		
		d3.select('#prepare_print')
	    .on('click', function() {
	    	graph.preparePrint();
	    });
		
		d3.select('#change_style')
	    .on('click', function() {
	    	utils.changeCss(this);
	    });
		
		d3.select('#panel_swap')
	    .on('click', function() {
	    	window.location='?type=default';
	    });
		
		this.jsLanguageChange();
	},
	preparePrint: function() {
		d3.select('#print_information').style('display','block');
		d3.select('#print_page')
	    .on('click', function() {
	    	d3.select('#print_information').style('display','none');
	    	window.print();
	    });
	},
	jsLanguageChange: function() {
		var callback = function() {
			graph.build();
		};
		d3.select('#flag-pt-br')
	    .on('click', function() {
	    	Lang.change('pt-br', callback);
	    });
		d3.select('#flag-en')
	    .on('click', function() {
	    	Lang.change('en', callback);
	    });
		d3.select('#flag-es')
	    .on('click', function() {
	    	Lang.change('es', callback);
	    });
	}
};

window.onload=function(){
	Mousetrap.bind(['command+p', 'ctrl+p'], function() {
        console.log('command p or control p');
        // return false to prevent default browser behavior
        // and stop event from bubbling
        return false;
    });

	Lang.init();
	graph.init();
	Lang.apply();// apply from previous selection
};
