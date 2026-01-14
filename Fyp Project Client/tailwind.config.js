/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#524b96',
          dark: '#524b96',
          light: '#524b96',
        },
        coral: {
          DEFAULT: '#f47458',
          dark: '#f47458',
          light: '#f47458',
        },
        sidebar: {
          DEFAULT: '#514b96',
          hover: '#514b96',
        },
        header: {
          DEFAULT: '#524b96',
        },
      },
    },
  },
  plugins: [],
}
