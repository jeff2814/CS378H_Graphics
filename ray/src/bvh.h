#pragma once

#include "scene/bbox.h"
#include <iostream>

class BVH{
    public:
        BoundingBox bounds;
        BVH *left, *right;
        bool isLeaf;
        int index;
};