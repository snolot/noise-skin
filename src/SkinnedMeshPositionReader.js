import * as THREE from '../libs/build/three.module.js';
import { GLTFLoader } from '../libs/examples/jsm/loaders/GLTFLoader.js';

const SkinnedMeshPositionReader = (_scene, _options) => {
	const options = {
		textureWidth: 128,
		textureHeight: 128,
	};

	Object.assign(options, _options);

	const scene = _scene;
	const position = new THREE.Vector3();
	const transformed = new THREE.Vector3();
	const temp1 = new THREE.Vector3();
	const tempBoneMatrix = new THREE.Matrix4();
	const tempSkinnedVertex = new THREE.Vector3();
	const tempSkinned = new THREE.Vector3();
	const currentM = new THREE.Matrix4();
	
	const dummy = new THREE.Object3D();
	let skinnedMesh;

	let _originalTexture;

	let geometry;
	let skeleton;
	let bindMatrix;
	let bindMatrixInverse;
	let pa;	
	let skinIndex;
	let skinWeights;

	const getOriginalPositionsTexture = (tex) => {
		
		const currentPositions = getOriginalPositions();
		const originalPos = tex.image.data;
		//console.log(originalPos);
		let a = 0;

    	for ( let k = 0, kl = originalPos.length; k < kl; k += 4 ) {
    		let x, y, z;

	        x = currentPositions[a].x * 1;
	        y = currentPositions[a].y * 1;
	        z = currentPositions[a].z * 1;

	        originalPos[ k + 0 ] = x;
	        originalPos[ k + 1 ] = y;
	        originalPos[ k + 2 ] = z;
	        
	        if (a < currentPositions.length - 1) {
	        	a++;
	        } else {
	        	a = 0;
	        }
    	}

    	tex.needsUpdate = true;
		
		return tex;	
	};

	const getOriginalPositions = () => {
		scene.updateMatrixWorld()

		skeleton.update();
		
		let transformedPos = [];

		for (let vndx = 0; vndx < skinnedMesh.geometry.attributes.position.count; ++vndx) {
			position.set(pa[(3 * vndx) + 0], pa[(3 * vndx) + 1], pa[(3 * vndx) + 2]);
			transformed.copy(position);
			
			tempSkinnedVertex.copy(transformed).applyMatrix4(bindMatrix);
			tempSkinned.set(0, 0, 0);

			for (let i = 0; i < 4; ++i) {
			  	const boneNdx = skinIndex.array[(4 * vndx) + i];
			  	const weight = skinWeights.array[(4 * vndx) + i];
			  	tempBoneMatrix.fromArray(skeleton.boneMatrices, boneNdx * 16);
			  	temp1.copy(tempSkinnedVertex);
			  	tempSkinned.add(temp1.applyMatrix4(tempBoneMatrix).multiplyScalar(weight));
			}

			transformed.copy(tempSkinned).applyMatrix4(bindMatrixInverse);
			transformed.applyMatrix4(skinnedMesh.matrixWorld);
			//transformed.multiplyScalar(10);
				
			dummy.position.copy(transformed);

			dummy.updateMatrix();

			transformedPos.push(new THREE.Vector3().setFromMatrixPosition(dummy.matrix));
		}
			
		//console.log(transformedPos);
		return transformedPos;
	};

	const fillTexture = (_positionTexture, _defaultPositionTexture) => {
		_originalTexture = _defaultPositionTexture;
		getOriginalPositionsTexture(_originalTexture);
		_originalTexture.needsUpdate = true;

		_positionTexture = _originalTexture.clone();
	};


	const init = (_skinnedMesh) => {

		skinnedMesh = _skinnedMesh;

		skeleton = skinnedMesh.skeleton;
		bindMatrix = skinnedMesh.bindMatrix;
		bindMatrixInverse = skinnedMesh.bindMatrixInverse;
		pa = skinnedMesh.geometry.attributes.position.array;	
		skinIndex = skinnedMesh.geometry.attributes.skinIndex;
		skinWeights = skinnedMesh.geometry.attributes.skinWeight;
	};

	const base = {
		init,
		getOriginalPositions,
		getOriginalPositionsTexture,
		fillTexture,
	};

	Object.defineProperty(base, 'originalTexture', {
        set: (value) => {
        	_originalTexture = value;
        }
    });

	return base;
}

export { SkinnedMeshPositionReader};
