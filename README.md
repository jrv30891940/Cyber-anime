CYBER//ANIME — Plataforma de Gestión y Descubrimiento de Anime con Estética Cyberpunk

Introducción

CYBER//ANIME es una aplicación web de código abierto diseñada para los entusiastas del anime que desean organizar su experiencia de visualización con un estilo visual inmersivo y tecnología moderna. Con una interfaz que evoca el universo cyberpunk —fondos oscuros, tipografía neón verde y elementos de cristal—, la plataforma combina funcionalidad y estética para ofrecer una herramienta completa y accesible.

El proyecto se desarrolla íntegramente con tecnologías frontend estándar (HTML5, CSS3 y JavaScript ES6+), sin depender de servidores backend ni bases de datos externas. Toda la información persistente se almacena localmente en el dispositivo del usuario mediante localStorage, garantizando privacidad y autonomía. Los datos de anime se obtienen en tiempo real a través de la API pública Jikan (v4), un puente no oficial hacia la base de datos de MyAnimeList.

---

Funcionalidades Principales

1. Sistema de Búsqueda Avanzada

El módulo de búsqueda permite consultar la base de datos de Jikan con resultados ordenados cronológicamente (de más reciente a más antiguo). Incluye un botón "Sorpréndeme" que selecciona un anime aleatorio, ideal para descubrir títulos fuera de los circuitos habituales.

2. Top de Temporada

Sección que muestra los 24 animes más populares de la temporada actual, actualizados automáticamente. Esta funcionalidad facilita estar al día de las tendencias y los estrenos más esperados.

3. Calendario Semanal de Emisiones

Un calendario interactivo que organiza los animes en emisión por día de la semana. Para cada título se muestra el horario de emisión en hora local del usuario y en hora estándar de Japón (JST), permitiendo un seguimiento preciso de los estrenos.

4. Gestión Personal de Listas (Mi Lista)

El núcleo de la aplicación reside en la capacidad de construir y administrar una biblioteca personal de animes, categorizada en tres estados: Por Ver, Viendo y Terminado. Para cada entrada se pueden registrar:

· Progreso de episodios: indicador visual con barra de progreso.
· Calificación: escala de 1 a 10 estrellas.
· Fechas de inicio y finalización.
· Notas personales: campo de texto libre para observaciones, reseñas o impresiones.

Además, la lista incorpora herramientas de filtrado por género y tipo (serie, película, OVA, etc.), así como un buscador interno. La función de selección múltiple permite eliminar varios registros simultáneamente, optimizando la gestión.

5. Generador de Cartas Coleccionables

Herramienta creativa que genera imágenes con diseño de carta coleccionable a partir de cualquier anime presente en Mi Lista. El usuario puede personalizar el título, su nombre y un mensaje, obteniendo una pieza visual lista para compartir en redes sociales o conservar como recuerdo.

6. CYBER//ANIME WRAPPED

Resumen anual interactivo disponible exclusivamente entre el 25 y el 31 de diciembre. Al acceder durante esas fechas, se despliega una animación con estadísticas personalizadas del año: total de animes vistos, distribución por géneros, calificación promedio y otros datos relevantes. Este componente busca cerrar el ciclo anual con una experiencia nostálgica y gamificada.

7. Respaldo y Migración de Datos

Para garantizar la portabilidad y seguridad de la información, la aplicación permite exportar la lista completa a un archivo JSON y importarla posteriormente. Esta funcionalidad facilita la migración entre dispositivos o la creación de copias de seguridad sin depender de servicios en la nube.

8. Pantalla de Introducción Animada

Al cargar la aplicación, se presenta una secuencia de inicio con efecto terminal: texto parpadeante en verde, líneas de código y un mensaje de bienvenida que refuerza la temática cyberpunk y prepara al usuario para la experiencia inmersiva.

---

Arquitectura Tecnológica

Capa Tecnología / Recurso
Frontend HTML5, CSS3 (variables, animaciones, glassmorphism), JavaScript ES6+
Datos de anime Jikan API v4 (RESTful, sin autenticación)
Persistencia localStorage del navegador
Tipografía Google Fonts: Orbitron, Share Tech Mono
Despliegue Compatible con cualquier servidor estático (recomendado: GitHub Pages, Netlify, Vercel)

El proyecto se distribuye en tres archivos principales (index.html, styles.css, script.js) y no requiere compilación ni dependencias adicionales. Esto facilita su auditoría, modificación y despliegue inmediato.

---

Público Objetivo y Casos de Uso

· Aficionados al anime que desean un registro personalizado y estéticamente atractivo de su progreso.
· Desarrolladores frontend interesados en ejemplos de integración con APIs REST, manejo de estado con JavaScript puro y persistencia local.
· Usuarios preocupados por la privacidad que prefieren no compartir sus datos con servicios centralizados.
· Coleccionistas digitales que disfrutan de elementos visuales personalizados (cartas, resúmenes anuales).

---

Agradecimientos

Este proyecto no habría sido posible sin el trabajo de:

· Jikan.moe y su equipo, por mantener una API pública, gratuita y bien documentada que permite acceder a los datos de MyAnimeList de manera eficiente.
· La comunidad open source, cuyos innumerables ejemplos, tutoriales y debates han inspirado y guiado el desarrollo de CYBER//ANIME.
· Colaboradores y beta testers que han aportado sugerencias, reportado errores y ayudado a pulir la experiencia de usuario.

---

Licencia y Derechos

CYBER//ANIME es un proyecto desarrollado por FGMCL. Se distribuye bajo los términos de la licencia MIT, lo que significa que puede ser utilizado, modificado y redistribuido libremente, siempre que se mantenga el aviso de copyright original.

Los datos de anime son proporcionados por Jikan API y, en última instancia, provienen de MyAnimeList. Este proyecto no está afiliado oficialmente ni con MyAnimeList ni con Jikan.moe.

---

© 2026 · FGMCL · Todos los derechos reservados.