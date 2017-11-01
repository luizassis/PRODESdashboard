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
		var d={w: window.innerWidth,
				h: window.innerHeight};
		graph.setDimensions(d);
	},
	rebuildAll: function() {
		utils.updateDimensions();
		graph.build();
	},
	setTitle:function(elementId, title) {
		elementId='title-chart-by-'+elementId;
		document.getElementById(elementId).innerHTML=title;
	},
	/*
	 * Remove numeric values less than 1e-6
	 */
	snapToZero:function(sourceGroup) {
		return {
			all:function () {
				return sourceGroup.all().map(function(d) {
					return {key:d.key,value:( (Math.abs(d.value)<1e-6) ? 0 : d.value )};
				});
			},
			top: function(n) {
				return sourceGroup.top(Infinity)
					.filter(function(d){
						return (Math.abs(d.value)>1e-6);
						})
					.slice(0, n);
			}
		};
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
		//document.getElementById("warning-msg").style.display=( (graph.displayInfo)?(''):('none') );
		document.getElementById("panel_swap").style.display=( (graph.displaySwapPanelButton)?(''):('none') );
	},
	changeCss: function(bt) {
		utils.cssDefault=!utils.cssDefault;
		document.getElementById('stylesheet_dark').href=((utils.cssDefault)?(''):('./css/dashboard-prodes-increase-dark.css'));
		bt.style.display='none';
		setTimeout(function(){bt.style.display='';},200);
	}
};

