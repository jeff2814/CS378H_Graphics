#include <cmath>
#include <iostream>

#include "light.h"
#include <glm/glm.hpp>
#include <glm/gtx/io.hpp>


using namespace std;

double DirectionalLight::distanceAttenuation(const glm::dvec3& P) const
{
	// distance to light is infinite, so f(di) goes to 0.  Return 1.
	return 1.0;
}


glm::dvec3 DirectionalLight::shadowAttenuation(const ray& r, const glm::dvec3& p) const
{
	// YOUR CODE HERE:
	// You should implement shadow-handling code here.
	auto res = glm::dvec3(1.0, 1.0, 1.0);
	isect i;
	if (scene->intersect(const_cast<ray&>(r), i)) {
		if (!i.getMaterial().Trans()){
			return glm::dvec3(0, 0, 0);
		}
		auto newPoint = r.at(i.getT() + RAY_EPSILON);
		auto d = r.getDirection();
		auto kt = i.getMaterial().kt(i);
		auto second(ray(newPoint, d, r.getAtten(), ray::RayType::SHADOW));
		isect i2;
		if (scene->intersect(second, i2)) {
			auto distance = i.getT();
			glm::dvec3 mult(std::pow(kt[0], distance), std::pow(kt[1], distance), std::pow(kt[2], distance));
			res *= mult;
		}
	}
	return res;
}

glm::dvec3 DirectionalLight::getColor() const
{
	return color;
}

glm::dvec3 DirectionalLight::getDirection(const glm::dvec3& P) const
{
	return -orientation;
}

double PointLight::distanceAttenuation(const glm::dvec3& P) const
{

	// YOUR CODE HERE

	// You'll need to modify this method to attenuate the intensity 
	// of the light based on the distance between the source and the 
	// point P.  For now, we assume no attenuation and just return 1.0
	auto d = glm::distance(P, position);
	auto quad = 1/( constantTerm + (linearTerm * d) + (quadraticTerm * pow(d, 2)));
	return 1 > quad ? quad : 1;
}

glm::dvec3 PointLight::getColor() const
{
	return color;
}

glm::dvec3 PointLight::getDirection(const glm::dvec3& P) const
{
	return glm::normalize(position - P);
}


glm::dvec3 PointLight::shadowAttenuation(const ray& r, const glm::dvec3& p) const
{
	// YOUR CODE HERE:
	// You should implement shadow-handling code here.
	return glm::dvec3(1,1,1);
}

#define VERBOSE 0

