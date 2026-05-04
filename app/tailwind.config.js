/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}", // <--- Importante: Faz o Tailwind ler seus componentes
  ],
  theme: {
    extend: {
      // Podemos estender a paleta aqui se quiser cores personalizadas
      colors: {
        primary: '#3b82f6', // blue-500
        secondary: '#a855f7', // purple-500
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}