var graph={

	barAreaByYear: null,
	pieTotalizedByState: null,
	rowTop10ByMun: null,
	rowTop10ByUc: null,

	yearDimension: null,
	ufDimension: null,
	munDimension: null,
	ucDimension: null,
	yearAreaMunGroup: null,
	ufAreaMunGroup: null,
	ucAreaUcGroup: null,
	munAreaMunGroup: null,
	
	data:null,
	
	winWidth: window.innerWidth,
	winHeight: window.innerHeight,
	
	histogramColor: "#ffd700",
	darkHistogramColor: "#ffd700",
	pallet: ["#FF0000","#FF6A00","#FF8C00","#FFA500","#FFD700","#FFFF00","#DA70D6","#BA55D3","#7B68EE"],
	darkPallet: ["#FF0000","#FF6A00","#FF8C00","#FFA500","#FFD700","#FFFF00","#DA70D6","#BA55D3","#7B68EE"],
	barTop10Color: "#b8b8b8",
	darkBarTop10Color: "#c9c9c9",
	displayInfo: false,
	displaySwapPanelButton: false,
	
	loadConfigurations: function() {
		
		d3.json("config/config-increase.json", function(error, conf) {
			if (error) {
				console.log("Didn't load config file. Using default options.");
			}else {
				if(conf) {
					graph.pallet=conf.pallet?conf.pallet:graph.pallet;
					graph.darkPallet=conf.darkPallet?conf.darkPallet:graph.darkPallet;
					graph.histogramColor=conf.histogramColor?conf.histogramColor:graph.histogramColor;
					graph.darkHistogramColor=conf.darkHistogramColor?conf.darkHistogramColor:graph.darkHistogramColor;
					graph.barTop10Color=conf.barTop10Color?conf.barTop10Color:graph.barTop10Color;
					graph.darkBarTop10Color=conf.darkBarTop10Color?conf.darkBarTop10Color:graph.darkBarTop10Color;
					graph.displayInfo=conf.displayInfo?conf.displayInfo:graph.displayInfo;
					graph.displaySwapPanelButton=conf.displaySwapPanelButton?conf.displaySwapPanelButton:graph.displaySwapPanelButton;
				}
				utils.applyConfigurations();
			}
		});
		
	},
	setDimensions: function(dim) {
		this.winWidth=dim.w;
		this.winHeight=dim.h;
	},
	setChartReferencies: function() {
		
		this.barAreaByYear = dc.barChart("#chart-by-year");
		this.pieTotalizedByState = dc.pieChart("#chart-by-state");
		this.rowTop10ByMun = dc.rowChart("#chart-by-mun");
		this.rowTop10ByUc = dc.rowChart("#chart-by-uc");
	},
	loadData: function() {
		// Download the deforestation data from PRODES WFS service.
		// http://terrabrasilis.info/prodes-data/PRODES/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=PRODES:prodes_d&outputFormat=application%2Fjson
		d3.json("data/prodes.json", graph.processData);
	},
	processData: function(error, data) {
		if (error) throw error;
		
		var o=[];
		for (var j = 0, n = data.totalFeatures; j < n; ++j) {
			var fet=data.features[j];
			var uc=(fet.properties.j)?(fet.properties.j+"/"+fet.properties.h):(null)
			o.push({
				year:+fet.properties.g,
				aTotal:+fet.properties.d,
				aMun:+fet.properties.e,
				aUc:+fet.properties.f,
				uf:fet.properties.h,
				mun:fet.properties.i+"/"+fet.properties.h,
				uc:uc,
				cl:fet.properties.c
			});
		}
		data = o;
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
		this.munDimension = ndx.dimension(function(d) {
			return d.mun;
		});
		this.ucDimension = ndx.dimension(function(d) {
			return ((d.uc)?(d.uc):('null'));
		});
		
		this.yearAreaMunGroup = this.yearDimension.group().reduceSum(function(d) {
			return +d.aMun;
		});
		this.ufAreaMunGroup = this.ufDimension.group().reduceSum(function(d) {
			return +d.aMun;
		});
		this.ucAreaUcGroup = this.ucDimension.group().reduceSum(function(d) {
			return +d.aUc;
		});
		this.munAreaMunGroup = this.munDimension.group().reduceSum(function(d) {
			return +d.aMun;
		});
		
	},
	build: function() {
		var w=parseInt(this.winWidth - (this.winWidth * 0.05)),
		h=parseInt(this.winHeight * 0.3);
		
		this.setChartReferencies();
		
		var minWidth=250, maxWidth=600, fw=parseInt((w)/2),
		fh=parseInt((this.winHeight - h) * 0.5);
		// define min width to filter graphs
		fw=((fw<minWidth)?(minWidth):(fw));
		// define max width to filter graphs
		fw=((fw>maxWidth)?(maxWidth):(fw));
		
		// to single column in main container
		var chartByYear=document.getElementById('chart-by-year')
		if((chartByYear.clientWidth*2) > window.document.body.clientWidth) {
			fw = chartByYear.clientWidth;
		}

		utils.setTitle('year','Desmatamento Anual');
		
		this.barAreaByYear
			.height(fh)
			.width(fw)
			.yAxisLabel("Incremento no desmatamento (km²)")
			.xAxisLabel("Ano de apuração do desmatamento")
			.dimension(this.yearDimension)
			.group(utils.snapToZero(this.yearAreaMunGroup))
			.title(function(d) {
				return "Área: " + localeBR.numberFormat(',1f')(d.value.toFixed(2)) + " km²";
			})
			.label(function(d) {
				return localeBR.numberFormat(',1f')(Math.round(d.data.value)) + " km²";
			})
			.elasticY(true)
			.yAxisPadding('10%')
			.x(d3.scale.ordinal())
	        .xUnits(dc.units.ordinal)
	        .barPadding(0.2)
			.outerPadding(0.1)
			.renderHorizontalGridLines(true)
			.ordinalColors([(utils.cssDefault)?(graph.histogramColor):(graph.darkHistogramColor)]);

		this.barAreaByYear.margins().left += 30;
	
		utils.setTitle('state','Desmatamento Total por Estado');
		
		this.pieTotalizedByState
			.height(fh)
			.width(fw)
			.innerRadius(10)
			.externalRadiusPadding(30)
			.dimension(this.ufDimension)
			.group(this.ufAreaMunGroup)
			.title(function(d) {
				return "Estado: " + d.key + "\n" +
				"Área: " + localeBR.numberFormat(',1f')(d.value.toFixed(2)) + " km²";
			})
			.label(function(d) {
				var filters = graph.pieTotalizedByState.filters();
				var localized = false;
				
				for(var f = 0; f < filters.length; f++){
					if(filters[f] === d.key) localized = true; 
				}
				
				if(filters.length == 0){
					return d.key + ":" + localeBR.numberFormat(',1f')(Math.round(d.value)) + " km²";
				} else {
					return localized === true ? d.key + ":" + localeBR.numberFormat(',1f')(Math.round(d.value)) + " km²" : "";
				}
			})
			.ordinalColors((utils.cssDefault)?(graph.pallet):(graph.darkPallet))
			.legend(dc.legend());

		
		utils.setTitle('mun','Os 10 municípios com os piores índices de desmatamento');

		var barHeightAdjust=function (chart) {
			if(chart.data().length > 5){
				chart.fixedBarHeight(false);
			}else{
				chart.fixedBarHeight( parseInt((chart.effectiveHeight()*0.7)/10) );
			}
		};
		
		this.rowTop10ByMun
			.height(fh)
			.width(fw)
			.dimension(this.munDimension)
			.group(utils.snapToZero(this.munAreaMunGroup))
			.title(function(d) {
				return "Município/Estado: " + d.key + "\n" +
				"Área: " + localeBR.numberFormat(',1f')(d.value.toFixed(2)) + " km²";
			})
			.label(function(d) {
				return d.key + ": " + localeBR.numberFormat(',1f')(d.value.toFixed(2)) + " km²";;
			})
			.elasticX(true)
			.ordinalColors([(utils.cssDefault)?(graph.barTop10Color):(graph.darkBarTop10Color)])
			.ordering(function(d) {
				return d.value;
			})
			.controlsUseVisibility(true);
		
		this.rowTop10ByMun.data(function (group) {
			var fakeGroup=[];
			fakeGroup.push({key:'Sem valor',value:0});
			return (group.all().length>0)?(group.top(10)):(fakeGroup);
		});

		this.rowTop10ByMun.xAxis().tickFormat(function(d) {
			return d;
		}).ticks(5);

		this.rowTop10ByMun.on("preRedraw", barHeightAdjust);
		
		utils.setTitle('uc','As 10 Áreas de Proteção com os piores índices de desmatamento');

		this.rowTop10ByUc
			.height(fh)
			.width(fw)
			.dimension(this.ucDimension)
			.group(utils.snapToZero(this.ucAreaUcGroup))
			.title(function(d) {
				return "Área de Proteção/Estado: " + d.key + "\n" +
				"Área: " + localeBR.numberFormat(',1f')(d.value.toFixed(2)) + " km²";
			})
			.label(function(d) {
				return d.key + ": " + localeBR.numberFormat(',1f')(d.value.toFixed(2)) + " km²";
			})
			.elasticX(true)
			.ordinalColors([(utils.cssDefault)?(graph.barTop10Color):(graph.darkBarTop10Color)])
			.ordering(function(d) {
				return d.value;
			})
			.controlsUseVisibility(true);
		
		this.rowTop10ByUc.data(function (group) {
			var fakeGroup=[];
			fakeGroup.push({key:'Sem valor',value:0});
			return (group.all().length>0)?(group.top(10)):(fakeGroup);
		});
		
		this.rowTop10ByUc.on("preRedraw", barHeightAdjust);

		this.rowTop10ByUc.xAxis().tickFormat(function(d) {
			/*var t=d/1000;
			t=(t<1?d:t+"k");
			return t;*/
			return d;
		}).ticks(5);
		
		dc.renderAll();
		utils.addGenerationDate();
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
			graph.barAreaByYear.filterAll();
		}else if(who=='state'){
			graph.pieTotalizedByState.filterAll();
		}else if(who=='mun'){
			graph.rowTop10ByMun.filterAll();
		}else if(who=='uc'){
			graph.rowTop10ByUc.filterAll();
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
	    	graph.build();
	    });
		
		d3.select('#panel_swap')
	    .on('click', function() {
	    	window.location='?type=rates';
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