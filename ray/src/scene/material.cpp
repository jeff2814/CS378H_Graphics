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
	auto errorTerm = RAY_EPSILON;
	if (glm::dot(i.getN(), r.getDirection()) > 0) {
		errorTerm *= -1.0;
	}
	auto p(r.at(i.getT() + errorTerm));
	auto result = glm::dvec3(0, 0, 0);
	int numLight = 0;
	for ( const auto& pLight : scene->getAllLights() ){
		auto Iin = glm::dvec3(0,0,0);
		auto nextRay(ray(p, -1.0 * pLight->getDirection(p), glm::dvec3(1, 1, 1), ray::RayType::SHADOW));
		auto shadow = pLight->shadowAttenuation(nextRay, p);
		auto distAtten = pLight->distanceAttenuation(p);
		Iin += shadow * pLight->getColor() * distAtten;
		// phong shading I = ka * Iscene + [kd * max(l * n, 0) + ks * max(v * r, 0)^a] * Iin
		auto l = -1.0 * pLight->getDirection(p);
		auto v = glm::normalize( -1.0 * r.getDirection());
		auto wref = glm::normalize(glm::normalize(l) - (2 * glm::dot(glm::normalize(l), i.getN()) * i.getN()));
		auto maxln = getMax(glm::dot(-l, i.getN()), 0);
		if (i.getMaterial().Trans()) {
			maxln = abs(glm::dot(l, i.getN()));
		}
		auto diffuse = maxln * kd(i) * Iin;
		auto maxvr = getMax(glm::dot(v, wref), 0);
		auto specular = pow(maxvr, shininess(i)) * Iin;
		if(shininess(i) == 0){
			specular = glm::dvec3(0, 0, 0);
		}
		auto ambient = ka(i) * scene->ambient();
		if(debugMode) {
			cout << "--------------" << endl;
			cout << "r.pos, r.dir, r.atten:" << r.getPosition() << " " << r.getDirection() << " " << r.getAtten() << endl;
			cout << "i.getN, i.getT: " << i.getN() << " " << i.getT() << endl;
			cout << "m.kd, m.ka, m.ks: " << kd(i) << " " << ka(i) << " " << ks(i) << endl;
			cout << "ShadAtten: " << shadow << endl;
			cout << "distAtten: " << distAtten << endl;
			cout << "mxln: " << maxln << endl;
			cout << "Iin : " << Iin << endl;
			cout << "diff: " << diffuse << endl;
			cout << "spec: " << specular << endl;
			cout << "ambi: " << ambient << endl;
		}
		result += diffuse + specular + ambient;
	}
	return result;
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
