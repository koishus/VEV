#include "tools.h"
#include "avatar.h"
#include "scene.h"

Avatar::Avatar(const std::string &name, Camera * cam, float radius) :
	m_name(name), m_cam(cam), m_walk(false) {
	Vector3 P = cam->getPosition();
	m_bsph = new BSphere(P, radius);
}

Avatar::~Avatar() {
	delete m_bsph;
}

bool Avatar::walkOrFly(bool walkOrFly) {
	bool walk = m_walk;
	m_walk = walkOrFly;
	return walk;
}

// TODO:
//
// AdvanceAvatar: see if avatar can advance 'step' units.

/*PREGUNTAR YA*/
bool Avatar::advance(float step) {

	Camera *camara = m_cam;
	BSphere *esfera = m_bsph;
	Node *rootNode = Scene::instance()->rootNode(); // root node of scene
	Vector3 posNueva;

	/*comprobamos si hay colisiones*/
	  // No mueves la camara... solo pones el centro donde estara la camara en el futuro si no hay colision
 

	if(m_walk){

		//walk = true: resposicionamos solo las coordenadas 'x' y 'z' de la esfera (la y no hay que moverla)
		posNueva.x() = camara->getPosition().x() + camara->getDirection().x()*step;
		posNueva.z() = camara->getPosition().z() + camara->getDirection().z()*step;
		
		
	}else
	{
	 //si walk es false -> fly: reposicionamos todas las coordenadas del centro de la esfera
	 // el caso walk seria sin mover y	
		posNueva = camara->getPosition() + camara->getDirection() * step;
	}
	esfera->setPosition(posNueva);

	if(rootNode->checkCollision(esfera) == 0)
	{
        //no hay colision
		
			//si no hay colisión y walk = true
		if(m_walk)
		{
			camara->walk(step);
		}
		//si no hay colisión y walk = false -> fly
		else{
			camara->fly(step);
		}
		return false;	
	}
	else 
	return true;
}

void Avatar::leftRight(float angle) {
	if (m_walk)
		m_cam->viewYWorld(angle);
	else
		m_cam->yaw(angle);
}

void Avatar::upDown(float angle) {
	m_cam->pitch(angle);
}

void Avatar::print() const { }
