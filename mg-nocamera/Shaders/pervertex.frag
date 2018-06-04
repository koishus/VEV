#version 120

varying vec4 f_color;
varying vec2 f_texCoord;

uniform sampler2D texture0;

void main() {
//mezclar el texel correspondiente con el color
	gl_FragColor = f_color * texture2D(texture0, f_texCoord);
}

