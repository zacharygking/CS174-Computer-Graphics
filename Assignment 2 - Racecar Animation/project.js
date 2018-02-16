window.onload = function init() {
  window.contexts = {}; // A global variable, "contexts".  Browsers support up to 16 WebGL contexts per page.

  const scenes = ["Drift_Animation", "Movement_Controls", "Global_Info_Table"]; // Register some scenes to the "Canvas_Manager" object -- which WebGL calls
  // upon every time a draw / keyboard / mouse event happens.  

  if (eval("typeof " + scenes[0]) !== "undefined") {
    document.getElementById("canvases").appendChild(Object.assign(document.createElement("canvas"), {
      id: "main_canvas",
      width: 800,
      height: 600
    }));
    contexts["main_canvas"] = new Canvas_Manager("main_canvas", Color.of(0, 0, 0, 1), scenes); // Manage the WebGL canvas.  Second parameter sets background color.
    for (let c in contexts) contexts[c].render(); // Call render() for each WebGL context on this page.  Then render() will re-queue itself for more calls.

    Code_Manager.display_code(eval(scenes[0])); // Display the code for our demo on the page, starting with the first scene in the list.
    for (let list of[core_dependencies, all_dependencies])
      document.querySelector("#class_list").rows[2].appendChild(Object.assign(document.createElement("td"), {
        innerHTML: list.reduce((acc, x) => acc += "<a href='javascript:void(0);' onclick='Code_Manager.display_code(" + x + ")'>" + x + "</a><br>", "")
      }));
    document.getElementsByName("main_demo_link")[0].innerHTML = "<a href='javascript:void(0);' onclick='Code_Manager.display_code(" + scenes[0] + ")'>" + scenes[0] + "</a><br>";
    document.querySelector("#code_display").innerHTML = "Below is the code for the demo that's running:<br>&nbsp;<br>" + document.querySelector("#code_display").innerHTML;
  }

  document.querySelector("#edit_button").addEventListener('click`', () => {
    code_panel.style.display = class_list.style.display = 'none';
    new_demo_source_code.style.display = 'block';
    document.getElementsByName('new_demo_code')[0].value = code_display.dataset.displayed.toString()
  })
  const form = document.forms.namedItem("new_demo_source_code");
  form.addEventListener('submit', function(event) {
    if (document.getElementsByName("finished")[0].checked)
      alert("Your demo will be submitted.  If approved, you will start being asked for a password to make any further updates to it.  This password " + "will appear right now, below the submit button, and then (assuming submission worked) it will never appear again.  Write it down.");
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/submit-demo?Unapproved", true);
    xhr.responseType = "json";
    xhr.onload = function(event) {
      if (xhr.status != 200) {
        document.querySelector("#submit_result").textContent = "Error " + xhr.status + " when trying to upload.";
        return
      }
      document.querySelector("#submit_result").textContent = this.response.message;
      // if( this.response.hide_finished_checkbox ) { document.getElementsByName( "finished" )[0].checked = false; expert_panel.style.display = "none" }
      if (this.response.show_password) document.getElementsByName("password")[0].style.display = "inline";
      if (this.response.show_overwrite) document.querySelector("#overwrite_panel").style.display = "inline";
    };
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(Array.from(form.elements).reduce((accum, elem) => {
      if (elem.value && !(['checkbox', 'radio'].includes(elem.type) && !elem.checked)) accum[elem.name] = elem.value;
      return accum
    }, {})));
    event.preventDefault();
  }, false);
}

