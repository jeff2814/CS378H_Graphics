#include <cmath>

#include "Torus.h"
#include "Quartic/quartic.h"

using namespace std;
//https://www.cl.cam.ac.uk/teaching/1999/AGraphHCI/SMAG/node2.html
//thanks to https://github.com/sasamil/Quartic.git (Sasa Milenkovic) for quartic root solver, see LICENSE and README
unsigned int solveP3(double *x,double a,double b,double c) {
	double a2 = a*a;
    	double q  = (a2 - 3*b)/9;
	double r  = (a*(2*a2-9*b) + 27*c)/54;
    	double r2 = r*r;
	double q3 = q*q*q;
	double A,B;
    	if(r2<q3)
    	{
    		double t=r/sqrt(q3);
    		if( t<-1) t=-1;
    		if( t> 1) t= 1;
    		t=acos(t);
    		a/=3; q=-2*sqrt(q);
    		x[0]=q*cos(t/3)-a;
    		x[1]=q*cos((t+M_2PI)/3)-a;
    		x[2]=q*cos((t-M_2PI)/3)-a;
    		return 3;
    	}
    	else
    	{
    		A =-pow(fabs(r)+sqrt(r2-q3),1./3);
    		if( r<0 ) A=-A;
    		B = (0==A ? 0 : q/A);

		a/=3;
		x[0] =(A+B)-a;
		x[1] =-0.5*(A+B)-a;
		x[2] = 0.5*sqrt(3.)*(A-B);
		if(fabs(x[2])<eps) { x[2]=x[1]; return 2; }

		return 1;
        }
}

DComplex* solve_quartic(double a, double b, double c, double d)
{
	double a3 = -b;
	double b3 =  a*c -4.*d;
	double c3 = -a*a*d - c*c + 4.*b*d;

	// cubic resolvent
	// y^3 − b*y^2 + (ac−4d)*y − a^2*d−c^2+4*b*d = 0

	double x3[3];
	unsigned int iZeroes = solveP3(x3, a3, b3, c3);

	double q1, q2, p1, p2, D, sqD, y;

	y = x3[0];
	// THE ESSENCE - choosing Y with maximal absolute value !
	if(iZeroes != 1)
	{
		if(fabs(x3[1]) > fabs(y)) y = x3[1];
		if(fabs(x3[2]) > fabs(y)) y = x3[2];
	}

	// h1+h2 = y && h1*h2 = d  <=>  h^2 -y*h + d = 0    (h === q)

	D = y*y - 4*d;
	if(fabs(D) < eps) //in other words - D==0
	{
		q1 = q2 = y * 0.5;
		// g1+g2 = a && g1+g2 = b-y   <=>   g^2 - a*g + b-y = 0    (p === g)
		D = a*a - 4*(b-y);
		if(fabs(D) < eps) //in other words - D==0
			p1 = p2 = a * 0.5;

		else
		{
			sqD = sqrt(D);
			p1 = (a + sqD) * 0.5;
			p2 = (a - sqD) * 0.5;
		}
	}
	else
	{
		sqD = sqrt(D);
		q1 = (y + sqD) * 0.5;
		q2 = (y - sqD) * 0.5;
		// g1+g2 = a && g1*h2 + g2*h1 = c       ( && g === p )  Krammer
		p1 = (a*q1-c)/(q1-q2);
		p2 = (c-a*q2)/(q1-q2);
	}

    DComplex* retval = new DComplex[4];

	// solving quadratic eq. - x^2 + p1*x + q1 = 0
	D = p1*p1 - 4*q1;
	if(D < 0.0)
	{
		retval[0].real( -p1 * 0.5 );
		retval[0].imag( sqrt(-D) * 0.5 );
		retval[1] = std::conj(retval[0]);
	}
	else
	{
		sqD = sqrt(D);
		retval[0].real( (-p1 + sqD) * 0.5 );
		retval[1].real( (-p1 - sqD) * 0.5 );
	}

	// solving quadratic eq. - x^2 + p2*x + q2 = 0
	D = p2*p2 - 4*q2;
	if(D < 0.0)
	{
		retval[2].real( -p2 * 0.5 );
		retval[2].imag( sqrt(-D) * 0.5 );
		retval[3] = std::conj(retval[2]);
	}
	else
	{
		sqD = sqrt(D);
		retval[2].real( (-p2 + sqD) * 0.5 );
		retval[3].real( (-p2 - sqD) * 0.5 );
	}

    return retval;
}

bool Torus::intersectLocal(ray& r, isect& i) const
{
	// FIXME: check these suspicious initialization.
	i.setObject(this);
	i.setMaterial(this->getMaterial());

    auto dir = r.getDirection();
    auto pos = r.getPosition();
    double len_sq = glm::dot(dir, dir);
    double len_pos = glm::dot(dir, pos);
    double pos_sq = glm::dot(pos, pos);
    double outer_sq = outer_r*outer_r;
    double r_sum = inner_r*inner_r + outer_sq;

    //COEFFICIENTS OF THE QUARTIC
    double c_4 = len_sq*len_sq;
    double c_3 = 4*len_sq*len_pos;
    double c_2 = 2*len_sq*(pos_sq - r_sum) + 4*(len_pos*len_pos) + 4*outer_sq*dir[1]*dir[1];
    double c_1 = 4*(pos_sq - r_sum)*len_pos + 8 *outer_sq * pos[1] * dir[1];
    double c_0 = std::pow((pos_sq - r_sum)*len_pos, 2) - 4*outer_sq*(inner_r*inner_r - pos[1]*pos[1]);

    if(c_4 == 0)
        return false;

    c_3 /= c_4;
    c_2 /= c_4;
    c_1 /= c_4;
    c_0 /= c_4;

    auto roots = solve_quartic(c_3, c_2, c_1, c_0);

    int curMax = 0;
    for(int k = 0; k < 4; k++)
    {
        if(roots[k].imag() == 0 && roots[k].real() > curMax)
            curMax = roots[k].real();
    }
    if(curMax == 0) //no real roots
        return false;

    i.setT(curMax);
    i.setN(glm::normalize(r.at(curMax)));
    return true;
}

