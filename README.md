endless
=======

A bi-directional infinite scroll library that works with jQuery or Zepto and supports lazy loading, element recycling and deep integration between scrolling lists and the rest of the application.

Installation
------------
The best way is to use bower.
```bash
bower install endless
```
Alternately, you may copy and include the file `endless.js` to your project. Make sure you check for updates occasionally.

API
---
### Setup ###
```javascript
$(container).endless(options);
```
The options object must at least contain a `getItem` callback.

The container must be scrollable, and may contain the following children, identified by class name. Class names may be hyphenated or camelCase. All of these are optional.
 - `endless-above`: a (preferably) empty div used as a spacing element. Should have a background image or animation indicating that items are loading. It may be resized.
 - `endless-items`: a container for items. It may contain a template for a single item — if this is provided, `getItem` will always get an item to recycle. The template will be removed from the DOM during setup.
 - `endless-empty`: content to display when it’s known that there are no items.
 - `endless-loading`: content to display while waiting for the first item.
 - `endless-below`: The antipodal counterpart of `endless-above`.

### Options ###
 - `getItem`, **mandatory**, a function that is invoked when a new item needs to be rendered. It will receive three arguments: `index`, an integer which may be positive or negative, `template`, a DOM element that may be reused, and an optional `callback`. The function may return a rendered item, `false` to indicate that the end of the list has been crossed, or `true` to indicate that the item needs to be loaded asynchronously. In the final case, the callback must be invoked with one argument: the rendered item or `false` if the list has ended.
 - `columns`, a positive integer. When greater than 1, items are displayed in a masonry-like grid.
 - `ramp`, the number of pixels above and below the viewport that should be filled with items so that users don’t see loading indications while scrolling slowly. 
 - `onScroll`, a function that is invoked when the scroll position changes. It will receive one argument, `position` which may be an integer or a string ( `"top"` or `"bottom"`). **Important**: Use this instead of attaching handlers to the container element’s `scroll` event; such handlers will be fired incorrectly when endless adds or removes elements, and may severly degrade performance due to layout thrashing.

### Methods ###
 - `$(container).scrollTo(position)` accepts an integer, `"top"` or `"bottom"`
 - `$(container).isInView(index)` returns a boolean.
 - `$(container).update(index)` notifies endless that a particular item is to be updated. An immediate call to `getItem` with that index (and the current element there) is to be expected if it is in view.
 - `$(container).updated(index)` notifies endless that an item has been updated directly on the DOM. Doing this is essential if the update changes the dimensions of the item.
 - `$(container).updateAll()` should be called items need to be inserted or removed at an index that is in view.

### Notes ###
Each element is identified by its integer **index**, which can be negative, zero or positive. The first call to `getItem` during setup will get the index 0.

The scroll **position** of the list may be `"top"`, `"bottom"`, or the index of the first visible item.
