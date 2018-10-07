define([
	'core/js/adapt',
	'../../adapt-contrib-mcq/js/mcqView',
	'../libraries/Chart'
], function(Adapt, McqView) {

    var FirebaseMcqView = McqView.extend({

		events: {
            'click .fb-social-mcq-item label': 'onItemSelected',
            'keyup .fb-social-mcq-item input': 'onKeyPress',
        },
		
		onFirebaseError: function()
        {
            var msg = "Firebase Extension is not enabled. Please add '_firebase._isEnabled' to course.json";

            try {
                throw new Error(msg);
            } catch(e) {
                console.error(e.name, e.message);
            }
        },
		
		initialize: function(){

            this.isFirebaseEnabled = (Adapt.firebase != undefined);

            console.log("SocialMCQ.initialize().fb:", this.isFirebaseEnabled);
            console.log("SocialMCQ.initialize().chartExists:", (Chart != null));

            if (this.isFirebaseEnabled )
            {
                if (!Adapt.firebase.user)
                {
                    this.listenTo(Adapt, {
                        'firebase:signedin': this.onFirebaseSignedIn
                    });
                }
            }

            McqView.prototype.initialize.apply(this, arguments);
        },
		
		// Calls default methods to setup after the question is rendered
        postRender: function() {

            console.log("SocialMCQ.postRender().fb:", this.isFirebaseEnabled);

            if (this.isFirebaseEnabled )
            {
                if (Adapt.firebase.user)
                {
                    this.onFirebaseSignedIn({success:true});
                }
            }
            else this.onFirebaseSignedIn({success:false});
        },

        onFirebaseSignedIn: function(result) {

            console.log("SocialMCQ.onFirebaseSignedIn.success:", result.success);

            McqView.prototype.postRender.apply(this, arguments);
        },
		
		onSubmitClicked: function() {
            
			console.log("FirebaseMcqView.onSubmitClicked()");
			
			if (!this.canSubmit()) {
                this.showInstructionError();
                this.onCannotSubmit();
                return;
            }
			
			this.sendForm();
			
            this.updateAttempts();
            this.setQuestionAsSubmitted();
            this.removeInstructionError();
            this.storeUserAnswer();
            this.checkQuestionCompletion();
            this.recordInteraction();
        },
		
		sendForm: function() {
            
			console.log("FirebaseMcqView.sendForm()");
			
			if (this.isFirebaseEnabled)
            {
                this.$('.buttons').slideUp();
                this.$('.loading').fadeIn();
				
                let items = this.model.get('_items').slice(0);
                let answer = [];

                items.sort(function(a, b) {
                    return a._index - b._index;
                });

                _.each(items, function(item, index) {
                    if (item._isSelected) answer.push(item.option);
                }, this);

                let callbackFunction = this.submissionChecker;
                let thisObject = this;

                this.fb = Adapt.firebase.database.ref(this.model.get('_firebaseParentID'));
                this.formRef = this.fb.child(this.model.get('_firebaseID'));
                
				_.each(answer, function(item, index) {
                    let answerRef = this.formRef.child(item);
                    answerRef.child('count')
                        .transaction(function(current) {
                            return (current || 0) + 1;
                        });
                    callbackFunction(answerRef, thisObject, answer.length);
                }, this);
            }
            else this.onFirebaseError();
        },

        submissionChecker: function(answerRef, thisObject, answersLength) {
            
			console.log("FirebaseMcqView.submissionChecker()");
			
			if (!thisObject.submissionsCount) {
                thisObject.submissionsCount = 1;
            } else {
                thisObject.submissionsCount++;
            }
            if (thisObject.submissionsCount == answersLength) {
                thisObject.showFeedback(answerRef);
                thisObject.setCompletionStatus();
            }
        },
		
		showFeedback: function(answerRef) {
			console.log("FirebaseMcqView.showFeedback().answerRef:", answerRef);
			
			let graphData = new Array();
            let graphLegend = '';
            let answerData = {};
            let total = 0;
            let thisObject = this;
            let formRef = this.formRef;
            formRef.once('value', function(snapshot) {
                let data = snapshot.val();
                snapshot.forEach(function(childSnapshot) {
                    let key = childSnapshot.key;
                    let childData = childSnapshot.val();
                    answerData[key] = childData.count;
                    total += childData.count;
                });
                _.each(thisObject.model.get('_items'), function(item) {
                    if (answerData[item.option]) {
                        graphData.push({
                            value: Math.round((answerData[item.option] / total) * 100),
                            label: item.option,
                            color: item.color,
                            highlight: thisObject.lightenDarkenColor(item.color, 20),
                        });
                        graphLegend += '<div class="legend-item" style="background-color: ' + item.color + '">' + item.option + '</div>';
                    }
                }, this);
                thisObject.model.set('_graphData', graphData);
                thisObject.model.set('_graphLegend', graphLegend);
                $('html, body')
                    .animate({
                        scrollTop: thisObject.$('.buttons')
                            .top,
                    });
                thisObject.updateGraph(Adapt.device.screenSize);
            });
		},
		
		updateGraph: function(size) {
            if (!this.model.get('_isSubmitted')) return;

            let chartArea = this.$('#chart-area');
            let chartSize = 0;

            switch (size)
            {
                case 'small':
                    chartSize = 200;
                    break;

                case 'medium':
                    chartSize = 200;
                    break;

                case 'large':
                    chartSize = 200;
                    break;
            }

            // adjust chart size if needed
            if (chartArea.attr('width') != chartSize)
            {
                chartArea.attr('width', chartSize);
                chartArea.attr('height', chartSize);
            }

            this.createGraph();
        },
		
        createGraph: function() {
            this.$('.loading')
                .fadeOut();
            this.$('.feedback-graph')
                .slideDown();
            this.$('.legend-container')
                .empty();
            if (!this.model.get('_graphData')) {
                return;
            }
            if (this.graph && this.graph.destroy) {
                this.graph.destroy();
            }
            let total = 0;
            let answerValues = [];
            let thisObject = this;
            _.each(this.model.get('_graphData'), function(graphItem) {
                total += graphItem.value;
                _.each(thisObject.model.get('_selectedItems'), function(item) {
                    if (graphItem.label.toLowerCase() == item.option.toLowerCase()) {
                        answerValues.push({
                            'option': item.option,
                            'value': graphItem.value,
                            'color': item.color,
                        });
                    }
                });
            });
            let feedbackText = '';
            _.each(answerValues, function(answer) {
                feedbackText += ' <b style=\'color:' + answer.color + '\'>Option ' + answer.option + '</b> was chosen by <b>' + answer.value + '%</b> of Participants<br/>';
            });
            this.$('.feedback-graph .your-score')
                .html(feedbackText);
            let ctx = this.$('#chart-area')[0].getContext('2d');
            
			this.graph = new Chart(ctx)
                .Doughnut(this.model.get('_graphData'), {
                    segmentStrokeWidth: 4,
                    animationEasing: 'easeInOutCubic',
                    responsive: false,
                });
            this.$('.legend-container')
                .append(this.model.get('_graphLegend'));
            this.listenTo(Adapt, 'device:changed', this.updateGraph);
        },
		
		lightenDarkenColor: function(col, amt) {
            let usePound = false;
            if (col[0] == '#') {
                col = col.slice(1);
                usePound = true;
            }
            let num = parseInt(col, 16);
            let r = (num >> 16) + amt;
            if (r > 255) r = 255;
            else if (r < 0) r = 0;
            let b = ((num >> 8) & 0x00FF) + amt;
            if (b > 255) b = 255;
            else if (b < 0) b = 0;
            let g = (num & 0x0000FF) + amt;
            if (g > 255) g = 255;
            else if (g < 0) g = 0;
            return (usePound ? '#' : '') + (g | (b << 8) | (r << 16))
                .toString(16);
        }
		
    },{
        template: 'fb-social-mcq'
    });

    return FirebaseMcqView;

});
