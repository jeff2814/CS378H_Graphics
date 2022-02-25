#include <cmath>
#include <unordered_map>
#include "scene.h"
#include "light.h"
#include "kdTree.h"
#include "../ui/TraceUI.h"
#include <glm/gtx/extended_min_max.hpp>
#include <iostream>
#include <glm/gtx/io.hpp>

using namespace std;

bool Geometry::intersect(ray& r, isect& i) const {
	double tmin, tmax;
	if (hasBoundingBoxCapability() && !(bounds.intersect(r, tmin, tmax))) return false;
	// Transform the ray into the object's local coordinate space
	glm::dvec3 pos = transform->globalToLocalCoords(r.getPosition());
	glm::dvec3 dir = transform->globalToLocalCoords(r.getPosition() + r.getDirection()) - pos;
	double length = glm::length(dir);
	dir = glm::normalize(dir);
	// Backup World pos/dir, and switch to local pos/dir
	glm::dvec3 Wpos = r.getPosition();
	glm::dvec3 Wdir = r.getDirection();
	r.setPosition(pos);
	r.setDirection(dir);
	bool rtrn = false;
	if (intersectLocal(r, i))
	{
		// Transform the intersection point & normal returned back into global space.
		i.setN(transform->localToGlobalCoordsNormal(i.getN()));
		i.setT(i.getT()/length);
		rtrn = true;
	}
	// Restore World pos/dir
	r.setPosition(Wpos);
	r.setDirection(Wdir);
	return rtrn;
}

bool Geometry::hasBoundingBoxCapability() const {
	// by default, primitives do not have to specify a bounding box.
	// If this method returns true for a primitive, then either the ComputeBoundingBox() or
    // the ComputeLocalBoundingBox() method must be implemented.

	// If no bounding box capability is supported for an object, that object will
	// be checked against every single ray drawn.  This should be avoided whenever possible,
	// but this possibility exists so that new primitives will not have to have bounding
	// boxes implemented for them.
	return false;
}

void Geometry::ComputeBoundingBox() {
    // take the object's local bounding box, transform all 8 points on it,
    // and use those to find a new bounding box.

    BoundingBox localBounds = ComputeLocalBoundingBox();
        
    glm::dvec3 min = localBounds.getMin();
    glm::dvec3 max = localBounds.getMax();

    glm::dvec4 v, newMax, newMin;

    v = transform->localToGlobalCoords( glm::dvec4(min[0], min[1], min[2], 1) );
    newMax = v;
    newMin = v;
    v = transform->localToGlobalCoords( glm::dvec4(max[0], min[1], min[2], 1) );
    newMax = glm::max(newMax, v);
    newMin = glm::min(newMin, v);
    v = transform->localToGlobalCoords( glm::dvec4(min[0], max[1], min[2], 1) );
    newMax = glm::max(newMax, v);
    newMin = glm::min(newMin, v);
    v = transform->localToGlobalCoords( glm::dvec4(max[0], max[1], min[2], 1) );
    newMax = glm::max(newMax, v);
    newMin = glm::min(newMin, v);
    v = transform->localToGlobalCoords( glm::dvec4(min[0], min[1], max[2], 1) );
    newMax = glm::max(newMax, v);
    newMin = glm::min(newMin, v);
    v = transform->localToGlobalCoords( glm::dvec4(max[0], min[1], max[2], 1) );
    newMax = glm::max(newMax, v);
    newMin = glm::min(newMin, v);
    v = transform->localToGlobalCoords( glm::dvec4(min[0], max[1], max[2], 1) );
    newMax = glm::max(newMax, v);
    newMin = glm::min(newMin, v);
    v = transform->localToGlobalCoords( glm::dvec4(max[0], max[1], max[2], 1) );
    newMax = glm::max(newMax, v);
    newMin = glm::min(newMin, v);
		
    bounds.setMax(glm::dvec3(newMax));
    bounds.setMin(glm::dvec3(newMin));
}

Scene::Scene()
{
	ambientIntensity = glm::dvec3(0, 0, 0);
}

