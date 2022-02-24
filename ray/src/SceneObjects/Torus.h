#ifndef __TORUS_H__
#define __TORUS_H__

#include "../scene/scene.h"
#include "Quartic/quartic.h"

typedef std::complex<double> DComplex;
DComplex* solve_quartic(double a, double b, double c, double d);

class Torus
	: public MaterialSceneObject
{
protected:
	double inner_r;
	double outer_r;
public:
	Torus( Scene *scene, Material *mat, double inner, double outer)
		: MaterialSceneObject( scene, mat )
	{
		inner_r = inner;
		outer_r = outer;
	}

	virtual ~Torus(){}

	virtual bool intersectLocal(ray& r, isect& i ) const;
	virtual bool hasBoundingBoxCapability() const { return true; }

    virtual BoundingBox ComputeLocalBoundingBox()
    {
        BoundingBox localbounds;
		localbounds.setMin(glm::dvec3(-1.0f, -1.0f, 0.0f));
		localbounds.setMax(glm::dvec3(1.0f, 1.0f, 1.0f));
        return localbounds;
    }
protected:

	void glDrawLocal(int quality, bool actualMaterials, bool actualTextures) const;

};

#endif 
