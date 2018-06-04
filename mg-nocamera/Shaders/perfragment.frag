#version 120

uniform int active_lights_n; // Number of active lights (< MG_MAX_LIGHT)
uniform vec3 scene_ambient; // Scene ambient light

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

uniform sampler2D texture0;

varying vec3 f_position;      // camera space
varying vec3 f_viewDirection; // camera space
varying vec3 f_normal;        // camera space
varying vec2 f_texCoord;

float lambert(const vec3 n, const vec3 l) {
	return max(0.0, dot(n, l));
}

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

void direction_light(const in int i,
					 const in vec3 lightDirection,
					 const in vec3 viewDirection,
					 const in vec3 normal,
					 inout vec3 diffuse, inout vec3 specular) {

					float NoL = dot(normal, lightDirection);
					 //acumulación difusa
					 diffuse = diffuse + lambert(normal, lightDirection) * theLights[i].diffuse * theMaterial.diffuse;

					 //acumulación especular
					
					 specular = specular + specular_channel(normal, lightDirection, viewDirection, theMaterial.shininess)*NoL * theMaterial.specular * theLights[i].specular;
}

void point_light(const in int i,
				 const in vec3 position,
				 const in vec3 viewDirection,
				 const in vec3 normal,
				 inout vec3 diffuse, inout vec3 specular) {

				  

				 //calculamos la distancia desde el vertice a la posicion de la luz
				
				 vec3 distLightPos = theLights[i].position.xyz - position;

				 //y luego lo normalizamos -> así conseguimos el vector l = (Pl - Ps) / (|Pl - Ps|)
			 

			     float NoL = dot(normal, distLightPos);

			     //calculamos el modulo para obtener la distancia
			     //sqrt(x*x + y*y + z*z)
			     float d = sqrt(distLightPos.x*distLightPos.x + distLightPos.y*distLightPos.y + distLightPos.z*distLightPos.z);

				 //calculamos el denominador para comprobar si la división por 1 es posible hacerla (Denom>0)	
				 float atenuacion = 0.0;
				 float denominador = theLights[i].attenuation.x + theLights[i].attenuation.y*d + theLights[i].attenuation.z*d*d;
				 distLightPos= normalize(distLightPos);
				 if(denominador > 0) 
				 {
				 	//calculamos la atenuacion: 1/(Aconstante+Alineal*d + Acuadratica*d*d)
					atenuacion = 1/denominador;

					//acumulación difusa y especular
				 diffuse = diffuse + lambert(normal, distLightPos) * theLights[i].diffuse * theMaterial.diffuse * atenuacion;

				 specular = specular + specular_channel(normal, distLightPos, viewDirection, theMaterial.shininess) * NoL * theMaterial.specular * theLights[i].specular * atenuacion;

				 }

				


}

// Note: no attenuation in spotlights

void spot_light(const in int i,
				const in vec3 lightDirection,
				const in vec3 viewDirection,
				const in vec3 normal,
				inout vec3 diffuse, inout vec3 specular) {

				float NoL = dot(normal, lightDirection);
				//calculamos el lambert entre la dirección de la luz y la dirección de la luz spot
				float spotDot = lambert(-lightDirection, normalize(theLights[i].spotDir));


				float cspot = 0.0;

				if(spotDot >= theLights[i].cosCutOff)
				{
					
				//comprobamos si cspot es > 0, ya que si es 0, en la multiplicacion en los valores de los acumuladores diffuse y specular no se acumula nada

					cspot = pow(spotDot, theLights[i].exponent);
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
	
	//no hay que cambiar las variables de modelo, 
	//ya que estas ya están cambiadas al espacio de la camara
	//la normal, ya calculada en el prefragment.vert, solo hay que normalizarla
	vec3 N = normalize(f_normal);


	//la luz 
	vec3 L;

	//dirección de la vista (y la normalizamos)
	vec3 V = normalize(f_viewDirection);

	//vector positionEye: Es el vector de posición convertido al sistema de referencias de la cámara
	vec3 positionEye = f_position;

	
	
	//ciclamos para cada luz activa

	 for(int i=0; i < active_lights_n; ++i) {
		if(theLights[i].position.w == 0.0) {
		  // direction light
		  //pasamos -L 
		  L = normalize(-theLights[i].position.xyz);
		  direction_light(i, L, V, N, diffuse, specular);
		} 

		else {

		  if (theLights[i].cosCutOff == 0.0) {
			// point light
			point_light(i, positionEye, V, N, diffuse, specular);

		  } else {
			// spot light
			//vector desde la luz a VP (punto de vista)
			vec4 luzAVP = (theLights[i].position - vec4(positionEye, 0.0));
			L = normalize(luzAVP.xyz);
			spot_light(i, L, V, N, diffuse, specular);
		 }
		}
	}

	
	vec4 colores = vec4(diffuse + specular,1.0);
	
	vec4 textura = texture2D(texture0, f_texCoord);

	gl_FragColor = vec4(colores * textura);
}
 