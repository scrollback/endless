/*
	Endless: A bidirectional, React infinite scroll component.
	Based on ReactList (https://github.com/orgsync/react-list)
*/

/* eslint-env browser, amd */

"use strict";

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

	var resizeListener = function(e) {
		var el = e.target || e.srcElement;

		if (el.__resizeRAF__) cancelAnimationFrame(el.__resizeRAF__);

		el.__resizeRAF__ = requestAnimationFrame(function() {
			var trigger = el.__resizeTrigger__;

			trigger.__resizeListeners__.forEach(function(fn) {
				fn.call(trigger, e);
			});
		});
	};

	var addResizeListener = function(el, fn) {
		if (el === window) {
			window.addEventListener('resize', resizeListener);

			return;
		}

		if (!el.__resizeListeners__) {
			el.__resizeListeners__ = [];

			if (getComputedStyle(el).position === 'static') {
				el.style.position = 'relative';
			}

			var obj = el.__resizeTrigger__ = document.createElement('object');

			obj.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; pointer-events: none; z-index: -1;');
			obj.__resizeElement__ = el;

			obj.onload = function objectLoad() {
				this.contentDocument.defaultView.__resizeTrigger__ = this.__resizeElement__;
				this.contentDocument.defaultView.addEventListener('resize', resizeListener);
			};

			obj.type = 'text/html';
			obj.data = 'about:blank';

			el.appendChild(obj);
		}

		el.__resizeListeners__.push(fn);
	};

	var removeResizeListener = function(el, fn) {
		if (el === window) {
			window.removeEventListener('resize', resizeListener);

			return;
		}

		el.__resizeListeners__.splice(el.__resizeListeners__.indexOf(fn), 1);

		if (!el.__resizeListeners__.length) {
			el.__resizeTrigger__.contentDocument.defaultView.removeEventListener('resize', resizeListener);
			el.__resizeTrigger__ = !el.removeChild(el.__resizeTrigger__);
		}
	};

	var isEqualSubset = function(a, b) {
		for (var key in a)
			if (b[key] !== a[key]) return false;
		return true;
	};

	var isEqual = function(a, b) {
		return isEqualSubset(a, b) && isEqualSubset(b, a);
	};

	var getComputedValue = function (el, propName) {
		var value = parseFloat(window.getComputedStyle(el)[propName]);
		if(isNaN(value)) value = 0;
		return value;
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
			this.untrackedState = this.untrackedState ||  { jumpRequired: true, offset: 0 };

			if (this.props.children.length) {
				if (this.props.atTop) {
					this.untrackedState.jumpToIndex = 0;
					this.untrackedState.position = 'top';
				} else if (this.props.atBottom) {
					this.untrackedState.jumpToIndex = this.props.children.length - 1;
					this.untrackedState.position = 'bottom';
				} else {
					this.untrackedState.jumpToIndex = 0;
					this.untrackedState.position = buildReactElement(this.props.children[0]).key;
				}
			}

			if (this.props.position) {
				this.untrackedState.position = this.props.position;
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
			var items = this.props.children,
				itemsEl = React.findDOMNode(this.refs.items),
				itemEls = itemsEl.children,
				jumped = false, i;

			if (!itemEls.length) {
				// There are no items yet, delay the next update a little
				this.stid = setTimeout(this.update, 200);

				return;
			}

			if (this.untrackedState.jumpRequired && this.untrackedState.position) {
				if (this.untrackedState.position === 'top') {
					this.setScroll(-9E99);
					// this is the reason for a bug
				//	this.scrollTo(0, 0);
					jumped = true;
				} else if (this.untrackedState.position === 'bottom') {
					this.setScroll(9E99);
				//	this.scrollTo(items.length - 1, this.getBottom(itemEls[itemEls.length-1]) - this.getTop(itemEls[itemEls.length-1]));
					jumped = true;
				} else {
					for (i = 0; i < items.length; i++) {
						if (items[i].key === this.untrackedState.position) {
							this.scrollTo(i, this.untrackedState.offset);
							jumped = true;
							break;
						}
					}
				}

				if (!jumped) {
					console.error("Endless Error: Jump was required but it did not happen. " +
								  "This usually happens when scrolling down very fast.");
				}

				this.untrackedState.jumpRequired = false;

				this.afid = requestAnimationFrame(this.update);

				return;
			}

			var viewTop = this.getScroll(), // Get scroll position of the scroll parent
				viewHeight = this.getViewportHeight(),
				viewBottom = viewTop + viewHeight,
				elBottom = React.findDOMNode(this).scrollHeight, // Get the total height of the scroll viewport
				last = this.untrackedState,
				position, offset, above, below, itemHeight, top, columns;

			// Calculate the number of columns by comparing the top offset values
			top = this.getTop(itemEls[0]);

			columns = 1;

			while (columns < itemEls.length && this.getTop(itemEls[columns]) === top) {
				columns++;
			}

			// Get average height of the items
			itemHeight = (this.getBottom(itemEls[itemEls.length - 1]) - top) / itemEls.length;

			if (itemHeight <= 0) { itemHeight = 20; } // Ugly hack for handling display:none items.

			itemHeight *= columns;

			if (this.state.bottomReached && !this.state.bottomRemoved && viewBottom >= elBottom - 4) {
				// The viewport has scrolled to bottom
				position = 'bottom';
				offset = 0;
				above = columns * Math.ceil(viewHeight / itemHeight);
				below = 0;
			} else if (this.state.topReached && !this.state.topRemoved && viewTop <= 4) {
				// The viewport has scrolled to top
				position = 'top';
				offset = 0;
				above = 0;
				below = columns * Math.ceil(viewHeight / itemHeight);
			} else {
				for (i = 0; i < itemEls.length; i++) {
					offset = itemEls[i].offsetTop + itemEls[i].scrollHeight - viewTop; // Distance of the element from the top of the viewport

					if (offset > 0) {
						// Element is visible in the viewport
						offset = viewTop - itemEls[i].offsetTop;
						break;
					}
				}

				if (i === itemEls.length) { i--; } // All the items are above the viewport, pick last one.

				position = buildReactElement(items[i]).key; // Building in case it is JSONML

				if (viewTop < itemEls[0].offsetTop) {
					// Space at top is less than space above first element
					// Means there are items above the top of the view
					offset = viewTop - itemEls[0].offsetTop;
					above = columns * Math.ceil(-offset / itemHeight);
				} else {
					// No items above the top of the view
					above = 0;
				}

				below = Math.max(0, columns * Math.ceil(Math.max(
					viewHeight, (viewBottom - itemEls[itemEls.length-1].offsetTop)
				) / itemHeight) - above); // Number of items below the bottom of the view
			}

			above = Math.round(above);
			below = Math.round(below);

			if (last.position !== position || last.above < above || last.below < below) {

				// console.debug("Position changed to", position, above, below);

				last.position = position;
				last.offset = offset;
				last.above = above;
				last.below = below;

				this.afid = requestAnimationFrame(this.update);
				this.props.onScroll(position, above, below);
			} else if (last.offset !== offset) {
				last.offset = offset;
				this.afid = requestAnimationFrame(this.update);
			} else {
				this.stid = setTimeout(this.update, 200);
			}
		},

		onResize: function() {
			this.untrackedState.jumpRequired = true;
		},

		componentDidMount: function() {
			this.update();

			addResizeListener(this.getScrollParent(), this.onResize);

			this.props.onMount();
		},

		componentWillUnmount: function() {
			cancelAnimationFrame(this.afid);

			removeResizeListener(this.getScrollParent(), this.onResize);

			clearTimeout(this.stid);

			this.props.onUnmount();
		},

		shouldComponentUpdate: function(props, state) {
			if (isEqual(this.props, props) && isEqual(this.state, state)) return false;
			return true;
		},

		componentWillReceiveProps: function(nextProps) {

			if (nextProps.position && nextProps.position !== this.untrackedState.position) {
				this.untrackedState.position = nextProps.position;
				this.untrackedState.offset = 0;
				this.untrackedState.jumpRequiredAfterUpdate = true;
//				console.debug('Received a position property that will cause a jump');
			}

			this.setState({
				topReached: this.state.topReached || nextProps.atTop,
				bottomReached: this.state.bottomReached || nextProps.atBottom,
				topRemoved: nextProps.atTop? 0: Math.max(10, this.state.topRemoved),
				bottomRemoved: nextProps.atBottom? 0: Math.max(10, this.state.bottomRemoved)
			});
		},

		componentDidUpdate: function(prevProps) {
//			if (this.untrackedState.jumpToIndex !== null) return;

			var prevItems = prevProps.items.map(buildReactElement),
				items = this.props.children.map(buildReactElement),
				metrics, prevMetrics = this.metrics, i,
				topAdded, topRemoved, bottomAdded, bottomRemoved;

			if (!items.length || !prevItems.length) return;

			// Calculate the new metrics (tops and bottoms of each element)
			metrics = [].slice.call(React.findDOMNode(this.refs.items).children).map(function(itemEl) {
				return {
					top: this.getTop(itemEl),
					bottom: this.getBottom(itemEl)
				};
			}.bind(this));

			if (prevMetrics && prevMetrics.length !== prevItems.length) {
				console.error("Endless Error: prevMetrics.length ≠ prevItems.length. " +
							  "Did you modify the items array after calling setProps?", prevMetrics.length, prevItems.length);
			}

			if (metrics && prevMetrics && items.length && prevItems.length) {
				// Check how many items were added at the beggining of the data set
				i = 0;

				while (i < items.length && items[i].key !== prevItems[0].key) {
					i++;
				}

				topAdded = (i === items.length) ? 0 : metrics[i].top - metrics[0].top;

				// Check how many items were removed from the start of the data set
				i = 0;

				while (i < prevItems.length && prevItems[i].key !== items[0].key) {
					i++;
				}

				topRemoved = (i === prevItems.length) ? 0 : prevMetrics[i].top - prevMetrics[0].top;


				// Check how many items were added at the end of the data set
				i = items.length - 1;

				while (i >= 0 && items[i].key !== prevItems[prevItems.length - 1].key) {
					i--;
				}

				bottomAdded = (i < 0) ? 0 : metrics[metrics.length - 1].bottom - metrics[i].bottom;


				// Cehck how many items were removed from the end of the data set
				i = prevItems.length - 1;

				while (i >= 0 && prevItems[i].key !== items[items.length - 1].key) {
					i--;
				}

				bottomRemoved = (i < 0) ? 0 : prevMetrics[prevMetrics.length - 1].bottom - prevMetrics[i].bottom;

				// Set the state with the new values, so our view gets updated
				this.setState({
					topRemoved: Math.max(0, this.state.topRemoved + topRemoved - topAdded),
					bottomRemoved: Math.max(0, this.state.bottomRemoved + bottomRemoved - bottomAdded)
				});
			}

			//	console.log('Rendered', items[0].key, 'through', items[items.length-1].key,
			//				'Removed space ', this.state.topRemoved, this.state.bottomRemoved);
			this.metrics = metrics;

			if(
				items[0].key !== prevItems[0].key ||
				!prevProps.topReached && this.props.atTop ||
				this.untrackedState.position === 'bottom' ||
				this.untrackedState.jumpRequiredAfterUpdate
			) {
//				console.debug("Scheduled a jump to", this.untrackedState.position,
//					items[0].key != prevItems[0].key? 'topItemChanged': '',
//					!prevProps.topReached && this.props.atTop? 'justReachedTop': '',
//					this.untrackedState.jumpRequiredAfterUpdate? 'positionInProp': ''
//				);
				this.untrackedState.jumpRequired = true;
				delete this.untrackedState.jumpRequiredAfterUpdate;
			}
		},

		getTop: function(el) {
			return el.getBoundingClientRect().top - getComputedValue(el, 'marginTop');
		},

		getBottom: function(el) {
			return el.getBoundingClientRect().bottom + getComputedValue(el, 'marginBottom');
		},

		getScrollParent: function() {
			for (var el = React.findDOMNode(this); el; el = el.parentElement) {
				var overflowY = window.getComputedStyle(el).overflowY;

				if (overflowY === 'auto' || overflowY === 'scroll') {
					return el;
				}
			}

			return window;
		},

		// Get scroll position relative to the top of the list.
		getScroll: function() {
			var scrollParent = this.getScrollParent(),
				el = React.findDOMNode(this);

			if (scrollParent === el) {
				return el.scrollTop;
			} else if (scrollParent === window) {
				return -el.getBoundingClientRect().top;
			} else {
				return scrollParent.getBoundingClientRect().top -
					el.getBoundingClientRect().top + getComputedValue(scrollParent, 'borderTop');
			}
		},

		setScroll: function(y) {
			var scrollParent = this.getScrollParent(),
				el = React.findDOMNode(this);

//			console.debug('setScroll called with ', y);

			if (scrollParent !== el) {
				y += (scrollParent.scrollTop -
					(scrollParent.getBoundingClientRect().top -
					el.getBoundingClientRect().top +
					getComputedValue(scrollParent, 'borderTop')));
			}
			y = Math.min(scrollParent.scrollHeight, Math.max(0, y));
			if (scrollParent === window) return window.scrollTo(0, y);
//			console.debug('About to scroll', scrollParent, y);
			scrollParent.scrollTop = y;
//			console.debug('After scroll', scrollParent.scrollHeight, scrollParent.scrollTop, scrollParent.clientHeight);
		},

		getViewportHeight: function() {
			var scrollParent = this.getScrollParent();
			return scrollParent === window ? scrollParent.innerHeight : scrollParent.clientHeight;
		},

		scrollTo: function(index, offset) {
			var y = React.findDOMNode(this.refs.items).children[index].offsetTop + offset;

			//	console.log(
			//		"scrolling from", this.getScroll(), "to",
			//		React.findDOMNode(this.refs.items).children[index].offsetTop, offset
			//	);
			this.setScroll(y);
		},

		render: function() {
			return buildReactElement(['div', {
					style: { position: 'relative' }
				},
				['div', {
					style: { height: this.state.topRemoved + (this.state.topReached ? 0 : this.props.margin) }
				}],
				['div', {
					ref: 'items'
				}].concat(this.props.children),
				['div', {
					style: {
						clear: 'both',
						height: this.state.bottomRemoved + (this.state.bottomReached ? 0 : this.props.margin)
					}
				}]
			]);
		}
	});
});
