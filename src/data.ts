import type { IconName } from './components/Icon'

export const legalLinks = [
  { slug: 'aviso-legal', label: 'Aviso legal', title: 'Aviso legal' },
  { slug: 'privacidad', label: 'Privacidad', title: 'Política de privacidad' },
  { slug: 'cookies', label: 'Cookies', title: 'Política de cookies' },
  { slug: 'accesibilidad', label: 'Accesibilidad', title: 'Accesibilidad' },
]

export const contact = {
  email: 'informaciónreathlet@gmail.com',
  whatsapp: '34611537927',
  address: 'Pg. dels Ferrocarrils Catalans, 167',
  city: '08940 Cornellà de Llobregat, Barcelona',
  maps: 'https://www.google.com/maps/search/?api=1&query=Pg.%20dels%20Ferrocarrils%20Catalans%2C%20167%2C%2008940%20Cornell%C3%A0%20de%20Llobregat%2C%20Barcelona',
}

export const socialLinks: { name: string; href: string; icon: 'instagram' | 'tiktok' }[] = [
  { name: 'Instagram', href: 'https://www.instagram.com/reathlet_fisio/', icon: 'instagram' },
  { name: 'TikTok', href: 'https://www.tiktok.com/@reathlet_fisio?_r=1&_t=ZS-95M7tDlfvSK', icon: 'tiktok' },
]

export const photographs = [
  { src: '/images/terapia-manual.jpeg', alt: 'Fisioterapeuta de Reathlet atendiendo a una persona en la consulta', caption: 'Atención cercana, en cada sesión', position: '50% 35%' },
  { src: '/images/valoracion.jpeg', alt: 'Valoración con tecnología de ecografía en la consulta de Reathlet', caption: 'Tecnología al servicio de tu valoración', position: '50% 35%' },
  { src: '/images/fisioterapeuta.jpeg', alt: 'Profesional de Reathlet junto al equipo de ecografía', caption: 'Conoce a las personas que te acompañan', position: '50% 29%' },
  { src: '/images/recuperacion.jpeg', alt: 'Acompañamiento de fisioterapia durante la recuperación', caption: 'Acompañamiento durante la recuperación', position: '50% 35%' },
  { src: '/images/recuperacion-grupal.jpeg', alt: 'Equipo de fisioterapia de Reathlet atendiendo a varias personas en una sesión grupal', caption: 'Recuperación en equipo, atención cercana', position: '50% 50%' },
]

export const treatments: { title: string; category: string; icon: IconName; summary: string; description: string }[] = [
  { title: 'Terapia manual', category: 'Movilidad y función', icon: 'heart', summary: 'Un trabajo preciso con las manos para mejorar tu movilidad y función.', description: 'Técnicas manuales dirigidas a mejorar la movilidad, disminuir el dolor y optimizar la función musculoesquelética.' },
  { title: 'Ecografía musculoesquelética', category: 'Valoración', icon: 'scan', summary: 'Ver más para entender mejor. Una herramienta que complementa tu valoración clínica.', description: 'Herramienta de valoración que permite visualizar en tiempo real músculos, tendones, ligamentos y otras estructuras para complementar la evaluación clínica y orientar el tratamiento.' },
  { title: 'Ondas de choque', category: 'Recuperación funcional', icon: 'waves', summary: 'Ondas acústicas aplicadas al tejido para acompañar su recuperación funcional.', description: 'Aplicación de ondas acústicas sobre tejidos musculoesqueléticos para estimular procesos biológicos, mejorar la capacidad del tejido y favorecer la recuperación funcional.' },
  { title: 'Electrólisis percutánea ecoguiada', category: 'Técnica ecoguiada', icon: 'target', summary: 'Un abordaje localizado del tejido lesionado, guiado por ecografía.', description: 'Técnica invasiva guiada por ecografía que utiliza una corriente eléctrica para favorecer la respuesta regenerativa y la recuperación de tejidos lesionados.' },
  { title: 'Neuromodulación percutánea', category: 'Dolor y función', icon: 'activity', summary: 'Estimulación dirigida a estructuras neuromusculares para modular el dolor.', description: 'Técnica mediante estimulación eléctrica a través de agujas, dirigida a estructuras neuromusculares para modular el dolor y mejorar la función del sistema neuromuscular.' },
  { title: 'Punción seca', category: 'Tratamiento muscular', icon: 'syringe', summary: 'Una técnica específica para puntos musculares que pueden estar relacionados con tus molestias.', description: 'Técnica invasiva mediante agujas sobre puntos musculares específicos para disminuir el dolor, normalizar el tono y mejorar la función muscular.' },
  { title: 'Masoterapia', category: 'Cuidado muscular', icon: 'hand', summary: 'Masaje terapéutico para favorecer la movilidad de los tejidos y la recuperación muscular.', description: 'Técnicas de masaje orientadas a mejorar la movilidad de los tejidos, favorecer la circulación y facilitar la recuperación muscular.' },
  { title: 'Diatermia', category: 'Tecnología terapéutica', icon: 'audio', summary: 'Radiofrecuencia con un efecto térmico controlado, adaptado a tu tratamiento.', description: 'Terapia mediante radiofrecuencia que genera un efecto térmico controlado en los tejidos, favoreciendo la circulación, el metabolismo tisular y la recuperación funcional.' },
]

