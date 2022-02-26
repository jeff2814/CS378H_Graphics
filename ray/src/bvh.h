#pragma once

#include "scene/bbox.h"
#include <iostream>
#include <glm/vec3.hpp>

class BVH{
    public:
        BoundingBox bounds;
        BVH *left, *right;
        bool isLeaf;
        int index;
};