#include "cubeMap.h"
#include "ray.h"
#include "material.h"
#include <iostream>
#include "../ui/TraceUI.h"
#include "../scene/material.h"
extern TraceUI* traceUI;

glm::dvec3 CubeMap::getColor(ray r) const
{
	// YOUR CODE HERE
	// FIXME: Implement Cube Map here
	// xpos, xneg, ypos, yneg, zpos, zneg
	using namespace std;
	auto dir = r.getDirection();

	double x_dir = dir[0];
	double y_dir = dir[1];
	double z_dir = dir[2];

	int face = 0;
	double u = 0;
	double v = 0;

	auto max_dir = max(abs(x_dir), max(y_dir, z_dir));
	cout << " x: " << x_dir << " y: " << y_dir << " z " << z_dir << " max " << max_dir << endl;
	if(max_dir == abs(x_dir))
	{
		face = (x_dir > 0) ? 0: 1;
		u = (x_dir > 0) ? y_dir : y_dir;
		v = (x_dir  > 0) ? z_dir: z_dir;
	}
	if(max_dir == abs(y_dir))
	{
		face = (y_dir > 0) ? 2: 3;
		u = (y_dir > 0) ? x_dir: x_dir;
		v = (y_dir > 0) ? z_dir: z_dir;
	}
	if(max_dir == abs(z_dir))
	{
		face = (z_dir > 0) ? 4: 5;
		u = (z_dir > 0) ? x_dir : x_dir;
		v = (z_dir > 0) ? y_dir : y_dir;
	}
	cout << "face: " << face << " u: " << u << " v: " << v << endl;
	auto color =  tMap[face]->getMappedValue(glm::dvec2(abs(u), abs(v)));
	return color;
}

CubeMap::CubeMap()
{
}

CubeMap::~CubeMap()
{
}

void CubeMap::setNthMap(int n, TextureMap* m)
{
	if (m != tMap[n].get())
		tMap[n].reset(m);
}
