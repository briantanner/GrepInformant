function App() {
  this.players = {};
  return this;
}

var Map = function (id) {
  this.stage = null;
  this.towns = {};
  this.selectedPlayers = [],
  this.tooltips = {};
  this.townsContainer = null;
  this.gridContainer = null;
  this.offset = 0;
  this.resize = false;
  this.options = {
    background: "/images/watertiles.png",
    townurl: "/v1/api/" + server + "/map",
    zoom: 2,
    id: id
  };

  return this;
};

Map.prototype.init = function (options) {
  if (options)
    this.options = $.extend(this.options, options);

  this.stage = new createjs.Stage('mapCanvas');
  this.stage.enableMouseOver();
  // this.stage.mouseMoveOutside = true; // keep tracking the mouse even when it leaves the canvas
  this.stage.regX = -0.5;
  this.stage.regY = -0.5;
  this.offset = -1 * ((1000 * this.options.zoom) - this.stage.canvas.width) / 2;
  
  this.preloadAssets(function () {
    this.addBackground();
    this.drawGrid();

    this.update();
  }.bind(this));

  this.getTowns(function (err, data) {
    if (err) { return this.showError(err); }
    this.drawTowns(data);
  }.bind(this));
};

Map.prototype.showError = function (err) {
  return;
};

Map.prototype.update = function () {
  if (this.gridContainer && this.resize) {
    this.gridContainer.x = this.offset;
    this.gridContainer.y = this.offset;
  }

  if (this.townsContainer && this.resize) {
    this.townsContainer.x = this.offset;
    this.townsContainer.y = this.offset;
  }
  
  this.resize = false;
  this.stage.update();
};

Map.prototype.preloadAssets = function (callback) {
  var manifest = [ { id: "background", src: this.options.background } ];

  this.queue = new createjs.LoadQueue(false);

  this.queue.on('progress', function (event) {
    // Nothing for now, maybe later...
  });
  
  this.queue.on("complete", function (event) {
    return callback();
  });
  
  this.queue.loadManifest(manifest);
  this.update();
};

Map.prototype.addBackground = function () {
  var background = this.background = new createjs.Shape(),
      bitmap = new Image();

  bitmap.src = this.queue.getResult("background").src;

  background.x = 0;
  background.y = 0;
  background.graphics.beginBitmapFill(bitmap, 'repeat').drawRect(0, 0, this.stage.canvas.width, this.stage.canvas.height);

  this.stage.addChild(background);
  this.update();
};

Map.prototype.drawText = function (container, text, style, color, x, y) {
  var text = new createjs.Text(text, style, color).set({ x: x, y: y });

  container.addChild(text);
};

Map.prototype.drawGrid = function () {
  var container = this.gridContainer = new createjs.Container(),
      num = "",
      spacing = 100 * this.options.zoom,
      textOffsetLeft = this.options.zoom,
      textOffsetRight = spacing - 20,
      canvasBottom = 1000 * this.options.zoom,
      line, text, bounds;

  // draw vertical lines
  for (var i = spacing; i < canvasBottom; i += spacing) {
    line = new createjs.Shape();
    container.addChild(line);
    line.graphics.setStrokeStyle(1).beginStroke("#FFF").moveTo(i,0).lineTo(i,canvasBottom).endStroke();
  }

  // draw horizontal lines
  for (var i = spacing; i < canvasBottom; i += spacing) {
    line = new createjs.Shape();
    container.addChild(line);
    line.graphics.setStrokeStyle(1).beginStroke("#FFF").moveTo(0,i).lineTo(canvasBottom,i).endStroke();
  }

  // draw ocean numbers
  for (var i = 0; i < 10; i++) {
    for (var n = 0; n < 10; n++) {
      num = n + "" + i;
      this.drawText(container, num, "14px Helvetica", "#fff", (spacing * parseInt(n,10) + textOffsetLeft),  (spacing * parseInt(i,10) + textOffsetLeft));
      this.drawText(container, num, "14px Helvetica", "#fff", (spacing * parseInt(n,10) + textOffsetRight), (spacing * parseInt(i,10) + textOffsetRight));
      this.drawText(container, num, "14px Helvetica", "#fff", (spacing * parseInt(n,10) + textOffsetRight), (spacing * parseInt(i,10) + textOffsetLeft));
      this.drawText(container, num, "14px Helvetica", "#fff", (spacing * parseInt(n,10) + textOffsetLeft),  (spacing * parseInt(i,10) + textOffsetRight));
    }
  }

  this.stage.addChild(container);
  // bounds = container.getBounds();
  // container.cache(0, 0, bounds.x, bounds.y);

  this.resize = true;
  this.update();
};

