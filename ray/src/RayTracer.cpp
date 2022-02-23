// The main ray tracer.

#pragma warning (disable: 4786)

#include "RayTracer.h"
#include "scene/light.h"
#include "scene/material.h"
#include "scene/ray.h"

#include "parser/Tokenizer.h"
#include "parser/Parser.h"

#include "ui/TraceUI.h"
#include <cmath>
#include <algorithm>
#include <glm/glm.hpp>
#include <glm/gtx/io.hpp>
#include <string.h> // for memset

// Used for glm::to_string
#include "glm/ext.hpp"
#define GLM_ENABLE_EXPERIMENTAL

#include <iostream>
#include <fstream>

using namespace std;
extern TraceUI* traceUI;

// Use this variable to decide if you want to print out
// debugging messages.  Gets set in the "trace single ray" mode
// in TraceGLWindow, for example.
bool debugMode = false;

// Trace a top-level ray through pixel(i,j), i.e. normalized window coordinates (x,y),
// through the projection plane, and out into the scene.  All we do is
// enter the main ray-tracing method, getting things started by plugging
// in an initial ray weight of (0.0,0.0,0.0) and an initial recursion depth of 0.

glm::dvec3 RayTracer::trace(double x, double y)
{
	// Clear out the ray cache in the scene for debugging purposes,
	if (TraceUI::m_debug)
	{
		scene->clearIntersectCache();		
	}

	auto ret = glm::dvec3(0, 0, 0);
	int scale = 1;
	int aa_thresh = 0;
	int counter = 0;
	if(traceUI->aaSwitch())
	{
		scale = traceUI->getSuperSamples();
		aa_thresh = traceUI->getAaThreshold();	
	}
	for(int i = 0 ; i < scale; i ++)
		for(int j = 0; j < scale; j ++)
		{
			int len = aa_thresh/scale;
			ray r(glm::dvec3(0,0,0), glm::dvec3(0,0,0), glm::dvec3(1,1,1), ray::VISIBILITY);
			scene->getCamera().rayThrough(x + aa_thresh/2 - i*len,y + aa_thresh/2 - j*len,r);
			double dummy;
			glm::dvec3 temp = traceRay(r, glm::dvec3(1.0,1.0,1.0), 0, dummy);
			temp = glm::clamp(temp, 0.0, 1.0);
			ret += temp;
			counter++;
		}
	ret *= 1.0/counter; //FIXME? I'm not sure if this is actually averaging out the rays/anti-aliasing them
	
	return ret;
}

glm::dvec3 RayTracer::tracePixel(int i, int j)
{
	glm::dvec3 col(0,0,0);

	if( ! sceneLoaded() ) return col;

	double x = double(i)/double(buffer_width);
	double y = double(j)/double(buffer_height);

	unsigned char *pixel = buffer.data() + ( i + j * buffer_width ) * 3;
	col = trace(x, y);

	pixel[0] = (int)( 255.0 * col[0]);
	pixel[1] = (int)( 255.0 * col[1]);
	pixel[2] = (int)( 255.0 * col[2]);
	return col;
}

#define VERBOSE 0

glm::dvec3 refl_helper(ray& r, const glm::dvec3& n)
{
	return r.getDirection() - 2*glm::dot(r.getDirection(), n) * n;
}

