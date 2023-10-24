import * as THREE from '../libs/build/three.module.js';
import ExtendedMaterial from './ExtendedMaterial.js';
import noise from '../glsl/noise.js';

const DissolveMaterial = (renderer, parameters) => {

	const baseMaterial = new THREE.MeshStandardMaterial(parameters);
	//baseMaterial.setValues(parameters);

	const uniforms = [
		{ uTime: {type: 'f',value: 0.0} },
		{ glowFalloff: {type: 'f',value: 0.15} },
		{ glowRange: {type: 'f',value: 0.031} },
		{ fresnelExponent: {type: 'f', value:2.25}},
		{ map: {type: 't', value:null}},
		{ uHit: {type:'v3', value:new THREE.Vector3() }}
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

					float noise = snoise(vec3(position + updateTime * .1) * 1.);
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
					float isGlowing2 = smoothstep(glowRange + glowFalloff * .25, glowRange * .025, x);

					vec3 glow = isGlowing * mix(vec3(2.5, 0.0, 0.0), vec3(.8, 0.5, 0.0),isGlowing2 );

					float alpha = 1. - fresnel;
					if(alpha>.2){
						alpha=1.;
					}
					
					vec3 xc = vec3(0., 0., .0);
			`
		},
		{
			needle:'vec4 diffuseColor = vec4( diffuse, opacity );',
			fragment:`
				vec3 rgb = xc + fresnelColor * fresnel + glow;

	      		vec4 diffuseColor = vec4(rgb, 1.0);// fresnel + 0.1 + isGlowing + 0.3);
			`
		},
		{
			needle:'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
			fragment:`
				vec3 outgoingLight = rgb + totalDiffuse + totalSpecular + totalEmissiveRadiance;//diffuseColor.rgb;
			`
		}
	];

	const _mat = ExtendedMaterial(renderer, baseMaterial, uniforms, hooks, false);

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

	Object.defineProperty(base, 'hit', {
		get: () => baseMaterial.uniforms.uHit.value,
		set: (value) => {
			if(baseMaterial && baseMaterial.uniforms){
				baseMaterial.uniforms.uHit.value = value;
				//console.log(baseMaterial.uniforms.uTime.value);
			}
		}	
	})

	return base;
};

export  {DissolveMaterial};
