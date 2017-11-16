var Lang={
	language:undefined,
	init:function() {
		this.language=this.getFromLocalStorage();
		if(!this.language) {
			this.language='pt-br';
		}
	},
	highlightFlag:function() {
		var f;
		for (i in this.languages) {
			f=this.getObj('flag-'+this.languages[i]);
			if(!f) break;
			f.style.border='none';
			f.style.borderRadius='50%';
		}
		f=this.getObj('flag-'+this.language);
		if(!f) return;
		f.style.border='2px solid white';
		f.style.borderRadius='unset';
	},
	change:function(l, callback) {
		if(l!==undefined && Translation[l]) {
			this.language=l;
		}
		this.apply();
		if(callback) callback();
	},
	setInLocalStorage:function() {
		if (typeof(Storage) !== "undefined") {
			localStorage.setItem("langcode", this.language);
		} else {
		    console.log("Sorry! No Web Storage support..");
		}
	},
	getFromLocalStorage:function() {
		if (typeof(Storage) !== "undefined") {
			var langcode=localStorage.getItem("langcode");
			if(!langcode) {
				langcode = this.language;
			}
		}else {
		    console.log("Sorry! No Web Storage support..");
		}
		return langcode;
	},
	getObj:function(id) {
		return document.getElementById(id);
	},
	apply:function() {
		this.setInLocalStorage();
		this.highlightFlag();
		var obj=Translation[this.language];
		for (var property in obj) {
		    if (obj.hasOwnProperty(property)) {
		    	var o=this.getObj(property);
		    	if(o){
		    		if(o.title!==""){
		    			o.title=obj[property];
		    		}else{
		    			o.innerHTML=obj[property];
		    		}
		    	}
		    }
		}
	},
	languages:['pt-br','en','es']
};