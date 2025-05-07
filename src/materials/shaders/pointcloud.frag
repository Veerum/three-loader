precision highp float;
precision highp int;

uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform mat4 projectionMatrix;
uniform float opacity;
uniform float blendHardness;
uniform float blendDepthSupplement;
uniform float fov;
uniform float spacing;
uniform float pcIndex;
uniform float screenWidth;
uniform float screenHeight;
uniform sampler2D depthMap;

#if defined(clip_horizontally) || defined(clip_vertically)
uniform vec4 clipExtent;
#endif

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
uniform vec4 highlightedPointColor;
#endif

in vec3 vColor;
#if !defined(color_type_point_index)
in float vOpacity;
#endif
#if defined(weighted_splats)
in float vLinearDepth;
#endif
#if !defined(paraboloid_point_shape) && defined(use_edl)
in float vLogDepth;
#endif
#if (defined(color_type_phong) && (MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0)) || defined(paraboloid_point_shape)
in vec3 vViewPosition;
#endif
#if defined(weighted_splats) || defined(paraboloid_point_shape)
in float vRadius;
#endif
#if defined(color_type_phong) && (MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0)
in vec3 vNormal;
#endif
#ifdef highlight_point
in float vHighlight;
#endif

out vec4 fragColor;

void main() {
vec3 color = vColor;
float depth = gl_FragCoord.z;

#if defined(clip_horizontally) || defined(clip_vertically)
vec2 ndc = vec2(gl_FragCoord.x / screenWidth, 1.0 - gl_FragCoord.y / screenHeight);
if (step(clipExtent.x, ndc.x) * step(ndc.x, clipExtent.z) < 1.0) discard;
if (step(clipExtent.y, ndc.y) * step(ndc.y, clipExtent.w) < 1.0) discard;
#endif

#if defined(circle_point_shape) || defined(paraboloid_point_shape) || defined(weighted_splats)
float u = 2.0 * gl_PointCoord.x - 1.0;
float v = 2.0 * gl_PointCoord.y - 1.0;
#endif
#if defined(circle_point_shape) || defined(weighted_splats)
if (u*u + v*v > 1.0) discard;
#endif

#if defined(weighted_splats)
vec2 uv = gl_FragCoord.xy / vec2(screenWidth, screenHeight);
float sDepth = texture(depthMap, uv).r;
if (vLinearDepth > sDepth + vRadius + blendDepthSupplement) discard;
#endif

#if defined(color_type_point_index)
fragColor = vec4(color, pcIndex / 255.0);
#else
fragColor = vec4(color, vOpacity);
#endif

#ifdef use_point_cloud_mixing
bool doDiscard = false;
if (pointCloudMixingMode == 1) {
    float stepSize = pointCloudID > 10.0 ? pointCloudID/10.0 : pointCloudID;
    doDiscard = mod(gl_FragCoord.x, stepSize) > 0.5 && mod(gl_FragCoord.y, stepSize) > 0.5;
} else if (pointCloudMixingMode == 2) {
    float a = pointCloudMixAngle * pointCloudID / 180.0;
    float uu = cos(a)*gl_FragCoord.x + sin(a)*gl_FragCoord.y;
    float vv = -sin(a)*gl_FragCoord.x + cos(a)*gl_FragCoord.y;
    doDiscard = mod(uu, stripeDistanceX) >= stripeDistanceX/stripeDivisorX
             && mod(vv, stripeDistanceY) >= stripeDistanceY/stripeDivisorY;
}
if (doDiscard) discard;
#endif

#ifdef use_texture_blending
vec4 bg = texture(backgroundMap, gl_FragCoord.xy / vec2(screenWidth, screenHeight));
fragColor = vec4(vOpacity * color, 1.0) + vec4((1.0 - vOpacity) * bg.rgb, 0.0);
#endif

#if defined(color_type_phong)
    #if MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0
    vec3 normal = normalize(vNormal);
    normal.z = abs(normal.z);
    vec3 viewPosition = normalize(vViewPosition);
    #endif
    // Insert Phong lighting calculations here...
#endif

#if defined(weighted_splats)
float w = exp(-pow(2.0 * length(2.0*gl_PointCoord - 1.0), 2.0) * 0.5);
fragColor.rgb *= w;
fragColor.a = w;
#endif

#if defined(paraboloid_point_shape)
float wi = -(u*u + v*v);
vec4 p = vec4(vViewPosition, 1.0);
p.z += wi * vRadius;
float linearDepth = -p.z;
p = projectionMatrix * p;
p /= p.w;
float expDepth = p.z;
depth = (p.z + 1.0) * 0.5;
gl_FragDepth = depth;
    #if defined(color_type_depth)
    fragColor.r = linearDepth;
    fragColor.g = expDepth;
    #endif
    #if defined(use_edl)
    fragColor.a = log2(linearDepth);
    #endif
#elif defined(use_edl)
fragColor.a = vLogDepth;
#endif

#ifdef highlight_point
if (vHighlight > 0.0) fragColor = highlightedPointColor;
#endif
}
