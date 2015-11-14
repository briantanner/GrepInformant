$(document).ready(function () {
	Tipped.create('.town', function (el) {
		return $(el).next('.townInfo').html();
	}, {
		cache: false,
		skin: 'light'
	});
});