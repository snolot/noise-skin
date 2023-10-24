import * as THREE from '../libs/build/three.module.js';
import ExtendedMaterial from './ExtendedMaterial.js';
import noise from '../glsl/noise.js';

const DissolveMaterial = (renderer, parameters) => {

	const baseMaterial = new THREE.MeshStandardMaterial(parameters);
	//baseMaterial.setValues(parameters);

	const uniforms = [
		{ uTime: {type: 'f',value: 0.0} },
		{ glowFalloff: {type: 'f',value: 0.1} },
		{ glowRange: {type: 'f',value: 0.05} },
		{ fresnelExponent: {type: 'f', value:.7}},
		{ map: {type: 't', value:null}}
	];

	const hooks = [
		{
			needle:'#include <common>',
			vertex:`
				#include <common>

				varying vec3 vPosition;
				varying float vNoise;
				//varying vec3 vColor;
				//varying vec2 vUv;

				${noise}
			`
		},
		{
			needle:'void main() {',
			vertex:`
				void main() {
					vColor = color;
					float updateTime = uTime;
					vUv = uv;

					vec3 world_space_normal = vec3(modelViewMatrix * vec4(normal, 0.0));
					vNormal = normal;

					float noise = snoise(vec3(position  * 5. + updateTime));
					vNoise = noise;
					vPosition = position;
			`
		},
		{
			needle:'#include <common>',
			fragment:`
				#include <common>

				varying vec3 vPosition;
				varying float vNoise;
				//varying vec3 vColor;
				//varying vec2 vUv;

				uniform float uTime;

				uniform float glowFalloff;
				uniform float glowRange;
				//uniform float map;
				uniform float fresnelExponent;

			`
		},
		{
			needle:'void main() {',
			fragment:`
				void main() {
					float x = (1. + vNoise - (uTime* 1.)) + .1;

					if (x < 0.) {
						discard;
					}

					vec3 fresnelColor = texture(map, vUv).rgb;

					float fresnel = dot(vNormal, vec3(0, 0, 1));

					fresnel = 1. - fresnel;
					fresnel = pow(fresnel, fresnelExponent);

					float isGlowing = smoothstep(glowRange + glowFalloff, glowRange, x);
					vec3 glow = isGlowing * vec3(0.5, 0.1, 0.1);

					float alpha =  - fresnel;

					vec3 xc = vec3(1.);
			`
		},
		{
			needle:'vec4 diffuseColor = vec4( diffuse, opacity );',
			fragment:`
				vec3 rgb = xc + fresnelColor * fresnel + glow;
	      		vec4 diffuseColor = vec4(fresnelColor, 1.0);// * fresnel + 0.1 + isGlowing + 0.3;
			`
		},
		{
			needle:'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
			fragment:`
				vec3 outgoingLight = rgb + totalDiffuse + totalSpecular + totalEmissiveRadiance;//diffuseColor.rgb;
			`
		}
	];

	const _mat = ExtendedMaterial(renderer, baseMaterial, uniforms, hooks, true);

	let _shader;

	const base = {

	};

	Object.defineProperty(base, 'material', {
		get: () => baseMaterial,
	})

	Object.defineProperty(base, 'time', {
		get: () => baseMaterial.uniforms.uTime.value,
		set: (value) => {
			if(baseMaterial && baseMaterial.uniforms){
				baseMaterial.uniforms.uTime.value = value;
				//console.log(baseMaterial.uniforms.uTime.value);
			}
		}	
	})

	Object.defineProperty(base, 'map', {
		get: () => baseMaterial.uniforms.map.value,
		set: (value) => {
			if(baseMaterial && baseMaterial.uniforms){
				baseMaterial.uniforms.map.value = value;
				//console.log(baseMaterial.uniforms.uTime.value);
			}
		}	
	})

	return base;
};

export {DissolveMaterial};