Map.prototype.drawTowns = function (data) {
  var townsContainer = this.townsContainer = new createjs.Container(),
      towns = data.towns,
      options = data.options,
      zoom = this.options.zoom;

  $.each(towns, function (i, group) {
    var container = new createjs.Container(),
        alpha = 1,
        color, colorMatch;

    if (i !== 0 && i !== "0") {
      color = group[0].color;
      if (color.indexOf('hsv') !== -1 || color.indexOf('rgb') !== -1) {
        colorMatch = color.replace(/%/g, '').match(/([\d\s\,\.]+)/g);
        colorMatch = colorMatch.shift().split(', ');
        alpha = (colorMatch.length === 4) ? colorMatch.pop() : 1;
      }
    }

    container.alpha = alpha;

    townsContainer.addChild(container);

    $.each(group, function (i, o) {
      var circle = new createjs.Shape(),
          color = (o.player !== 'ghost') ? o.color || "#FFF" : '#808080',
          radius = (o.points < 6000) ? (o.points < 2000) ? 3 : 4.5 : 5.5,
          alpha = 1,
          bounds;

      // convert hsva to hsla, set alpha for transparency
      if (color.indexOf('hsv') !== -1) {
        var colorMatch = color.replace(/%/g, '').match(/([\d\s\,\.]+)/g),
            colorMatch = colorMatch.shift().split(', '),
            hsl = HSVtoHSL(parseInt(colorMatch[0],10), parseInt(colorMatch[1],10), parseInt(colorMatch[2],10)),
            alpha = (colorMatch.length === 4) ? colorMatch.pop() : 1;
        
        color = "hsl(" + hsl.h + ", " + Math.round(hsl.s*100) + "%, " + Math.round(hsl.l*100) + "%)"
      
      } else if (color.indexOf('rgba') !== -1) {
        // set alpha for transparency
        var colorMatch = color.replace(/%/g, '').match(/([\d\s\,\.]+)/g),
            colorMatch = colorMatch.shift().split(', '),
            alpha = (colorMatch.length === 4) ? colorMatch.pop() : 1;

        color = "rgb(" + colorMatch.join(', ') + ")";
      }

      circle.graphics.setStrokeStyle(1).beginStroke('#333').beginFill(color).drawCircle(0,0,radius);
      circle.x = o.exactX * this.options.zoom;
      circle.y = o.exactY * this.options.zoom;

      circle.on('rollover', function (town, evt) {
        evt.target.scaleX = evt.target.scaleY = 1.2;
        this.drawTooltip(town, { x: evt.target.x, y: evt.target.y });
      }.bind(this, o));

      circle.on('rollout', function (town, evt) {
        evt.target.scaleX = evt.target.scaleY = 1;
        this.destroyTooltop(town);
        this.update();
      }.bind(this, o));

      // Add selected players outside of the alliance container
      if (this.selectedPlayers.indexOf(parseInt(o.playerid,10)) !== -1) {
        circle.alpha = alpha;
        this.stage.addChild(circle);
      } else {
        container.addChild(circle);
      }
    }.bind(this));

  }.bind(this));

  this.stage.addChild(townsContainer);
  this.resize = true;
  this.update();
};

