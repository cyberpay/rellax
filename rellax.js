// ------------------------------------------
// Rellax.js
// Buttery smooth parallax library
// MIT license
//
// Modified by Yair Even-Or (yaireo on GitHub) Based on "Rellax" - https://github.com/dixonandmoe/rellax
// Code is re-written by my standards of how a Contructor Object should be written
// ------------------------------------------

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.Rellax = factory();
  }
}(this, function(){
  "use strict";

  // check what requestAnimationFrame to use, and if
  // it's not supported, use the onscroll event
  var loop = window.requestAnimationFrame ||
             window.webkitRequestAnimationFrame ||
             window.mozRequestAnimationFrame ||
             window.msRequestAnimationFrame ||
             window.oRequestAnimationFrame ||
             function(callback){ setTimeout(callback, 1000 / 60); };

  // check which transform property to use
  var transformProp = window.transformProp || (function(){
    var testEl = document.createElement('p');
    if (testEl.style.transform === null) {
      var vendors = ['Webkit', 'Moz', 'ms'];
      for (var vendor in vendors)
        if (testEl.style[ vendors[vendor] + 'Transform' ] !== undefined)
          return vendors[vendor] + 'Transform';
    }
    return 'transform';
  })();

  // Main constructor
  var Rellax = function(el, options){
    var that = this;

    el = el || '.rellax';

    this.state = {};

    this.DOM    = {};
    this.pos    = {x:0, y:0};
    this.screen = {x:0, y:0};
    this.blocks = [];
    this.pause  = false;

    // Allow to recalculate the initial values whenever we want
    this.refresh = this.init;

    // Default Settings
    this.options = {
      speed      : -2,
      center     : false,
      wrapper    : null,
      round      : true,
      vertical   : true,
      horizontal : false,
      callback   : function(){},
    };

    // User defined options (might have more in the future)
    if (options){
      Object.keys(options).forEach(function(key){
        that.options[key] = options[key];
      });
    }

    // check if el is a Node, if not then its probably a String
    this.DOM.elements = el instanceof HTMLElement ? [el] : document.querySelectorAll(el);

    if( !this.DOM.elements.length ){
      throw new Error("The elements you're trying to select don't exist.");
    }

    // Has a wrapper and it exists
    if( this.options.wrapper && !this.options.wrapper.nodeType ){
        this.DOM.wrapper = document.querySelector(self.options.wrapper);

        if( !this.DOM.wrapper )
          throw new Error("The wrapper you're trying to use don't exist.");
    }

    this.init();

    // Re-init on window resize
    window.addEventListener('resize', this.onwindowResize.bind(this));
  }

  Rellax.prototype = {
    onwindowResize(){
      this.init()
    },

    // Get and cache initial position of all elements
    cacheBlocks : function() {
      for( var i = 0; i < this.DOM.elements.length; i++ ){
        var block = this.createBlock( this.DOM.elements[i] );
        this.blocks.push(block);
      }
    },

      // Let's kick this script off
    // Build array for cached element values
    init : function() {
      for (var i = 0; i < this.blocks.length; i++){
        this.DOM.elements[i].style.cssText = this.blocks[i].style;
      }

      this.blocks = [];

      this.screen.y = window.innerHeight || document.documentElement.clientHeight;
      this.screen.x = window.innerWidth  || document.documentElement.clientWidth;
      this.setPosition();
      this.cacheBlocks();
      this.animate();
      this.update();
    },

    // Cache the parallax blocks'
    createBlock : function( el ){
      var attr = {
            percentage : el.getAttribute( 'data-rellax-percentage' ),
            speed      : el.getAttribute( 'data-rellax-speed' ),
            zIndex     : el.getAttribute( 'data-rellax-zindex' ) || 0
          },

          // initializing at scrollY = 0 (top of browser), scrollX = 0 (left of browser)
          // ensures elements are positioned based on HTML layout.
          //
          // If the element has the percentage attribute, the posY and posX needs to be
          // the current scroll position's value, so that the elements are still positioned based on HTML layout
          wrapperPosY = this.DOM.wrapper ? this.DOM.wrapper.scrollTop : (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop),
          posY        = this.options.vertical ? ( attr.percentage || this.options.center ? wrapperPosY : 0 ) : 0,
          posX        = this.options.horizontal ? ( attr.percentage || this.options.center ? (window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft) : 0 ) : 0,

          blockTop    = posY + el.getBoundingClientRect().top,
          blockLeft   = posX + el.getBoundingClientRect().left,

          blockHeight = el.clientHeight || el.offsetHeight || el.scrollHeight,
          blockWidth  = el.clientWidth  || el.offsetWidth  || el.scrollWidth,

          // apparently parallax equation everyone uses
          percentageY = this.options.center ? 0.5 : attr.percentage ? attr.percentage : (posY - blockTop + this.screen.y) / (blockHeight + this.screen.y),
          percentageX = this.options.center ? 0.5 : attr.percentage ? attr.percentage : (posX - blockLeft + this.screen.x) / (blockWidth + this.screen.x),

          // Optional individual block speed as data attr, otherwise global speed
          speed = attr.speed ? attr.speed : this.options.speed,

          bases = this.updatePosition(percentageX, percentageY, speed),

          // ~~Store non-translate3d transforms~~
          // Store inline styles and extract transforms
          style = el.style.cssText,
          transform = '',
          index, trimmedStyle, delimiter;

      // Check if there's an inline styled transform
      if( style.indexOf('transform') >= 0 ){
        // Get the index of the transform
        index = style.indexOf('transform');

        // Trim the style to the transform point and get the following semi-colon index
        trimmedStyle = style.slice(index);
        delimiter = trimmedStyle.indexOf(';');

        // Remove "transform" string and save the attribute
        if (delimiter == -1)
          delimiter = undefined;
          transform = " " + trimmedStyle.slice(11, delimiter).replace(/\s/g,'');
      }

      return {
        node      : el,
        baseX     : bases.x,
        baseY     : bases.y,
        top       : blockTop,
        left      : blockLeft,
        height    : blockHeight,
        width     : blockWidth,
        speed     : speed,
        style     : style,
        transform : transform,
        zIndex    : attr.zIndex
      }
    },

    // set scroll position (posY, posX)
    // side effect method is not ideal, but okay for now
    // returns true if the scroll changed, false if nothing happened
    setPosition : function(){
      var prevPos = {
        x : this.pos.x,
        y : this.pos.y
      };

      this.pos.y = this.DOM.wrapper ? this.DOM.wrapper.scrollTop : (document.documentElement || document.body.parentNode || document.body).scrollTop || window.pageYOffset;

      // scroll changed, return true
      if( prevPos.y != this.pos.y && this.options.vertical )
        return true;

      // scroll changed, return true
      if( prevPos.x != this.pos.x && this.options.horizontal )
        return true;

      // scroll did not change
      return false;
    },

    // Ahh a pure function, gets new transform value
    // based on scrollPosition and speed
    // Allow for decimal pixel values
    updatePosition : function( percentageX, percentageY, speed ){
      var that = this,
          calc = function(a){
            return that.options.round ? Math.round(values[a]) : Math.round(values[a] * 100) / 100;
          },
          values = {
            x : speed * (100 * (1 - percentageX)),
            y : speed * (100 * (1 - percentageY))
          },
          result = {
            x : calc('x'),
            y : calc('y')
          };

      return result;
    },

    // Loop
    update : function(){
      if( this.setPosition() && this.pause === false ){
        this.animate();
      }

      // loop again
      loop(this.update.bind(this));
    },

    // Transform3d on parallax element
    animate : function(){
      var percentages = {},
          positions, positionX, positionY, zIndex, translate;

      for( var i = 0; i < this.DOM.elements.length; i++ ){
        percentages.y = ((this.pos.y - this.blocks[i].top + this.screen.y) / (this.blocks[i].height + this.screen.y)),
        percentages.x = ((this.pos.x - this.blocks[i].left + this.screen.x) / (this.blocks[i].width + this.screen.x));

        // Subtracting initialize value, so element stays in same spot as HTML
        positions = this.updatePosition(percentages.x, percentages.y, this.blocks[i].speed);// - blocks[i].baseX;

        positionY = positions.y - this.blocks[i].baseY;
        positionX = positions.x - this.blocks[i].baseX;

        this.state.position = positions;

        zIndex = this.blocks[i].zIndex;

        // Move that element
        // (Set the new translation and append initial inline transforms.)
        translate = 'translate3d(' + (this.options.horizontal ? positionX : '0') + 'px,' + (this.options.vertical ? positionY : '0') + 'px,' + zIndex + 'px) ' + this.blocks[i].transform;
        this.DOM.elements[i].style[transformProp] = translate;
      }

      this.options.callback( this );
    },

    // destroy instance
    destroy : function(){
      for( var i = 0; i < this.DOM.elements.length; i++ )
        this.DOM.elements[i].style.cssText = this.blocks[i].style;

      this.pause = true;
      window.removeEventListener('resize', this.onwindowResize.bind(this));
    }
  };

  return Rellax;
}));
