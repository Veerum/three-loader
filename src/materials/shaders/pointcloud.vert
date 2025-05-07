precision highp float;
precision highp int;

#define max_clip_boxes 30

in vec3 position;
in vec3 color;
#ifdef color_rgba
in vec4 rgba;
#endif
in vec3 normal;
in float intensity;
in float classification;
in float returnNumber;
in float numberOfReturns;
in float pointSourceID;
in vec4 indices;
in vec2 uv;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

uniform float pcIndex;
uniform float screenWidth;
uniform float screenHeight;
uniform float fov;
uniform float spacing;

#if defined use_clip_box
	uniform mat4 clipBoxes[max_clip_boxes];
#endif

uniform float heightMin;
uniform float heightMax;
uniform float size; 
uniform float minSize;
uniform float maxSize;
uniform float octreeSize;
uniform vec3 bbSize;
uniform vec3 uColor;
uniform float opacity;
uniform float clipBoxCount;
uniform float level;
uniform float vnStart;
uniform bool isLeafNode;

uniform float filterByNormalThreshold;
uniform vec2 intensityRange;
uniform float opacityAttenuation;
uniform float intensityGamma;
uniform float intensityContrast;
uniform float intensityBrightness;
uniform float rgbGamma;
uniform float rgbContrast;
uniform float rgbBrightness;
uniform float transition;
uniform float wRGB;
uniform float wIntensity;
uniform float wElevation;
uniform float wClassification;
uniform float wReturnNumber;
uniform float wSourceID;

uniform sampler2D visibleNodes;
uniform sampler2D gradient;
uniform sampler2D classificationLUT;
uniform sampler2D depthMap;

#ifdef use_texture_blending
uniform sampler2D backgroundMap;
#endif

#ifdef use_point_cloud_mixing
uniform int pointCloudMixingMode;
uniform float pointCloudID;
uniform float pointCloudMixAngle;
uniform float stripeDistanceX;
uniform float stripeDistanceY;
uniform float stripeDivisorX;
uniform float stripeDivisorY;
#endif

#ifdef highlight_point
uniform vec3 highlightedPointCoordinate;
uniform bool enablePointHighlighting;
uniform float highlightedPointScale;
#endif

#ifdef use_filter_by_normal
uniform int normalFilteringMode;
#endif

out vec3 vColor;
#if !defined(color_type_point_index)
out float vOpacity;
#endif
#if defined(weighted_splats)
out float vLinearDepth;
#endif
#if !defined(paraboloid_point_shape) && defined(use_edl)
out float vLogDepth;
#endif
#if (defined(color_type_phong) && (MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0)) || defined(paraboloid_point_shape)
out vec3 vViewPosition;
#endif
#if defined(weighted_splats) || defined(paraboloid_point_shape)
out float vRadius;
#endif
#if defined(color_type_phong) && (MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0)
out vec3 vNormal;
#endif
#ifdef highlight_point
out float vHighlight;
#endif

// --- helper functions (unchanged, but use texture() now) ---

float roundFloat(float number){
	return floor(number + 0.5);
}

#if (defined(adaptive_point_size) || defined(color_type_lod)) && defined(tree_type_octree)
int numberOfOnes(int number, int index) {
	int numOnes = 0;
	int tmp = 128;
	for (int i = 7; i >= 0; i--) {
		if (number >= tmp) {
			number -= tmp;
			if (i <= index) numOnes++;
		}
		tmp /= 2;
	}
	return numOnes;
}
bool isBitSet(int number, int index){
	int powi = 1 << index;
	int ndp = number / powi;
	return (ndp % 2) != 0;
}
float getLOD_octree() {
	vec3 offset = vec3(0.0);
	int iOffset = int(vnStart);
	float depthVal = level;
	for (float i = 0.0; i <= 30.0; i++) {
		float nodeSize = octreeSize / pow(2.0, i + level);
		vec3 idx3 = floor((position - offset)/nodeSize + 0.5);
		int idx = int(roundFloat(4.0*idx3.x + 2.0*idx3.y + idx3.z));
		vec4 val = texture(visibleNodes, vec2(float(iOffset)/2048.0,0.0));
		int mask = int(roundFloat(val.r*255.0));
		if (isBitSet(mask, idx)) {
			int advanceG = int(roundFloat(val.g*255.0))*256;
			int advanceB = int(roundFloat(val.b*255.0));
			int advanceChild = numberOfOnes(mask, idx-1);
			iOffset += advanceG + advanceB + advanceChild;
			depthVal++;
		} else {
			return val.a*255.0;
		}
		offset += idx3 * (nodeSize*0.5);
	}
	return depthVal;
}
float getPointSizeAttenuation_octree() {
	return 0.5 * pow(2.0, getLOD_octree());
}
#endif

