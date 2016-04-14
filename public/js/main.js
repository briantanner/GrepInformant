(function(UI) {

  $(document).ready(function() {

    $('.quadSelect').on('change', function() {
      var quad = $(this).val(),
          url = '/' + server + '/alliance/' + id + '/' + quad + '/' + ocean || null;
      top.location.href = url;
    });
    
    // player select
    UI.loadAutoComplete($('.player .name'));
    
  });


})(new UI());