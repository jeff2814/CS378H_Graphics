#include <cmath>
#include <iostream>

#include "light.h"
#include <glm/glm.hpp>
#include <glm/gtx/io.hpp>

extern bool debugMode;

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
		
		if(debugMode) {
			cout << "DIRECTIONAL CALCULATING SHADOW ATTEN" << endl;
			cout << "light direction: " << p << endl;
			cout << "r.pos, r.dir: " << r.getPosition() << " " << r.getDirection() << endl;
			cout << "i.T, i.N: " << i.getT() << " " << i.getN() << endl;
			cout << "isTrans: " << i.getMaterial().Trans() << endl;
		}
		double errorTerm = RAY_EPSILON;
		if (glm::dot(i.getN(), r.getDirection()) < 0) {
			errorTerm *= -1;
		}
		auto newPoint = r.at(i.getT() + errorTerm);
		auto d = r.getDirection();
		auto kt = i.getMaterial().kt(i);
		auto second(ray(newPoint, d, r.getAtten(), ray::RayType::SHADOW));
		isect i2;
		if (scene->intersect(second, i2)) {
			if(debugMode) {
				 cout << "Second Intersection" << endl;
			}
			auto distance = i.getT();
			auto m2 = i2.getMaterial();
			glm::dvec3 mult(std::pow(m2.kt(i2)[0], distance), std::pow(m2.kt(i2)[1], distance), std::pow(m2.kt(i2)[2], distance));
			res *= mult;
		}
		if(debugMode) {
			cout << "kt: " << kt << endl;
			cout << "diffuse: " << i.getMaterial().kd(i) << endl;
			cout << "i.N, i.T: " << i.getN() << i.getT() << endl;
			cout << res << endl;
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
	auto res = glm::dvec3(1.0, 1.0, 1.0);
	isect i;
	auto makeshift(ray(r.getPosition(), r.getDirection(), r.getAtten(), ray::RayType::SHADOW));
	if (scene->intersect(const_cast<ray&>(makeshift), i)) {
		
		if(debugMode) {
			cout << "POINT CALCULATING SHADOW ATTEN" << endl;
			cout << "r.pos, r.dir: " << r.getPosition() << " " << r.getDirection() << endl;
			cout << "i.T, i.N: " << i.getT() << " " << i.getN() << endl;
			cout << "isTrans: " << i.getMaterial().Trans() << endl;
		}
		auto newPoint = makeshift.at(i.getT() + RAY_EPSILON);
		auto d = makeshift.getDirection();
		auto kt = i.getMaterial().kt(i);
		auto second(ray(newPoint, d, r.getAtten(), ray::RayType::SHADOW));
		isect i2;
		if (scene->intersect(second, i2)) {
			auto distance = i2.getT();
			if(debugMode) {
				cout << "second intersection" << endl;
				cout << "i2 T: " << i2.getT() << endl;
			}
			auto m2 = i2.getMaterial();
			glm::dvec3 mult(std::pow(m2.kt(i2)[0], distance), std::pow(m2.kt(i2)[1], distance), std::pow(m2.kt(i2)[2], distance));
			res *= mult;
		}
		if(debugMode) {
			cout << "i.N, i.T: " << i.getN() << i.getT() << endl;
		}
	}
	return res;
}

#define VERBOSE 0