Map.prototype.drawTooltip = function (town, coords) {
  var container = new createjs.Container(),
      txt = new createjs.Text("", "14px Helvetica", "#111");
  
  txt.text = town.name + "\n";
  txt.text += town.player + "\n";
  txt.text += town.points + " points";
      
  if (town.allyname)
    txt.text += "\n" + town.allyname;
  
  txt.lineWidth = 150;
  txt.lineHeight = 22;
  txt.textBaseline = "top";
  txt.textAlign = "left";
  
  var bounds = txt.getBounds(),
      tooltip = new createjs.Shape(),
      pad = 10;

  txt.x = coords.x;
  txt.y = coords.y - (bounds.height + pad * 2) - 10;

  container.addChild(txt);

  tooltip.graphics.setStrokeStyle(1)
      .beginStroke('#333')
      .beginFill("#ABC")
      .drawRect(txt.x - pad + bounds.x, txt.y - pad + bounds.y, bounds.width + pad * 2, bounds.height + pad * 2);
  
  container.addChildAt(tooltip, 0);

  this.tooltips[town.id] = container;
  this.stage.addChild(container);
  this.update();
};

Map.prototype.destroyTooltop = function (town) {
  var tooltip = this.tooltips[town.id];
  if (tooltip) {
    this.stage.removeChild(tooltip);
  }
  this.update();
};

Map.prototype.getTowns = function (callback) {

  $.ajax( {
    type: "GET",
    url: this.options.townurl,
    data: (this.options.id && this.options.id.length) ? { id: this.options.id } : null,
    error: function () {
      // need error handling
      return callback('Error');
    },
    success: function( response ) {
      var towns = {};

      $.each(response.towns, function (i, o) {
        if (!o.alliance)
          o.alliance = 0;
        if (!towns[o.alliance])
          towns[o.alliance] = [];
        towns[o.alliance].push(o);
      });

      response.towns = towns;

      return callback(null, response);
    }
  });
};

App.prototype.Map = Map;

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

App.prototype.UI = UI;

(function (App) {
  $(document).ready(function() {
    var Map = new App.Map(id),
        UI = new App.UI();

    Map.init();

    if (playersArray.length) {
      $.each(playersArray, function (i, o) {
        UI.players[o.name] = o.id;
        Map.selectedPlayers.push(parseInt(o.id,10));
      });
    }

    $('.addAlly').on('click', function (e) {
      e.preventDefault();
      var $parent = $(this).prev('.ally'),
          $div = $($('#allyTemplate').html());
      
      $parent.after($div);
      UI.loadSelector($div.find('select'));
      UI.loadColorPicker($div.find('.color'));
    });

    $('.addPlayer').on('click', function (e) {
      e.preventDefault();
      var $parent = $(this).prev('.player'),
          $div = $($('#playerTemplate').html());

      $parent.after($div);
      UI.loadAutoComplete($div.find('input.name'));
      UI.loadColorPicker($div.find('.color'));
      UI.addRemovePlayer($div);
    });

    $('.optionsForm').on('submit', function (e) {
      e.preventDefault();

      var url = '/v1/api/' + server + '/search';
      
      $(this).find('.player .name').each(function () {
        $el = $(this);
        $el.attr('data-value', $el.val());
        $el.val(UI.players[$el.val()]);
      });
      
      var data = $(this).serialize();
      
      $(this).find('.player .name').each(function () {
        $el = $(this);
        $el.val($el.attr('data-value'));
      });

      $.ajax( {
        type: "POST",
        url: url,
        data: data,
        success: function( response ) {
          top.location.href = "/v1/" + server + "/map/" + response.id;
        }
      });

      return false;
    });

    UI.loadSelector($('select'));
    UI.loadAutoComplete($('.player .name'));
    UI.loadColorPicker($('.color'));
    
    $('.player').each(function() {
      UI.addRemovePlayer($(this));
    });
  });
})(new App());

/*
 * http://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately */
function HSVtoHSL(h, s, v) {
    // convert to decimals rounded to the hundredth
    if (s > 1) { s = Math.ceil((s/100) *100) / 100; }
    if (v > 1) { v = Math.ceil((v/100) *100) / 100; }

    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }

    var _h = h,
        _s = s * v,
        _l = (2 - s) * v;

    _s /= (_l <= 1) ? _l : 2 - _l;
    _l /= 2;

    return {
        h: _h,
        s: _s,
        l: _l
    };
}