#if (defined(adaptive_point_size) || defined(color_type_lod)) && defined(tree_type_kdtree)
float getLOD_kdtree() {
	vec3 offset = vec3(0.0);
	float intOffset = 0.0;
	float depthVal = 0.0;
	vec3 size = bbSize;
	vec3 pos = position;
	for (float i = 0.0; i <= 1000.0; i++) {
		vec4 val = texture(visibleNodes, vec2(intOffset/2048.0,0.0));
		int children = int(val.r*255.0);
		float next = val.g*255.0;
		int split = int(val.b*255.0);
		if (next == 0.0) return depthVal;
		vec3 splitv = vec3((split==1)?1.0:0.0, (split==2)?1.0:0.0, (split==4)?1.0:0.0);
		intOffset += next;
		if (length(pos*splitv/size) < 0.5) {
			if (children==0||children==2) return depthVal;
		} else {
			pos -= size*splitv*0.5;
			if (children==0||children==1) return depthVal;
			if (children==3) intOffset += 1.0;
		}
		size *= ((1.0-(splitv+1.0)/2.0)+0.5);
		depthVal++;
	}
	return depthVal;
}
float getPointSizeAttenuation_kdtree() {
	return 0.5 * pow(1.3, getLOD_kdtree());
}
#endif

float getContrastFactor(float contrast) {
	return (1.0158730158730156 * (contrast + 1.0)) / (1.0158730158730156 - contrast);
}

vec3 getRGB() {
	#ifdef color_rgba
		vec3 rgb = rgba.rgb;
	#else
		vec3 rgb = color;
	#endif
	#if defined(use_rgb_gamma_contrast_brightness)
		rgb = pow(rgb, vec3(rgbGamma));
		rgb += vec3(rgbBrightness);
		rgb = (rgb - 0.5) * getContrastFactor(rgbContrast) + 0.5;
		return clamp(rgb, 0.0, 1.0);
	#else
		return rgb;
	#endif
}

float getIntensity() {
	float w = (intensity - intensityRange.x)/(intensityRange.y - intensityRange.x);
	w = pow(w, intensityGamma);
	w += intensityBrightness;
	w = (w - 0.5) * getContrastFactor(intensityContrast) + 0.5;
	return clamp(w, 0.0, 1.0);
}

vec3 getElevation() {
	vec4 world = modelMatrix * vec4(position,1.0);
	float w = (world.z - heightMin)/(heightMax-heightMin);
	return texture(gradient, vec2(w,1.0-w)).rgb;
}

vec4 getClassification() {
	return texture(classificationLUT, vec2(classification/255.0,0.5));
}

vec3 getReturnNumber() {
	if (numberOfReturns == 1.0) return vec3(1.0,1.0,0.0);
	if (returnNumber == numberOfReturns) return vec3(0.0,0.0,1.0);
	return vec3(0.0,1.0,0.0);
}

vec3 getSourceID() {
	float w = mod(pointSourceID,10.0)/10.0;
	return texture(gradient, vec2(w,1.0-w)).rgb;
}

vec3 getCompositeColor() {
	vec3 c = vec3(0.0);
	float w = 0.0;
	c += wRGB * getRGB(); w += wRGB;
	c += wIntensity * vec3(getIntensity()); w += wIntensity;
	c += wElevation * getElevation(); w += wElevation;
	c += wReturnNumber * getReturnNumber(); w += wReturnNumber;
	c += wSourceID * getSourceID(); w += wSourceID;
	vec4 cl = wClassification * getClassification(); c += cl.a*cl.rgb; w += wClassification*cl.a;
	if (w>0.0) c /= w; else gl_Position = vec4(100.0); 
	return c;
}

