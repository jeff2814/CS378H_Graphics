#include "trimesh.h"
#include <assert.h>
#include <float.h>
#include <string.h>
#include <algorithm>
#include <cmath>
#include "../ui/TraceUI.h"
#include <iostream>
#include <unordered_map>
#include <memory>
#include <utility>

// Used for glm::to_string
#include "glm/ext.hpp"
#define GLM_ENABLE_EXPERIMENTAL

#include <typeinfo>
extern bool debugMode;

extern TraceUI* traceUI;
using namespace std;

Trimesh::~Trimesh()
{
	for (auto m : materials)
		delete m;
	for (auto f : faces)
		delete f;
}

// must add vertices, normals, and materials IN ORDER
void Trimesh::addVertex(const glm::dvec3& v)
{
	vertices.emplace_back(v);
}

void Trimesh::addMaterial(Material* m)
{
	materials.emplace_back(m);
}

void Trimesh::addNormal(const glm::dvec3& n)
{
	normals.emplace_back(n);
}

// Returns false if the vertices a,b,c don't all exist
bool Trimesh::addFace(int a, int b, int c)
{
	int vcnt = vertices.size();

	if (a >= vcnt || b >= vcnt || c >= vcnt)
		return false;

	TrimeshFace* newFace = new TrimeshFace(
	        scene, new Material(*this->material), this, a, b, c);
	newFace->setTransform(this->transform);
	if (!newFace->degen)
		faces.push_back(newFace);
	else
		delete newFace;

	// Don't add faces to the scene's object list so we can cull by bounding
	// box
	return true;
}

// Check to make sure that if we have per-vertex materials or normals
// they are the right number.
const char* Trimesh::doubleCheck()
{
	if (!materials.empty() && materials.size() != vertices.size())
		return "Bad Trimesh: Wrong number of materials.";
	if (!normals.empty() && normals.size() != vertices.size())
		return "Bad Trimesh: Wrong number of normals.";

	return 0;
}

bool Trimesh::intersectLocal(ray& r, isect& i) const
{
	double tmin = 0.0;
	double tmax = 0.0;
	vector<BVH*> s;
	s.push_back(root);
	bool have_one = false;
	while(!s.empty()) {
		BVH* curr = s[s.size() - 1];
		// cout << curr << endl;
		s.pop_back();
		if(curr->bounds.intersect(r, tmin, tmax)){
			if(curr->isLeaf){
				isect cur;
				if (faces[curr->index]->intersectLocal(r, cur)) {
					if (!have_one || (cur.getT() < i.getT())) {
						i = cur;
						have_one = true;
					}
				}
				continue;
			}
		}
		if(curr->left != nullptr)
			s.push_back(curr->left);
		if(curr->right != nullptr)
			s.push_back(curr->right);
	}
	// for (auto face : faces) {
	// 	isect cur;
	// 	if (face->intersectLocal(r, cur)) {
	// 		if (!have_one || (cur.getT() < i.getT())) {
	// 			i = cur;
	// 			have_one = true;
	// 		}
	// 	}
	// }
	if (!have_one)
		i.setT(1000.0);
	return have_one;
}

bool TrimeshFace::intersect(ray& r, isect& i) const
{
	return intersectLocal(r, i);
}

