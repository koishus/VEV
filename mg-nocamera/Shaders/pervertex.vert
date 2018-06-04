#version 120

uniform mat4 modelToCameraMatrix;
uniform mat4 cameraToClipMatrix;
uniform mat4 modelToWorldMatrix;
uniform mat4 modelToClipMatrix;

uniform int active_lights_n; // Number of active lights (< MG_MAX_LIGHT)
uniform vec3 scene_ambient;  // rgb

uniform struct light_t {
	vec4 position;    // Camera space
	vec3 diffuse;     // rgb
	vec3 specular;    // rgb
	vec3 attenuation; // (constant, lineal, quadratic)
	vec3 spotDir;     // Camera space
	float cosCutOff;  // cutOff cosine
	float exponent;
} theLights[4];     // MG_MAX_LIGHTS

uniform struct material_t {
	vec3  diffuse;
	vec3  specular;
	float alpha;
	float shininess;
} theMaterial;

attribute vec3 v_position; // Model space
attribute vec3 v_normal;   // Model space
attribute vec2 v_texCoord;

varying vec4 f_color;
varying vec2 f_texCoord;


//devolvemos el máximo entre 0 y dot ya que éste último puede dar valores negativos
float lambert(vec3 n, const vec3 l) {
	return max(0.0, dot(n, l));
}

//funcion para calcular el valor especular de la luz, tomando como parametros 
//la normal de la superficie, el vector de luz, el vector de vista  y el factor de
//brillo m
float specular_channel(const vec3 n,
					   const vec3 l,
					   const vec3 v,
					   float m) {

			   
	float resultado = 0.0;

		//calculamos la reflexion
		vec3 r = 2*(max(dot(n, l), 0.0))*n - l;
		//vec3 rnorm = normalize(r);

		//calculamos el dot del el vector que va de r a v
		float rv = dot(r, v);
		
		//el resultado será el resultado elevado al exponente brillo del material
		if(rv >= 0)
		{
			resultado = pow(rv, m);
		}
		
	return resultado;
}


//funciones para el cálculo del color con luz direccional, posicional y spotlight
void direction_light(const in int i,
					 const in vec3 lightDirection,
					 const in vec3 viewDirection,
					 const in vec3 normal,
					 inout vec3 diffuse, inout vec3 specular) {


					 float NoL = dot(normal, viewDirection);
					 //acumulación difusa
					 diffuse = diffuse + lambert(normal, lightDirection) * theLights[i].diffuse * theMaterial.diffuse;

					 //acumulación especular
					 //multiplicaremos el resultado que da la funcion specular_channel por el resultado de la multiplicacion tensorial
					 //entre la constante especular del material y la intensidad especular de la fuente de luz
					 specular = specular + specular_channel(normal, lightDirection, viewDirection, theMaterial.shininess)*NoL * theMaterial.specular * theLights[i].specular;


}

//HACER ATENUACION

void point_light(const in int i,
				 const in vec3 position,
				 const in vec3 viewDirection,
				 const in vec3 normal,
				 inout vec3 diffuse, inout vec3 specular) {

				 float NoL = dot(normal, viewDirection);

				 //calculamos la distancia desde el vertice a la posicion de la luz
				
				 vec3 distancia = theLights[i].position.xyz - position;

				 //lo normalizamos -> así conseguimos el vector l = (Pl - Ps) / (|Pl - Ps|)
			     vec3 distLightPos = normalize(distancia);

			     //calculamos el modulo para obtener la distancia
			     //sqrt(x*x + y*y + z*z)
			     float d = sqrt(distLightPos.x*distLightPos.x + distLightPos.y*distLightPos.y + distLightPos.z*distLightPos.z);

				 //calculamos el denominador para comprobar si la división por 1 es posible hacerla (Denom>0)	
				 float atenuacion = 0.0;
				 float denominador = theLights[i].attenuation.x + theLights[i].attenuation.y*d + theLights[i].attenuation.z*d*d;

				 if(denominador > 0) 
				 {
				 	//calculamos la atenuacion: 1/(Aconstante+Alineal*d + Acuadratica*d*d)
					atenuacion = 1/denominador;

				 }

				//multiplicaremos el resultado que da la funcion specular_channel por el resultado de la multiplicacion tensorial
				//entre la constante especular del material y la intensidad especular de la fuente de luz
				 diffuse = diffuse + lambert(normal, distLightPos) * theLights[i].diffuse * theMaterial.diffuse * atenuacion;

				 specular = specular + specular_channel(normal, distLightPos, viewDirection, theMaterial.shininess) * NoL * theMaterial.specular * theLights[i].specular * atenuacion;
}


