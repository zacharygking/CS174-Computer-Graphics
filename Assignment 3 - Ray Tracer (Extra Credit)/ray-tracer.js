class Ball {
  constructor(position, size, color, k_a, k_d, k_s, n, k_r, k_refract, refract_index) {
    Object.assign(this, {
      position,
      size,
      color,
      k_a,
      k_d,
      k_s,
      n,
      k_r,
      k_refract,
      refract_index
    })

    // TODO:  Finish filling in data members, using data already present in the others.
    this.model_transform = Mat4.identity().times(Mat4.translation(this.position)).times(Mat4.scale(this.size));
    this.model_inverse = Mat4.inverse(this.model_transform)
  }
  intersect(ray, existing_intersection, minimum_dist) { // TODO:  Given a ray, check if this Ball is in its path.  Its first argument is the ray, a key/value object with an origin and a direction as keys.  The next argument 
    //        is a record of the nearest intersection found so far (a Ball pointer, a t distance value along the ray, and a normal), updates it if needed, and returns it.  
    //        Only counts intersections that are at least a given distance ahead along the ray.     
    //        Tip:  Once intersect() is done, call it in trace() as you loop through all the spheres until you've found the ray's nearest available intersection.  Simply
    //        return a dummy color if the intersection tests positive.  This will show the spheres' outlines, giving early proof that you did intersect() correctly.

    var ray_inv = {
      origin: this.model_inverse.times(ray.origin),
      dir: this.model_inverse.times(ray.dir)
    };

    let dir = Vec.of(ray_inv.dir[0], ray_inv.dir[1], ray_inv.dir[2]);
    let org = Vec.of(ray_inv.origin[0], ray_inv.origin[1], ray_inv.origin[2]);
    let d = Math.pow(org.dot(dir), 2) - (dir.dot(dir) * (org.dot(org) - 1));

    if (d < 0) {
      return existing_intersection;
    }

    let i = org.dot(dir);
    let j = dir.dot(dir);
    var distance, normal;

    let first_intersection = (Math.sqrt(d) - i) / j;
    let second_intersection = (-Math.sqrt(d) - i) / j;

    if (Math.max(first_intersection, second_intersection) <= minimum_dist)
      return existing_intersection;

    if (Math.min(first_intersection, second_intersection) >= minimum_dist)
      distance = Math.min(first_intersection, second_intersection);
    else
      distance = Math.max(first_intersection, second_intersection);

    let inverse_transpose = this.model_inverse.transposed();
    let position = org.plus(dir.times(distance));
    
    var norm = inverse_transpose.times(position).to3();
    if (dir.dot(norm) > 0)
      norm = norm.times(-1, -1, -1);


    var new_intersection = {
      distance: distance,
      ball: this,
      ray: ray,
      normal: norm,
    };

    if (!existing_intersection)
      return new_intersection

    return distance < existing_intersection.distance ? new_intersection : existing_intersection
  }
}

