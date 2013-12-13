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

EmberFire.ObjectMixin = Ember.Mixin.create(Ember.Evented, {
  type: null,
  typeKey: "_type",

  init: function() {
    this.ref.child(this.typeKey).set(this.type);

    this.ref.on("child_added", this.onAdded, this);
    this.ref.on("child_changed", this.onChanged, this);
    this.ref.on("child_removed", this.onRemoved, this);
    this.ref.on("value", this.onValue, this);

    this._super();
  },

  willDestroy: function() {
    this.ref.off("child_added", this.onAdded, this);
    this.ref.off("child_changed", this.onChanged, this);
    this.ref.off("child_removed", this.onRemoved, this);
    this.ref.off("value", this.onValue, this);
  },

  onAdded: function(snapshot) {
    if (snapshot.name() != this.typeKey) {
      this.trigger('added', snapshot);
      this.childAdded(snapshot);
    }
  },

  onChanged: function(snapshot) {
    if (snapshot.name() != this.typeKey) {
      this.trigger('changed', snapshot);
      this.childRemoved(snapshot);
    }
  },

  onRemoved: function(snapshot) {
    if (snapshot.name() != this.typeKey) {
      this.trigger('removed', snapshot);
      this.childChanged(snapshot);
    }
  },

  onValue: function(snapshot) {
    if (snapshot.name() != this.typeKey) {
      this.trigger('value', snapshot);
      this.valueChanged(snapshot);
    }
  },

  childAdded: function(){ },

  childChanged: function(){ },

  childRemoved: function(){ },

  valueChanged: function(){ }
});

EmberFire.Object = Ember.ObjectProxy.extend(EmberFire.ObjectMixin, {
  type: "object",
  ref: null,

  init: function() {
    Ember.set(this, 'content', { });

    this._super();
  },

  valueChanged: function(snapshot){
    Ember.set(this, 'content', snapshot.val());
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

  set: function(key, value, callback) {
    key = key.replace(/\./g, '/');
    this.ref.child(key).set(value, function(error) {
      if(callback) {
        callback(error, key, value);
      } else if(error) {
        throw error;
      }
    });
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
