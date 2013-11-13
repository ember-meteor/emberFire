"use strict";

var EmberFire = Ember.Namespace.create();

EmberFire.coerce = function(snapshot) {
  var object = snapshot.val(),
      ref    = snapshot.ref(),
      type   = object._type;

  switch (type) {
  case "object":
    object = EmberFire.Object.create({ ref: ref });
    break;
  case "array":
    object = EmberFire.Array.create({ ref: ref });
    break;
  case "objectArray":
    object = EmberFire.ObjectArray.create({ ref: ref });
    break;
  }

  return object;
};

EmberFire.ObjectMixin = Ember.Mixin.create({
  type: null,

  init: function() {
    this.ref.child("_type").set(this.type);

    this.ref.on("child_added", function(snapshot) {
      if (snapshot.name() != "_type") {
        this.childAdded(snapshot);
      }
    }, this);

    this.ref.on("child_removed", function(snapshot) {
      if (snapshot.name() != "_type") {
        this.childRemoved(snapshot);
      }
    }, this);

    this.ref.on("child_changed", function(snapshot) {
      if (snapshot.name() != "_type") {
        this.childChanged(snapshot);
      }
    }, this);

    this.ref.on("value", function(snapshot) {
      if (snapshot.name() != "_type") {
        this.valueChanged(snapshot);
      }
    }, this);

    this._super();
  },

  childAdded: function(){
  },

  childChanged: function(){
  },

  childRemoved: function(){
  },

  valueChanged: function(){
  },

  willDestroy: function() {
    this.ref.off();
  }
});

EmberFire.Object = Ember.ObjectProxy.extend(EmberFire.ObjectMixin, {
  type: "object",
  ref: null,

  init: function() {
    this.set("content", {});

    this._super();
  },

  valueChanged: function(snapshot){
    this.set("content", snapshot.val());
  },

  toJSON: function() {
    var json = {},
        object = this.get("content");

    for (var key in object) {
      json[key] = Ember.get(object, key);
    }

    json._type = "object";
    return json;
  },

  setUnknownProperty: function(key, value) {
    this.ref.child(key).set(value);
    return this._super(key, value);
  }
});

EmberFire.Array = Ember.ArrayProxy.extend(EmberFire.ObjectMixin, {
  type: "array",

  coerceChild: EmberFire.coerce,

  init: function() {
    this._array = Ember.A([]);
    this._index = Ember.A([]);
    this.set("content", this._array);
    this._super();
  },

  childAdded: function(snapshot) {
    var object = this.coerceChild(snapshot),
        key    = snapshot.name();

    this._index.pushObject(key);
    this._array.pushObject(object);
  },

  childRemoved: function(snapshot) {
    var idx = this._index.indexOf(snapshot.name());
    this._index.removeAt(idx);
    this._array.removeAt(idx);
  },

  childChanged: function(snapshot) {
    var idx      = this._index.indexOf(snapshot.name()),
        existing = this._array.objectAt(idx),
        isObject = (existing instanceof EmberFire.Object);

    if (!isObject) {
      var object = this.coerceChild(snapshot);
      this._array.replace(idx, 1, [object]);
    }
  },

  replaceContent: function(idx, amt, objects) {
    for (var i = 0; i < amt; i++) {
      var key = this._index[idx+i];
      this.ref.child(key).remove();
    }
    objects.forEach(function(object) {
      var val = object;
      if (object.toJSON) {
        val = object.toJSON();
      }
      return this.ref.push(val).name();
    }, this);
  },

  toJSON: function() {
    var json = {},
        values = this.get("content");

    for (var i = 0; i < this._index.length; i++) {
      json[this._index[i]] = values[i];
    }

    json._type = this.type;
    return json;
  }
});

EmberFire.ObjectArray = EmberFire.Array.extend({
  type: "objectArray",

  coerceChild: function(snapshot) {
    return EmberFire.Object.create({ ref: snapshot.ref() });
  }
});