class Ray_Tracer extends Scene_Component // Read in a text file that describes the location of balls and lights, and draw the result using ray tracing.
{ // Textures and a hidden canvas are utilized to paint the pixel colors onto a Square somewhere that WebGL can show.
  //  TODO: Fill in the Ball class (a separate class) where there are TODO comments!
  get_dir(ix, iy) //  TODO: Map an (x,y) pixel to a corresponding xyz vector that reaches the near plane.  If correct, everything under the "background effects" menu will now work. 
    {
      return Vec.of((1 - ix / this.width) * this.left + ix / this.width * this.right, (1 - iy / this.height) * this.bottom + iy / this.height * this.top, -this.near, 0);
    }
  trace(ray, color_remaining, is_primary, is_shadow_ray = false, light_to_check = null) { // TODO:  Given a ray, return the color in that ray's path.  The ray either originates from the camera itself or from a secondary reflection or refraction off of a
    //        ball.  Call Ball's intersect() method on each ball to determine the nearest ball struck, if any, and perform vector math (the Phong reflection formula)
    //        using the resulting intersection record to figure out the influence of light on that spot.  Recurse for reflections and refractions until the final color
    //        is no longer significantly affected by more bounces.
    //
    //        Arguments besides the ray include color_remaining, the proportion of brightness this ray can contribute to the final pixel.  Only if that's still
    //        significant, proceed with the current recursion, computing the Phong model's brightness of each color.  When recursing, scale color_remaining down by k_r
    //        or k_refract, multiplied by the "complement" (1-alpha) of the Phong color this recursion.  Use argument is_primary to indicate whether this is the original
    //        ray or a recursion.  Use the argument light_to_check whenever a recursive call to trace() is done for computing a shadow ray.

    if (color_remaining.norm() < .3) return Color.of(0, 0, 0, 1); // Each recursion, check if there's enough remaining potential for the pixel to be brightened.

    let closest_intersection = {
        distance: Number.POSITIVE_INFINITY,
        ball: null,
        normal: null
      } // An empty intersection object
    
    for (let b of this.balls) closest_intersection = b.intersect(ray, closest_intersection, is_primary ? 1 : .0001);

    if (!closest_intersection.ball) return this.color_missed_ray(ray);

    if (is_shadow_ray) return closest_intersection.distance < light_to_check.position.minus(ray.origin).norm() ? "Shadow! The light was blocked." : "No shadow here!";

    // TODO:   Start adding code your here!
    var ball = closest_intersection.ball
    var iray = closest_intersection.ray
    var normal = closest_intersection.normal
    var distance = closest_intersection.distance

    var color = ball.color.times(ball.k_a)
    let dir = Vec.of(iray.dir[0], iray.dir[1], iray.dir[2]);
    let org = Vec.of(iray.origin[0], iray.origin[1], iray.origin[2]);
    let position = org.plus(dir.times(distance));


    for (var light_num in this.lights) {
      var light = this.lights[light_num]
      var direction = light.position.to3().minus(position)
      var shadow = {
        origin: position,
        dir: direction.to4(0)
      };

      let shadow_intersection = {
        distance: Number.POSITIVE_INFINITY,
        ball: null,
        normal: null
      }
      for (let b of this.balls) shadow_intersection = b.intersect(shadow, shadow_intersection, is_primary ? 1 : .0001);

      let n = normal.normalized()
      let l = direction.normalized()
      let nl = n.dot(l)

      var s = nl < 0
      if (shadow_intersection.ball && (shadow_intersection.distance < 1 && shadow_intersection.distance > 0))
        s = true

      if (s) {
        let r = (n.times(2*nl).minus(l)).normalized()
        let v = org.minus(position).normalized()
        let rv = r.dot(v)

        if (rv > 0) {
          var c = color.times(ball.k_s * Math.pow(rv, ball.n))
          color = color.plus(c)
        }
        
        if (nl > 0) {
          var intersected_color = light.color.mult_pairs(color.to4(1))
          var c = intersected_color.times(ball.k_d * nl)
          color = color.plus(c)
        }
      }
    }

    var color_comp = Vec.of(1.0 - color[0], 1.0 - color[1], 1.0 - color[2], 1)

    var n = normal.to3().normalized()
    var v = (org.minus(position)).normalized()
    var nv = n.dot(v)
    var reflection_direction = (n.times(2*nv).minus(v))
    var reflection = {
      origin: position.to4(1),
      dir: dir
    };
    var reflected_color = this.trace(reflection, color_remaining.mult_pairs(color_comp).times(ball.k_r), false)
    
    var refraction = null
    var refraction_color = Vec.of(0, 0, 0, 1);

    var i = dir.normalized()
    var In = i.dot(n)

    if (!(In < 0.01 && In > -0.01)) {
      var t = 1 - Math.pow(ball.refract_index, 2) * (1 - Math.pow(-In, 2))
      if (t>=0) {
        var a = i.times(ball.refract_index)
        var b = n.times(ball.refract_index * -In - Math.sqrt(t))
        refraction = {
          origin: position.to4(1),
          dir: (a + b).concat(0)
        }
      }
    }

    if (refraction != null) {
      refraction_color = this.trace(refraction, color_remaining.mult_pairs(color_comp).times(ball.k_r), false)
    }
    if (reflected_color == null)
      reflected_color = Color.of(0, 0, 0, 1);

    var combined_color = refraction_color.plus(reflected_color)
    var final_color = combined_color.mult_pairs(color_comp).to4(1)
    var pixel_color = color.plus(final_color)

    return pixel_color

  }
  constructor(context) {
    super(context);
    Object.assign(this, {
      width: 32,
      height: 32,
      near: 1,
      left: -1,
      right: 1,
      bottom: -1,
      top: 1,
      ambient: Vec.of(.1, .1, .1),
      balls: [],
      lights: [],
      curr_background_function: "color",
      background_color: Color.of(0, 0, 0, 1),
      scanline: 0,
      visible: true,
      scratchpad: document.createElement('canvas'),
      gl: context.gl,
      shader: context.get_instance(Phong_Model)
    });

    const shapes = {
      "square": new Square(), // For texturing with and showing the ray traced result
      "sphere": new Subdivision_Sphere(4)
    }; // For drawing with ray tracing turned off
    this.submit_shapes(context, shapes);

    this.texture = new Texture(context.gl, "", false, false); // Initial image source: Blank gif file
    this.texture.image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    context.instances["procedural"] = this.texture;

    this.imageData = new ImageData(this.width, this.height); // Will hold ray traced pixels waiting to be stored in the texture
    this.scratchpad.width = this.width;
    this.scratchpad.height = this.height;
    this.scratchpad_context = this.scratchpad.getContext('2d'); // A hidden canvas for assembling the texture

    this.background_functions = // These convert a ray into a color even when no balls were struck by the ray.
      {
        waves: function(ray) {
          return Color.of(.5 * Math.pow(Math.sin(2 * ray.dir[0]), 4) + Math.abs(.5 * Math.cos(8 * ray.dir[0] + Math.sin(10 * ray.dir[1]) + Math.sin(10 * ray.dir[2]))),
            .5 * Math.pow(Math.sin(2 * ray.dir[1]), 4) + Math.abs(.5 * Math.cos(8 * ray.dir[1] + Math.sin(10 * ray.dir[0]) + Math.sin(10 * ray.dir[2]))),
            .5 * Math.pow(Math.sin(2 * ray.dir[2]), 4) + Math.abs(.5 * Math.cos(8 * ray.dir[2] + Math.sin(10 * ray.dir[1]) + Math.sin(10 * ray.dir[0]))), 1);
        },
        lasers: function(ray) {
          var u = Math.acos(ray.dir[0]),
            v = Math.atan2(ray.dir[1], ray.dir[2]);
          return Color.of(1 + .5 * Math.cos(~~(20 * u)), 1 + .5 * Math.cos(~~(20 * v)), 1 + .5 * Math.cos(~~(8 * u)), 1);
        },
        mixture: (function(ray) {
          return this.background_functions["waves"](ray).mult_pairs(this.background_functions["lasers"](ray)).to4(1)
        }).bind(this),
        ray_direction: function(ray) {
          return Color.of(Math.abs(ray.dir[0]), Math.abs(ray.dir[1]), Math.abs(ray.dir[2]), 1);
        },
        color: (function(ray) {
          return this.background_color;
        }).bind(this)
      };
  }
  color_missed_ray(ray) {
    return this.ambient.mult_pairs(this.background_functions[this.curr_background_function](ray)).to4(1);
  }
  parse_line(tokens) // Load the lines from the textbox into variables.
    {
      for (let i = 1; i < tokens.length; i++) tokens[i] = Number.parseFloat(tokens[i]);
      switch (tokens[0]) {
        case "NEAR":
          this.near = tokens[1];
          break;
        case "LEFT":
          this.left = tokens[1];
          break;
        case "RIGHT":
          this.right = tokens[1];
          break;
        case "BOTTOM":
          this.bottom = tokens[1];
          break;
        case "TOP":
          this.top = tokens[1];
          break;
        case "RES":
          this.width = tokens[1];
          this.height = tokens[2];
          this.scratchpad.width = this.width;
          this.scratchpad.height = this.height;
          break;
        case "SPHERE":
          this.balls.push(new Ball(Vec.of(tokens[1], tokens[2], tokens[3]), Vec.of(tokens[4], tokens[5], tokens[6]), Vec.of(tokens[7], tokens[8], tokens[9]),
            tokens[10], tokens[11], tokens[12], tokens[13], tokens[14], tokens[15], tokens[16]));
          break;
        case "LIGHT":
          this.lights.push(new Light(Vec.of(tokens[1], tokens[2], tokens[3], 1), Color.of(tokens[4], tokens[5], tokens[6], 1), 10000000));
          break;
        case "BACK":
          this.background_color = Color.of(tokens[1], tokens[2], tokens[3], 1);
          this.gl.clearColor.apply(this.gl, this.background_color);
          break;
        case "AMBIENT":
          this.ambient = Vec.of(tokens[1], tokens[2], tokens[3]);
      }
    }
  parse_file() // Turn the text in the textbox into local data members.  Move through the text lines:
    {
      this.balls = [];
      this.lights = [];
      this.scanline = 0;
      this.scanlines_per_frame = 1; // Begin at bottom scanline, forget the last image's speedup factor
      document.getElementById("progress").style = "display:inline-block;"; // Re-show progress bar
      this.camera_needs_reset = true; // Reset camera
      const input_lines = document.getElementById("input_scene").value.split("\n");
      for (let i of input_lines) this.parse_line(i.split(/\s+/));
    }
  load_case(i) {
    document.getElementById("input_scene").value = Test_Cases.data()[i];
  }
  make_control_panel() {
    this.control_panel.innerHTML += "Open some test cases with the blue button.  See their text below:<br>";
    this.control_panel.appendChild(Object.assign(document.createElement("textarea"), {
      id: 'input_scene',
      style: 'white-space:nowrap;overflow-x:scroll;width:400px;height:150px;'
    }));
    this.new_line();
    this.key_triggered_button("Toggle Ray Tracing", "SHIFT+r", function() {
      this.toggle_visible();
    }, "#AF4C50");
    this.control_panel.appendChild(Object.assign(document.createElement("div"), {
      id: 'progress',
      style: 'display:none;'
    }));
    this.new_line();
    this.key_triggered_button("Select Background Effect", 'b', function() {
      document.getElementById("background_list").classList.toggle("show");
      return false;
    }, "#8A8A4C");
    this.key_triggered_button("Select Test Case", 't', function() {
      document.getElementById("testcase_list").classList.toggle("show");
      return false;
    }, "#4C50AF");
    this.control_panel.appendChild(Object.assign(document.createElement("div"), {
      id: 'testcase_list',
      className: 'dropdown-content'
    }));
    this.new_line();
    this.control_panel.appendChild(Object.assign(document.createElement("div"), {
      id: 'background_list',
      className: 'dropdown-content'
    }));
    this.key_triggered_button("Submit Scene Textbox", 'ALT+s', this.parse_file, "#3e8e41");

    for (let i in Test_Cases.data()) {
      let a = document.createElement("a");
      a.addEventListener("click", function() {
        this.load_case(i);
        this.parse_file();
      }.bind(this), false);
      a.innerHTML = i;
      document.getElementById("testcase_list").appendChild(a);
    }
    for (let j in this.background_functions) {
      let a = document.createElement("a");
      a.addEventListener("click", function() {
        this.curr_background_function = j;
      }.bind(this, j), false);
      a.innerHTML = j;
      document.getElementById("background_list").appendChild(a);
    }

    document.getElementById("input_scene").addEventListener("keydown", function(event) {
      event.cancelBubble = true;
    }, false);

    window.addEventListener("click", function(event) {
      if (!event.target.matches('button')) {
        document.getElementById("testcase_list").classList.remove("show");
        document.getElementById("background_list").classList.remove("show");
      }
    }, false);

    this.load_case("test_reflection");
    this.parse_file();
  }
  toggle_visible() {
    this.visible = !this.visible;
    document.getElementById("progress").style = "display:inline-block;"
  }
  set_color(ix, iy, color) // Sends a color to one pixel index of our final result
    {
      const index = iy * this.width + ix;
      this.imageData.data[4 * index] = 255.9 * color[0];
      this.imageData.data[4 * index + 1] = 255.9 * color[1];
      this.imageData.data[4 * index + 2] = 255.9 * color[2];
      this.imageData.data[4 * index + 3] = 255;
    }
  show_explanation(document_element) {
    document_element.innerHTML += "<p>This demo shows a ray tracer implemented in JavaScript.  It reads in a text field that describes the location of " + "balls and lights, and draws the result using CPU ray tracing. Textures and a hidden canvas are utilized to paint the " + "pixel colors onto a Square somewhere that WebGL can show.</p><p>The code of this class is obfuscated.  See the alternate " + "\"assignment\" version for the real code, which is partially filled in with \"TODO\" sections left out as an excercise.</p>";
  }
  display(graphics_state) {
    graphics_state.lights = this.lights;
    graphics_state.projection_transform = Mat4.perspective(90, 1, 1, 1000);
    if (this.camera_needs_reset) {
      graphics_state.camera_transform = Mat4.identity();
      this.camera_needs_reset = false;
    }
    const camera_inv = Mat4.inverse(graphics_state.camera_transform);

    if (!this.visible) // Raster mode, to draw the same shapes out of triangles when you don't want to trace rays
    {
      for (let b of this.balls) this.shapes.sphere.draw(graphics_state, b.model_transform, this.shader.material(b.color.to4(1), b.k_a, b.k_d, b.k_s, b.n));
      this.scanline = 0;
      document.getElementById("progress").style = "display:none";
      return;
    }
    if (!this.texture || !this.texture.loaded) return; // Don't display until we've got our first procedural image
    this.scratchpad_context.drawImage(this.texture.image, 0, 0);
    this.imageData = this.scratchpad_context.getImageData(0, 0, this.width, this.height); // Send the newest pixels over to the texture

    const desired_milliseconds_per_frame = 100;
    if (!this.scanlines_per_frame) this.scanlines_per_frame = 1;
    const milliseconds_per_scanline = Math.max(graphics_state.animation_delta_time / this.scanlines_per_frame, 1);
    this.scanlines_per_frame = desired_milliseconds_per_frame / milliseconds_per_scanline + 1;
    for (let i = 0; i < this.scanlines_per_frame; i++) // Update as many scanlines on the picture at once as we can, based on previous frame's speed
    {
      if (++this.scanline >= this.height) {
        this.scanline = 0;
        document.getElementById("progress").style = "display:none"
      };
      const y = this.scanline;
      document.getElementById("progress").textContent = "Rendering ( " + 100 * y / this.height + "% )...";
      for (let x = 0; x < this.width; x++) {
        // *******************************************************
        // This code traces a single ray at a given (x,y) pixel.
        // It uses get_dir() and the camera matrix to determine the direction.
        const ray = {
          origin: camera_inv.times(Vec.of(0, 0, 0, 1)),
          dir: camera_inv.times(this.get_dir(x, y))
        }; // Apply camera
        this.set_color(x, y, this.trace(ray, Vec.of(1, 1, 1), true)); // ******** Trace a single ray *********
      }
    }
    this.scratchpad_context.putImageData(this.imageData, 0, 0); // Draw the image on the hidden canvas.
    this.texture.image.src = this.scratchpad.toDataURL("image/png"); // Convert the canvas back into an image and send to a texture.

    this.shapes.square.draw(new Graphics_State(), Mat4.translation([0, 0, -1]), this.shader.material(Color.of(0, 0, 0, 1), 1, 0, 0, 1, this.texture));
  }
}