// Note: no attenuation in spotlights

void spot_light(const in int i,
				const in vec3 lightDirection,
				const in vec3 viewDirection,
				const in vec3 normal,
				inout vec3 diffuse, inout vec3 specular) {

				float NoL = dot(normal, viewDirection);
				//calculamos el lambert entre la dirección de la luz y la dirección de la luz spot
				

				float spotDot = lambert(-lightDirection, theLights[i].spotDir);


				float cspot = 0.0;

				if(spotDot >= theLights[i].cosCutOff)
				{
					//si el coseno es menor -> está dentro, por lo que calcularemos el factor de intensidad del foco 
					//cspot = max(-l·s, 0.0)^exp -> el máximo ya lo hace lambert, por lo que queda así:
					cspot = pow(spotDot, theLights[i].exponent);
				
				//comprobamos si cspot es > 0, ya que si es 0, en la multiplicacion en los valores de los acumuladores diffuse y specular no se acumula nada
					if(cspot > 0)
					{
						//realizamos las acumulaciones de iluminación difusa y especular
						diffuse = diffuse + lambert(normal, normalize(lightDirection)) * theLights[i].diffuse * cspot;
						
						specular = specular + specular_channel(normal, lightDirection, viewDirection, theMaterial.shininess) * NoL * theMaterial.specular * theLights[i].specular * cspot;
					}
						
					}
				}


				


void main() {
	//acumuladores (difuso y especular)
	vec3 diffuse = vec3(0.0); 
	vec3 specular = vec3(0.0);

	//normal del vértice: hay que cambiarlo al modelo de la cámara, 
	//ya que v_normal está en espacio del modelo
	//premultiplicamos por la matriz de modelo a cámara,
	//y cambiamos N a un vector 4x1 para multiplicarlo con la matriz

	
	//vector normal 4x1
	vec4 N4 = (modelToCameraMatrix) * vec4(v_normal, 0.0);

	//vector normal (N4) normalizado
	vec3 nNormalizado = normalize(N4.xyz);

	//la luz 
	vec3 L;

	//dirección de la vista: hacer lo mismo que con la normal del vertice
	vec3 V;

	//acumulamos por cada luz la aportación difusa de cada luz
	//será el dot(Normal, luz), devuelto por lambert(n, l)
	//para las formulas ha de ser saliente -> cambiamos el símbolo:
	//dot(N, -L) 

	//vector positionEye: Es el vector de posición convertido al sistema de referencias de la cámara
	vec4 positionEye = modelToCameraMatrix * vec4(v_position, 1.0);
	V = -normalize(positionEye.xyz);

	//ciclamos para cada luz activa

	 for(int i=0; i < active_lights_n; ++i) {
		if(theLights[i].position.w == 0.0) {
		  // direction light
		  //pasamos -L 
		  L = normalize(-theLights[i].position.xyz);
		  direction_light(i, L, V, nNormalizado, diffuse, specular);
		} 

		else {

		  if (theLights[i].cosCutOff == 0.0) {
			// point light
		
			point_light(i, positionEye.xyz, V, nNormalizado, diffuse, specular);

		  } else {
			// spot light
			//vector desde la luz a VP (punto de vista)
			vec4 luzAVP = (theLights[i].position - positionEye);
			vec3 luzVP = normalize(luzAVP.xyz);
			spot_light(i, luzVP, V, nNormalizado, diffuse, specular);
		 }
		}
	}

	//color; la última coordenada es para la transparencia
	f_color = vec4(diffuse, 1.0);

	//paso de la posición del vértice al clip
	gl_Position = modelToClipMatrix * vec4(v_position, 1.0);

	//coordenadas de texturas
	f_texCoord = v_texCoord;
}
