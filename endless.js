/*
	Endless: A bidirectional, React infinite scroll component.
	Based on ReactList (https://github.com/orgsync/react-list)
*/

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

	var getComputedValue = function (el, propName) {
		var value = parseFloat(window.getComputedStyle(el)[propName]);
		if(isNaN(value)) value = 0;
		return value;
	};

	return React.createClass({
		getDefaultProps: function() {
			return {
				margin: 200,
				atTop: false,
				atBottom: false,
				onScroll: function ( /* key, above, below */ ) {},
				onPrev: function () {},
				onNext: function () {},
				onMount: function ( /* event */ ) {},
				onUnmount: function () {}
			};
		},
		
		resetPrivState: function (props) {
			this.pState.topReached = props.atTop;
			this.pState.bottomReached = props.atBottom;
			this.pState.spaceAbove = props.atTop? 0: this.props.margin;
			this.pState.spaceBelow = props.atBottom? 0: this.props.margin;
			
			console.log("Set space", this.pState.spaceAbove, props.atTop, this.pState.spaceBelow, props.atBottom);
			
			this.pState.topItemKey = props.atTop? null : undefined;
			this.pState.bottomItemKey = props.atBottom? null : undefined;
			
			console.log("Set keys", this.pState.topItemKey, props.atTop, this.pState.bottomItemKey, props.atBottom);

			
			console.log("Reset priv state", this.pState, props);
		},
		
		getInitialState: function() {
			this.pState = this.pState ||  {
				itemHeight: 25,
				columns: 1
			};
			
			this.resetPrivState(this.props);
			
			return {};
		},
/*
//		update: function() {
//			var items = this.props.children,
//				itemsEl = React.findDOMNode(this.refs.items),
//				itemEls = itemsEl.children,
//				jumped = false, i;
//
//			if (!itemEls.length) {
//				// There are no items yet, delay the next update a little
//				this.stid = setTimeout(this.update, 200);
//
//				return;
//			}
//
//			if (this.pState.jumpRequired && this.pState.position) {
//				if (this.pState.position === 'top') {
//					this.setScroll(-9E99);
//					// this is the reason for a bug
//				//	this.scrollTo(0, 0);
//					jumped = true;
//				} else if (this.pState.position === 'bottom') {
//					this.setScroll(9E99);
//				//	this.scrollTo(items.length - 1, this.getBottom(itemEls[itemEls.length-1]) - this.getTop(itemEls[itemEls.length-1]));
//					jumped = true;
//				} else {
//					for (i = 0; i < items.length; i++) {
//						if (items[i].key === this.pState.position) {
//							this.scrollTo(i, this.pState.offset);
//							jumped = true;
//							break;
//						}
//					}
//				}
//
//				if (!jumped) {
//					console.error("Endless Error: Jump was required but it did not happen. " +
//								  "This usually happens when scrolling down very fast.");
//				}
//
//				this.pState.jumpRequired = false;
//
//				this.afid = requestAnimationFrame(this.update);
//
//				return;
//			}
//		Code moved to onScroll
//		},
*/

		onResize: function() {
			this.componentDidUpdate();
		},
		
		onScroll: function () {
			var metrics = this.metrics,
				pState = this.pState,
				count = metrics.length,
				i, topItemKey, bottomItemKey,
				topOffset = 0, bottomOffset = 0;

			if (!count) { return; }
			
			var viewTop = this.getScroll(), // Get scroll position of the scroll parent
				viewHeight = this.getViewportHeight(),
				viewBottom = viewTop + viewHeight,
				
				itemsTop = metrics[0].top,
				itemsBottom = metrics[count - 1].bottom,
				
				itemHeight = this.pState.itemHeight,
				columns = this.pState.columns,
				above, below;
			
			if (
				this.pState.bottomReached &&
				!this.pState.spaceBelow &&
				viewBottom >= itemsBottom - 4
			) {
				// The viewport has scrolled to bottom
				bottomItemKey = null;
				bottomOffset = 0;
				below = 0;
			} 
			
			if (
				this.pState.topReached &&
				!this.pState.spaceAbove &&
				viewTop <= itemsTop + 4
			) {
				// The viewport has scrolled to top
				topItemKey = null;
				topOffset = 0;
				above = 0;
			} 
			
			if (typeof topItemKey === "undefined") {
				for (i = 0; i < count; i++) {
					if (metrics[i].bottom > viewTop) {
						// Element is visible in the viewport
						topOffset = viewTop - metrics[i].top;
						break;
					}
				}
				
				if (i === count) { i--; } // Everything's above viewport, pick last one.
				topItemKey = metrics[i].key; // Building in case it is JSONML

				if (topOffset < 0) {
					// There is empty space in the viewport.
					// Communicate this with a negative itemsAboveView.
					above = columns * Math.floor(topOffset / itemHeight);
				} else {
					above = i;
				}
			}
			
			if (typeof bottomItemKey === "undefined") {
				for (i = count - 1; i >= 0; i--) {
					if (metrics[i].top < viewBottom) {
						// Element is visible in the viewport
						bottomOffset = metrics[i].bottom - viewBottom;
						break;
					}
				}
				if (i === -1) { i++; }
				bottomItemKey = metrics[i].key; // Building in case it is JSONML

				if (bottomOffset < 0) {
					// There is empty space in the viewport.
					// Communicate this with a negative itemsBelowView.
					below = columns * Math.floor(bottomOffset / itemHeight);
				} else {
					below = count - 1 - i;
				}
			}
			
//			console.log("Scroll happened! " + this.getScroll() + " " + this.getMetrics()[0].top);
			
			if (
				pState.topItemKey !== topItemKey ||
				pState.bottomItemKey !== bottomItemKey ||
				pState.above < above ||
				pState.below < below
			) {
				console.log("Updating pState due to scroll", this.ignoreScroll);
				
				if(pState.topItemKey === null && topItemKey !== null) {
					console.log("topItemKey is no longer null its", topItemKey);
//					debugger;
				}
				
				if(pState.bottomItemKey === null && bottomItemKey !== null) {
					console.log("bottomItemKey is no longer null its", bottomItemKey);
//					debugger;
				}
				
				pState.topItemKey = topItemKey;
				pState.bottomItemKey = bottomItemKey;
				pState.above = above;
				pState.below = below;
				
				if(!this.ignoreScroll) this.props.onScroll({
					topItemKey: topItemKey,
					bottomItemKey: bottomItemKey,
					
					itemsAboveView: above,
					itemsBelowView: below,
					itemsInView: count - above - below
				}); else this.ignoreScroll = false;
			}

			
		},

		componentDidMount: function() {
			this.componentDidUpdate();
			
			addResizeListener(this.getScrollParent(), this.onResize);
			this.getScrollParent().addEventListener("scroll", this.onScroll);
			
			this.props.onMount();
		},

		componentWillUnmount: function() {
			cancelAnimationFrame(this.afid);
			clearTimeout(this.stid);

			removeResizeListener(this.getScrollParent(), this.onResize);
			this.getScrollParent().removeEventListener("scroll", this.onScroll);

			this.props.onUnmount();
		},
		
		updateKeys: function() {
			var i;
			this.keys = {};
			for(i=0; i < this.metrics.length; i++) {
				this.keys[this.metrics[i].key] = true;
			}
		},
		
		updateGeometry: function () {
			var metrics = this.metrics, count = metrics.length,
				top, itemHeight, columns;
			
			// Calculate the number of columns by comparing the top offset values
			top = metrics[0].top;
			columns = 1;
			while (columns < count && metrics[columns].top === top) {
				columns++;
			}

			// Get average height of the items
			itemHeight = (this.metrics[count - 1].bottom - top) / count;
			if (itemHeight <= 0) { itemHeight = 20; } // Ugly hack for handling display:none items.
			itemHeight *= columns;
			
			this.pState.columns = columns;
			this.pState.itemHeight = itemHeight;
		},
		
		getMetrics: function () {
			var items = this.props.children.map(buildReactElement);
			
			return Array.prototype.slice.call(
				React.findDOMNode(this.refs.items).children
			).map(function(itemEl, i) {
				return {
					key: items[i].key,
					reactElement: items[i],
					domElement: itemEl,
					top: this.getTop(itemEl),
					bottom: this.getBottom(itemEl)
				};
			}.bind(this));
		},

		componentWillReceiveProps: function(nextProps) {
			var unanchored = true, k, i;
			
			for(i in nextProps.children) {
				k = buildReactElement(nextProps.children[i]).key;
				if(this.keys[k]) unanchored = false;
			}
			
			if(unanchored) {
				this.resetPrivState(nextProps);
			} else {
				this.pState.topReached = this.pState.topReached || nextProps.atTop;
				this.pState.bottomReached = this.pState.bottomReached || nextProps.atBottom;
			}
			
			this.pState.scroll = this.getScroll();
		},
		
		componentDidUpdate: function() {
			function getTopOffset(mets, key) {
				var i = 0;
				while (i < mets.length && mets[i].key !== key) { i++; }
				return (i === mets.length) ? 0 : mets[i].top - mets[0].top;
			}
			
			function getBottomOffset(mets, key) {
				var i = mets.length - 1;
				while (i >= 0 && mets[i].key !== key) { i--; }
				return (i < 0) ? 0 : mets[mets.length - 1].bottom - mets[i].bottom;
			}
			
			var metrics, prevMetrics = this.metrics, j,
				topAdded, topRemoved, bottomAdded, bottomRemoved;

			// Calculate the new metrics. Note that this includes the effect
			// of any padding added by the render function.
			metrics = this.getMetrics();
			
			if(typeof this.pState.scroll === "undefined") this.pState.scroll = this.getScroll();
			
//			console.log(metrics, prevMetrics, metrics.length, prevMetrics.length);

			if (metrics && prevMetrics && metrics.length && prevMetrics.length) {
				
				topAdded = getTopOffset(metrics, prevMetrics[0].key);
				topRemoved = getTopOffset(prevMetrics, metrics[0].key);
				
				bottomAdded = getBottomOffset(metrics, prevMetrics[prevMetrics.length - 1].key);
				bottomRemoved = getBottomOffset(prevMetrics, metrics[metrics.length - 1].key);
				
				var spaceAbove = Math.max(
						this.pState.spaceAbove - topAdded + topRemoved,
						this.pState.topReached ? 0 : this.props.margin
					),
					spaceBelow = Math.max(
						this.pState.spaceBelow - bottomAdded + bottomRemoved,
						this.pState.bottomReached ? 0 : this.props.margin
					),
					scrollTo = this.pState.scroll + spaceAbove - 
						(this.pState.spaceAbove - topAdded + topRemoved);


//				console.log('Rendered', metrics[0].key, 'through', metrics[metrics.length-1].key,
//							':', this.pState.spaceAbove, this.pState.spaceBelow,
//							'+', topRemoved, bottomRemoved,
//							'-', topAdded, bottomAdded,
//							'=', spaceAbove, spaceBelow,
//							'^', scrollTo);				
				
				React.findDOMNode(this.refs.above).style.height = (spaceAbove + "px");
				React.findDOMNode(this.refs.below).style.height = (spaceBelow + "px");
				
				this.pState.spaceAbove = spaceAbove;
				this.pState.spaceBelow = spaceBelow;
			} else {
				React.findDOMNode(this.refs.above).style.height = (this.pState.spaceAbove + "px");
				React.findDOMNode(this.refs.below).style.height = (this.pState.spaceBelow + "px");
			}
			
			this.metrics = metrics = this.getMetrics();
			this.updateGeometry();
			this.updateKeys();
			
//			if(typeof this.pState.scroll === "undefined") this.pState.scroll = this.getScroll();
			
			if(this.pState.topItemKey === null) {
				scrollTo = Math.min(0, scrollTo || 0);
				console.log("jump set to ", scrollTo, "because topItemKey is null");
			} else if(this.pState.bottomItemKey === null) {
				scrollTo = Math.max(
					scrollTo || 0,
					this.getBottom(React.findDOMNode(this.refs.below)) -
					this.getViewportHeight()
				);
				console.log("jump set to ", scrollTo, "because bottomItemKey is null");
			} else if(typeof scrollTo === "undefined") {
				scrollTo = metrics[0].top;
				console.log("jump set to ", scrollTo, "at init, from", this.getScroll(), "item", metrics[0].key);
			}
			
//			console.log(scrollTo, this.pState.scroll);
			
			if(Math.abs(scrollTo - this.pState.scroll) > 4) {
//				this.ignoreScroll = true;
				console.log("jumping to", scrollTo, "from", this.pState.scroll);
				this.setScroll(scrollTo);
			}
			
//			if(this.unanchored) this.onScroll();
//			this.jump = null;
		},

		getTop: function(el) {
			return el.getBoundingClientRect().top - 
				getComputedValue(el, 'marginTop') -
				React.findDOMNode(this).getBoundingClientRect().top;
		},

		getBottom: function(el) {
			return el.getBoundingClientRect().bottom +
				getComputedValue(el, 'marginBottom') -
				React.findDOMNode(this).getBoundingClientRect().top;
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
					el.getBoundingClientRect().top +
					getComputedValue(scrollParent, 'borderTop');
			}
		},

		setScroll: function(y) {
			var scrollParent = this.getScrollParent(),
				el = React.findDOMNode(this);

			if (scrollParent !== el) {
				y += (scrollParent.scrollTop -
					(scrollParent.getBoundingClientRect().top -
					el.getBoundingClientRect().top +
					getComputedValue(scrollParent, 'borderTop')));
			}
			y = Math.min(scrollParent.scrollHeight, Math.max(0, y));
			if (scrollParent === window) window.scrollTo(0, y);
			else scrollParent.scrollTop = y;
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
				['div',
					{ ref: 'above', style: {
						position: 'relative',
						height: (this.pState.spaceAbove + 1000)
					} }
				],
				['div', {
					ref: 'items'
				}].concat(this.props.children),
				['div',
					{ ref: 'below', style: {
						clear: 'both',
						position: 'relative',
						height: (this.pState.spaceBelow + 1000)
						/* temporarily adds extra space to avoid jumps
						   when the total height of all items decreased
						   during the update */
					} }
				]
			]);
		}
	});
});
