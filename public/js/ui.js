function UI() {
  this.players = {};
  return this;
}

UI.prototype.loadColorPicker = function ($el) {
  $el.spectrum({
    allowEmpty: true,
    showAlpha: true,
    showPalette: true
  });
};

UI.prototype.loadSelector = function ($el) {
  // load select dropdown
  $el.niceSelect();
};

UI.prototype.loadAutoComplete = function ($el) {
  var options = {

    url: function(val) {
      return "/v1/api/" + server + "/autocomplete/players?input=" + encodeURI(val);
    },

    getValue: function(element) {
      if (!this.players[element.name]) {
        this.players[element.name] = element.id;
      }
      return element.name;
    }.bind(this),

    ajaxSettings: {
      dataType: "json",
      method: "GET",
      data: {
        dataType: "json"
      }
    },

    preparePostData: function(data) {
      data.phrase = $el.val();
      return data;
    },

    requestDelay: 400
  };

  $el.easyAutocomplete(options);
};

UI.prototype.addRemovePlayer = function ($parent) {
  var $delete = $("<a href='#' class='delete'>Remove Player</a>");

  $parent.append($delete);

  $delete.on('click', function (e) {
    e.preventDefault();
    $(this).closest('.player').remove();
  });
};
