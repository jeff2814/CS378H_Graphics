#include "material.h"
#include "../ui/TraceUI.h"
#include "light.h"
#include "ray.h"
#include "math.h"
#include "glm/ext.hpp"
extern TraceUI* traceUI;

#include <glm/gtx/io.hpp>
#include <iostream>
#include <algorithm>
#include "../fileio/images.h"

using namespace std;
extern bool debugMode;

Material::~Material()
{
}

// Apply the phong model to this point on the surface of the object, returning
// the color of that point.
double getMax(double a, double b) {
	return a > b ? a : b;
}

glm::dvec3 Material::shade(Scene* scene, const ray& r, const isect& i) const
{
	// YOUR CODE HERE

	// For now, this method just returns the diffuse color of the object.
	// This gives a single matte color for every distinct surface in the
	// scene, and that's it.  Simple, but enough to get you started.
	// (It's also inconsistent with the phong model...)

	// Your mission is to fill in this method with the rest of the phong
	// shading model, including the contributions of all the light sources.
	// You will need to call both distanceAttenuation() and
	// shadowAttenuation()
	// somewhere in your code in order to compute shadows and light falloff.
	//	if( debugMode )
	//		std::cout << "Debugging Phong code..." << std::endl;

	// When you're iterating through the lights,
	// you'll want to use code that looks something
	// like this:
	//
	// for ( const auto& pLight : scene->getAllLights() )
	// {
	//              // pLight has type unique_ptr<Light>
	// 		.
	// 		.
	// 		.
	// }
	// phong shading I = ka * Iscene + [kd * max(l * n, 0) + ks * max(v * r, 0)^a] * Iin
	// Might need to replace Iin in the future
	auto Iin = glm::dvec3(1,1,1);
	auto maxln = getMax(glm::dot( glm::normalize(-1.0 * r.getDirection()), i.getN()), 0);
	auto camera = scene->getCamera(); // v in the equation
	auto wref  = glm::normalize(r.getDirection()) - (2 * glm::dot(glm::normalize(r.getDirection()), i.getN()) * i.getN()); // r in the equation
	auto maxvra = pow(getMax( -1.0 * glm::dot(glm::normalize(r.getDirection()), glm::normalize(wref)), 0), shininess(i));
	auto rhs = ((kd(i) * maxln) + (ks(i) * maxvra))* Iin;
	auto lhs = glm::abs(ka(i) * scene->ambient());
	// return glm::abs(rhs);
	return lhs + rhs;
}

TextureMap::TextureMap(string filename)
{
	data = readImage(filename.c_str(), width, height);
	if (data.empty()) {
		width = 0;
		height = 0;
		string error("Unable to load texture map '");
		error.append(filename);
		error.append("'.");
		throw TextureMapException(error);
	}
}

glm::dvec3 TextureMap::getMappedValue(const glm::dvec2& coord) const
{
	// YOUR CODE HERE
	//
	// In order to add texture mapping support to the
	// raytracer, you need to implement this function.
	// What this function should do is convert from
	// parametric space which is the unit square
	// [0, 1] x [0, 1] in 2-space to bitmap coordinates,
	// and use these to perform bilinear interpolation
	// of the values.

	return glm::dvec3(1, 1, 1);
}

glm::dvec3 TextureMap::getPixelAt(int x, int y) const
{
	// YOUR CODE HERE
	//
	// In order to add texture mapping support to the
	// raytracer, you need to implement this function.

	return glm::dvec3(1, 1, 1);
}

glm::dvec3 MaterialParameter::value(const isect& is) const
{
	if (0 != _textureMap)
		return _textureMap->getMappedValue(is.getUVCoordinates());
	else
		return _value;
}

double MaterialParameter::intensityValue(const isect& is) const
{
	if (0 != _textureMap) {
		glm::dvec3 value(
		        _textureMap->getMappedValue(is.getUVCoordinates()));
		return (0.299 * value[0]) + (0.587 * value[1]) +
		       (0.114 * value[2]);
	} else
		return (0.299 * _value[0]) + (0.587 * _value[1]) +
		       (0.114 * _value[2]);
}
