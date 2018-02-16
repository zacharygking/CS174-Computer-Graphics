Description - This animation showcases a car drifting around a racetrack.
The car continuously laps the track until the program terminates. The
custom shape that I added to complete this scene was the traffic cone object.
This custom object consists of 6 different triangles, 2 to complete the base,
and then one for each side of the cone. The look_at function is used to follow
the car as it makes its way around the track. 

How I think I fulfilled the rubric:
Creativity - subjective

Complexity and impressive underlying mechanics - subjective

Overall quality - subjective (camera is fluid i.e. it follows a continuous path.)

Hierarchical objects with at least 3 levels - The hubcaps are the 3rd level in 
(car -> wheels -> hubcaps) as is the windshield/texture applied to it
(car body -> car cabin -> windshield).

Demonstrate the camera tracking a moving object - The camera follows the car around, can be toggled
using the 'k' key.

Design polygonal objects of your own - Traffic Cone as mentioned above.

Assign reasonable texture coordinates to and texture an instance of your polygonal objects - Traffic cone
is textured to be "orange plastic" as commonly seen on US roads and highways. Also the track, windshield, and 
wheels use image textures.

Real-time speed/Displaying framerate - The framerate is shown in the "Drift_Animation" portion of the control
panel, also the scene never dropped under 59fps when testing.

*** MUST BE RUN WITH A PYTHON SERVER HOSTING TEXTURE/IMG FILES ***