// Below is the demo you will see when you run the program!    
// An example of a Scene_Component that our class Canvas_Manager can manage.  Like most, this one draws 3D shapes.
class Drift_Animation extends Scene_Component {
  constructor(context) {
    super(context);
    var shapes = {
      'triangle': new Triangle(), // At the beginning of our program, instantiate all shapes we plan to use,
      'strip': new Square(), // each with only one instance in the graphics card's memory.
      'bad_tetrahedron': new Tetrahedron(false), // For example we would only create one "cube" blueprint in the GPU, but then 
      'tetrahedron': new Tetrahedron(true), // re-use it many times per call to display to get multiple cubes in the scene.
      'windmill': new Windmill(10),
      'cube': new Cube(),
      'traffic_cone': new Traffic_Cone(),
      'sphere': new Subdivision_Sphere(5)
    };
    this.submit_shapes(context, shapes);
    this.position = 7;
    this.next_position = 8;
    this.max_position = 15;
    this.m_animation_time = 0;

    // Place the camera, which is stored in a scratchpad for globals.  Secondly, setup the projection:  The matrix that determines how depth is treated.  It projects 3D points onto a plane.
    Object.assign(context.globals.graphics_state, {
      camera_transform: Mat4.translation([0, 0, -25]),
      projection_transform: Mat4.perspective(Math.PI / 4, context.width / context.height, .1, 1000)
    });

    // *** Materials: *** Declare new ones as temps when needed; they're just cheap wrappers for some numbers.  1st parameter:  Color (4 floats in RGBA format),
    // 2nd: Ambient light, 3rd: Diffuse reflectivity, 4th: Specular reflectivity, 5th: Smoothness exponent, 6th: Optional texture object, leave off for un-textured.
    Object.assign(this, {
      orangePlastic: context.get_instance(Phong_Model).material(Color.of(1, .6, 0, 1), .4, .4, .8, 40),
      purplePlastic: context.get_instance(Phong_Model).material(Color.of(.9, .5, .9, 1), .4, .4, .8, 40),
      silverPlastic: context.get_instance(Phong_Model).material(Color.of(.5, .5, .5, 1), .9, .8, .4, 10), // Smaller exponent means 
      blueGlass: context.get_instance(Phong_Model).material(Color.of(.5, .5, 1, .2), .4, .8, .4, 40), // a bigger shiny spot.
      fire: context.get_instance(Funny_Shader).material(),
      stars: context.get_instance(Phong_Model).material(Color.of(0, 0, 1, 1), .5, .5, .5, 40, context.get_instance("assets/stars.png")),
      track: context.get_instance(Phong_Model).material(Color.of(1, 1, 1, 1), 0.4, 0, 1, 40, context.get_instance("assets/track.png")),
      wheel: context.get_instance(Phong_Model).material(Color.of(1, 1, 1, 1), 0.2, 0, 1, 40, context.get_instance("assets/tire.jpg")),
      windshield: context.get_instance(Phong_Model).material(Color.of(1, 1, 1, 1), 0.2, 0, 1, 40, context.get_instance("assets/windshield.svg"))
    });
  }