export const recoverySteps = [
  { label: 'Te escuchamos', subtitle: 'Valoración inicial', title: 'Empezamos por tu historia, no por una técnica.', text: 'Hablamos de tus molestias, tus antecedentes y lo que quieres recuperar. La exploración clínica nos ayuda a entender cómo te mueves y qué necesitas.', icon: 'clipboard' as IconName },
  { label: 'Lo entendemos', subtitle: 'Estudio y objetivos', title: 'Entender lo que pasa. Saber hacia dónde vamos.', text: 'Cuando está indicada, la ecografía complementa la valoración. Te explicamos lo que observamos y acordamos objetivos concretos y realistas contigo.', icon: 'scan' as IconName },
  { label: 'Lo trabajamos', subtitle: 'Tratamiento personal', title: 'Un tratamiento con sentido para ti.', text: 'Elegimos las técnicas según tu valoración, tus preferencias y la evolución. Te explicamos cada paso y ajustamos el trabajo a tu tolerancia y a tu día a día.', icon: 'hand' as IconName },
  { label: 'Te acompañamos', subtitle: 'Seguimiento', title: 'La recuperación no termina al salir de la consulta.', text: 'Revisamos cómo evolucionas y adaptamos el plan cuando lo necesitas. El objetivo es que entiendas tu proceso y vuelvas a moverte con más autonomía y confianza.', icon: 'activity' as IconName },
]

export const questions = [
  { question: '¿Tengo que saber qué tratamiento necesito?', answer: 'No. En la primera visita hablamos de lo que te ocurre y realizamos una valoración. Después te explicamos las opciones y acordamos contigo los siguientes pasos.' },
  { question: '¿Solo atendéis a personas que hacen deporte?', answer: 'No. La fisioterapia también acompaña las molestias del día a día. Tanto si tu objetivo es volver a entrenar como caminar, trabajar o moverte con más comodidad, empezamos por tu caso.' },
  { question: '¿Qué debo traer a la primera visita?', answer: 'Ropa cómoda y, si los tienes, informes o pruebas relacionados con el motivo de consulta. Los antecedentes y la medicación se comentan con el profesional durante la valoración.' },
  { question: '¿La solicitud confirma una cita?', answer: 'La solicitud es el primer contacto. La clínica debe confirmar contigo la disponibilidad, la duración y el precio antes de reservar. No necesitas pagar para solicitar información.' },
  { question: '¿Por qué hay un formulario para nuevos pacientes?', answer: 'Nos ayuda a preparar la primera conversación. El envío por correo incluye el formulario completo y la firma seleccionada cuando está habilitado. No confirma una cita automáticamente. La revisión de privacidad y seguridad para datos sanitarios reales sigue pendiente.' },
]