// Do recursive ray tracing!  You'll want to insert a lot of code here
// (or places called from here) to handle reflection, refraction, etc etc.
glm::dvec3 RayTracer::traceRay(ray& r, const glm::dvec3& thresh, int depth, double& t )
{
	isect i;
	glm::dvec3 colorC = glm::dvec3(0, 0, 0);

	if(depth > traceUI->getDepth()) 
		return colorC;

#if VERBOSE
	std::cerr << "== current depth: " << depth << std::endl;
#endif

	if(scene->intersect(r, i)) {
		// YOUR CODE HERE

		// An intersection occurred!  We've got work to do.  For now,
		// this code gets the material for the surface that was intersected,
		// and asks that material to provide a color for the ray.

		// This is a great place to insert code for recursive ray tracing.
		// Instead of just returning the result of shade(), add some
		// more steps: add in the contributions from reflected and refracted
		// rays.
		
		const Material& m = i.getMaterial();
		colorC += m.shade(scene.get(), r, i);

		if(m.Trans())
		{
			bool inside = glm::dot(r.getDirection(), i.getN()) >= RAY_EPSILON;
			double out = (inside) ? -1.0: 1.0;
			auto norm = out*i.getN();
			double n_1 = (inside) ? m.index(i) : 1.0001;
			double n_2 = (inside) ? 1.0001 : m.index(i);

			double cos_1 = glm::dot(-r.getDirection(), norm);
			double sin_2 = n_1/n_2 * sqrt(1-cos_1*cos_1);
			auto dir = glm::dvec3(1, 1, 1);

			if(sin_2 <= 1 && sin_2 >= -1) //domain of sine
			{
				auto ratio = n_1/n_2;
				auto term = sqrt(1 - ratio * ratio * (1 - cos_1 * cos_1));
				dir = (ratio * cos_1 - term) * norm + ratio * r.getDirection();
			}
			else
			{
				//total internal reflection
				dir = refl_helper(r, -1.0*i.getN());
			}

			if(debugMode) {
				cout << "\nREFRACT DIRECTION"  << endl;
				cout << dir << endl;
			}
			double dummy;
			auto nextRay(ray(r.at(i.getT()), glm::normalize(dir), glm::dvec3(1, 1, 1), ray::RayType::REFRACTION));
			auto temp = traceRay(nextRay, thresh, depth + 1, dummy);
			if(debugMode) {
				cout << "KT ATTENTUATION" << endl;
				cout << "before: " << temp << endl;
			}
			if(inside) {
				for(int j = 0; j < 3; j++){
					temp[j] *= pow(m.kt(i)[j], i.getT());
				}
			}
			if(debugMode) {
				cout << "after: " << temp << endl;
				cout << "kt: " << m.kt(i) << endl;
				cout << "t: " << i.getT() << endl;
			}
			if(debugMode) {
				cout << "\nREFRACTION CONTRIBUTIONS" << endl;
				cout << "depth " << depth << endl;
				cout << "contr " << temp << endl;
			}
			colorC += temp;
		}
		// else if (m.Refl())
		// {
		// 	//thresh = thresh * m.kr(i)
		// 	auto dir = refl_helper(r, i.getN());
		// 	colorC += thresh * m.shade(scene.get(), r, i);
		// 	// auto nextRay(ray(r.at(i.getT()), glm::normalize(dir), ray::RayType::REFLECTION));
		// 	// traceRay(nextRay, thresh, traceUI->getDepth(), t);
		// }
		if(debugMode){
			cout << "\ncolor: " << colorC << endl;
		}
	} else {
		// No intersection.  This ray travels to infinity, so we color
		// it according to the background color, which in this (simple) case
		// is just black.
		//
		// FIXME: Add CubeMap support here.
		// TIPS: CubeMap object can be fetched from traceUI->getCubeMap();
		//       Check traceUI->cubeMap() to see if cubeMap is loaded
		//       and enabled.
		if(traceUI->cubeMap())
		{
			auto cm = traceUI->getCubeMap();
			colorC = cm->getColor(r);
		}
		else
		{
			if(debugMode)
				cout << "CubeMap NOT enabled! " << endl;
			colorC = glm::dvec3(0.0, 0.0, 0.0);
		}
	}
#if VERBOSE
	std::cerr << "== depth: " << depth+1 << " done, returning: " << colorC << std::endl;
#endif
	return colorC;
}

RayTracer::RayTracer()
	: scene(nullptr), buffer(0), thresh(0), buffer_width(0), buffer_height(0), m_bBufferReady(false)
{
}

RayTracer::~RayTracer()
{
}

void RayTracer::getBuffer( unsigned char *&buf, int &w, int &h )
{
	buf = buffer.data();
	w = buffer_width;
	h = buffer_height;
}

double RayTracer::aspectRatio()
{
	return sceneLoaded() ? scene->getCamera().getAspectRatio() : 1;
}