int findLongestAxis2(unordered_map<int, glm::dvec3> v) {
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

BVH* Trimesh::recursiveBuild(unordered_map<int, glm::dvec3> map) {
	auto v = map;
	auto result = new BVH(); 
	// cout << "constructed result:" << result << endl;
	int longest = findLongestAxis2(v);
	vector<std::pair<double, int>> axisToSplit;
	unordered_map<int, glm::dvec3> left;
	unordered_map<int, glm::dvec3> right;
	for(std::pair<int, glm::dvec3> element: v){
		axisToSplit.push_back(make_pair(element.second[longest], element.first));
		result->bounds.merge(faces[element.first]->getBoundingBox());
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
		int index = element.second;
		left.insert(std::make_pair(index, v.find(index)->second));
	}
	for(std::pair<double, int> element:split_hi){
		int index = element.second;
		right.insert(std::make_pair(index, v.find(index)->second));
	}
	result->left = recursiveBuild(left);
	// cout << "result left:" << result->left << endl;
	result->right = recursiveBuild(right);
	// cout << "result right:" << result->right << endl;
	return result;
}

void Trimesh::Init(){
	unordered_map<int, glm::dvec3> map;
	for(int i = 0; i < faces.size(); i ++) {
		glm::dvec3 vec = faces[i]->getBoundingBox().getCentroid();
		auto pair = std::make_pair(i, vec);
		map.insert(pair);
	}
	root = recursiveBuild(map);
}

// Intersect ray r with the triangle abc.  If it hits returns true,
// and put the parameter in t and the barycentric coordinates of the
// intersection in u (alpha) and v (beta).
bool TrimeshFace::intersectLocal(ray& r, isect& i) const
{
	// YOUR CODE HERE
	//
	// FIXME: Add ray-trimesh intersection
	if(degen) {
		return false;
	}
	auto a = parent->vertices[ids[0]];
	auto b = parent->vertices[ids[1]];
	auto c = parent->vertices[ids[2]];
	auto o = r.getPosition();
	auto v = r.getDirection();
	// cout << glm::to_string(normal) << endl;
	double denom = glm::dot(v, -normal);
	// arbitrary constant to make sure no blow up
	if(denom < 0.0001){
		return false;
	}
	auto t = glm::dot(a -o, -normal)/denom;
	if(t < 0){
		return false;
	}
	auto p = r.at(t);
	// cout << typeid(glm::dot(glm::cross(b - a,p - a), normal)).name() << " " << endl;
	if(glm::dot(glm::cross(b - a,p - a), normal) < 0){
		return false;
	}
	auto baryu = glm::dot(glm::cross(c- a, c - p), normal)/glm::length(glm::cross(a-b, c-a)); //APC, B
	auto baryv = glm::dot(glm::cross(b - c, b - p), normal)/glm::length(glm::cross(a-b, c-a)); //BPC, A
	auto baryw = 1- baryu - baryv;
	if(baryu < 0){
		return false;
	}
	if(baryv < 0){
		return false;
	}
	// cout << baryu << " " << baryv << endl;
	// Does intersect triangle
	i.setT(t);
	// Barycentric coordinates - basically, how can we represent P as an average of vertices?
	// FIXME: Might need to switch around u, v
	i.setBary(baryu, baryv, 1 - baryu - baryv);
	i.setObject(this);

	if(parent->normals.empty())
		i.setN(normal);
	else
	{
		// 012, 021, 102
		auto newNorm = baryu * parent->normals[ids[1]];
		newNorm += baryv * parent->normals[ids[0]];	
		newNorm += baryw * parent->normals[ids[2]];
		i.setN(glm::normalize(newNorm));
	}

	if(parent->materials.empty())
	{
		i.setMaterial(*this->material);
		//cout << "curr material: " << glm::to_string(i.getMaterial().kd(i)) << endl;
	}
	else
	{
		Material m = baryu * ((parent->materials[ids[1]])[0]);
		m += baryv * ((parent->materials[ids[0]])[0]);
		m += baryw * ((parent->materials[ids[2]])[0]);
		i.setMaterial(m);
		if(debugMode)
		{
			cout << "corners " << glm::to_string(a) << glm::to_string(b) << glm::to_string(c) << endl;
			cout << "vals " << baryu << " " << baryv << " " << baryw << endl;
			cout << "center diff: " << glm::to_string(baryu*b + baryv*a + baryw*c - p) << endl;
		}
	}
	return true;
}

// Once all the verts and faces are loaded, per vertex normals can be
// generated by averaging the normals of the neighboring faces.
void Trimesh::generateNormals()
{
	int cnt = vertices.size();
	normals.resize(cnt);
	std::vector<int> numFaces(cnt, 0);

	for (auto face : faces) {
		glm::dvec3 faceNormal = face->getNormal();

		for (int i = 0; i < 3; ++i) {
			normals[(*face)[i]] += faceNormal;
			++numFaces[(*face)[i]];
		}
	}

	for (int i = 0; i < cnt; ++i) {
		if (numFaces[i])
			normals[i] /= numFaces[i];
	}

	vertNorms = true;
}

