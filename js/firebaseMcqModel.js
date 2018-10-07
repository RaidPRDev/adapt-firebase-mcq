define([
   '../../adapt-contrib-mcq/js/mcqModel'
], function(McqModel) {
    
    var FirebaseMcqModel = McqModel.extend({

        init: function() {
            McqModel.prototype.init.call(this);

			console.log("FirebaseMcqModel")
        }

    });

    return FirebaseMcqModel;

});
