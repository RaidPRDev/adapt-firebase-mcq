define('components/adapt-firebase-mcq/js/adapt-firebase-mcq',
    ['require',
        'coreViews/questionView',
        'coreJS/adapt',
        '../libraries/Chart'
    ],function(require) {

    let QuestionView = require('coreViews/questionView');
    let Adapt = require('coreJS/adapt');

    let FBSocialMcq = QuestionView.extend({
        events: {
            'click .fb-social-mcq-item label': 'onItemSelected',
            'keyup .fb-social-mcq-item input': 'onKeyPress',
        },

        graph:null, // Chart

        onFirebaseError: function()
        {
            var msg = "Firebase Extension is not enabled. Please add '_firebase._isEnabled' to course.json";

            try {
                throw new Error(msg);
            } catch(e) {
                console.error(e.name, e.message);
            }
        },

        resetQuestionOnRevisit: function() {
            this.setAllItemsEnabled(true);
            this.resetQuestion();
        },
        setupQuestion: function() {

            this.model.set('_isRadio', (this.model.get('_selectable') === 1));
            this.model.set('_canShowModelAnswer', false);
            this.model.set('_selectedItems', []);
            this.setupQuestionItemIndexes();
            this.setupRandomisation();
            this.restoreUserAnswers();
        },
        setupQuestionItemIndexes: function() {
            let items = this.model.get('_items');
            for (let i = 0, l = items.length; i < l; i++) {
                if (items[i]._index === undefined) items[i]._index = i;
            }
        },
        setupRandomisation: function() {
            if (this.model.get('_isRandom') && this.model.get('_isEnabled')) {
                this.model.set('_items', _.shuffle(this.model.get('_items')));
            }
        },
        restoreUserAnswers: function() {
            if (!this.model.get('_isSubmitted')) return;
            let selectedItems = [];
            let items = this.model.get('_items');
            let userAnswer = this.model.get('_userAnswer');
            _.each(items, function(item, index) {
                item._isSelected = userAnswer[item._index];
                if (item._isSelected) {
                    selectedItems.push(item);
                }
            });
            this.model.set('_selectedItems', selectedItems);
            this.setQuestionAsSubmitted();
            this.listenTo(Adapt, 'componentView:postRender', this.updateGraph);
        },
        disableQuestion: function() {
            this.setAllItemsEnabled(false);
        },
        enableQuestion: function() {
            this.setAllItemsEnabled(true);
        },
        setAllItemsEnabled: function(isEnabled) {
            _.each(this.model.get('_items'), function(item, index) {
                let $itemLabel = this.$('label')
                    .eq(index);
                let $itemInput = this.$('input')
                    .eq(index);
                if (isEnabled) {
                    $itemLabel.removeClass('disabled');
                    $itemInput.prop('disabled', false);
                } else {
                    $itemLabel.addClass('disabled');
                    $itemInput.prop('disabled', true);
                }
            }, this);
        },
        onQuestionRendered: function() {
            this.setReadyStatus();
        },
        onKeyPress: function(event) {
            if (event.which === 13) {
                this.onItemSelected(event);
            }
        },
        onItemSelected: function(event) {
            if (this.model.get('_isEnabled') && !this.model.get('_isSubmitted')) {
                let selectedItemObject = this.model.get('_items')[$(event.currentTarget)
                    .parent('.component-item')
                    .index()];
                this.toggleItemSelected(selectedItemObject, event);
            }
        },
        toggleItemSelected: function(item, clickEvent) {
            let selectedItems = this.model.get('_selectedItems');
            let itemIndex = _.indexOf(this.model.get('_items'), item),
                $itemLabel = this.$('label')
                    .eq(itemIndex),
                $itemInput = this.$('input')
                    .eq(itemIndex),
                selected = !$itemLabel.hasClass('selected');
            if (selected) {
                if (this.model.get('_selectable') === 1) {
                    this.$('label')
                        .removeClass('selected');
                    this.$('input')
                        .prop('checked', false);
                    this.deselectAllItems();
                    selectedItems[0] = item;
                } else if (selectedItems.length < this.model.get('_selectable')) {
                    selectedItems.push(item);
                } else {
                    clickEvent.preventDefault();
                    return;
                }
                $itemLabel.addClass('selected');
                $itemLabel.a11y_selected(true);
            } else {
                selectedItems.splice(_.indexOf(selectedItems, item), 1);
                $itemLabel.removeClass('selected');
                $itemLabel.a11y_selected(false);
            }
            $itemInput.prop('checked', selected);
            item._isSelected = selected;
            this.model.set('_selectedItems', selectedItems);
        },
        canSubmit: function() {
            let count = 0;
            _.each(this.model.get('_items'), function(item) {
                if (item._isSelected) {
                    count++;
                }
            }, this);
            return (count > 0) ? true : false;
        },
        onCannotSubmit: function() {},
        storeUserAnswer: function() {
            let userAnswer = [];
            let items = this.model.get('_items')
                .slice(0);
            items.sort(function(a, b) {
                return a._index - b._index;
            });
            _.each(items, function(item, index) {
                userAnswer.push(item._isSelected);
            }, this);
            this.model.set('_userAnswer', userAnswer);
        },
        isCorrect: function() {},
        onSubmitClicked: function() {
            if (!this.canSubmit()) return;
            this.sendForm();
            if (!this.canSubmit()) {
                this.showInstructionError();
                this.onCannotSubmit();
                return;
            }
            this.updateAttempts();
            this.setQuestionAsSubmitted();
            this.removeInstructionError();
            this.storeUserAnswer();
            this.checkQuestionCompletion();
            this.recordInteraction();
        },
        sendForm: function() {
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

                this.fb = Adapt.fb.ref(this.model.get('_firebaseParentID'));
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

        submissionChecker: function(a, thisObject, answersLength) {
            if (!thisObject.submissionsCount) {
                thisObject.submissionsCount = 1;
            } else {
                thisObject.submissionsCount++;
            }
            if (thisObject.submissionsCount == answersLength) {
                thisObject.showFeedback(a);
                thisObject.setCompletionStatus();
            }
        },
        showFeedback: function(a) {
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
        showMarking: function() {
            _.each(this.model.get('_items'), function(item, i) {
                let $item = this.$('.component-item')
                    .eq(i);
                $item.removeClass('correct incorrect')
                    .addClass(item._isCorrect ? 'correct' : 'incorrect');
            }, this);
        },
        isPartlyCorrect: function() {
            return this.model.get('_isAtLeastOneCorrectSelection');
        },
        resetUserAnswer: function() {
            this.model.set({
                _userAnswer: [],
            });
        },
        resetQuestion: function() {
            this.deselectAllItems();
            this.resetItems();
        },
        deselectAllItems: function() {
            this.$el.a11y_selected(false);
            _.each(this.model.get('_items'), function(item) {
                item._isSelected = false;
            }, this);
        },
        resetItems: function() {
            this.$('.component-item label')
                .removeClass('selected');
            this.$('.component-item')
                .removeClass('correct incorrect');
            this.$('input')
                .prop('checked', false);
            this.model.set({
                _selectedItems: [],
                _isAtLeastOneCorrectSelection: false,
            });
        },
        showCorrectAnswer: function() {
            _.each(this.model.get('_items'), function(item, index) {
                this.setOptionSelected(index, item._shouldBeSelected);
            }, this);
        },
        setOptionSelected: function(index, selected) {
            let $itemLabel = this.$('label')
                .eq(index);
            let $itemInput = this.$('input')
                .eq(index);
            if (selected) {
                $itemLabel.addClass('selected');
                $itemInput.prop('checked', true);
            } else {
                $itemLabel.removeClass('selected');
                $itemInput.prop('checked', false);
            }
        },
        hideCorrectAnswer: function() {
            _.each(this.model.get('_items'), function(item, index) {
                this.setOptionSelected(index, this.model.get('_userAnswer')[item._index]);
            }, this);
        },
        getResponse: function() {
            let selected = _.where(this.model.get('_items'), {
                '_isSelected': true,
            });
            let selectedIndexes = _.pluck(selected, '_index');
            for (let i = 0, count = selectedIndexes.length; i < count; i++) {
                selectedIndexes[i]++;
            }
            return selectedIndexes.join(',');
        },
        getResponseType: function() {
            return 'choice';
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
        },
    });
    Adapt.register('fb-social-mcq', FBSocialMcq);
    return FBSocialMcq;
});
