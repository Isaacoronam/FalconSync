import { PanoramaCamera, cameraBasis } from './panorama-projection';

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_ndc;

void main() {
  v_ndc = a_position;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

varying vec2 v_ndc;
uniform sampler2D u_texture;
uniform vec3 u_forward;
uniform vec3 u_right;
uniform vec3 u_up;
uniform float u_tanHalfFov;
uniform float u_aspect;

const float PI = 3.141592653589793;

void main() {
  vec3 direction = normalize(
    u_forward
      + u_right * (v_ndc.x * u_tanHalfFov * u_aspect)
      + u_up * (v_ndc.y * u_tanHalfFov)
  );

  float u = atan(direction.x, direction.z) / (2.0 * PI) + 0.5;
  float v = 0.5 - asin(clamp(direction.y, -1.0, 1.0)) / PI;

  gl_FragColor = texture2D(u_texture, vec2(u, v));
}
`;

interface UniformLocations {
  texture: WebGLUniformLocation | null;
  forward: WebGLUniformLocation | null;
  right: WebGLUniformLocation | null;
  up: WebGLUniformLocation | null;
  tanHalfFov: WebGLUniformLocation | null;
  aspect: WebGLUniformLocation | null;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error('PANORAMA_SHADER_UNAVAILABLE');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    throw new Error('PANORAMA_SHADER_ERROR');
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error('PANORAMA_PROGRAM_UNAVAILABLE');
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    throw new Error('PANORAMA_PROGRAM_ERROR');
  }

  return program;
}

/**
 * Visor equirectangular propio sobre WebGL 1. No usa dependencias externas ni
 * reproduce movimiento automático. La cámara se controla desde el componente.
 */
export class PanoramaRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly positionBuffer: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private readonly uniforms: UniformLocations;
  private disposed = false;
  private textureLoaded = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      throw new Error('PANORAMA_WEBGL_UNAVAILABLE');
    }

    this.gl = gl;
    this.program = createProgram(gl);
    this.positionBuffer = this.createPositionBuffer();
    this.texture = this.createTexture();
    this.uniforms = {
      texture: gl.getUniformLocation(this.program, 'u_texture'),
      forward: gl.getUniformLocation(this.program, 'u_forward'),
      right: gl.getUniformLocation(this.program, 'u_right'),
      up: gl.getUniformLocation(this.program, 'u_up'),
      tanHalfFov: gl.getUniformLocation(this.program, 'u_tanHalfFov'),
      aspect: gl.getUniformLocation(this.program, 'u_aspect'),
    };
  }

  static isSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return canvas.getContext('webgl') !== null;
    } catch {
      return false;
    }
  }

  setImage(source: TexImageSource): void {
    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source,
    );
    this.textureLoaded = true;
  }

  resize(cssWidth: number, cssHeight: number, pixelRatio = 1): void {
    const width = Math.max(1, Math.round(cssWidth * pixelRatio));
    const height = Math.max(1, Math.round(cssHeight * pixelRatio));

    if (this.canvas.width !== width) {
      this.canvas.width = width;
    }

    if (this.canvas.height !== height) {
      this.canvas.height = height;
    }

    this.gl.viewport(0, 0, width, height);
  }

  render(camera: PanoramaCamera): void {
    if (this.disposed || !this.textureLoaded) {
      return;
    }

    const gl = this.gl;
    const basis = cameraBasis(camera);
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);

    const position = gl.getAttribLocation(this.program, 'a_position');

    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms.texture, 0);
    gl.uniform3f(
      this.uniforms.forward,
      basis.forward[0],
      basis.forward[1],
      basis.forward[2],
    );
    gl.uniform3f(
      this.uniforms.right,
      basis.right[0],
      basis.right[1],
      basis.right[2],
    );
    gl.uniform3f(this.uniforms.up, basis.up[0], basis.up[1], basis.up[2]);
    gl.uniform1f(this.uniforms.tanHalfFov, basis.tanHalfFov);
    gl.uniform1f(this.uniforms.aspect, aspect);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    const gl = this.gl;

    gl.deleteTexture(this.texture);
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteProgram(this.program);
  }

  private createPositionBuffer(): WebGLBuffer {
    const buffer = this.gl.createBuffer();

    if (!buffer) {
      throw new Error('PANORAMA_BUFFER_UNAVAILABLE');
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      this.gl.STATIC_DRAW,
    );

    return buffer;
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();

    if (!texture) {
      throw new Error('PANORAMA_TEXTURE_UNAVAILABLE');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
  }
}
