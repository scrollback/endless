endless
=======

A simple, versatile and fast infinite scroll component for React.

Supports:
- Removal and recycling of DOM elements
- Bi-directional scrolling
- Starting at the top, bottom or somewhere in the middle
- Unknown total number or heights of elements
- Elements that are different heights
- Elements laid out on a grid

Unlike other infinite scroll implementations, endless is intentionally simple:
it does not decide which items to show or control the process of fetching them.

Instead, it is a simple container for items you put in it, with two important
additions:

 - It gives you a callback, onScroll, which describes which items are currently
   in view. Based on this, you can decide to load more items and re-render.
   Despite the name, this callback is fired for any event that causes 
 - When and Endless element is re-rendered, it adjusts the scroll position so
   that any items that have not changed appear in the same place. It adds empty
   space above and below the items to minimize the scrollbars jumping.

Installation
------------
The best way is to use bower or npm
```bash
bower install endless
```

```endless
npm install endless-react
```

Alternately, you may copy and include the file `endless.js` to your project. If
you do this, make sure you check for updates occasionally.

Usage
-----
In your component’s render function, use Endless as any other React Component.
The list items go into the `items` property, and you can attach callbacks on
events like scroll.

```jsx
render: function () {
  var items = [<Item key='1'/>, <Item key='2'/>];
  return <Endless items={items} onScroll={this.onScroll}/>;
},
onScroll: function (key, numItemsBefore, numItemsAfter) {
	/* Do the thing. */
}
```

API
---
The following properties are quite useful:

### items ###
An array of React elements or JSONML descriptions of react elements.

### onScroll ###
A function to be called whenever the list of visible items changes.

### atTop ###
A boolean, which should be true to indicate that there are no more items above
the first one in items.

### atBottom ###
A boolean, which should be true to indicate that there are no more items below
the last one in items.

### onMount ###
A function to be called when Endless is first rendered. Use this to set the 
initial scroll position.

### onUnmount ###
A function to be called when Endless is removed from the DOM.

### margin ###
The number of pixels of extra scroll space to add above or below, when the actual top or bottom of the list has not been reached yet. Default