  display(graphics_state) {
    var model_transform = Mat4.identity(); // We begin with a brand new model_transform every frame.
    var track_origin = model_transform.times(Mat4.translation([0, -25, -100]))

    // *** Lights: *** Values of vector or point lights over time.  Two different lights *per shape* supported by Phong_Shader; more requires changing a number in the vertex 
    graphics_state.lights = [new Light(Vec.of(30, 30, 34, 1), Color.of(0, .4, 0, 1), 100000), // shader.  Arguments to construct a Light(): Light source position
      new Light(Vec.of(-10, -20, -14, 0), Color.of(1, 1, .3, 1), 100)
    ]; // or vector (homogeneous coordinates), color, and size.  


    this.draw_track(graphics_state, track_origin);
    this.draw_car(graphics_state, track_origin);
  }
  make_control_panel() {
    this.live_string(() => {
      var globals = this.globals
      var old_fps, new_fps, fps;
      var prev_frame_time = globals.graphics_state.animation_delta_time * 0.001
      new_fps = 1.0 / prev_frame_time

      if (typeof(globals.graphics_state.fps) !== "undefined") {
        old_fps = globals.graphics_state.fps
      } else {
        old_fps = 60
        new_fps = 60
      }

      globals.graphics_state.fps = 0.98 * (old_fps) + .02 * (new_fps)
      return "Frame rate: " + globals.graphics_state.fps.toFixed(3) + "fps"
    });
    this.new_line();
    this.key_triggered_button("Have Camera Follow Car", "k", function() {
        this.follow ^= 1
    }, "green");
    this.new_line();

  }
  draw_track(graphics_state, origin) {
    var flat = Mat4.rotation(Math.PI / 2, Vec.of(1, 0, 0));
    var size = Mat4.scale([100, 0, 100]);
    var track_matrix = origin.times(size).times(flat);

    this.shapes.strip.draw(graphics_state, track_matrix, this.track);

    var cone_start = origin.times(Mat4.translation([0, 0.1, 0]));

    var cone1 = cone_start.times(Mat4.translation([5.5, 0, -4]));
    var cone2 = cone_start.times(Mat4.translation([5.5, 0, 19]));
    this.shapes.traffic_cone.draw(graphics_state, cone1, this.orangePlastic);
    this.shapes.traffic_cone.draw(graphics_state, cone2, this.orangePlastic);

    var cone3 = cone_start.times(Mat4.translation([-23.5, 0, 26]));
    var cone4 = cone_start.times(Mat4.translation([-23.5, 0, 49]));
    this.shapes.traffic_cone.draw(graphics_state, cone3, this.orangePlastic);
    this.shapes.traffic_cone.draw(graphics_state, cone4, this.orangePlastic);

    var cone5 = cone_start.times(Mat4.translation([-23.5, 0, -12]));
    var cone6 = cone_start.times(Mat4.translation([-23.5, 0, -35]));
    this.shapes.traffic_cone.draw(graphics_state, cone5, this.orangePlastic);
    this.shapes.traffic_cone.draw(graphics_state, cone6, this.orangePlastic);

    var cone7 = cone_start.times(Mat4.translation([44.5, 0, -12]));
    var cone8 = cone_start.times(Mat4.translation([44.5, 0, -35]));
    this.shapes.traffic_cone.draw(graphics_state, cone7, this.orangePlastic);
    this.shapes.traffic_cone.draw(graphics_state, cone8, this.orangePlastic);

    var cone9 = cone_start.times(Mat4.translation([5.5, 0, 57]));
    var cone10 = cone_start.times(Mat4.translation([5.5, 0, 80]));
    this.shapes.traffic_cone.draw(graphics_state, cone9, this.orangePlastic);
    this.shapes.traffic_cone.draw(graphics_state, cone10, this.orangePlastic);

    var cone11 = cone_start.times(Mat4.translation([-62.5, 0, 57]));
    var cone12 = cone_start.times(Mat4.translation([-62.5, 0, 80]));
    this.shapes.traffic_cone.draw(graphics_state, cone11, this.orangePlastic);
    this.shapes.traffic_cone.draw(graphics_state, cone12, this.orangePlastic);

    var cone13 = cone_start.times(Mat4.translation([-62.5, 0, -52]));
    var cone14 = cone_start.times(Mat4.translation([-62.5, 0, -75]));
    this.shapes.traffic_cone.draw(graphics_state, cone13, this.orangePlastic);
    this.shapes.traffic_cone.draw(graphics_state, cone14, this.orangePlastic);

    var cone15 = cone_start.times(Mat4.translation([51, 0, -52]));
    var cone16 = cone_start.times(Mat4.translation([51, 0, -75]));
    this.shapes.traffic_cone.draw(graphics_state, cone15, this.orangePlastic);
    this.shapes.traffic_cone.draw(graphics_state, cone16, this.orangePlastic);

    var cone17 = cone_start.times(Mat4.translation([74, 0, 57]));
    var cone18 = cone_start.times(Mat4.translation([74, 0, 80]));
    this.shapes.traffic_cone.draw(graphics_state, cone17, this.orangePlastic);
    this.shapes.traffic_cone.draw(graphics_state, cone18, this.orangePlastic);

    var cone17 = cone_start.times(Mat4.translation([-83.5, 0, 3]));
    var cone18 = cone_start.times(Mat4.translation([-98, 0, 3]));
    this.shapes.traffic_cone.draw(graphics_state, cone17, this.orangePlastic);
    this.shapes.traffic_cone.draw(graphics_state, cone18, this.orangePlastic);

    var rot = Mat4.rotation(Math.PI / 8.5, Vec.of(0, 1, 0));
    var cone19 = cone_start.times(Mat4.translation([81.5, 0, 28.5])).times(rot);
    var cone20 = cone_start.times(Mat4.translation([94, 0, 17.5])).times(rot);
    this.shapes.traffic_cone.draw(graphics_state, cone19, this.orangePlastic);
    this.shapes.traffic_cone.draw(graphics_state, cone20, this.orangePlastic);
  }
  draw_car(graphics_state, origin) {
    var car_height = origin.times(Mat4.translation([0, 2, 0]));

    var positions = [
      [5, 0, 10],
      [-22.5, 0, 40],
      [-40, 0, 18],
      [-38, 0, -18],
      [18, 0, -18],
      [56, 0, -18],
      [62, 0, 18],
      [57, 0, 42],
      [72, 0, 70],
      [95, 0, 50],
      [68, 0, -58],
      [-68, 0, -65],
      [-90, 0, 10],
      [-68, 0, 70],
      [10, 0, 70],
      [26, 0, 28]
    ];
    var angles = [Math.PI / 6, -Math.PI / 4, -3 * Math.PI / 4, -Math.PI, -Math.PI, -4 * Math.PI / 3, -2 * Math.PI / 1.2, -2 * Math.PI / 1.5, -Math.PI, -Math.PI / 2.5, -Math.PI / 12, Math.PI / 4, 4 * Math.PI / 5, Math.PI, Math.PI, 5 * Math.PI / 3];

    var t = Math.trunc((graphics_state.animation_time / 1000) / 0.75)
    this.position = t % (this.max_position + 1)
    this.next_position = this.position + 1
    if (this.next_position > this.max_position) {
      this.next_position = 0
    }

    this.m_animation_time = (graphics_state.animation_time / 1000) % 0.75
    var progress = this.m_animation_time / 0.75

    var difference = [
      positions[this.next_position][0] - positions[this.position][0],
      positions[this.next_position][1] - positions[this.position][1],
      positions[this.next_position][2] - positions[this.position][2]
    ];

    var position = [
      positions[this.position][0] + progress * difference[0],
      positions[this.position][1] + progress * difference[1],
      positions[this.position][2] + progress * difference[2]
    ];

    var car_position = Mat4.translation(position)

    var angle_difference = angles[this.next_position] - angles[this.position];
    if (this.next_position == 0) {
      angle_difference = Math.PI / 2
    }
    var angle = angles[this.position] + progress * angle_difference;
    var car_angle = Mat4.rotation(angle, Vec.of(0, 1, 0));

    // Debug code used to fix position of the car for viewing purposes.
    //var car_position = Mat4.translation([0, 0, 40]);
    //var car_angle = Mat4.rotation(3*Math.PI/2, Vec.of(0, 1, 0));

    var car_center = car_height.times(car_position).times(car_angle);
    var body = car_center.times(Mat4.scale([4, 1, 3]));

    this.shapes.cube.draw(graphics_state, body, this.purplePlastic);
    this.draw_cabin(graphics_state, car_center);
    this.draw_wheels(graphics_state, car_center);

    var looker = Mat4.look_at(Vec.of(position[0], 0, position[2] + 15), Vec.of(position[0], position[1], position[2]), Vec.of(0, 1, 0)); //eye at up
    if (this.follow)
      graphics_state.camera_transform = looker;
  }
  draw_cabin(graphics_state, origin) {
    var cabinSize = Mat4.scale([3, 1, 3]);
    var cabin = origin.times(Mat4.translation([1, 2, 0])).times(cabinSize);

    var winshieldSize = Mat4.scale([10, 1, 2.75]);
    var winshieldRotation = Mat4.rotation(Math.PI / 2, Vec.of(0, 1, 0));
    var winshield = origin.times(Mat4.translation([-2.02, 2, 0])).times(winshieldSize).times(winshieldRotation);


    this.shapes.cube.draw(graphics_state, cabin, this.purplePlastic);
    this.shapes.strip.draw(graphics_state, winshield, this.windshield);
  }
  draw_wheels(graphics_state, origin) {
    var t = graphics_state.animation_time / 1000
    var wheel_spin = Mat4.rotation(2 * t, Vec.of(0, 0, 1));

    // Draw the four wheels (2nd level hierarchy based off center of car base) 
    var wheel = Mat4.scale([1, 1, 0]).times(Mat4.translation([0, -1, 0]));

    var front_right = origin.times(Mat4.translation([-3, 0, -3.02]));
    var front_left = origin.times(Mat4.translation([-3, 0, 3.02]));
    this.shapes.sphere.draw(graphics_state, front_right.times(wheel).times(wheel_spin), this.wheel);
    this.shapes.sphere.draw(graphics_state, front_left.times(wheel).times(wheel_spin), this.wheel);

    var back_right = origin.times(Mat4.translation([3, 0, -3.02]));
    var back_left = origin.times(Mat4.translation([3, 0, 3.02]));
    this.shapes.sphere.draw(graphics_state, back_right.times(wheel).times(wheel_spin), this.wheel);
    this.shapes.sphere.draw(graphics_state, back_left.times(wheel).times(wheel_spin), this.wheel);

    // Draw the four hub caps
    var hubcap = Mat4.scale([.85, .85, 0]).times(Mat4.translation([0, -1.15, 0]));

    var fr = origin.times(Mat4.translation([-3, 0, -3.04]));
    var fl = origin.times(Mat4.translation([-3, 0, 3.04]));

    this.shapes.sphere.draw(graphics_state, fl.times(hubcap).times(wheel_spin), this.silverPlastic);
    this.shapes.sphere.draw(graphics_state, fr.times(hubcap).times(wheel_spin), this.silverPlastic);

    var br = origin.times(Mat4.translation([3, 0, -3.04]));
    var bl = origin.times(Mat4.translation([3, 0, 3.04]));

    this.shapes.sphere.draw(graphics_state, bl.times(hubcap).times(wheel_spin), this.silverPlastic);
    this.shapes.sphere.draw(graphics_state, br.times(hubcap).times(wheel_spin), this.silverPlastic);

  }
}