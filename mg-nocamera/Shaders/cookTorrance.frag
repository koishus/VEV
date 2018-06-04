#version 120

//shader cook torrance

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

//definimos las constantes Pi, lambda, rugosidad y kd

const float Pi = 3.14159265358979323846264; 

//la rugosidad tiene un rango de [0, 1]

const float rugosidad = 0.1; //por ejemplo

//lambda -> factor de reflectancia de fresnel
//su rango es [0.01, 0.95]

const float lambda = 0.7; //por ejemplo

//porcentaje de reflexión difusa, kd
//siendo el porcentaje de reflexión especular 1 - kd
//su rango es [0, 1]

const float kd = 0.6;


//**************************************
//definimos las funciones necesarias para implementar el modelo
//BDRF cook torrance
//**************************************

//1.función para implementar la  distribución de Beckman


float distribucion_beckman(in vec3 h, in vec3 N)
{
	float HoN = dot(h,N);
	float resultado = 0.0;
	float factor1 = 0.0;
	float factor2 = 0.0;

	if(HoN >0)
		{
		float denom2 = rugosidad*rugosidad*HoN*HoN;
		
				float denom1 = Pi*rugosidad*rugosidad*pow(HoN, 4);
		
				if(denom1 > 0 && denom2 > 0)
				{
					factor1 = 1/denom1;
					factor2 = (HoN*HoN - 1)/denom2;
					resultado = factor1*exp(factor2);
					
				}
		}

	return resultado;


}

//2.función geométrica

float funcion_geometrica(in vec3 L, in vec3 V, in vec3 h, in vec3 N)
{

	float NoH = dot(N, h);
	float NoV = dot(N, V);
	float NoL = dot(N, L);
	float masking = 0.0;
	float shadowing = 0.0;
	float denom = dot(V, h);
	float resultado = 0.0;

	if(denom>0)
	{
		masking = (2*NoH*NoV)/denom;
		shadowing = (2*NoH*NoL)/denom;

		resultado = min(min(1, masking), shadowing);
	}
	

	return resultado;


}

//3.función para calcular la reflectancia de Fresnel

float fresnel(in vec3 L, in vec3 h)
{
	float LoH = dot(L, h);
	float resultado = 0.0;
	if((1-LoH)>0)
	{
		resultado = lambda + (1-lambda)*(pow(1-LoH, 5));
	}

	return resultado;
}

//4.función para calcular la componente especular


float funcion_especular(in vec3 L, in vec3 V, in vec3 N)
{
	vec3 h = L+V; //vector medio l+v
	vec3 hNorm = normalize(h); //normalizamos el vector medio

	float resultado = 0.0;
	float NoL = dot(N, L);
	float NoV = dot(N, V);
	float denominador = 4 * NoL * NoV;

	//comprobamos que se pueda dividir
	if(denominador != 0)
	{
		resultado = ((fresnel(L, hNorm)*funcion_geometrica(L, V, hNorm, N)*distribucion_beckman(hNorm, N))/denominador);
	}

	return resultado;
}

//5.modelo bdrf
vec3 cook_torrance(in vec3 diffuse, in vec3 L, in vec3 V, in vec3 N)
{
	vec3 resultado = vec3(0.0);
	

	float especular = funcion_especular(L, V, N);

	resultado = theMaterial.diffuse * kd + especular * (1 - kd);

	return resultado;

}

//función para la aportación lambertiana

float lambert(const vec3 n, const vec3 l) {
	return max(0.0, dot(n, l));
}

//**************************************
//definimos las funciones para las luces:
//direccional, posicional, spotlight 
//**************************************

void direction_light(const in int i,
					 const in vec3 lightDirection,
					 const in vec3 viewDirection,
					 const in vec3 normal,
					 inout vec3 diffuse, inout vec3 color_final) {

					color_final = cook_torrance(diffuse, lightDirection, viewDirection, normal);	

					
}		

