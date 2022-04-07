Virtual Mannequin Milestone 1:

Partners: Allen Zheng (az5782), Jeffery Wu (jw48726)

Bone Picking:
	Ray Cast: Position - Camera, Direction - Standard conversion from NDC, clip, and using perspective/view matrices
	Ray-Cylinder Intersection: 
		- IntersectBone() will construct a Cylinder object for each bone and call that class's IntersectBody() function
		- IntersectBody() uses coordinate geometry to determine the time(s) of intersection, if any:
			- Distance between a point P (parametrized by ray's p + vt) and line with direction r (cylinder axis) is |PQ x r|/|r|, where Q is a point on the line (cylinder position)
			- Substitute in appropriately, and expand the cross product to get a quadratic in terms of these vectors.
			- The values of a, b, and c, are extracted, quadratic is solved and non-sensical answers are ignored.
			- To check if we are within the height, check two dot products (cosines) between the intersection point and start/end of cylinder.
			- Return earliest t (or -1 if no t values make sense)
		- Bone with the earliest time is picked
	Bone Highlighting: We added a new uniform to determine which bone (index) was highlighted a white color.

Rotations:
	Setup: The selected (dragged = true) and/or hovered bone is detected, with selection being given precedence. 
	Rotation Logic:
		- topDownBoneRotate(): finds the bone to rotate.
			- uses recursiveHelper() to rotate the root bone and its children about the original root's axis
			- rotateHelper() will update position, endpoint, and rotation Quat.
			- points are updated by translation, rotation, then re-translation
		- Mouse Drag:
			- mouse direction is found relative to the plane of the start joint's axis
			- angle is calculated relative to the bone's change (from this mouse direction), adjusted appropriately based on lever arm
			- bone is "flipped" if mouse suddenly drags under it
		- Roll
			- rotation is performed on the bone/cylinder axis, angle = GUI.rollSpeed

Extra Credit - Translations:
	Setup: For mouse drag, right click instead of left click on a bone and the highlighted bone and its children will be translated accordingly.
	Logic: 
		- switch statement in the drag logic
		- topDownBoneTranslate() helper function has parallel logic to above, performs a translation instead.

Skinning:
	Follow equation given in Spec. Perform rotation + translation on v0-3 and weighted avg.