void main() {
	vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
	gl_Position = projectionMatrix * mvPosition;

	#if defined(color_type_phong) && (MAX_POINT_LIGHTS>0||MAX_DIR_LIGHTS>0) || defined(paraboloid_point_shape)
		vViewPosition = mvPosition.xyz;
	#endif

	#if defined(weighted_splats)
		vLinearDepth = gl_Position.w;
	#endif

	#if defined(color_type_phong) && (MAX_POINT_LIGHTS>0||MAX_DIR_LIGHTS>0)
		vNormal = normalize(normalMatrix * normal);
	#endif

	#if !defined(paraboloid_point_shape) && defined(use_edl)
		vLogDepth = log2(-mvPosition.z);
	#endif

	float slope = tan(fov*0.5);
	float projFactor = -0.5 * screenHeight / (slope * mvPosition.z);
	float pointSize = size;
	#if defined(fixed_point_size)
		pointSize = size;
	#elif defined(attenuated_point_size)
		pointSize = size * spacing * projFactor;
	#elif defined(adaptive_point_size)
		#ifdef tree_type_octree
			pointSize = (2.0 * size * spacing / getPointSizeAttenuation_octree()) * projFactor;
		#else
			pointSize = (2.0 * size * spacing / getPointSizeAttenuation_kdtree()) * projFactor;
		#endif
	#endif
	pointSize = clamp(pointSize, minSize, maxSize);

	#if defined(weighted_splats)||defined(paraboloid_point_shape)
		vRadius = pointSize / projFactor;
	#endif
	gl_PointSize = pointSize;

	#ifdef highlight_point
		vec4 worldPos = modelMatrix * vec4(position,1.0);
		if (enablePointHighlighting
		 && all(lessThan(abs(worldPos.xyz - highlightedPointCoordinate), vec3(0.0001)))) {
			vHighlight = 1.0;
			gl_PointSize = pointSize * highlightedPointScale;
		} else {
			vHighlight = 0.0;
		}
	#endif

	#ifndef color_type_point_index
		#ifdef attenuated_opacity
			vOpacity = opacity * exp(-length(-mvPosition.xyz)/opacityAttenuation);
		#else
			vOpacity = opacity;
		#endif
	#endif

	#ifdef use_filter_by_normal
		bool discardPt = false;
		vec4 nmPos = modelViewMatrix * vec4(normal,0.0);
		if (normalFilteringMode==1) discardPt = abs(nmPos.z)>filterByNormalThreshold;
		else if(normalFilteringMode==2) discardPt = nmPos.z<=filterByNormalThreshold;
		else if(normalFilteringMode==3) discardPt = nmPos.z>filterByNormalThreshold;
		if(discardPt) gl_Position = vec4(0.0,0.0,2.0,1.0);
	#endif

	#ifdef color_type_rgb
		vColor = getRGB();
	#elif defined(color_type_height)
		vColor = getElevation();
	#elif defined(color_type_rgb_height)
		vColor = mix(getRGB(), getElevation(), transition);
	#elif defined(color_type_depth)
		float linearD = -mvPosition.z;
		float expD = (gl_Position.z/gl_Position.w)*0.5+0.5;
		vColor = vec3(linearD, expD,0.0);
	#elif defined(color_type_intensity)
		vColor = vec3(getIntensity());
	#elif defined(color_type_intensity_gradient)
		vColor = texture(gradient, vec2(getIntensity(),1.0-getIntensity())).rgb;
	#elif defined(color_type_color)
		vColor = uColor;
	#elif defined(color_type_lod)
		vColor = texture(gradient, vec2(getLOD_octree()/10.0,1.0-getLOD_octree()/10.0)).rgb;
	#elif defined(color_type_point_index)
		vColor = indices.rgb;
	#elif defined(color_type_classification)
		vColor = getClassification().rgb;
	#elif defined(color_type_return_number)
		vColor = getReturnNumber();
	#elif defined(color_type_source)
		vColor = getSourceID();
	#elif defined(color_type_normal)
		vColor = (modelMatrix*vec4(normal,0.0)).xyz;
	#elif defined(color_type_phong)
		vColor = color;
	#elif defined(color_type_composite)
		vColor = getCompositeColor();
	#endif

	#ifndef color_type_composite
		#if defined(color_type_classification)
			if(getClassification().a==0.0) {
				gl_Position = vec4(100.0); return;
			}
		#endif
	#endif

	#if defined(use_clip_box)
		bool insideAny = false;
<<<<<<< Updated upstream
		for (int i = 0; i < max_clip_boxes; i++) {
			if (i == int(clipBoxCount)) {
				break;
			}

			vec4 clipPosition = clipBoxes[i] * modelMatrix * vec4(position, 1.0);
			bool inside = -0.5 <= clipPosition.x && clipPosition.x <= 0.5;
			inside = inside && -0.5 <= clipPosition.y && clipPosition.y <= 0.5;
			inside = inside && -0.5 <= clipPosition.z && clipPosition.z <= 0.5;
=======
		for(int i=0; i<max_clip_boxes; i++){
			if(i==int(clipBoxCount)) break;
			float tx = mod(float(i)*4.0,256.0);
			float ty = floor(float(i)*4.0/256.0);
			mat4 box = mat4(
				texture(clipBoxesTexture,vec2((tx  )/256.0,ty/256.0)),
				texture(clipBoxesTexture,vec2((tx+1.0)/256.0,ty/256.0)),
				texture(clipBoxesTexture,vec2((tx+2.0)/256.0,ty/256.0)),
				texture(clipBoxesTexture,vec2((tx+3.0)/256.0,ty/256.0))
			);
			vec4 cp = box*modelMatrix*vec4(position,1.0);
			bool inside = all(lessThanEqual(abs(cp.xyz), vec3(0.5)));
>>>>>>> Stashed changes
			insideAny = insideAny || inside;
		}
		if(!insideAny){
			#if defined(clip_outside)
				gl_Position = vec4(1000.0);
			#elif defined(clip_highlight_inside) && !defined(color_type_depth)
				float c = dot(vColor, vec3(1.0))/3.0;
			#endif
		} else {
			#if defined(clip_highlight_inside)
				vColor.r += 0.5;
<<<<<<< Updated upstream
=======
			#elif defined(clip_inside)
				gl_Position = vec4(1000.0, 1000.0, 1000.0, 1.0);
>>>>>>> Stashed changes
			#endif
		}
	#endif
}
