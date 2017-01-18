(function () {
    function Validator(jsSchema,detectionHandler){

        var self = this;
        var errors = [];
        var errUtil = (typeof detectionHandler === 'undefined') ? new Detections() : detectionHandler;
        var idList = [];
        var excluded = jsSchema.hasOwnProperty("config") ? jsSchema.config.hasOwnProperty("turnOff") ? jsSchema.config.turnOff : [] : [];
        var ids = jsSchema.hasOwnProperty("config") ? jsSchema.config.hasOwnProperty("ids") ? jsSchema.config.ids.hasOwnProperty("active") ? jsSchema.config.ids.active : false : false : false;
        var separator = ids ? jsSchema.config.ids.hasOwnProperty("separator") ? jsSchema.config.ids.separator : "" : "";


        this.clear = function () {
            errors.length = 0;
            idList.length = 0;
        };

        // Helper for creating error messages
        function Detections() {
            this.keyNotFound = function (k) {
                return k+" not Defined";
            };
            this.specErrorTypeNotDEF = function (k) {
                return k+" type not defined in spec";
            };
            this.unexpected = function (k) {
                return k+" is unexpected";
            };
            this.nullNotAllowed = function (k) {
                return k+" can't be null";
            };
            this.unvalidType = function (k,exp,act) {
                return k+" is expected to be "+exp+" but "+act+" was found";
            };
            this.strMin = function(k,length,min){
                return k+" is expected to have atleast "+min+" characters but "+length+" were found";
            };
            this.strMax = function(k,length,max){
                return k+" is expected to have maximum "+max+" characters but "+length+" were found";
            };
            this.strEnum = function(k,str){
                return "The value "+str+" of "+k+" is not recognized";
            };
            this.strRegExp = function(k,value){
                return "The value "+value+" in field "+k+" is invalid";
            };
            this.nbMin = function(k,nb,min){
                return k+" is expected to be higher than "+min+" but "+nb+" was found";
            };
            this.nbMax = function(k,nb,max){
                return k+" is expected to be less than "+max+" but "+nb+" was found";
            };
            this.arrMin = function(k,length,min){
                return k+" must have at least "+min+" element but "+length+" was found";
            };
            this.arrMax = function(k,length,max){
                return k+" must have at most "+max+" element but "+length+" was found";
            };
        }

        //Resolve error type and params into error object in the list
        this.resolve = function (fctName,id) {
            if(~excluded.indexOf(fctName)){
                return;
            }

            var errobj = {
                message : "",
                category : fctName,
            };

            if(ids){
                errobj.id = idList.join(separator)+id;
            }

            if(arguments.length === 3){
                errobj.message = errUtil[fctName](arguments[2]);
            }
            else if(arguments.length === 4){
                errobj.message = errUtil[fctName](arguments[2],arguments[3]);

            }
            else if(arguments.length === 5){
                errobj.message = errUtil[fctName](arguments[2],arguments[3],arguments[4]);
            }

            errors.push(errobj);
        };

        // Return the type ID of an element
        this.typeID = function(x){
            var t = typeof x;
            if(t === 'string') 			return 'S';
            if(t === 'number') 			return 'N';
            if(t === 'object'){
                if(x === null)			return null;
                if(Array.isArray(x)) 	return 'A';
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
                return self.getTypeDef(model.typeRef).id;
            }
            else
                return 'NDEF';
        };

        this.loopThru = function (jsObj,model) {
            if(jsObj){
                var list = [];
                for(var element in model){
                    if(model.hasOwnProperty(element)){
                        var e = model[element];
                        var obj  = jsObj[e.key];
                        list.push(e.key);
                        var type = self.typeID(obj);
                        var bType = self.baseType(e);
                        if(self.checkType(bType,type,e)){
                            self.routeCheck(jsObj,bType,obj,e);
                        }
                    }
                }
                for(var k in jsObj){
                    if(list.indexOf(k) === -1 && jsObj.hasOwnProperty(k)){
                        self.resolve("unexpected",e.id,k);
                    }
                }
            }
        };

        // Validates a JSON document (from root)
        this.validateDocument = function (doc) {
            self.clear();
            this.doc = doc;
            self.loopThru(doc,jsSchema.root);
            return errors;
        };

        this.checkType = function (bt,type,e) {
            if(bt === 'NDEF'){
                self.resolve("specErrorTypeNotDEF",e.id,e.name);
            }
            else if(type === 'U' && e.usage !== 'O'){
                self.resolve("keyNotFound",e.id,e.name);
            }
            else if(type === null && !e.usage.endsWith("N")){
                self.resolve("nullNotAllowed",e.id,e.name);
            }
            else if(type !== null && type !== bt){
                self.resolve("unvalidType",e.id,e.name,self.typeName(bt),self.typeName(type));
            }
            else {
                return true;
            }
            return false;
        };


        this.routeCheck = function (parent,type,obj,e) {
            if(type === 'S') self.checkString(obj,e);
            if(type === 'N') self.checkNumber(obj,e);
            if(type === 'O') self.checkObject(obj,e);
            if(type === 'A') self.checkArray(obj,e);

            if(e.hasOwnProperty("custom")){
                var str = e.custom(self.doc,parent,obj);
                if(str !== null){
                    errors.push(str);
                }
            }
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
                    self.resolve("strMin",e.id,e.name,obj.length,options.min);
                }
                if(options.hasOwnProperty("max") && obj.length > options.max){
                    self.resolve("strMax",e.id,e.name,obj.length,options.max);
                }
                if(options.hasOwnProperty("enum") && options.enum.indexOf(obj) === -1){
                    self.resolve("strEnum",e.id,e.name,obj);
                }
                if(options.hasOwnProperty("regexp") && !(new RegExp(options.regexp)).test(obj)){
                    self.resolve("strRegExp",e.id,e.name,obj,options.regexp);
                }
            }
        };

        this.checkNumber = function (obj,e) {
            var type = self.getType(e);
            var options = type.options;
            if(options){
                if(options.hasOwnProperty("min") && obj < options.min){
                    self.resolve("nbMin",e.id,e.name,obj,options.min);
                }
                if(options.hasOwnProperty("max") && obj > options.max){
                    self.resolve("nbMax",e.id,e.name,obj,options.min);
                }
            }
        };

        this.checkObject = function (obj,e) {
            var type = self.getType(e);
            var model = type.model;
            idList.push(e.id);
            if(model){
                self.loopThru(obj,model);
            }
            idList.pop();
        };

        this.checkArray = function (obj,e) {
            var type = self.getType(e);
            var options = type.options;
            var model = type.model;
            if(options){
                if(options.hasOwnProperty("minSize") && obj.length < options.minSize){
                    self.resolve("arrMin",e.id,e.name,obj.length,options.min);
                }
                if(options.hasOwnProperty("maxSize") && obj.length > options.maxSize){
                    self.resolve("arrMax",e.id,e.name,obj.length,options.min);
                }
            }
            if(model){
                var elmBaseType = self.baseType(model);
                idList.push(e.id);
                for(var i in obj){
                    var elm = obj[i];
                    idList.push(i);
                    self.routeCheck(obj,elmBaseType,elm,model);
                    idList.pop();
                }
                idList.pop();
            }

        };
    }

    // Example Object
    var ab = {
        name : "My Book",
        contacts : [
            {
                id : 1,
                name : "Hossam",
                address : "hossam.tamri@telecomnancy.net",
                type : "I",
                actif : false
            }
        ]
    };

    // Example Schema
    var schema = {
        config : {
            turnOff : ["strRegExp"],
            ids : {
                active : true,
                separator : "-"
            }
        },
        root : [
            {
                name : "Address Book Name",
                key : "name",
                id : "abName",
                typeRef : "myStr",
                usage : "R"
            },
            {
                name : "Contacts List",
                key : "contacts",
                id : "ctL",
                typeRef : "contacts",
                usage : "RN"
            }
        ],
        types : {

            myStr : {
                id : "S",
                options : {
                    min : 5,
                    max : 10
                }
            },

            email : {
                id : "S",
                options : {
                    min : 6,
                    max : 40,
                    regexp : "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
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
                    enum : ["A", "I"]
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
                        name : "Contact ID",
                        key : "id",
                        id : "cId",
                        typeRef : "idType",
                        usage : "O"
                    },
                    {
                        name : "Contact Name",
                        id : "cName",
                        key : "name",
                        typeRef : "myStr",
                        usage : "R"
                    },
                    {
                        name : "Contact Address",
                        id : "cAddr",
                        key : "address",
                        typeRef : "email",
                        usage : "R"
                    },
                    {
                        name : "Address Type",
                        key : "type",
                        id : "cAddrT",
                        typeRef : "addressType",
                        usage : "R",
                        custom : function (doc,parent,elm) {
                            if(parent.hasOwnProperty("actif")){
                                if(parent.actif === true && elm !== 'A'){
                                    return "If the address is active, the address type must be A";
                                }
                                else if(parent.actif === false && elm !== 'I'){
                                    return "If the address is inactive, the address type must be I";
                                }
                            }
                            return null;
                        }
                    },
                    {
                        name : "Active Boolean",
                        key : "actif",
                        id : "cAct",
                        type : {
                            id : "B"
                        },
                        usage : "R"
                    }
                ]
            }

        }
    };

    // Example Error Handler
    function ErrorMessages() {
        this.keyNotFound = function (k) {
            return k+" is not Defined";
        };
        this.specErrorTypeNotDEF = function (k) {
            return k+" type not defined in spec";
        };
        this.nullNotAllowed = function (k) {
            return k+" can't be null";
        };
        this.unvalidType = function (k,exp,act) {
            return k+" is expected to be "+exp+" but "+act+" was found";
        };
        this.strMin = function(k,length,min){
            return k+" is expected to have atleast "+min+" characters but "+length+" were found";
        };
        this.strMax = function(k,length,max){
            return k+" is expected to have maximum "+max+" characters but "+length+" were found";
        };
        this.strEnum = function(k,str){
            return "The value "+str+" of "+k+" is not recognized";
        };
        this.strRegExp = function(k,value){
            return "The value "+value+" in field "+k+" is invalid x";
        };
        this.nbMin = function(k,nb,min){
            return k+" is expected to be higher than "+min+" but "+nb+" was found";
        };
        this.nbMax = function(k,nb,max){
            return k+" is expected to be less than "+max+" but "+nb+" was found";
        };
        this.arrMin = function(k,length,min){
            return k+" must have at least "+min+" element but "+length+" was found";
        };
        this.arrMax = function(k,length,max){
            return k+" must have at most "+max+" element but "+length+" was found";
        };
    }

    // Example Usage
    var validation = new Validator(schema);
    var errors = validation.validateDocument(ab);
})();

