var isLoading = false;

$(document).ready(function () {
  var players = {};

	Tipped.create('.town', function (el) {
		return $(el).next('.townInfo').html();
	}, {
		cache: false,
		skin: 'light'
	});

  function loadColorPicker($el) {
    $el.spectrum({
      allowEmpty: true,
      showAlpha: true,
      showPalette: true
    });
  }

  function loadSelector($el) {
    $el.niceSelect();
  }

  $('.addAlly').on('click', function (e) {
    e.preventDefault();
    var $parent = $(this).prev('.ally'),
        $div = $($('#allyTemplate').html());
    $parent.after($div);
    loadSelector($div.find('select'));
    loadColorPicker($div.find('.color'));
  });

  $('.addPlayer').on('click', function (e) {
    e.preventDefault();
    var $parent = $(this).prev('.player'),
        $div = $($('#playerTemplate').html());
    $parent.after($div);
    loadAutoComplete($div.find('input.name'));
    loadColorPicker($div.find('.color'));
  });

  $('.optionsForm').on('submit', function (e) {
    e.preventDefault();

    var url = '/v1/api/search';
    
    $(this).find('.player .name').each(function () {
      $el = $(this);
      $el.attr('data-value', $el.val());
      $el.val(players[$el.val()]);
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
        top.location.href = '?q=' + response.id;
      }
    });

    return false;
  });

  function loadAutoComplete($el) {
    var options = {

      url: function(val) {
        return "/v1/api/" + server + "/autocomplete/players?input=" + encodeURI(val);
      },

      getValue: function(element) {
        if (!players[element.name]) {
          players[element.name] = element.id;
        }
        return element.name;
      },

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
  }

  loadSelector($('select'));
  loadAutoComplete($('.player .name'));
  loadColorPicker($('.color'));

});