import * as THREE from '../libs/build/three.module.js';
import {SkinnedMeshPositionReader} from './SkinnedMeshPositionReader.js';
import {GPUComputationRenderer} from '../libs/examples/jsm/misc/GPUComputationRenderer.js';

const Particles = (renderer, scene, camera, skinnedMesh, _options) => {

	const options = {
		texture_width:128,
		texture_height:128
	};

	Object.assign(options, _options);

	const {texture_width, texture_height} = options;


	const AMOUNT = texture_width * texture_height;

	let gpuCompute,  material, mesh
	let _shader, _shader2;
	let isMouseDown = false;

	let variables = {
    	TEXTURE_WIDTH:texture_width,
    	TEXTURE_HEIGHT:texture_height,
    	AMOUNT:AMOUNT
    }

    let computeVars = {

    }

    let posUniforms, velUniforms, particleUniforms
	
	const rttTextures = {

	}

	let randomTexture, originalTexture;
	let oldRtt;
	let speedOffset = .5;

	const skmr = SkinnedMeshPositionReader(scene, {

	});

	skmr.init(skinnedMesh);
	
	const noise = `
		vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0;  }

		vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0;  }

		vec4 permute(vec4 x) {  return mod289(((x*34.0)+1.0)*x);  }

		vec4 taylorInvSqrt(vec4 r) {  return 1.79284291400159 - 0.85373472095314 * r;}

		float snoise(vec3 v) { 
			const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
			const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

			vec3 i  = floor(v + dot(v, C.yyy) );
			vec3 x0 =   v - i + dot(i, C.xxx) ;

			vec3 g = step(x0.yzx, x0.xyz);
			vec3 l = 1.0 - g;
			vec3 i1 = min( g.xyz, l.zxy );
			vec3 i2 = max( g.xyz, l.zxy );

			vec3 x1 = x0 - i1 + C.xxx;
			vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
			vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

			i = mod289(i); 
			vec4 p = permute( permute( permute( 
								 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
							 + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
							 + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

			float n_ = 0.142857142857; // 1.0/7.0
			vec3  ns = n_ * D.wyz - D.xzx;

			vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

			vec4 x_ = floor(j * ns.z);
			vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

			vec4 x = x_ *ns.x + ns.yyyy;
			vec4 y = y_ *ns.x + ns.yyyy;
			vec4 h = 1.0 - abs(x) - abs(y);

			vec4 b0 = vec4( x.xy, y.xy );
			vec4 b1 = vec4( x.zw, y.zw );

			vec4 s0 = floor(b0)*2.0 + 1.0;
			vec4 s1 = floor(b1)*2.0 + 1.0;
			vec4 sh = -step(h, vec4(0.0));

			vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
			vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

			vec3 p0 = vec3(a0.xy,h.x);
			vec3 p1 = vec3(a0.zw,h.y);
			vec3 p2 = vec3(a1.xy,h.z);
			vec3 p3 = vec3(a1.zw,h.w);

			vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
			p0 *= norm.x;
			p1 *= norm.y;
			p2 *= norm.z;
			p3 *= norm.w;

			vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
			m = m * m;
			return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
																		dot(p2,x2), dot(p3,x3) ) );
		}

		vec3 snoiseVec3( vec3 x ){

			float s  = snoise(vec3( x ));
			float s1 = snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ));
			float s2 = snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 ));
			vec3 c = vec3( s , s1 , s2 );
			return c;

		}


		vec3 curlNoise( vec3 p ){
			
			const float e = .1;
			vec3 dx = vec3( e   , 0.0 , 0.0 );
			vec3 dy = vec3( 0.0 , e   , 0.0 );
			vec3 dz = vec3( 0.0 , 0.0 , e   );

			vec3 p_x0 = snoiseVec3( p - dx );
			vec3 p_x1 = snoiseVec3( p + dx );
			vec3 p_y0 = snoiseVec3( p - dy );
			vec3 p_y1 = snoiseVec3( p + dy );
			vec3 p_z0 = snoiseVec3( p - dz );
			vec3 p_z1 = snoiseVec3( p + dz );

			float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
			float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
			float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;

			const float divisor = 1.0 / ( 2.0 * e );
			return normalize( vec3( x , y , z ) * divisor );

		}
	`;

	const computeVelShader = `
			
		uniform float uTime;
		uniform sampler2D textureRandom;
		uniform sampler2D textureOriginalPosition;
		uniform float uMinRadius;
		uniform float uMaxRadius;
		uniform vec3 uHit;
		uniform float uIsMouseDown;

		${noise}

		const float PI = 3.141592653;

		vec2 rotate(vec2 v, float a) {
			float s = sin(a);
			float c = cos(a);
			mat2 m = mat2(c, -s, s, c);
			return m * v;
		}

		void main() {
		    vec2 uv = gl_FragCoord.xy / resolution.xy;
		    
		    vec3 pos = texture2D( texturePosition, uv ).xyz;
		    vec4 velData = texture2D( textureVelocity, uv );
		    vec3 vel = velData.xyz;
		    float life = velData.w;

		    vec3 extra = texture2D( textureRandom, uv ).xyz;
			
			float posOffset = mix(1.0, extra.r, .75) * 0.5;
			life *= .92;

			if(life <= 0.0){
				pos = texture2D( textureOriginalPosition, uv ).xyz * 1.33;
				vel = vec3(0.);
				life = extra.r;
				
			}

			vec3 acc        = curlNoise(pos * posOffset + uTime * 2.0);

			

			
			
			vel += acc * .0075;

			const float decrease = .93;
			vel *= decrease;


		    gl_FragColor = vec4( vel, life );
		}
		`;

	const computePosShader =  `

		uniform float uSpeedOffset;
		uniform sampler2D textureOriginalPosition;

		void main() {
		    vec2 uv = gl_FragCoord.xy / resolution.xy;
		    //vec2 uv = vUv;

		    vec3 pos = texture2D( texturePosition, uv ).xyz;
		    vec4 velData = texture2D( textureVelocity, uv );
		    vec3 vel = velData.xyz;
		    float life = velData.a;

		    if(life <= 0.0){
		    	pos = texture2D(textureOriginalPosition, uv).rgb * 1.33;
			}

		    pos += vel * uSpeedOffset;

		    gl_FragColor = vec4( pos, 1.0 );
		}
		`;
	
	const createTexture = () => {
        let texture = new THREE.DataTexture( new Float32Array( AMOUNT * 4 ), texture_width, texture_height, THREE.RGBAFormat, THREE.FloatType );
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.needsUpdate = true;
        texture.generateMipmaps = false;
        texture.flipY = false;
        
        return texture;
    };

	const initPositionTexture = (texture, mode = 0) => {
		const data = texture.image.data
		//console.log(mesh.geometry.attributes.position.count, variables.AMOUNT)
		const rand = THREE.MathUtils.randFloat;

		for(let i = 0; i < AMOUNT; i++){
			const radius = rand(2, 2.5)
      		const phi = (Math.random() - 0.5) * Math.PI
      		const theta = Math.random() * Math.PI * 2

      		if(mode == 0){ // SPHERE
      			data[i * 4] = radius * Math.cos(theta) * Math.cos(phi)
		      	data[i * 4 + 1] = radius * Math.sin(phi)
		      	data[i * 4 + 2] = radius * Math.sin(theta) * Math.cos(phi)
		      	data[i * 4 + 3] = rand(0., 1.0)
      		}else if(mode == 1){  // CUBE   			
				data[i * 4] = rand(-10, 10)
				data[i * 4 + 1] = rand(-10, 10)
				data[i * 4 + 2] = rand(-10, 10)
				data[i * 4 + 3] = rand(0., 1.0)
      		}else if(mode == 2){ // PLANE
      			const DIM = 130

      			data[i * 4 + 0] = DIM / 2 - DIM * (i % texture_width) / texture_width
				data[i * 4 + 1] = DIM / 2 - DIM * ~~(i / texture_width) / texture_height
				data[i * 4 + 2] = 0	
				data[i * 4 + 3] = rand(0., 1.0)
      		}else{
      			console.log(mesh.geometry.attributes.position.count)
      		}
		}

		texture.needsUpdate = true;
	};

	const initVelocityTexture = texture => {
		const data = texture.image.data;
		const rand = THREE.MathUtils.randFloat;

		for(let i=0; i<AMOUNT; i++){
			data[i * 4] = 0;//rand(-1.0, 1.0)
			data[i * 4 + 1] = 0;//rand(-1.0, 1.0)
			data[i * 4 + 2] = 0;//rand(-1.0, 1.0)
			data[i * 4 + 3] = Math.random() * 10.; // used as life
		}
		
		texture.needsUpdate = true;
	};

	const initRandomTexture = texture => {
		const data = texture.image.data;
		const rand = THREE.MathUtils.randFloat;

		for(let i=0; i<AMOUNT; i++){
			data[i * 4] = rand(-.5, .5)
			data[i * 4 + 1] = rand(-.5, .5)
			data[i * 4 + 2] = rand(-.5, .5)
			data[i * 4 + 3] = Math.random()
		}

		texture.needsUpdate = true;
	};

	const initGpuCompute = () => {
		console.log('application initGPUCompute')
		const rttSize = texture_width
		console.log(`rttSize:${rttSize}`)

		gpuCompute = new GPUComputationRenderer(rttSize, rttSize, renderer);

		rttTextures['positionTexture'] = gpuCompute.createTexture();
		rttTextures['originalPositionTexture'] = gpuCompute.createTexture();
 		rttTextures['velocityTexture'] = gpuCompute.createTexture();

 		originalTexture = createTexture();
 		//initPositionTexture(rttTextures['positionTexture'], 0)
 		skmr.getOriginalPositionsTexture(rttTextures['positionTexture'])
 		skmr.getOriginalPositionsTexture(originalTexture)
			
 		initVelocityTexture(rttTextures['velocityTexture'])

 		randomTexture = createTexture();
 		initRandomTexture(randomTexture)

 		rttTextures['positionTexture'].needsUpdate = true;

 		const comPosition = computeVars['comPosition'] = gpuCompute.addVariable('texturePosition', computePosShader, rttTextures['positionTexture'])
    	const comVelocity = computeVars['comVelocity'] = gpuCompute.addVariable('textureVelocity', computeVelShader, rttTextures['velocityTexture'])

    	gpuCompute.setVariableDependencies(comPosition, [comPosition, comVelocity])

    	oldRtt = rttTextures['positionTexture'];

    	posUniforms = comPosition.material.uniforms
    	posUniforms.uSpeedOffset = { type:'f', value: speedOffset}
    	posUniforms.textureOriginalPosition = { type: 't' , value: null}
    	gpuCompute.setVariableDependencies(comVelocity, [comVelocity, comPosition])
	    
	    velUniforms = comVelocity.material.uniforms
	    velUniforms.uTime = { type: 'f' , value:0 }
	    
	    velUniforms.textureRandom = { type: 'f' , value: randomTexture	 }

	    velUniforms.textureOriginalPosition = { type: 't' , value: originalTexture}
	    velUniforms.uHit =  { type:'v3', value:new THREE.Vector3() }
		velUniforms.uIsMouseDown =  { type:'f', value:0.0 }
		velUniforms.uMinRadius = { type:'f', value:2}
		velUniforms.uMaxRadius = { type:'f', value:8.0}

	    gpuCompute.init();
	};

	const initGeometry = () => {
		const rand = THREE.MathUtils.randFloat;
		const scale = 0.03;
		const size = 0.5;

		const baseGeometry = new THREE.TetrahedronBufferGeometry(size * scale/*, size * scale, size * scale*/);
		const geometry = new THREE.InstancedBufferGeometry();

		geometry.index = baseGeometry.index;
		geometry.attributes.position = baseGeometry.attributes.position;
		geometry.attributes.uv = baseGeometry.attributes.uv;
		geometry.attributes.normal = baseGeometry.attributes.normal;

		const actives = new Float32Array(AMOUNT);	
		///const positions = new Float32Array(AMOUNT * 3);		
		const uv = new Float32Array(AMOUNT * 2);

		for(let i = 0; i < AMOUNT; i++) {
			actives[i] = (Math.random() > .89) ? 0.0 : 1.0;

			const index = i * 2

	      	uv[index + 0] = (i % texture_width) / texture_width
	      	uv[index + 1] = ~~(i / texture_width) / texture_height

	      	/*const indexPos = i * 3;
      	
      		offsets[indexPos + 0] = rand(-10, 10);//(i % texture_width) / texture_width;
    		offsets[indexPos + 1] = rand(-10, 10);//0;
			offsets[indexPos + 2] = rand(-10, 10);//~~(i / texture_width) / texture_height;*/
		}

		//geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3).setUsage(THREE.DynamicDrawUsage))
		geometry.setAttribute('uv2', new THREE.InstancedBufferAttribute(uv, 2))
		geometry.setAttribute('aactive', new THREE.InstancedBufferAttribute(actives, 1))

		material = new THREE.MeshStandardMaterial({
			color:new THREE.Color(.7, .7, .7),
			metalness:.9,
			roughness:.6,
		});	

		material.onBeforeCompile = (shader) => {
			shader.uniforms.uTexturePos =  { type:'t', value:null }
			shader.uniforms.uTextureOldPos =  { type:'t', value:null }
			shader.uniforms.uTextureRandom =  { type:'t', value:null }
			shader.uniforms.textureOriginalPosition =  { type:'t', value:null }
			shader.uniforms.uTime =  { type:'f', value:0 }
			
			_shader = shader;

			shader.vertexShader = shader.vertexShader.replace(
				'#include <common>',
				`
				#include <common>

				attribute float aactive;
				attribute vec2 uv2;

				varying vec3 vColor;

				uniform sampler2D uTexturePos;
				uniform sampler2D uTextureOldPos;
				uniform sampler2D textureOriginalPosition;

				uniform sampler2D uTextureRandom;
				uniform float uTime;

				const vec3 FRONT = vec3(0.0, 0.0, -1.0);
				const vec3 UP = vec3(0.0, 1.0, 0.0);

				mat4 rotationMatrix(vec3 axis, float angle) {
				    axis = normalize(axis);
				    float s = sin(angle);
				    float c = cos(angle);
				    float oc = 1.0 - c;
				    
				    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
				                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
				                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
				                0.0,                                0.0,                                0.0,                                1.0);
				}

				vec3 rotate(vec3 v, vec3 axis, float angle) {
					mat4 m = rotationMatrix(axis, angle);
					return (m * vec4(v, 1.0)).xyz;
				}
				`
			);

			shader.vertexShader = shader.vertexShader.replace(
				'#include <begin_vertex>',
				`
				//#include <begin_vertex>

				vec3 oldPos  = texture2D(uTextureOldPos, uv2).rgb;
				vec3 pos = texture2D(uTexturePos, uv2).rgb;
				vec3 extra = texture2D(uTextureRandom, uv2).rgb;
				vec3 originalPos = texture2D(textureOriginalPosition, uv2).rgb;

				vec3 finalPos      = mix(oldPos, pos, .75);

				vec3 dir      = normalize(oldPos - finalPos);
				vec3 axis     = cross(dir, FRONT);
				float theta   = acos(dot(dir, FRONT));

				float scale   = sin(extra.z + uTime * extra.r) * .4 + .6;


				vec3 p = position;

				if(aactive < .5) {
					scale = 1.0;
					finalPos = originalPos.xyz;
				}

				p *= scale;
				if(aactive > .5) {
					p 	  = rotate(p.xyz, axis, theta);
				}

				p += finalPos;

				vec3 transformed = vec3(p);

				vNormal = rotate(normal, axis, theta);

				float c       = mix(extra.r, 1.0, .8);
				vColor        = vec3(c);

				`
			);

			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <common>',
				`
				#include <common>

				varying vec3 vColor;

				float diff(vec3 N, vec3 L) {
					return max(dot(N, normalize(L)), 0.0);
				}


				vec3 diff(vec3 N, vec3 L, vec3 C) {
					return diff(N, L) * C;
				}
				`
			);

			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <map_fragment>',
				`#include <map_fragment>

				float d = diff(vNormal, vec3(0, 0, 0));

				d = mix(d, 1.0, .5);

				diffuseColor = vec4(d,d,d,1.);
				`
			);
		};

		mesh = new THREE.Mesh(geometry, material);

		mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
	      depthPacking: THREE.RGBADepthPacking,
	      alphaTest: 0.5
	    });

	    mesh.customDepthMaterial.onBeforeCompile = (shader) => {
			shader.uniforms.uTexturePos =  { type:'t', value:null }
			shader.uniforms.uTextureOldPos =  { type:'t', value:null }
			shader.uniforms.uTextureRandom =  { type:'t', value:null }
			shader.uniforms.uTime =  { type:'f', value:0 }

			_shader2 = shader;

			shader.vertexShader = shader.vertexShader.replace(
				'#include <common>',
				`
				#include <common>

				//attribute vec3 offset;
				attribute vec2 uv2;

				varying vec3 vColor;
				varying vec3 vNormal;

				uniform sampler2D uTexturePos;
				uniform sampler2D uTextureOldPos;

				uniform sampler2D uTextureRandom;
				uniform float uTime;

				const vec3 FRONT = vec3(0.0, 0.0, -1.0);
				const vec3 UP = vec3(0.0, 1.0, 0.0);

				mat4 rotationMatrix(vec3 axis, float angle) {
				    axis = normalize(axis);
				    float s = sin(angle);
				    float c = cos(angle);
				    float oc = 1.0 - c;
				    
				    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
				                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
				                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
				                0.0,                                0.0,                                0.0,                                1.0);
				}

				vec3 rotate(vec3 v, vec3 axis, float angle) {
					mat4 m = rotationMatrix(axis, angle);
					return (m * vec4(v, 1.0)).xyz;
				}
				`
			);

			shader.vertexShader = shader.vertexShader.replace(
				'#include <begin_vertex>',
				`
				//#include <begin_vertex>

				vec3 oldPos  = texture2D(uTextureOldPos, uv2).rgb;
				vec3 pos = texture2D(uTexturePos, uv2).rgb;
				vec3 extra = texture2D(uTextureRandom, uv2).rgb;

				vec3 finalPos      = mix(oldPos, pos, .75);

				vec3 dir      = normalize(oldPos - finalPos);
				vec3 axis     = cross(dir, FRONT);
				float theta   = acos(dot(dir, FRONT));

				float scale   = sin(extra.z + uTime * extra.r) * .4 + .6;
				
				vec3 p = position;
				p *= scale;
				
				p 	  = rotate(p.xyz, axis, theta) + finalPos;
				vec3 transformed = vec3(p);

				vNormal = rotate(normal, axis, theta);

				float c       = mix(extra.r, 1.0, .8);
				vColor        = vec3(c);

				`
			);

			shader.fragmentShader = '#define DEPTH_PACKING 3201\n' + shader.fragmentShader;

			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <common>',
				`
				#include <common>

				varying vec3 vNormal;
				varying vec3 vColor;

				`
			);
		};

		mesh.castShadow = true;
		mesh.receiveShadow = true;

		scene.add(mesh);

		mesh.frustumCulled = false;

		renderer.compile(scene,camera);
	};

	let cnt = 0;

	const update = (delta, time, mouse3d) => {
		if(!gpuCompute) return;

		const otp = skmr.getOriginalPositionsTexture(originalTexture);

		//velUniforms.texturePosition.value = otp
		velUniforms.textureOriginalPosition.value = otp;//
		posUniforms.textureOriginalPosition.value = otp;//

		gpuCompute.compute();
		//console.log('ddddd')
		let f = isMouseDown ? 10.0 : 0.0;
		const r = isMouseDown ? 8.0 : 2.0;

		velUniforms.uTime.value += delta;
		velUniforms.uHit.value.copy(mouse3d);
		velUniforms.uMinRadius.value = r;
		velUniforms.uIsMouseDown.value = f;
		
		//console.log(skmr.getOriginalPositionsTexture(originalTexture));

		//console.log(velUniforms.uTime.value);
		const comPosition = computeVars['comPosition']
		const comVelocity = computeVars['comVelocity'] 

		if(_shader){
			//console.log(_shader.uniforms);
			_shader.uniforms.uTexturePos.value = gpuCompute.getCurrentRenderTarget(comPosition).texture;//otp;//gpuCompute.getCurrentRenderTarget(comPosition).clone();//skmr.getOriginalPositionsTexture(originalTexture);//gpuCompute.getCurrentRenderTarget(comPosition).clone();//skmr.getOriginalPositionsTexture(originalTexture);//gpuCompute.getCurrentRenderTarget(comPosition).texture;
			_shader.uniforms.uTextureRandom.value = randomTexture;
			_shader.uniforms.textureOriginalPosition.value = otp;

			if(oldRtt){
				if(cnt % 5 == 0){
					oldRtt = gpuCompute.getCurrentRenderTarget(comPosition).clone();
					_shader.uniforms.uTextureOldPos.value = oldRtt.texture;
				}
			}

			_shader.uniforms.uTime.value += delta;
			//_shader.uniforms.uTextureVel.value = gpuCompute.getCurrentRenderTarget(comVelocity).texture ;
		}

		if(_shader2){
			_shader2.uniforms.uTexturePos.value = gpuCompute.getCurrentRenderTarget(comPosition).texture;//gpuCompute.getCurrentRenderTarget(comPosition).clone();//skmr.getOriginalPositionsTexture(originalTexture);//skmr.getOriginalPositionsTexture(originalTexture);//gpuCompute.getCurrentRenderTarget(comPosition).texture;
			_shader2.uniforms.uTextureRandom.value = randomTexture;
			_shader.uniforms.textureOriginalPosition.value = otp;

			if(oldRtt){
				if(cnt % 5 == 0){
					oldRtt = gpuCompute.getCurrentRenderTarget(comPosition).clone();
					_shader2.uniforms.uTextureOldPos.value = oldRtt.texture;
				}
			}

			_shader2.uniforms.uTime.value += delta;
		}

		oldRtt = gpuCompute.getCurrentRenderTarget(comPosition).clone();
	}

	const init = () => {
		initGeometry();
		initGpuCompute();


	};

	const base = {
		init,
		update,
	};

	Object.defineProperty(base, 'originalTexture', {
		get: () => skmr.getOriginalPositionsTexture(originalTexture).texture,
 	})

	return base;
};

export { Particles };
