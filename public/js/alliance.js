
// intel handler
function bindHandler($el) {
  $el.on('change', function () {
    var town = $(this).attr('data-value'),
        intel = $(this).val(),
        url = '/api/v1/' + server + '/town/' + town + '/intel',
        data = { intel: intel };

    $.ajax({
      type: "POST",
      url: url,
      data: data,
      success: function( response ) {
        // TODO: Show checkmark on success.
      }
    });
  });
}

// intel selectors
function loadSelectors($el, id) {
  $elSelectors = $('#towns-' + id).find('.intel-selector-row');

  $.each($elSelectors, function (i, wrapper) {
    var id = $(wrapper).attr('data-id'),
        intel = $(wrapper).attr('data-value') || null,
        $selector = $($('#intelSelect').html());

    if ($(wrapper).hasClass('hasSelector')) {
      return;
    }

    // add class to prevent selector duplication
    $(wrapper).addClass('hasSelector');
    
    $(wrapper).append($selector);
    $selector.attr('data-value', id);
    $selector.find('option').each(function () {
      if (this.value === intel) {
        $(this).attr('selected', 'selected');
      }
    });

    // bind on change event
    bindHandler($selector);

    $selector.css('display', 'block');
  });
}

(function (UI) {
  
  $(document).ready(function() {
    var ctrlDown = false,
        ctrlKeys = [17,91,93],
        cKey = 67

    $('.show-towns').on('click', function (e) {
      var $el = $(this),
          id = $(this).attr('data-value');

      e.preventDefault();

      $('.player-towns').hide();
      $('.plaintext').show();
      $('.bbtable').hide();

      if ($('.intel-selector-row')) {
        loadSelectors($el, id);
      }
      
      $('#towns-' + id).toggle();
    });

    $('.bbtoggle').on('click', function (e) {
      e.preventDefault();

      $('.plaintext').toggle();
      $('.bbcode').toggle();
      $('.bbtable').toggle();
    });

    $('.change-ocean').on('click', function (e) {
      var ocean = $(this).prev().val();
      top.location.href = '/{{server}}/alliance/{{alliance.id}}/{{quad}}/' + ocean;
    });

    $('.add-ally').on('click', function (e) {
      e.preventDefault();

      var $parent = $(this).parent().find('form'),
          $div = $($('#allyTemplate').html());

      console.log($parent);
      console.log($div);
      
      $parent.find('.search-btn').before($div);
      UI.loadSelector($div.find('select'));
    });

    $('#allyForm .search-btn').on('click', function (e) {
      var vals = $(this).parent().find('select.allySelect').map(function (i, o) { return $(o).val(); }).toArray(),
          url = '/' + server + '/alliance/' + id + allyEndpoint + '?alliances=' + vals.join(',');

      top.location.href = url;
      
      e.preventDefault();
    });

    $('.codearea')
    .mouseup(function(e){
        // fixes safari/chrome problem
        e.preventDefault();
    })
    .focus(function(e){
        $(this).select();
    })
    .click(function(e){
        $(this).select();
    })
    .keydown(function (e) {
      if (ctrlKeys.indexOf(e.keyCode) !== -1)
        ctrlDown = true;
      
      if (!ctrlDown) {
        console.log('!ctrlDown')
        e.preventDefault();
        return false;
      }

      if (e.keyCode !== cKey) {
        console.log('!cKey')
        e.preventDefault();
        return false;
      }

    })
    .keyup(function (e) {
      if (ctrlKeys.indexOf(e.keyCode) !== -1)
        ctrlDown = false;
      // e.preventDefault();
    });
  });

})(new UI());