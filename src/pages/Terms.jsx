import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 p-8 font-sans">
      <button 
        onClick={() => navigate(-1)} 
        className="mb-8 text-emerald-500 font-bold flex items-center gap-2 hover:text-emerald-400 transition"
      >
        ← Volver
      </button>

      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-4xl font-black text-white tracking-tighter">Términos y <span className="text-emerald-500">Condiciones</span></h1>
        <p className="text-sm text-zinc-500 uppercase font-bold tracking-widest">Última actualización: 18 de marzo, 2026</p>
        
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">1. Uso de la plataforma</h2>
          <p>padelzero es una herramienta para la gestión de partidos y competición. El usuario se compromete a mantener un comportamiento deportivo y veraz en el registro de scores.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">2. Cuentas de usuario</h2>
          <p>Tu cuenta es personal e intransferible. Cualquier mal uso de la misma resultará en la suspensión temporal o definitiva de tu perfil.</p>
        </section>
        
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">3. Responsabilidad</h2>
          <p>padelzero no se hace responsable por lesiones físicas o altercados durante la realización de los partidos registrados en la plataforma.</p>
        </section>

        <footer className="pt-12 border-t border-zinc-900 text-xs text-zinc-600">
          padelzero © 2026 · Todos los derechos reservados.
        </footer>
      </div>
    </div>
  );
}
