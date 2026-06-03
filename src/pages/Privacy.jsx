import { useNavigate } from 'react-router-dom'

export default function Privacy() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 px-4 py-8 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 text-emerald-500 font-bold flex items-center gap-2 hover:text-emerald-400 transition"
      >
        ← Volver
      </button>

      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">
            Aviso de <span className="text-emerald-500">Privacidad</span>
          </h1>
          <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest mt-2">
            Última actualización: 27 de marzo, 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">1. Identidad del Responsable</h2>
          <p className="text-sm leading-relaxed">
            PadelZero, con domicilio en México, es el responsable del
            tratamiento de sus datos personales. Puede contactarnos en:{' '}
            <a href="mailto:privacidad@padelzero.win" className="text-emerald-400 underline">privacidad@padelzero.win</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">2. Datos Personales que Recopilamos</h2>
          <p className="text-sm leading-relaxed">Para la prestación de nuestros servicios, recopilamos:</p>
          <ul className="list-disc list-inside text-sm space-y-1 text-zinc-400">
            <li><span className="text-zinc-200">Datos de identificación:</span> nombre, correo electrónico, número de teléfono</li>
            <li><span className="text-zinc-200">Datos de perfil deportivo:</span> nivel de habilidad auto-evaluado, puntaje ATP, historial de partidos, estadísticas de juego</li>
            <li><span className="text-zinc-200">Datos de ubicación:</span> ciudad y país (proporcionados voluntariamente)</li>
            <li><span className="text-zinc-200">Datos de uso:</span> interacciones con la aplicación, preferencias de interfaz</li>
            <li><span className="text-zinc-200">Datos técnicos:</span> dirección IP, tipo de dispositivo, sistema operativo (recopilados automáticamente)</li>
          </ul>
          <p className="text-sm leading-relaxed">
            <strong className="text-white">No</strong> recopilamos datos financieros, datos biométricos, ni datos sensibles según la LFPDPPP.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">3. Finalidades del Tratamiento</h2>
          <p className="text-sm font-semibold text-zinc-200">Finalidades primarias (necesarias para el servicio):</p>
          <ul className="list-disc list-inside text-sm space-y-1 text-zinc-400">
            <li>Crear y gestionar su cuenta de usuario</li>
            <li>Registrar partidos de pádel y calcular puntajes ATP</li>
            <li>Mostrar rankings y clasificaciones públicas</li>
            <li>Gestionar su participación en ligas y torneos</li>
            <li>Enviar notificaciones de resultados y actividad</li>
          </ul>
          <p className="text-sm font-semibold text-zinc-200 mt-3">Finalidades secundarias (opcionales):</p>
          <ul className="list-disc list-inside text-sm space-y-1 text-zinc-400">
            <li>Enviar comunicaciones sobre eventos y torneos en su zona</li>
            <li>Generar estadísticas agregadas y anónimas sobre el deporte</li>
            <li>Mejorar la experiencia del usuario mediante análisis de uso</li>
          </ul>
          <p className="text-sm text-zinc-500 mt-2">
            Si no desea que sus datos personales sean tratados para las finalidades secundarias,
            puede comunicarlo a <a href="mailto:privacidad@padelzero.win" className="text-emerald-400 underline">privacidad@padelzero.win</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">4. Derechos ARCO</h2>
          <p className="text-sm leading-relaxed">
            Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos
            personales (Derechos ARCO). Para ejercer estos derechos, envíe una solicitud a{' '}
            <a href="mailto:privacidad@padelzero.win" className="text-emerald-400 underline">privacidad@padelzero.win</a>{' '}
            indicando:
          </p>
          <ul className="list-disc list-inside text-sm space-y-1 text-zinc-400">
            <li>Nombre completo y correo electrónico registrado</li>
            <li>Descripción clara del derecho que desea ejercer</li>
            <li>Documentos que acrediten su identidad</li>
          </ul>
          <p className="text-sm text-zinc-400">
            Responderemos a su solicitud en un plazo máximo de 20 días hábiles.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">5. Revocación del Consentimiento</h2>
          <p className="text-sm leading-relaxed">
            Puede revocar su consentimiento para el tratamiento de datos personales en cualquier momento,
            enviando una solicitud a <a href="mailto:privacidad@padelzero.win" className="text-emerald-400 underline">privacidad@padelzero.win</a>.
            Tenga en cuenta que la revocación puede impedir la prestación del servicio si los datos
            son necesarios para su funcionamiento.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">6. Limitación de Uso y Divulgación</h2>
          <p className="text-sm leading-relaxed">
            Sus datos personales no se comparten con terceros para fines de marketing.
            Los rankings y estadísticas de juego son visibles públicamente dentro de la plataforma
            como parte esencial del servicio competitivo.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">7. Transferencias Internacionales</h2>
          <p className="text-sm leading-relaxed">
            Sus datos personales se almacenan en servidores de Supabase Inc. ubicados en Estados Unidos.
            Al utilizar PadelZero, usted consiente esta transferencia internacional de datos.
            Supabase cumple con estándares de seguridad de la industria incluyendo cifrado en tránsito
            y en reposo, y aislamiento de datos mediante Row Level Security (RLS).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">8. Cookies y Tecnologías de Rastreo</h2>
          <p className="text-sm leading-relaxed">
            Utilizamos almacenamiento local del navegador (localStorage) y cookies técnicas para:
          </p>
          <ul className="list-disc list-inside text-sm space-y-1 text-zinc-400">
            <li>Mantener su sesión activa</li>
            <li>Almacenar preferencias de interfaz</li>
            <li>Permitir el funcionamiento offline de la aplicación (Service Worker)</li>
          </ul>
          <p className="text-sm text-zinc-400">
            No utilizamos cookies de terceros con fines publicitarios.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">9. Cambios al Aviso de Privacidad</h2>
          <p className="text-sm leading-relaxed">
            Nos reservamos el derecho de modificar este Aviso de Privacidad. Cualquier cambio será
            publicado en esta página y, en caso de cambios significativos, se lo notificaremos
            mediante la aplicación. La fecha de última actualización aparece al inicio de este documento.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">10. Medidas de Seguridad</h2>
          <p className="text-sm leading-relaxed">
            Implementamos las siguientes medidas para proteger sus datos personales:
          </p>
          <ul className="list-disc list-inside text-sm space-y-1 text-zinc-400">
            <li>Cifrado HTTPS/TLS en todas las comunicaciones</li>
            <li>Row Level Security (RLS) para aislamiento de datos por usuario</li>
            <li>Autenticación segura con tokens JWT</li>
            <li>Almacenamiento cifrado en reposo en la base de datos</li>
            <li>Acceso restringido a datos de producción</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">11. Uso de Decisiones Automatizadas</h2>
          <p className="text-sm leading-relaxed">
            PadelZero utiliza algoritmos automatizados para:
          </p>
          <ul className="list-disc list-inside text-sm space-y-1 text-zinc-400">
            <li>Calcular puntajes ATP basados en resultados de partidos</li>
            <li>Generar emparejamientos automáticos en torneos</li>
            <li>Recomendar oponentes de nivel similar</li>
          </ul>
          <p className="text-sm text-zinc-400">
            Estas decisiones automatizadas se basan exclusivamente en sus datos deportivos
            y no afectan derechos fundamentales fuera del contexto de la plataforma.
          </p>
        </section>

        <footer className="pt-8 border-t border-zinc-800 text-xs text-zinc-600 space-y-2">
          <p>PadelZero — padelzero.win</p>
          <p>PadelZero · México</p>
          <p>Contacto: privacidad@padelzero.win</p>
          <p>© 2026 · Todos los derechos reservados.</p>
        </footer>
      </div>
    </div>
  )
}
