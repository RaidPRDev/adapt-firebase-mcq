define([
   '../../adapt-contrib-mcq/js/mcqModel'
], function(McqModel) {
    
    var FirebaseMcqModel = McqModel.extend({

        init: function() {
            McqModel.prototype.init.call(this);

			this.set("_showUpdate", false);
        },
		
		restoreUserAnswers: function() {
            
			// console.log("FirebaseMcqModel.restoreUserAnswers");
			
			if (!this.get('_isSubmitted')) return;
            
			let selectedItems = [];
            let items = this.get('_items');
            let userAnswer = this.get('_userAnswer');
            _.each(items, function(item, index) {
                item._isSelected = userAnswer[item._index];
                if (item._isSelected) {
                    selectedItems.push(item);
                }
            });
			
            this.set('_selectedItems', selectedItems);
            
			this.setQuestionAsSubmitted();
        }

    });

    return FirebaseMcqModel;

});
