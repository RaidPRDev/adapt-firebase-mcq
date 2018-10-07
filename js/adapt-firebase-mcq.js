define([
    'core/js/adapt',
    './firebaseMcqView',
    './firebaseMcqModel'
], function(Adapt, FirebaseMcqView, FirebaseMcqModel) {

    return Adapt.register("fb-social-mcq", {
        view: FirebaseMcqView,
        model: FirebaseMcqModel
    });

});