Scene::~Scene()
{
}

void Scene::add(Geometry* obj) {
	obj->ComputeBoundingBox();
	sceneBounds.merge(obj->getBoundingBox());
	objects.emplace_back(obj);
}

void Scene::add(Light* light)
{
	lights.emplace_back(light);
}


// Get any intersection with an object.  Return information about the 
// intersection through the reference parameter.
bool Scene::intersect(ray& r, isect& i) const {
	double tmin = 0.0;
	double tmax = 0.0;
	bool have_one = false;
	for(const auto& obj : objects) {
		isect cur;
		if( obj->intersect(r, cur) ) {
			if(!have_one || (cur.getT() < i.getT())) {
				i = cur;
				have_one = true;
			}
		}
	}
	if(!have_one)
		i.setT(1000.0);
	// if debugging,
	if (TraceUI::m_debug)
	{
		addToIntersectCache(std::make_pair(new ray(r), new isect(i)));
	}
	return have_one;
}

int findLongestAxis(unordered_map<int, glm::dvec3> v) {
	double zmin, zmax, xmin, xmax, ymin, ymax;
	for(std::pair<int, glm::dvec3> element: v){
		auto currx = element.second[0];
		auto curry = element.second[1];
		auto currz = element.second[2];
		zmin = std::min(zmin, currz);
		zmax = std::max(zmax, currz);
		ymin = std::min(ymin, curry);
		ymax = std::max(ymax, curry);
		xmin = std::min(xmin, currx);
		xmax = std::max(xmax,currx);
	}
	auto max =  std::max(xmax-xmin, std::max(ymax - ymin, zmax - zmin));
	return (max == zmax - zmin) ? 2 : (max == ymax - ymin) ? 1 : 0;
}

BVH* Scene::recursiveBuild(unordered_map<int, glm::dvec3> map) {
	auto v = map;
	auto result = new BVH(); 
	int longest = findLongestAxis(v);
	vector<std::pair<double, int>> axisToSplit;
	unordered_map<int, glm::dvec3> left;
	unordered_map<int, glm::dvec3> right;
	for(std::pair<int, glm::dvec3> element: v){
		axisToSplit.push_back(make_pair(element.second[longest], element.first));
		result->bounds.merge(objects[element.first]->getBoundingBox());
	}
	if( v.size() == 0) {
		cout << "map null reference or empty map" << endl;
		assert(0);
	}
	if(v.size() == 1){
		result->isLeaf = true;
		for(std::pair<int, glm::dvec3> element:v){
			result->index = element.first;
		}
		return result;
	}
	std::sort(axisToSplit.begin(), axisToSplit.end());
	int half = axisToSplit.size()/2;
	std::vector<std::pair<double, int>> split_lo(axisToSplit.begin(), axisToSplit.begin() + half);
	std::vector<std::pair<double, int>> split_hi(axisToSplit.begin() + half, axisToSplit.end());
	for(std::pair<double, int> element:split_lo){
		auto index = element.second;
		left.insert(std::make_pair(index, v.find(index)->second));
	}
	for(std::pair<double, int> element:split_hi){
		auto index = element.second;
		right.insert(std::make_pair(index, v.find(index)->second));;
	}
	result->left = recursiveBuild(left);
	result->right = recursiveBuild(right);
	return result;
}

void Scene::Init(){
	for( int i = 0; i < objects.size(); i++ ) {
		if( (objects[i])->hasBoundingBoxCapability() ){
			boundedObj.push_back(i);
		}
		else{
			nonboundedObj.push_back(i);
		}
	}
	unordered_map<int, glm::dvec3> data;
	for(int i = 0; i < boundedObj.size(); i ++) {
		data.emplace(boundedObj[i], objects[boundedObj[i]]->getBoundingBox().getCentroid());
	}
	root = recursiveBuild(data);
}

TextureMap* Scene::getTexture(string name) {
	auto itr = textureCache.find(name);
	if (itr == textureCache.end()) {
		textureCache[name].reset(new TextureMap(name));
		return textureCache[name].get();
	}
	return itr->second.get();
}


