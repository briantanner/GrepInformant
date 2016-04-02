(function(UI) {

  $(document).ready(function() {

    UI.loadSelector($('select'));
    
    // world selector
    $('.worldSelect').on('change', function() {
      var server = $(this).val();
      top.location.href = '/' + server;
    });

    // alliance selector
    $('.allySelect').on('change', function() {
      var id = $(this).val(),
          url = '/' + server + '/alliance/' + id + allyEndpoint || null;

      if ($(this).hasClass('static')) { return; }
      
      top.location.href = url;
    });

    $('.quadSelect').on('change', function() {
      var quad = $(this).val(),
          url = '/' + server + '/alliance/' + id + '/' + quad + '/' + ocean || null;
      top.location.href = url;
    });
    
    // player select
    UI.loadAutoComplete($('.player .name'));
    
  });


})(new UI());