"use strict";

class GM {
	static #w = 0;
	static #h = 0;
	static #cnv = null;
	static #ctx = null;
	static #time = 0;
	static #stime = 0;
	static #ftime = 0;
	static #continue = false;
	static #mouseLeft = false;
	static #mouseRadian = 0;

	// .........................................................................
	static #audioCtx = null;
	static #audioGain = null;
	static #buffers = {
		$zombieKilled: null,
		$bulletShot: null,
	};

	// .........................................................................
	static $ontime = () => {};
	static $onkill = () => {};
	static $ongameover = () => {};
	static #nbKills = 0;
	static #currWave = 0;

	// .........................................................................
	static #turretRadius = 16;
	static #turretLastShot = 0;
	static #turretReloadTime = .1;

	// .........................................................................
	static #bullets = [];
	static #bulletSpeed = 800;
	static #bulletDuration = .5;

	// .........................................................................
	static #zombies = [];
	static #zombieSpeed = 50;
	static #zombieRadius = 16;
	static #zombiesPerWave = 0;
	static #zombiesPerWaveInit = 10;

	// .........................................................................
	static $init( cnv, w, h ) {
		return new Promise( res => {
			GM.#cnv = cnv;
			GM.#cnv.width = GM.#w = w;
			GM.#cnv.height = GM.#h = h;
			GM.#ctx = cnv.getContext( "2d" );
			cnv.onpointermove = GM.#onpointermove;
			cnv.onpointerdown = GM.#onpointerdown;
			cnv.onpointerup = GM.#onpointerup;
			cnv.oncontextmenu = () => false;
			GM.#audioCtx = new AudioContext();
			GM.#audioGain = GM.#audioCtx.createGain();
			GM.#audioGain.connect( GM.#audioCtx.destination );
			Promise.all( [
				GM.#loadBuffer( "killed.wav" ),
				GM.#loadBuffer( "laser-shot.wav" ),
			] ).then( buffers => {
				GM.#buffers.$zombieKilled = buffers[ 0 ];
				GM.#buffers.$bulletShot = buffers[ 1 ];
				res();
			} );
		} );
	}
	static $start() {
		GM.$ontime( 0 );
		GM.$onwave( GM.#currWave = 0 );
		GM.$onkill( GM.#nbKills = 0 );
		GM.#zombiesPerWave = GM.#zombiesPerWaveInit;
		GM.#zombies = [];
		GM.#bullets = [];
		GM.#time =
		GM.#stime = Date.now() / 1000;
		GM.#continue = true;
		GM.#frame();
	}
	static $stop() {
		GM.#continue = false;
	}
	static $volume( v ) {
		GM.#audioGain.gain.value = v;
	}

	// .........................................................................
	static #onpointermove( e ) {
		GM.#mouseRadian = GM.#utilGetRad( GM.#w / 2, GM.#h / 2, e.offsetX, e.offsetY );
	}
	static #onpointerdown( e ) {
		if ( e.button === 0 ) {
			GM.#cnv.setPointerCapture( e.pointerId );
			GM.#mouseLeft = true;
		}
	}
	static #onpointerup( e ) {
		if ( e.button === 0 ) {
			GM.#cnv.releasePointerCapture( e.pointerId );
			GM.#mouseLeft = false;
		}
	}

	// .........................................................................
	static #loadBuffer( url ) {
		return fetch( url )
			.then( res => res.arrayBuffer() )
			.then( arr => GM.#audioCtx.decodeAudioData( arr ) );
	}
	static #playSound( buf ) {
		const absn = GM.#audioCtx.createBufferSource();

		absn.buffer = buf;
		absn.connect( GM.#audioGain );
		absn.start();
	}

	// .........................................................................
	static #frame() {
		const time = Date.now() / 1000;

		GM.#ftime = time - GM.#time;
		GM.#update();
		GM.#draw();
		GM.$ontime( time - GM.#stime );
		GM.#time = time;
		if ( GM.#continue ) {
			requestAnimationFrame( GM.#frame );
		}
	}

	// .........................................................................
	static #update() {
		GM.#updateTurretShot();
		GM.#updateBullets();
		GM.#collisionBullets();
		GM.#updateZombies();
	}
	static #updateTurretShot() {
		if ( GM.#mouseLeft && GM.#time - GM.#turretLastShot >= GM.#turretReloadTime ) {
			GM.#turretLastShot = GM.#time;
			GM.#bullets.push( {
				x: +Math.sin( GM.#mouseRadian ) * ( GM.#turretRadius + 8 ),
				y: -Math.cos( GM.#mouseRadian ) * ( GM.#turretRadius + 8 ),
				vx: +Math.sin( GM.#mouseRadian ) * GM.#bulletSpeed,
				vy: -Math.cos( GM.#mouseRadian ) * GM.#bulletSpeed,
				rad: GM.#mouseRadian,
				time: GM.#time,
			} );
			GM.#playSound( GM.#buffers.$bulletShot );
		}
	}
	static #updateBullets() {
		GM.#bullets = GM.#bullets.filter( b => {
			b.x += b.vx * GM.#ftime;
			b.y += b.vy * GM.#ftime;
			return GM.#time - b.time < GM.#bulletDuration;
		} );
	}
	static #collisionBullets() {
		GM.#bullets = GM.#bullets.filter( b => {
			const z = GM.#zombies.find( z => {
				const dist = Math.abs( b.x - z.x ) ** 2 + Math.abs( b.y - z.y ) ** 2;
				const coll = dist <= ( GM.#zombieRadius * z.hpMax / 100 ) ** 2;

				if ( coll ) {
					z.vx += b.vx / .5;
					z.vy += b.vy / .5;
					if ( ( z.hp -= 25 ) <= 0 ) {
						GM.#playSound( GM.#buffers.$zombieKilled );
					}
				}
				return coll;
			} );

			return !z;
		} );
	}
	static #updateZombies() {
		GM.#zombies = GM.#zombies.filter( z => {
			if ( z.hp <= 0 ) {
				GM.$onkill( ++GM.#nbKills );
			} else {
				const zrad = GM.#utilGetRad( z.x, z.y, 0, 0 );
				const dirx = +Math.sin( zrad ) * GM.#zombieSpeed;
				const diry = -Math.cos( zrad ) * GM.#zombieSpeed;

				z.vx += ( dirx - z.vx ) / 10;
				z.vy += ( diry - z.vy ) / 10;
				z.x += z.vx * GM.#ftime;
				z.y += z.vy * GM.#ftime;
				if ( Math.abs( z.x ) ** 2 + Math.abs( z.y ) ** 2 < 10 ) {
					GM.$stop();
					GM.$ongameover();
				}
			}
			return z.hp > 0;
		} );
		if ( GM.#zombies.length === 0 ) {
			GM.#newWaveZombies();
		}
	}
	static #newWaveZombies() {
		for ( let i = 0; i < GM.#zombiesPerWave; ++i ) {
			const rad = Math.random() * 2 * Math.PI;
			const dist = Math.random() * 300;
			const hpMax = 100 + Math.random() * 100;

			GM.#zombies.push( {
				hpMax,
				hp: hpMax,
				x: Math.sin( rad ) * ( 200 + dist ),
				y: Math.cos( rad ) * ( 200 + dist ),
				vx: 0,
				vy: 0,
			} );
		}
		GM.#zombiesPerWave *= 1.25;
		GM.$onwave( ++GM.#currWave );
	}

	// .........................................................................
	static #draw() {
		GM.#ctx.clearRect( 0, 0, GM.#w, GM.#h );
		GM.#ctx.save();
			GM.#ctx.translate( GM.#w / 2, GM.#h / 2 );
			GM.#drawTurret();
			GM.#drawZombies();
			GM.#drawBullets();
		GM.#ctx.restore();
	}
	static #drawBullets() {
		GM.#ctx.fillStyle =
		GM.#ctx.strokeStyle = "#ffa";
		GM.#bullets.forEach( b => {
			GM.#ctx.beginPath();
				GM.#ctx.arc( b.x, b.y, 3, 0, 2 * Math.PI );
			GM.#ctx.fill();
		} );
	}
	static #drawTurret() {
		GM.#ctx.fillStyle =
		GM.#ctx.strokeStyle = "#fff";
		GM.#ctx.save();
			GM.#ctx.rotate( GM.#mouseRadian );
			GM.#ctx.fillRect( -3, -8 - GM.#turretRadius, 6, 8  );
			GM.#ctx.beginPath();
				GM.#ctx.arc( 0, 0, GM.#turretRadius, 0, 2 * Math.PI );
			GM.#ctx.fill();
		GM.#ctx.restore();
	}
	static #drawZombies() {
		GM.#ctx.fillStyle =
		GM.#ctx.strokeStyle = "green";
		GM.#zombies.forEach( z => {
			const r = GM.#zombieRadius * ( z.hpMax / 100 );

			GM.#ctx.globalAlpha = .2;
			GM.#ctx.beginPath();
				GM.#ctx.arc( z.x, z.y, r * ( z.hp / z.hpMax ), 0, 2 * Math.PI );
			GM.#ctx.fill();

			GM.#ctx.lineWidth = 2;
			GM.#ctx.globalAlpha = 1;
			GM.#ctx.beginPath();
				GM.#ctx.arc( z.x, z.y, r, 0, 2 * Math.PI );
			GM.#ctx.stroke();
		} );
	}

	// .........................................................................
	static #utilGetRad( x, y, tarX, tarY ) {
		const xx = tarX - x;
		const yy = tarY - y;

		return Math.atan2( xx, -yy );
	}
}
