import * as THREE from './libs/build/three.module.js';
import { EffectComposer } from './libs/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './libs/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './libs/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './libs/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from './libs/examples/jsm/shaders/FXAAShader.js';
import { SSAOPass } from './libs/examples/jsm/postprocessing/SSAOPass.js';

const Effects = (renderer, scene, camera) => {

	const composer = new EffectComposer(renderer);

	const renderPass = new RenderPass(scene, camera);
	composer.addPass(renderPass);

	

	const aaPass = new ShaderPass(FXAAShader);
	composer.addPass(aaPass);
	aaPass.material.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);


	/*const ssaoPass = new SSAOPass( scene, camera, window.innerWidth, window.innerHeight );
	ssaoPass.kernelRadius = 32;
	ssaoPass.minDistance = 0.005;
	ssaoPass.maxDistance = 0.22156

	composer.addPass( ssaoPass );*/

	const bloomPass = new UnrealBloomPass(
		new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0, 0);
	composer.addPass(bloomPass);

	const resize = () => {
		composer.setSize(window.innerWidth, window.innerHeight);
		aaPass.material.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);
	};

	const render = () => {
		composer.render();
	};

	const base = {
		render,
		resize
	};

	return base;
};

export {Effects};
