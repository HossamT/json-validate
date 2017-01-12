function validator(jsSchema){

	var self = this;
	var errors = [];
	var errUtil = new Detections(errors);

	this.clear = function () {
		errors.length = 0;
    };

	// Helper for creating error messages
    function Detections(list) {
        this.keyNotFound = function (k) {
            list.push(k+" Not Defined");
        };
        this.specErrorTNDEF = function (k) {
			list.push(k+" Type not defined in spec");
        };
        this.null = function (k) {
            list.push(k+" Can't be null");
        };
        this.unvalidType = function (k,exp,act) {
            list.push(k+" is expected to be "+exp+" but "+act+" was found");
        };
        this.strMin = function(k,length,min){
            list.push(k+" is expected to have atleast "+min+" characters but "+length+" were found");
		};
        this.strMax = function(k,length,max){
            list.push(k+" is expected to have maximum "+max+" characters but "+length+" were found");
        };
        this.strEnum = function(k,str){
            list.push("The value "+str+" of "+k+" is not recognized");
        };
        this.nbMin = function(k,nb,min){
            list.push(k+" is expected to be higher than "+min+" but "+nb+" was found");
        };
        this.nbMax = function(k,nb,max){
            list.push(k+" is expected to be less than "+max+" but "+nb+" was found");
        };
        this.arrMin = function(k,length,min){
            list.push(k+" must have at least "+min+" element but "+length+" was found");
		};
        this.arrMax = function(k,length,max){
            list.push(k+" must have at most "+max+" element but "+length+" was found");
        };
    }

    // Return the type ID of an element
	this.typeID = function(x){
        var t = typeof x;
        if(t === 'string') 			return 'S';
        if(t === 'number') 			return 'N';
		if(t === 'object'){
			if(t === null)			return null;
            if(Array.isArray(t)) 	return 'A';
            else 					return 'O';
        }
        if(t === 'boolean') 		return 'B';
		if(t === 'undefined') 		return 'U';
		return 'X';
    };

    // Return the name of a type from its ID
	this.typeName = function (str) {
        if(str === 'S') return "String";
        if(str === 'N') return "Number";
        if(str === 'O') return "Object";
        if(str === 'A') return "Array";
        if(str === 'B') return "Boolean";
        return "Undefined";
    };

    // Get the definition of a type from its name
	this.getTypeDef = function (name) {
        return jsSchema.types[name];
    };

	// Return the base type of a model element
    this.baseType = function(model){
        if(model.hasOwnProperty("type")){
            return model.type.id;
        }
        else if(model.hasOwnProperty("typeRef")){
			return self.baseType(self.getTypeDef(model.typeRef));
        }
        else
        	return 'NDEF';
    };

    this.loopThru = function (jsObj,model) {
        for(var element in model){
            if(model.hasOwnProperty(element)){
                var e = model[element];
                var obj  = jsObj[e.key];
                var type = self.typeID(obj);
                self.checkType(type,e,obj);
            }
        }
    };

    // Validates a JSON document (from root)
	this.validateDocument = function (doc) {
        self.clear();
		self.loopThru(doc,jsSchema.root);
        return errors;
    };

    this.checkType = function (obj,type,e) {
		var bt = self.baseType(e);
		if(bt === 'NDEF'){
            errUtil.specErrorTNDEF(e.key);
		}
		else if(type === 'U' && !e.usage === 'O'){
            errUtil.keyNotFound(e.key);
		}
		else if(type === null && !e.usage.endsWith("N")){
			errUtil.null(e.key);
		}
		else if(type !== bt){
			errUtil.unvalidType(e.key,self.typeName(bt),self.typeName(type));
		}
		else {
			self.routeCheck(bt,obj,e);
		}
    };

    this.routeCheck = function (type,obj,e) {
        if(type === 'S') return self.checkString(obj,e);
        if(type === 'N') return self.checkNumber(obj,e);
        if(type === 'O') return self.checkObject(obj,e);
        if(type === 'A') return self.checkArray(obj,e);
    };

    this.getType = function (model) {
		if(model.hasOwnProperty("type")){
			return model.type;
		}
		else if(model.hasOwnProperty("typeRef")){
			return self.getTypeDef(model.typeRef);
		}
    };

    this.checkString = function (obj,e) {
		var type = self.getType(e);
		var options = type.options;
		if(options){
			if(options.hasOwnProperty("min") && obj.length < options.min){
				errUtil.strMin(e.key,obj.length,options.min);
			}
            if(options.hasOwnProperty("max") && obj.length > options.max){
                errUtil.strMax(e.key,obj.length,options.min);
            }
            if(options.hasOwnProperty("enum") && options.enum.indexOf(obj) === -1){
                errUtil.strEnum(e.key,obj);
			}
		}
    };

    this.checkNumber = function (obj,e) {
        var type = self.getType(e);
        var options = type.options;
        if(options){
            if(options.hasOwnProperty("min") && obj < options.min){
                errUtil.nbMin(e.key,obj,options.min);
            }
            if(options.hasOwnProperty("max") && obj > options.max){
                errUtil.nbMax(e.key,obj,options.min);
            }
        }
    };

    this.checkObject = function (obj,e) {
        var type = self.getType(e);
        var model = type.model;
        if(model){
            self.loopThru(obj,model);
        }
    };

    this.checkArray = function (obj,e) {
        var type = self.getType(e);
        var options = type.options;
        var model = type.model;
        if(options){
            if(options.hasOwnProperty("minSize") && obj.length < options.minSize){
                errUtil.arrMin(e.key,obj.length,options.min);
            }
            if(options.hasOwnProperty("maxSize") && obj.length > options.maxSize){
                errUtil.arrMax(e.key,obj.length,options.min);
            }
        }
        if(model){
            var elmBaseType = self.baseType(model);
            for(var i in obj){
                var elm = obj[i];
                self.routeCheck(elmBaseType,elm,model);
            }
        }

    };
}


var ab = {
	name : "My Book",
	contacts : [
		{
			id : 1,
			name : "Hossam",
			address : "hossam.tamri@telecomnancy.net",
			type : "A",
			actif : true
		}
	]
};

var schema = {

	root : [
		{
			key : "name",
			typeRef : "myStr",
			usage : "R"
		},
        {
            key : "contacts",
            typeRef : "contacts",
            usage : "RN"
        }
	],
	types : {

		myStr : {
			id : "S",
			options : {
				min : 5,
				max : 20
			}
		},

		idType : {
    		id : "N",
        	options : {
    			min : 0
			}
		},

		addressType : {
			id : "S",
			options : {
				length : 1,
				enum : ["A", "B", "C"]
			}
		},

		contacts : {
			id : "A",
			options : {
				minSize : 1
			},
            model : {
					typeRef : "contact"
            }
		},

		contact : {
			id : "O",
			model : [
                {
                    key : "id",
                    typeRef : "idType",
                    usage : "O"
                },
                {
                    key : "name",
                    typeRef : "myStr",
                    usage : "R"
                },
                {
                    key : "address",
                    typeRef : "myStr",
                    usage : "R"
                },
                {
                    key : "type",
                    typeRef : "addressType",
                    usage : "R"
                },
                {
                    key : "actif",
                    type : {
                    	id : "B"
					},
                    usage : "R"
                }
            ]
		}

	}
};