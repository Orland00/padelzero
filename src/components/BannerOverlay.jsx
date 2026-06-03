import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

/**
 * BannerOverlay Component
 * Displays a random image from the 'banners' Supabase bucket.
 * The close button (X) appears after a 1-second delay.
 */
export default function BannerOverlay({ onClose }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [showClose, setShowClose] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    async function fetchRandomBanner() {
      try {
        const { data: files, error } = await supabase.storage.from('banners').list('', {
          limit: 100,
          sortBy: { column: 'name', order: 'asc' }
        });

        if (error) throw error;

        if (!files || files.length === 0) {
          throw new Error('No files');
        }

        // Filter for images and ignore hidden files like .DS_Store
        const imageFiles = files.filter(f => f.name && !f.name.startsWith('.') && f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i));
        
        if (imageFiles.length === 0) {
          throw new Error('No images');
        }

        const randomFile = imageFiles[Math.floor(Math.random() * imageFiles.length)];
        const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(randomFile.name);
        
        setImageUrl(publicUrl);
        
      } catch (err) {
        // Using a reliable placeholder image that definitely allows CORS/hotlinking
        setImageUrl('https://placehold.co/600x400/10b981/ffffff?text=Tu+Anuncio+Aquit'); 
      } finally {
        setFetching(false);
        setTimeout(() => setShowClose(true), 500);
      }
    }

    fetchRandomBanner();
  }, [onClose]);

  if (fetching && !imageUrl) return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md"
      >
        <motion.div
           initial={{ scale: 0.95, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="relative max-w-[90vw] max-h-[80vh] flex flex-col items-center justify-center"
        >
           <div className={`relative transition-all duration-500 ${imgLoaded ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
             <img 
               src={imageUrl} 
               alt="Publicidad" 
               onLoad={() => {
                 setImgLoaded(true);
               }}
               onError={(e) => {
                 if (!e.target.src.includes('placehold.co')) {
                   e.target.src = 'https://placehold.co/600x400/10b981/ffffff?text=Tu+Anuncio+Aqui';
                 } else {
                   e.target.style.display = 'none'; // Hide if fallback fails
                 }
                 setImgLoaded(true);
               }}
               className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl bg-zinc-800/80 p-2 border-2 border-white/10"
             />
             
             {showClose && (
               <button
                 onClick={onClose}
                 className="absolute -top-4 -right-4 w-12 h-12 bg-white text-zinc-950 rounded-full flex items-center justify-center font-bold text-2xl shadow-2xl transition-all active:scale-90 z-[110] border-4 border-zinc-950"
               >
                 ✕
               </button>
             )}
           </div>
           
           {!imgLoaded && (
             <div className="mt-4 text-zinc-500 text-xs font-bold animate-pulse">
               CARGANDO PUBLICIDAD...
             </div>
           )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
