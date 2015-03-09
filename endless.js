/*
	Endless: A bidirectional, React infinite scroll component.
	Based on ReactList (https://github.com/orgsync/react-list)
*/

/* global define, module, require, setTimeout, clearTimeout, window */
/* jshint -W116 */ // Don't warn about single-line if's.

(function(root, factory) {
	if (typeof define === 'function' && define.amd) {
		define(['react'], factory);
	} else if (typeof exports !== 'undefined') {
		module.exports = factory(require('react'));
	} else {
		root.Endless = factory(root.React);
	}
})(this, function(React) {
	'use strict';

	var buildReactElement = function(jsonml) {
		if (!Array.isArray(jsonml)) {
			return jsonml;
		}

		if (jsonml.length > 1 &&
			(typeof jsonml[1] !== 'object' || Array.isArray(jsonml[1]))
		) {
			jsonml.splice(1, 0, null);
		}

		return React.createElement.apply(React, jsonml.map(buildReactElement));
	};

	var requestAnimationFrame =
		(typeof window !== 'undefined' && window.requestAnimationFrame) ||
		function(cb) {
			return setTimeout(cb, 16);
		};

	var cancelAnimationFrame =
		(typeof window !== 'undefined' && window.cancelAnimationFrame) ||
		clearTimeout;

	var isEqualSubset = function(a, b) {
		for (var key in a)
			if (b[key] !== a[key]) return false;
		return true;
	};

	var isEqual = function(a, b) {
		return isEqualSubset(a, b) && isEqualSubset(b, a);
	};

	return React.createClass({
		getDefaultProps: function() {
			return {
				items: [],
				margin: 2000,
				atTop: false,
				atBottom: false,
				onScroll: function( /* key, above, below */ ) {},
				onMount: function( /* event */ ) {},
				onUnmount: function() {}
			};
		},

		getInitialState: function() {
			this.lastState = this.lastState ||  { jumpToIndex: null, offset: 0 };

			if (this.props.items.length) {
				if (this.props.atTop) {
					this.lastState.jumpToIndex = 0;
					this.lastState.position = 'top';
				} else if (this.props.atBottom) {
					this.lastState.jumpToIndex = this.props.items.length - 1;
					this.lastState.position = 'bottom';
				} else {
					this.lastState.jumpToIndex = 0;
					this.lastState.position = buildReactElement(this.props.items[0]).key;
				}
			}

			return {
				itemHeight: 25,
				columns: 1,
				topReached: this.props.atTop,
				bottomReached: this.props.atBottom,
				topRemoved: 0,
				bottomRemoved: 0
			};
		},

		update: function() {
			if (this.lastState.jumpToIndex !== null) {
				this.scrollTo(this.lastState.jumpToIndex, this.lastState.offset);
				this.lastState.offset = 0;
				this.lastState.jumpToIndex = null;
			}

			var items = this.props.items,
				itemsEl = this.refs.items.getDOMNode(),
				itemEls = itemsEl.children,
				itemHeight,
				viewTop = this.getScroll(),
				viewHeight = this.getViewportHeight(),
				viewBottom = viewTop + viewHeight,
				elBottom = this.getDOMNode().scrollHeight,
				last = this.lastState,
				position, i, offset, above, below, top, columns;

			if (!itemEls.length) {
				this.stid = setTimeout(this.update, 200);
				return;
			}

			top = this.getTop(itemEls[0]);

			for(columns=1; columns<itemEls.length && this.getTop(itemEls[columns]) == top; columns++);

			itemHeight = (this.getBottom(itemEls[itemEls.length - 1]) - top) / itemEls.length;
			if(itemHeight <= 0) itemHeight = 20; // Ugly hack for handling display:none items.
			itemHeight *= columns;

			if (this.state.bottomReached && !this.state.bottomRemoved && viewBottom >= elBottom) {
				position = 'bottom';
				offset = 0;
				above = columns * Math.ceil(viewHeight / itemHeight);
				if(isNaN(above)) console.log(columns, viewHeight, itemHeight);
				below = 0;
			} else if (this.state.topReached && !this.state.topRemoved && viewTop <= 0) {
				position = 'top';
				offset = 0;
				above = 0;
				below = columns * Math.ceil(viewHeight / itemHeight);
			} else {
				for (i = 0; i < itemEls.length; i++) {
					offset = itemEls[i].offsetTop + itemEls[i].scrollHeight - viewTop;
					if (offset >= 0) break;
				}
				if (i == itemEls.length) i--; // All the items are above the viewport; pick last one.

				position = buildReactElement(items[i]).key; // building in case it is JSONML
				if (viewTop < itemEls[0].offsetTop) {
					offset = viewTop - itemEls[0].offsetTop;
					above = columns * Math.ceil(-offset / itemHeight);
				} else {
					above = 0;
				}
				below = Math.max(0, columns * Math.ceil(Math.max(
					viewHeight, (viewBottom - itemEls[itemEls.length-1].offsetTop)
				) / itemHeight) - above);
			}

			above = Math.round(above);
			below = Math.round(below);

			if (last.position !== position || last.above !== above || last.below !== below) {
				last.position = position;
				last.offset = offset;
				last.above = above;
				last.below = below;

				this.afid = requestAnimationFrame(this.update);
				this.props.onScroll(position, above, below);
			} else if(last.offset !== offset) {
				this.afid = requestAnimationFrame(this.update);
			} else {
				this.stid = setTimeout(this.update, 200);
			}
		},

		componentDidMount: function() {
			this.update();
			this.props.onMount();
		},

		componentWillUnmount: function() {
			cancelAnimationFrame(this.afid);
			clearTimeout(this.stid);
			this.props.onUnmount();
		},

		shouldComponentUpdate: function(props, state) {
			if (isEqual(this.props, props) && isEqual(this.state, state)) return false;
			return true;
		},

		componentWillReceiveProps: function(nextProps) {
			this.setState({
				topReached: this.state.topReached || nextProps.atTop,
				bottomReached: this.state.bottomReached || nextProps.atBottom,
				topRemoved: nextProps.atTop? 0: this.state.topRemoved,
				bottomRemoved: nextProps.atBottom? 0: this.state.bottomRemoved,
			});
		},

		componentDidUpdate: function(prevProps) {
//		  if (this.lastState.jumpToIndex !== null) return;

			var prevItems = prevProps.items.map(buildReactElement),
				items = this.props.items.map(buildReactElement),
				jumpRequired, newIndex = null,
				metrics, prevMetrics = this.metrics, i,
				topAdded, topRemoved, bottomAdded, bottomRemoved;

			if (!items.length || !prevItems.length) return;

			metrics = [].slice.call(this.refs.items.getDOMNode().children).map(function(itemEl) {
				return {
					top: this.getTop(itemEl),
					bottom: this.getBottom(itemEl)
				};
			}.bind(this));

			if(prevMetrics && prevMetrics.length !== prevItems.length) {
				console.log("Endless Error: prevMetrics.length ≠ prevItems.length. "+
							"Did you modify the items array after calling setProps?", prevMetrics.length, prevItems.length);
			}

			if (metrics && prevMetrics && items.length && prevItems.length) {
				for (i = 0; i < items.length && items[i].key != prevItems[0].key; i++);
				topAdded = (i == items.length) ? 0 : metrics[i].top - metrics[0].top;

				for (i = 0; i < prevItems.length && prevItems[i].key != items[0].key; i++);
				topRemoved = (i == prevItems.length) ? 0 : prevMetrics[i].top - prevMetrics[0].top;

				for (i = items.length - 1; i >= 0 && items[i].key != prevItems[prevItems.length - 1].key; i--);
				bottomAdded = (i < 0) ? 0 : metrics[metrics.length - 1].bottom - metrics[i].bottom;

				for (i = prevItems.length - 1; i >= 0 && prevItems[i].key != items[items.length - 1].key; i--);
				bottomRemoved = (i < 0) ? 0 : prevMetrics[prevMetrics.length - 1].bottom - prevMetrics[i].bottom;

				//	  console.log(topRemoved, topAdded, bottomRemoved, bottomAdded);

				this.setState({
					topRemoved: Math.max(0, this.state.topRemoved + topRemoved - topAdded),
					bottomRemoved: Math.max(0, this.state.bottomRemoved + bottomRemoved - bottomAdded)
				});
			}

			//  console.log('Rendered', items[0].key, 'through', items[items.length-1].key,
			//			  'Removed space ', this.state.topRemoved, this.state.bottomRemoved);
			this.metrics = metrics;

			if (items[0].key != prevItems[0].key) jumpRequired = true;
			if (prevProps.topReached != this.props.topReached) jumpRequired = true;
			if (this.lastState.position === 'bottom') jumpRequired = true;

			if (jumpRequired) {
				if (this.lastState.position == 'top') {
					newIndex = 0;
					this.lastState.offset = 0;
				} else if (this.lastState.position == 'bottom') {
					newIndex = items.length - 1;
					this.lastState.offset = metrics[metrics.length-1].bottom - metrics[metrics.length-1].top;
				} else {
					for (i = 0; i < items.length; i++) {
						if (items[i].key == this.lastState.position) {
							newIndex = i;
							break;
						}
					}
				}

				if (newIndex === null) {
					console.log('Couldnt find ', this.lastState.position, 'in', items[0].key, '---', items[items.length - 1].key);
				} else {
					this.lastState.jumpToIndex = newIndex;
				}

			}
		},

		getTop: function(el) {
			return el.getBoundingClientRect().top - parseFloat(window.getComputedStyle(el).marginTop);
		},

		getBottom: function(el) {
			return el.getBoundingClientRect().bottom + parseFloat(window.getComputedStyle(el).marginBottom);
		},

		getScrollParent: function() {
			for (var el = this.getDOMNode(); el; el = el.parentElement) {
				var overflowY = window.getComputedStyle(el).overflowY;
				if (overflowY === 'auto' || overflowY === 'scroll') {
					return el;
				}
			}
			return window;
		},

		// Get scroll position relative to the top of the list.
		getScroll: function() {
			var scrollParent = this.getScrollParent();
			var el = this.getDOMNode();
			if (scrollParent === el) {
				return el.scrollTop;
			} else if (scrollParent === window) {
				return -el.getBoundingClientRect().top;
			} else {
				return scrollParent.getBoundingClientRect().top -
					el.getBoundingClientRect().top +
					parseFloat(window.getComputedStyle(scrollParent).borderTop);
			}
		},

		setScroll: function(y) {
			var scrollParent = this.getScrollParent(),
				el = this.getDOMNode();
			if (scrollParent != el) y += (scrollParent.scrollTop -
					(scrollParent.getBoundingClientRect().top -
					el.getBoundingClientRect().top +
					parseFloat(window.getComputedStyle(scrollParent).borderTop)));
			if (scrollParent === window) return window.scrollTo(0, y);
			scrollParent.scrollTop = y;
		},

		getViewportHeight: function() {
			var scrollParent = this.getScrollParent();
			return scrollParent === window ? scrollParent.innerHeight : scrollParent.clientHeight;
		},

		scrollTo: function(index, offset) {
			var y = this.refs.items.getDOMNode().children[index].offsetTop + offset;

			//  console.log(
			//	  "scrolling from", this.getScroll(), "to",
			//	  this.refs.items.getDOMNode().children[index].offsetTop, offset
			//  );
			this.setScroll(y);
		},

		render: function() {
			return buildReactElement(['div', {
					style: {
						position: 'relative'
					}
				},
				['div', {
					style: {
						height: this.state.topRemoved + (this.state.topReached ? 0 : this.props.margin)
					}
				}],
				['div', {
					ref: 'items'
				}].concat(this.props.items), ['div', {
					style: {
						clear: 'both',
						height: this.state.bottomRemoved + (this.state.bottomReached ? 0 : this.props.margin)
					}
				}]
			]);
		}
	});
});
