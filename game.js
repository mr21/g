"use strict";

class GM {
	static #w = 0;
	static #h = 0;
	static #cnv = null;
	static #ctx = null;
	static #time = 0;
	static #pauseTime = 0;
	static #startTime = 0;
	static #frameTime = 0;
	static #playing = false;
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
	static $onpause = () => {};
	static $onwave = () => {};
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
	static #zombieSpeed = 25;
	static #zombieRadius = 10;
	static #zombiesPerWave = 0;
	static #zombiesPerWaveInit = 10;

	// .........................................................................
	static $init( cnv, w, h ) {
		return new Promise( res => {
			GM.#cnv = cnv;
			GM.#cnv.width = GM.#w = w;
			GM.#cnv.height = GM.#h = h;
			GM.#ctx = cnv.getContext( "2d" );
			cnv.onblur = GM.$pause;
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
	static $start( { wave } ) {
		GM.$ontime( 0 );
		GM.$onwave( GM.#currWave = wave );
		GM.$onkill( GM.#nbKills = 0 );
		GM.#zombiesPerWave = GM.#zombiesPerWaveInit;
		for ( let i = 0; i < wave; ++i ) {
			GM.#zombiesPerWave *= 1.25;
		}
		GM.#zombies = [];
		GM.#bullets = [];
		GM.#time =
		GM.#startTime = Date.now() / 1000;
		GM.#playing = true;
		GM.#cnv.focus();
		GM.#frame();
	}
	static $pause() {
		if ( GM.#playing ) {
			GM.#playing = false;
			GM.#pauseTime = GM.#time;
			GM.$onpause();
		}
	}
	static $stop() {
		GM.#playing = false;
	}
	static $continue() {
		GM.#time = Date.now() / 1000;
		GM.#startTime += GM.#time - GM.#pauseTime;
		GM.#playing = true;
		GM.#cnv.focus();
		GM.#frame();
	}
	static $volume( v ) {
		GM.#audioGain.gain.value = v;
	}

	// .........................................................................
	static #onpointermove( e ) {
		const x = e.offsetX - GM.#w / 2;
		const y = e.offsetY - GM.#h / 2;

		GM.#mouseRadian = Math.atan2( y, x ) + Math.PI / 2;
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

		GM.#frameTime = time - GM.#time;
		GM.#update();
		GM.#draw();
		GM.$ontime( time - GM.#startTime );
		GM.#time = time;
		if ( GM.#playing ) {
			requestAnimationFrame( GM.#frame );
		}
	}

	// .........................................................................
	static #update() {
		if ( GM.#zombies.length === 0 ) {
			GM.#newWaveZombies();
		}
		GM.#updateTurretShot();
		GM.#moveBullets();
		GM.#collisionBullets();
		GM.#rmDeadZombies();
		GM.#moveZombies();
		GM.#collisionZombies();
		GM.#checkGameover();
	}
	static #checkGameover() {
		if ( GM.#zombies.find( z => z.pos.lengthSq() < ( GM.#turretRadius * 2 ) ** 2 ) ) {
			GM.$stop();
			GM.$ongameover();
		}
	}
	static #updateTurretShot() {
		if ( GM.#mouseLeft && GM.#time - GM.#turretLastShot >= GM.#turretReloadTime ) {
			GM.#turretLastShot = GM.#time;
			GM.#bullets.push( {
				time: GM.#time,
				pos: new Vec(
					+Math.sin( GM.#mouseRadian ) * ( GM.#turretRadius + 8 ),
					-Math.cos( GM.#mouseRadian ) * ( GM.#turretRadius + 8 ),
				),
				vel: new Vec(
					+Math.sin( GM.#mouseRadian ) * GM.#bulletSpeed,
					-Math.cos( GM.#mouseRadian ) * GM.#bulletSpeed,
				),
			} );
			GM.#playSound( GM.#buffers.$bulletShot );
		}
	}
	static #moveBullets() {
		GM.#bullets = GM.#bullets.filter( b => {
			b.pos.add( Vec.mulScalar( b.vel, GM.#frameTime ) );
			return GM.#time - b.time < GM.#bulletDuration;
		} );
	}
	static #collisionBullets() {
		GM.#bullets = GM.#bullets.filter( b => {
			const z = GM.#zombies.find( z => GM.#collisionBulletVsZombieTest( b, z ) );

			if ( z ) {
				GM.#collisionBulletVsZombieUpdate( b, z );
			}
			return !z;
		} );
	}
	static #collisionBulletVsZombieTest( b, z ) {
		return b.pos.lengthSqWith( z.pos ) <= ( GM.#zombieRadius * z.hpMax / 100 ) ** 2;
	}
	static #collisionBulletVsZombieUpdate( b, z ) {
		z.vel.add( Vec.mulScalar( b.vel, GM.#easeInCirc( 1 - ( z.hpMax - 100 ) / 200 ) ) );
		if ( ( z.hp -= 75 ) <= 0 ) {
			GM.#playSound( GM.#buffers.$zombieKilled );
		}
	}
	static #collisionZombies() {
		GM.#zombies.forEach( z => {
			const z2 = GM.#zombies.find( z2 => GM.#collisionZombieVsZombieTest( z, z2 ) );

			if ( z2 ) {
				GM.#zombieCollisionResponce( z, z2 );
			}
		} );
	}
	static #collisionZombieVsZombieTest( z, z2 ) {
		return z !== z2 &&
			z.pos.lengthSqWith( z2.pos ) <=
			(
				GM.#calcZombieRadius( z2 ) +
				GM.#calcZombieRadius( z )
			) ** 2;
	}
	static #zombieCollisionResponce( z, z2 ) {
		const unitNormal = ( new Vec( z.pos ) ).sub( z2.pos ).normalize();
		const unitTangent = Vec.tangent( unitNormal );

		const a = z.vel;
		const b = z2.vel;
		const ar = GM.#calcZombieRadius( z );
		const br = GM.#calcZombieRadius( z2 );

		const correction = Vec.mulScalar( unitNormal, ar + br );
		const newV = Vec.add( z2.pos, correction );
		z.pos = newV;

		const a_n = a.dot( unitNormal );
		const b_n = b.dot( unitNormal );
		const a_t = a.dot( unitTangent );
		const b_t = b.dot( unitTangent );

		const a_n_final = ( a_n * ( ar - br ) + 2 * br * b_n ) / ( ar + br );
		const b_n_final = ( b_n * ( br - ar ) + 2 * ar * a_n ) / ( ar + br );

		const a_n_after = Vec.mulScalar( unitNormal, a_n_final );
		const b_n_after = Vec.mulScalar( unitNormal, b_n_final );
		const a_t_after = Vec.mulScalar( unitTangent, a_t );
		const b_t_after = Vec.mulScalar( unitTangent, b_t );

		const a_after = Vec.add( a_n_after, a_t_after );
		const b_after = Vec.add( b_n_after, b_t_after );

		z.rel = a_after;
		z2.rel = b_after;
	}
	static #rmDeadZombies() {
		const newZombies = GM.#zombies.filter( z => z.hp > 0 );
		const diff = GM.#zombies.length - newZombies.length;

		GM.#zombies = newZombies;
		if ( diff > 0 ) {
			GM.#nbKills += diff;
			GM.$onkill( GM.#nbKills );
		}
	}
	static #moveZombies() {
		GM.#zombies.forEach( z => {
			const dir = Vec.normalize( z.pos ).mulScalar( -GM.#zombieSpeed );

			z.vel.add( dir.sub( z.vel ).mulScalar( .1 ) );
			z.pos.add( Vec.mulScalar( z.vel, GM.#frameTime ) );
		} );
	}
	static #newWaveZombies() {
		for ( let i = 0; i < GM.#zombiesPerWave; ++i ) {
			const rad = Math.random() * 2 * Math.PI;
			const dist = Math.random() * 300;
			const hpMax = 100 + Math.random() * 200;

			GM.#zombies.push( {
				hpMax,
				hp: hpMax,
				vel: new Vec( 0, 0 ),
				pos: new Vec(
					Math.sin( rad ) * ( 200 + dist ),
					Math.cos( rad ) * ( 200 + dist ),
				),
			} );
		}
		GM.#zombiesPerWave *= 1.25;
		GM.$onwave( ++GM.#currWave );
	}

	// .........................................................................
	static #calcZombieRadius( z ) {
		return GM.#zombieRadius * ( z.hpMax / 100 );
	}
	static #easeInCirc( x ) {
		return 1 - Math.sqrt( 1 - Math.pow( x, 2 ) );
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
				GM.#ctx.arc( b.pos.x, b.pos.y, 3, 0, 2 * Math.PI );
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
			const r = GM.#calcZombieRadius( z );

			GM.#ctx.globalAlpha = .2;
			GM.#ctx.beginPath();
				GM.#ctx.arc( z.pos.x, z.pos.y, r * ( z.hp / z.hpMax ), 0, 2 * Math.PI );
			GM.#ctx.fill();

			GM.#ctx.lineWidth = 2;
			GM.#ctx.globalAlpha = 1;
			GM.#ctx.beginPath();
				GM.#ctx.arc( z.pos.x, z.pos.y, r, 0, 2 * Math.PI );
			GM.#ctx.stroke();
		} );
	}
}