bool RayTracer::loadScene(const char* fn)
{
	ifstream ifs(fn);
	if( !ifs ) {
		string msg( "Error: couldn't read scene file " );
		msg.append( fn );
		traceUI->alert( msg );
		return false;
	}

	// Strip off filename, leaving only the path:
	string path( fn );
	if (path.find_last_of( "\\/" ) == string::npos)
		path = ".";
	else
		path = path.substr(0, path.find_last_of( "\\/" ));

	// Call this with 'true' for debug output from the tokenizer
	Tokenizer tokenizer( ifs, false );
	Parser parser( tokenizer, path );
	try {
		scene.reset(parser.parseScene());
	}
	catch( SyntaxErrorException& pe ) {
		traceUI->alert( pe.formattedMessage() );
		return false;
	} catch( ParserException& pe ) {
		string msg( "Parser: fatal exception " );
		msg.append( pe.message() );
		traceUI->alert( msg );
		return false;
	} catch( TextureMapException e ) {
		string msg( "Texture mapping exception: " );
		msg.append( e.message() );
		traceUI->alert( msg );
		return false;
	}

	if (!sceneLoaded())
		return false;

	return true;
}

void RayTracer::traceSetup(int w, int h)
{
	size_t newBufferSize = w * h * 3;
	if (newBufferSize != buffer.size()) {
		bufferSize = newBufferSize;
		buffer.resize(bufferSize);
	}
	buffer_width = w;
	buffer_height = h;
	std::fill(buffer.begin(), buffer.end(), 0);
	m_bBufferReady = true;

	/*
	 * Sync with TraceUI
	 */

	threads = traceUI->getThreads();
	block_size = traceUI->getBlockSize();
	thresh = traceUI->getThreshold();
	samples = traceUI->getSuperSamples();
	aaThresh = traceUI->getAaThreshold();

	// YOUR CODE HERE
	// FIXME: Additional initializations
}

/*
 * RayTracer::traceImage
 *
 *	Trace the image and store the pixel data in RayTracer::buffer.
 *
 *	Arguments:
 *		w:	width of the image buffer
 *		h:	height of the image buffer
 *
 */
void RayTracer::traceImage(int w, int h)
{
	// Always call traceSetup before rendering anything.
	traceSetup(w,h);

	// YOUR CODE HERE
	// FIXME: Start one or more threads for ray tracing
	//
	// TIPS: Ideally, the traceImage should be executed asynchronously,
	//       i.e. returns IMMEDIATELY after working threads are launched.
	//
	//       An asynchronous traceImage lets the GUI update your results
	//       while rendering.

	// Single threaded rn
	for(int x = 0; x < w; x++){
		for(int y = 0; y < h; y++) {
			tracePixel(x, y);
		}
	}
}

int RayTracer::aaImage()
{
	// YOUR CODE HERE
	// FIXME: Implement Anti-aliasing here
	//
	// TIP: samples and aaThresh have been synchronized with TraceUI by
	//      RayTracer::traceSetup() function
	return 0;
}

bool RayTracer::checkRender()
{
	// YOUR CODE HERE
	// FIXME: Return true if tracing is done.
	//        This is a helper routine for GUI.
	//
	// TIPS: Introduce an array to track the status of each worker thread.
	//       This array is maintained by the worker threads.
	return true;
}

void RayTracer::waitRender()
{
	// YOUR CODE HERE
	// FIXME: Wait until the rendering process is done.
	//        This function is essential if you are using an asynchronous
	//        traceImage implementation.
	//
	// TIPS: Join all worker threads here.
}


glm::dvec3 RayTracer::getPixel(int i, int j)
{
	unsigned char *pixel = buffer.data() + ( i + j * buffer_width ) * 3;
	return glm::dvec3((double)pixel[0]/255.0, (double)pixel[1]/255.0, (double)pixel[2]/255.0);
}

void RayTracer::setPixel(int i, int j, glm::dvec3 color)
{
	unsigned char *pixel = buffer.data() + ( i + j * buffer_width ) * 3;

	pixel[0] = (int)( 255.0 * color[0]);
	pixel[1] = (int)( 255.0 * color[1]);
	pixel[2] = (int)( 255.0 * color[2]);
}

