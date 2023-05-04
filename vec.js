"use strict";

class Vec {
	x = 0;
	y = 0;

	constructor( x, y ) {
		this.set( x, y );
	}

	// .........................................................................
	static normalize( v ) {
		return ( new Vec( v ) ).normalize();
	}
	static tangent( v ) {
		return new Vec( -this.y, this.x );
	}
	static add( v, v2 ) {
		return ( new Vec( v ) ).add( v2 );
	}
	static mulScalar( v, v2 ) {
		return ( new Vec( v ) ).mulScalar( v2 );
	}

	// .........................................................................
	set( x, y ) {
		this.x = y !== undefined ? x : x.x;
		this.y = y !== undefined ? y : x.y;
		return this;
	}
	dot( v2 ) {
		return this.x * v2.x + this.y * v2.y;
	}
	angle() {
		return Math.atan2( this.y, this.x ) + Math.PI / 2;
	}
	length() {
		return Math.sqrt( this.lengthSq() );
	}
	lengthSq() {
		return this.x ** 2 + this.y ** 2;
	}
	lengthSqWith( v ) {
		return ( this.x - v.x ) ** 2 + ( this.y - v.y ) ** 2;
	}
	normalize() {
		const len = this.length();

		this.x /= len;
		this.y /= len;
		return this;
	}
	add( v2 ) {
		this.x += v2.x;
		this.y += v2.y;
		return this;
	}
	sub( v2 ) {
		this.x -= v2.x;
		this.y -= v2.y;
		return this;
	}
	addScalar( n ) {
		this.x += n;
		this.y += n;
		return this;
	}
	mulScalar( n ) {
		this.x *= n;
		this.y *= n;
		return this;
	}
}