void point_light(const in int i,
				 const in vec3 position,
				 const in vec3 viewDirection,
				 const in vec3 normal,
				 inout vec3 diffuse, inout vec3 color_final) {

				  

				 //calculamos la distancia desde el vertice a la posicion de la luz
				
				 vec3 distLightPos = theLights[i].position.xyz - position;

			
			     //calculamos el modulo para obtener la distancia
			     //sqrt(x*x + y*y + z*z)
			     float d = sqrt(distLightPos.x*distLightPos.x + distLightPos.y*distLightPos.y + distLightPos.z*distLightPos.z);

				 //calculamos el denominador para comprobar si la división por 1 es posible hacerla (Denom>0)	
				 float atenuacion = 0.0;
				 float denominador = theLights[i].attenuation.x + theLights[i].attenuation.y*d + theLights[i].attenuation.z*d*d;

				 //lo normalizamos -> así conseguimos el vector l = (Pl - Ps) / (|Pl - Ps|)
			     distLightPos = normalize(distLightPos);


				 if(denominador > 0) 
				 {
				 	//calculamos la atenuacion: 1/(Aconstante+Alineal*d + Acuadratica*d*d)
					atenuacion = 1/denominador;

					diffuse = diffuse*atenuacion;
					

					color_final = cook_torrance(diffuse, distLightPos, viewDirection, normal);


				 }

				

}

// Note: no attenuation in spotlights

void spot_light(const in int i,
				const in vec3 lightDirection,
				const in vec3 viewDirection,
				const in vec3 normal,
				inout vec3 diffuse, inout vec3 color_final) {

				float NoL = dot(normal, lightDirection);
				//calculamos el lambert entre la dirección de la luz y la dirección de la luz spot
				float spotDot = lambert(-lightDirection, normalize(theLights[i].spotDir));


				float cspot = 0.0;

				if(spotDot >= theLights[i].cosCutOff)
				{
					
					//cspot = max(-l·s, 0.0)^exp -> el máximo ya lo hace lambert, por lo que queda así:
					cspot = pow(spotDot, theLights[i].exponent);
				
				//comprobamos si cspot es > 0, ya que si es 0, en la multiplicacion en los valores de los acumuladores diffuse y specular no se acumula nada
					if(cspot > 0)
					{
						diffuse= diffuse*cspot;
						

				
						color_final = cook_torrance(diffuse, lightDirection, viewDirection, normal);

					}
						
					}
}

void main() {

vec3 color = vec3(0.0); 
vec3 color_sum = vec3(0.0);

//acumuladores (difuso y especular)
	vec3 diffuse = theMaterial.diffuse; //ese es su valor en nuestro caso
	vec3 specular = vec3(0.0); //su valor se calcula mediante la función funcion_especular
	
	//no hay que cambiar las variables de modelo, 
	//ya que estas ya están cambiadas al espacio de la camara
	//la normal, ya calculada en el prefragment.vert, solo hay que normalizarlo
	vec3 N = normalize(f_normal);


	//la luz 
	vec3 L;

	//dirección de la vista: hacer lo mismo que con la normal del vertice
	vec3 V = normalize(f_viewDirection);


	//vector positionEye: Es el vector de posición convertido al sistema de referencias de la cámara

	vec3 positionEye = (f_position);

	//ciclamos para cada luz activa

	 for(int i=0; i < active_lights_n; ++i) {
		if(theLights[i].position.w == 0.0) {
		  // direction light
		  //pasamos -L 
		  L = normalize(-theLights[i].position.xyz);
		  direction_light(i, L, V, N, diffuse, color);
		} 

		else {
			vec4 luzAVP = (theLights[i].position - vec4(positionEye, 0.0));
			L = normalize(luzAVP.xyz);
			
		  if (theLights[i].cosCutOff == 0.0) {
			// point light
			//en el caso del point light, calculamos la componente especular dentro de la función
			point_light(i, positionEye, V, N, diffuse, color);

		  } else {
			// spot light
			//vector desde la luz a VP (punto de vista)
			
			spot_light(i, L, V, N, diffuse, color);
		 }
		}
		float NoL= dot(N, L);
		color_sum += theLights[i].diffuse * NoL * color;
	}

	vec4 textura = texture2D(texture0, f_texCoord);
	vec4 f_color = vec4(color_sum, 1.0);
	gl_FragColor = (f_color * textura);
}