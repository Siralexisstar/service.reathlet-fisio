# Reathlet

Primera versión en React 19, TypeScript y Vite de la web de fisioterapia de Reathlet, basada en la [propuesta de referencia](https://reathlet-fisioterapia.alexgarciavillar96.chatgpt.site/).

## Desarrollo

```sh
npm install
npm run dev
```

Vite muestra en la terminal la dirección local. Para comprobar el proyecto:

```sh
npm run lint
npm run build
npm run preview
```

## Contenido

- Portada con carrusel de tres fotografías y reproducción controlada.
- Ocho tratamientos con carrusel horizontal y fichas informativas.
- Cuatro etapas de recuperación, con navegación por teclado.
- Galería de la consulta, preguntas frecuentes y contacto.
- Formularios para pacientes nuevos y existentes: validación, firma escrita o dibujada y vista previa de contacto.
- Aviso legal, privacidad, cookies y accesibilidad en las rutas `/legal/*`.

El logotipo, las fotografías, los textos y la base visual se han trasladado desde la referencia. Las imágenes se sirven desde `public/images`, sin depender de la sesión del sitio original.

## Estructura

- `src/App.tsx`: secciones de la página y navegación.
- `src/data.ts`: tratamientos, fotografías, pasos, preguntas y datos de contacto.
- `src/components/BookingDialog.tsx`: recorrido de solicitud de cita.
- `src/components/Modal.tsx`: ventanas nativas con gestión del foco.
- `src/components/LegalPage.tsx`: páginas informativas.
- `src/App.css`: estilos y adaptación a móvil.

## Estado de esta primera versión

Las solicitudes son una demostración, como en la propuesta original. Utiliza datos ficticios. El formulario y la firma permanecen en memoria y se descartan al cerrar; no hay backend ni reservas reales.

La vista previa de WhatsApp permite copiar el mensaje; el número de destino está pendiente de configurar. El correo puede abrir un borrador en el cliente del visitante. El mensaje contiene únicamente el nombre y la preferencia horaria, sin añadir la información de salud ni la firma.

Los horarios, el número de colegiado y la información legal conservan los datos de muestra de la referencia. Para una siguiente versión quedan la validación de los datos profesionales, la configuración de WhatsApp y la integración real de solicitudes.
